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

from onecore.acquire import _first_text, _nested, _resolve_video_asset, _row_identity
from onecore.data import external_record_is_trainable, has_immutable_external_provenance, iter_manifest
from .manifest import validate_v3_manifest
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
    """Open a pinned streaming split without invoking TorchCodec media decoders.

    The converter needs original encoded bytes/paths, not in-memory decoded
    AudioDecoder or VideoDecoder objects. IterableDataset.decode(False) returns
    those source payloads and keeps decoding under OneCore's explicit ingest
    pipeline (soundfile/resample_poly for audio; imageio/FFmpeg for video).
    """
    kwargs: dict[str, Any] = {
        "path": repo, "split": split, "streaming": True, "revision": revision,
    }
    if config:
        kwargs["name"] = config
    stream = load_dataset(**kwargs)
    disable_decoding = getattr(stream, "decode", None)
    if not callable(disable_decoding):
        raise RuntimeError(
            "pinned Hugging Face source must be a streaming IterableDataset "
            "that supports decode(False); refusing an implicit TorchCodec decode"
        )
    return disable_decoding(False)


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



def _source_hf_split(record: dict[str, Any], source: dict[str, Any]) -> str:
    available = source.get("hf_splits") or ["train"]
    if isinstance(available, str):
        available = [available]
    explicit = str(record.get("source_hf_split", ""))
    if explicit in available:
        return explicit
    output_split = str(record.get("split", ""))
    if output_split in available:
        return output_split
    if "train" in available:
        return "train"
    return "*"


