"""External-only V3 manifest validation with immutable provenance and asset hashing."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

from onecore.data import external_record_is_trainable, has_immutable_external_provenance

TASK_GROUPS = {
    "text": {"text"},
    "tool": {"tool_use"},
    "image": {"image_caption", "image_reconstruction"},
    "audio": {"audio_text", "audio_reconstruction"},
    "video": {"video_caption", "video_reconstruction"},
}
SPLITS = ("train", "validation", "test")


def _asset_paths(record: dict[str, Any]) -> list[str]:
    paths: list[str] = []

    def visit(value: Any, key: str = "") -> None:
        if key in {"source_asset", "asset_path"} and isinstance(value, str):
            paths.append(value)
        elif key == "frames" and isinstance(value, (list, tuple)):
            paths.extend(item for item in value if isinstance(item, str))
        elif isinstance(value, dict):
            for child_key, child in value.items():
                visit(child, str(child_key))
        elif isinstance(value, (list, tuple)):
            for child in value:
                visit(child)

    visit(record.get("assets", {}))
    visit({key: record[key] for key in ("source_asset", "frames", "asset_path") if key in record})
    return list(dict.fromkeys(paths))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_v3_manifest(records: Iterable[dict[str, Any]], assets_root: str | Path,
                          minimum_train: int = 100,
                          minimum_holdout: int = 10) -> dict[str, Any]:
    """Count only usable external records and reject split/asset leakage."""
    root = Path(assets_root).resolve()
    coverage = {split: {group: 0 for group in TASK_GROUPS} for split in SPLITS}
    errors: list[str] = []
    seen_ids: set[str] = set()
    source_splits: dict[str, str] = {}
    asset_splits: dict[str, str] = {}
    asset_hashes: dict[str, str] = {}
    accepted = 0

    for index, record in enumerate(records, 1):
        record_id = str(record.get("id", "")).strip()
        if not record_id:
            errors.append(f"record {index}: missing id")
            continue
        if record_id in seen_ids:
            errors.append(f"record {record_id}: duplicate id")
            continue
        seen_ids.add(record_id)
        if not external_record_is_trainable(record):
            continue
        split = str(record.get("split", ""))
        if split not in SPLITS:
            errors.append(f"record {record_id}: invalid split {split!r}")
            continue
        if not has_immutable_external_provenance(record):
            errors.append(f"record {record_id}: missing immutable external provenance")
            continue
        parsed = urlparse(str(record.get("source_url", "")).strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"record {record_id}: external source_url is invalid")
            continue
        source_row_hash = str(record["source_row_id_sha256"]).lower()
        previous_split = source_splits.get(source_row_hash)
        if previous_split is not None and previous_split != split:
            errors.append(f"record {record_id}: source row leaks across {previous_split}/{split}")
            continue

        task = str(record.get("task", ""))
        group = next((name for name, tasks in TASK_GROUPS.items() if task in tasks), None)
        if group is None:
            errors.append(f"record {record_id}: unsupported task {task!r}")
            continue
        paths = _asset_paths(record)
        if group in {"image", "audio", "video"} and not paths:
            errors.append(f"record {record_id}: {group} record lacks preserved raw assets")
            continue
        valid_assets = True
        for relative in paths:
            asset_path = (root / relative).resolve()
            try:
                asset_path.relative_to(root)
            except ValueError:
                errors.append(f"record {record_id}: asset escapes assets root: {relative}")
                valid_assets = False
                continue
            if not asset_path.is_file():
                errors.append(f"record {record_id}: missing asset {relative}")
                valid_assets = False
                continue
            digest = _sha256(asset_path)
            prior_split = asset_splits.get(digest)
            if prior_split is not None and prior_split != split:
                errors.append(f"record {record_id}: asset hash leaks across {prior_split}/{split}")
                valid_assets = False
                continue
            asset_splits[digest] = split
            asset_hashes[relative] = digest
        if not valid_assets:
            continue

        source_splits[source_row_hash] = split
        coverage[split][group] += 1
        accepted += 1

    for split in SPLITS:
        minimum = minimum_train if split == "train" else minimum_holdout
        for group, count in coverage[split].items():
            if count < minimum:
                errors.append(
                    f"{split}/{group}: {count} usable external records; minimum is {minimum}"
                )
    return {
        "passed": not errors,
        "accepted_external_records": accepted,
        "coverage": coverage,
        "unique_asset_hashes": len(set(asset_hashes.values())),
        "asset_hashes": asset_hashes,
        "errors": errors,
    }


def assert_v3_external_coverage(records: Iterable[dict[str, Any]], assets_root: str | Path,
                                minimum_train: int = 100,
                                minimum_holdout: int = 10) -> dict[str, Any]:
    report = validate_v3_manifest(records, assets_root, minimum_train, minimum_holdout)
    if not report["passed"]:
        raise RuntimeError(
            "OneCore v3 external media gate blocked training: "
            + json.dumps(report["errors"], ensure_ascii=False)
        )
    return report


def read_v3_manifest(path: str | Path):
    manifest = Path(path)
    with manifest.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{manifest}:{line_number}: invalid JSON: {exc}") from exc
            if not isinstance(record, dict):
                raise ValueError(f"{manifest}:{line_number}: expected a JSON object")
            yield record
