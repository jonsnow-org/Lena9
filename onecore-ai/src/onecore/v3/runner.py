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
    output.mkdir(parents=True, exist_ok=True)
    tokenizer = Path(tokenizer_path).resolve()
    if not tokenizer.is_file():
        raise FileNotFoundError(f"V3 tokenizer JSON not found: {tokenizer}")
    tokenizer_bytes = tokenizer.read_bytes()

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
