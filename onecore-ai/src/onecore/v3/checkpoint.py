"""Strict, atomic V3 training checkpoints with complete resume lineage.

V3 checkpoints are intentionally incompatible with the V2 format. They bind
model and optimizer state to the exact V3 config, tokenizer bytes, validated
manifest, data cursors, RNG states, and parent-checkpoint lineage.
"""
from __future__ import annotations

import hashlib
from itertools import chain
import json
import os
import random
import re
import tempfile
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlparse

import numpy as np
import torch
from tokenizers import Tokenizer

from .config import V3Config
from .core import OneCoreV3
from .manifest import assert_v3_external_coverage, read_v3_manifest

FORMAT_VERSION = 1
V3_CHECKPOINT_FORMAT_VERSION = FORMAT_VERSION
V3_DATA_STATE_FORMAT_VERSION = 1
V3_DATA_FAMILIES = ("text", "tool", "image", "audio", "video")
ARCHITECTURE_FAMILY = "onecore-v3"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_sha256(value: str, field: str) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError(f"{field} must be a lowercase SHA-256 hex digest")
    return value


def _tokenizer_payload(tokenizer_json: bytes | bytearray | memoryview | str,
                       expected_vocab_size: int) -> tuple[bytes, int, str]:
    if isinstance(tokenizer_json, str):
        encoded = tokenizer_json.encode("utf-8")
    elif isinstance(tokenizer_json, (bytes, bytearray, memoryview)):
        encoded = bytes(tokenizer_json)
    else:
        raise TypeError("tokenizer_json must be UTF-8 JSON bytes or a string")
    if not encoded:
        raise ValueError("tokenizer_json cannot be empty")
    try:
        tokenizer = Tokenizer.from_str(encoded.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"tokenizer_json is not a valid serialized tokenizer: {exc}") from exc
    vocab_size = int(tokenizer.get_vocab_size(with_added_tokens=True))
    if vocab_size != int(expected_vocab_size):
        raise ValueError(
            f"tokenizer vocabulary mismatch: actual={vocab_size}, "
            f"V3 config requires={int(expected_vocab_size)}"
        )
    return encoded, vocab_size, sha256_bytes(encoded)


