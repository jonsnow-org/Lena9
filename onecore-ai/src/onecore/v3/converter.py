"""Selective V2-to-V3 corpus conversion with pinned-source media restoration.

Text/tool records are reused verbatim. Media derivatives from V2 are never
misrepresented as raw assets: their source rows are rehydrated from the exact
immutable source revision, and all native media is preserved before training
derivatives are created.
"""
from __future__ import annotations

import base64
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable, Iterable

import yaml
from datasets import load_dataset
from huggingface_hub import hf_hub_download

from onecore.acquire import _nested, _resolve_video_asset, _row_identity
from onecore.data import external_record_is_trainable, has_immutable_external_provenance
from .media_ingest import (
    preserve_audio_payload,
    preserve_image_payload,
    preserve_video_payload,
    resample_audio_source,
)

MEDIA_TASKS = {
    "image_caption": "image",
    "image_reconstruction": "image",
    "audio_text": "audio",
    "audio_reconstruction": "audio",
    "video_caption": "video",
    "video_reconstruction": "video",
}


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def _default_source_loader(repo: str, config: str | None, split: str, revision: str):
    kwargs: dict[str, Any] = {
        "path": repo, "split": split, "streaming": True, "revision": revision,
    }
    if config:
        kwargs["name"] = config
    return load_dataset(**kwargs)


def _safe_image_value(value: Any, source: dict[str, Any]) -> Any:
    if isinstance(value, str) and not value.startswith(("http://", "https://")):
        prefix = source.get("image_url_prefix")
        if prefix and value.strip():
            return str(prefix).rstrip("/") + "/" + Path(value).name
        if source.get("adapter") == "image_base64":
            encoded = value.split(",", 1)[1] if value.startswith("data:image/") and "," in value else value
            try:
                return {"bytes": base64.b64decode(encoded, validate=True)}
            except Exception as exc:
                raise ValueError("image_base64 source row contains invalid base64") from exc
    return value


def _video_value(row: dict[str, Any], source: dict[str, Any], revision: str) -> Any:
    field = str(source.get("video_field") or "video")
    value = _nested(row, field)
    adapter = str(source.get("adapter", ""))
    pinned_source = {**source, "_resolved_revision": revision}
    if adapter == "video":
        return _resolve_video_asset(value, pinned_source)
    if adapter == "video_url":
        aliases = source.get("video_url_fields") or [field, "video_url", "contentUrl", "url"]
        candidates = [value]
        candidates.extend(_nested(row, str(name)) for name in aliases)
        for candidate in candidates:
            if isinstance(candidate, dict):
                candidate = candidate.get("src") or candidate.get("path") or candidate.get("url")
            if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
                return candidate
        raise ValueError("pinned video row has no usable HTTP(S) media URL")
    if adapter == "video_repo_file":
        name = str(value or "").strip().replace("\\", "/")
        if not name or Path(name).suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm"}:
            id_field = str(source.get("video_id_field") or "video_id")
            video_id = row.get(id_field) or row.get("video_id") or row.get("id") or name
            if not video_id:
                raise ValueError("video repository row has no video filename or ID")
            name = str(video_id).strip().replace("\\", "/")
            if not name.lower().endswith((".mp4", ".mov", ".mkv", ".webm")):
                if not name.lower().startswith("video"):
                    name = f"video{name}"
                name = f"{name}.mp4"
        if "/" not in name:
            name = str(Path(str(source.get("video_directory") or "videos")) / name)
        normalized = name.lstrip("/")
        if not normalized or ".." in Path(normalized).parts:
            raise ValueError("video repository path is unsafe")
        local = hf_hub_download(
            repo_id=str(source["repo"]), filename=normalized, repo_type="dataset",
            revision=revision,
        )
        return {"path": local}
    return value


