from __future__ import annotations

import hashlib
import json
import math
import unicodedata
from pathlib import Path
from typing import Any

import torch

from .checkpoint import load_checkpoint, sha256_file
from .config import load_config
from .data import classify_record_data, external_record_is_trainable, read_manifest, validate_manifest, validate_external_provenance_disjointness
from .curriculum_reference import verify_record
from .model import MASK, OneCore
from .inference import InferenceSession
from .tool_eval import evaluate_tool_behavior
from .train import _load_image, _load_mel, _record_sequence
from .tokenizer import load_tokenizer

REQUIRED_METRICS = (
    "text_loss", "tool_use", "image_reconstruction",
    "audio_reconstruction", "video_sequence",
)
REQUIRED_CODEBOOKS = ("vision", "audio", "motion")
T_LDM_EVALUATION_PROTOCOL = "onecore-native-tldm-heldout-v1"
T_LDM_FAMILY_TASKS = {
    "text": {"text"},
    "tool": {"tool_use"},
    "image": {"image_caption", "image_reconstruction"},
    "audio": {"audio_text", "audio_reconstruction"},
    "video": {"video_caption", "video_reconstruction"},
}

MODALITY_TASK_GROUPS = {
    "text_loss": {"text"},
    "tool_use": {"tool_use"},
    "image_reconstruction": {"image_caption", "image_reconstruction"},
    "audio_reconstruction": {"audio_text", "audio_reconstruction"},
    "video_sequence": {"video_caption", "video_reconstruction"},
}


def _modalities_tested(task_counts: dict[str, int]) -> list[str]:
    """Return modalities with at least one evaluated task record."""
    observed = {task for task, count in task_counts.items() if int(count) > 0}
    return [
        metric for metric, tasks in MODALITY_TASK_GROUPS.items()
        if tasks & observed
    ]


def _text_language_bucket(record: dict[str, Any]) -> tuple[str, str]:
    """Classify natural-language text conservatively for held-out language metrics.

    Explicit language metadata is authoritative. When it is absent, Unicode
    script is reported as an unlabeled proxy rather than asserted to be a
    language. Code records are excluded from natural-language buckets.
    """
    if str(record.get("code_language") or "").strip():
        return "code_excluded", "metadata"

    explicit = str(record.get("language") or record.get("lang") or "").strip().casefold()
    primary = explicit.replace("_", "-").split("-", 1)[0]
    if primary in {"ar", "arabic"}:
        return "arabic", "metadata"
    if primary in {"en", "english"}:
        return "english", "metadata"
    if primary and primary not in {"und", "unknown", "unk", "none", "null"}:
        return "other_language_metadata", "metadata"

    arabic_letters = 0
    latin_letters = 0
    for character in str(record.get("text") or ""):
        if not character.isalpha():
            continue
        unicode_name = unicodedata.name(character, "")
        if "ARABIC" in unicode_name:
            arabic_letters += 1
        elif "LATIN" in unicode_name:
            latin_letters += 1
    if arabic_letters and not latin_letters:
        return "arabic_script_unlabeled", "unicode_script"
    if latin_letters and not arabic_letters:
        return "latin_script_unlabeled", "unicode_script"
    return "mixed_or_unknown", "unicode_script"


def _token_weighted_mean_loss(record_losses: list[float], record_token_counts: list[int]) -> float:
    """Aggregate per-record mean cross-entropy weighted by target-token count."""
    if len(record_losses) != len(record_token_counts):
        raise ValueError("record losses and token counts must have matching lengths")
    if any(not math.isfinite(loss) for loss in record_losses):
        raise ValueError("record losses must be finite")
    if not record_losses or any(count <= 0 for count in record_token_counts):
        raise ValueError("token-weighted loss requires records with positive target-token counts")
    total_tokens = sum(record_token_counts)
    return sum(loss * count for loss, count in zip(record_losses, record_token_counts)) / total_tokens


def _asset_manifest_sha256(root: Path, records: list[dict[str, Any]]) -> str:
    assets_root = (root / "data" / "assets").resolve()
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
        if assets_root not in target.parents or not target.is_file():
            raise ValueError(f"evaluation asset is missing or escapes data/assets: {relative}")
        entries.append({"path": relative, "sha256": sha256_file(target)})
    encoded = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()



def codebook_assignment_report(local_ids: torch.Tensor, codebook_size: int) -> dict[str, int | float]:
    ids = local_ids.detach().reshape(-1).long()
    if codebook_size < 2:
        raise ValueError("codebook_size must be at least two")
    if ids.numel() == 0:
        return {"used_codes": 0, "total_codes": codebook_size, "usage_fraction": 0.0,
                "assignment_count": 0, "perplexity": 0.0, "normalized_entropy": 0.0,
                "max_code_fraction": 0.0, "dead_codes": codebook_size}
    if int(ids.min()) < 0 or int(ids.max()) >= codebook_size:
        raise ValueError("local codebook assignment ID is outside its codebook range")
    counts = torch.bincount(ids.cpu(), minlength=codebook_size).to(torch.float64)
    total = int(counts.sum().item())
    nonzero = counts[counts > 0]
    probabilities = nonzero / total
    entropy = float(-(probabilities * probabilities.log()).sum().item())
    used = int(nonzero.numel())
    return {
        "used_codes": used,
        "total_codes": codebook_size,
        "usage_fraction": used / codebook_size,
        "assignment_count": total,
        "perplexity": math.exp(entropy),
        "normalized_entropy": entropy / math.log(codebook_size),
        "max_code_fraction": float(counts.max().item() / total),
        "dead_codes": codebook_size - used,
    }