def _normalise_lineage(lineage: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(lineage, Mapping):
        raise TypeError("lineage must be a mapping")
    value = dict(lineage)
    run_id = value.get("run_id")
    session = value.get("session")
    parent = value.get("parent_checkpoint_sha256")
    if not isinstance(run_id, (str, int)) or not str(run_id).strip():
        raise ValueError("lineage.run_id must be a non-empty string or integer")
    if isinstance(session, bool) or not isinstance(session, int) or session < 1:
        raise ValueError("lineage.session must be a positive integer")
    if parent is not None:
        _require_sha256(parent, "lineage.parent_checkpoint_sha256")
    if int(session) > 1 and parent is None:
        raise ValueError("lineage sessions after session 1 require a parent checkpoint SHA-256")
    value["run_id"] = str(run_id)
    value["session"] = int(session)
    value["parent_checkpoint_sha256"] = parent
    try:
        json.dumps(value, sort_keys=True, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"lineage must be JSON-serializable: {exc}") from exc
    return value


def _normalise_data_state(
    data_state: Mapping[str, Any],
    *,
    manifest_sha256: str,
    global_step: int,
) -> dict[str, Any]:
    """Validate a train-only, five-family cursor snapshot before checkpoint I/O."""
    if not isinstance(data_state, Mapping):
        raise TypeError("data_state must be a mapping containing V3 training cursors")
    try:
        value = json.loads(json.dumps(dict(data_state), sort_keys=True, allow_nan=False))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"data_state must be JSON-serializable: {exc}") from exc

    version = value.get("format_version")
    if isinstance(version, bool) or not isinstance(version, int) or version != V3_DATA_STATE_FORMAT_VERSION:
        raise ValueError("unsupported V3 data-state format version")
    if value.get("manifest_sha256") != manifest_sha256:
        raise ValueError("V3 data-state manifest fingerprint mismatch")
    if value.get("split") != "train":
        raise ValueError("V3 checkpoint data-state may contain only the train split")

    families = value.get("families")
    if not isinstance(families, dict) or set(families) != set(V3_DATA_FAMILIES):
        raise ValueError("V3 data-state must contain exactly text, tool, image, audio and video families")

    family_counts: dict[str, int] = {}
    for family in V3_DATA_FAMILIES:
        state = families[family]
        if not isinstance(state, dict):
            raise ValueError(f"V3 data-state family cursor is invalid: {family}")
        rows_consumed = state.get("rows_consumed")
        if isinstance(rows_consumed, bool) or not isinstance(rows_consumed, int) or rows_consumed < 0:
            raise ValueError(f"V3 data-state rows_consumed must be a non-negative integer: {family}")
        last_record_id = state.get("last_record_id")
        if rows_consumed == 0 and last_record_id is not None:
            raise ValueError(f"V3 data-state empty family has a last_record_id: {family}")
        if rows_consumed > 0 and (not isinstance(last_record_id, str) or not last_record_id.strip()):
            raise ValueError(f"V3 data-state consumed family is missing last_record_id: {family}")
        family_counts[family] = rows_consumed

    source_cursors = value.get("source_cursors")
    if not isinstance(source_cursors, dict):
        raise ValueError("V3 data-state source_cursors must be a mapping")
    cursor_totals = {family: 0 for family in V3_DATA_FAMILIES}
    mutable_revisions = {"main", "master", "latest", "head"}
    for cursor_id, cursor in source_cursors.items():
        if not isinstance(cursor_id, str) or not cursor_id.strip() or not isinstance(cursor, dict):
            raise ValueError("V3 source cursor identity or payload is invalid")
        family = cursor.get("family")
        if family not in V3_DATA_FAMILIES:
            raise ValueError(f"V3 source cursor has an unsupported family: {family}")
        source_id = cursor.get("source_id")
        revision = cursor.get("source_revision")
        source_url = cursor.get("source_url")
        if not isinstance(source_id, str) or not source_id.strip():
            raise ValueError("V3 source cursor is missing source_id")
        if not isinstance(revision, str) or not revision.strip():
            raise ValueError("V3 source cursor is missing immutable source_revision")
        if revision.strip().lower() in mutable_revisions or revision.strip().lower().startswith("refs/heads/"):
            raise ValueError("V3 source cursor source_revision is a mutable reference, not a pinned revision")
        parsed_url = urlparse(source_url) if isinstance(source_url, str) else None
        if parsed_url is None or parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError("V3 source cursor requires an immutable HTTP(S) source_url")
        if cursor.get("data_class") != "external":
            raise ValueError("V3 checkpoint source cursors must be external-only")
        if cursor.get("split") != "train":
            raise ValueError("V3 checkpoint source cursors may contain only the train split")

        rows_consumed = cursor.get("rows_consumed")
        if isinstance(rows_consumed, bool) or not isinstance(rows_consumed, int) or rows_consumed < 0:
            raise ValueError("V3 source cursor rows_consumed must be a non-negative integer")
        cursor_state = cursor.get("cursor_state")
        if not isinstance(cursor_state, dict):
            raise ValueError("V3 source cursor cursor_state must be a mapping")
        mode = cursor_state.get("mode")
        if mode == "offset":
            offset = cursor_state.get("offset")
            if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0 or offset != rows_consumed:
                raise ValueError("V3 source cursor offset does not match rows_consumed")
        elif mode == "state_dict":
            state_dict = cursor_state.get("state_dict")
            if not isinstance(state_dict, (dict, list)):
                raise ValueError("V3 state_dict cursor mode requires a mapping or list state_dict")
        else:
            raise ValueError("V3 source cursor mode must be offset or state_dict")

        last_source_row = cursor.get("last_source_row_id_sha256")
        if rows_consumed > 0:
            _require_sha256(last_source_row, "source_cursor.last_source_row_id_sha256")
        elif last_source_row is not None:
            _require_sha256(last_source_row, "source_cursor.last_source_row_id_sha256")

        expected_cursor_id = f"{family}::{source_id}@{revision}"
        if cursor_id != expected_cursor_id:
            raise ValueError("V3 source cursor key does not match its family/source/revision identity")
        cursor_totals[family] += rows_consumed

    for family in V3_DATA_FAMILIES:
        if cursor_totals[family] != family_counts[family]:
            raise ValueError(f"V3 source cursor totals do not match family rows_consumed: {family}")
        if global_step > 0 and family_counts[family] < global_step:
            raise ValueError(
                f"V3 joint checkpoint family {family} consumed fewer records than global_step"
            )

    return value


