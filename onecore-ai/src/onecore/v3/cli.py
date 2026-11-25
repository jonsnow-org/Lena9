"""CLI for selective V2-to-V3 corpus conversion."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Sequence

from onecore.v3.artifact import extract_v2_artifact_manifests
from onecore.v3.converter import convert_v2_corpus


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reuse V2 text/tool rows and restore only pinned raw media for OneCore V3."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--artifact-id", type=int, help="Existing GitHub Actions artifact ID.")
    source.add_argument("--v2-data-root", help="Directory containing train/validation/test JSONL.")
    parser.add_argument("--github-repo", default="jonsnow-org/Lena9")
    parser.add_argument("--github-token", default=os.environ.get("GITHUB_TOKEN", ""))
    parser.add_argument("--source-registry", required=True)
    parser.add_argument("--acquisition-report", help="Local acquisition-report.json for pinned revisions.")
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--report-output")
    parser.add_argument("--resume-progress", help="Previously uploaded V3 media progress JSONL.")
    parser.add_argument("--target-audio-rate", type=int, default=24_000)
    parser.add_argument("--minimum-train", type=int, default=100)
    parser.add_argument("--minimum-holdout", type=int, default=10)
    parser.add_argument("--max-scan-rows-per-source-split", type=int, default=10_000)
    parser.add_argument("--no-fill-missing-media", action="store_true")
    args = parser.parse_args(argv)

    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    source_revisions = None
    if args.artifact_id is not None:
        extracted = extract_v2_artifact_manifests(
            args.github_repo, args.artifact_id, args.github_token,
            output_root / "v2-artifact",
        )
        v2_data_root = Path(str(extracted["data_root"]))
        report_path = Path(str(extracted["files"]["acquisition-report.json"]))
        acquisition_report = json.loads(report_path.read_text(encoding="utf-8"))
        source_revisions = acquisition_report.get("source_revisions") or {}
    else:
        v2_data_root = Path(args.v2_data_root).resolve()
        if args.acquisition_report:
            acquisition_report = json.loads(
                Path(args.acquisition_report).read_text(encoding="utf-8")
            )
            source_revisions = acquisition_report.get("source_revisions") or {}

    report = convert_v2_corpus(
        v2_data_root,
        args.source_registry,
        output_root / "v3",
        target_audio_rate=args.target_audio_rate,
        minimum_train=args.minimum_train,
        minimum_holdout=args.minimum_holdout,
        source_revisions=source_revisions,
        fill_missing_media=not args.no_fill_missing_media,
        max_scan_rows_per_source_split=args.max_scan_rows_per_source_split,
        progress_path=args.resume_progress or (output_root / "v3" / "restore-progress.jsonl"),
    )
    report_output = Path(args.report_output) if args.report_output else output_root / "conversion-report.json"
    report_output.parent.mkdir(parents=True, exist_ok=True)
    report_output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(json.dumps({
        "report": str(report_output),
        "blocked": report.get("blocked"),
        "converted_records": report.get("converted_records"),
        "gate_passed": report.get("manifest_gate", {}).get("passed"),
        "coverage": report.get("manifest_gate", {}).get("coverage"),
        "missing_media_deficits": (
            report.get("missing_media_acquisition", {}).get("remaining_deficits")
            if report.get("missing_media_acquisition") else None
        ),
    }, ensure_ascii=False, indent=2))
    # A blocked gate is a completed audit result, not a reason to fabricate data.
    # The caller decides whether to publish the corpus artifact.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