def acquire_missing_media_rows(
    records: Iterable[dict[str, Any]],
    sources_registry: str | Path,
    source_revisions: dict[str, str],
    *,
    minimum_train: int = 100,
    minimum_holdout: int = 10,
    source_loader: Callable[[str, str | None, str, str], Iterable[dict[str, Any]]] | None = None,
    max_scan_rows_per_source_split: int = 50_000,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Fill only deficient media-family/split quotas from pinned native source splits.

    Text/tool acquisition is never performed here. Sources must be enabled,
    pinned in the existing acquisition report, and available without a gated token.
    Only exact missing quotas are sampled; existing row identities are excluded.
    """
    if min(minimum_train, minimum_holdout, max_scan_rows_per_source_split) < 0:
        raise ValueError("quota and scan limits must be non-negative")
    registry = yaml.safe_load(Path(sources_registry).read_text(encoding="utf-8"))
    source_items = registry.get("sources", [])
    source_map = {str(item["id"]): item for item in source_items if item.get("id")}
    if len(source_map) != len(source_items):
        raise ValueError("source registry contains missing or duplicate source IDs")
    loader = source_loader or _default_source_loader
    output = [dict(item) for item in records]
    family_tasks = {
        "image": {"image_caption", "image_reconstruction"},
        "audio": {"audio_text", "audio_reconstruction"},
        "video": {"video_caption", "video_reconstruction"},
    }
    family_adapters = {
        "image": {"image", "image_url", "image_base64"},
        "audio": {"audio"},
        "video": {"video", "video_url", "video_repo_file"},
    }
    counts = {
        family: {
            split: sum(
                1 for row in output
                if row.get("split") == split
                and row.get("task") in tasks
                and external_record_is_trainable(row)
                and has_immutable_external_provenance(row)
            )
            for split in ("train", "validation", "test")
        }
        for family, tasks in family_tasks.items()
    }
    seen = {
        (str(row.get("source_id", "")), str(row.get("source_row_id_sha256", "")).lower())
        for row in output
        if external_record_is_trainable(row) and row.get("source_row_id_sha256")
    }
    report: dict[str, Any] = {
        "counts_before": counts,
        "added_by_family_split": {family: {split: 0 for split in ("train", "validation", "test")} for family in family_tasks},
        "sources_scanned": [],
        "skipped_sources": {},
        "errors": [],
        "synthetic_records_added": 0,
        "scan_limit_per_source_split": max_scan_rows_per_source_split,
    }

    for family, adapters in family_adapters.items():
        for split in ("train", "validation", "test"):
            minimum = minimum_train if split == "train" else minimum_holdout
            deficit = max(0, minimum - counts[family][split])
            if not deficit:
                continue
            for source in source_items:
                source_id = str(source.get("id", ""))
                adapter = str(source.get("adapter", ""))
                if adapter not in adapters or not source.get("enabled", True):
                    continue
                if source.get("requires_access"):
                    report["skipped_sources"][source_id] = "access-restricted source not auto-fetched"
                    continue
                hf_splits = source.get("hf_splits") or ["train"]
                if isinstance(hf_splits, str):
                    hf_splits = [hf_splits]
                if split not in hf_splits:
                    continue
                revision = str(source_revisions.get(source_id) or source.get("revision") or "")
                if len(revision) not in (40, 64) or any(ch not in "0123456789abcdef" for ch in revision.lower()):
                    report["skipped_sources"][source_id] = "no immutable revision in acquisition report"
                    continue
                repo = str(source.get("repo", "")).strip()
                if not repo:
                    report["skipped_sources"][source_id] = "missing repository identifier"
                    continue
                scanned = 0
                added = 0
                try:
                    stream = loader(repo, source.get("config"), split, revision)
                    for index, row in enumerate(stream):
                        scanned += 1
                        if scanned > max_scan_rows_per_source_split:
                            break
                        if not isinstance(row, dict):
                            continue
                        row_id = _row_identity(row, source_id, index)
                        row_hash = _sha256_text(row_id)
                        identity = (source_id, row_hash)
                        if identity in seen:
                            continue
                        if family == "image":
                            value = _nested(row, str(source.get("image_field") or "image"))
                        elif family == "audio":
                            value = _nested(row, str(source.get("audio_field") or "audio"))
                        else:
                            value = _nested(row, str(source.get("video_field") or "video"))
                        if value is None:
                            continue
                        text = _first_text(row, list(source.get("text_fields") or []))
                        task = {
                            "image": "image_caption" if text else "image_reconstruction",
                            "audio": "audio_text" if text else "audio_reconstruction",
                            "video": "video_caption" if text else "video_reconstruction",
                        }[family]
                        record_id = f"hf-{source_id}-{row_hash[:24]}"
                        record = {
                            "id": record_id,
                            "source_id": source_id,
                            "source_revision": revision,
                            "source_row_id_sha256": row_hash,
                            "source_url": str(source.get("url") or f"https://huggingface.co/datasets/{repo}"),
                            "source_hf_split": split,
                            "split": split,
                            "data_class": "external",
                            "task": task,
                        }
                        if family == "image" and text:
                            record["caption"] = text[:700]
                        elif family == "audio" and text:
                            record["transcript"] = text[:900]
                        elif family == "video" and text:
                            record["caption"] = text[:700]
                        output.append(record)
                        seen.add(identity)
                        added += 1
                        counts[family][split] += 1
                        report["added_by_family_split"][family][split] += 1
                        deficit -= 1
                        if deficit <= 0:
                            break
                except Exception as exc:
                    report["errors"].append(
                        f"{source_id}/{split}@{revision[:12]}: "
                        f"{type(exc).__name__}: {str(exc)[:240]}"
                    )
                report["sources_scanned"].append({
                    "source_id": source_id, "family": family, "split": split,
                    "revision": revision, "rows_scanned": min(scanned, max_scan_rows_per_source_split),
                    "records_added": added,
                })
                if deficit <= 0:
                    break
    report["counts_after"] = counts
    report["remaining_deficits"] = {
        family: {
            split: max(0, (minimum_train if split == "train" else minimum_holdout) - counts[family][split])
            for split in ("train", "validation", "test")
        }
        for family in family_tasks
    }
    report["blocked"] = bool(report["errors"]) or any(
        value > 0 for family in report["remaining_deficits"].values() for value in family.values()
    )
    return output, report


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
    pending: dict[tuple[str, str, str], dict[str, dict[str, Any]]] = defaultdict(dict)
    skipped: Counter[str] = Counter()
    errors: list[str] = []

    for item in records:
        input_records += 1
        record = {key: value for key, value in item.items() if not key.startswith("_")}
        record_id = str(record.get("id", "")).strip()
        if not record_id or record_id in converted:
            skipped["missing_or_duplicate_id"] += 1
            errors.append("input V2 row has a missing or duplicate record ID")
            continue
        if not external_record_is_trainable(record):
            skipped["not_external_data_class"] += 1
            continue
        if not has_immutable_external_provenance(record):
            skipped["not_immutable_external"] += 1
            errors.append(f"{record_id}: external V2 row lacks immutable provenance")
            continue
        task = str(record.get("task", ""))
        if task in {"text", "tool_use"}:
            converted[record_id] = record
            continue
        if task not in MEDIA_TASKS:
            skipped["unsupported_task"] += 1
            errors.append(f"{record_id}: unsupported V2 task {task!r}")
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
        allowed_adapters = {
            "image": {"image", "image_url", "image_base64"},
            "audio": {"audio"},
            "video": {"video", "video_url", "video_repo_file"},
        }
        if str(source.get("adapter", "")) not in allowed_adapters[MEDIA_TASKS[task]]:
            skipped["source_adapter_mismatch"] += 1
            continue
        if not revision or len(revision) not in (40, 64) or any(c not in "0123456789abcdef" for c in revision.lower()):
            skipped["source_revision_not_pinned"] += 1
            continue
        row_hash = str(record.get("source_row_id_sha256", "")).lower()
        if len(row_hash) != 64:
            skipped["invalid_source_row_hash"] += 1
            continue
        hf_split = _source_hf_split(record, source)
        available_splits = source.get("hf_splits") or ["train"]
        if isinstance(available_splits, str):
            available_splits = [available_splits]
        if hf_split != "*" and hf_split not in available_splits:
            skipped["source_split_not_available"] += 1
            errors.append(f"{record_id}: inferred source split {hf_split!r} is unavailable")
            continue
        record["source_hf_split"] = hf_split
        group = pending[(source_id, revision, hf_split)]
        if row_hash in group:
            skipped["duplicate_source_row_hash"] += 1
            errors.append(f"{record_id}: duplicate source row hash in the V2 manifests")
            continue
        group[row_hash] = record

    for (source_id, revision, hf_split), targets in pending.items():
        source = source_map[source_id]
        repo = str(source.get("repo", "")).strip()
        if not repo:
            skipped["source_repo_missing"] += len(targets)
            continue
        found: set[str] = set()
        source_splits = (source.get("hf_splits") or ["train"]) if hf_split == "*" else [hf_split]
        if isinstance(source_splits, str):
            source_splits = [source_splits]
        for source_split in source_splits:
            try:
                stream = loader(repo, source.get("config"), str(source_split), revision)
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
                    f"{source_id}/{source_split}@{revision[:12]}: source stream failed "
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
        "blocked": bool(errors or any(skipped.get(key, 0) for key in (
            "missing_or_duplicate_id", "source_not_in_registry", "source_disabled",
            "source_adapter_mismatch", "source_revision_not_pinned", "invalid_source_row_hash",
            "duplicate_source_row_hash", "source_repo_missing", "pinned_source_row_not_found",
        ))),
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



def convert_v2_corpus(
    v2_data_root: str | Path,
    sources_registry: str | Path,
    output_root: str | Path,
    *,
    target_audio_rate: int = 24_000,
    minimum_train: int = 100,
    minimum_holdout: int = 10,
    source_loader: Callable[[str, str | None, str, str], Iterable[dict[str, Any]]] | None = None,
    source_revisions: dict[str, str] | None = None,
    fill_missing_media: bool = True,
    max_scan_rows_per_source_split: int = 50_000,
) -> dict[str, Any]:
    """Convert existing V2 split manifests and run the complete V3 external gate.

    v2_data_root must contain train.jsonl, validation.jsonl and test.jsonl.
    The output is written to output_root/data/{split}.jsonl and its assets folder.
    A failed quota/provenance/asset gate is returned as blocked; it never starts
    training or invents records to fill missing modality families.
    """
    source_root = Path(v2_data_root).resolve()
    records: list[dict[str, Any]] = []
    for split in ("train", "validation", "test"):
        manifest = source_root / f"{split}.jsonl"
        if not manifest.is_file():
            raise FileNotFoundError(f"V2 {split} manifest not found: {manifest}")
        records.extend(iter_manifest(manifest))

    acquisition_report: dict[str, Any] | None = None
    if fill_missing_media and source_revisions is not None:
        records, acquisition_report = acquire_missing_media_rows(
            records, sources_registry, source_revisions,
            minimum_train=minimum_train, minimum_holdout=minimum_holdout,
            source_loader=source_loader,
            max_scan_rows_per_source_split=max_scan_rows_per_source_split,
        )
    destination = Path(output_root).resolve()
    assets_root = destination / "data" / "assets"
    converted, report = restore_v2_media_records(
        records, sources_registry, assets_root,
        target_audio_rate=target_audio_rate, source_loader=source_loader,
    )
    manifest_paths = write_v3_manifests(converted, destination)
    gate = validate_v3_manifest(
        converted, assets_root,
        minimum_train=minimum_train, minimum_holdout=minimum_holdout,
    )
    report.update({
        "manifest_paths": manifest_paths,
        "manifest_gate": gate,
        "missing_media_acquisition": acquisition_report,
        "blocked": bool(report.get("blocked")) or bool(acquisition_report and acquisition_report.get("blocked")) or not bool(gate["passed"]),
    })
    return report