def _assert_model_matches_config(model: OneCoreV3, config: V3Config) -> None:
    shared_layers = list(model.shared_core.layers)
    temporal_layers = list(model.video_codec.temporal.layers)
    codebooks = list(model.audio_codec.quantizer.codebooks)
    audio_encoder_first = model.audio_codec.encoder[0]
    audio_encoder_last = model.audio_codec.encoder[-1]
    audio_decoder_first = model.audio_codec.decoder[0]
    shared_heads_match = bool(shared_layers) and all(
        int(layer.self_attn.num_heads) == int(config.attention_heads)
        and abs(float(layer.dropout.p) - float(config.dropout)) <= 1e-12
        for layer in shared_layers
    )
    temporal_heads_match = bool(temporal_layers) and all(
        int(layer.self_attn.num_heads) == int(config.attention_heads)
        for layer in temporal_layers
    )
    checks = {
        "text_vocab_size": int(model.text_embedding.num_embeddings) == int(config.text_vocab_size)
            and int(model.text_head.out_features) == int(config.text_vocab_size),
        "tied_text_projection": model.text_head.weight is model.text_embedding.weight,
        "modality_slots": int(model.modality_embedding.num_embeddings) == 5,
        "width": int(model.width) == int(config.width)
            and int(model.shared_core.width) == int(config.width)
            and int(model.image_codec.width) == int(config.width)
            and int(model.video_codec.width) == int(config.width)
            and int(model.audio_to_shared.out_channels) == int(config.width)
            and int(model.shared_to_audio.in_channels) == int(config.width),
        "layers": len(shared_layers) == int(config.layers),
        "cycles": int(model.shared_core.cycles) == int(config.cycles),
        "attention_heads": shared_heads_match and temporal_heads_match,
        "dropout": shared_heads_match,
        "patch_size": int(model.image_codec.patch_size) == int(config.patch_size)
            and int(model.video_codec.image_codec.patch_size) == int(config.patch_size),
        "audio_latent_channels": int(model.audio_codec.latent_channels) == int(config.audio_latent_channels)
            and int(model.audio_to_shared.in_channels) == int(config.audio_latent_channels)
            and int(model.shared_to_audio.out_channels) == int(config.audio_latent_channels)
            and int(audio_encoder_last.out_channels) == int(config.audio_latent_channels),
        "audio_hidden_channels": int(audio_encoder_first.out_channels) == int(config.audio_hidden_channels)
            and int(audio_decoder_first.out_channels) == int(config.audio_hidden_channels),
        "audio_codebook_size": bool(codebooks)
            and all(int(book.num_embeddings) == int(config.audio_codebook_size) for book in codebooks),
        "audio_codebook_dimension": bool(codebooks)
            and all(int(book.embedding_dim) == int(config.audio_latent_channels) for book in codebooks),
        "audio_quantizer_stages": len(codebooks) == int(config.audio_quantizer_stages),
        "audio_channels": int(model.audio_codec.channels) == int(config.audio_channels)
            and int(model.audio_codec.encoder[0].in_channels) == int(config.audio_channels)
            and int(model.audio_codec.decoder[-1].out_channels) == int(config.audio_channels),
        "audio_sample_rate": int(model.audio_codec.sample_rate) == int(config.audio_sample_rate),
        "temporal_layers": len(temporal_layers) == int(config.temporal_layers),
        "temporal_window_frames": int(model.video_codec.temporal_window_frames) == int(config.temporal_window_frames),
        "temporal_memory_frames": int(model.video_codec.temporal_memory_frames) == int(config.temporal_memory_frames),
        "max_image_context_tokens": int(model.max_image_context_tokens) == int(config.max_image_context_tokens),
        "max_video_context_tokens": int(model.max_video_context_tokens) == int(config.max_video_context_tokens),
        "max_flow_context_tokens": int(model.max_flow_context_tokens) == int(config.max_flow_context_tokens),
        "video_generation_chunk_frames": int(model.video_generation_chunk_frames) == int(config.video_generation_chunk_frames),
    }
    mismatched = [name for name, matched in checks.items() if not matched]
    if mismatched:
        raise ValueError("model/config mismatch for: " + ", ".join(mismatched))


