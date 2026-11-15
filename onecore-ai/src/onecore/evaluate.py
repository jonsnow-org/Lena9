from __future__ import annotations

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


@torch.no_grad()
def evaluate_checkpoint(project_root: str | Path, config_path: str | Path,
                        checkpoint_path: str | Path, tokenizer_path: str | Path,
                        thresholds_path: str | Path, output_path: str | Path) -> dict[str, Any]:
    root = Path(project_root).resolve()
    cfg, _, _ = load_config(config_path)
    validation_manifest = root / "data" / "validation.jsonl"
    records = read_manifest(validation_manifest)
    data_report = validate_manifest(
        records, root / "data" / "assets", expected_split="validation"
    )
    if not data_report["valid"]:
        raise ValueError("validation data gate failed: " + "; ".join(data_report["errors"][:20]))

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
    metrics = {
        "evaluation_id": f"step-{step}-{sha256_file(checkpoint_file)[:12]}",
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
        "validation_manifest_sha256": sha256_file(validation_manifest),
        "validation_manifest_records": data_report["records"],
        "promotion_status": "not_evaluated",
    }
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    return metrics


def promotion_gate(metrics: dict[str, Any], baseline: dict[str, Any] | None = None,
                   require_real_data: bool = True) -> tuple[bool, list[str]]:
    failures: list[str] = []
    if metrics.get("real_data") is not True and require_real_data:
        failures.append("candidate was evaluated only on synthetic bootstrap data, not reviewed real-world data")
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
        failures.append(f"missing held-out evaluation coverage: {sorted(missing)}")

    thresholds = metrics.get("quality_thresholds")
    if not isinstance(thresholds, dict) or not thresholds:
        failures.append("promotion thresholds have not been benchmarked and approved in configs/promotion-thresholds.json")
        thresholds = {}
    for key in REQUIRED_METRICS:
        value = metrics.get(key)
        limit = thresholds.get(key)
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            failures.append(f"metric {key} is missing or non-finite")
        if not isinstance(limit, (int, float)) or not math.isfinite(limit) or limit <= 0:
            failures.append(f"approved positive threshold for {key} is missing")
        elif isinstance(value, (int, float)) and math.isfinite(value) and value > limit:
            failures.append(f"{key}={value:.6g} exceeds approved threshold {limit:.6g}")

    if baseline:
        old = baseline.get("text_loss")
        current = metrics.get("text_loss")
        if isinstance(old, (int, float)) and isinstance(current, (int, float)) and current > old * 1.02:
            failures.append("text loss regressed by more than 2% against the accepted baseline")
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
    args = parser.parse_args()
    root = Path(args.root)
    metrics = evaluate_checkpoint(
        root, root / args.config, root / args.checkpoint,
        root / args.tokenizer, root / args.thresholds, root / args.output,
    )
    passed, failures = promotion_gate(metrics)
    print(json.dumps({
        "metrics": metrics, "promotion_gate_passed": passed, "failures": failures,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
