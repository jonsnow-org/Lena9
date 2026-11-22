"""Loss-preserving source-media ingestion for OneCore v3.

These helpers never resize images or cap video frame counts. They retain the
original source file and emit explicit metadata for reproducible preprocessing.
"""
from __future__ import annotations

import io
import re
import shutil
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

import imageio.v3 as iio
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
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
    if source_path != target.resolve():
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
    """Preserve original video and stream every decoded frame to lossless PNG."""
    target, relative = _copy_source(source, assets_root, record_id, "video")
    # Extensionless/temporary .bin video paths need FFmpeg's content probing.
    # Keep ImageIO's native plugin for GIFs and other image-sequence formats.
    ffmpeg_suffixes = {
        "", ".bin", ".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v",
        ".mpeg", ".mpg", ".mjpeg", ".mjpg", ".flv", ".wmv", ".ts",
    }
    use_ffmpeg = target.suffix.lower() in ffmpeg_suffixes
    metadata = iio.immeta(target, plugin="FFMPEG") if use_ffmpeg else iio.immeta(target)
    fps_value = metadata.get("fps", metadata.get("framerate"))
    try:
        fps = float(fps_value) if fps_value is not None else 0.0
    except (TypeError, ValueError):
        fps = 0.0
    frame_dir = Path(assets_root).resolve() / "frames" / _safe_id(record_id)
    frame_dir.mkdir(parents=True, exist_ok=True)
    for stale in frame_dir.glob("*.png"):
        stale.unlink()
    frame_paths: list[str] = []
    width = height = None
    frame_iterator = iio.imiter(target, plugin="FFMPEG") if use_ffmpeg else iio.imiter(target)
    for index, frame in enumerate(frame_iterator):
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


def _download_to_temp(url: str, suffix: str, max_bytes: int) -> Path:
    if not url.startswith(("http://", "https://")):
        raise ValueError("media URL must use HTTP or HTTPS")
    handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    path = Path(handle.name)
    total = 0
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "OneCore-v3-media-ingest/1.0"})
        with urllib.request.urlopen(request, timeout=45) as response, handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError(f"media payload exceeds configured limit of {max_bytes} bytes")
                handle.write(chunk)
        if total < 1:
            raise ValueError("media URL returned an empty payload")
        return path
    except Exception:
        handle.close()
        path.unlink(missing_ok=True)
        raise


def _payload_temp(raw: bytes, suffix: str, max_bytes: int) -> Path:
    if not raw or len(raw) > max_bytes:
        raise ValueError("media bytes are empty or exceed the configured size limit")
    handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    path = Path(handle.name)
    try:
        with handle:
            handle.write(raw)
        return path
    except Exception:
        path.unlink(missing_ok=True)
        raise


def preserve_image_payload(value: Any, assets_root: str | Path, record_id: str,
                           max_bytes: int = 32 * 1024 * 1024) -> dict[str, Any]:
    """Preserve a dataset image value (path, URL, bytes, PIL image or ndarray)."""
    if isinstance(value, dict):
        if value.get("path"):
            return preserve_image_payload(value["path"], assets_root, record_id, max_bytes)
        if value.get("bytes") is not None:
            temp = _payload_temp(bytes(value["bytes"]), ".img", max_bytes)
        elif value.get("src") or value.get("url"):
            temp = _download_to_temp(str(value.get("src") or value.get("url")), ".img", max_bytes)
        elif value.get("array") is not None:
            return preserve_image_payload(value["array"], assets_root, record_id, max_bytes)
        else:
            raise ValueError("image payload dict must contain path, bytes, URL, or array")
        try:
            return preserve_image_source(temp, assets_root, record_id)
        finally:
            temp.unlink(missing_ok=True)
    if isinstance(value, str):
        if value.startswith(("http://", "https://")):
            temp = _download_to_temp(value, ".img", max_bytes)
            try:
                return preserve_image_source(temp, assets_root, record_id)
            finally:
                temp.unlink(missing_ok=True)
        return preserve_image_source(value, assets_root, record_id)
    if isinstance(value, Image.Image):
        handle = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        temp = Path(handle.name)
        handle.close()
        try:
            value.save(temp, format="PNG")
            return preserve_image_source(temp, assets_root, record_id)
        finally:
            temp.unlink(missing_ok=True)
    if isinstance(value, np.ndarray):
        image = Image.fromarray(value)
        return preserve_image_payload(image, assets_root, record_id, max_bytes)
    raise ValueError(f"unsupported image payload type: {type(value).__name__}")