def _collect_codebook_usage(root: Path, records: list[dict[str, Any]], model: OneCore) -> dict[str, Any]:
    cfg = model.cfg
    assets = root / "data" / "assets"
    assignments: dict[str, list[torch.Tensor]] = {name: [] for name in REQUIRED_CODEBOOKS}
    for record in records:
        task = record["task"]
        if task in {"image_caption", "image_reconstruction"}:
            image = _load_image(assets / record["image"], cfg.image_size)
            ids, _, _ = model.encode_image(image)
            assignments["vision"].append(ids.reshape(-1) - cfg.vision_start)
        elif task in {"audio_text", "audio_reconstruction"}:
            mel = _load_mel(assets / record["audio_features"], cfg.audio_bins)
            ids, _, _ = model.encode_audio(mel)
            assignments["audio"].append(ids.reshape(-1) - cfg.audio_start)
        elif task in {"video_caption", "video_reconstruction"}:
            frame_tensors = [_load_image(assets / relative, cfg.image_size) for relative in record["frames"]]
            for frame in frame_tensors:
                ids, _, _ = model.encode_image(frame)
                assignments["vision"].append(ids.reshape(-1) - cfg.vision_start)
            for current, following in zip(frame_tensors, frame_tensors[1:]):
                difference = following - current
                ids, _, _ = model.encode_motion(difference)
                assignments["motion"].append(ids.reshape(-1) - cfg.motion_start)
    sizes = {
        "vision": cfg.vision_codebook_size,
        "audio": cfg.audio_codebook_size,
        "motion": cfg.motion_codebook_size,
    }
    return {
        name: codebook_assignment_report(
            torch.cat(assignments[name]) if assignments[name] else torch.empty(0, dtype=torch.long),
            sizes[name],
        )
        for name in REQUIRED_CODEBOOKS
    }


