"""Strict, atomic V3 training checkpoints with complete resume lineage.

V3 checkpoints are intentionally incompatible with the V2 format. They bind
model and optimizer state to the exact V3 config, tokenizer bytes, validated
manifest, data cursors, RNG states, and parent-checkpoint lineage.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import re
import tempfile
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import torch
from tokenizers import Tokenizer

from .config import V3Config
from .core import OneCoreV3

FORMAT_VERSION = 1
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
    value["run_id"] = str(run_id)
    value["session"] = int(session)
    value["parent_checkpoint_sha256"] = parent
    try:
        json.dumps(value, sort_keys=True, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"lineage must be JSON-serializable: {exc}") from exc
    return value


def _normalise_data_state(data_state: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(data_state, Mapping):
        raise TypeError("data_state must be a mapping containing dataset cursors")
    try:
        return json.loads(json.dumps(dict(data_state), sort_keys=True, allow_nan=False))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"data_state must be JSON-serializable: {exc}") from exc


def _assert_model_matches_config(model: OneCoreV3, config: V3Config) -> None:
    checks = {
        "text_vocab_size": int(model.text_embedding.num_embeddings) == int(config.text_vocab_size),
        "width": int(model.width) == int(config.width),
        "layers": len(model.shared_core.layers) == int(config.layers),
        "cycles": int(model.shared_core.cycles) == int(config.cycles),
        "patch_size": int(model.image_codec.patch_size) == int(config.patch_size),
    }
    mismatched = [name for name, matched in checks.items() if not matched]
    if mismatched:
        raise ValueError("model/config mismatch for: " + ", ".join(mismatched))


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
    if global_step < 0:
        raise ValueError("global_step cannot be negative")
    if scheduler is None:
        raise ValueError("V3 resumable checkpoints require scheduler state")
    _assert_model_matches_config(model, config)
    manifest_sha256 = _require_sha256(manifest_sha256, "manifest_sha256")
    tokenizer_bytes, tokenizer_vocab_size, tokenizer_sha256 = _tokenizer_payload(
        tokenizer_json, config.text_vocab_size
    )
    lineage_value = _normalise_lineage(lineage)
    data_state_value = _normalise_data_state(data_state)

    payload = {
        "format_version": FORMAT_VERSION,
        "architecture_family": ARCHITECTURE_FAMILY,
        "global_step": int(global_step),
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
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
    if payload.get("format_version") != FORMAT_VERSION:
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
    if actual_vocab != int(payload.get("tokenizer_vocab_size", -1)):
        raise ValueError("V3 checkpoint tokenizer vocabulary metadata mismatch")
    if expected_tokenizer_sha256 is not None and actual_tokenizer_sha != expected_tokenizer_sha256:
        raise ValueError("V3 checkpoint tokenizer does not match the expected tokenizer fingerprint")

    lineage = _normalise_lineage(payload.get("lineage") or {})
    if lineage.get("parent_checkpoint_sha256") != expected_parent_checkpoint_sha256:
        raise ValueError("V3 checkpoint parent lineage mismatch")
    data_state = _normalise_data_state(payload.get("data_state") or {})
    rng_state = payload.get("rng_state")
    if not isinstance(rng_state, dict) or not all(
        key in rng_state for key in ("python", "numpy", "torch_cpu")
    ):
        raise ValueError("V3 checkpoint is missing one or more RNG states")
    if payload.get("scheduler_state_dict") is None:
        raise ValueError("V3 checkpoint is missing scheduler state")

    _assert_model_matches_config(model, config)
    model.load_state_dict(payload["model_state_dict"], strict=True)
    if payload.get("optimizer_state_dict") is None:
        raise ValueError("V3 checkpoint is missing optimizer state")
    optimizer.load_state_dict(payload["optimizer_state_dict"])
    scheduler.load_state_dict(payload["scheduler_state_dict"])

    random.setstate(rng_state["python"])
    np.random.set_state(rng_state["numpy"])
    torch.set_rng_state(rng_state["torch_cpu"].detach().cpu())

    step = int(payload.get("global_step", -1))
    if step < 0:
        raise ValueError("V3 checkpoint global_step is missing or invalid")
    payload["lineage"] = lineage
    payload["data_state"] = data_state
    return step, payload