def _rehydrate_record(record: dict[str, Any], row: dict[str, Any],
                      source: dict[str, Any], assets_root: Path,
                      target_audio_rate: int) -> dict[str, Any]:
    task = str(record["task"])
    family = MEDIA_TASKS[task]
    result = {key: value for key, value in record.items() if not key.startswith("_")}
    for obsolete in ("image", "audio_features", "frames", "asset_content_group_ids"):
        result.pop(obsolete, None)
    record_id = str(record["id"])
    adapter = str(source.get("adapter", ""))

    if family == "image":
        value = _nested(row, str(source.get("image_field") or "image"))
        value = _safe_image_value(value, source)
        metadata = preserve_image_payload(value, assets_root, record_id)
        result["assets"] = {"image": metadata}
        return result

    if family == "audio":
        value = _nested(row, str(source.get("audio_field") or "audio"))
        raw = preserve_audio_payload(value, assets_root, record_id)
        raw_path = assets_root / raw["source_asset"]
        normalized = resample_audio_source(
            raw_path, assets_root, record_id, target_sample_rate=target_audio_rate
        )
        result["assets"] = {
            "audio": {
                "source_asset": raw["source_asset"],
                "training_asset": normalized["training_asset"],
                "sample_rate": raw["sample_rate"],
                "channels": raw["channels"],
                "samples": raw["samples"],
                "duration_seconds": raw["duration_seconds"],
                "training_sample_rate": normalized["training_sample_rate"],
                "training_channels": normalized.get("training_channels", raw["channels"]),
                "training_samples": normalized.get("training_samples", raw["samples"]),
                "resampled": normalized["resampled"],
                "resampler": normalized["resampler"],
                "resample_ratio": normalized.get("resample_ratio"),
            }
        }
        return result

    value = _video_value(row, source, str(record["source_revision"]))
    metadata = preserve_video_payload(value, assets_root, record_id)
    if metadata.get("frame_limit_applied") is not False:
        raise ValueError("video preservation must prove that no frame limit was applied")
    result["assets"] = {"video": metadata}
    return result