def preserve_audio_payload(value: Any, assets_root: str | Path, record_id: str,
                           max_bytes: int = 128 * 1024 * 1024) -> dict[str, Any]:
    """Preserve a dataset audio value with its original sample rate/channel metadata."""
    if isinstance(value, dict):
        if value.get("path"):
            return preserve_audio_payload(value["path"], assets_root, record_id, max_bytes)
        if value.get("bytes") is not None:
            temp = _payload_temp(bytes(value["bytes"]), ".audio", max_bytes)
        elif value.get("src") or value.get("url"):
            temp = _download_to_temp(str(value.get("src") or value.get("url")), ".audio", max_bytes)
        elif value.get("array") is not None:
            array = np.asarray(value["array"])
            raw_sample_rate = value.get("sampling_rate") or value.get("sample_rate")
            if raw_sample_rate is None:
                raise ValueError("audio array payload must include its original sample_rate")
            sample_rate = int(raw_sample_rate)
            if sample_rate < 1:
                raise ValueError("audio array sample_rate must be positive")
            handle = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            temp = Path(handle.name)
            handle.close()
            sf.write(temp, array, sample_rate)
        else:
            raise ValueError("audio payload dict must contain path, bytes, URL, or array")
        try:
            return preserve_audio_source(temp, assets_root, record_id)
        finally:
            temp.unlink(missing_ok=True)
    if isinstance(value, str):
        if value.startswith(("http://", "https://")):
            temp = _download_to_temp(value, ".audio", max_bytes)
            try:
                return preserve_audio_source(temp, assets_root, record_id)
            finally:
                temp.unlink(missing_ok=True)
        return preserve_audio_source(value, assets_root, record_id)
    raise ValueError(f"unsupported audio payload type: {type(value).__name__}")


def preserve_video_frames(frames: list[Any] | tuple[Any, ...], assets_root: str | Path,
                          record_id: str, timestamps: list[float] | None = None,
                          fps: float | None = None) -> dict[str, Any]:
    """Preserve every provided frame when a source video container is unavailable."""
    if not frames:
        raise ValueError("video frame list cannot be empty")
    safe_id = _safe_id(record_id)
    root = Path(assets_root).resolve()
    frame_dir = root / "frames" / safe_id
    frame_dir.mkdir(parents=True, exist_ok=True)
    for stale in frame_dir.glob("*.png"):
        stale.unlink()
    paths = []
    height = width = None
    for index, frame in enumerate(frames):
        if isinstance(frame, Image.Image):
            image = frame.convert("RGB")
        else:
            array = np.asarray(frame)
            if array.ndim != 3 or array.shape[2] not in (3, 4) or array.dtype != np.uint8:
                raise ValueError(f"unsupported video frame payload: {array.shape} {array.dtype}")
            image = Image.fromarray(array).convert("RGB")
        current_width, current_height = image.size
        if width is None:
            width, height = current_width, current_height
        elif (current_width, current_height) != (width, height):
            raise ValueError("video changed frame dimensions mid-sequence")
        relative = (frame_dir / f"{index:08d}.png").relative_to(root).as_posix()
        image.save(root / relative, format="PNG")
        paths.append(relative)
    if timestamps is not None and len(timestamps) != len(paths):
        raise ValueError("timestamps length must match frame count")
    if timestamps is None:
        timestamps = (
            [index / fps for index in range(len(paths))]
            if fps and fps > 0 else list(range(len(paths)))
        )
    return {
        "frames": paths, "timestamps": list(timestamps),
        "timestamp_unit": "seconds" if fps and fps > 0 else "frame_index",
        "fps": fps, "frame_count": len(paths), "width": width, "height": height,
        "frame_limit_applied": False, "source_asset": None,
    }


