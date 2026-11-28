"""Stable data-row identity helpers used by OneCore's single corpus path."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import numpy as np
from PIL import Image

from onecore.data import is_immutable_source_revision


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


def nested_field(row: dict[str, Any], path: str) -> Any:
    value: Any = row
    for key in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def first_text_field(row: dict[str, Any], fields: list[str]) -> str:
    for field in fields:
        value = nested_field(row, field)
        if isinstance(value, list):
            value = next((item for item in value if isinstance(item, str) and item.strip()), "")
        if isinstance(value, str) and value.strip():
            return " ".join(value.split())
    return ""


def _identity_value(value: Any) -> Any:
    """Normalize media and nested records into stable identity material."""
    if isinstance(value, (bytes, bytearray, memoryview)):
        raw = bytes(value)
        return {"bytes_sha256": hashlib.sha256(raw).hexdigest(), "bytes_length": len(raw)}
    if isinstance(value, np.ndarray):
        contiguous = np.ascontiguousarray(value)
        return {
            "array_sha256": hashlib.sha256(contiguous.tobytes()).hexdigest(),
            "array_shape": list(contiguous.shape),
            "array_dtype": str(contiguous.dtype),
        }
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, Image.Image):
        image = value.convert("RGB")
        return {"image_sha256": hashlib.sha256(image.tobytes()).hexdigest(), "image_size": list(image.size)}
    if isinstance(value, dict):
        return {str(key): _identity_value(item) for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))}
    if isinstance(value, (list, tuple)):
        return [_identity_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def source_row_identity(row: dict[str, Any], source_id: str, index: int) -> str:
    """Hash the complete source row so reused dataset IDs cannot collide."""
    del index  # Kept in the signature for callers that also track stream offsets.
    primary = ""
    for key in (
        "id", "sample_id", "__key__", "blob_id", "content_id", "image_name",
        "filename", "file", "url", "path", "video_id", "videoid", "clip_id", "img_id",
    ):
        value = row.get(key)
        if value is not None and str(value).strip():
            primary = str(value).strip()
            break
    if not primary:
        metadata = row.get("metadata")
        if isinstance(metadata, dict):
            for key in ("id", "content_id", "blob_id", "filename", "path"):
                value = metadata.get(key)
                if value is not None and str(value).strip():
                    primary = str(value).strip()
                    break
    normalized = json.dumps(_identity_value(row), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"{primary or source_id}:{_stable_hash(normalized)}"


def resolve_pinned_video_asset(value: Any, source: dict[str, Any]) -> Any:
    """Resolve a relative video path from its immutable dataset revision."""
    if isinstance(value, dict):
        path = value.get("path")
        payload = value.get("bytes")
        if payload is not None or not isinstance(path, str) or not path.strip():
            return value
    elif isinstance(value, str):
        path = value
    else:
        return value
    path = path.strip()
    if path.startswith(("http://", "https://")) or Path(path).is_file():
        return value
    repo_id = str(source.get("repo") or "").strip()
    revision = str(source.get("_resolved_revision") or source.get("revision") or "").strip()
    if not repo_id or not is_immutable_source_revision(revision):
        raise ValueError("relative video paths require a repository and pinned immutable revision")
    if path.startswith("hf://"):
        prefix = f"hf://datasets/{repo_id}@{revision}/"
        if not path.startswith(prefix):
            raise ValueError("Hugging Face video URI repository or revision does not match the pinned source")
        path = path[len(prefix):]
    normalized = unquote(path.replace("\\", "/"))
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if not normalized or normalized.startswith("/") or "://" in normalized or ".." in Path(normalized).parts:
        raise ValueError("video dataset path is empty, absolute, or unsafe")
    try:
        from huggingface_hub import hf_hub_download
        local_path = hf_hub_download(
            repo_id=repo_id, filename=normalized, repo_type="dataset", revision=revision,
            token=os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN"),
        )
    except Exception as exc:
        raise ValueError(
            f"could not fetch video asset {normalized!r} from pinned dataset revision "
            f"({type(exc).__name__}: {str(exc)[:240]})"
        ) from exc
    return {"path": str(local_path), "bytes": None}
