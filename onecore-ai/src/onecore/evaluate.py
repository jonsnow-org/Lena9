from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import torch

from .checkpoint import load_checkpoint, sha256_file
from .config import load_config
from .data import read_manifest, validate_manifest
from .model import OneCore
from .train import _record_sequence
from .tokenizer import load_tokenizer

REQUIRED_METRICS = (
    "text_loss", "tool_use", "image_reconstruction",
    "audio_reconstruction", "video_sequence",
)


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

@torch.no_grad()
def evaluate_checkpoint(project_root: str | Path, config_path: str | Path,
                        checkpoint_path: str | Path, tokenizer_path: str | Path,
                        thresholds_path: str | Path, output_path: str | Path,
    root = Path(project_root).resolve()
    cfg, _, _ = load_config(config_path)
    if split not in {"validation", "test"}:
        raise ValueError("evaluation split must be validation or test")
    split_manifest = root / "data" / f"{split}.jsonl"
    records = read_manifest(split_manifest)
    data_report = validate_manifest(
        records, root / "data" / "assets", expected_split=split
    )
    if not data_report["valid"]:
        raise ValueError(f"{split} data gate failed: " + "; ".join(data_report["errors"][:20]))

    checkpoint_file = Path(checkpoint_path)
    model = OneCore(cfg).cpu().eval()
    step, payload = load_checkpoint(checkpoint_file, model, optimizer=None, scheduler=None, map_location="cpu")
    tokenizer_file = Path(tokenizer_path)
    tokenizer_sha = sha256_file(tokenizer_file)
    expected_tokenizer_sha = payload.get("metadata", {}).get("tokenizer_sha256")
    if expected_tokenizer_sha and expected_tokenizer_sha != tokenizer_sha:
        raise ValueError("validation tokenizer fingerprint does not match checkpoint lineage")
    tokenizer = load_tokenizer(tokenizer_file)

    loss_sum: dict[str, float] = {}
    aux_sum: dict[str, float] = {}
    counts: dict[str, int] = {}
    token_counts: dict[str, int] = {}
    with torch.no_grad():
        for record in records:
            sequence, aux_loss, task = _record_sequence(record, model, tokenizer, root)
            logits = model(sequence[:, :-1], causal=True)
            targets = sequence[:, 1:]
            loss = torch.nn.functional.cross_entropy(
                logits.reshape(-1, logits.shape[-1]), targets.reshape(-1), reduction="mean"
            )
            loss_sum[task] = loss_sum.get(task, 0.0) + float(loss)
            aux_sum[task] = aux_sum.get(task, 0.0) + float(aux_loss)
            counts[task] = counts.get(task, 0) + 1
            token_counts[task] = token_counts.get(task, 0) + int(targets.numel())

    def mean(source: dict[str, float], task: str) -> float | None:
        return source[task] / counts[task] if task in counts and counts[task] else None

    per_task_loss = {task: mean(loss_sum, task) for task in counts}
    per_task_aux = {task: mean(aux_sum, task) for task in counts}
    modalities_tested: list[str] = []
    metric_map = {
        "text": "text_loss",
        "tool_use": "tool_use",
        "image_caption": "image_reconstruction",
        "audio_text": "audio_reconstruction",
        "video_caption": "video_sequence",
    }
    for task, metric in metric_map.items():
        if task in counts:
            modalities_tested.append(metric)

    thresholds_file = Path(thresholds_path)
    threshold_doc = json.loads(thresholds_file.read_text(encoding="utf-8")) if thresholds_file.is_file() else {}
    contains_synthetic = any(
        record["license"] == "local-owner-synthetic" or record["review_status"] != "approved"
        for record in records
    )
    data_kind = "contains_synthetic_or_unapproved_data" if contains_synthetic else "reviewed_validation_data"
    split_manifest_sha256 = sha256_file(split_manifest)
    metrics = {
        "evaluation_id": f"{split}-step-{step}-{sha256_file(checkpoint_file)[:12]}",
        "split": split,
        "checkpoint_sha256": sha256_file(checkpoint_file),
        "checkpoint_step": step,
        "tokenizer_sha256": tokenizer_sha,
        "real_data": not contains_synthetic,
        "data_kind": data_kind,
        "parameter_count": model.count_parameters(),
        "text_loss": mean(loss_sum, "text"),
        "tool_use": mean(loss_sum, "tool_use"),
        "image_reconstruction": mean(aux_sum, "image_caption"),
        "audio_reconstruction": mean(aux_sum, "audio_text"),
        "video_sequence": (
            (mean(loss_sum, "video_caption") or 0.0) + (mean(aux_sum, "video_caption") or 0.0)
            if "video_caption" in counts else None
        ),
        "per_task_loss": per_task_loss,
        "per_task_auxiliary_loss": per_task_aux,
        "per_task_counts": counts,
        "per_task_target_tokens": token_counts,
        "modalities_tested": modalities_tested,
        "quality_thresholds": threshold_doc.get("thresholds", {}),
        "split_manifest_sha256": split_manifest_sha256,
        "split_manifest_records": data_report["records"],
        "asset_manifest_sha256": _asset_manifest_sha256(root, records),
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


def promotion_gate(metrics: dict[str, Any], baseline: dict[str, Any] | None = None,
                   require_real_data: bool = True) -> tuple[bool, list[str]]:
    failures: list[str] = []
    if metrics.get("split") != "validation":
        failures.append("top-level candidate metrics must come from the validation split")
    if metrics.get("real_data") is not True and require_real_data:
        failures.append("validation candidate was evaluated only on synthetic/unapproved data")
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

    test_metrics = metrics.get("test_metrics")
    if not isinstance(test_metrics, dict):
        failures.append("independent held-out test metrics are missing")
    else:
        if test_metrics.get("split") != "test":
            failures.append("nested test metrics must be evaluated on the test split")
        if test_metrics.get("checkpoint_sha256") != metrics.get("checkpoint_sha256"):
            failures.append("validation and test metrics refer to different checkpoint hashes")
        if test_metrics.get("parameter_count") != metrics.get("parameter_count"):
            failures.append("validation and test metrics report different parameter counts")
        validation_hash = metrics.get("split_manifest_sha256") or metrics.get("validation_manifest_sha256")
        test_hash = test_metrics.get("split_manifest_sha256") or test_metrics.get("test_manifest_sha256")
        if not isinstance(validation_hash, str) or not isinstance(test_hash, str) or validation_hash == test_hash:
            failures.append("validation and test manifest fingerprints are missing or not independent")
        if test_metrics.get("real_data") is not True and require_real_data:
            failures.append("test split contains only synthetic/unapproved data")
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

    if baseline:
        old = baseline.get("text_loss")
        current = metrics.get("text_loss")
        if isinstance(old, (int, float)) and isinstance(current, (int, float)) and current > old * 1.02:
            failures.append("validation text loss regressed by more than 2% against the supplied baseline")
        old_test = baseline.get("test_metrics", {}).get("text_loss") if isinstance(baseline.get("test_metrics"), dict) else None
        current_test = test_metrics.get("text_loss") if isinstance(test_metrics, dict) else None
        if isinstance(old_test, (int, float)) and isinstance(current_test, (int, float)) and current_test > old_test * 1.02:
            failures.append("test text loss regressed by more than 2% against the supplied baseline")
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
    passed, failures = promotion_gate(metrics)
    print(json.dumps({
        "metrics": metrics, "promotion_gate_passed": passed, "failures": failures,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
