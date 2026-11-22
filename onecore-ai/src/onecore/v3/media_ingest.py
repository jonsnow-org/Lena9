"""Loss-preserving source-media ingestion for OneCore v3.

Unlike the v2 acquisition adapter, these helpers never resize images or cap video
frame counts. They retain the original source file and emit explicit metadata.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

import imageio.v3 as iio
import numpy as np
import soundfile as sf
from PIL import Image


def _safe_id(record_id: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", str(record_id)).strip("._")
    if not value or value in {".", ".."}:
        raise ValueError("record_id must contain at least one safe filename character")
    return value[:120]


def _copy_source(source: str | Path, assets_root: str | Path, record_id: str,
                 category: str) -> tuple[Path, str]:
    source_path = Path(source).resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"source media file not found: {source_path}")
    root = Path(assets_root).resolve()
    target_dir = root / "raw" / category
    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = source_path.suffix.lower() or ".bin"
    target = target_dir / f"{_safe_id(record_id)}{suffix}"
    shutil.copy2(source_path, target)
    return target, target.relative_to(root).as_posix()


def preserve_image_source(source: str | Path, assets_root: str | Path,
                          record_id: str) -> dict[str, Any]:
    target, relative = _copy_source(source, assets_root, record_id, "images")
    with Image.open(target) as image:
        image.verify()
    with Image.open(target) as image:
        width, height = image.size
        image_format = image.format
        mode = image.mode
    return {
        "source_asset": relative, "width": width, "height": height,
        "format": image_format, "mode": mode, "resized": False,
    }


def preserve_audio_source(source: str | Path, assets_root: str | Path,
                          record_id: str) -> dict[str, Any]:
    target, relative = _copy_source(source, assets_root, record_id, "audio")
    info = sf.info(str(target))
    if info.frames < 1 or info.samplerate < 1 or info.channels < 1:
        raise ValueError("audio source must contain samples with a valid sample rate and channels")
    return {
        "source_asset": relative, "sample_rate": int(info.samplerate),
        "channels": int(info.channels), "samples": int(info.frames),
        "duration_seconds": float(info.duration), "subtype": info.subtype,
    }


def preserve_video_source(source: str | Path, assets_root: str | Path,
                          record_id: str) -> dict[str, Any]:
    """Preserve the original video and stream every decoded frame to lossless PNG."""
    target, relative = _copy_source(source, assets_root, record_id, "video")
    metadata = iio.immeta(target)
    fps_value = metadata.get("fps", metadata.get("framerate"))
    try:
        fps = float(fps_value) if fps_value is not None else 0.0
    except (TypeError, ValueError):
        fps = 0.0
    frame_dir = Path(assets_root).resolve() / "frames" / _safe_id(record_id)
    frame_dir.mkdir(parents=True, exist_ok=True)
    frame_paths: list[str] = []
    width = height = None
    for index, frame in enumerate(iio.imiter(target)):
        array = np.asarray(frame)
        if array.ndim != 3 or array.shape[2] not in (3, 4):
            raise ValueError(f"unsupported decoded video frame shape: {array.shape}")
        if array.dtype != np.uint8:
            raise ValueError(
                f"decoded frame dtype {array.dtype} is not supported for lossless PNG export; "
                "retain original video and add an explicit high-bit-depth decoder"
            )
        if width is None:
            height, width = int(array.shape[0]), int(array.shape[1])
        elif array.shape[:2] != (height, width):
            raise ValueError("video changed frame dimensions mid-stream")
        frame_path = frame_dir / f"{index:08d}.png"
        Image.fromarray(array).save(frame_path, format="PNG")
        frame_paths.append(frame_path.relative_to(Path(assets_root).resolve()).as_posix())
    if not frame_paths:
        raise ValueError("video source contains no decodable frames")
    timestamps = (
        [index / fps for index in range(len(frame_paths))]
        if fps > 0 else list(range(len(frame_paths)))
    )
    duration = metadata.get("duration")
    return {
        "source_asset": relative, "frames": frame_paths, "timestamps": timestamps,
        "timestamp_unit": "seconds" if fps > 0 else "frame_index",
        "fps": fps or None, "duration_seconds": float(duration) if duration is not None else None,
        "frame_count": len(frame_paths), "width": width, "height": height,
        "frame_limit_applied": False,
    }
