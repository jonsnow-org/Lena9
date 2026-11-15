from __future__ import annotations

import hashlib
import json
import re
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



COMMERCIAL_TRAINING_LICENSES = frozenset({
    "apache-2.0", "mit", "bsd-2-clause", "bsd-3-clause", "isc",
    "cc0-1.0", "cc-by-1.0", "cc-by-2.0", "cc-by-2.5", "cc-by-3.0", "cc-by-4.0",
    "cc-by-sa-1.0", "cc-by-sa-1.1", "cc-by-sa-2.0", "cc-by-sa-2.5", "cc-by-sa-3.0", "cc-by-sa-4.0",
    "odc-by-1.0", "public-domain", "unlicense",
})


def _canonical_license_token(value: str) -> str:
    token = str(value).strip().lower()
    token = re.sub(r"\\bapache\\s+license\\s*,?\\s*version\\s*2\\.0\\b", "apache-2.0", token)
    token = re.sub(r"\\bmit\\s+license\\b", "mit", token)
    token = re.sub(r"\\bbsd\\s+3[- ]clause\\s+new\\s+revised\\s+license\\b", "bsd-3-clause", token)
    token = re.sub(r"\\bbsd\\s+2[- ]clause\\s+simplified\\s+license\\b", "bsd-2-clause", token)
    token = token.replace("creative commons", "cc")
    token = token.replace("attribution-sharealike", "by-sa").replace("attribution sharealike", "by-sa")
    token = token.replace("attribution", "by").replace("sharealike", "sa")
    token = re.sub(r"\\b(?:license|licence|version|international)\\b", "", token)
    token = re.sub(r"[^a-z0-9.+-]+", "-", token).strip("-")
    aliases = {
        "cc0": "cc0-1.0", "odc-by": "odc-by-1.0",
        "apache-2": "apache-2.0", "apache-license-2.0": "apache-2.0",
        "mit-license": "mit", "isc-license": "isc",
        "bsd-3-clause-new-revised": "bsd-3-clause",
        "bsd-2-clause-simplified": "bsd-2-clause",
    }
    return aliases.get(token, token)


def license_is_trainable(value: Any) -> bool:
    """Return true only for explicit licenses permitting commercial training."""
    raw = str(value or "").strip().lower()
    if not raw or raw in {"unknown", "tbd", "none", "other", "dataset-card-terms",
                          "source-card-terms", "data-collective-terms",
                          "per-document-license-metadata"}:
        return False
    parts = re.split(r"\\s+(?:and|or)\\s+|[,;|/]", raw, flags=re.IGNORECASE)
    canonical = [_canonical_license_token(part) for part in parts if part.strip()]
    return bool(canonical) and all(item in COMMERCIAL_TRAINING_LICENSES for item in canonical)


def is_immutable_source_revision(value: Any) -> bool:
    """Require a pinned Git/Hugging Face commit SHA rather than a mutable branch/tag."""
    return bool(re.fullmatch(r"[0-9a-f]{40,64}", str(value or "").strip().lower()))


def has_immutable_external_provenance(record: dict[str, Any]) -> bool:
    source_id = str(record.get("source_id", "")).strip()
    revision = str(record.get("source_revision", "")).strip().lower()
    row_hash = str(record.get("source_row_id_sha256", "")).strip().lower()
    return bool(source_id) and is_immutable_source_revision(revision) and bool(
        re.fullmatch(r"[0-9a-f]{64}", row_hash)
    )


def external_record_is_trainable(record: dict[str, Any]) -> bool:
    """Defense-in-depth filter for optimizer/tokenizer/evaluation external records."""
    data_class = classify_record_data(record)
    return data_class in {"external_staged", "external_reviewed"} and license_is_trainable(
        record.get("license")
    ) and has_immutable_external_provenance(record)

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
        if data_class in {"external_staged", "external_reviewed"}:
            if not license_is_trainable(license_id):
                errors.append(f"line {line}: external license {license_id!r} is not approved for commercial training")
            if not has_immutable_external_provenance(item):
                errors.append(f"line {line}: external records require source_id, immutable source_revision SHA, and source_row_id_sha256")
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
        data_class = classify_record_data(item)
        if data_class not in allowed_classes:
            continue
        if data_class in {"external_staged", "external_reviewed"} and not external_record_is_trainable(item):
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
