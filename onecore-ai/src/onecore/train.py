from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image
from tokenizers import Tokenizer

from .checkpoint import load_checkpoint, save_checkpoint, sha256_file, write_json_atomic
from .config import ModelConfig, load_config
from .data import classify_record_data, iter_training_records, read_manifest, validate_training_data
from .model import (
    AUDIO_END, AUDIO_START, BOS, EOS, IMAGE_END, IMAGE_START, TEXT_START,
    TOOL_END, TOOL_START, VIDEO_END, VIDEO_FRAME, VIDEO_START, MOTION_START, MASK,
    OneCore, patchify,
)
from .tokenizer import load_tokenizer, train_tokenizer
from .flops import micro_batch_train_flops


def _sid(cfg: ModelConfig, offset: int) -> int:
    return cfg.special_id(offset)


def _text_ids(tokenizer: Tokenizer, text: str, cfg: ModelConfig,
              max_tokens: int | None = None) -> list[int]:
    ids = tokenizer.encode(text).ids
    if not ids or any(token < 0 or token >= cfg.text_vocab_size for token in ids):
        raise ValueError("tokenizer emitted no IDs or an ID outside the reserved text vocabulary")
    if max_tokens is not None:
        if max_tokens < 1:
            raise ValueError("max_tokens must be positive")
        ids = ids[:max_tokens]
    return ids


def _load_image(path: Path, size: int) -> torch.Tensor:
    with Image.open(path) as image:
        image = image.convert("RGB").resize((size, size), Image.Resampling.BICUBIC)
        array = np.asarray(image, dtype=np.float32) / 255.0
    return torch.from_numpy(array).permute(2, 0, 1).contiguous().unsqueeze(0)


def _load_mel(path: Path, bins: int) -> torch.Tensor:
    features = np.load(path, allow_pickle=False)
    if features.ndim != 2 or features.shape[1] != bins:
        raise ValueError(f"audio feature file must have shape [frames, {bins}]: {path}")
    if not np.isfinite(features).all():
        raise ValueError(f"audio features contain NaN/Inf: {path}")
    return torch.from_numpy(features.astype("float32", copy=False)).unsqueeze(0)


def _manifest_corpus(records: list[dict[str, Any]], output: Path) -> list[Path]:
    # The tokenizer is part of the real training pipeline: apply the same
    # external-only provenance filter used by the optimizer before reading text.
    eligible_records = iter_training_records(records)
    fields = ("text", "caption", "transcript", "prompt", "response")
    lines: list[str] = []
    for item in eligible_records:
        for field in fields:
            value = item.get(field)
            if isinstance(value, str) and value.strip():
                lines.append(value.strip())
    if not lines:
        raise ValueError("no text fields are available to train the from-scratch tokenizer")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines), encoding="utf-8")
    return [output]


