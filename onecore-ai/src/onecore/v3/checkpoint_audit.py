"""Artifact-backed V3 checkpoint continuity audit without optimizer updates."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import tempfile
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import torch

from .checkpoint import load_v3_checkpoint, save_v3_checkpoint
from .config import V3Config
from .dataset import V3JointDataLoader
from .remote_assets import GitHubArtifactAssetProvider, extract_v3_manifest_bundle
from .tokenizer import sha256_file, verify_v3_tokenizer
from .core import OneCoreV3


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _require_sha256(value: str, field: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(char not in "0123456789abcdef" for char in value)
    ):
        raise ValueError(f"{field} must be a lowercase SHA-256 digest")
    return value


def _assert_nested_equal(left: Any, right: Any, path: str = "state") -> None:
    if isinstance(left, torch.Tensor):
        if not isinstance(right, torch.Tensor) or not torch.equal(left, right):
            raise AssertionError(f"checkpoint round-trip tensor mismatch at {path}")
    elif isinstance(left, np.ndarray):
        if not isinstance(right, np.ndarray) or not np.array_equal(left, right):
            raise AssertionError(f"checkpoint round-trip array mismatch at {path}")
    elif isinstance(left, dict):
        if not isinstance(right, dict) or set(left) != set(right):
            raise AssertionError(f"checkpoint round-trip mapping mismatch at {path}")
        for key in left:
            _assert_nested_equal(left[key], right[key], f"{path}.{key}")
    elif isinstance(left, (list, tuple)):
        if type(left) is not type(right) or len(left) != len(right):
            raise AssertionError(f"checkpoint round-trip sequence mismatch at {path}")
        for index, (first, second) in enumerate(zip(left, right, strict=True)):
            _assert_nested_equal(first, second, f"{path}[{index}]")
    elif left != right:
        raise AssertionError(f"checkpoint round-trip value mismatch at {path}")


def _numpy_rng_equal(left: tuple[Any, ...], right: tuple[Any, ...]) -> bool:
    return (
        left[0] == right[0]
        and np.array_equal(left[1], right[1])
        and left[2:] == right[2:]
    )


def audit_checkpoint_round_trip(
    *,
    config: V3Config,
    tokenizer_json: bytes,
    manifest_sha256: str,
    data_state: Mapping[str, Any],
    output_directory: str | Path,
    run_id: str,
) -> dict[str, Any]:
    """Save/restore one bound V3 checkpoint at step zero; never call optimizer.step."""
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    if not isinstance(tokenizer_json, bytes):
        raise TypeError("tokenizer_json must be bytes")
    manifest_sha256 = _require_sha256(manifest_sha256, "manifest_sha256")
    if not isinstance(run_id, str) or not run_id.strip():
        raise ValueError("run_id must be non-empty")

    tokenizer_sha256 = _sha256_bytes(tokenizer_json)
    output = Path(output_directory).resolve()
    output.mkdir(parents=True, exist_ok=True)
    checkpoint_path = output / "checkpoint-audit-step-000000.pt"
    if checkpoint_path.exists():
        raise FileExistsError(f"refusing to overwrite checkpoint audit file: {checkpoint_path}")

    torch.set_num_threads(4)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        pass

    model: OneCoreV3 = config.build_model().cpu()
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=3e-4,
        betas=(0.9, 0.95),
        eps=1e-8,
        weight_decay=0.1,
    )
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.95)

    python_rng_before = random.getstate()
    numpy_rng_before = np.random.get_state()
    torch_rng_before = torch.get_rng_state().clone()

    saved = save_v3_checkpoint(
        checkpoint_path,
        model,
        optimizer,
        scheduler,
        0,
        config,
        tokenizer_json=tokenizer_json,
        manifest_sha256=manifest_sha256,
        data_state=data_state,
        lineage={
            "run_id": run_id,
            "session": 1,
            "parent_checkpoint_sha256": None,
        },
    )
    if saved["global_step"] != 0 or optimizer.state:
        raise AssertionError("step-zero checkpoint audit unexpectedly changed optimizer state")

    restored_model = config.build_model().cpu()
    restored_optimizer = torch.optim.AdamW(
        restored_model.parameters(),
        lr=3e-4,
        betas=(0.9, 0.95),
        eps=1e-8,
        weight_decay=0.1,
    )
    restored_scheduler = torch.optim.lr_scheduler.StepLR(
        restored_optimizer, step_size=1, gamma=0.95
    )

    # Deliberately perturb all RNGs; restore must put them back at the saved point.
    random.seed(9981)
    np.random.seed(9981)
    torch.manual_seed(9981)

    restored_step, payload = load_v3_checkpoint(
        checkpoint_path,
        restored_model,
        restored_optimizer,
        restored_scheduler,
        config,
        expected_manifest_sha256=manifest_sha256,
        expected_parent_checkpoint_sha256=None,
        expected_tokenizer_sha256=tokenizer_sha256,
        map_location="cpu",
    )
    if restored_step != 0:
        raise AssertionError(f"step-zero checkpoint restored at unexpected step {restored_step}")
    _assert_nested_equal(model.state_dict(), restored_model.state_dict(), "model")
    _assert_nested_equal(optimizer.state_dict(), restored_optimizer.state_dict(), "optimizer")
    _assert_nested_equal(scheduler.state_dict(), restored_scheduler.state_dict(), "scheduler")
    _assert_nested_equal(dict(data_state), payload["data_state"], "data_state")
    if random.getstate() != python_rng_before:
        raise AssertionError("Python RNG state was not restored exactly")
    if not _numpy_rng_equal(np.random.get_state(), numpy_rng_before):
        raise AssertionError("NumPy RNG state was not restored exactly")
    if not torch.equal(torch.get_rng_state(), torch_rng_before):
        raise AssertionError("Torch CPU RNG state was not restored exactly")

    checkpoint_sha256 = sha256_file(checkpoint_path)
    checkpoint_bytes = checkpoint_path.stat().st_size
    cursor_map = payload["data_state"].get("source_cursors", {})
    family_state = payload["data_state"].get("families", {})
    if set(family_state) != {"text", "tool", "image", "audio", "video"}:
        raise AssertionError("real V3 checkpoint is missing one or more family cursors")
    if any(int(value.get("rows_consumed", -1)) != 0 for value in family_state.values()):
        raise AssertionError("step-zero checkpoint contains advanced family cursors")

    checkpoint_path.unlink()
    return {
        "status": "passed",
        "audit_kind": "real_artifact_step_zero_checkpoint_save_restore",
        "architecture_family": "onecore-v3",
        "architecture_version": config.architecture_version,
        "config_sha256": config.fingerprint,
        "manifest_sha256": manifest_sha256,
        "tokenizer_sha256": tokenizer_sha256,
        "checkpoint_sha256": checkpoint_sha256,
        "checkpoint_bytes": checkpoint_bytes,
        "global_step": restored_step,
        "optimizer_updates": 0,
        "optimizer_state_entries": len(restored_optimizer.state),
        "scheduler_type": type(restored_scheduler).__name__,
        "source_cursor_count": len(cursor_map),
        "family_cursors": family_state,
        "python_numpy_torch_rng_restored": True,
        "model_optimizer_scheduler_restored": True,
        "parent_lineage": payload["lineage"],
        "checkpoint_file_retained": False,
        "quality_certified": False,
        "limitations": [
            "This audit binds the real immutable corpus manifests, asset SHA map and verified tokenizer, but starts at global_step=0.",
            "It performs no optimizer update and does not prove non-zero optimizer-state continuation after a real training step.",
            "The real five-family loader cursor state is captured before consuming any records; media bytes are not fetched by this audit.",
            "A post-first-update checkpoint audit remains required after the CPU resource gate permits the first bounded training segment.",
        ],
    }


def audit_real_artifacts(
    *,
    repository_full_name: str,
    corpus_artifact_id: int,
    github_token: str,
    tokenizer_path: str | Path,
    expected_tokenizer_sha256: str,
    conversion_report_path: str | Path,
    expected_conversion_report_sha256: str,
    output_path: str | Path,
    work_directory: str | Path,
    run_id: str,
) -> dict[str, Any]:
    token_path = Path(tokenizer_path).resolve()
    report_path = Path(conversion_report_path).resolve()
    if not token_path.is_file() or not Path(str(token_path) + ".evidence.json").is_file():
        raise FileNotFoundError("the pinned V3 tokenizer JSON and evidence sidecar are both required")
    expected_tokenizer_sha256 = _require_sha256(
        expected_tokenizer_sha256, "expected_tokenizer_sha256"
    )
    expected_conversion_report_sha256 = _require_sha256(
        expected_conversion_report_sha256, "expected_conversion_report_sha256"
    )
    if sha256_file(token_path) != expected_tokenizer_sha256:
        raise ValueError("pinned V3 tokenizer artifact SHA-256 mismatch")
    if sha256_file(report_path) != expected_conversion_report_sha256:
        raise ValueError("pinned V3 conversion report SHA-256 mismatch")

    conversion_report = json.loads(report_path.read_text(encoding="utf-8"))
    if not isinstance(conversion_report, dict):
        raise ValueError("V3 conversion report must be a JSON object")
    gate = conversion_report.get("manifest_gate")
    if not isinstance(gate, dict) or gate.get("passed") is not True:
        raise ValueError("pinned V3 conversion report does not prove the external-only manifest gate")
    asset_hashes = gate.get("asset_hashes")
    if not isinstance(asset_hashes, dict) or not asset_hashes:
        raise ValueError("pinned V3 conversion report is missing its asset SHA-256 map")
    for relative, digest in asset_hashes.items():
        if not isinstance(relative, str) or not relative or not isinstance(digest, str):
            raise ValueError("pinned V3 conversion report contains an invalid asset hash entry")
        _require_sha256(digest, f"asset hash for {relative}")

    config = V3Config()
    tokenizer_evidence = verify_v3_tokenizer(token_path, config=config)
    work = Path(work_directory).resolve()
    work.mkdir(parents=True, exist_ok=True)
    manifests_root = work / "manifests"
    assets_root = work / "assets"
    manifests_root.mkdir(parents=True, exist_ok=False)
    assets_root.mkdir(parents=True, exist_ok=False)

    manifests = extract_v3_manifest_bundle(
        repository_full_name,
        corpus_artifact_id,
        github_token,
        manifests_root,
    )
    provider = GitHubArtifactAssetProvider(
        repository_full_name,
        corpus_artifact_id,
        github_token,
        assets_root,
    )
    loader: V3JointDataLoader | None = None
    try:
        loader = V3JointDataLoader(
            manifests,
            assets_root,
            token_path,
            config=config,
            trusted_asset_hashes=asset_hashes,
            asset_provider=provider,
        )
        if loader.current_step != 0:
            raise AssertionError("new real-artifact loader did not start at cursor step zero")
        initial_data_state = loader.state_dict()
        result = audit_checkpoint_round_trip(
            config=config,
            tokenizer_json=token_path.read_bytes(),
            manifest_sha256=loader.manifest_sha256,
            data_state=initial_data_state,
            output_directory=work / "checkpoint",
            run_id=run_id,
        )
        restored_state = result["family_cursors"]
        if set(restored_state) != {"text", "tool", "image", "audio", "video"}:
            raise AssertionError("checkpoint audit omitted a family cursor")
        loader.load_state_dict(initial_data_state)
        if loader.state_dict() != initial_data_state:
            raise AssertionError("V3JointDataLoader cursor state changed during the checkpoint audit")
        result.update({
            "repository": repository_full_name,
            "corpus_artifact_id": corpus_artifact_id,
            "tokenizer_artifact_sha256": expected_tokenizer_sha256,
            "conversion_report_sha256": expected_conversion_report_sha256,
            "manifest_files": loader.fingerprint["manifest_files"],
            "accepted_external_records": gate.get("accepted_external_records"),
            "validated_media_asset_hashes": len(asset_hashes),
            "tokenizer_evidence": {
                "vocab_size": tokenizer_evidence["vocab_size_actual"],
                "external_train_text_records": tokenizer_evidence["external_train_text_records"],
                "validation_or_test_rows_used": tokenizer_evidence["validation_or_test_rows_used"],
                "v2_tokenizer_imported": tokenizer_evidence["v2_tokenizer_imported"],
            },
            "media_assets_downloaded": 0,
            "loader_cursor_round_trip": True,
        })
    finally:
        if loader is not None:
            loader.close()
        provider.close()

    destination = Path(output_path).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.partial")
    temporary.write_text(
        json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, destination)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit a real-artifact OneCore V3 step-zero checkpoint round-trip without training."
    )
    parser.add_argument("--repo", default="jonsnow-org/Lena9")
    parser.add_argument("--corpus-artifact-id", type=int, default=14892594659)
    parser.add_argument("--github-token", default=os.environ.get("GITHUB_TOKEN", ""))
    parser.add_argument("--tokenizer", required=True)
    parser.add_argument("--tokenizer-sha256", required=True)
    parser.add_argument("--conversion-report", required=True)
    parser.add_argument("--conversion-report-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--work-directory", required=True)
    parser.add_argument("--run-id", default=os.environ.get("GITHUB_RUN_ID", "manual-audit"))
    args = parser.parse_args(argv)
    if not args.github_token:
        parser.error("GITHUB_TOKEN is required to read pinned V3 artifacts")
    result = audit_real_artifacts(
        repository_full_name=args.repo,
        corpus_artifact_id=args.corpus_artifact_id,
        github_token=args.github_token,
        tokenizer_path=args.tokenizer,
        expected_tokenizer_sha256=args.tokenizer_sha256,
        conversion_report_path=args.conversion_report,
        expected_conversion_report_sha256=args.conversion_report_sha256,
        output_path=args.output,
        work_directory=args.work_directory,
        run_id=args.run_id,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
