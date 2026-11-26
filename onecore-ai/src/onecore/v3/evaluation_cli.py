"""Run held-out V3 evaluation from one completed, hash-pinned training artifact."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from .dataset import V3JointDataLoader
from .evaluation import evaluate_v3_heldout_splits
from .inference import OneCoreV3Inference
from .remote_assets import GitHubArtifactAssetProvider, extract_v3_manifest_bundle
from .tokenizer import sha256_file, verify_v3_tokenizer


def _require_sha256(value: Any, field: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ValueError(f"{field} must be a lowercase SHA-256 digest")
    return value


def validate_completed_training_result(
    result: Any,
    checkpoint_path: str | Path,
    *,
    expected_training_run_id: str | None = None,
) -> dict[str, Any]:
    """Fail closed unless train_result proves an actual completed optimizer segment."""
    if not isinstance(result, dict):
        raise ValueError("OneCore V3 train_result must be a JSON object")
    if result.get("status") != "completed_segment":
        raise ValueError("held-out evaluation requires status=completed_segment")
    if result.get("architecture_family") != "onecore-v3":
        raise ValueError("training artifact is not an OneCore V3 checkpoint")
    if result.get("training_is_actual_optimizer_updates") is not True:
        raise ValueError("training artifact does not certify actual optimizer updates")
    step = result.get("optimizer_step")
    if isinstance(step, bool) or not isinstance(step, int) or step < 1:
        raise ValueError("held-out evaluation refuses a step-zero or non-integer checkpoint")
    checkpoint = result.get("checkpoint")
    if not isinstance(checkpoint, dict):
        raise ValueError("train_result is missing checkpoint metadata")
    expected_sha = _require_sha256(checkpoint.get("sha256"), "checkpoint.sha256")
    path = Path(checkpoint_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"trained V3 checkpoint not found: {path}")
    actual_sha = sha256_file(path)
    if actual_sha != expected_sha:
        raise ValueError("trained V3 checkpoint file SHA-256 differs from train_result")
    if checkpoint.get("global_step") not in (None, step):
        raise ValueError("train_result optimizer_step and checkpoint global_step differ")
    lineage = result.get("lineage")
    if not isinstance(lineage, dict) or not isinstance(lineage.get("run_id"), str):
        raise ValueError("train_result is missing its checkpoint run lineage")
    if expected_training_run_id is not None and lineage["run_id"] != str(expected_training_run_id):
        raise ValueError("train_result run lineage does not match the selected GitHub Actions run")
    _require_sha256(result.get("config_sha256"), "config_sha256")
    _require_sha256(result.get("manifest_sha256"), "manifest_sha256")
    _require_sha256(result.get("train_manifest_sha256"), "train_manifest_sha256")
    _require_sha256(result.get("tokenizer_sha256"), "tokenizer_sha256")
    _require_sha256(result.get("resource_evidence_sha256"), "resource_evidence_sha256")
    if result.get("training_is_actual_optimizer_updates") is not True:
        raise ValueError("training artifact does not certify optimizer updates")
    return {
        "checkpoint_sha256": actual_sha,
        "global_step": step,
        "training_run_id": lineage["run_id"],
        "config_sha256": result["config_sha256"],
        "manifest_sha256": result["manifest_sha256"],
        "train_manifest_sha256": result["train_manifest_sha256"],
        "tokenizer_sha256": result["tokenizer_sha256"],
        "resource_evidence_sha256": result["resource_evidence_sha256"],
        "lineage": lineage,
    }


def evaluate_completed_training_artifact(
    *,
    repository_full_name: str,
    expected_training_run_id: str,
    checkpoint_path: str | Path,
    train_result_path: str | Path,
    tokenizer_path: str | Path,
    conversion_report_path: str | Path,
    expected_conversion_report_sha256: str,
    corpus_artifact_id: int,
    github_token: str,
    per_family_records: int,
    output_path: str | Path,
    work_directory: str | Path,
) -> dict[str, Any]:
    checkpoint_file = Path(checkpoint_path).resolve()
    train_result_file = Path(train_result_path).resolve()
    tokenizer_file = Path(tokenizer_path).resolve()
    conversion_file = Path(conversion_report_path).resolve()
    for path, label in (
        (train_result_file, "train_result"),
        (tokenizer_file, "tokenizer"),
        (conversion_file, "conversion report"),
    ):
        if not path.is_file():
            raise FileNotFoundError(f"V3 {label} artifact is missing: {path}")

    training = json.loads(train_result_file.read_text(encoding="utf-8"))
    bound = validate_completed_training_result(
        training, checkpoint_file, expected_training_run_id=expected_training_run_id
    )
    if sha256_file(tokenizer_file) != bound["tokenizer_sha256"]:
        raise ValueError("training tokenizer file SHA-256 differs from train_result")
    config_digest = bound["config_sha256"]
    runtime = OneCoreV3Inference.from_checkpoint(
        checkpoint_file,
        expected_checkpoint_sha256=bound["checkpoint_sha256"],
        device="cpu",
    )
    if runtime.global_step != bound["global_step"]:
        raise ValueError("inference runtime step differs from completed training report")
    if runtime.config.fingerprint != config_digest:
        raise ValueError("inference runtime config differs from completed training report")
    if runtime.tokenizer_sha256 != bound["tokenizer_sha256"]:
        raise ValueError("inference checkpoint tokenizer differs from training tokenizer artifact")

    tokenizer_evidence = verify_v3_tokenizer(
        tokenizer_file,
        config=runtime.config,
        expected_train_manifest_sha256=bound["train_manifest_sha256"],
    )
    if tokenizer_evidence["tokenizer_sha256"] != runtime.tokenizer_sha256:
        raise ValueError("V3 tokenizer sidecar and checkpoint tokenizer bytes differ")

    expected_conversion_sha = _require_sha256(
        expected_conversion_report_sha256, "expected_conversion_report_sha256"
    )
    if sha256_file(conversion_file) != expected_conversion_sha:
        raise ValueError("pinned V3 conversion report SHA-256 mismatch")
    conversion = json.loads(conversion_file.read_text(encoding="utf-8"))
    gate = conversion.get("manifest_gate") if isinstance(conversion, dict) else None
    if not isinstance(gate, dict) or gate.get("passed") is not True:
        raise ValueError("pinned V3 conversion report does not prove the external-only gate")
    asset_hashes = gate.get("asset_hashes")
    if not isinstance(asset_hashes, dict) or not asset_hashes:
        raise ValueError("pinned V3 conversion report is missing the external asset hash map")
    for relative, digest in asset_hashes.items():
        if not isinstance(relative, str) or not relative:
            raise ValueError("pinned V3 conversion report contains an invalid asset path")
        _require_sha256(digest, f"asset hash for {relative}")

    work = Path(work_directory).resolve()
    work.mkdir(parents=True, exist_ok=False)
    manifests_root = work / "manifests"
    assets_root = work / "assets"
    manifests_root.mkdir()
    assets_root.mkdir()
    manifests = extract_v3_manifest_bundle(
        repository_full_name, corpus_artifact_id, github_token, manifests_root
    )
    provider = GitHubArtifactAssetProvider(
        repository_full_name, corpus_artifact_id, github_token, assets_root
    )
    loader: V3JointDataLoader | None = None
    try:
        loader = V3JointDataLoader(
            manifests,
            assets_root,
            tokenizer_file,
            config=runtime.config,
            max_text_tokens=512,
            audio_window_seconds=5.0,
            video_window_frames=16,
            trusted_asset_hashes=asset_hashes,
            asset_provider=provider,
        )
        if loader.manifest_sha256 != bound["manifest_sha256"]:
            raise ValueError("held-out evaluator manifest fingerprint differs from training checkpoint")
        if loader.train_manifest_sha256 != bound["train_manifest_sha256"]:
            raise ValueError("held-out evaluator train manifest differs from training checkpoint")
        report = evaluate_v3_heldout_splits(
            runtime,
            loader,
            per_family_records=per_family_records,
        )
        report.update({
            "training_run_id": bound["training_run_id"],
            "training_global_step": bound["global_step"],
            "resource_evidence_sha256": bound["resource_evidence_sha256"],
            "conversion_report_sha256": expected_conversion_sha,
            "conversion_report_run_id": 45325008221,
            "corpus_artifact_id": corpus_artifact_id,
            "accepted_external_records": gate.get("accepted_external_records"),
            "validated_media_asset_hashes": len(asset_hashes),
            "tokenizer_evidence": {
                "vocab_size": tokenizer_evidence["vocab_size_actual"],
                "external_train_text_records": tokenizer_evidence["external_train_text_records"],
                "validation_or_test_rows_used": tokenizer_evidence["validation_or_test_rows_used"],
                "v2_tokenizer_imported": tokenizer_evidence["v2_tokenizer_imported"],
            },
            "quality_certified": False,
            "optimizer_updates": 0,
        })
    finally:
        if loader is not None:
            loader.close()
        provider.close()

    output = Path(output_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f"refusing to overwrite V3 held-out evaluation report: {output}")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output.name}.", suffix=".partial", dir=output.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, sort_keys=True, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(output)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate a completed, hash-pinned V3 training artifact on external validation/test only."
    )
    parser.add_argument("--repo", default="jonsnow-org/Lena9")
    parser.add_argument("--training-run-id", required=True)
    parser.add_argument("--corpus-artifact-id", type=int, default=14892594659)
    parser.add_argument("--github-token", default=os.environ.get("GITHUB_TOKEN", ""))
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--train-result", required=True)
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--conversion-report", required=True)
    parser.add_argument(
        "--conversion-report-sha256",
        default="5976ad7f5e3149a31bd1da67308bf228cf0afb31ba970e00481dda04b1f73941",
    )
    parser.add_argument("--per-family-records", type=int, default=2)
    parser.add_argument("--output", required=True)
    parser.add_argument("--work-directory", required=True)
    args = parser.parse_args(argv)
    if not args.github_token:
        parser.error("GITHUB_TOKEN is required to read pinned corpus manifests and assets")
    result = evaluate_completed_training_artifact(
        repository_full_name=args.repo,
        expected_training_run_id=args.training_run_id,
        checkpoint_path=args.checkpoint,
        train_result_path=args.train_result,
        tokenizer_path=args.tokenizer,
        conversion_report_path=args.conversion_report,
        expected_conversion_report_sha256=args.conversion_report_sha256,
        corpus_artifact_id=args.corpus_artifact_id,
        github_token=args.github_token,
        per_family_records=args.per_family_records,
        output_path=args.output,
        work_directory=args.work_directory,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