def restore_v2_media_records(
    records: Iterable[dict[str, Any]],
    sources_registry: str | Path,
    assets_root: str | Path,
    *,
    target_audio_rate: int = 24_000,
    source_loader: Callable[[str, str | None, str, str], Iterable[dict[str, Any]]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Reuse external text/tool rows and selectively restore only V2 media rows.

    The loader is injectable for deterministic tests. Production loading is
    streaming and always uses each record's immutable source_revision.
    Disabled sources are not fetched, and unmatched rows remain explicitly
    unresolved rather than being replaced with synthetic examples.
    """
    if target_audio_rate < 1:
        raise ValueError("target_audio_rate must be positive")
    registry = yaml.safe_load(Path(sources_registry).read_text(encoding="utf-8"))
    source_items = registry.get("sources", [])
    source_map = {str(item["id"]): item for item in source_items if item.get("id")}
    if len(source_map) != len(source_items):
        raise ValueError("source registry contains missing or duplicate source IDs")
    loader = source_loader or _default_source_loader
    root = Path(assets_root).resolve()
    root.mkdir(parents=True, exist_ok=True)

    converted: dict[str, dict[str, Any]] = {}
    input_records = 0
    pending: dict[tuple[str, str], dict[str, dict[str, Any]]] = defaultdict(dict)
    skipped: Counter[str] = Counter()
    errors: list[str] = []

    for item in records:
        input_records += 1
        record = {key: value for key, value in item.items() if not key.startswith("_")}
        record_id = str(record.get("id", "")).strip()
        if not record_id or record_id in converted:
            skipped["missing_or_duplicate_id"] += 1
            continue
        if not external_record_is_trainable(record) or not has_immutable_external_provenance(record):
            skipped["not_immutable_external"] += 1
            continue
        task = str(record.get("task", ""))
        if task in {"text", "tool_use"}:
            converted[record_id] = record
            continue
        if task not in MEDIA_TASKS:
            skipped["unsupported_task"] += 1
            continue
        source_id = str(record.get("source_id", ""))
        revision = str(record.get("source_revision", ""))
        source = source_map.get(source_id)
        if source is None:
            skipped["source_not_in_registry"] += 1
            continue
        if not bool(source.get("enabled", True)):
            skipped["source_disabled"] += 1
            continue
        if not revision or len(revision) not in (40, 64) or any(c not in "0123456789abcdef" for c in revision.lower()):
            skipped["source_revision_not_pinned"] += 1
            continue
        row_hash = str(record.get("source_row_id_sha256", "")).lower()
        if len(row_hash) != 64:
            skipped["invalid_source_row_hash"] += 1
            continue
        pending[(source_id, revision)][row_hash] = record

    for (source_id, revision), targets in pending.items():
        source = source_map[source_id]
        repo = str(source.get("repo", "")).strip()
        if not repo:
            skipped["source_repo_missing"] += len(targets)
            continue
        found: set[str] = set()
        splits = source.get("hf_splits") or ["train"]
        if isinstance(splits, str):
            splits = [splits]
        for hf_split in splits:
            try:
                stream = loader(repo, source.get("config"), str(hf_split), revision)
                for index, row in enumerate(stream):
                    if not isinstance(row, dict):
                        continue
                    row_id = _row_identity(row, source_id, index)
                    row_hash = _sha256_text(row_id)
                    if row_hash not in targets or row_hash in found:
                        continue
                    record = targets[row_hash]
                    try:
                        converted_record = _rehydrate_record(
                            record, row, source, root, target_audio_rate
                        )
                        converted[record["id"]] = converted_record
                        found.add(row_hash)
                    except Exception as exc:
                        errors.append(
                            f"{record['id']}: media restore failed "
                            f"({type(exc).__name__}: {str(exc)[:240]})"
                        )
                    if len(found) == len(targets):
                        break
            except Exception as exc:
                errors.append(
                    f"{source_id}/{hf_split}@{revision[:12]}: source stream failed "
                    f"({type(exc).__name__}: {str(exc)[:240]})"
                )
            if len(found) == len(targets):
                break
        missing = len(targets) - len(found)
        if missing:
            skipped["pinned_source_row_not_found"] += missing

    ordered = sorted(
        converted.values(),
        key=lambda row: (str(row.get("split", "")), str(row.get("id", ""))),
    )
    counts = {
        split: dict(Counter(str(row.get("task", "")) for row in ordered if row.get("split") == split))
        for split in ("train", "validation", "test")
    }
    report = {
        "input_records": input_records,
        "converted_records": len(ordered),
        "converted_by_split_and_task": counts,
        "skipped": dict(skipped),
        "errors": errors,
        "target_audio_rate": target_audio_rate,
        "source_restore_mode": "pinned_revision_streaming_row_hash_lookup",
        "synthetic_records_added": 0,
    }
    return ordered, report


def write_v3_manifests(records: Iterable[dict[str, Any]], output_root: str | Path) -> dict[str, str]:
    """Atomically write converted records to split-specific V3 JSONL manifests."""
    root = Path(output_root).resolve()
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    handles: dict[str, Any] = {}
    temporary: dict[str, Path] = {}
    destinations = {split: data_dir / f"{split}.jsonl" for split in ("train", "validation", "test")}
    try:
        import tempfile
        for split, destination in destinations.items():
            handle = tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=data_dir,
                prefix=f".{split}.", suffix=".tmp", delete=False,
            )
            handles[split] = handle
            temporary[split] = Path(handle.name)
        for record in records:
            split = str(record.get("split", ""))
            if split not in handles:
                raise ValueError(f"invalid split in converted V3 record: {split!r}")
            handles[split].write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        for handle in handles.values():
            handle.flush()
            import os
            os.fsync(handle.fileno())
            handle.close()
        for split, destination in destinations.items():
            temporary[split].replace(destination)
    except Exception:
        for handle in handles.values():
            if not handle.closed:
                handle.close()
        for path in temporary.values():
            path.unlink(missing_ok=True)
        raise
    return {split: str(path) for split, path in destinations.items()}
