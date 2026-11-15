from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ALLOWED_TASKS = {"text", "image_caption", "image_reconstruction", "audio_text", "audio_reconstruction", "video_caption", "video_reconstruction", "tool_use"}
REQUIRED_FIELDS = {"id", "task", "license", "source_url", "attribution", "split", "review_status"}


class DatasetError(ValueError):
    pass


ALLOWED_DATA_CLASSES = {
    "bootstrap", "synthetic_unverified", "synthetic_verified",
    "external_reviewed", "external_staged", "owner_curated", "unapproved",
}


def classify_record_data(record: dict[str, Any]) -> str:
    """Classify provenance; local synthetic and owner-created records are not imports.

    Only records imported from external datasets are eligible for optimizer and
    tokenizer input. Promotion is stricter and requires reviewed external data.
    """
    explicit = str(record.get("data_class", "")).strip().lower()
    if explicit:
        return explicit
    license_id = str(record.get("license", "")).strip().lower()
    source_url = str(record.get("source_url", "")).strip().lower()
    review_status = str(record.get("review_status", "")).strip().lower()
    if license_id == "local-owner-synthetic" and source_url == "local://onecore-bootstrap":
        return "bootstrap"
    if license_id == "local-owner-synthetic" and review_status == "verified":
        return "synthetic_verified"
    if license_id == "local-owner-synthetic":
        return "synthetic_unverified"
    if review_status == "approved" and source_url.startswith("local://owner-created"):
        return "owner_curated"
    if review_status == "approved":
        return "external_reviewed"
    return "unapproved"


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
        license_id = str(item["license"]).strip()
        if not license_id or license_id.lower() in {"unknown", "tbd", "none"}:
            errors.append(f"line {line}: explicit license is required")
        if not _valid_source(str(item["source_url"])):
            errors.append(f"line {line}: source_url must be http(s) or local://...")
        if not str(item["attribution"]).strip():
            errors.append(f"line {line}: attribution is required")
        review_status = str(item["review_status"]).strip().lower()
        if review_status not in {"approved", "generated", "verified", "pending"}:
            errors.append(f"line {line}: review_status must be approved, generated, verified, or pending")
        data_class = classify_record_data(item)
        if data_class not in ALLOWED_DATA_CLASSES:
            errors.append(f"line {line}: unsupported data_class {data_class!r}")
        elif data_class == "bootstrap":
            if license_id != "local-owner-synthetic" or str(item["source_url"]).strip() != "local://onecore-bootstrap" or review_status != "generated":
                errors.append(f"line {line}: bootstrap data must use the local bootstrap source, synthetic license, and generated status")
        elif data_class == "synthetic_unverified":
            if license_id != "local-owner-synthetic" or review_status != "generated":
                errors.append(f"line {line}: unverified synthetic data must use the synthetic license and generated status")
        elif data_class == "synthetic_verified":
            verification = item.get("verification")
            if license_id != "local-owner-synthetic" or review_status != "verified":
                errors.append(f"line {line}: verified synthetic data must use the synthetic license and verified status")
            if not isinstance(verification, dict) or not str(verification.get("method", "")).strip() or not str(verification.get("reference", "")).strip():
                errors.append(f"line {line}: verified synthetic data requires verification.method and verification.reference")
        elif data_class == "external_staged":
            if review_status != "pending" or license_id == "local-owner-synthetic":
                errors.append(f"line {line}: staged external records must preserve source metadata and pending status")
        elif data_class in {"external_reviewed", "owner_curated"}:
            if review_status != "approved" or license_id == "local-owner-synthetic":
                errors.append(f"line {line}: reviewed external/owner data must use approved status and a non-synthetic license")
        elif data_class == "unapproved":
            errors.append(f"line {line}: record lacks approved or verified provenance for its declared source")
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
    return {
        "valid": not errors,
        "records": len(records),
        "task_counts": task_counts,
        "errors": errors,
    }


TRAINABLE_DATA_CLASSES = {
    "external_staged", "external_reviewed",
}


def iter_training_records(
    records: list[dict[str, Any]],
    tasks: set[str] | None = None,
    allowed_data_classes: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Select authentic imported external records; deterministic synthetic Bootstrap is excluded."""
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
        raise DatasetError(f"data gate failed with {len(report['errors'])} error(s):\n{details}")
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
    for split, records in splits.items():
        for item in records:
            values: list[str] = []
            for field in ("image", "audio_features"):
                value = item.get(field)
                if isinstance(value, str) and value.strip():
                    values.append(value)
            frames = item.get("frames")
            if isinstance(frames, list):
                values.extend(value for value in frames if isinstance(value, str) and value.strip())
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
                content_hash_sets[split].add(digest.hexdigest())
    overlaps: dict[str, dict[str, int]] = {}
    errors: list[str] = []
    pairs = (("train", "validation"), ("train", "test"), ("validation", "test"))
    for left, right in pairs:
        shared_ids = id_sets[left] & id_sets[right]
        shared_paths = path_sets[left] & path_sets[right]
        shared_asset_content = content_hash_sets[left] & content_hash_sets[right]
        overlaps[f"{left}__{right}"] = {
            "record_ids": len(shared_ids),
            "asset_paths": len(shared_paths),
            "asset_content_hashes": len(shared_asset_content),
        }
        if shared_ids:
            errors.append(f"record ID leakage between {left} and {right}: {sorted(shared_ids)[:10]}")
        if shared_paths:
            errors.append(f"asset path leakage between {left} and {right}: {sorted(shared_paths)[:10]}")
        if shared_asset_content:
            errors.append(f"identical asset content leakage between {left} and {right}: {len(shared_asset_content)} hash(es)")
    if errors:
        raise DatasetError("split disjointness gate failed:\n- " + "\n- ".join(errors))
    return {
        "valid": True,
        "split_record_counts": {name: len(records) for name, records in splits.items()},
        "cross_split_overlaps": overlaps,
    }
