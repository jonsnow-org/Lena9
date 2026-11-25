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
import os
import shutil
import tarfile
import tempfile
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode, urlparse
from urllib.request import Request, urlopen

import yaml
from datasets import Image as HFImage, load_dataset
from huggingface_hub import hf_hub_download

from onecore.acquire import _first_text, _nested, _resolve_video_asset, _row_identity
from onecore.crawlers import StatefulStreamCursor
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


_DATASET_VIEWER_ROWS_URL = "https://datasets-server.huggingface.co/rows"
_DATASET_VIEWER_PAGE_SIZE = 100


def _default_dataset_viewer_row_loader(
    repo: str, config: str, split: str, offset: int, length: int,
) -> dict[str, Any]:
    """Fetch one bounded slice from the official Hub Dataset Viewer rows API."""
    query = urlencode({
        "dataset": repo, "config": config, "split": split,
        "offset": int(offset), "length": min(int(length), _DATASET_VIEWER_PAGE_SIZE),
    })
    request = Request(
        f"{_DATASET_VIEWER_ROWS_URL}?{query}",
        headers={"User-Agent": "OneCore-v3-pinned-media-restore/1.0"},
    )
    with urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise RuntimeError("Hugging Face Dataset Viewer returned an invalid rows payload")
    return payload


