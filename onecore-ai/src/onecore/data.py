from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ALLOWED_TASKS = {"text", "image_caption", "image_reconstruction", "audio_text", "audio_reconstruction", "video_caption", "video_reconstruction", "tool_use"}
REQUIRED_FIELDS = {"id", "task", "source_url", "split"}


class DatasetError(ValueError):
    pass


DATA_CLASSES = {"bootstrap", "synthetic", "external", "owner_curated", "other"}

_DATA_CLASS_ALIASES = {
    "synthetic_unverified": "synthetic",
    "synthetic_verified": "synthetic",
    "external_staged": "external",
    "external_reviewed": "external",
    "unapproved": "external",
}


def classify_record_data(record: dict[str, Any]) -> str:
    explicit = str(record.get("data_class", "")).strip().lower()
    if explicit in DATA_CLASSES:
        return explicit
    if explicit in _DATA_CLASS_ALIASES:
        return _DATA_CLASS_ALIASES[explicit]
    source_url = str(record.get("source_url", "")).strip().lower()
    if source_url == "local://onecore-bootstrap":
        return "bootstrap"
    if source_url.startswith("local://onecore-verified-curriculum"):
        return "synthetic"
    if source_url.startswith("local://owner-created"):
        return "owner_curated"
    if source_url.startswith(("http://", "https://")):
        return "external"
    return "other"


def is_immutable_source_revision(value: Any) -> bool:
    """Return whether a dataset revision is pinned to an immutable commit SHA."""
    return bool(re.fullmatch(r"[0-9a-f]{40,64}", str(value or "").strip().lower()))


def has_immutable_external_provenance(record: dict[str, Any]) -> bool:
    source_id = str(record.get("source_id", "")).strip()
    revision = str(record.get("source_revision", "")).strip().lower()
    row_hash = str(record.get("source_row_id_sha256", "")).strip().lower()
    return bool(source_id) and is_immutable_source_revision(revision) and bool(
        re.fullmatch(r"[0-9a-f]{64}", row_hash)
    )