def preserve_video_payload(value: Any, assets_root: str | Path, record_id: str,
                           max_bytes: int = 512 * 1024 * 1024) -> dict[str, Any]:
    """Preserve a video path/URL/bytes object or all frames supplied by a dataset."""
    if isinstance(value, dict):
        if isinstance(value.get("frames"), (list, tuple)):
            return preserve_video_frames(
                value["frames"], assets_root, record_id,
                timestamps=value.get("timestamps"), fps=value.get("fps"),
            )
        if value.get("path"):
            return preserve_video_payload(value["path"], assets_root, record_id, max_bytes)
        if value.get("bytes") is not None:
            suffix = Path(str(value.get("path") or "source.mp4")).suffix or ".mp4"
            temp = _payload_temp(bytes(value["bytes"]), suffix, max_bytes)
        elif value.get("src") or value.get("url"):
            temp = _download_to_temp(str(value.get("src") or value.get("url")), ".mp4", max_bytes)
        else:
            raise ValueError("video payload dict must contain frames, path, bytes, or URL")
        try:
            return preserve_video_source(temp, assets_root, record_id)
        finally:
            temp.unlink(missing_ok=True)
    if isinstance(value, (list, tuple)):
        return preserve_video_frames(value, assets_root, record_id)
    if isinstance(value, str):
        if value.startswith(("http://", "https://")):
            temp = _download_to_temp(value, ".mp4", max_bytes)
            try:
                return preserve_video_source(temp, assets_root, record_id)
            finally:
                temp.unlink(missing_ok=True)
        return preserve_video_source(value, assets_root, record_id)
    raise ValueError(f"unsupported video payload type: {type(value).__name__}")


def resample_audio_source(source: str | Path, assets_root: str | Path, record_id: str,
                          target_sample_rate: int = 24_000) -> dict[str, Any]:
    """Create a canonical-rate training derivative while preserving the raw source.

    The original file remains under raw/audio. The derived WAV is resampled with
    polyphase FIR filtering and carries both source and target rate metadata.
    """
    if target_sample_rate < 1:
        raise ValueError("target_sample_rate must be positive")
    raw_report = preserve_audio_source(source, assets_root, record_id)
    root = Path(assets_root).resolve()
    raw_path = root / raw_report["source_asset"]
    waveform, source_rate = sf.read(str(raw_path), dtype="float32", always_2d=True)
    if source_rate < 1 or waveform.shape[0] < 1:
        raise ValueError("audio source must contain samples at a valid sample rate")
    if source_rate == target_sample_rate:
        return {
            **raw_report,
            "training_asset": raw_report["source_asset"],
            "training_sample_rate": target_sample_rate,
            "resampled": False,
            "resampler": "identity",
        }
    from math import gcd
    divisor = gcd(int(source_rate), int(target_sample_rate))
    up = target_sample_rate // divisor
    down = int(source_rate) // divisor
    normalized = resample_poly(waveform, up, down, axis=0).astype(np.float32, copy=False)
    derived_dir = root / "processed" / "audio"
    derived_dir.mkdir(parents=True, exist_ok=True)
    derived = derived_dir / f"{_safe_id(record_id)}-{target_sample_rate}hz.wav"
    temp = derived.with_suffix(".wav.tmp")
    try:
        sf.write(str(temp), normalized, target_sample_rate, subtype="PCM_24", format="WAV")
        temp.replace(derived)
    finally:
        temp.unlink(missing_ok=True)
    return {
        **raw_report,
        "training_asset": derived.relative_to(root).as_posix(),
        "training_sample_rate": target_sample_rate,
        "training_channels": int(normalized.shape[1]),
        "training_samples": int(normalized.shape[0]),
        "resampled": True,
        "resampler": "scipy.signal.resample_poly",
        "resample_ratio": {"up": up, "down": down},
    }