def _find_media_source_url(value: Any) -> str | None:
    if isinstance(value, str):
        return value if value.startswith(("https://", "http://")) else None
    if isinstance(value, dict):
        for key in ("src", "url"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith(("https://", "http://")):
                return candidate
        for child in value.values():
            candidate = _find_media_source_url(child)
            if candidate:
                return candidate
    elif isinstance(value, (list, tuple)):
        for child in value:
            candidate = _find_media_source_url(child)
            if candidate:
                return candidate
    return None


def _row_primary_key(row: dict[str, Any]) -> tuple[str, str] | None:
    for key in (
        "id", "sample_id", "__key__", "blob_id", "content_id", "image_name",
        "filename", "file", "url", "path", "video_id", "videoid", "clip_id", "img_id",
    ):
        value = row.get(key)
        if value is None or not str(value).strip():
            continue
        normalized = str(value).strip()
        if key in {"file", "path"}:
            normalized = normalized.replace("\\", "/").rsplit("/", 1)[-1]
        return key, normalized
    return None


def _viewer_row_matches_source(
    source_row: dict[str, Any], viewer_row: dict[str, Any], media_field: str,
) -> bool:
    """Guard the row-index lookup with stable row identity where available."""
    source_key = _row_primary_key(source_row)
    viewer_key = _row_primary_key(viewer_row)
    if source_key is not None or viewer_key is not None:
        return source_key == viewer_key
    source_rest = {key: value for key, value in source_row.items() if key != media_field}
    viewer_rest = {key: value for key, value in viewer_row.items() if key != media_field}
    return json.dumps(source_rest, ensure_ascii=False, sort_keys=True, default=str) == json.dumps(
        viewer_rest, ensure_ascii=False, sort_keys=True, default=str
    )


def _validate_pinned_media_url(url: str, revision: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not (
        host == "huggingface.co" or host.endswith(".huggingface.co")
    ):
        raise ValueError("Dataset Viewer media URL must use HTTPS on a Hugging Face host")
    path = unquote(parsed.path)
    if f"/--/{revision}/--/" not in path and f"/resolve/{revision}/" not in path:
        raise ValueError("Dataset Viewer media URL does not match the pinned source revision")
    return url




_DATASET_VIEWER_FILTER_URL = "https://datasets-server.huggingface.co/filter"


def _default_dataset_viewer_filter_loader(
    repo: str, config: str, split: str, where: str,
) -> dict[str, Any]:
    """Fetch an exact stable-key row through the Hub's indexed Dataset Viewer filter."""
    query = urlencode({
        "dataset": repo, "config": config, "split": split,
        "where": where, "offset": 0, "length": 10,
    })
    request = Request(
        f"{_DATASET_VIEWER_FILTER_URL}?{query}",
        headers={"User-Agent": "OneCore-v3-pinned-media-restore/1.0"},
    )
    # The indexed Dataset Viewer endpoint occasionally returns transient 5xx/429
    # responses for otherwise valid exact-key lookups. Retry only transient transport
    # failures; never turn a 404/invalid query into a false match.
    for attempt in range(5):
        try:
            with urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as exc:
            if exc.code not in {408, 425, 429, 500, 502, 503, 504} or attempt == 4:
                raise
            exc.close()
            time.sleep(min(2 ** attempt, 8))
        except URLError:
            if attempt == 4:
                raise
            time.sleep(min(2 ** attempt, 8))
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise RuntimeError("Hugging Face Dataset Viewer filter returned an invalid rows payload")
    return payload


def _filter_candidates(source_row: dict[str, Any], family: str, source: dict[str, Any]) -> list[tuple[str, str]]:
    """Find stable scalar keys usable for an exact media-row filter."""
    candidates: list[tuple[str, str]] = []
    for key in ("id", "sample_id", "file", "filename", "path", "url", "video_id", "clip_id"):
        value = source_row.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append((key, value.strip()))
    field_name = str(source.get(f"{family}_field") or {
        "image": "image", "audio": "audio", "video": "video",
    }[family])
    media_value = _nested(source_row, field_name)
    if isinstance(media_value, dict):
        for key in ("path", "src", "url"):
            value = media_value.get(key)
            if isinstance(value, str) and value.strip():
                basename = Path(unquote(urlparse(value).path)).name
                if basename:
                    candidates.extend((("file", basename), ("path", basename), ("id", Path(basename).stem)))
    unique: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in candidates:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def _dataset_viewer_filter_media_value(
    source_row: dict[str, Any],
    source: dict[str, Any],
    family: str,
    revision: str,
    split: str,
    *,
    filter_row_loader: Callable[[str, str, str, str], dict[str, Any]] | None = None,
    filter_row_cache: dict[tuple[str, str, str, str, str], dict[str, Any] | None] | None = None,
) -> dict[str, str]:
    """Resolve media by stable key when offset-based Dataset Viewer rows are unavailable."""
    repo = str(source.get("repo") or "").strip()
    config = str(source.get("config") or "default")
    if not repo:
        raise ValueError("Dataset Viewer filter fallback requires a source repository")
    cache = filter_row_cache if filter_row_cache is not None else {}
    loader = filter_row_loader or _default_dataset_viewer_filter_loader
    errors: list[str] = []
    media_field = str(source.get(f"{family}_field") or {
        "image": "image", "audio": "audio", "video": "video",
    }[family])
    for field, value in _filter_candidates(source_row, family, source):
        cache_key = (repo, config, split, field, value)
        if cache_key not in cache:
            escaped = value.replace("'", "''")
            where = f'"{field}"=\'{escaped}\''
            try:
                payload = loader(repo, config, split, where)
                rows = payload.get("rows") if isinstance(payload, dict) else None
                if not isinstance(rows, list):
                    raise RuntimeError("filter response omitted rows")
                selected = None
                for item in rows:
                    candidate = item.get("row") if isinstance(item, dict) else None
                    if isinstance(candidate, dict) and str(candidate.get(field, "")).strip() == value:
                        selected = candidate
                        break
                cache[cache_key] = selected
            except Exception as exc:
                cache[cache_key] = None
                errors.append(f"{field} filter failed: {type(exc).__name__}: {str(exc)[:120]}")
        viewer_row = cache[cache_key]
        if not isinstance(viewer_row, dict):
            continue
        if str(viewer_row.get(field, "")).strip() != value:
            continue
        source_key = _row_primary_key(source_row)
        viewer_key = _row_primary_key(viewer_row)
        if source_key is not None and viewer_key is not None and source_key != viewer_key:
            continue
        media_url = _find_media_source_url(_nested(viewer_row, media_field))
        if media_url:
            return {"src": _validate_pinned_media_url(media_url, revision)}
    suffix = "; ".join(errors[:3])
    raise FileNotFoundError(
        f"Dataset Viewer filter could not resolve {family} row for {repo}/{config}/{split}"
        + (f" ({suffix})" if suffix else "")
    )


def _local_media_basename(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in ("path", "src", "url"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return Path(unquote(urlparse(candidate).path)).name
        return None
    if isinstance(value, str) and value.strip():
        return Path(unquote(urlparse(value).path)).name
    if isinstance(value, (list, tuple)):
        for item in value:
            candidate = _local_media_basename(item)
            if candidate:
                return candidate
    return None


def _dataset_viewer_media_value(
    source_row: dict[str, Any],
    source: dict[str, Any],
    family: str,
    revision: str,
    split: str,
    row_index: int | None,
    *,
    viewer_row_loader: Callable[[str, str, str, int, int], dict[str, Any]] | None = None,
    viewer_row_cache: dict[tuple[str, str, str, int], dict[int, dict[str, Any]]] | None = None,
    filter_row_loader: Callable[[str, str, str, str], dict[str, Any]] | None = None,
    filter_row_cache: dict[tuple[str, str, str, str, str], dict[str, Any] | None] | None = None,
) -> dict[str, str]:
    """Resolve media via exact pinned row offset, then indexed stable-key filtering."""
    repo = str(source.get("repo") or "").strip()
    config = str(source.get("config") or "default")
    if not repo:
        raise ValueError("pinned media fallback requires a source repository")
    page_error: Exception | None = None
    if row_index is not None and row_index >= 0:
        page_start = (int(row_index) // _DATASET_VIEWER_PAGE_SIZE) * _DATASET_VIEWER_PAGE_SIZE
        cache = viewer_row_cache if viewer_row_cache is not None else {}
        cache_key = (repo, config, split, page_start)
        try:
            if cache_key not in cache:
                loader = viewer_row_loader or _default_dataset_viewer_row_loader
                payload = loader(repo, config, split, page_start, _DATASET_VIEWER_PAGE_SIZE)
                rows = payload.get("rows") if isinstance(payload, dict) else None
                if not isinstance(rows, list):
                    raise RuntimeError("Dataset Viewer rows response omitted the row slice")
                page: dict[int, dict[str, Any]] = {}
                for item in rows:
                    if not isinstance(item, dict) or not isinstance(item.get("row"), dict):
                        continue
                    try:
                        page[int(item.get("row_idx", -1))] = item["row"]
                    except (TypeError, ValueError):
                        continue
                cache[cache_key] = page
            viewer_row = cache[cache_key].get(int(row_index))
            if viewer_row is None:
                raise FileNotFoundError(
                    f"Dataset Viewer did not return row {row_index} for {repo}/{config}/{split}"
                )
            media_field = str(source.get(f"{family}_field") or {
                "image": "image", "audio": "audio", "video": "video",
            }[family])
            if not _viewer_row_matches_source(source_row, viewer_row, media_field):
                raise ValueError("Dataset Viewer row identity does not match the pinned streaming source row")
            media_url = _find_media_source_url(_nested(viewer_row, media_field))
            if not media_url:
                raise ValueError(f"Dataset Viewer row {row_index} has no usable {family} media URL")
            return {"src": _validate_pinned_media_url(media_url, revision)}
        except Exception as exc:
            page_error = exc
    try:
        return _dataset_viewer_filter_media_value(
            source_row, source, family, revision, split,
            filter_row_loader=filter_row_loader, filter_row_cache=filter_row_cache,
        )
    except Exception as filter_error:
        if page_error is not None:
            raise RuntimeError(
                f"Dataset Viewer rows fallback failed ({type(page_error).__name__}: "
                f"{str(page_error)[:140]}); filter fallback failed "
                f"({type(filter_error).__name__}: {str(filter_error)[:140]})"
            ) from filter_error
        raise


def _has_nonempty_media_payload(value: dict[str, Any]) -> bool:
    """Return whether a media mapping has usable bytes, arrays, frames or URL.

    Hugging Face decode(False) may provide both a stale local path and a
    payload field. A non-None but empty bytes value is not usable, and the
    preserve helpers prefer path over bytes. Check payload length rather
    than presence so stale paths cannot mask a recoverable source.
    """
    raw = value.get("bytes")
    if isinstance(raw, (bytes, bytearray, memoryview)) and len(raw) > 0:
        return True
    for key in ("array", "frames"):
        payload = value.get(key)
        if payload is None:
            continue
        try:
            if len(payload) > 0:
                return True
        except TypeError:
            return True
    return bool(_find_media_source_url(value))


def _prefer_available_media_payload(value: Any) -> Any:
    """Drop an unavailable local path when another real payload is present."""
    if not isinstance(value, dict):
        return value
    path = value.get("path")
    if (
        isinstance(path, str)
        and path.strip()
        and not path.startswith(("https://", "http://"))
        and not Path(path).is_file()
        and _has_nonempty_media_payload(value)
    ):
        usable = dict(value)
        usable.pop("path", None)
        return usable
    return value


def _needs_dataset_viewer_fallback(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, dict):
        path = value.get("path")
        if isinstance(path, str) and path.strip():
            if path.startswith(("https://", "http://")):
                return False
            if Path(path).is_file():
                return False
            return True
        return not _has_nonempty_media_payload(value)
    if isinstance(value, str):
        return not (
            value.startswith(("https://", "http://")) or Path(value).is_file()
        )
    if isinstance(value, (list, tuple)):
        return len(value) == 0
    return False


def _enable_v2_image_identity_decoding(stream: Any, source: dict[str, Any]) -> Any:
    """Reproduce V2's decoded-PIL image row identity before hashing source rows.

    V2 acquisition left Hugging Face Image columns decoded as PIL images while
    explicitly disabling automatic Audio/Video decoding. V3 disables all media
    decoding for safe raw-payload ingestion. Hashing an Image(decode=False)
    path dictionary therefore cannot match the immutable V2 row hash. Re-enable
    only the Image feature so row identity is byte-for-byte compatible; audio
    and video remain undecoded and under the explicit V3 ingest path.
    """
    if str(source.get("adapter", "")) != "image":
        return stream
    field = str(source.get("image_field") or "image")
    features = getattr(stream, "features", None)
    feature = features.get(field) if hasattr(features, "get") else None
    if feature is None or feature.__class__.__name__ != "Image":
        return stream
    if bool(getattr(feature, "decode", True)):
        return stream
    cast_column = getattr(stream, "cast_column", None)
    if not callable(cast_column):
        raise RuntimeError(
            f"pinned image source exposes Image(decode=False) for {field!r} "
            "but does not support cast_column; cannot reproduce V2 source-row hashes"
        )
    try:
        return cast_column(field, HFImage(decode=True))
    except Exception as exc:
        raise RuntimeError(
            f"could not enable V2-compatible Image decoding for {field!r}: "
            f"{type(exc).__name__}: {str(exc)[:200]}"
        ) from exc


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


def _rehydrate_record(
    record: dict[str, Any],
    row: dict[str, Any],
    source: dict[str, Any],
    assets_root: Path,
    target_audio_rate: int,
    *,
    source_row_index: int | None = None,
    source_hf_split: str | None = None,
    viewer_row_loader: Callable[[str, str, str, int, int], dict[str, Any]] | None = None,
    viewer_row_cache: dict[tuple[str, str, str, int], dict[int, dict[str, Any]]] | None = None,
    filter_row_loader: Callable[[str, str, str, str], dict[str, Any]] | None = None,
    filter_row_cache: dict[tuple[str, str, str, str, str], dict[str, Any] | None] | None = None,
    media_value_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    task = str(record["task"])
    family = MEDIA_TASKS[task]
    result = {key: value for key, value in record.items() if not key.startswith("_")}
    for obsolete in ("image", "audio_features", "frames", "asset_content_group_ids"):
        result.pop(obsolete, None)
    record_id = str(record["id"])
    source_split = str(source_hf_split or record.get("source_hf_split") or record.get("split") or "")
    if source_row_index is not None:
        result["source_hf_row_index"] = int(source_row_index)
    if source_split:
        result["source_hf_split"] = source_split
    used_dataset_viewer = False

    def viewer_value(media_family: str) -> dict[str, str]:
        nonlocal used_dataset_viewer
        value = _dataset_viewer_media_value(
            row, source, media_family, str(record["source_revision"]), source_split,
            source_row_index, viewer_row_loader=viewer_row_loader,
            viewer_row_cache=viewer_row_cache,
            filter_row_loader=filter_row_loader,
            filter_row_cache=filter_row_cache,
        )
        used_dataset_viewer = True
        return value

    if family == "image":
        value = (media_value_overrides or {}).get("image", _nested(row, str(source.get("image_field") or "image")))
        value = _safe_image_value(value, source)
        value = _prefer_available_media_payload(value)
        if _needs_dataset_viewer_fallback(value):
            value = viewer_value("image")
        try:
            metadata = preserve_image_payload(value, assets_root, record_id)
        except Exception:
            if used_dataset_viewer:
                raise
            value = viewer_value("image")
            metadata = preserve_image_payload(value, assets_root, record_id)
        result["assets"] = {"image": metadata}

    elif family == "audio":
        value = (media_value_overrides or {}).get("audio", _nested(row, str(source.get("audio_field") or "audio")))
        if isinstance(value, (list, tuple)):
            media_url = _find_media_source_url(value)
            if media_url:
                value = {"src": media_url}
            else:
                value = next((item for item in value if isinstance(item, dict) and _has_nonempty_media_payload(item)), value)
        value = _prefer_available_media_payload(value)
        if _needs_dataset_viewer_fallback(value):
            value = viewer_value("audio")
        try:
            raw = preserve_audio_payload(value, assets_root, record_id)
        except Exception:
            if used_dataset_viewer:
                raise
            value = viewer_value("audio")
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

    else:
        try:
            value = _video_value(row, source, str(record["source_revision"]))
        except Exception:
            value = viewer_value("video")
        else:
            value = _prefer_available_media_payload(value)
            if _needs_dataset_viewer_fallback(value):
                value = viewer_value("video")
        try:
            metadata = preserve_video_payload(value, assets_root, record_id)
        except Exception:
            if used_dataset_viewer:
                raise
            value = viewer_value("video")
            metadata = preserve_video_payload(value, assets_root, record_id)
        if metadata.get("frame_limit_applied") is not False:
            raise ValueError("video preservation must prove that no frame limit was applied")
        result["assets"] = {"video": metadata}

    if used_dataset_viewer:
        result["source_media_locator"] = {
            "provider": "huggingface-datasets-server",
            "config": str(source.get("config") or "default"),
            "split": source_split,
            "row_index": source_row_index,
            "revision": str(record["source_revision"]),
        }
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




def _progress_asset_paths(record: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    def visit(value: Any, key: str = "") -> None:
        if key in {"source_asset", "training_asset", "asset_path"} and isinstance(value, str):
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
    return list(dict.fromkeys(paths))


def _load_restore_progress(progress_path: Path | None, assets_root: Path) -> dict[str, dict[str, Any]]:
    """Load only restored rows with every referenced raw and derived asset intact."""
    if progress_path is None or not progress_path.is_file():
        return {}
    restored: dict[str, dict[str, Any]] = {}
    with progress_path.open("r", encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue
            record_id = str(record.get("id", "")).strip()
            asset_paths = _progress_asset_paths(record)
            if not record_id or not asset_paths:
                continue
            valid = True
            for relative in asset_paths:
                target = (assets_root / relative).resolve()
                try:
                    target.relative_to(assets_root.resolve())
                except ValueError:
                    valid = False
                    break
                if not target.is_file() or target.stat().st_size == 0:
                    valid = False
                    break
            if valid:
                restored[record_id] = record
    return restored


def _append_restore_progress(progress_path: Path | None, record: dict[str, Any]) -> None:
    if progress_path is None:
        return
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    with progress_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def _extract_fleurs_audio_for_rows(
    matched_rows: list[tuple[str, dict[str, Any], dict[str, Any], int]],
    source: dict[str, Any],
    source_split: str,
    revision: str,
    assets_root: Path,
) -> tuple[dict[str, Path], Path]:
    """Extract only the WAVs matched to pinned FLEURS rows from the exact split tarball."""
    archive_split = {"train": "train", "validation": "dev", "test": "test"}.get(source_split)
    if archive_split is None:
        raise ValueError(f"unsupported FLEURS audio split for tar fallback: {source_split}")
    config = str(source.get("config") or "ar_eg")
    repo = str(source.get("repo") or "google/fleurs")
    archive_name = f"data/{config}/audio/{archive_split}.tar.gz"
    archive_path = Path(hf_hub_download(
        repo_id=repo, filename=archive_name, repo_type="dataset", revision=revision,
    ))
    field = str(source.get("audio_field") or "audio")
    wanted: dict[str, list[str]] = defaultdict(list)
    for _row_hash, record, row, _index in matched_rows:
        basename = _local_media_basename(_nested(row, field))
        if basename and basename.lower().endswith(".wav"):
            wanted[basename].append(str(record["id"]))
    if not wanted:
        raise FileNotFoundError("matched FLEURS rows do not expose WAV basenames")
    assets_root.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix="onecore-fleurs-tar-", dir=str(assets_root.parent)))
    extracted: dict[str, Path] = {}
    remaining = set(wanted)
    with tarfile.open(archive_path, mode="r|gz") as archive:
        for member in archive:
            if not member.isfile():
                continue
            basename = Path(member.name).name
            if basename not in remaining:
                continue
            source_file = archive.extractfile(member)
            if source_file is None:
                continue
            payload = source_file.read()
            for record_id in wanted[basename]:
                safe_id = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in record_id)
                destination = staging / f"{safe_id}.wav"
                destination.write_bytes(payload)
                extracted[record_id] = destination
            remaining.remove(basename)
            if not remaining:
                break
    return extracted, staging


def restore_v2_media_records(
    records: Iterable[dict[str, Any]],
    sources_registry: str | Path,
    assets_root: str | Path,
    *,
    target_audio_rate: int = 24_000,
    source_loader: Callable[[str, str | None, str, str], Iterable[dict[str, Any]]] | None = None,
    viewer_row_loader: Callable[[str, str, str, int, int], dict[str, Any]] | None = None,
    filter_row_loader: Callable[[str, str, str, str], dict[str, Any]] | None = None,
    progress_path: str | Path | None = None,
    max_scan_rows_per_source_split: int = 10_000,
    cursor_root: str | Path | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Reuse external text/tool rows and selectively restore only V2 media rows.

    The loader is injectable for deterministic tests. Production loading is
    streaming and always uses each record's immutable source_revision.
    Disabled sources are not fetched, and unmatched rows remain explicitly
    unresolved rather than being replaced with synthetic examples.
    """
    if target_audio_rate < 1:
        raise ValueError("target_audio_rate must be positive")
    if max_scan_rows_per_source_split < 1:
        raise ValueError("max_scan_rows_per_source_split must be positive")
    registry = yaml.safe_load(Path(sources_registry).read_text(encoding="utf-8"))
    source_items = registry.get("sources", [])
    source_map = {str(item["id"]): item for item in source_items if item.get("id")}
    if len(source_map) != len(source_items):
        raise ValueError("source registry contains missing or duplicate source IDs")
    loader = source_loader or _default_source_loader
    root = Path(assets_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    cursor_project_root = (
        Path(cursor_root).resolve() if cursor_root is not None else root.parent
    )

    progress_file = Path(progress_path).resolve() if progress_path is not None else None
    converted: dict[str, dict[str, Any]] = _load_restore_progress(progress_file, root)
    resumed_record_ids = set(converted)
    resumed_media_records = 0
    seen_input_ids: set[str] = set()
    input_records = 0
    pending: dict[tuple[str, str, str], dict[str, dict[str, Any]]] = defaultdict(dict)
    skipped: Counter[str] = Counter()
    errors: list[str] = []
    viewer_row_cache: dict[tuple[str, str, str, int], dict[int, dict[str, Any]]] = {}
    filter_row_cache: dict[tuple[str, str, str, str, str], dict[str, Any] | None] = {}
    deferred_source_splits: list[dict[str, Any]] = []
    source_scan_checkpoints: list[dict[str, Any]] = []

    for item in records:
        input_records += 1
        record = {key: value for key, value in item.items() if not key.startswith("_")}
        record_id = str(record.get("id", "")).strip()
        if not record_id or record_id in seen_input_ids:
            skipped["missing_or_duplicate_id"] += 1
            errors.append("input V2 row has a missing or duplicate record ID")
            continue
        seen_input_ids.add(record_id)
        if record_id in converted:
            prior = converted[record_id]
            same_lineage = all(
                str(prior.get(key, "")) == str(record.get(key, ""))
                for key in ("source_id", "source_revision", "source_row_id_sha256", "source_url", "data_class", "task", "split")
            )
            if record_id in resumed_record_ids and same_lineage:
                resumed_media_records += 1
                continue
            skipped["missing_or_duplicate_id"] += 1
            errors.append(f"{record_id}: duplicate ID or progress lineage mismatch")
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

    for group_index, ((source_id, revision, hf_split), targets) in enumerate(pending.items(), 1):
        source = source_map[source_id]
        repo = str(source.get("repo", "")).strip()
        if not repo:
            skipped["source_repo_missing"] += len(targets)
            continue
        found: set[str] = {
            row_hash for row_hash, record in targets.items()
            if str(record.get("id", "")) in converted
        }
        if len(found) == len(targets):
            print(
                f"[onecore-v3] resume skip {source_id}/{hf_split}: "
                f"{len(found)} of {len(targets)} media rows already restored",
                flush=True,
            )
            continue
        source_splits = (source.get("hf_splits") or ["train"]) if hf_split == "*" else [hf_split]
        if isinstance(source_splits, str):
            source_splits = [source_splits]
        print(
            f"[onecore-v3] source {group_index}/{len(pending)} {source_id}/{hf_split}: "
            f"targets={len(targets)} resumed={len(found)}",
            flush=True,
        )
        source_deferred = False
        all_source_splits_exhausted = True
        for source_split in source_splits:
            matched_rows: list[tuple[str, dict[str, Any], dict[str, Any], int]] = []
            scan_started_at = time.monotonic()
            rows_scanned = 0
            scan_stop_reason = "stream_exhausted"
            cursor_namespace = (
                "v3-corpus-restore-image-v2-identity"
                if str(source.get("adapter", "")) == "image"
                else "v3-corpus-restore"
            )
            cursor = StatefulStreamCursor(
                cursor_project_root, cursor_namespace, source_id, repo,
                str(source.get("config") or ""), str(source_split), revision,
            )
            try:
                stream = loader(repo, source.get("config"), str(source_split), revision)
                stream = _enable_v2_image_identity_decoding(stream, source)
                stream, start_offset, cursor_mode = cursor.restore(stream, 0)
                print(
                    f"[onecore-v3] source {group_index}/{len(pending)} {source_id}/{source_split}: "
                    f"targets={len(targets)} resumed={len(found)} cursor={cursor_mode} start={start_offset}",
                    flush=True,
                )
                for index, row in enumerate(stream, start=start_offset):
                    rows_scanned += 1
                    if rows_scanned % 1000 == 0:
                        print(
                            f"[onecore-v3] scan {source_id}/{source_split}: rows_this_run={rows_scanned} "
                            f"absolute_rows={index + 1} matched={len(matched_rows)} "
                            f"restored={len(found)}/{len(targets)}",
                            flush=True,
                        )
                    if isinstance(row, dict):
                        row_id = _row_identity(row, source_id, index)
                        row_hash = _sha256_text(row_id)
                        if row_hash in targets and row_hash not in found:
                            matched_rows.append((row_hash, targets[row_hash], row, index))
                            if len(found) + len(matched_rows) >= len(targets):
                                scan_stop_reason = "targets_found"
                                break
                    if rows_scanned >= max_scan_rows_per_source_split:
                        scan_stop_reason = "chunk_limit"
                        break

                fleurs_failures: list[tuple[str, dict[str, Any], dict[str, Any], int, str]] = []
                chunk_had_restore_error = False
                for row_hash, record, row, index in matched_rows:
                    if str(record.get("id", "")) in converted:
                        found.add(row_hash)
                        continue
                    try:
                        converted_record = _rehydrate_record(
                            record, row, source, root, target_audio_rate,
                            source_row_index=index, source_hf_split=str(source_split),
                            viewer_row_loader=viewer_row_loader, viewer_row_cache=viewer_row_cache,
                            filter_row_loader=filter_row_loader, filter_row_cache=filter_row_cache,
                        )
                        converted[record["id"]] = converted_record
                        found.add(row_hash)
                        _append_restore_progress(progress_file, converted_record)
                    except Exception as exc:
                        reason = f"{type(exc).__name__}: {str(exc)[:240]}"
                        if source_id == "fleurs_ar" and MEDIA_TASKS[str(record["task"])] == "audio":
                            fleurs_failures.append((row_hash, record, row, index, reason))
                        else:
                            errors.append(f"{record['id']}: media restore failed ({reason})")
                            chunk_had_restore_error = True

                if fleurs_failures:
                    staging: Path | None = None
                    try:
                        extracted, staging = _extract_fleurs_audio_for_rows(
                            [(h, r, row, idx) for h, r, row, idx, _reason in fleurs_failures],
                            source, str(source_split), revision, root,
                        )
                        for row_hash, record, row, index, previous_reason in fleurs_failures:
                            extracted_path = extracted.get(str(record["id"]))
                            if extracted_path is None:
                                errors.append(
                                    f"{record['id']}: FLEURS tar fallback missed matching WAV "
                                    f"(initial: {previous_reason})"
                                )
                                chunk_had_restore_error = True
                                continue
                            try:
                                converted_record = _rehydrate_record(
                                    record, row, source, root, target_audio_rate,
                                    source_row_index=index, source_hf_split=str(source_split),
                                    viewer_row_loader=viewer_row_loader, viewer_row_cache=viewer_row_cache,
                                    filter_row_loader=filter_row_loader, filter_row_cache=filter_row_cache,
                                    media_value_overrides={"audio": {"path": str(extracted_path)}},
                                )
                                converted[record["id"]] = converted_record
                                found.add(row_hash)
                                _append_restore_progress(progress_file, converted_record)
                            except Exception as exc:
                                errors.append(
                                    f"{record['id']}: FLEURS tar fallback failed "
                                    f"({type(exc).__name__}: {str(exc)[:240]}; initial: {previous_reason})"
                                )
                                chunk_had_restore_error = True
                    except Exception as exc:
                        errors.append(
                            f"{source_id}/{source_split}@{revision[:12]}: FLEURS tar fallback failed "
                            f"({type(exc).__name__}: {str(exc)[:240]})"
                        )
                        chunk_had_restore_error = True
                    finally:
                        if staging is not None:
                            shutil.rmtree(staging, ignore_errors=True)

                if chunk_had_restore_error:
                    source_deferred = True
                    all_source_splits_exhausted = False
                    source_scan_checkpoints.append({
                        "source_id": source_id, "split": str(source_split),
                        "rows_before": start_offset, "rows_scanned": rows_scanned,
                        "rows_total": start_offset, "cursor_mode": "previous_checkpoint_preserved",
                        "stop_reason": "restore_error_retry",
                        "elapsed_seconds": round(time.monotonic() - scan_started_at, 3),
                    })
                    break

                saved = cursor.save(stream, start_offset + rows_scanned)
                source_scan_checkpoints.append({
                    "source_id": source_id, "split": str(source_split),
                    "cursor_namespace": cursor_namespace,
                    "rows_before": start_offset, "rows_scanned": rows_scanned,
                    "rows_total": start_offset + rows_scanned, "cursor_mode": saved["cursor_mode"],
                    "stop_reason": scan_stop_reason,
                    "elapsed_seconds": round(time.monotonic() - scan_started_at, 3),
                })
                print(
                    f"[onecore-v3] source scan checkpoint {source_id}/{source_split}: "
                    f"rows_this_run={rows_scanned} matched={len(matched_rows)} "
                    f"restored={len(found)}/{len(targets)} stop={scan_stop_reason}",
                    flush=True,
                )
                if len(found) == len(targets):
                    break
                if scan_stop_reason == "chunk_limit":
                    source_deferred = True
                    all_source_splits_exhausted = False
                    break
            except Exception as exc:
                errors.append(
                    f"{source_id}/{source_split}@{revision[:12]}: source stream failed "
                    f"({type(exc).__name__}: {str(exc)[:240]})"
                )
                source_deferred = True
                all_source_splits_exhausted = False
                source_scan_checkpoints.append({
                    "source_id": source_id, "split": str(source_split),
                    "rows_before": 0, "rows_scanned": rows_scanned, "rows_total": 0,
                    "cursor_mode": "previous_checkpoint_preserved",
                    "stop_reason": "source_stream_error",
                    "elapsed_seconds": round(time.monotonic() - scan_started_at, 3),
                })
                break

        missing = len(targets) - len(found)
        print(
            f"[onecore-v3] source complete {source_id}/{hf_split}: "
            f"restored={len(found)}/{len(targets)} missing={missing} deferred={source_deferred}",
            flush=True,
        )
        if missing and source_deferred:
            deferred_source_splits.append({
                "source_id": source_id, "split": hf_split, "remaining_records": missing,
                "reason": "bounded_scan_or_retry_checkpoint",
            })
        elif missing and all_source_splits_exhausted:
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
        "source_restore_mode": "pinned_revision_streaming_v2_compatible_image_row_hash_lookup_with_resumable_stateful_cursors_and_indexed_filter_and_fleurs_tar_fallback",
        "deferred_source_splits": deferred_source_splits,
        "source_scan_checkpoints": source_scan_checkpoints,
        "max_scan_rows_per_source_split": max_scan_rows_per_source_split,
        "resumed_media_records": resumed_media_records,
        "restore_progress_path": str(progress_file) if progress_file is not None else None,
        "dataset_viewer_media_restored_records": sum(
            1 for row in ordered if isinstance(row.get("source_media_locator"), dict)
        ),
        "synthetic_records_added": 0,
        "blocked": bool(errors or deferred_source_splits or any(skipped.get(key, 0) for key in (
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
    viewer_row_loader: Callable[[str, str, str, int, int], dict[str, Any]] | None = None,
    source_revisions: dict[str, str] | None = None,
    fill_missing_media: bool = True,
    max_scan_rows_per_source_split: int = 10_000,
    filter_row_loader: Callable[[str, str, str, str], dict[str, Any]] | None = None,
    progress_path: str | Path | None = None,
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
        viewer_row_loader=viewer_row_loader,
        filter_row_loader=filter_row_loader,
        progress_path=progress_path or (destination / "restore-progress.jsonl"),
        max_scan_rows_per_source_split=max_scan_rows_per_source_split,
        cursor_root=destination,
    )
    manifest_paths = write_v3_manifests(converted, destination)
    gate = validate_v3_manifest(
        converted, assets_root,
        minimum_train=minimum_train, minimum_holdout=minimum_holdout,
    )
    restoration_incomplete = bool(report.get("blocked"))
    acquisition_incomplete = bool(acquisition_report and acquisition_report.get("blocked"))
    report.update({
        "manifest_paths": manifest_paths,
        "manifest_gate": gate,
        "missing_media_acquisition": acquisition_report,
        "restoration_incomplete": restoration_incomplete,
        "acquisition_incomplete": acquisition_incomplete,
        # The final external-only manifest gate controls corpus eligibility.
        # Extra legacy rows that cannot be rehydrated remain visible as warnings.
        "blocked": not bool(gate["passed"]),
    })
    return report