def _record_sequence(
    record: dict[str, Any], model: OneCore, tokenizer: Tokenizer, project_root: Path
) -> tuple[torch.Tensor, torch.Tensor, str]:
    cfg = model.cfg
    assets = project_root / "data" / "assets"
    task = record["task"]
    aux_loss = torch.zeros((), dtype=torch.float32)
    max_tokens = cfg.max_sequence_length

    if task == "text":
        sequence = [
            _sid(cfg, BOS),
            *_text_ids(tokenizer, record["text"], cfg, max_tokens=max_tokens - 2),
            _sid(cfg, EOS),
        ]
    elif task == "tool_use":
        prompt_ids = _text_ids(
            tokenizer, record["prompt"], cfg, max_tokens=max(1, (max_tokens - 4) // 2)
        )
        response_budget = max_tokens - len(prompt_ids) - 4
        response_ids = _text_ids(
            tokenizer, record["response"], cfg, max_tokens=max(1, response_budget)
        )
        sequence = [
            _sid(cfg, BOS), *prompt_ids, _sid(cfg, TOOL_START),
            *response_ids, _sid(cfg, TOOL_END), _sid(cfg, EOS),
        ]
    elif task in {"image_caption", "image_reconstruction"}:
        image = _load_image(assets / record["image"], cfg.image_size)
        code_ids, latents, vq_loss = model.encode_image(image)
        decoded = model.decode_image_latents(latents)
        image_loss = torch.nn.functional.mse_loss(decoded, image)
        aux_loss = vq_loss + image_loss
        sequence = [
            _sid(cfg, BOS), _sid(cfg, IMAGE_START),
            *code_ids.flatten().tolist(), _sid(cfg, IMAGE_END),
        ]
        if task == "image_caption":
            caption_budget = max_tokens - len(sequence) - 2
            sequence.extend([
                _sid(cfg, TEXT_START),
                *_text_ids(tokenizer, record["caption"], cfg, max_tokens=max(1, caption_budget)),
            ])
        sequence.append(_sid(cfg, EOS))
    elif task in {"audio_text", "audio_reconstruction"}:
        mel = _load_mel(assets / record["audio_features"], cfg.audio_bins)
        transcript_ids: list[int] = []
        if task == "audio_text":
            transcript = record.get("transcript", record.get("caption", ""))
            transcript_ids = _text_ids(
                tokenizer, transcript, cfg, max_tokens=min(160, max_tokens // 3)
            )
        audio_token_budget = max(
            1, max_tokens - 4 - (1 + len(transcript_ids) if transcript_ids else 0)
        )
        max_mel_frames = cfg.audio_group_frames * audio_token_budget
        mel = mel[:, :max_mel_frames, :]
        code_ids, latents, vq_loss = model.encode_audio(mel)
        reconstructed = model.decode_audio_latents(latents).reshape(
            1, -1, cfg.audio_bins
        )[:, :mel.shape[1], :]
        audio_loss = torch.nn.functional.mse_loss(reconstructed, mel)
        aux_loss = vq_loss + audio_loss
        sequence = [
            _sid(cfg, BOS), _sid(cfg, AUDIO_START),
            *code_ids.flatten().tolist(), _sid(cfg, AUDIO_END),
        ]
        if task == "audio_text":
            sequence.extend([_sid(cfg, TEXT_START), *transcript_ids])
        sequence.append(_sid(cfg, EOS))
    elif task in {"video_caption", "video_reconstruction"}:
        frames = record["frames"]
        if not isinstance(frames, list) or not 1 <= len(frames) <= cfg.max_video_frames:
            raise ValueError(f"video must contain 1..{cfg.max_video_frames} ordered frame paths")
        image_tensors = [
            _load_image(assets / relative, cfg.image_size) for relative in frames
        ]
        sequence = [_sid(cfg, BOS), _sid(cfg, VIDEO_START)]
        frame_losses = []
        for index, frame in enumerate(image_tensors):
            code_ids, latents, vq_loss = model.encode_image(frame)
            frame_losses.append(vq_loss + torch.nn.functional.mse_loss(
                model.decode_image_latents(latents), frame
            ))
            sequence.extend([_sid(cfg, VIDEO_FRAME), *code_ids.flatten().tolist()])
            if index < len(image_tensors) - 1:
                difference = image_tensors[index + 1] - frame
                motion_ids, motion_latents, motion_vq_loss = model.encode_motion(difference)
                motion_recon = model.decode_motion_latents(motion_latents)
                frame_losses.append(motion_vq_loss + torch.nn.functional.mse_loss(
                    motion_recon, difference
                ))
                sequence.extend([_sid(cfg, MOTION_START), *motion_ids.flatten().tolist()])
        sequence.append(_sid(cfg, VIDEO_END))
        if task == "video_caption":
            caption_budget = max_tokens - len(sequence) - 2
            sequence.append(_sid(cfg, TEXT_START))
            sequence.extend(_text_ids(
                tokenizer, record["caption"], cfg, max_tokens=max(1, caption_budget)
            ))
        sequence.append(_sid(cfg, EOS))
        aux_loss = torch.stack(frame_losses).mean()
    else:
        raise ValueError(f"unsupported training task: {task}")

    if len(sequence) < 2:
        raise ValueError(f"record {record.get('id')} produced an empty sequence")
    if len(sequence) > cfg.max_sequence_length:
        raise ValueError(
            f"record {record.get('id')} has {len(sequence)} tokens after bounded encoding; "
            f"limit is {cfg.max_sequence_length}."
        )
    return torch.tensor(sequence, dtype=torch.long).unsqueeze(0), aux_loss, task

def _smoke_sample(model: OneCore, step: int) -> tuple[torch.Tensor, torch.Tensor]:
    cfg = model.cfg
    text_ids = [cfg.special_id(BOS), 10 + (step % 31), 24, 25, 41, cfg.special_id(EOS)]
    image = torch.rand(1, 3, cfg.image_size, cfg.image_size)
    codes, latents, vq = model.encode_image(image)
    reconstruction = model.decode_image_latents(latents)
    sequence = torch.cat([
        torch.tensor([[cfg.special_id(BOS), cfg.special_id(IMAGE_START)]]),
        codes.flatten().unsqueeze(0),
        torch.tensor([[cfg.special_id(IMAGE_END), cfg.special_id(EOS)]]),
    ], dim=1)
    # Include a tiny text objective in the same smoke cycle.
    text = torch.tensor([text_ids], dtype=torch.long)
    return sequence, vq + torch.nn.functional.mse_loss(reconstruction, image) + model(text[:, :-1]).square().mean() * 0.0


def _initialize_multimodal_codebooks(
    model: OneCore, records: list[dict[str, Any]], root: Path, seed: int
) -> dict[str, dict[str, int | float]]:
    cfg = model.cfg
    image_features: list[torch.Tensor] = []
    audio_features: list[torch.Tensor] = []
    motion_features: list[torch.Tensor] = []
    for record in records:
        task = record["task"]
        if task in {"image_caption", "image_reconstruction"}:
            image = _load_image(root / "data" / "assets" / record["image"], cfg.image_size)
            image_features.append(model.image_encoder(patchify(image, cfg.patch_size)).reshape(-1, cfg.width))
        elif task in {"audio_text", "audio_reconstruction"}:
            mel = _load_mel(root / "data" / "assets" / record["audio_features"], cfg.audio_bins)
            group = cfg.audio_group_frames
            pad = (-mel.shape[1]) % group
            if pad:
                mel = torch.nn.functional.pad(mel, (0, 0, 0, pad))
            chunks = mel.reshape(1, -1, cfg.audio_token_dim)
            audio_features.append(model.audio_encoder(chunks).reshape(-1, cfg.width))
        elif task in {"video_caption", "video_reconstruction"}:
            frames = [_load_image(root / "data" / "assets" / p, cfg.image_size) for p in record["frames"]]
            for frame in frames:
                image_features.append(
                    model.image_encoder(patchify(frame, cfg.patch_size)).reshape(-1, cfg.width)
                )
            for previous, current in zip(frames, frames[1:]):
                motion_features.append(
                    model.motion_encoder(patchify(current - previous, cfg.patch_size)).reshape(-1, cfg.width)
                )

    if not image_features or not audio_features or not motion_features:
        raise ValueError("multimodal codebook initialization requires image, audio, and video samples")
    image_all = torch.cat(image_features, dim=0)[:8192]
    audio_all = torch.cat(audio_features, dim=0)[:4096]
    motion_all = torch.cat(motion_features, dim=0)[:4096]
    model.initialize_codebook(image_all, cfg.vision_start, cfg.vision_codebook_size, seed=seed)
    model.initialize_codebook(audio_all, cfg.audio_start, cfg.audio_codebook_size, seed=seed + 1)
    model.initialize_codebook(motion_all, cfg.motion_start, cfg.motion_codebook_size, seed=seed + 2)
    return {
        "image": model.codebook_usage(image_all, cfg.vision_start, cfg.vision_codebook_size),
        "audio": model.codebook_usage(audio_all, cfg.audio_start, cfg.audio_codebook_size),
        "motion": model.codebook_usage(motion_all, cfg.motion_start, cfg.motion_codebook_size),
    }


def _validate_resume_configuration(
    saved_config: dict[str, Any],
    model_config: ModelConfig,
    raw_config: dict[str, Any],
) -> None:
    saved_model_config = dict(saved_config.get("model", {}))
    expected_model_config = model_config.to_dict()
    # This v2 field verifies tensor shapes but does not itself alter the architecture.
    saved_model_config.pop("expected_parameter_count", None)
    expected_model_config.pop("expected_parameter_count", None)
    if saved_model_config != expected_model_config:
        raise ValueError("checkpoint model architecture does not match this run config")
    if saved_config.get("training") != raw_config.get("training", {}):
        raise ValueError(
            "checkpoint optimizer/schedule config does not match this run config; "
            "start a fresh lineage rather than resuming incompatible AdamW state"
        )


def _build_scheduler(optimizer: torch.optim.Optimizer, warmup_steps: int,
                    total_steps: int) -> torch.optim.lr_scheduler.LambdaLR:
    def factor(step: int) -> float:
        if warmup_steps and step < warmup_steps:
            return float(step + 1) / float(warmup_steps)
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        progress = min(1.0, max(0.0, progress))
        return 0.1 + 0.9 * 0.5 * (1.0 + np.cos(np.pi * progress))
    return torch.optim.lr_scheduler.LambdaLR(optimizer, factor)


def _weighted_record(records_by_task: dict[str, list[dict[str, Any]]],
                     stage: str, rng: random.Random) -> dict[str, Any]:
    """Sample only from records already admitted by the real-data training gate."""
    if stage == "text":
        target_weights = {"text": 0.75, "tool_use": 0.25}
    else:
        target_weights = {
            "text": 0.10, "tool_use": 0.08,
            "image_caption": 0.18, "image_reconstruction": 0.12,
            "audio_text": 0.18, "audio_reconstruction": 0.07,
            "video_caption": 0.18, "video_reconstruction": 0.09,
        }
    available = {key: value for key, value in target_weights.items() if records_by_task.get(key)}
    if not available:
        raise ValueError(f"no imported external records are available for the {stage} training stage")
    tasks = list(available)
    weights = [available[key] for key in tasks]
    selected_task = rng.choices(tasks, weights=weights, k=1)[0]
    return rng.choice(records_by_task[selected_task])


JOINT_FAMILY_TASKS: dict[str, tuple[str, ...]] = {
    "text": ("text",),
    "tool": ("tool_use",),
    "image": ("image_caption", "image_reconstruction"),
    "audio": ("audio_text", "audio_reconstruction"),
    "video": ("video_caption", "video_reconstruction"),
}


def _joint_micro_batches(
    records_by_task: dict[str, list[dict[str, Any]]],
    rng: random.Random,
) -> list[tuple[str, dict[str, Any]]]:
    """Pick one external record from each family for the same optimizer update."""
    missing = [
        family for family, tasks in JOINT_FAMILY_TASKS.items()
        if not any(records_by_task.get(task) for task in tasks)
    ]
    if missing:
        raise ValueError(
            "joint training requires external samples from all five families: "
            + ", ".join(missing)
        )
    family_order = list(JOINT_FAMILY_TASKS)
    rng.shuffle(family_order)
    selected: list[tuple[str, dict[str, Any]]] = []
    for family in family_order:
        candidates = [
            item
            for task in JOINT_FAMILY_TASKS[family]
            for item in records_by_task.get(task, [])
        ]
        selected.append((family, rng.choice(candidates)))
    if {family for family, _ in selected} != set(JOINT_FAMILY_TASKS):
        raise RuntimeError("joint micro-batch does not contain all five task families")
    return selected


def _tldm_block_denoising_loss(model: OneCore, sequence: torch.Tensor, rng: Any) -> torch.Tensor:
    """Train the native shared-core diffusion writer on one masked contiguous block."""
    if sequence.ndim != 2:
        raise ValueError("T-LDM training sequence must have shape [batch, sequence]")
    sequence_length = sequence.shape[1]
    if sequence_length < 3:
        return sequence.float().sum() * 0.0

    block_width = min(32, max(1, sequence_length // 4), sequence_length - 2)
    latest_start = sequence_length - block_width - 1
    start = rng.randint(1, max(1, latest_start))
    end = start + block_width
    masked_sequence = sequence.clone()
    masked_sequence[:, start:end] = model.cfg.special_id(MASK)
    logits = model.forward_tldm(masked_sequence)
    target = sequence[:, start:end]
    return torch.nn.functional.cross_entropy(
        logits[:, start:end, :].reshape(-1, logits.shape[-1]),
        target.reshape(-1),
    )


def _asset_manifest_sha256(project_root: Path, records: list[dict[str, Any]]) -> str:
    assets_root = (project_root / "data" / "assets").resolve()
    paths: set[str] = set()
    for record in records:
        for field in ("image", "audio_features"):
            value = record.get(field)
            if isinstance(value, str) and value.strip():
                paths.add(value)
        frames = record.get("frames")
        if isinstance(frames, list):
            paths.update(value for value in frames if isinstance(value, str) and value.strip())
    entries: list[dict[str, str]] = []
    for relative in sorted(paths):
        target = (assets_root / relative).resolve()
        if assets_root not in target.parents:
            raise ValueError(f"asset path escapes the data/assets root: {relative}")
        if not target.is_file():
            raise FileNotFoundError(f"training asset is missing: {relative}")
        entries.append({"path": relative, "sha256": sha256_file(target)})
    encoded = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def run_training(
    project_root: str | Path,
    config_path: str | Path,
    stage: str,
    steps: int,
    output_dir: str | Path,
    resume: bool = False,
    seed_override: int | None = None,
) -> dict[str, Any]:
    root = Path(project_root).resolve()
    out = Path(output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    cfg, train_cfg, raw_cfg = load_config(config_path)
    if not 1 <= steps <= train_cfg.max_steps_per_job:
        raise ValueError(f"steps must be between 1 and {train_cfg.max_steps_per_job} per GitHub job")
    if stage not in {"smoke", "text", "joint", "multimodal"}:
        raise ValueError(f"unsupported training stage: {stage}")
    if stage == "joint" and resume:
        raise ValueError("the initial joint foundation stage must start from random initialization")
    if stage == "multimodal" and not resume:
        raise ValueError("multimodal continuation must resume the same joint OneCore checkpoint")

    seed = int(seed_override if seed_override is not None else raw_cfg.get("seed", 20261115))
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(train_cfg.cpu_threads)

    model = OneCore(cfg).cpu()
    actual_parameter_count = model.count_parameters()
    if actual_parameter_count != cfg.expected_parameter_count:
        raise ValueError(
            f"instantiated model has {actual_parameter_count} trainable parameters; "
            f"config requires exactly {cfg.expected_parameter_count}"
        )
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=train_cfg.learning_rate, weight_decay=train_cfg.weight_decay,
        betas=tuple(train_cfg.adam_betas)
    )
    scheduler = _build_scheduler(optimizer, train_cfg.warmup_steps, train_cfg.total_steps)
    checkpoint_path = out / "checkpoint.pt"
    step = 0
    saved_metadata: dict[str, Any] = {}
    parent_checkpoint_sha256 = sha256_file(checkpoint_path) if resume else None
    parent_optimizer_step: int | None = None
    parent_run_id = os.environ.get("ONECORE_PARENT_RUN_ID", "").strip() or None
    if resume:
        step, saved = load_checkpoint(
            checkpoint_path, model, optimizer, scheduler=scheduler, map_location="cpu"
        )
        _validate_resume_configuration(saved.get("config", {}), cfg, raw_cfg)
        saved_metadata = saved.get("metadata", {})
        parent_optimizer_step = step
        seed = int(saved_metadata.get("seed", seed))
        # load_checkpoint has restored Python/NumPy/Torch RNG states exactly.
        # Do not reseed here: this preserves deterministic continuation.
    sampled_family_counts: dict[str, int] = {
        str(key): int(value) for key, value in (saved_metadata.get("sampled_family_counts") or {}).items()
    }
    sampled_task_counts: dict[str, int] = {
        str(key): int(value) for key, value in (saved_metadata.get("sampled_task_counts") or {}).items()
    }
    job_sampled_family_counts = {family: 0 for family in JOINT_FAMILY_TASKS}
    job_sampled_task_counts: dict[str, int] = {}
    lineage_id = saved_metadata.get("lineage_id")
    if not lineage_id:
        lineage_id = (
            f"onecore-random-init-run-{parent_run_id}"
            if parent_run_id else f"onecore-random-init-seed-{seed}"
        )
    tokenizer_path = out / "tokenizer.json"
    records: list[dict[str, Any]] = []
    records_by_task: dict[str, list[dict[str, Any]]] = {}
    real_data = False
    data_kind = "synthetic_smoke"
    manifest_sha = None
    tokenizer_sha = None
    codebook_initialized = bool(saved_metadata.get("codebooks_initialized", False))
    codebook_report = saved_metadata.get("codebook_report", {})
    asset_manifest_sha: str | None = None
    training_data_fingerprint: str | None = None
    asset_lineage_status = "not-applicable"
    data_extension: dict[str, Any] | None = None
    source_data_counts: dict[str, int] = {}
    optimizer_data_class_counts: dict[str, int] = {}
    excluded_data_class_counts: dict[str, int] = {}

    if stage != "smoke":
        data_report = validate_training_data(root)
        records = read_manifest(root / "data" / "train.jsonl")
        manifest_sha = sha256_file(root / "data" / "train.jsonl")
        allowed_tasks = {"text", "tool_use"} if stage == "text" else {
            "text", "tool_use", "image_caption", "image_reconstruction",
            "audio_text", "audio_reconstruction", "video_caption", "video_reconstruction"
        }
        records = list(iter_training_records(records, allowed_tasks))
        for record in records:
            records_by_task.setdefault(record["task"], []).append(record)
        required = {"text"}
        if stage in {"joint", "multimodal"}:
            missing_families = [
                family for family, tasks in JOINT_FAMILY_TASKS.items()
                if not any(records_by_task.get(task) for task in tasks)
            ]
            if missing_families:
                raise ValueError(
                    "joint OneCore training is blocked until external data exists for all five families: "
                    + ", ".join(missing_families)
                )
            required = {"text", "tool_use"}
        missing = required - set(records_by_task)
        if missing:
            raise ValueError(f"training data is missing required task categories: {sorted(missing)}")
        all_manifest_records = read_manifest(root / "data" / "train.jsonl")
        asset_manifest_sha = _asset_manifest_sha256(root, all_manifest_records)
        fingerprint_payload = {
            "train_manifest_sha256": manifest_sha,
            "asset_manifest_sha256": asset_manifest_sha,
        }
        training_data_fingerprint = hashlib.sha256(json.dumps(
            fingerprint_payload, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")).hexdigest()
        data_class_counts: dict[str, int] = {}
        for record in all_manifest_records:
            data_class = classify_record_data(record)
            data_class_counts[data_class] = data_class_counts.get(data_class, 0) + 1
        source_data_counts = dict(data_class_counts)
        optimizer_data_class_counts: dict[str, int] = {}
        for record in records:
            data_class = classify_record_data(record)
            optimizer_data_class_counts[data_class] = optimizer_data_class_counts.get(data_class, 0) + 1
        excluded_data_class_counts = {}
        optimizer_classes = set(optimizer_data_class_counts)
        data_kind = "all_available_data"
        real_data = "external" in optimizer_classes
        if resume:
            saved_manifest_sha = saved_metadata.get("manifest_sha256")
            saved_asset_sha = saved_metadata.get("asset_manifest_sha256")
            saved_data_fingerprint = saved_metadata.get("training_data_fingerprint")
            if saved_manifest_sha and saved_manifest_sha != manifest_sha:
                acquisition_report_path = root / "data" / "acquisition-report.json"
                acquisition_report = (
                    json.loads(acquisition_report_path.read_text(encoding="utf-8"))
                    if acquisition_report_path.is_file() else {}
                )
                base_manifest_sha = acquisition_report.get("base_train_manifest_sha256")
                base_asset_sha = acquisition_report.get("base_asset_manifest_sha256")
                if base_manifest_sha != saved_manifest_sha or base_asset_sha != saved_asset_sha:
                    raise ValueError(
                        "training manifest changed but the importer did not prove an append-only extension "
                        "from the exact parent manifest and asset fingerprints; refusing to mix lineages"
                    )
                data_extension = {
                    "mode": "verified_append_only",
                    "parent_manifest_sha256": saved_manifest_sha,
                    "parent_asset_manifest_sha256": saved_asset_sha,
                    "extended_manifest_sha256": manifest_sha,
                    "extended_asset_manifest_sha256": asset_manifest_sha,
                    "base_train_records": acquisition_report.get("base_train_records"),
                    "new_records": acquisition_report.get("new_records", {}),
                    "source_revisions": acquisition_report.get("source_revisions", {}),
                }
                asset_lineage_status = "verified-append-only-data-extension"
            else:
                if saved_asset_sha and saved_asset_sha != asset_manifest_sha:
                    raise ValueError("training asset fingerprints changed since the saved checkpoint; refusing silent data-lineage mixing")
                if saved_data_fingerprint and saved_data_fingerprint != training_data_fingerprint:
                    raise ValueError("training data fingerprint changed since the saved checkpoint; refusing silent data-lineage mixing")
                asset_lineage_status = (
                    "verified-against-parent" if saved_asset_sha
                    else "established-on-resume-from-legacy-manifest-only-checkpoint"
                )
        else:
            asset_lineage_status = "fingerprinted-on-fresh-run"
        if not tokenizer_path.exists():
            # A smoke checkpoint has no tokenizer and is safe to continue from:
            # no text IDs were trained in that phase. Any checkpoint that already
            # records a tokenizer SHA must restore the exact tokenizer artifact.
            if stage not in {"text", "joint"} or (resume and saved_metadata.get("tokenizer_sha256")):
                raise FileNotFoundError("from-scratch tokenizer is missing for this checkpoint lineage")
            corpus_files = _manifest_corpus(
                read_manifest(root / "data" / "train.jsonl"), out / "tokenizer-corpus.txt"
            )
            train_tokenizer(corpus_files, tokenizer_path, vocab_size=cfg.text_vocab_size)
        tokenizer = load_tokenizer(tokenizer_path)
        tokenizer_sha = sha256_file(tokenizer_path)
        saved_tokenizer_sha = saved_metadata.get("tokenizer_sha256")
        if resume and saved_tokenizer_sha and saved_tokenizer_sha != tokenizer_sha:
            raise ValueError("tokenizer fingerprint differs from the checkpoint; refusing to mix token IDs")
        if stage == "multimodal" and saved_tokenizer_sha != tokenizer_sha:
            raise ValueError("multimodal stage requires the exact tokenizer saved with the text checkpoint")

        if stage in {"joint", "multimodal"} and not codebook_initialized:
            codebook_report = _initialize_multimodal_codebooks(model, records, root, seed)
            codebook_initialized = True
    else:
        tokenizer = None
        records_by_task = {}

    model.train()
    losses: list[float] = []
    first_language_loss: float | None = None
    job_training_flops = 0
    optimizer_step_flops: list[int] = []
    tldm_diffusion_losses: list[float] = []
    tldm_updates = int(saved_metadata.get("tldm_updates", 0))
    tldm_diffusion_loss_sum = float(saved_metadata.get("tldm_diffusion_loss_sum", 0.0))
    rng = random
    if records:
        rng.shuffle(records)
    if records:
        records_by_task = {}
        for record in records:
            records_by_task.setdefault(record["task"], []).append(record)

    for local_step in range(steps):
        optimizer.zero_grad(set_to_none=True)
        micro_losses: list[float] = []
        current_step_flops = 0
        if stage in {"joint", "multimodal"}:
            micro_batch = _joint_micro_batches(records_by_task, rng)
        elif stage == "smoke":
            micro_batch = [(None, None)] * train_cfg.gradient_accumulation
        else:
            micro_batch = [
                (None, _weighted_record(records_by_task, stage, rng))
                for _ in range(train_cfg.gradient_accumulation)
            ]
        accumulation = len(micro_batch)
        for micro_step, (family, record) in enumerate(micro_batch):
            if stage == "smoke":
                sequence, aux_loss = _smoke_sample(model, step + local_step + micro_step)
            else:
                assert record is not None
                sequence, aux_loss, task = _record_sequence(record, model, tokenizer, root)
                if family is not None:
                    sampled_family_counts[family] = sampled_family_counts.get(family, 0) + 1
                    job_sampled_family_counts[family] = job_sampled_family_counts.get(family, 0) + 1
                    sampled_task_counts[task] = sampled_task_counts.get(task, 0) + 1
                    job_sampled_task_counts[task] = job_sampled_task_counts.get(task, 0) + 1
            current_step_flops += micro_batch_train_flops(int(sequence.shape[1]))
            logits = model(sequence[:, :-1], causal=True)
            targets = sequence[:, 1:]
            language_loss = torch.nn.functional.cross_entropy(
                logits.reshape(-1, logits.shape[-1]), targets.reshape(-1)
            )
            if first_language_loss is None:
                first_language_loss = float(language_loss.detach())
            tldm_loss = _tldm_block_denoising_loss(model, sequence, rng)
            diffusion_loss_value = float(tldm_loss.detach())
            tldm_diffusion_losses.append(diffusion_loss_value)
            tldm_diffusion_loss_sum += diffusion_loss_value
            tldm_updates += 1
            loss = language_loss + aux_loss + train_cfg.tldm_diffusion_weight * tldm_loss
            if not torch.isfinite(loss):
                raise FloatingPointError(f"non-finite loss at optimizer step {step + 1}")
            (loss / accumulation).backward()
            micro_losses.append(float(loss.detach()))

        torch.nn.utils.clip_grad_norm_(model.parameters(), train_cfg.max_grad_norm)
        optimizer.step()
        scheduler.step()
        step += 1
        losses.append(sum(micro_losses) / len(micro_losses))
        optimizer_step_flops.append(current_step_flops)
        job_training_flops += current_step_flops

        if step % train_cfg.checkpoint_every == 0:
            metadata = {
                "stage": stage, "real_data": real_data, "data_kind": data_kind,
                "seed": seed, "tokenizer_sha256": tokenizer_sha,
                "manifest_sha256": manifest_sha,
                "asset_manifest_sha256": asset_manifest_sha,
                "training_data_fingerprint": training_data_fingerprint,
                "asset_lineage_status": asset_lineage_status,
                "data_extension": data_extension,
                "source_data_counts": source_data_counts,
                "lineage_id": lineage_id,
                "parent_checkpoint_sha256": parent_checkpoint_sha256,
                "parent_optimizer_step": parent_optimizer_step,
                "parent_run_id": parent_run_id,
                "codebooks_initialized": codebook_initialized,
                "codebook_report": codebook_report,
                "sampled_family_counts": sampled_family_counts,
                "sampled_task_counts": sampled_task_counts,
                "tldm_diffusion_weight": train_cfg.tldm_diffusion_weight,
                "tldm_updates": tldm_updates,
                "tldm_diffusion_loss_sum": tldm_diffusion_loss_sum,
                "last_tldm_diffusion_loss": tldm_diffusion_losses[-1] if tldm_diffusion_losses else saved_metadata.get("last_tldm_diffusion_loss"),
                "last_loss": losses[-1],
                "scheduler_step": scheduler.last_epoch,
            }
            save_checkpoint(
                checkpoint_path, model, optimizer, scheduler, step,
                {"model": cfg.to_dict(), "training": raw_cfg.get("training", {})}, metadata,
            )

    metadata = {
        "stage": stage, "real_data": real_data, "data_kind": data_kind,
        "seed": seed, "tokenizer_sha256": tokenizer_sha,
        "manifest_sha256": manifest_sha,
        "asset_manifest_sha256": asset_manifest_sha,
        "training_data_fingerprint": training_data_fingerprint,
        "asset_lineage_status": asset_lineage_status,
        "data_extension": data_extension,
        "source_data_counts": source_data_counts,
        "optimizer_data_class_counts": optimizer_data_class_counts,
        "excluded_data_class_counts": excluded_data_class_counts,
        "lineage_id": lineage_id,
        "parent_checkpoint_sha256": parent_checkpoint_sha256,
        "parent_optimizer_step": parent_optimizer_step,
        "parent_run_id": parent_run_id,
        "codebooks_initialized": codebook_initialized,
        "codebook_report": codebook_report,
        "sampled_family_counts": sampled_family_counts,
        "sampled_task_counts": sampled_task_counts,
        "tldm_diffusion_weight": train_cfg.tldm_diffusion_weight,
        "tldm_updates": tldm_updates,
        "tldm_diffusion_loss_sum": tldm_diffusion_loss_sum,
        "mean_tldm_diffusion_loss": (
            tldm_diffusion_loss_sum / tldm_updates if tldm_updates else None
        ),
        "last_tldm_diffusion_loss": tldm_diffusion_losses[-1] if tldm_diffusion_losses else saved_metadata.get("last_tldm_diffusion_loss"),
        "last_loss": losses[-1] if losses else None,
        "scheduler_step": scheduler.last_epoch,
    }
    if stage == "smoke":
        if first_language_loss is None or not math.isfinite(first_language_loss):
            raise FloatingPointError("smoke step did not produce a finite first language loss")
        reference_loss = math.log(cfg.vocab_size)
        if abs(first_language_loss - reference_loss) > 1.0:
            raise FloatingPointError(
                f"random-init language loss {first_language_loss:.4f} is not near "
                f"ln({cfg.vocab_size})={reference_loss:.4f}; check tokenizer/vocabulary offsets/loss masking"
            )
    if stage == "joint":
        expected_family_counts = {family: steps for family in JOINT_FAMILY_TASKS}
        if job_sampled_family_counts != expected_family_counts:
            raise RuntimeError(
                f"joint run must sample each family exactly once per optimizer step: "
                f"expected={expected_family_counts}, actual={job_sampled_family_counts}"
            )
    checkpoint_report = save_checkpoint(
        checkpoint_path, model, optimizer, scheduler, step,
        {"model": cfg.to_dict(), "training": raw_cfg.get("training", {})}, metadata,
    )
    task_counts = {
        task: len(items) for task, items in sorted(records_by_task.items())
    }
    report = {
        "model_name": "OneCore",
        "stage": stage,
        "optimizer_step": step,
        "steps_in_this_job": steps,
        "real_data": real_data,
        "data_kind": data_kind,
        "parameter_count": model.count_parameters(),
        "parameter_report": model.parameter_report(),
        "mean_loss": sum(losses) / max(1, len(losses)),
        "first_language_loss": first_language_loss,
        "first_language_loss_reference_nats": 8.5456,
        "training_flops_total": job_training_flops,
        "training_flops_per_optimizer_step": optimizer_step_flops,
        "training_flops_mean_per_optimizer_step": job_training_flops / max(1, len(optimizer_step_flops)),
        "last_loss": losses[-1] if losses else None,
        "learning_rate": scheduler.get_last_lr()[0],
        "tokenizer_sha256": tokenizer_sha,
        "manifest_sha256": manifest_sha,
        "asset_manifest_sha256": asset_manifest_sha,
        "training_data_fingerprint": training_data_fingerprint,
        "asset_lineage_status": asset_lineage_status,
        "data_extension": data_extension,
        "source_data_counts": source_data_counts,
        "optimizer_data_class_counts": optimizer_data_class_counts,
        "excluded_data_class_counts": excluded_data_class_counts,
        "lineage_id": lineage_id,
        "parent_checkpoint_sha256": parent_checkpoint_sha256,
        "parent_optimizer_step": parent_optimizer_step,
        "parent_run_id": parent_run_id,
        "codebook_report": codebook_report,
        "checkpoint": checkpoint_report,
        "task_counts": task_counts,
        "sampling_policy": (
            "one external sample from each of text/tool/image/audio/video per optimizer step"
            if stage in {"joint", "multimodal"} else "legacy weighted task sampler"
        ),
        "sampled_family_counts": sampled_family_counts,
        "sampled_family_counts_in_this_job": job_sampled_family_counts,
        "sampled_task_counts": sampled_task_counts,
        "sampled_task_counts_in_this_job": job_sampled_task_counts,
        "native_tldm": {
            "architecture": "shared OneCore embeddings + latent pooling + recurrent shared-block thinker + tied-LM-head discrete diffusion writer",
            "additional_trainable_parameters": 0,
            "diffusion_loss_weight": train_cfg.tldm_diffusion_weight,
            "updates": tldm_updates,
            "loss_sum": tldm_diffusion_loss_sum,
            "mean_diffusion_loss": (
                tldm_diffusion_loss_sum / tldm_updates if tldm_updates else None
            ),
        },
        "micro_batches_per_optimizer_step": 5 if stage in {"joint", "multimodal"} else train_cfg.gradient_accumulation,
        "source_data_counts": source_data_counts,
        "optimizer_data_class_counts": optimizer_data_class_counts,
        "excluded_data_class_counts": excluded_data_class_counts,
        "data_extension": data_extension,
        "promotion_eligible": False,
        "promotion_note": "training completion is not an evaluation or promotion decision",
    }
    write_json_atomic(out / "train_result.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="OneCore bounded, resumable GitHub CPU training runner")
    parser.add_argument("--root", default=".")
    parser.add_argument("--config", default="configs/phone-research.yaml")
    parser.add_argument("--stage", choices=["smoke", "text", "joint", "multimodal"], required=True)
    parser.add_argument("--steps", type=int, default=1)
    parser.add_argument("--output-dir", default="run-state")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    root = Path(args.root)
    report = run_training(
        root, root / args.config, args.stage, args.steps,
        args.output_dir, args.resume,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