def read_manifest(path: str | Path) -> list[dict[str, Any]]:
    manifest = Path(path)
    if not manifest.is_file():
        raise FileNotFoundError(f"training manifest not found: {manifest}")
    records: list[dict[str, Any]] = []
    for line_no, line in enumerate(manifest.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise DatasetError(f"{manifest}:{line_no}: invalid JSON: {exc}") from exc
        if not isinstance(item, dict):
            raise DatasetError(f"{manifest}:{line_no}: each JSONL row must be an object")
        item["_line"] = line_no
        records.append(item)
    return records


def _valid_source(value: str) -> bool:
    if value.startswith("local://"):
        return len(value) > len("local://")
    parsed = urlparse(value)
    return parsed.scheme in {"https", "http"} and bool(parsed.netloc)


def validate_manifest(records: list[dict[str, Any]], assets_root: str | Path,
                      expected_split: str = "train") -> dict[str, Any]:
    assets = Path(assets_root).resolve()
    errors: list[str] = []
    seen_ids: set[str] = set()
    task_counts: dict[str, int] = {}
    for index, item in enumerate(records, 1):
        line = item.get("_line", index)
        missing = REQUIRED_FIELDS - set(item)
        if missing:
            errors.append(f"line {line}: missing {sorted(missing)}")
            continue
        record_id = str(item["id"]).strip()
        if not record_id or record_id in seen_ids:
            errors.append(f"line {line}: empty or duplicate id {record_id!r}")
        seen_ids.add(record_id)
        task = str(item["task"])
        if task not in ALLOWED_TASKS:
            errors.append(f"line {line}: unsupported task {task!r}")
            continue
        task_counts[task] = task_counts.get(task, 0) + 1
        if str(item["split"]) != expected_split:
            errors.append(f"line {line}: split must be {expected_split!r}; got {item['split']!r}")
        if not _valid_source(str(item["source_url"])):
            errors.append(f"line {line}: source_url must be http(s) or local://...")
        if task == "text" and not str(item.get("text", "")).strip():
            errors.append(f"line {line}: text task requires non-empty text")
        if task == "tool_use" and not (item.get("prompt") and item.get("response")):
            errors.append(f"line {line}: tool_use requires prompt and response")
        asset_fields = {
            "image_caption": ["image"], "image_reconstruction": ["image"],
            "audio_text": ["audio_features"], "audio_reconstruction": ["audio_features"],
            "video_caption": ["frames"], "video_reconstruction": ["frames"],
        }.get(task, [])
        for field in asset_fields:
            value = item.get(field)
            paths = value if isinstance(value, list) else [value]
            if not paths or any(not isinstance(p, str) or not p.strip() for p in paths):
                errors.append(f"line {line}: task {task} requires {field}")
                continue
            for relative in paths:
                target = (assets / relative).resolve()
                if assets not in target.parents or not target.is_file():
                    errors.append(f"line {line}: asset is missing or escapes assets root: {relative}")
        if task in {"image_caption", "audio_text", "video_caption"} and not str(
            item.get("caption") or item.get("transcript") or ""
        ).strip():
            errors.append(f"line {line}: paired modality records require caption/transcript text")
    return {"valid": not errors, "records": len(records), "task_counts": task_counts, "errors": errors}


TRAINABLE_DATA_CLASSES = set(DATA_CLASSES)


def iter_training_records(
    records: list[dict[str, Any]],
    tasks: set[str] | None = None,
    allowed_data_classes: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Return every usable record in the training split across all data classes."""
    allowed_classes = TRAINABLE_DATA_CLASSES if allowed_data_classes is None else allowed_data_classes
    selected: list[dict[str, Any]] = []
    for item in records:
        if item.get("split") != "train":
            raise DatasetError("non-training split reached training iterator")
        if classify_record_data(item) not in allowed_classes:
            continue
        if tasks is None or item.get("task") in tasks:
            selected.append(item)
    return selected


def validate_training_data(project_root: str | Path) -> dict[str, Any]:
    root = Path(project_root)
    records = read_manifest(root / "data" / "train.jsonl")
    report = validate_manifest(records, root / "data" / "assets", expected_split="train")
    if not report["valid"]:
        details = "\n".join(report["errors"][:30])
        raise DatasetError(f"training data gate failed with {len(report['errors'])} error(s):\n{details}")
    if not records:
        raise DatasetError("training manifest is empty")
    return report


def validate_validation_data(project_root: str | Path) -> dict[str, Any]:
    root = Path(project_root)
    records = read_manifest(root / "data" / "validation.jsonl")
    report = validate_manifest(records, root / "data" / "assets", expected_split="validation")
    if not report["valid"]:
        details = "\n".join(report["errors"][:30])
        raise DatasetError(f"validation data gate failed with {len(report['errors'])} error(s):\n{details}")
    if not records:
        raise DatasetError("validation manifest is empty")
    return report


def validate_test_data(project_root: str | Path) -> dict[str, Any]:
    root = Path(project_root)
    records = read_manifest(root / "data" / "test.jsonl")
    report = validate_manifest(records, root / "data" / "assets", expected_split="test")
    if not report["valid"]:
        details = "\n".join(report["errors"][:30])
        raise DatasetError(f"test data gate failed with {len(report['errors'])} error(s):\n{details}")
    if not records:
        raise DatasetError("test manifest is empty")
    return report


def validate_split_disjointness(project_root: str | Path) -> dict[str, Any]:
    root = Path(project_root)
    assets_root = (root / "data" / "assets").resolve()
    splits = {name: read_manifest(root / "data" / f"{name}.jsonl") for name in ("train", "validation", "test")}
    id_sets = {name: {str(item.get("id", "")).strip() for item in records} for name, records in splits.items()}
    path_sets: dict[str, set[str]] = {name: set() for name in splits}
    content_hash_sets: dict[str, set[str]] = {name: set() for name in splits}
    content_details: dict[str, dict[str, list[str]]] = {name: {} for name in splits}
    group_sets: dict[str, set[str]] = {name: set() for name in splits}
    errors: list[str] = []
    for split, records in splits.items():
        for item in records:
            record_id = str(item.get("id", "")).strip()
            group_id = str(item.get("source_group_id", "")).strip()
            if group_id:
                group_sets[split].add(group_id)
            values: list[str] = []
            for field in ("image", "audio_features"):
                value = item.get(field)
                if isinstance(value, str) and value.strip():
                    values.append(value)
            frames = item.get("frames")
            if isinstance(frames, list):
                values.extend(value for value in frames if isinstance(value, str) and value.strip())
            actual_asset_groups: set[str] = set()
            for relative in values:
                target = (assets_root / relative).resolve()
                if assets_root not in target.parents:
                    raise DatasetError(f"asset path escapes data/assets root in {split}: {relative}")
                if not target.is_file():
                    raise DatasetError(f"asset is missing in {split}: {relative}")
                path_sets[split].add(relative)
                digest = hashlib.sha256()
                with target.open("rb") as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(chunk)
                sha = digest.hexdigest()
                content_hash_sets[split].add(sha)
                actual_asset_groups.add(f"asset-sha256:{sha}")
                content_details[split].setdefault(sha, []).append(f"{record_id}:{relative}")
            group_sets[split].update(actual_asset_groups)
            declared_groups = item.get("asset_content_group_ids")
            if isinstance(declared_groups, list):
                declared = {str(value).strip() for value in declared_groups if str(value).strip()}
                if declared != actual_asset_groups:
                    errors.append(
                        f"asset content group fingerprint mismatch for {record_id} in {split}: "
                        f"declared={sorted(declared)[:10]}, actual={sorted(actual_asset_groups)[:10]}"
                    )
    overlaps: dict[str, dict[str, int]] = {}
    pairs = (("train", "validation"), ("train", "test"), ("validation", "test"))
    for left, right in pairs:
        shared_ids = id_sets[left] & id_sets[right]
        shared_paths = path_sets[left] & path_sets[right]
        shared_asset_content = content_hash_sets[left] & content_hash_sets[right]
        shared_groups = group_sets[left] & group_sets[right]
        overlaps[f"{left}__{right}"] = {
            "record_ids": len(shared_ids),
            "asset_paths": len(shared_paths),
            "asset_content_hashes": len(shared_asset_content),
            "source_groups": len(shared_groups),
        }
        if shared_ids:
            errors.append(f"record ID leakage between {left} and {right}: {sorted(shared_ids)[:10]}")
        if shared_paths:
            errors.append(f"asset path leakage between {left} and {right}: {sorted(shared_paths)[:10]}")
        if shared_asset_content:
            samples = [
                {
                    "sha256_prefix": digest[:16],
                    f"{left}_records": content_details[left].get(digest, [])[:3],
                    f"{right}_records": content_details[right].get(digest, [])[:3],
                }
                for digest in sorted(shared_asset_content)[:5]
            ]
            errors.append(
                f"identical asset content leakage between {left} and {right}: "
                f"{len(shared_asset_content)} hash(es); samples={samples}"
            )
        if shared_groups:
            errors.append(f"source/media content group leakage between {left} and {right}: {sorted(shared_groups)[:10]}")
    if errors:
        raise DatasetError("split disjointness gate failed:\n- " + "\n- ".join(errors))
    return {
        "valid": True,
        "split_record_counts": {name: len(records) for name, records in splits.items()},
        "cross_split_overlaps": overlaps,
    }