def select_evaluation_records(
    records: list[dict[str, Any]],
    data_classes: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Select a diagnostic subset; production evaluation defaults to external records only."""
    effective_data_classes = set(data_classes) if data_classes is not None else {"external"}
    selected = [
        record for record in records
        if classify_record_data(record) in effective_data_classes
        and (
            classify_record_data(record) not in {"external_staged", "external_reviewed"}
            or external_record_is_trainable(record)
        )
    ]
    if not selected:
        raise ValueError(
            f"evaluation split contains no records for data filter {sorted(effective_data_classes)}"
        )
    return selected


def select_verified_tool_evaluation_records(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Select only deterministic synthetic tool episodes for engineering regression tests.

    These examples are never included in external-only loss, modality or T-LDM metrics,
    and are never eligible for optimizer updates.
    """
    return [
        record for record in records
        if str(record.get("data_class", "")).strip().lower() == "synthetic_verified"
        and record.get("task") == "tool_use"
        and verify_record(record)
    ]


def select_tldm_evaluation_records(
    records: list[dict[str, Any]],
    split: str,
    per_task_limit: int = 16,
) -> list[dict[str, Any]]:
    """Choose a stable, bounded, task-stratified held-out T-LDM evaluation set."""
    if split not in {"validation", "test"}:
        raise ValueError("T-LDM held-out evaluation split must be validation or test")
    if per_task_limit < 1:
        raise ValueError("per_task_limit must be positive")
    grouped: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for record in records:
        task = str(record.get("task", ""))
        if not any(task in tasks for tasks in T_LDM_FAMILY_TASKS.values()):
            continue
        record_id = str(record.get("id", "")).strip()
        if not record_id:
            raise ValueError("T-LDM held-out records require stable record IDs")
        rank = hashlib.sha256(
            f"{T_LDM_EVALUATION_PROTOCOL}:{split}:{record_id}".encode("utf-8")
        ).hexdigest()
        grouped.setdefault(task, []).append((rank, record))
    selected: list[dict[str, Any]] = []
    for task in sorted(grouped):
        ordered = sorted(grouped[task], key=lambda item: item[0])
        selected.extend(record for _, record in ordered[:per_task_limit])
    if not selected:
        raise ValueError(f"{split} split contains no records for T-LDM held-out evaluation")
    return selected


@torch.no_grad()
def _tldm_masked_span_loss(
    model: OneCore,
    sequence: torch.Tensor,
    record_id: str,
    split: str,
) -> tuple[float | None, int]:
    """Measure deterministic contiguous-span denoising loss on one held-out sequence."""
    if split not in {"validation", "test"}:
        raise ValueError("T-LDM masked-span evaluation requires validation or test")
    if sequence.ndim != 2:
        raise ValueError("T-LDM evaluation sequence must have shape [batch, sequence]")
    sequence_length = int(sequence.shape[1])
    if sequence_length < 3:
        return None, 0
    block_width = min(32, max(1, sequence_length // 4), sequence_length - 2)
    latest_start = sequence_length - block_width - 1
    seed = int(hashlib.sha256(
        f"{T_LDM_EVALUATION_PROTOCOL}:{split}:{record_id}".encode("utf-8")
    ).hexdigest()[:16], 16)
    start = 1 + (seed % max(1, latest_start))
    end = start + block_width
    masked_sequence = sequence.clone()
    masked_sequence[:, start:end] = model.cfg.special_id(MASK)
    logits = model.forward_tldm(masked_sequence)
    targets = sequence[:, start:end]
    loss = torch.nn.functional.cross_entropy(
        logits[:, start:end, :].reshape(-1, logits.shape[-1]),
        targets.reshape(-1),
    )
    return float(loss), int(targets.numel())


@torch.no_grad()
def _evaluate_native_tldm(
    project_root: Path,
    records: list[dict[str, Any]],
    model: OneCore,
    tokenizer: Any,
    split: str,
    checkpoint_sha256: str,
    per_task_limit: int = 16,
) -> dict[str, Any]:
    """Evaluate the native diffusion objective on deterministic held-out examples."""
    selected = select_tldm_evaluation_records(records, split, per_task_limit)
    task_loss_sum: dict[str, float] = {}
    task_counts: dict[str, int] = {}
    masked_token_count = 0
    skipped_short_sequences = 0

    for record in selected:
        sequence, _, task = _record_sequence(record, model, tokenizer, project_root)
        loss, masked_tokens = _tldm_masked_span_loss(
            model, sequence, str(record["id"]), split
        )
        if loss is None:
            skipped_short_sequences += 1
            continue
        task_loss_sum[task] = task_loss_sum.get(task, 0.0) + loss
        task_counts[task] = task_counts.get(task, 0) + 1
        masked_token_count += masked_tokens

    per_task_loss = {
        task: task_loss_sum[task] / task_counts[task]
        for task in sorted(task_counts)
    }
    family_counts = {
        family: sum(task_counts.get(task, 0) for task in tasks)
        for family, tasks in T_LDM_FAMILY_TASKS.items()
    }
    family_loss: dict[str, float | None] = {}
    for family, tasks in T_LDM_FAMILY_TASKS.items():
        count = family_counts[family]
        total = sum(task_loss_sum.get(task, 0.0) for task in tasks)
        family_loss[family] = total / count if count else None
    total_count = sum(task_counts.values())
    overall_loss = sum(task_loss_sum.values()) / total_count if total_count else None
    return {
        "protocol": T_LDM_EVALUATION_PROTOCOL,
        "split": split,
        "checkpoint_sha256": checkpoint_sha256,
        "sample_cap_per_task": per_task_limit,
        "sample_counts_by_task": task_counts,
        "sample_counts_by_family": family_counts,
        "per_task_masked_span_loss": per_task_loss,
        "per_family_masked_span_loss": family_loss,
        "masked_span_loss": overall_loss,
        "sample_count": total_count,
        "masked_token_count": masked_token_count,
        "skipped_short_sequences": skipped_short_sequences,
    }


def _check_native_tldm_evaluation(
    prefix: str,
    report: dict[str, Any] | None,
    expected_split: str,
    checkpoint_sha256: str,
    thresholds: dict[str, Any],
    threshold_key: str,
    failures: list[str],
) -> None:
    """Require independent, five-family held-out evidence and a separately approved limit."""
    if not isinstance(report, dict):
        failures.append(f"{prefix} native T-LDM held-out evaluation report is missing")
        return
    if report.get("protocol") != T_LDM_EVALUATION_PROTOCOL:
        failures.append(f"{prefix} native T-LDM evaluation protocol is missing or unsupported")
    if report.get("split") != expected_split:
        failures.append(f"{prefix} native T-LDM evaluation used the wrong split")
    if report.get("checkpoint_sha256") != checkpoint_sha256:
        failures.append(f"{prefix} native T-LDM report refers to a different checkpoint")
    family_counts = report.get("sample_counts_by_family")
    family_losses = report.get("per_family_masked_span_loss")
    if not isinstance(family_counts, dict) or not isinstance(family_losses, dict):
        failures.append(f"{prefix} native T-LDM family-level held-out evidence is missing")
        family_counts = {}
        family_losses = {}
    for family in T_LDM_FAMILY_TASKS:
        count = family_counts.get(family)
        if not isinstance(count, int) or count < 10:
            failures.append(f"{prefix} native T-LDM has fewer than 10 held-out {family} examples")
        value = family_losses.get(family)
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            failures.append(f"{prefix} native T-LDM {family} masked-span loss is missing or invalid")
    overall = report.get("masked_span_loss")
    if not isinstance(overall, (int, float)) or not math.isfinite(overall) or overall <= 0:
        failures.append(f"{prefix} native T-LDM overall masked-span loss is missing or invalid")
        return
    limit = thresholds.get(threshold_key)
    if not isinstance(limit, (int, float)) or not math.isfinite(limit) or limit <= 0:
        failures.append(f"approved positive T-LDM threshold {threshold_key} is missing")
    elif overall > limit:
        failures.append(
            f"{prefix} native T-LDM masked-span loss {overall:.6g} exceeds approved threshold {limit:.6g}"
        )


@torch.no_grad()
def evaluate_checkpoint(project_root: str | Path, config_path: str | Path,
                        checkpoint_path: str | Path, tokenizer_path: str | Path,
                        thresholds_path: str | Path, output_path: str | Path,
                        split: str = "validation",
                        data_classes: set[str] | None = None) -> dict[str, Any]:
    root = Path(project_root).resolve()
    cfg, _, raw_cfg = load_config(config_path)
    if split not in {"validation", "test"}:
        raise ValueError("evaluation split must be validation or test")
    split_manifest = root / "data" / f"{split}.jsonl"
    all_records = read_manifest(split_manifest)
    data_report = validate_manifest(
        all_records, root / "data" / "assets", expected_split=split
    )
    if not data_report["valid"]:
        raise ValueError(f"{split} data gate failed: " + "; ".join(data_report["errors"][:20]))
    external_provenance_audit = (
        validate_external_provenance_disjointness(root) if split == "validation" else None
    )
    evaluation_data_classes = set(data_classes) if data_classes is not None else {"external"}
    records = select_evaluation_records(all_records, evaluation_data_classes)
    requested_data_filter = sorted(evaluation_data_classes)

    checkpoint_file = Path(checkpoint_path)
    model = OneCore(cfg).cpu().eval()
    step, payload = load_checkpoint(checkpoint_file, model, optimizer=None, scheduler=None, map_location="cpu")
    tokenizer_file = Path(tokenizer_path)
    tokenizer_sha = sha256_file(tokenizer_file)
    expected_tokenizer_sha = payload.get("metadata", {}).get("tokenizer_sha256")
    if expected_tokenizer_sha and expected_tokenizer_sha != tokenizer_sha:
        raise ValueError("validation tokenizer fingerprint does not match checkpoint lineage")
    tokenizer = load_tokenizer(tokenizer_file)
    tool_session = InferenceSession(model, tokenizer)

    def generate_verified_tool_call(record: dict[str, Any]) -> dict[str, Any]:
        record_id = str(record.get("id", ""))
        seed = int(hashlib.sha256(record_id.encode("utf-8")).hexdigest()[:8], 16)
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(seed)
            return tool_session.generate_tool_call(
                str(record.get("prompt", "")), max_new_tokens=96
            )

    tool_behavior_records = select_verified_tool_evaluation_records(all_records)
    tool_behavior = evaluate_tool_behavior(
        tool_behavior_records, generate_verified_tool_call, max_examples=32
    )
    tool_behavior.update({
        "data_class": "synthetic_verified",
        "evaluation_role": "engineering_only",
        "split": split,
        "split_manifest_sha256": sha256_file(split_manifest),
    })

    loss_sum: dict[str, float] = {}
    aux_sum: dict[str, float] = {}
    counts: dict[str, int] = {}
    token_counts: dict[str, int] = {}
    language_loss_sum: dict[str, float] = {}
    language_counts: dict[str, int] = {}
    language_token_counts: dict[str, int] = {}
    language_record_losses: dict[str, list[float]] = {}
    language_record_token_counts: dict[str, list[int]] = {}
    language_detection_methods: dict[str, dict[str, int]] = {}
    language_code_excluded = 0
    with torch.no_grad():
        for record in records:
            sequence, aux_loss, task = _record_sequence(record, model, tokenizer, root)
            logits = model(sequence[:, :-1], causal=True)
            targets = sequence[:, 1:]
            loss = torch.nn.functional.cross_entropy(
                logits.reshape(-1, logits.shape[-1]), targets.reshape(-1), reduction="mean"
            )
            loss_value = float(loss)
            loss_sum[task] = loss_sum.get(task, 0.0) + loss_value
            aux_sum[task] = aux_sum.get(task, 0.0) + float(aux_loss)
            counts[task] = counts.get(task, 0) + 1
            target_count = int(targets.numel())
            token_counts[task] = token_counts.get(task, 0) + target_count
            if task == "text":
                language_bucket, detection_method = _text_language_bucket(record)
                if language_bucket == "code_excluded":
                    language_code_excluded += 1
                else:
                    language_loss_sum[language_bucket] = (
                        language_loss_sum.get(language_bucket, 0.0) + loss_value
                    )
                    language_counts[language_bucket] = language_counts.get(language_bucket, 0) + 1
                    language_token_counts[language_bucket] = (
                        language_token_counts.get(language_bucket, 0) + target_count
                    )
                    language_record_losses.setdefault(language_bucket, []).append(loss_value)
                    language_record_token_counts.setdefault(language_bucket, []).append(target_count)
                    methods = language_detection_methods.setdefault(language_bucket, {})
                    methods[detection_method] = methods.get(detection_method, 0) + 1

    def mean(source: dict[str, float], task: str) -> float | None:
        return source[task] / counts[task] if task in counts and counts[task] else None

    per_task_loss = {task: mean(loss_sum, task) for task in counts}
    per_task_aux = {task: mean(aux_sum, task) for task in counts}
    text_language_metrics = {
        bucket: {
            "records": language_counts[bucket],
            "target_tokens": language_token_counts[bucket],
            "mean_loss": _token_weighted_mean_loss(
                language_record_losses[bucket], language_record_token_counts[bucket]
            ),
            "mean_record_loss": language_loss_sum[bucket] / language_counts[bucket],
            "detection_method_counts": language_detection_methods.get(bucket, {}),
        }
        for bucket in sorted(language_counts)
    }
    modalities_tested = _modalities_tested(counts)

    def combined_mean(source: dict[str, float], tasks: set[str]) -> float | None:
        present = [task for task in tasks if task in counts]
        total = sum(counts[task] for task in present)
        return (sum(source[task] for task in present) / total) if total else None

    thresholds_file = Path(thresholds_path)
    threshold_doc = json.loads(thresholds_file.read_text(encoding="utf-8")) if thresholds_file.is_file() else {}
    checkpoint_digest = sha256_file(checkpoint_file)
    native_tldm_evaluation = _evaluate_native_tldm(
        root, records, model, tokenizer, split, checkpoint_digest
    )
    data_classes = sorted({classify_record_data(record) for record in records})
    data_kind = (
        "external_only" if data_classes == ["external"]
        else "mixed" if len(data_classes) > 1
        else data_classes[0] if data_classes else "empty"
    )
    data_verified_for_promotion = bool(records) and data_classes == ["external"] and all(
        external_record_is_trainable(record) for record in records
    )
    real_data = data_classes == ["external"]
    selected_manifest_payload = json.dumps(
        [{"id": record.get("id"), "task": record.get("task"),
          "source_url": record.get("source_url"), "data_class": classify_record_data(record)}
         for record in records],
        ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")
    selected_records_sha256 = hashlib.sha256(selected_manifest_payload).hexdigest()
    # Bind evaluation to the exact manifest bytes, including payload text,
    # language metadata, source revisions, row hashes and attribution fields.
    split_manifest_sha256 = sha256_file(split_manifest)
    metrics = {
        "evaluation_id": f"{split}-step-{step}-{sha256_file(checkpoint_file)[:12]}",
        "split": split,
        "checkpoint_sha256": checkpoint_digest,
        "checkpoint_step": step,
        "tokenizer_sha256": tokenizer_sha,
        "real_data": real_data,
        "data_kind": data_kind,
        "data_classes": data_classes,
        "data_verified_for_promotion": data_verified_for_promotion,
        "external_provenance_audit": external_provenance_audit,
        "parameter_count": model.count_parameters(),
        "text_loss": mean(loss_sum, "text"),
        "tool_use": mean(loss_sum, "tool_use"),
        "tool_behavior": tool_behavior,
        "native_tldm_evaluation": native_tldm_evaluation,
        "image_reconstruction": combined_mean(aux_sum, {"image_caption", "image_reconstruction"}),
        "audio_reconstruction": combined_mean(aux_sum, {"audio_text", "audio_reconstruction"}),
        "video_sequence": (
            (combined_mean(loss_sum, {"video_caption", "video_reconstruction"}) or 0.0)
            + (combined_mean(aux_sum, {"video_caption", "video_reconstruction"}) or 0.0)
            if ({"video_caption", "video_reconstruction"} & set(counts)) else None
        ),
        "per_task_loss": per_task_loss,
        "per_task_auxiliary_loss": per_task_aux,
        "text_language_metrics": text_language_metrics,
        "text_language_code_records_excluded": language_code_excluded,
        "selected_records_sha256": selected_records_sha256,
        "per_task_counts": counts,
        "per_task_target_tokens": token_counts,
        "modalities_tested": modalities_tested,
        "quality_thresholds_status": str(threshold_doc.get("status", "missing")),
        "quality_thresholds": threshold_doc.get("thresholds", {}),
        "text_loss_regression_max": raw_cfg.get("evaluation", {}).get("text_loss_regression_max"),
        "split_manifest_sha256": split_manifest_sha256,
        "split_manifest_records": len(records),
        "total_manifest_records": data_report["records"],
        "evaluation_data_filter": requested_data_filter,
        "asset_manifest_sha256": _asset_manifest_sha256(root, records),
        "codebook_usage": _collect_codebook_usage(root, records, model),
        "validation_manifest_sha256": split_manifest_sha256 if split == "validation" else None,
        "test_manifest_sha256": split_manifest_sha256 if split == "test" else None,
        "validation_manifest_records": data_report["records"] if split == "validation" else None,
        "test_manifest_records": data_report["records"] if split == "test" else None,
        "promotion_status": "not_evaluated",
    }
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    return metrics



def _check_tool_behavior(
    prefix: str,
    report: dict[str, Any] | None,
    thresholds: dict[str, Any],
    threshold_key: str,
    failures: list[str],
) -> None:
    if not isinstance(report, dict):
        failures.append(f"{prefix} verified tool-execution report is missing")
        return
    if report.get("data_class") != "synthetic_verified":
        failures.append(f"{prefix} tool regression evidence must use synthetic_verified engineering examples")
    if report.get("evaluation_role") != "engineering_only":
        failures.append(f"{prefix} tool regression evidence must be labeled engineering_only")
    sample_count = report.get("sample_count")
    if not isinstance(sample_count, int) or sample_count < 16:
        failures.append(f"{prefix} tool behaviour has fewer than 16 held-out examples")
    rate = report.get("execution_success_rate")
    if not isinstance(rate, (int, float)) or not math.isfinite(rate) or not 0 <= rate <= 1:
        failures.append(f"{prefix} tool execution success rate is missing or invalid")
    limit = thresholds.get(threshold_key)
    if not isinstance(limit, (int, float)) or not math.isfinite(limit) or not 0 <= limit <= 1:
        failures.append(f"approved {threshold_key} in [0,1] is missing")
    elif isinstance(rate, (int, float)) and math.isfinite(rate) and 0 <= rate <= 1 and rate < limit:
        failures.append(
            f"{prefix} tool execution success rate {rate:.4g} is below approved minimum {limit:.4g}"
        )
    per_step = report.get("per_step")
    if not isinstance(per_step, dict):
        failures.append(f"{prefix} per-step tool execution evidence is missing")
        return
    for step in ("1", "2"):
        step_report = per_step.get(step)
        if not isinstance(step_report, dict):
            failures.append(f"{prefix} tool workflow step {step} was not evaluated")
            continue
        step_count = step_report.get("sample_count")
        if not isinstance(step_count, int) or step_count < 4:
            failures.append(f"{prefix} tool workflow step {step} has fewer than 4 held-out examples")
        step_rate = step_report.get("execution_success_rate")
        if not isinstance(step_rate, (int, float)) or not math.isfinite(step_rate) or not 0 <= step_rate <= 1:
            failures.append(f"{prefix} tool workflow step {step} success rate is missing or invalid")
        elif isinstance(limit, (int, float)) and math.isfinite(limit) and 0 <= limit <= 1 and step_rate < limit:
            failures.append(
                f"{prefix} tool workflow step {step} success rate {step_rate:.4g} is below approved minimum {limit:.4g}"
            )


def _check_tool_behavior_regression(
    prefix: str,
    current: dict[str, Any] | None,
    baseline: dict[str, Any] | None,
    regression_floor: Any,
    failures: list[str],
) -> None:
    """Keep tool behaviour within 10% of a prior run on the exact same held-out cases."""
    if not isinstance(current, dict) or not isinstance(baseline, dict):
        failures.append(f"{prefix} baseline/current tool-behaviour evidence is missing")
        return
    floor = regression_floor
    if not isinstance(floor, (int, float)) or not math.isfinite(floor) or not 0 < floor <= 1:
        failures.append("tool_behavior_regression_floor must be a finite number in (0,1]")
        return
    if current.get("data_class") != "synthetic_verified" or baseline.get("data_class") != "synthetic_verified":
        failures.append(f"{prefix} tool regression baseline/current data class must be synthetic_verified")
        return
    if current.get("evaluation_role") != "engineering_only" or baseline.get("evaluation_role") != "engineering_only":
        failures.append(f"{prefix} tool regression baseline/current role must be engineering_only")
        return
    if current.get("split") != prefix or baseline.get("split") != prefix:
        failures.append(f"{prefix} tool regression baseline/current split does not match")
        return
    if current.get("protocol") != baseline.get("protocol"):
        failures.append(f"{prefix} tool-behaviour protocol differs from the baseline")
        return
    if current.get("sample_ids_sha256") != baseline.get("sample_ids_sha256"):
        failures.append(f"{prefix} tool evaluation does not use the same fixed held-out cases as the baseline")
        return
    if current.get("sample_count") != baseline.get("sample_count"):
        failures.append(f"{prefix} tool evaluation sample count differs from the baseline")
        return

    def compare_rate(label: str, now: Any, before: Any) -> None:
        if not isinstance(now, (int, float)) or not math.isfinite(now) or not 0 <= now <= 1:
            failures.append(f"{prefix} current {label} is missing or invalid")
            return
        if not isinstance(before, (int, float)) or not math.isfinite(before) or not 0 <= before <= 1:
            failures.append(f"{prefix} baseline {label} is missing or invalid")
            return
        if before > 0 and now + 1e-12 < before * float(floor):
            failures.append(
                f"{prefix} {label} regressed from {before:.4g} to {now:.4g}; "
                f"minimum retained fraction is {float(floor):.3g}"
            )

    compare_rate(
        "tool execution success rate",
        current.get("execution_success_rate"),
        baseline.get("execution_success_rate"),
    )
    current_steps = current.get("per_step")
    baseline_steps = baseline.get("per_step")
    if not isinstance(current_steps, dict) or not isinstance(baseline_steps, dict):
        failures.append(f"{prefix} per-step baseline/current tool evidence is missing")
        return
    for step in ("1", "2"):
        now = current_steps.get(step)
        before = baseline_steps.get(step)
        if not isinstance(now, dict) or not isinstance(before, dict):
            failures.append(f"{prefix} tool workflow step {step} baseline/current evidence is missing")
            continue
        if now.get("sample_count") != before.get("sample_count"):
            failures.append(f"{prefix} tool workflow step {step} sample count differs from the baseline")
            continue
        compare_rate(
            f"tool workflow step {step} execution success rate",
            now.get("execution_success_rate"),
            before.get("execution_success_rate"),
        )



def _check_text_loss_regression(
    prefix: str,
    current: dict[str, Any] | None,
    baseline: dict[str, Any] | None,
    max_ratio: Any,
    failures: list[str],
) -> None:
    """Enforce the v2 text-loss ceiling against the same held-out examples."""
    if not isinstance(current, dict) or not isinstance(baseline, dict):
        failures.append(f"{prefix} text-loss baseline/current evaluation is missing")
        return
    if current.get("split") != baseline.get("split"):
        failures.append(f"{prefix} text-loss baseline uses a different split")
        return
    for key in ("tokenizer_sha256", "split_manifest_sha256", "selected_records_sha256"):
        value = current.get(key)
        if not isinstance(value, str) or not value or baseline.get(key) != value:
            failures.append(f"{prefix} text-loss baseline does not match current {key}")
    current_loss = current.get("text_loss")
    baseline_loss = baseline.get("text_loss")
    if not isinstance(max_ratio, (int, float)) or not math.isfinite(max_ratio) or max_ratio < 1:
        failures.append("evaluation.text_loss_regression_max must be a finite ratio >= 1")
        return
    if not isinstance(current_loss, (int, float)) or not math.isfinite(current_loss) or current_loss <= 0:
        failures.append(f"{prefix} current text loss is missing or invalid")
        return
    if not isinstance(baseline_loss, (int, float)) or not math.isfinite(baseline_loss) or baseline_loss <= 0:
        failures.append(f"{prefix} baseline text loss is missing or invalid")
        return
    if current_loss > baseline_loss * float(max_ratio) + 1e-12:
        failures.append(
            f"{prefix} text loss {current_loss:.6g} exceeds "
            f"{float(max_ratio):.4g} × baseline {baseline_loss:.6g}"
        )

def _check_codebook_thresholds(prefix: str, usage: dict[str, Any],
                               thresholds: dict[str, Any], failures: list[str],
                               test_split: bool = False) -> None:
    if not isinstance(usage, dict):
        failures.append(f"{prefix} codebook-usage reports are missing")
        return
    for modality in REQUIRED_CODEBOOKS:
        report = usage.get(modality)
        if not isinstance(report, dict) or int(report.get("assignment_count", 0)) <= 0:
            failures.append(f"{prefix} {modality} codebook assignments are missing")
            continue
        usage_fraction = report.get("usage_fraction")
        max_code_fraction = report.get("max_code_fraction")
        normalized_entropy = report.get("normalized_entropy")
        min_usage_key = f"test_min_{modality}_usage_fraction" if test_split else f"min_{modality}_usage_fraction"
        max_code_key = f"test_max_{modality}_max_code_fraction" if test_split else f"max_{modality}_max_code_fraction"
        min_entropy_key = f"test_min_{modality}_normalized_entropy" if test_split else f"min_{modality}_normalized_entropy"
        min_usage = thresholds.get(min_usage_key)
        max_code_limit = thresholds.get(max_code_key)
        min_entropy = thresholds.get(min_entropy_key)
        if not isinstance(min_usage, (int, float)) or not math.isfinite(min_usage) or not 0 < min_usage <= 1:
            failures.append(f"approved codebook-usage minimum {min_usage_key} is missing or invalid")
        elif not isinstance(usage_fraction, (int, float)) or not math.isfinite(usage_fraction):
            failures.append(f"{prefix} {modality} codebook usage fraction is missing or non-finite")
        elif usage_fraction < min_usage:
            failures.append(f"{prefix} {modality} codebook usage {usage_fraction:.4g} is below {min_usage:.4g}")
        if not isinstance(max_code_limit, (int, float)) or not math.isfinite(max_code_limit) or not 0 < max_code_limit <= 1:
            failures.append(f"approved max-code concentration limit {max_code_key} is missing or invalid")
        elif not isinstance(max_code_fraction, (int, float)) or not math.isfinite(max_code_fraction):
            failures.append(f"{prefix} {modality} max-code fraction is missing or non-finite")
        elif max_code_fraction > max_code_limit:
            failures.append(f"{prefix} {modality} max-code fraction {max_code_fraction:.4g} exceeds {max_code_limit:.4g}")
        if not isinstance(min_entropy, (int, float)) or not math.isfinite(min_entropy) or not 0 < min_entropy <= 1:
            failures.append(f"approved normalized-entropy minimum {min_entropy_key} is missing or invalid")
        elif not isinstance(normalized_entropy, (int, float)) or not math.isfinite(normalized_entropy):
            failures.append(f"{prefix} {modality} normalized entropy is missing or non-finite")
        elif normalized_entropy < min_entropy:
            failures.append(f"{prefix} {modality} normalized entropy {normalized_entropy:.4g} is below {min_entropy:.4g}")



def _check_external_only_evaluation(
    prefix: str,
    report: dict[str, Any],
    failures: list[str],
) -> None:
    """Require verified external-only records for every production evaluation split."""
    classes = report.get("data_classes")
    if (
        report.get("real_data") is not True
        or report.get("data_kind") != "external_only"
        or classes != ["external"]
        or report.get("data_verified_for_promotion") is not True
    ):
        failures.append(
            f"{prefix} evaluation must use verified external-only records; "
            f"data_kind={report.get('data_kind')!r}, data_classes={classes!r}, "
            f"verified={report.get('data_verified_for_promotion')!r}"
        )


def promotion_gate(metrics: dict[str, Any], baseline: dict[str, Any] | None = None,
                   require_verified_data: bool = True) -> tuple[bool, list[str]]:
    failures: list[str] = []
    if require_verified_data:
        _check_external_only_evaluation("validation", metrics, failures)
        provenance_audit = metrics.get("external_provenance_audit")
        if not isinstance(provenance_audit, dict) or provenance_audit.get("valid") is not True:
            failures.append("external source-row provenance audit is missing or invalid")
        else:
            split_counts = provenance_audit.get("external_records_by_split")
            if not isinstance(split_counts, dict) or any(
                not isinstance(split_counts.get(split), int) or split_counts[split] < 1
                for split in ("train", "validation", "test")
            ):
                failures.append("external source-row provenance audit has incomplete split counts")
            if provenance_audit.get("cross_split_source_row_overlaps") != 0:
                failures.append("external source-row provenance audit reports cross-split leakage")
    if metrics.get("split") != "validation":
        failures.append("top-level candidate metrics must come from the validation split")
    if not isinstance(metrics.get("parameter_count"), int) or metrics["parameter_count"] <= 0:
        failures.append("parameter_count is missing or invalid")
    if not isinstance(metrics.get("checkpoint_sha256"), str) or len(metrics["checkpoint_sha256"]) != 64:
        failures.append("checkpoint SHA-256 is missing or invalid")
    required_modalities = {
        "text_loss", "tool_use", "image_reconstruction",
        "audio_reconstruction", "video_sequence",
    }
    observed = set(metrics.get("modalities_tested", []))
    missing = required_modalities - observed
    if missing:
        failures.append(f"missing validation coverage: {sorted(missing)}")
    threshold_status = metrics.get("quality_thresholds_status")
    if threshold_status != "approved":
        failures.append(
            f"validation promotion thresholds status is {threshold_status!r}; "
            "expected 'approved' in configs/promotion-thresholds.json"
        )
    thresholds = metrics.get("quality_thresholds")
    if not isinstance(thresholds, dict) or not thresholds:
        failures.append("promotion thresholds have not been benchmarked and approved in configs/promotion-thresholds.json")
        thresholds = {}
    for key in REQUIRED_METRICS:
        value = metrics.get(key)
        limit = thresholds.get(key)
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            failures.append(f"validation metric {key} is missing or non-finite")
        if not isinstance(limit, (int, float)) or not math.isfinite(limit) or limit <= 0:
            failures.append(f"approved positive validation threshold for {key} is missing")
        elif isinstance(value, (int, float)) and math.isfinite(value) and value > limit:
            failures.append(f"validation {key}={value:.6g} exceeds approved threshold {limit:.6g}")
    _check_codebook_thresholds("validation", metrics.get("codebook_usage"), thresholds, failures)
    _check_native_tldm_evaluation(
        "validation", metrics.get("native_tldm_evaluation"), "validation",
        metrics.get("checkpoint_sha256"), thresholds,
        "native_tldm_max_masked_span_loss", failures,
    )
    _check_tool_behavior(
        "validation", metrics.get("tool_behavior"), thresholds,
        "min_tool_execution_success_rate", failures,
    )

    test_metrics = metrics.get("test_metrics")
    if not isinstance(test_metrics, dict):
        failures.append("independent held-out test metrics are missing")
    else:
        if test_metrics.get("split") != "test":
            failures.append("nested test metrics must be evaluated on the test split")
        test_threshold_status = test_metrics.get("quality_thresholds_status")
        if test_threshold_status != "approved":
            failures.append(
                f"test promotion thresholds status is {test_threshold_status!r}; "
                "expected 'approved' in configs/promotion-thresholds.json"
            )
        if test_threshold_status != threshold_status:
            failures.append("validation and test evaluation used different promotion-threshold approval states")
        if test_metrics.get("quality_thresholds") != thresholds:
            failures.append("validation and test evaluation used different approved threshold values")
        if require_verified_data:
            _check_external_only_evaluation("test", test_metrics, failures)
        if test_metrics.get("checkpoint_sha256") != metrics.get("checkpoint_sha256"):
            failures.append("validation and test metrics refer to different checkpoint hashes")
        if test_metrics.get("parameter_count") != metrics.get("parameter_count"):
            failures.append("validation and test metrics report different parameter counts")
        validation_hash = metrics.get("split_manifest_sha256") or metrics.get("validation_manifest_sha256")
        test_hash = test_metrics.get("split_manifest_sha256") or test_metrics.get("test_manifest_sha256")
        if not isinstance(validation_hash, str) or not isinstance(test_hash, str) or validation_hash == test_hash:
            failures.append("validation and test manifest fingerprints are missing or not independent")
        test_observed = set(test_metrics.get("modalities_tested", []))
        test_missing = required_modalities - test_observed
        if test_missing:
            failures.append(f"missing held-out test coverage: {sorted(test_missing)}")
        for key in REQUIRED_METRICS:
            value = test_metrics.get(key)
            limit = thresholds.get(f"test_{key}")
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                failures.append(f"test metric {key} is missing or non-finite")
            if not isinstance(limit, (int, float)) or not math.isfinite(limit) or limit <= 0:
                failures.append(f"approved positive test threshold for {key} is missing")
            elif isinstance(value, (int, float)) and math.isfinite(value) and value > limit:
                failures.append(f"test {key}={value:.6g} exceeds approved threshold {limit:.6g}")
        _check_codebook_thresholds("test", test_metrics.get("codebook_usage"), thresholds, failures, test_split=True)
        _check_native_tldm_evaluation(
            "test", test_metrics.get("native_tldm_evaluation"), "test",
            metrics.get("checkpoint_sha256"), thresholds,
            "test_native_tldm_max_masked_span_loss", failures,
        )
        _check_tool_behavior(
            "test", test_metrics.get("tool_behavior"), thresholds,
            "test_min_tool_execution_success_rate", failures,
        )

    if not isinstance(baseline, dict):
        failures.append("an approved-comparison baseline evaluation is required for text-loss and tool-regression checks")
    else:
        baseline_test = baseline.get("test_metrics") if isinstance(baseline.get("test_metrics"), dict) else None
        regression_floor = thresholds.get("tool_behavior_regression_floor")
        text_regression_max = metrics.get("text_loss_regression_max")
        _check_text_loss_regression(
            "validation", metrics, baseline, text_regression_max, failures,
        )
        _check_text_loss_regression(
            "test", test_metrics if isinstance(test_metrics, dict) else None,
            baseline_test, text_regression_max, failures,
        )
        _check_tool_behavior_regression(
            "validation", metrics.get("tool_behavior"), baseline.get("tool_behavior"),
            regression_floor, failures,
        )
        _check_tool_behavior_regression(
            "test",
            test_metrics.get("tool_behavior") if isinstance(test_metrics, dict) else None,
            baseline_test.get("tool_behavior") if isinstance(baseline_test, dict) else None,
            regression_floor, failures,
        )
    return not failures, failures



def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Evaluate a OneCore checkpoint on held-out data")
    parser.add_argument("--root", default=".")
    parser.add_argument("--config", default="configs/phone-research.yaml")
    parser.add_argument("--checkpoint", default="run-state/checkpoint.pt")
    parser.add_argument("--tokenizer", default="run-state/tokenizer.json")
    parser.add_argument("--thresholds", default="configs/promotion-thresholds.json")
    parser.add_argument("--output", default="run-state/evaluation.json")
    parser.add_argument("--split", choices=["validation", "test"], default="validation")
    args = parser.parse_args()
    root = Path(args.root)
    metrics = evaluate_checkpoint(
        root, root / args.config, root / args.checkpoint,
        root / args.tokenizer, root / args.thresholds, root / args.output, split=args.split,
    )
    if args.split == "validation":
        passed, failures = promotion_gate(metrics)
    else:
        passed, failures = False, ["a test-only report cannot be promoted; evaluate validation and test together in notebook 05"]
    print(json.dumps({
        "metrics": metrics, "promotion_gate_passed": passed, "failures": failures,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