def fingerprint_validated_v3_manifests(
    manifest_paths: Mapping[str, str | Path],
    assets_root: str | Path,
    *,
    minimum_train: int = 100,
    minimum_holdout: int = 10,
) -> dict[str, Any]:
    """Stream split manifests and bind their bytes plus validated assets."""
    required = {"train", "validation", "test"}
    if not isinstance(manifest_paths, Mapping) or set(manifest_paths) != required:
        raise ValueError("manifest_paths must contain exactly train, validation, and test")

    file_digests: dict[str, dict[str, Any]] = {}
    split_iterators = []
    for split in ("train", "validation", "test"):
        path = Path(manifest_paths[split]).resolve()
        if not path.is_file():
            raise FileNotFoundError(f"V3 {split} manifest not found: {path}")
        file_digests[split] = {
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "records": 0,
        }

        def iter_split(
            manifest_path: Path = path,
            expected_split: str = split,
            digest_key: str = split,
        ):
            count = 0
            for index, row in enumerate(read_v3_manifest(manifest_path), 1):
                if str(row.get("split", "")) != expected_split:
                    raise ValueError(
                        f"V3 {expected_split} manifest contains a row assigned to "
                        f"another split at record {index}"
                    )
                count += 1
                yield row
            file_digests[digest_key]["records"] = count

        split_iterators.append(iter_split())

    validation = assert_v3_external_coverage(
        chain.from_iterable(split_iterators),
        assets_root,
        minimum_train=minimum_train,
        minimum_holdout=minimum_holdout,
    )
    for split in ("train", "validation", "test"):
        current_sha = sha256_file(Path(manifest_paths[split]).resolve())
        if current_sha != file_digests[split]["sha256"]:
            raise RuntimeError(f"V3 {split} manifest changed during fingerprint validation")

    identity = {
        "format": "onecore-v3-validated-manifest-bundle-v1",
        "splits": file_digests,
        "asset_sha256": validation["asset_hashes"],
        "coverage": validation["coverage"],
    }
    encoded = json.dumps(
        identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")
    return {
        "manifest_sha256": sha256_bytes(encoded),
        "manifest_files": file_digests,
        "validation": validation,
    }

def _assert_scheduler_uses_optimizer(scheduler: Any, optimizer: torch.optim.Optimizer) -> None:
    if scheduler is None or getattr(scheduler, "optimizer", None) is not optimizer:
        raise ValueError("V3 scheduler must be attached to the exact optimizer being checkpointed")

def _assert_optimizer_matches_model(
    model: OneCoreV3,
    optimizer: torch.optim.Optimizer,
) -> None:
    """Require the optimizer to cover this model's trainable parameters exactly once."""
    expected = {
        id(parameter)
        for parameter in model.parameters()
        if parameter.requires_grad
    }
    observed: list[int] = [
        id(parameter)
        for group in optimizer.param_groups
        for parameter in group.get("params", [])
    ]
    if len(observed) != len(set(observed)):
        raise ValueError("V3 optimizer contains duplicated parameters")
    if set(observed) != expected:
        missing = len(expected - set(observed))
        foreign = len(set(observed) - expected)
        raise ValueError(
            "V3 optimizer must contain exactly the model's trainable parameters "
            f"(missing={missing}, foreign={foreign})"
        )


def _validate_optimizer_state_layout(
    optimizer: torch.optim.Optimizer,
    saved_state: dict[str, Any],
) -> None:
    current_groups = optimizer.param_groups
    saved_groups = saved_state.get("param_groups")
    state = saved_state.get("state")
    if not isinstance(saved_groups, list) or not isinstance(state, dict):
        raise ValueError("V3 checkpoint optimizer state has an invalid structure")
    if len(current_groups) != len(saved_groups):
        raise ValueError("V3 checkpoint optimizer parameter-group count mismatch")
    saved_id_to_parameter: dict[int, torch.nn.Parameter] = {}
    for current_group, saved_group in zip(current_groups, saved_groups, strict=True):
        if not isinstance(saved_group, dict) or not isinstance(saved_group.get("params"), list):
            raise ValueError("V3 checkpoint optimizer parameter group is invalid")
        current_parameters = current_group.get("params", [])
        saved_ids = saved_group["params"]
        if len(current_parameters) != len(saved_ids):
            raise ValueError("V3 checkpoint optimizer parameter layout mismatch")
        for parameter, saved_id in zip(current_parameters, saved_ids, strict=True):
            if isinstance(saved_id, bool) or not isinstance(saved_id, int) or saved_id in saved_id_to_parameter:
                raise ValueError("V3 checkpoint optimizer parameter IDs are invalid or duplicated")
            saved_id_to_parameter[saved_id] = parameter
    for saved_id, parameter_state in state.items():
        if isinstance(saved_id, bool) or not isinstance(saved_id, int) or saved_id not in saved_id_to_parameter:
            raise ValueError("V3 checkpoint optimizer state refers to an unknown parameter")
        if not isinstance(parameter_state, dict):
            raise ValueError("V3 checkpoint optimizer parameter state is invalid")
        parameter = saved_id_to_parameter[saved_id]
        for key in ("exp_avg", "exp_avg_sq", "max_exp_avg_sq"):
            value = parameter_state.get(key)
            if value is not None and (
                not isinstance(value, torch.Tensor) or value.shape != parameter.shape
            ):
                raise ValueError(f"V3 checkpoint optimizer tensor shape mismatch: {key}")
        step_value = parameter_state.get("step")
        if isinstance(step_value, torch.Tensor) and step_value.numel() != 1:
            raise ValueError("V3 checkpoint optimizer step counter must be scalar")


def save_v3_checkpoint(
    path: str | Path,
    model: OneCoreV3,
    optimizer: torch.optim.Optimizer,
    scheduler: Any,
    global_step: int,
    config: V3Config,
    *,
    tokenizer_json: bytes | bytearray | memoryview | str,
    manifest_sha256: str,
    data_state: Mapping[str, Any],
    lineage: Mapping[str, Any],
) -> dict[str, Any]:
    """Atomically persist all state needed to continue the same V3 training lineage."""
    if not isinstance(model, OneCoreV3):
        raise TypeError("model must be a OneCoreV3 instance")
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    if isinstance(global_step, bool) or not isinstance(global_step, int) or global_step < 0:
        raise ValueError("global_step must be a non-negative integer")
    _assert_scheduler_uses_optimizer(scheduler, optimizer)
    _assert_optimizer_matches_model(model, optimizer)
    _assert_model_matches_config(model, config)
    manifest_sha256 = _require_sha256(manifest_sha256, "manifest_sha256")
    tokenizer_bytes, tokenizer_vocab_size, tokenizer_sha256 = _tokenizer_payload(
        tokenizer_json, config.text_vocab_size
    )
    lineage_value = _normalise_lineage(lineage)
    data_state_value = _normalise_data_state(
        data_state, manifest_sha256=manifest_sha256, global_step=global_step,
    )

    payload = {
        "format_version": FORMAT_VERSION,
        "architecture_family": ARCHITECTURE_FAMILY,
        "global_step": int(global_step),
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "optimizer_type": f"{type(optimizer).__module__}.{type(optimizer).__qualname__}",
        "scheduler_state_dict": scheduler.state_dict(),
        "scheduler_type": f"{type(scheduler).__module__}.{type(scheduler).__qualname__}",
        "config": config.to_dict(),
        "config_sha256": config.fingerprint,
        "tokenizer_json": tokenizer_bytes,
        "tokenizer_sha256": tokenizer_sha256,
        "tokenizer_vocab_size": tokenizer_vocab_size,
        "manifest_sha256": manifest_sha256,
        "data_state": data_state_value,
        "lineage": lineage_value,
        "rng_state": {
            "python": random.getstate(),
            "numpy": np.random.get_state(),
            "torch_cpu": torch.get_rng_state(),
        },
    }

    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".partial", dir=target.parent
    )
    try:
        with os.fdopen(fd, "wb") as stream:
            torch.save(payload, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

    return {
        "path": str(target),
        "sha256": sha256_file(target),
        "bytes": target.stat().st_size,
        "global_step": int(global_step),
        "config_sha256": config.fingerprint,
        "tokenizer_sha256": tokenizer_sha256,
        "tokenizer_vocab_size": tokenizer_vocab_size,
        "manifest_sha256": manifest_sha256,
        "lineage": lineage_value,
    }


def load_v3_checkpoint(
    path: str | Path,
    model: OneCoreV3,
    optimizer: torch.optim.Optimizer,
    scheduler: Any,
    config: V3Config,
    *,
    expected_manifest_sha256: str,
    expected_parent_checkpoint_sha256: str | None,
    expected_tokenizer_sha256: str | None = None,
    map_location: str | torch.device = "cpu",
) -> tuple[int, dict[str, Any]]:
    """Strictly restore one compatible V3 checkpoint and all training state."""
    if not isinstance(model, OneCoreV3):
        raise TypeError("model must be a OneCoreV3 instance")
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    expected_manifest_sha256 = _require_sha256(
        expected_manifest_sha256, "expected_manifest_sha256"
    )
    if expected_parent_checkpoint_sha256 is not None:
        _require_sha256(
            expected_parent_checkpoint_sha256, "expected_parent_checkpoint_sha256"
        )
    if expected_tokenizer_sha256 is not None:
        _require_sha256(expected_tokenizer_sha256, "expected_tokenizer_sha256")

    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"V3 checkpoint not found: {source}")
    payload = torch.load(source, map_location=map_location, weights_only=False)
    if not isinstance(payload, dict):
        raise ValueError("V3 checkpoint payload must be a mapping")
    format_version = payload.get("format_version")
    if isinstance(format_version, bool) or not isinstance(format_version, int) or format_version != FORMAT_VERSION:
        raise ValueError("unsupported V3 checkpoint format version")
    if payload.get("architecture_family") != ARCHITECTURE_FAMILY:
        raise ValueError("checkpoint is not a OneCore V3 artifact")
    if payload.get("config") != config.to_dict():
        raise ValueError("V3 checkpoint configuration does not match the requested config")
    if payload.get("config_sha256") != config.fingerprint:
        raise ValueError("V3 checkpoint config fingerprint mismatch")
    if payload.get("manifest_sha256") != expected_manifest_sha256:
        raise ValueError("V3 checkpoint dataset manifest fingerprint mismatch")

    tokenizer_json = payload.get("tokenizer_json")
    if not isinstance(tokenizer_json, bytes):
        raise ValueError("V3 checkpoint is missing its serialized tokenizer JSON")
    _tokenizer_bytes, actual_vocab, actual_tokenizer_sha = _tokenizer_payload(
        tokenizer_json, config.text_vocab_size
    )
    if actual_tokenizer_sha != payload.get("tokenizer_sha256"):
        raise ValueError("V3 checkpoint tokenizer SHA-256 mismatch")
    saved_vocab_size = payload.get("tokenizer_vocab_size")
    if isinstance(saved_vocab_size, bool) or not isinstance(saved_vocab_size, int) or actual_vocab != saved_vocab_size:
        raise ValueError("V3 checkpoint tokenizer vocabulary metadata mismatch")
    if expected_tokenizer_sha256 is not None and actual_tokenizer_sha != expected_tokenizer_sha256:
        raise ValueError("V3 checkpoint tokenizer does not match the expected tokenizer fingerprint")

    lineage = _normalise_lineage(payload.get("lineage") or {})
    if lineage.get("parent_checkpoint_sha256") != expected_parent_checkpoint_sha256:
        raise ValueError("V3 checkpoint parent lineage mismatch")
    rng_state = payload.get("rng_state")
    if not isinstance(rng_state, dict) or not all(
        key in rng_state for key in ("python", "numpy", "torch_cpu")
    ):
        raise ValueError("V3 checkpoint is missing one or more RNG states")
    raw_step = payload.get("global_step")
    if isinstance(raw_step, bool) or not isinstance(raw_step, int) or raw_step < 0:
        raise ValueError("V3 checkpoint global_step is missing or invalid")
    step = raw_step
    data_state = _normalise_data_state(
        payload.get("data_state"),
        manifest_sha256=expected_manifest_sha256,
        global_step=step,
    )
    saved_model = payload.get("model_state_dict")
    saved_optimizer = payload.get("optimizer_state_dict")
    saved_scheduler = payload.get("scheduler_state_dict")
    if not isinstance(saved_model, dict):
        raise ValueError("V3 checkpoint is missing model state")
    if not isinstance(saved_optimizer, dict):
        raise ValueError("V3 checkpoint is missing optimizer state")
    if not isinstance(saved_scheduler, dict):
        raise ValueError("V3 checkpoint is missing scheduler state")
    optimizer_type = f"{type(optimizer).__module__}.{type(optimizer).__qualname__}"
    scheduler_type = f"{type(scheduler).__module__}.{type(scheduler).__qualname__}"
    _assert_scheduler_uses_optimizer(scheduler, optimizer)
    _assert_optimizer_matches_model(model, optimizer)
    _validate_optimizer_state_layout(optimizer, saved_optimizer)
    if payload.get("optimizer_type") != optimizer_type:
        raise ValueError("V3 checkpoint optimizer type mismatch")
    if payload.get("scheduler_type") != scheduler_type:
        raise ValueError("V3 checkpoint scheduler type mismatch")

    _assert_model_matches_config(model, config)
    current_model = model.state_dict()
    if set(saved_model) != set(current_model):
        raise ValueError("V3 checkpoint model state keys do not match the instantiated model")
    for name, current_tensor in current_model.items():
        saved_tensor = saved_model[name]
        if not isinstance(saved_tensor, torch.Tensor):
            raise ValueError(f"V3 checkpoint model tensor is invalid: {name}")
        if saved_tensor.shape != current_tensor.shape or saved_tensor.dtype != current_tensor.dtype:
            raise ValueError(f"V3 checkpoint model tensor shape/dtype mismatch: {name}")

    current_optimizer_groups = optimizer.state_dict().get("param_groups", [])
    saved_optimizer_groups = saved_optimizer.get("param_groups", [])
    if len(current_optimizer_groups) != len(saved_optimizer_groups):
        raise ValueError("V3 checkpoint optimizer parameter-group count mismatch")
    for current_group, saved_group in zip(current_optimizer_groups, saved_optimizer_groups, strict=True):
        if len(current_group.get("params", [])) != len(saved_group.get("params", [])):
            raise ValueError("V3 checkpoint optimizer parameter layout mismatch")

    python_state = rng_state["python"]
    numpy_state = rng_state["numpy"]
    torch_state = rng_state["torch_cpu"]
    try:
        random.Random().setstate(python_state)
        np.random.RandomState().set_state(numpy_state)
    except Exception as exc:
        raise ValueError(f"V3 checkpoint Python/NumPy RNG state is invalid: {exc}") from exc
    if not isinstance(torch_state, torch.Tensor) or torch_state.dtype != torch.uint8 or torch_state.ndim != 1:
        raise ValueError("V3 checkpoint Torch CPU RNG state is invalid")

    current_scheduler_state = scheduler.state_dict()
    if set(current_scheduler_state) != set(saved_scheduler):
        raise ValueError("V3 checkpoint scheduler state keys do not match the current scheduler")
    for key, current_value in current_scheduler_state.items():
        saved_value = saved_scheduler[key]
        if isinstance(current_value, torch.Tensor):
            if not isinstance(saved_value, torch.Tensor) or saved_value.shape != current_value.shape:
                raise ValueError(f"V3 checkpoint scheduler tensor shape mismatch: {key}")
        elif isinstance(current_value, (int, float, bool, str)):
            if not isinstance(saved_value, type(current_value)):
                raise ValueError(f"V3 checkpoint scheduler field type mismatch: {key}")
        elif isinstance(current_value, (list, tuple)):
            if not isinstance(saved_value, type(current_value)) or len(saved_value) != len(current_value):
                raise ValueError(f"V3 checkpoint scheduler field layout mismatch: {key}")

    rng_probe = torch.Generator(device="cpu")
    try:
        rng_probe.set_state(torch_state.detach().cpu())
    except Exception as exc:
        raise ValueError(f"V3 checkpoint Torch CPU RNG state is invalid: {exc}") from exc

    # All shapes, layouts, config fields, optimizer groups, scheduler fields and RNG
    # encodings have been checked. Avoid cloning the full model/optimizer: CPU memory
    # is constrained and duplicate copies would distort the resource benchmark.
    model.load_state_dict(saved_model, strict=True)
    optimizer.load_state_dict(saved_optimizer)
    scheduler.load_state_dict(saved_scheduler)
    random.setstate(python_state)
    np.random.set_state(numpy_state)
    torch.set_rng_state(torch_state.detach().cpu())
    payload["lineage"] = lineage
    payload["data_state"] = data_state
    return step, payload
