"""Resumable CPU training runner for the unified OneCore V3 model.

This runner consumes only the validated external V3 manifests and tokenizer.
One optimizer update is one joint step containing exactly one micro-batch from
each of the five data families.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import torch

from .checkpoint import load_v3_checkpoint, save_v3_checkpoint, sha256_file
from .config import V3Config
from .core import OneCoreV3
from .dataset import V3JointDataLoader
from .training import OneCoreV3Objective, train_v3_joint_step
from .resource_evidence import verify_resource_benchmark_report_binding


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".partial", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _learning_rate_multiplier(step: int, *, warmup_steps: int, total_steps: int) -> float:
    if warmup_steps and step < warmup_steps:
        return max(1, step + 1) / warmup_steps
    progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
    progress = min(1.0, max(0.0, progress))
    return 0.1 + 0.9 * 0.5 * (1.0 + math.cos(math.pi * progress))


def _set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def _validate_resource_evidence(
    path: str | Path | None,
    *,
    artifact_metadata_path: str | Path | None,
    config_fingerprint: str,
    manifest_sha256: str,
    train_manifest_sha256: str,
    tokenizer_sha256: str,
    threads: int,
) -> str:
    """Fail closed unless measured CPU evidence matches this exact V3 input."""
    if path is None:
        raise ValueError(
            "V3 optimizer training is blocked until a measured CPU resource benchmark report is supplied"
        )
    report_path = Path(path).resolve()
    if not report_path.is_file():
        raise FileNotFoundError(f"V3 CPU resource benchmark report not found: {report_path}")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"V3 CPU resource benchmark report is unreadable: {exc}") from exc
    if not isinstance(report, dict):
        raise ValueError("V3 CPU resource benchmark report must be a JSON object")
    if artifact_metadata_path is None:
        raise ValueError("V3 CPU resource benchmark verified artifact metadata sidecar is required")
    metadata_path = Path(artifact_metadata_path).resolve()
    if not metadata_path.is_file():
        raise FileNotFoundError(f"V3 CPU resource benchmark artifact metadata not found: {metadata_path}")
    try:
        artifact_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"V3 CPU resource benchmark artifact metadata is unreadable: {exc}") from exc
    verify_resource_benchmark_report_binding(report, artifact_metadata)
    if (
        isinstance(report.get("format_version"), bool)
        or report.get("format_version") != 1
        or report.get("status") != "measured"
    ):
        raise ValueError("V3 CPU resource benchmark must have format_version=1 and status=measured")
    if report.get("benchmark_kind") != (
        "cpu_v3_joint_loader_plus_per_family_diagnostics_and_joint_objective_without_optimizer_step"
    ):
        raise ValueError("V3 CPU resource benchmark kind is not the full five-family resource pass")
    if report.get("config_sha256") != config_fingerprint:
        raise ValueError("V3 CPU resource benchmark config fingerprint mismatch")
    if report.get("manifest_bundle_sha256") != manifest_sha256:
        raise ValueError("V3 CPU resource benchmark manifest bundle fingerprint mismatch")
    if report.get("train_manifest_sha256") != train_manifest_sha256:
        raise ValueError("V3 CPU resource benchmark train-manifest fingerprint mismatch")
    tokenizer = report.get("tokenizer")
    if not isinstance(tokenizer, dict) or tokenizer.get("tokenizer_sha256") != tokenizer_sha256:
        raise ValueError("V3 CPU resource benchmark tokenizer SHA-256 mismatch")

    cpu = report.get("cpu")
    if not isinstance(cpu, dict) or cpu.get("cuda_available") is not False:
        raise ValueError("V3 CPU resource benchmark must prove CUDA is unavailable")
    if cpu.get("threads") != threads:
        raise ValueError("V3 CPU resource benchmark thread count does not match the training request")
    updates = report.get("optimizer_updates")
    if isinstance(updates, bool) or not isinstance(updates, int) or updates != 0:
        raise ValueError("V3 CPU resource benchmark must contain zero optimizer updates")

    model_report = report.get("model_report")
    if (
        not isinstance(model_report, dict)
        or model_report.get("config_sha256") != config_fingerprint
        or model_report.get("trainable_parameters") != 39_906_568
    ):
        raise ValueError("V3 CPU resource benchmark model report does not match the exact V3 architecture")

    shape_distributions = report.get("shape_distributions")
    if not isinstance(shape_distributions, dict):
        raise ValueError("V3 CPU resource benchmark is missing media shape distributions")

    def require_dimension_distribution(name: str) -> int:
        distribution = shape_distributions.get(name)
        if not isinstance(distribution, dict):
            raise ValueError(f"V3 CPU resource benchmark is missing {name} dimension distribution")
        count = distribution.get("count")
        if isinstance(count, bool) or not isinstance(count, int) or count < 1:
            raise ValueError(f"V3 CPU resource benchmark {name} dimension distribution has no positive sample count")
        quantiles = [distribution.get(key) for key in ("min", "median", "p95", "max")]
        numeric_quantiles: list[float] = []
        for label, value in zip(("min", "median", "p95", "max"), quantiles):
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(float(value))
                or float(value) <= 0
            ):
                raise ValueError(
                    f"V3 CPU resource benchmark {name} dimension distribution has invalid positive {label}"
                )
            numeric = float(value)
            if not numeric.is_integer():
                raise ValueError(
                    f"V3 CPU resource benchmark {name} dimension distribution must contain integer pixel values"
                )
            numeric_quantiles.append(numeric)
        if numeric_quantiles != sorted(numeric_quantiles):
            raise ValueError(
                f"V3 CPU resource benchmark {name} dimension distribution quantiles are not ordered"
            )
        return count

    dimension_counts = {
        name: require_dimension_distribution(name)
        for name in ("image_width", "image_height", "video_width", "video_height")
    }
    if dimension_counts["image_width"] != dimension_counts["image_height"]:
        raise ValueError("V3 CPU resource benchmark image width/height dimension counts do not match")
    if dimension_counts["video_width"] != dimension_counts["video_height"]:
        raise ValueError("V3 CPU resource benchmark video width/height dimension counts do not match")

    gate = report.get("manifest_gate")
    if not isinstance(gate, dict) or gate.get("passed") is not True:
        raise ValueError("V3 CPU resource benchmark does not bind a passed external-only manifest gate")
    coverage = gate.get("coverage")
    minimums = {"train": 100, "validation": 10, "test": 10}
    families = ("text", "tool", "image", "audio", "video")
    for split, minimum in minimums.items():
        counts = coverage.get(split) if isinstance(coverage, dict) else None
        if not isinstance(counts, dict):
            raise ValueError(f"V3 CPU resource benchmark is missing {split} family coverage")
        for family in families:
            count = counts.get(family)
            if isinstance(count, bool) or not isinstance(count, int) or count < minimum:
                raise ValueError(
                    f"V3 CPU resource benchmark coverage is below quota: {split}/{family}"
                )

    benchmarks = report.get("benchmarks")
    if not isinstance(benchmarks, list) or any(
        not isinstance(item, dict) or item.get("status") != "success"
        for item in benchmarks
    ):
        raise ValueError("V3 CPU resource benchmark contains a failed or missing per-family case")
    benchmark_families = [item.get("family") for item in benchmarks]
    if (
        len(benchmark_families) != len(families)
        or len(set(benchmark_families)) != len(families)
        or set(benchmark_families) != set(families)
    ):
        raise ValueError("V3 CPU resource benchmark must contain exactly one successful case for each of the five families")

    joint = report.get("joint_training_memory")
    if not isinstance(joint, dict) or joint.get("status") != "success":
        raise ValueError("V3 CPU resource benchmark joint five-family memory case did not succeed")
    joint_updates = joint.get("optimizer_updates")
    if (
        isinstance(joint_updates, bool)
        or not isinstance(joint_updates, int)
        or joint_updates != 0
        or joint.get("optimizer_step_executed") is not False
        or joint.get("optimizer_state_allocated") is not True
        or joint.get("cpu_threads") != threads
    ):
        raise ValueError("V3 CPU resource benchmark joint case is not a zero-update CPU measurement")

    loader = report.get("data_loader_benchmark")
    if not isinstance(loader, dict) or loader.get("status") != "success":
        raise ValueError("V3 production data-loader resource benchmark did not succeed")
    if (
        loader.get("source_manifest_bundle_sha256") != manifest_sha256
        or loader.get("tokenizer_train_manifest_sha256") != train_manifest_sha256
        or loader.get("tokenizer_sha256") != tokenizer_sha256
    ):
        raise ValueError("V3 production data-loader benchmark is bound to different training inputs")
    loader_updates = loader.get("optimizer_updates")
    checkpoint_writes = loader.get("checkpoint_writes")
    if (
        loader.get("benchmark_manifest_view") is not True
        or loader.get("checkpointable") is not False
        or isinstance(loader_updates, bool)
        or not isinstance(loader_updates, int)
        or loader_updates != 0
        or isinstance(checkpoint_writes, bool)
        or not isinstance(checkpoint_writes, int)
        or checkpoint_writes != 0
        or loader.get("cpu_threads") != threads
    ):
        raise ValueError("V3 production data-loader benchmark is not an isolated zero-update measurement")

    def require_positive(value: Any, label: str) -> None:
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or float(value) <= 0
        ):
            raise ValueError(f"V3 CPU resource benchmark is missing positive measured {label}")

    # Confirm the production-loader sample itself met the quota, not only the
    # immutable source corpus gate.
    selection = loader.get("sample_selection")
    selection_coverage = selection.get("coverage") if isinstance(selection, dict) else None
    if not isinstance(selection_coverage, dict):
        raise ValueError("V3 production loader benchmark is missing its sample-selection coverage")
    for split, minimum in minimums.items():
        split_counts = selection_coverage.get(split)
        if not isinstance(split_counts, dict):
            raise ValueError(f"V3 production loader benchmark is missing selected {split} quotas")
        for family in families:
            counts = split_counts.get(family)
            if not isinstance(counts, dict):
                raise ValueError(f"V3 production loader benchmark is missing selected {split}/{family} counts")
            selected_rows = counts.get("selected_rows")
            eligible_rows = counts.get("eligible_external_rows_within_caps")
            if (
                isinstance(selected_rows, bool)
                or not isinstance(selected_rows, int)
                or selected_rows != minimum
                or isinstance(eligible_rows, bool)
                or not isinstance(eligible_rows, int)
                or eligible_rows < minimum
            ):
                raise ValueError(f"V3 production loader benchmark selected sample is below quota: {split}/{family}")

    # Aggregate joint throughput cannot replace per-family modality evidence.
    family_throughput = loader.get("family_throughput")
    if not isinstance(family_throughput, dict) or set(family_throughput) != set(families):
        raise ValueError("V3 production loader benchmark must report throughput for all five families")
    for family in families:
        rates = family_throughput.get(family)
        if not isinstance(rates, dict):
            raise ValueError(f"V3 production loader benchmark is missing {family} throughput")
        require_positive(rates.get("records_per_second"), f"{family} records per second")
        require_positive(rates.get("units_per_second"), f"{family} units per second")

    require_positive(joint.get("peak_rss_bytes"), "joint peak RSS")
    require_positive(joint.get("optimizer_state_bytes"), "AdamW state allocation")
    require_positive(loader.get("peak_rss_bytes"), "production loader peak RSS")
    require_positive(loader.get("joint_steps_per_second"), "production loader throughput")
    measured_steps = loader.get("measured_joint_steps")
    if isinstance(measured_steps, bool) or not isinstance(measured_steps, int) or measured_steps < 1:
        raise ValueError("V3 production loader benchmark must report a positive integer number of measured steps")

    memory = report.get("memory_accounting")
    if not isinstance(memory, dict):
        raise ValueError("V3 CPU resource benchmark is missing process-tree memory accounting")
    observed_peak = memory.get("observed_process_tree_peak_rss_bytes")
    conservative_bound = memory.get("conservative_process_tree_rss_upper_bound_bytes")
    require_positive(observed_peak, "process-tree peak RSS")
    require_positive(conservative_bound, "conservative process-tree RSS upper bound")
    if conservative_bound < observed_peak:
        raise ValueError("V3 conservative process-tree RSS upper bound is below the observed peak")
    return sha256_file(report_path)


def run_v3_training(
    *,
    manifest_paths: dict[str, str | Path],
    assets_root: str | Path,
    tokenizer_path: str | Path,
    output_dir: str | Path,
    steps: int,
    total_steps: int,
    warmup_steps: int,
    learning_rate: float,
    weight_decay: float,
    max_grad_norm: float,
    checkpoint_every: int,
    run_id: str,
    resource_evidence_path: str | Path,
    seed: int = 20261124,
    threads: int = 4,
    resume_checkpoint: str | Path | None = None,
    expected_parent_checkpoint_sha256: str | None = None,
    trusted_asset_hashes: dict[str, str] | None = None,
    asset_provider: Any | None = None,
) -> dict[str, Any]:
    """Train a requested bounded segment and atomically save resumable V3 state."""
    if isinstance(steps, bool) or not isinstance(steps, int) or steps < 1:
        raise ValueError("steps must be a positive integer")
    if isinstance(total_steps, bool) or not isinstance(total_steps, int) or total_steps < 1:
        raise ValueError("total_steps must be a positive integer")
    if isinstance(warmup_steps, bool) or not isinstance(warmup_steps, int) or not 0 <= warmup_steps < total_steps:
        raise ValueError("warmup_steps must be in [0, total_steps)")
    if not math.isfinite(learning_rate) or learning_rate <= 0:
        raise ValueError("learning_rate must be finite and positive")
    if not math.isfinite(weight_decay) or weight_decay < 0:
        raise ValueError("weight_decay must be finite and non-negative")
    if not math.isfinite(max_grad_norm) or max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be finite and positive")
    if isinstance(checkpoint_every, bool) or not isinstance(checkpoint_every, int) or checkpoint_every < 1:
        raise ValueError("checkpoint_every must be a positive integer")
    if isinstance(threads, bool) or not isinstance(threads, int) or threads < 1:
        raise ValueError("threads must be a positive integer")
    if not isinstance(run_id, str) or not run_id.strip():
        raise ValueError("run_id must be non-empty")
    if resume_checkpoint is None and expected_parent_checkpoint_sha256 is not None:
        raise ValueError("a parent checkpoint SHA is valid only when resuming")
    if expected_parent_checkpoint_sha256 is not None and (
        len(expected_parent_checkpoint_sha256) != 64
        or any(char not in "0123456789abcdef" for char in expected_parent_checkpoint_sha256)
    ):
        raise ValueError("expected_parent_checkpoint_sha256 must be a lowercase SHA-256")

    torch.set_num_threads(threads)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        pass
    _set_seed(seed)

    config = V3Config()
    output = Path(output_dir).resolve()
    tokenizer = Path(tokenizer_path).resolve()
    if not tokenizer.is_file():
        raise FileNotFoundError(f"V3 tokenizer JSON not found: {tokenizer}")
    tokenizer_bytes = tokenizer.read_bytes()

    with V3JointDataLoader(
        manifest_paths,
        assets_root,
        tokenizer,
        config=config,
        max_text_tokens=512,
        audio_window_seconds=5.0,
        video_window_frames=16,
        trusted_asset_hashes=trusted_asset_hashes,
        asset_provider=asset_provider,
    ) as loader:
        resource_evidence_sha256 = _validate_resource_evidence(
            resource_evidence_path,
            artifact_metadata_path=output / "resource-evidence-artifact.json",
            config_fingerprint=config.fingerprint,
            manifest_sha256=loader.manifest_sha256,
            train_manifest_sha256=loader.train_manifest_sha256,
            tokenizer_sha256=loader.tokenizer_sha256,
            threads=threads,
        )
        output.mkdir(parents=True, exist_ok=True)
        model: OneCoreV3 = config.build_model().cpu()
        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=learning_rate,
            betas=(0.9, 0.95),
            eps=1e-8,
            weight_decay=weight_decay,
        )
        scheduler = torch.optim.lr_scheduler.LambdaLR(
            optimizer,
            lr_lambda=lambda step: _learning_rate_multiplier(
                step, warmup_steps=warmup_steps, total_steps=total_steps
            ),
        )
        global_step = 0
        session = 1
        parent_sha = None
        if resume_checkpoint is not None:
            checkpoint_path = Path(resume_checkpoint).resolve()
            global_step, payload = load_v3_checkpoint(
                checkpoint_path,
                model,
                optimizer,
                scheduler,
                config,
                expected_manifest_sha256=loader.manifest_sha256,
                expected_parent_checkpoint_sha256=expected_parent_checkpoint_sha256,
                expected_tokenizer_sha256=loader.tokenizer_sha256,
                map_location="cpu",
            )
            loader.load_state_dict(payload["data_state"])
            saved_lineage = payload["lineage"]
            session = int(saved_lineage["session"]) + 1
            parent_sha = sha256_file(checkpoint_path)
        elif expected_parent_checkpoint_sha256 is not None:
            raise ValueError("fresh V3 training cannot declare a parent checkpoint")

        if global_step + steps > total_steps:
            raise ValueError(
                f"requested segment ends at {global_step + steps}, beyond total_steps={total_steps}"
            )
        if global_step >= total_steps:
            raise ValueError("checkpoint has already reached the configured training schedule")

        objective = OneCoreV3Objective(model)
        parameter_count = sum(
            parameter.numel() for parameter in model.parameters() if parameter.requires_grad
        )
        history: list[dict[str, float]] = []
        checkpoint_info: dict[str, Any] | None = None
        segment_start = global_step

        for step in range(segment_start + 1, segment_start + steps + 1):
            micro_batches = loader.next_joint_micro_batches()
            metrics = train_v3_joint_step(
                model,
                optimizer,
                micro_batches,
                objective=objective,
                max_grad_norm=max_grad_norm,
            )
            scheduler.step()
            global_step = step
            metrics["global_step"] = float(global_step)
            metrics["learning_rate"] = float(optimizer.param_groups[0]["lr"])
            history.append(metrics)

            if global_step % checkpoint_every == 0 or global_step == segment_start + steps:
                checkpoint_info = save_v3_checkpoint(
                    output / "checkpoint.pt",
                    model,
                    optimizer,
                    scheduler,
                    global_step,
                    config,
                    tokenizer_json=tokenizer_bytes,
                    manifest_sha256=loader.manifest_sha256,
                    data_state=loader.state_dict(),
                    lineage={
                        "run_id": run_id,
                        "session": session,
                        "parent_checkpoint_sha256": parent_sha,
                    },
                )
                parent_sha = checkpoint_info["sha256"]
                (output / "tokenizer.json").write_bytes(tokenizer_bytes)
                _atomic_json(output / "tokenizer.evidence.json", loader.tokenizer_evidence)
                report = {
                    "status": "training",
                    "architecture_family": "onecore-v3",
                    "architecture_version": config.architecture_version,
                    "config_sha256": config.fingerprint,
                    "resource_evidence_sha256": resource_evidence_sha256,
                    "parameter_count": parameter_count,
                    "optimizer_step": global_step,
                    "segment_start_step": segment_start,
                    "segment_updates": global_step - segment_start,
                    "total_steps": total_steps,
                    "warmup_steps": warmup_steps,
                    "learning_rate_base": learning_rate,
                    "weight_decay": weight_decay,
                    "max_grad_norm": max_grad_norm,
                    "optimizer": "AdamW",
                    "optimizer_betas": [0.9, 0.95],
                    "scheduler": "linear_warmup_cosine_decay_floor_0.1",
                    "checkpoint": checkpoint_info,
                    "tokenizer_sha256": loader.tokenizer_sha256,
                    "manifest_sha256": loader.manifest_sha256,
                    "train_manifest_sha256": loader.train_manifest_sha256,
                    "lineage": {
                        "run_id": run_id,
                        "session": session,
                        "parent_checkpoint_sha256": (
                            checkpoint_info["lineage"]["parent_checkpoint_sha256"]
                        ),
                    },
                    "data_state": loader.state_dict(),
                    "last_metrics": metrics,
                    "seed": seed,
                    "cpu_threads": threads,
                    "training_is_actual_optimizer_updates": True,
                    "quality_certified": False,
                }
                _atomic_json(output / "train_result.json", report)

        final = json.loads((output / "train_result.json").read_text(encoding="utf-8"))
        final["status"] = "completed_segment"
        final["segment_updates"] = global_step - segment_start
        final["metrics_history"] = history
        final["checkpoint"] = checkpoint_info
        _atomic_json(output / "train_result.json", final)
        return final


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run resumable five-family OneCore V3 CPU training")
    parser.add_argument("--train-manifest")
    parser.add_argument("--validation-manifest")
    parser.add_argument("--test-manifest")
    parser.add_argument("--assets-root", required=True)
    parser.add_argument("--conversion-report")
    parser.add_argument("--corpus-artifact-id", type=int)
    parser.add_argument("--github-repo", default="jonsnow-org/Lena9")
    parser.add_argument("--github-token", default=os.environ.get("GITHUB_TOKEN"))
    parser.add_argument("--manifest-output-dir")
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--steps", type=int, required=True)
    parser.add_argument("--total-steps", type=int, required=True)
    parser.add_argument("--warmup-steps", type=int, required=True)
    parser.add_argument("--learning-rate", type=float, required=True)
    parser.add_argument("--weight-decay", type=float, required=True)
    parser.add_argument("--max-grad-norm", type=float, default=1.0)
    parser.add_argument("--checkpoint-every", type=int, default=1)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--resource-evidence", required=True)
    parser.add_argument("--seed", type=int, default=20261124)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--resume-checkpoint")
    parser.add_argument("--expected-parent-checkpoint-sha256")
    args = parser.parse_args(argv)
    asset_provider = None
    trusted_asset_hashes = None
    manifest_paths = None
    if args.corpus_artifact_id is not None:
        if not args.conversion_report or not args.github_token:
            raise ValueError("remote V3 training requires --conversion-report and --github-token")
        if args.manifest_output_dir is None:
            raise ValueError("remote V3 training requires --manifest-output-dir")
        report = json.loads(Path(args.conversion_report).read_text(encoding="utf-8"))
        gate = report.get("manifest_gate")
        if not isinstance(gate, dict) or gate.get("passed") is not True:
            raise ValueError("pinned V3 conversion report does not prove manifest_gate.passed=true")
        coverage = gate.get("coverage") or {}
        for split in ("train", "validation", "test"):
            minimum = 100 if split == "train" else 10
            for family in ("text", "tool", "image", "audio", "video"):
                count = int((coverage.get(split) or {}).get(family, 0))
                if count < minimum:
                    raise ValueError(f"pinned V3 corpus coverage is below quota: {split}/{family}={count}")
        trusted_asset_hashes = gate.get("asset_hashes")
        if not isinstance(trusted_asset_hashes, dict) or not trusted_asset_hashes:
            raise ValueError("pinned V3 conversion report is missing its asset SHA-256 map")
        from .remote_assets import GitHubArtifactAssetProvider, extract_v3_manifest_bundle
        manifest_paths = extract_v3_manifest_bundle(
            args.github_repo, args.corpus_artifact_id, args.github_token, args.manifest_output_dir,
        )
        asset_provider = GitHubArtifactAssetProvider(
            args.github_repo, args.corpus_artifact_id, args.github_token, args.assets_root,
        )
    else:
        if not all((args.train_manifest, args.validation_manifest, args.test_manifest)):
            raise ValueError("local V3 training requires train, validation, and test manifests")
        manifest_paths = {
            "train": args.train_manifest,
            "validation": args.validation_manifest,
            "test": args.test_manifest,
        }

    try:
        result = run_v3_training(
            manifest_paths=manifest_paths,
            assets_root=args.assets_root,
            tokenizer_path=args.tokenizer,
            output_dir=args.output_dir,
            steps=args.steps,
            total_steps=args.total_steps,
            warmup_steps=args.warmup_steps,
            learning_rate=args.learning_rate,
            weight_decay=args.weight_decay,
            max_grad_norm=args.max_grad_norm,
            checkpoint_every=args.checkpoint_every,
            run_id=args.run_id,
            resource_evidence_path=args.resource_evidence,
            seed=args.seed,
            threads=args.threads,
            resume_checkpoint=args.resume_checkpoint,
            expected_parent_checkpoint_sha256=args.expected_parent_checkpoint_sha256,
            trusted_asset_hashes=trusted_asset_hashes,
            asset_provider=asset_provider,
        )
    finally:
        if asset_provider is not None:
            asset_provider.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
