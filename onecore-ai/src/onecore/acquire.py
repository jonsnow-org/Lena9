from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import tempfile
import time
import urllib.request
from urllib.parse import unquote, urlparse
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import torch
import yaml
from PIL import Image

from .audio import log_mel_spectrogram
from .data import external_record_is_trainable, is_immutable_source_revision
from .crawlers import StatefulStreamCursor, notebook_for_source
from .stack_v2 import (
    StackAccessRequired, fetch_stack_content, has_allowed_stack_license, stack_credentials_present,
)


SPLITS = ("train", "validation", "test")



def _source_limits(source: dict[str, Any], profile: str) -> dict[str, int]:
    base = {str(key): int(value) for key, value in (source.get("limits") or {}).items()}
    overrides = (source.get("profile_limits") or {}).get(profile, {})
    if not isinstance(overrides, dict):
        raise ValueError(f"profile limits for {source.get('id')} / {profile} must be a mapping")
    for key, value in overrides.items():
        if str(key) not in SPLITS or int(value) < 0:
            raise ValueError(f"invalid profile limit {key}={value} for source {source.get('id')}")
        base[str(key)] = int(value)
    if any(key not in SPLITS or value < 0 for key, value in base.items()):
        raise ValueError(f"invalid source limits for {source.get('id')}: {base}")
    return base


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()



def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _record_asset_content_group_ids(record: dict[str, Any], assets_root: Path) -> list[str]:
    """Fingerprint every real media payload so duplicate assets cannot cross dataset splits."""
    root = Path(assets_root).resolve()
    values: list[str] = []
    for field in ("image", "audio_features"):
        value = record.get(field)
        if isinstance(value, str) and value.strip():
            values.append(value)
    frames = record.get("frames")
    if isinstance(frames, list):
        values.extend(value for value in frames if isinstance(value, str) and value.strip())
    group_ids: set[str] = set()
    for relative in values:
        target = (root / relative).resolve()
        if root not in target.parents or not target.is_file():
            raise ValueError(f"cannot fingerprint missing or escaping media asset: {relative}")
        group_ids.add(f"asset-sha256:{_sha256_file(target)}")
    return sorted(group_ids)

def _training_manifest_base(root: Path) -> dict[str, Any]:
    manifest = root / "data" / "train.jsonl"
    if not manifest.is_file():
        return {"base_train_manifest_sha256": None, "base_asset_manifest_sha256": None, "base_train_records": 0}
    records = [
        json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()
    ]
    assets_root = (root / "data" / "assets").resolve()
    paths: set[str] = set()
    for record in records:
        for field in ("image", "audio_features"):
            value = record.get(field)
            if isinstance(value, str) and value.strip():
                paths.add(value)
        frames = record.get("frames")
        if isinstance(frames, list):
            paths.update(value for value in frames if isinstance(value, str) and value.strip())
    entries: list[dict[str, str]] = []
    for relative in sorted(paths):
        target = (assets_root / relative).resolve()
        if assets_root not in target.parents or not target.is_file():
            raise FileNotFoundError(f"base training asset is missing or escapes data/assets: {relative}")
        entries.append({"path": relative, "sha256": _sha256_file(target)})
    encoded = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "base_train_manifest_sha256": _sha256_file(manifest),
        "base_asset_manifest_sha256": hashlib.sha256(encoded).hexdigest(),
        "base_train_records": len(records),
    }



def _external_record_has_usable_payload(record: dict[str, Any], assets_root: Path) -> bool:
    """Require real, decodable payloads before counting external modality coverage."""
    task = str(record.get("task", ""))

    def asset_path(value: Any) -> Path | None:
        if not isinstance(value, str) or not value.strip():
            return None
        target = (assets_root / value).resolve()
        if assets_root not in target.parents or not target.is_file() or target.stat().st_size <= 0:
            return None
        return target

    def valid_image(value: Any) -> bool:
        target = asset_path(value)
        if target is None:
            return False
        try:
            with Image.open(target) as image:
                image.verify()
            return True
        except Exception:
            return False

    def valid_audio(value: Any) -> bool:
        target = asset_path(value)
        if target is None:
            return False
        try:
            features = np.load(target, allow_pickle=False)
            return bool(
                features.ndim == 2 and features.shape[0] > 0 and features.shape[1] == 80
                and np.isfinite(features).all()
            )
        except Exception:
            return False

    if task == "text":
        return len(str(record.get("text", "")).strip()) >= 24
    if task == "tool_use":
        return len(str(record.get("prompt", "")).strip()) >= 8 and len(
            str(record.get("response", "")).strip()
        ) >= 2
    if task in {"image_caption", "image_reconstruction"}:
        return valid_image(record.get("image")) and (
            task != "image_caption" or bool(str(record.get("caption", "")).strip())
        )
    if task in {"audio_text", "audio_reconstruction"}:
        return valid_audio(record.get("audio_features")) and (
            task != "audio_text" or bool(str(record.get("transcript", "")).strip())
        )
    if task in {"video_caption", "video_reconstruction"}:
        frames = record.get("frames")
        if not isinstance(frames, list) or len(frames) < 2 or not all(valid_image(frame) for frame in frames):
            return False
        return task != "video_caption" or bool(str(record.get("caption", "")).strip())
    return False


def _external_asset_report(project_root: str | Path, split: str) -> dict[str, Any]:
    root = Path(project_root).resolve()
    manifest = root / "data" / f"{split}.jsonl"
    assets_root = (root / "data" / "assets").resolve()
    records = [
        json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ] if manifest.is_file() else []
    external = [
        record for record in records
        if str(record.get("split", "")) == split and external_record_is_trainable(record)
    ]
    usable = [record for record in external if _external_record_has_usable_payload(record, assets_root)]
    tasks: dict[str, int] = {}
    for record in usable:
        task = str(record.get("task", ""))
        tasks[task] = tasks.get(task, 0) + 1
    image_paths: set[str] = set()
    audio_paths: set[str] = set()
    video_paths: set[str] = set()
    for record in external:
        image = record.get("image")
        if isinstance(image, str) and image.strip():
            image_paths.add(image)
        audio = record.get("audio_features")
        if isinstance(audio, str) and audio.strip():
            audio_paths.add(audio)
        frames = record.get("frames")
        if isinstance(frames, list):
            video_paths.update(value for value in frames if isinstance(value, str) and value.strip())
    all_paths = image_paths | audio_paths | video_paths
    total_bytes = 0
    missing = 0
    for relative in all_paths:
        target = (assets_root / relative).resolve()
        if assets_root not in target.parents or not target.is_file():
            missing += 1
        else:
            total_bytes += target.stat().st_size
    metadata_only = sum(
        1 for record in external
        if record.get("task") in {"image_caption", "image_reconstruction"} and not record.get("image")
        or record.get("task") in {"audio_text", "audio_reconstruction"} and not record.get("audio_features")
        or record.get("task") in {"video_caption", "video_reconstruction"}
        and (not isinstance(record.get("frames"), list) or len(record.get("frames", [])) < 2)
    )
    return {
        "records_by_task": tasks,
        "metadata_only_records": metadata_only,
        "unusable_external_records": len(external) - len(usable),
        "image_files": len(image_paths),
        "audio_feature_files": len(audio_paths),
        "video_frame_files": len(video_paths),
        "unique_asset_files": len(all_paths),
        "missing_asset_files": missing,
        "unique_asset_bytes": total_bytes,
    }

def _stable_split(
    source_id: str, row_id: str, seed: str = "onecore-shard-v1",
    validation_percent: int = 2, test_percent: int = 2,
) -> str:
    validation_percent = int(validation_percent)
    test_percent = int(test_percent)
    if validation_percent < 0 or test_percent < 0 or validation_percent + test_percent >= 100:
        raise ValueError("validation/test split percentages must be non-negative and sum to less than 100")
    bucket = int(_stable_hash(f"{seed}:{source_id}:{row_id}")[:8], 16) % 100
    train_cut = 100 - validation_percent - test_percent
    if bucket < train_cut:
        return "train"
    if bucket < 100 - test_percent:
        return "validation"
    return "test"


def _nested(row: dict[str, Any], path: str) -> Any:
    value: Any = row
    for key in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _first_text(row: dict[str, Any], fields: list[str]) -> str:
    for field in fields:
        value = _nested(row, field)
        if isinstance(value, list):
            value = next((v for v in value if isinstance(v, str) and v.strip()), "")
        if isinstance(value, str) and value.strip():
            return " ".join(value.split())
    return ""


def _identity_value(value: Any) -> Any:
    """Convert nested dataset values into deterministic, compact identity material."""
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
        return {
            "image_sha256": hashlib.sha256(image.tobytes()).hexdigest(),
            "image_size": list(image.size),
        }
    if isinstance(value, dict):
        return {str(key): _identity_value(item) for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))}
    if isinstance(value, (list, tuple)):
        return [_identity_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _row_identity(row: dict[str, Any], source_id: str, index: int) -> str:
    """Include the complete row payload so reused dataset IDs cannot collide."""
    primary = ""
    for key in ("id", "sample_id", "__key__", "blob_id", "content_id", "image_name", "filename", "file", "url", "path",
                "video_id", "videoid", "clip_id", "img_id"):
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


def _decode_image(value: Any) -> Image.Image | None:
    if isinstance(value, np.ndarray):
        array = value
        if array.dtype != np.uint8:
            if np.issubdtype(array.dtype, np.floating) and array.size and float(array.max()) <= 1.0:
                array = array * 255.0
            array = np.clip(array, 0, 255).astype("uint8")
        return Image.fromarray(array).convert("RGB")
    if isinstance(value, Image.Image):
        return value.convert("RGB")
    if isinstance(value, dict):
        raw = value.get("bytes")
        path = value.get("path")
        source_url = value.get("src") or value.get("url")
        if raw:
            return Image.open(io.BytesIO(raw)).convert("RGB")
        if path and Path(path).is_file():
            return Image.open(path).convert("RGB")
        if isinstance(source_url, str) and source_url.startswith(("http://", "https://")):
            return _decode_image(source_url)
    if isinstance(value, (bytes, bytearray)):
        return Image.open(io.BytesIO(value)).convert("RGB")
    if isinstance(value, str):
        if value.startswith("data:image/") and "," in value:
            value = value.split(",", 1)[1]
        if value.startswith(("http://", "https://")):
            request = urllib.request.Request(value, headers={"User-Agent": "OneCore-data-ingest/1.0"})
            with urllib.request.urlopen(request, timeout=25) as response:
                return Image.open(io.BytesIO(response.read())).convert("RGB")
        try:
            raw = base64.b64decode(value, validate=True)
            if raw:
                return Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception:
            return None
    return None


def _save_image(value: Any, destination: Path) -> bool:
    try:
        image = _decode_image(value)
        if image is None:
            return False
        destination.parent.mkdir(parents=True, exist_ok=True)
        image = image.resize((64, 64), Image.Resampling.BICUBIC)
        image.save(destination, format="PNG", optimize=True)
        return True
    except Exception:
        return False


def _audio_array(value: Any) -> tuple[np.ndarray, int] | None:
    if isinstance(value, dict):
        array = value.get("array")
        rate = int(value.get("sampling_rate") or value.get("sample_rate") or 16000)
        if array is not None:
            return np.asarray(array), rate
        raw = value.get("bytes")
        path = value.get("path")
        source_url = value.get("src") or value.get("url")
        if raw or path or source_url:
            try:
                import soundfile as sf
                if raw:
                    source = io.BytesIO(raw)
                elif path and Path(path).is_file():
                    source = str(path)
                elif isinstance(source_url, str) and source_url.startswith(("http://", "https://")):
                    request = urllib.request.Request(source_url, headers={"User-Agent": "OneCore-data-ingest/1.0"})
                    with urllib.request.urlopen(request, timeout=35) as response:
                        source = io.BytesIO(response.read(64 * 1024 * 1024 + 1))
                else:
                    return None
                arr, rate = sf.read(source, dtype="float32", always_2d=False)
                return np.asarray(arr), int(rate)
            except Exception:
                return None
    if isinstance(value, np.ndarray):
        return value, 16000
    return None


def _save_audio_features(value: Any, destination: Path) -> bool:
    decoded = _audio_array(value)
    if decoded is None:
        return False
    array, sample_rate = decoded
    if array.size == 0:
        return False
    array = np.asarray(array, dtype=np.float32)
    if array.ndim == 2:
        # Soundfile uses [samples, channels]; HF audio decoders may also use it.
        if array.shape[0] <= 8 and array.shape[1] > array.shape[0]:
            array = array.mean(axis=0)
        else:
            array = array.mean(axis=1)
    if not np.isfinite(array).all():
        return False
    waveform = torch.from_numpy(array.copy())
    if sample_rate != 16000:
        target_length = max(1, round(waveform.numel() * 16000 / sample_rate))
        waveform = torch.nn.functional.interpolate(
            waveform.reshape(1, 1, -1), size=target_length, mode="linear", align_corners=False
        ).reshape(-1)
    waveform = waveform.clamp(-1.0, 1.0)
    try:
        features = log_mel_spectrogram(waveform, sample_rate=16000, n_mels=80)
        if features.numel() == 0 or not torch.isfinite(features).all():
            return False
        destination.parent.mkdir(parents=True, exist_ok=True)
        np.save(destination, features.numpy().astype("float32", copy=False))
        return True
    except Exception:
        return False


def _video_frames(value: Any, max_frames: int = 4) -> list[Any]:
    if isinstance(value, dict):
        frames = value.get("frames")
        if isinstance(frames, (list, tuple)):
            return list(frames[:max_frames])
        path = value.get("path")
        raw = value.get("bytes")
        src = value.get("src") or value.get("url")
        if src and not path and not raw:
            return _video_frames(str(src), max_frames=max_frames)
        if path or raw:
            temp_path = None
            try:
                import imageio.v3 as iio
                if raw:
                    handle = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
                    handle.write(raw)
                    handle.close()
                    temp_path = handle.name
                    source = temp_path
                else:
                    source = str(path)
                selected = []
                for frame in iio.imiter(source):
                    selected.append(Image.fromarray(np.asarray(frame).astype("uint8")).convert("RGB"))
                    if len(selected) >= max_frames:
                        break
                return selected
            except Exception:
                return []
            finally:
                if temp_path:
                    Path(temp_path).unlink(missing_ok=True)
    if isinstance(value, str) and value.startswith(("http://", "https://")):
        try:
            request = urllib.request.Request(
                value, headers={"User-Agent": "OneCore-data-ingest/1.0"}
            )
            with urllib.request.urlopen(request, timeout=35) as response:
                raw = response.read(64 * 1024 * 1024 + 1)
            if len(raw) > 64 * 1024 * 1024:
                return []
            return _video_frames({"bytes": raw}, max_frames=max_frames)
        except Exception:
            return []
    if isinstance(value, str) and Path(value).is_file():
        return _video_frames({"path": value}, max_frames=max_frames)
    if isinstance(value, (list, tuple)):
        return list(value[:max_frames])
    return []


def _write_frames(value: Any, assets_root: Path, prefix: str, max_frames: int = 4) -> list[str]:
    frames = _video_frames(value, max_frames=max_frames)
    saved: list[str] = []
    for index, frame in enumerate(frames[:max_frames]):
        relative = f"acquired/{prefix}/frame_{index:02d}.png"
        if _save_image(frame, assets_root / relative):
            saved.append(relative)
    return saved


def _source_group_value(row: dict[str, Any], source: dict[str, Any]) -> Any:
    """Resolve a source/media group, including segmented video filenames."""
    group_field = source.get("split_group_field")
    if group_field:
        return _nested(row, str(group_field))
    filename_field = source.get("split_group_filename_field")
    if not filename_field:
        return None
    raw = _nested(row, str(filename_field))
    if isinstance(raw, dict):
        raw = raw.get("src") or raw.get("path") or raw.get("url")
    if not isinstance(raw, str) or not raw.strip():
        return None
    filename = Path(unquote(urlparse(raw).path)).name
    stem = Path(filename).stem
    # Videos4CameraBench files name segments <source-video-id>.<clip>.<segment>.mp4.
    parts = stem.split(".")
    if len(parts) > 1 and all(part.isdigit() for part in parts[1:]):
        stem = parts[0]
    return stem or filename


def _record_from_row(
    row: dict[str, Any], source: dict[str, Any], row_id: str, split: str,
    assets_root: Path,
) -> dict[str, Any] | None:
    source_id = str(source["id"])
    adapter = str(source.get("adapter", "text"))
    prefix = f"{source_id}/{_stable_hash(row_id)[:20]}"
    source_url = str(source.get("url") or f"https://huggingface.co/datasets/{source['repo']}")
    record_id = f"hf-{source_id}-{_stable_hash(row_id)[:24]}"
    record: dict[str, Any] = {
        "id": record_id,
        "source_id": source_id,
        "source_revision": str(source.get("_resolved_revision") or ""),
        "source_row_id_sha256": _stable_hash(row_id),
        "source_url": source_url,
        "split": split,
        "data_class": "external",
    }
    group_value = _source_group_value(row, source)
    if group_value is not None and str(group_value).strip():
        group_payload = json.dumps(
            _identity_value(group_value), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        record["source_group_id"] = f"{source_id}:{_stable_hash(group_payload)}"
    text = _first_text(row, list(source.get("text_fields") or []))
    conversation_field = source.get("conversation_field")
    if conversation_field:
        turns = _nested(row, str(conversation_field))
        if isinstance(turns, list):
            question = next((
                str(turn.get("value", "")).strip() for turn in turns
                if isinstance(turn, dict)
                and str(turn.get("from", "")).lower() in {"human", "user"}
                and str(turn.get("value", "")).strip()
            ), "")
            answer = next((
                str(turn.get("value", "")).strip() for turn in turns
                if isinstance(turn, dict)
                and str(turn.get("from", "")).lower() in {"gpt", "assistant"}
                and str(turn.get("value", "")).strip()
            ), "")
            if answer:
                text = f"Question: {question}\nAnswer: {answer}" if question else answer
    if adapter == "stack_v2_code":
        # Stack v2 exposes per-file provenance and an inferred license class.
        # Do not request SWH bytes for non-permissive, vendor, generated, or
        # out-of-scope languages; this saves crawler time and avoids needless GETs.
        if str(row.get("license_type") or "").strip().casefold() != "permissive":
            return None
        if bool(row.get("is_vendor")) or bool(row.get("is_generated")):
            return None
        allowlist = {str(value) for value in (source.get("license_allowlist") or [])}
        if not has_allowed_stack_license(row, allowlist):
            return None
        allowed_languages = {str(value).strip().casefold() for value in (source.get("allowed_languages") or [])}
        language = str(row.get("language") or "").strip()
        if allowed_languages and language.casefold() not in allowed_languages:
            return None
        code = fetch_stack_content(
            row, max_bytes=int(source.get("max_content_bytes", 524_288))
        )
        if not code:
            return None
        code_path = str(row.get("path") or "").strip()
        text = f"# Language: {language or 'unknown'} | File: {code_path or 'unknown'}\n{code}"
        detected = row.get("detected_licenses") or []
        if isinstance(detected, str):
            detected = [detected]
        record.update({
            "task": "text", "text": text[:2200], "code_language": language,
            "code_path": code_path, "code_blob_id": str(row.get("blob_id") or ""),
            "code_detected_licenses": sorted({str(value) for value in detected}),
        })
    elif adapter == "text":
        if len(text) < 24:
            return None
        record.update({"task": "text", "text": text[:2200]})
    elif adapter in {"image", "image_url", "image_base64"}:
        image_value = _nested(row, str(source.get("image_field") or "image"))
        if isinstance(image_value, str) and not image_value.startswith(("http://", "https://")):
            url_prefix = source.get("image_url_prefix")
            if url_prefix and image_value.strip():
                image_value = str(url_prefix).rstrip("/") + "/" + Path(image_value).name
        relative = f"acquired/{prefix}.png"
        if not _save_image(image_value, assets_root / relative):
            raise ValueError(f"image adapter could not decode or download field {source.get('image_field') or 'image'}")
        if text:
            record.update({"task": "image_caption", "image": relative, "caption": text[:700]})
        else:
            record.update({"task": "image_reconstruction", "image": relative})
    elif adapter == "tool_use":
        prompt_parts = []
        for field in source.get("system_fields", []):
            value = _first_text(row, [str(field)])
            if value:
                prompt_parts.append(value)
        prompt = _first_text(row, list(source.get("prompt_fields") or source.get("text_fields") or []))
        if prompt:
            prompt_parts.append(prompt)
        response = _first_text(row, list(source.get("response_fields") or []))
        tool_name_field = source.get("tool_name_field")
        tool_arguments_field = source.get("tool_arguments_field")
        tool_name = _nested(row, str(tool_name_field)) if tool_name_field else None
        tool_arguments = _nested(row, str(tool_arguments_field)) if tool_arguments_field else None
        if tool_name and tool_arguments is not None:
            try:
                arguments = json.loads(tool_arguments) if isinstance(tool_arguments, str) else tool_arguments
            except json.JSONDecodeError:
                arguments = tool_arguments
            response = json.dumps({"name": str(tool_name), "arguments": arguments}, ensure_ascii=False, sort_keys=True)
        if len(" ".join(prompt_parts).strip()) < 8 or len(response.strip()) < 2:
            return None
        record.update({"task": "tool_use", "prompt": "\n".join(prompt_parts)[:1400], "response": response[:1400]})
    elif adapter == "audio":
        audio_value = _nested(row, str(source.get("audio_field") or "audio"))
        relative = f"acquired/{prefix}.npy"
        if not _save_audio_features(audio_value, assets_root / relative):
            raise ValueError(f"audio adapter could not decode or extract features from field {source.get('audio_field') or 'audio'}")
        if text:
            record.update({"task": "audio_text", "audio_features": relative, "transcript": text[:900]})
        else:
            record.update({"task": "audio_reconstruction", "audio_features": relative})
    elif adapter in {"video", "video_url", "video_repo_file"}:
        video_value = _nested(row, str(source.get("video_field") or "video"))
        if adapter == "video_url":
            aliases = source.get("video_url_fields") or ["video_url", "contentUrl", "url"]
            if not (isinstance(video_value, str) and video_value.startswith(("http://", "https://"))):
                candidates = []
                for field in aliases:
                    candidate = _nested(row, str(field))
                    if isinstance(candidate, dict):
                        candidate = candidate.get("src") or candidate.get("path") or candidate.get("url")
                    candidates.append(candidate)
                video_value = next((
                    candidate for candidate in candidates
                    if isinstance(candidate, str)
                    and candidate.startswith(("http://", "https://"))
                ), None)
            if not isinstance(video_value, str):
                return None
        if adapter == "video_repo_file":
            name = str(video_value).strip().replace("\\", "/") if isinstance(video_value, str) else ""
            if not name or Path(name).suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm"}:
                id_field = str(source.get("video_id_field") or "video_id")
                video_id = row.get(id_field) or row.get("video_id") or row.get("id") or name
                if video_id is None:
                    return None
                name = str(video_id).strip().replace("\\", "/")
                if not name:
                    return None
                if not name.lower().endswith((".mp4", ".mov", ".mkv", ".webm")):
                    if not name.lower().startswith("video"):
                        name = f"video{name}"
                    name = f"{name}.mp4"
            if "/" not in name:
                name = str(Path(str(source.get("video_directory") or "videos")) / name)
            normalized = name.lstrip("/")
            if ".." in Path(normalized).parts:
                return None
            from huggingface_hub import hf_hub_download
            media_path = hf_hub_download(
                repo_id=str(source["repo"]),
                filename=normalized,
                repo_type="dataset",
                revision=str(source.get("_resolved_revision") or source.get("revision") or "main"),
                token=os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN"),
            )
            video_value = {"path": media_path}
        frames = _write_frames(video_value, assets_root, prefix)
        if not frames:
            raise ValueError(f"video adapter could not decode frames from field {source.get('video_field') or 'video'}")
        if text:
            record.update({"task": "video_caption", "frames": frames, "caption": text[:700]})
        else:
            record.update({"task": "video_reconstruction", "frames": frames})
    elif adapter == "video_manifest":
        # Metadata remains registered for later media resolution; no video pixels are fabricated.
        return None
    elif adapter == "metadata_only":
        # Keep catalog rows in the acquisition report, but never materialize them as optimizer examples.
        return None
    else:
        raise ValueError(f"unknown acquisition adapter: {adapter}")
    asset_group_ids = _record_asset_content_group_ids(record, assets_root)
    if asset_group_ids:
        record["asset_content_group_ids"] = asset_group_ids
    return record


def _assign_split(source: dict[str, Any], hf_split: str, row_id: str, seed: str) -> str:
    forced = source.get("force_split")
    if forced:
        return str(forced)
    strategy = str(source.get("split_strategy", "preserve"))
    if hf_split in {"validation", "test"}:
        return hf_split
    if strategy == "preserve" and hf_split == "train":
        return "train"
    return _stable_split(
        str(source["id"]), row_id, seed,
        validation_percent=int(source.get("validation_percent", 2)),
        test_percent=int(source.get("test_percent", 2)),
    )


def _grouped_split(
    source: dict[str, Any], row: dict[str, Any], hf_split: str, row_id: str, seed: str
) -> str:
    """Keep captions/segments of one media item in the same held-out partition."""
    group_value = _source_group_value(row, source)
    if group_value is None or not str(group_value).strip():
        return _assign_split(source, hf_split, row_id, seed)
    group_identity = f"{hf_split}:{str(group_value).strip()}"
    return _assign_split(source, hf_split, group_identity, seed)


def _append_manifests(project_root: Path, rows_by_split: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    """Append idempotently and assign connected record/media-content groups to one split.

    Incoming records connected by a source group, record identity, or any identical
    asset hash are placed in the strictest split represented by that component
    (test > validation > train). Persisted cross-split conflicts are rejected.
    """
    priority = {"train": 0, "validation": 1, "test": 2}
    assets_root = (project_root / "data" / "assets").resolve()
    existing_by_split: dict[str, list[dict[str, Any]]] = {}
    existing_ids: dict[str, str] = {}
    existing_groups: dict[str, str] = {}

    def groups_for_record(item: dict[str, Any], *, prefer_declared: bool) -> list[str]:
        groups: list[str] = []
        source_group = str(item.get("source_group_id", "")).strip()
        if source_group:
            groups.append(source_group)
        declared = item.get("asset_content_group_ids")
        if prefer_declared and isinstance(declared, list) and declared:
            groups.extend(str(value).strip() for value in declared if str(value).strip())
        else:
            groups.extend(_record_asset_content_group_ids(item, assets_root))
        return sorted(set(groups))

    for split in SPLITS:
        path = project_root / "data" / f"{split}.jsonl"
        existing: list[dict[str, Any]] = []
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                item = json.loads(line)
                item.pop("_line", None)
                existing.append(item)
                record_id = str(item.get("id", "")).strip()
                if record_id in existing_ids and existing_ids[record_id] != split:
                    raise ValueError(f"existing record ID occurs in multiple splits: {record_id}")
                existing_ids[record_id] = split
                for group_id in groups_for_record(item, prefer_declared=True):
                    old_split = existing_groups.get(group_id)
                    if old_split is not None and old_split != split:
                        raise ValueError(
                            f"existing source/media content group occurs in multiple splits: {group_id}"
                        )
                    existing_groups[group_id] = split
        existing_by_split[split] = existing

    incoming: list[tuple[str, dict[str, Any], list[str]]] = []
    for source_split in SPLITS:
        for original in rows_by_split.get(source_split, []):
            item = dict(original)
            record_id = str(item.get("id", "")).strip()
            if not record_id:
                raise ValueError(f"new {source_split} manifest record has an empty ID")
            if record_id in existing_ids:
                continue
            groups = groups_for_record(item, prefer_declared=True)
            asset_groups = [group for group in groups if group.startswith("asset-sha256:")]
            if asset_groups:
                item["asset_content_group_ids"] = asset_groups
            else:
                item.pop("asset_content_group_ids", None)
            incoming.append((source_split, item, groups))

    parent: dict[str, str] = {}

    def find(node: str) -> str:
        parent.setdefault(node, node)
        if parent[node] != node:
            parent[node] = find(parent[node])
        return parent[node]

    def union(left: str, right: str) -> None:
        root_left, root_right = find(left), find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    nodes_by_record: list[list[str]] = []
    for _source_split, item, groups in incoming:
        record_node = f"record-id:{str(item['id']).strip()}"
        nodes = [record_node, *groups]
        nodes_by_record.append(nodes)
        for node in nodes[1:]:
            union(nodes[0], node)

    components: dict[str, list[int]] = {}
    for index, nodes in enumerate(nodes_by_record):
        root = find(nodes[0])
        components.setdefault(root, []).append(index)

    additions: dict[str, list[dict[str, Any]]] = {split: [] for split in SPLITS}
    for indices in components.values():
        target = max((incoming[index][0] for index in indices), key=lambda split: priority[split])
        component_groups = {group for index in indices for group in incoming[index][2]}
        for group_id in component_groups:
            persisted_split = existing_groups.get(group_id)
            if persisted_split is not None and persisted_split != target:
                raise ValueError(
                    f"new media/source group {group_id} assigned to {target} conflicts with "
                    f"persisted {persisted_split} split; rebuild the affected corpus with one deterministic split"
                )
        seen_component_ids: set[str] = set()
        for index in indices:
            item = incoming[index][1]
            record_id = str(item["id"]).strip()
            if record_id in seen_component_ids:
                continue
            seen_component_ids.add(record_id)
            item["split"] = target
            additions[target].append(item)

    counts: dict[str, int] = {}
    for split in SPLITS:
        seen = {str(item.get("id", "")).strip() for item in existing_by_split[split]}
        added: list[dict[str, Any]] = []
        for item in additions[split]:
            record_id = str(item.get("id", "")).strip()
            if record_id in seen:
                continue
            seen.add(record_id)
            added.append(item)
        combined = existing_by_split[split] + added
        path = project_root / "data" / f"{split}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(
            "\n".join(json.dumps(item, ensure_ascii=False, sort_keys=True) for item in combined) + "\n",
            encoding="utf-8",
        )
        os.replace(temp, path)
        counts[split] = len(added)
    return counts

def task_coverage(project_root: str | Path) -> dict[str, dict[str, int]]:
    """Count usable records with decoded payloads; exclude metadata-only rows."""
    root = Path(project_root).resolve()
    assets_root = (root / "data" / "assets").resolve()
    task_groups = {
        "text": {"text"},
        "tool": {"tool_use"},
        "image": {"image_caption", "image_reconstruction"},
        "audio": {"audio_text", "audio_reconstruction"},
        "video": {"video_caption", "video_reconstruction"},
    }
    coverage: dict[str, dict[str, int]] = {}
    for split in SPLITS:
        path = root / "data" / f"{split}.jsonl"
        records = [
            json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ] if path.is_file() else []
        usable = [
            record for record in records
            if str(record.get("split", "")) == split
            and _external_record_has_usable_payload(record, assets_root)
        ]
        coverage[split] = {
            group: sum(1 for record in usable if record.get("task") in tasks)
            for group, tasks in task_groups.items()
        }
    return coverage

def assert_task_coverage(
    project_root: str | Path, required_tasks: set[str],
    minimum_train: int = 25, minimum_holdout: int = 5,
) -> dict[str, dict[str, int]]:
    coverage = task_coverage(project_root)
    failures = []
    for task_group in sorted(required_tasks):
        if task_group not in {"text", "tool", "image", "audio", "video"}:
            raise ValueError(f"unknown required external task group: {task_group}")
        for split in SPLITS:
            minimum = minimum_train if split == "train" else minimum_holdout
            actual = coverage[split][task_group]
            if actual < minimum:
                failures.append(f"{split}.{task_group}={actual} (minimum {minimum})")
    if failures:
        raise RuntimeError(
            "External corpus gate blocked training; imported datasets did not produce enough usable records: "
            + "; ".join(failures)
        )
    return coverage

def _source_manifest_records(
    project_root: Path, source_id: str, revision: str
) -> dict[str, list[dict[str, Any]]]:
    records_by_split: dict[str, list[dict[str, Any]]] = {split: [] for split in SPLITS}
    for split in SPLITS:
        manifest = project_root / "data" / f"{split}.jsonl"
        if not manifest.is_file():
            continue
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            item = json.loads(line)
            if (
                str(item.get("source_id", "")) == source_id
                and str(item.get("source_revision", "")) == revision
                and external_record_is_trainable(item)
            ):
                records_by_split[split].append(item)
    return records_by_split


def _source_metadata_records(
    project_root: Path, source_id: str, revision: str, *, allow_missing_revision: bool = False
) -> dict[str, list[dict[str, Any]]]:
    records_by_split: dict[str, list[dict[str, Any]]] = {split: [] for split in SPLITS}
    metadata_path = project_root / "data" / "metadata" / f"{source_id}.jsonl"
    if not metadata_path.is_file():
        return records_by_split
    for line in metadata_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        item_revision = str(item.get("source_revision", ""))
        if item_revision != revision and not (allow_missing_revision and not item_revision):
            continue
        split = str(item.get("split", ""))
        if split in records_by_split:
            records_by_split[split].append(item)
    return records_by_split


def _write_jsonl_atomic(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not entries:
        if path.exists():
            path.unlink()
        return
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(
        "\n".join(json.dumps(item, ensure_ascii=False, sort_keys=True) for item in entries) + "\n",
        encoding="utf-8",
    )
    os.replace(temp, path)


def persist_acquisition_progress(project_root: str | Path) -> dict[str, Any]:
    """Persist source cursors alongside the corpus for the next bounded session."""
    root = Path(project_root).resolve()
    report_path = root / "data" / "acquisition-report.json"
    if not report_path.is_file():
        raise FileNotFoundError(f"acquisition report not found: {report_path}")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    progress_path = root / "data" / "resume-cache" / "source-progress.json"
    previous = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.is_file() else {}
    progress = dict(previous)
    for source_report in report.get("sources", []):
        source_id = str(source_report.get("source", "")).strip()
        revision = str(source_report.get("revision", "")).strip()
        by_split = source_report.get("by_split")
        if not source_id or not is_immutable_source_revision(revision) or not isinstance(by_split, dict):
            continue
        offsets = {
            str(hf_split): int(metrics.get("total_scanned", metrics.get("scanned", 0)))
            for hf_split, metrics in by_split.items() if isinstance(metrics, dict)
        }
        progress[source_id] = {"revision": revision, "by_split": offsets}
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    temp = progress_path.with_suffix(progress_path.suffix + ".tmp")
    temp.write_text(json.dumps(progress, ensure_ascii=False, sort_keys=True, indent=2), encoding="utf-8")
    os.replace(temp, progress_path)
    return {"sources": len(progress), "progress_path": str(progress_path)}


def acquire_sources(
    project_root: str | Path,
    profile: str = "initial",
    source_file: str | Path | None = None,
    only_sources: set[str] | None = None,
    time_budget_seconds: int | None = None,
) -> dict[str, Any]:
    """Stream external datasets, resume immutable source cursors, and retain quota overflow.

    Accepted records are appended to the shared manifests. Rows that were already
    scanned but fell outside the current per-split quota are held in a pending cache,
    so expanding a profile can promote them without rereading the source.
    """
    root = Path(project_root).resolve()
    registry_path = Path(source_file) if source_file else root / "data" / "sources.yaml"
    registry = yaml.safe_load(registry_path.read_text(encoding="utf-8"))
    defaults = registry.get("defaults", {})
    seed = str(defaults.get("split_seed", "onecore-shard-v1"))
    assets_root = (root / "data" / "assets").resolve()
    pending_root = root / "data" / "pending"
    resume_cache_root = root / "data" / "resume-cache"
    resume_pending_root = resume_cache_root / "pending"
    rows_by_split: dict[str, list[dict[str, Any]]] = {split: [] for split in SPLITS}
    source_reports: list[dict[str, Any]] = []
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    if time_budget_seconds is not None and int(time_budget_seconds) < 60:
        raise ValueError("time_budget_seconds must be at least 60 when supplied")
    try:
        from datasets import Audio, load_dataset
        from huggingface_hub import HfApi
    except Exception as exc:
        raise RuntimeError("datasets and huggingface_hub are required for OneCore source acquisition") from exc

    # The corpus artifact is authoritative when a previous corpus is restored.
    previous_report_candidates = (
        root / "data" / "acquisition-report.json",
        root / "run-state" / "acquisition-report.json",
    )
    previous_report: dict[str, Any] = {}
    for previous_report_path in previous_report_candidates:
        if previous_report_path.is_file():
            previous_report = json.loads(previous_report_path.read_text(encoding="utf-8"))
            break
    stored_base = {
        key: previous_report.get(key)
        for key in ("base_train_manifest_sha256", "base_asset_manifest_sha256", "base_train_records")
    }
    if stored_base.get("base_train_manifest_sha256") and stored_base.get("base_asset_manifest_sha256"):
        base_fingerprints = stored_base
    else:
        base_fingerprints = _training_manifest_base(root)
    acquisition_deadline = (
        time.monotonic() + int(time_budget_seconds)
        if time_budget_seconds is not None else None
    )
    session_budget_exhausted = False
    prior_revisions = previous_report.get("source_revisions", {})
    prior_source_reports = {
        str(item.get("source", "")): item for item in previous_report.get("sources", [])
        if isinstance(item, dict) and str(item.get("source", "")).strip()
    }
    progress_path = resume_cache_root / "source-progress.json"
    progress_state = json.loads(progress_path.read_text(encoding="utf-8")) if progress_path.is_file() else {}
    source_revisions: dict[str, str] = dict(prior_revisions)
    hub_api = HfApi(token=token)
    metadata_rows: dict[str, list[dict[str, Any]]] = {}
    # Keep candidate cursor states in memory until their manifests/assets are durable.
    # Never persist an advanced cursor ahead of the examples it represents.
    cursor_snapshots: list[tuple[str, str, StatefulStreamCursor, Any, int]] = []
    source_specs = {
        str(item.get("id", "")): item for item in registry.get("sources", [])
    }

    for source in registry.get("sources", []):
        source_id = str(source.get("id", ""))
        if acquisition_deadline is not None and time.monotonic() >= acquisition_deadline:
            session_budget_exhausted = True
            break
        if only_sources and source_id not in only_sources:
            continue
        adapter = str(source.get("adapter", "text"))
        if not source.get("enabled", True):
            source_reports.append({"source": source_id, "repo": source.get("repo"), "adapter": adapter, "status": "disabled"})
            # Disabled sources may not keep unpromoted rows in a future corpus artifact.
            cache_name = f"source-{_stable_hash(source_id)[:16]}.jsonl"
            for cache_path in (pending_root / cache_name, resume_pending_root / cache_name):
                if cache_path.exists():
                    cache_path.unlink()
            continue
        if adapter == "stack_v2_code":
            missing_credentials = []
            if not token:
                missing_credentials.append("HF_TOKEN with approved access to bigcode/the-stack-v2")
            if not stack_credentials_present():
                missing_credentials.append("Software Heritage/INRIA AWS credentials")
            if missing_credentials:
                source_reports.append({
                    "source": source_id, "repo": source.get("repo"), "adapter": adapter,
                    "status": "access_required", "required_for_training": True,
                    "read": 0, "accepted": 0, "failed_rows": 0,
                    "errors": [{"type": "StackV2AccessRequired", "message": "; ".join(missing_credentials)}],
                })
                continue
        elif source.get("requires_access") and not token:
            source_reports.append({
                "source": source_id, "repo": source.get("repo"), "adapter": adapter,
                "status": "access_token_unavailable",
            })
            continue

        revision = source.get("revision") or prior_revisions.get(source_id)
        revision_error = None
        if not revision:
            try:
                revision = hub_api.dataset_info(str(source["repo"]), token=token).sha
            except Exception as exc:
                revision_error = f"{type(exc).__name__}: {str(exc)[:240]}"
                revision = None
        if not is_immutable_source_revision(revision):
            access_markers = ("gatedrepoerror", "access denied", "not authorized", "403", "401", "restricted")
            lookup_requires_access = bool(revision_error and any(
                marker in revision_error.casefold() for marker in access_markers
            ))
            required_for_training = bool(source.get("required_for_training"))
            source_reports.append({
                "source": source_id, "repo": source.get("repo"), "adapter": adapter, "revision": revision,
                "status": "access_required" if lookup_requires_access or required_for_training else "unavailable",
                "required_for_training": required_for_training,
                "read": 0, "accepted": 0, "failed_rows": 0,
                "errors": [{"type": "ImmutableRevisionRequired",
                            "message": "source revision must be a pinned 40-64 character commit SHA"}],
                **({"revision_lookup_warning": revision_error} if revision_error else {}),
            })
            continue
        revision = str(revision)
        source_revisions[source_id] = revision
        limits = _source_limits(source, profile)
        previous_source_report = prior_source_reports.get(source_id, {})
        previous_revision = str(previous_source_report.get("revision") or prior_revisions.get(source_id) or "")
        revision_matches = previous_revision == revision
        offsets: dict[str, int] = {}
        if revision_matches:
            for hf_split, metrics in (previous_source_report.get("by_split") or {}).items():
                if isinstance(metrics, dict):
                    offsets[str(hf_split)] = int(metrics.get("total_scanned", metrics.get("scanned", 0)))
        cached_progress = progress_state.get(source_id, {})
        if str(cached_progress.get("revision", "")) == revision:
            for hf_split, total_scanned in (cached_progress.get("by_split") or {}).items():
                offsets[str(hf_split)] = max(offsets.get(str(hf_split), 0), int(total_scanned))

        if adapter in {"metadata_only", "video_manifest"}:
            existing_metadata = _source_metadata_records(
                root, source_id, revision, allow_missing_revision=revision_matches
            )
            prior_accepted = {split: len(existing_metadata[split]) for split in SPLITS}
            existing_metadata_ids = {str(item.get("id", "")) for split in SPLITS for item in existing_metadata[split]}
            manifest_records = {split: [] for split in SPLITS}
        else:
            manifest_records = _source_manifest_records(root, source_id, revision)
            prior_accepted = {split: len(manifest_records[split]) for split in SPLITS}
            existing_metadata_ids = set()
        remaining_limits = {split: max(0, int(limits.get(split, 0)) - prior_accepted[split]) for split in SPLITS}

        cache_name = f"source-{_stable_hash(source_id)[:16]}.jsonl"
        pending_paths = (pending_root / cache_name, resume_pending_root / cache_name)
        if int(previous_source_report.get("pending_rows_added", 0)) > 0 and not any(
            path.is_file() for path in pending_paths
        ):
            # Older corpus artifacts did not preserve this cache. Re-scan that source
            # from its first row so quota overflow can be reconstructed without loss.
            offsets = {}
        pending_by_id: dict[str, dict[str, Any]] = {}
        pending_discarded = 0
        existing_record_ids = {
            str(item.get("id", "")) for split in SPLITS for item in manifest_records[split]
        }
        if adapter not in {"metadata_only", "video_manifest"}:
            for pending_path in pending_paths:
                if not pending_path.is_file():
                    continue
                for line in pending_path.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    try:
                        entry = json.loads(line)
                        record = entry.get("record")
                        entry_source = str(entry.get("source_id", ""))
                        entry_revision = str(entry.get("source_revision", ""))
                        entry_split = str(entry.get("split", ""))
                        record_id = str(record.get("id", "")) if isinstance(record, dict) else ""
                        if (
                            entry_source != source_id or entry_revision != revision or entry_split not in SPLITS
                            or not isinstance(record, dict) or not record_id
                            or str(record.get("split", "")) != entry_split
                            or record_id in existing_record_ids
                            or not external_record_is_trainable(record)
                            or not _external_record_has_usable_payload(record, assets_root)
                        ):
                            pending_discarded += 1
                            continue
                        pending_by_id.setdefault(record_id, {
                            "source_id": source_id, "source_revision": revision,
                            "split": entry_split, "record": record,
                        })
                    except Exception:
                        pending_discarded += 1

        report: dict[str, Any] = {
            "source": source_id, "repo": source.get("repo"), "adapter": adapter, "revision": revision,
            "status": "started", "read": 0, "accepted": 0, "failed_rows": 0, "by_split": {},
            "required_for_training": bool(source.get("required_for_training")),
            "crawler_notebook": notebook_for_source(source), "crawler_cursors": {},
            "limits": limits, "prior_accepted_by_output_split": prior_accepted,
            "remaining_limits": remaining_limits, "accepted_by_output_split": dict(prior_accepted),
            "new_accepted_by_output_split": {split: 0 for split in SPLITS},
            "metadata_only_by_split": {split: 0 for split in SPLITS},
            "pending_rows_added": 0, "pending_rows_promoted": 0, "pending_rows_discarded": pending_discarded,
            "pending_rows_by_output_split": {split: 0 for split in SPLITS},
            "prior_scan_offsets": offsets, "resumed_from_revision": revision_matches,
        }
        if revision_error:
            report["revision_lookup_warning"] = revision_error

        new_accepted_by_output_split = {split: 0 for split in SPLITS}
        seen_source_ids = set(existing_record_ids) | set(existing_metadata_ids)
        pending_promoted_ids: set[str] = set()
        pending_keep: list[dict[str, Any]] = []
        pending_promoted_by_split = {split: 0 for split in SPLITS}
        for record_id, entry in sorted(pending_by_id.items()):
            assigned = entry["split"]
            if new_accepted_by_output_split[assigned] < remaining_limits[assigned]:
                rows_by_split[assigned].append(entry["record"])
                new_accepted_by_output_split[assigned] += 1
                seen_source_ids.add(record_id)
                pending_promoted_ids.add(record_id)
                pending_promoted_by_split[assigned] += 1
                report["pending_rows_promoted"] += 1
                report["accepted"] += 1
            else:
                pending_keep.append(entry)

        if adapter in {"metadata_only", "video_manifest"}:
            # Catalog metadata is recorded for provenance only; it never enters optimizer manifests.
            metadata_new_by_split = {split: 0 for split in SPLITS}
        else:
            metadata_new_by_split = None

        source_splits_exhausted: set[str] = set()
        if all(new_accepted_by_output_split[split] >= remaining_limits[split] for split in SPLITS):
            report["already_satisfied"] = True
            for hf_split in source.get("hf_splits", ["train"]):
                start_offset = offsets.get(str(hf_split), 0)
                report["by_split"][str(hf_split)] = {
                    "start_offset": start_offset, "scanned": 0, "total_scanned": start_offset,
                    "accepted": {split: 0 for split in SPLITS}, "pending": {split: 0 for split in SPLITS},
                }
        else:
            for hf_split in source.get("hf_splits", ["train"]):
                start_offset = offsets.get(str(hf_split), 0)
                per_hf_accepted = {split: 0 for split in SPLITS}
                per_hf_pending = {split: 0 for split in SPLITS}
                scanned = 0
                split_exhausted = False
                source_access_blocked = False
                split_had_error = False
                cursor = None
                dataset = None
                try:
                    load_kwargs = {
                        "path": str(source["repo"]),
                        "split": str(hf_split), "streaming": True, "token": token,
                    }
                    if source.get("config"):
                        load_kwargs["name"] = str(source["config"])
                    load_kwargs["revision"] = revision
                    dataset = load_dataset(**load_kwargs)
                    if adapter == "audio":
                        audio_field = str(source.get("audio_field") or "audio")
                        features = getattr(dataset, "features", None) or {}
                        audio_feature = features.get(audio_field) if hasattr(features, "get") else None
                        if audio_feature is not None and audio_feature.__class__.__name__ == "Audio":
                            dataset = dataset.cast_column(audio_field, Audio(decode=False))
                    cursor = StatefulStreamCursor(
                        root, notebook_for_source(source), source_id, str(source["repo"]),
                        str(source.get("config") or ""), str(hf_split), revision,
                    )
                    dataset, start_offset, cursor_mode = cursor.restore(dataset, start_offset)
                    report["crawler_cursors"][str(hf_split)] = {
                        "mode": cursor_mode, "start_rows_read": start_offset,
                    }
                    target_count = sum(remaining_limits.values()) or 1
                    max_scan = max(target_count * int(defaults.get("max_scan_multiplier", 12)), target_count + 200)
                    for row in dataset:
                        if acquisition_deadline is not None and time.monotonic() >= acquisition_deadline:
                            session_budget_exhausted = True
                            break
                        if all(new_accepted_by_output_split[split] >= remaining_limits[split] for split in SPLITS):
                            break
                        scanned += 1
                        report["read"] += 1
                        if not isinstance(row, dict):
                            continue
                        absolute_index = start_offset + scanned
                        raw_identity = _row_identity(row, source_id, absolute_index)
                        assigned = _grouped_split(source, row, str(hf_split), raw_identity, seed)
                        if assigned not in SPLITS:
                            continue
                        if adapter in {"video_manifest", "metadata_only"}:
                            if new_accepted_by_output_split[assigned] >= remaining_limits[assigned]:
                                continue
                            metadata_fields = {
                                key: row.get(key) for key in (
                                    "video_id", "youtube_id", "videoid", "clip_id", "url", "contentUrl",
                                    "video_url", "video_path", "zip_folder", "page_dir",
                                    "image", "image_url", "conversations", "captions", "start", "end",
                                    "span_start", "span_end", "timestamp", "timestamps", "keyframe",
                                    "segment", "recipe_type", "name", "sentence", "caption", "text", "language",
                                ) if row.get(key) is not None
                            }
                            metadata_id = f"hf-{source_id}-{_stable_hash(raw_identity)[:24]}"
                            if metadata_id in existing_metadata_ids:
                                continue
                            metadata_rows.setdefault(source_id, []).append({
                                "id": metadata_id, "source_id": source_id, "source_revision": revision,
                                "source": source.get("repo"),
                                "source_url": str(source.get("url") or f"https://huggingface.co/datasets/{source['repo']}"),
                                "split": assigned,
                                "fields": metadata_fields,
                            })
                            existing_metadata_ids.add(metadata_id)
                            new_accepted_by_output_split[assigned] += 1
                            metadata_new_by_split[assigned] += 1
                            report["accepted"] += 1
                            report["metadata_only"] = report.get("metadata_only", 0) + 1
                            report["metadata_only_by_split"][assigned] += 1
                            per_hf_accepted[assigned] += 1
                        else:
                            if new_accepted_by_output_split[assigned] >= remaining_limits[assigned]:
                                # Keep overflow rows for a future larger profile rather than dropping them.
                                conversion_error = None
                                try:
                                    source["_resolved_revision"] = revision
                                    record = _record_from_row(row, source, raw_identity, assigned, assets_root)
                                    if record is not None and not external_record_is_trainable(record):
                                        raise ValueError("external record metadata is incomplete")
                                except StackAccessRequired:
                                    raise
                                except Exception as exc:
                                    if adapter == "stack_v2_code":
                                        raise
                                    record = None
                                    conversion_error = {
                                        "split": str(hf_split), "row_id_sha256": _stable_hash(raw_identity)[:16],
                                        "type": type(exc).__name__, "message": str(exc)[:320],
                                    }
                                if record is None:
                                    report["failed_rows"] += 1
                                    if conversion_error is not None:
                                        samples = report.setdefault("conversion_error_samples", [])
                                        if len(samples) < 10:
                                            samples.append(conversion_error)
                                    continue
                                record_id = str(record.get("id", ""))
                                if record_id not in seen_source_ids:
                                    pending_entry = {
                                        "source_id": source_id, "source_revision": revision,
                                        "split": assigned, "record": record,
                                    }
                                    pending_keep.append(pending_entry)
                                    seen_source_ids.add(record_id)
                                    report["pending_rows_added"] += 1
                                    per_hf_pending[assigned] += 1
                                continue
                            conversion_error = None
                            try:
                                source["_resolved_revision"] = revision
                                record = _record_from_row(row, source, raw_identity, assigned, assets_root)
                                if record is not None and not external_record_is_trainable(record):
                                    raise ValueError("external record metadata is incomplete")
                            except StackAccessRequired:
                                raise
                            except Exception as exc:
                                if adapter == "stack_v2_code":
                                    raise
                                record = None
                                conversion_error = {
                                    "split": str(hf_split), "row_id_sha256": _stable_hash(raw_identity)[:16],
                                    "type": type(exc).__name__, "message": str(exc)[:320],
                                }
                            if record is None:
                                report["failed_rows"] += 1
                                if conversion_error is not None:
                                    samples = report.setdefault("conversion_error_samples", [])
                                    if len(samples) < 10:
                                        samples.append(conversion_error)
                            else:
                                record_id = str(record.get("id", ""))
                                if record_id in seen_source_ids:
                                    continue
                                rows_by_split[assigned].append(record)
                                seen_source_ids.add(record_id)
                                new_accepted_by_output_split[assigned] += 1
                                per_hf_accepted[assigned] += 1
                                report["accepted"] += 1
                        if scanned >= max_scan:
                            break
                    else:
                        split_exhausted = True
                    if split_exhausted:
                        source_splits_exhausted.add(str(hf_split))
                except StackAccessRequired as exc:
                    split_had_error = True
                    source_access_blocked = True
                    report["status"] = "access_required"
                    report["required_for_training"] = True
                    report.setdefault("errors", []).append({
                        "split": str(hf_split), "type": type(exc).__name__, "message": str(exc)[:500],
                    })
                except Exception as exc:
                    split_had_error = True
                    message = str(exc)
                    access_markers = ("gatedrepoerror", "access denied", "not authorized", "403", "401", "restricted")
                    if source.get("required_for_training") and any(
                        marker in (type(exc).__name__ + " " + message).casefold() for marker in access_markers
                    ):
                        source_access_blocked = True
                        report["status"] = "access_required"
                    report.setdefault("errors", []).append({
                        "split": str(hf_split), "type": type(exc).__name__, "message": message[:500],
                    })
                checkpointed_total = start_offset + scanned if not split_had_error else start_offset
                if cursor is not None and dataset is not None and not split_had_error:
                    cursor_snapshots.append((source_id, str(hf_split), cursor, dataset, checkpointed_total))
                    report["crawler_cursors"][str(hf_split)] = {
                        "mode": "awaiting_manifest_commit", "rows_read": checkpointed_total,
                    }
                elif split_had_error:
                    report["crawler_cursors"][str(hf_split)] = {
                        "mode": "previous_checkpoint_preserved", "rows_read": start_offset,
                    }
                report["by_split"][str(hf_split)] = {
                    "start_offset": start_offset, "scanned": scanned,
                    "total_scanned": checkpointed_total,
                    "attempted_total_scanned": start_offset + scanned,
                    "accepted": per_hf_accepted, "pending": per_hf_pending,
                    "source_split_exhausted": split_exhausted,
                    "cursor_committed": not split_had_error,
                }
                if session_budget_exhausted or source_access_blocked:
                    break

        pending_final = pending_keep
        pending_dedup: dict[str, dict[str, Any]] = {}
        for entry in pending_final:
            record_id = str(entry.get("record", {}).get("id", ""))
            if record_id:
                pending_dedup.setdefault(record_id, entry)
        pending_final = [pending_dedup[key] for key in sorted(pending_dedup)]
        pending_counts = {split: 0 for split in SPLITS}
        for entry in pending_final:
            pending_counts[str(entry.get("split", ""))] += 1
        report["pending_rows_by_output_split"] = pending_counts
        _write_jsonl_atomic(pending_paths[0], pending_final)
        _write_jsonl_atomic(pending_paths[1], pending_final)
        report["total_read"] = sum(
            int(item.get("attempted_total_scanned", item.get("total_scanned", 0)))
            for item in report["by_split"].values()
        )
        targets_reached = all(
            new_accepted_by_output_split[split] >= remaining_limits[split] for split in SPLITS
        )
        all_source_splits_exhausted = set(str(value) for value in source.get("hf_splits", ["train"])) <= source_splits_exhausted
        if report.get("status") == "access_required":
            report["partial"] = True
        elif session_budget_exhausted:
            report["partial"] = True
            report["status"] = "partial"
        elif targets_reached or all_source_splits_exhausted or report.get("already_satisfied"):
            report["status"] = "completed"
        elif report.get("errors") and not report["read"]:
            report["status"] = "unavailable"
        else:
            # A scan cap is not the same as exhausting a multi-terabyte dataset.
            report["partial"] = True
            report["status"] = "partial"
        source_reports.append(report)
        if session_budget_exhausted:
            break

    # Keep a complete, resumable source ledger when a session ends on its time budget.
    if only_sources or session_budget_exhausted:
        current_ids = {str(item.get("source", "")) for item in source_reports}
        for source in registry.get("sources", []):
            source_id = str(source.get("id", ""))
            if source_id in current_ids:
                continue
            prior = prior_source_reports.get(source_id)
            if prior is not None:
                source_reports.append(prior)
            elif session_budget_exhausted and source.get("enabled", True):
                source_reports.append({
                    "source": source_id, "repo": source.get("repo"),
                    "adapter": source.get("adapter", "text"), "status": "pending",
                    "read": 0, "accepted": 0, "failed_rows": 0,
                })

    added_counts = _append_manifests(root, rows_by_split)
    metadata_counts: dict[str, int] = {}
    metadata_root = root / "data" / "metadata"
    for source_id, entries in metadata_rows.items():
        metadata_root.mkdir(parents=True, exist_ok=True)
        target = metadata_root / f"{source_id}.jsonl"
        existing = [
            json.loads(line) for line in target.read_text(encoding="utf-8").splitlines() if line.strip()
        ] if target.is_file() else []
        known = {item.get("id") for item in existing}
        merged = existing + [item for item in entries if item.get("id") not in known]
        _write_jsonl_atomic(target, merged)
        metadata_counts[source_id] = len(merged) - len(existing)

    # The manifest/payload commit must happen before the matching stream cursor.
    # If a runner dies before this point, the previous cursor causes a safe replay;
    # if it dies after this point, manifests are already durable and replay is idempotent.
    for source_id, hf_split, cursor, dataset, rows_read in cursor_snapshots:
        saved_cursor = cursor.save(dataset, rows_read)
        for source_report in source_reports:
            if str(source_report.get("source", "")) == source_id:
                source_report.setdefault("crawler_cursors", {})[hf_split] = saved_cursor
                break

    # Recompute cumulative source counts from the final manifests/metadata files.
    for source_report in source_reports:
        source_id = str(source_report.get("source", "")).strip()
        revision = str(source_report.get("revision", "")).strip()
        adapter = str(source_report.get("adapter", ""))
        if not source_id or not is_immutable_source_revision(revision):
            continue
        if adapter in {"metadata_only", "video_manifest"}:
            records_by_split = _source_metadata_records(root, source_id, revision)
            cumulative = {split: len(records_by_split[split]) for split in SPLITS}
        else:
            records_by_split = _source_manifest_records(root, source_id, revision)
            cumulative = {split: len(records_by_split[split]) for split in SPLITS}
        prior = source_report.get("prior_accepted_by_output_split") or {split: 0 for split in SPLITS}
        new_counts = {split: max(0, cumulative[split] - int(prior.get(split, 0))) for split in SPLITS}
        source_report["accepted_by_output_split"] = cumulative
        source_report["new_accepted_by_output_split"] = new_counts
        source_report["total_accepted"] = sum(cumulative.values())
        source_report["accepted"] = sum(new_counts.values())
        required_minimum = int(source_specs.get(source_id, {}).get("minimum_accepted_records", 0))
        if required_minimum:
            source_report["required_minimum_accepted_records"] = required_minimum
            source_report["required_minimum_met"] = sum(cumulative.values()) >= required_minimum
            if source_report.get("required_for_training") and not source_report["required_minimum_met"]:
                if source_report.get("status") == "completed":
                    source_report["status"] = "no_compatible_rows"
                source_report["partial"] = True
        if adapter in {"metadata_only", "video_manifest"}:
            source_report["metadata_only_by_split"] = cumulative
            source_report["metadata_only"] = sum(new_counts.values())

    task_counts = task_coverage(root)
    enabled_ids = {
        str(item.get("id", "")) for item in registry.get("sources", [])
        if item.get("enabled", True)
    }
    source_status = {str(item.get("source", "")): str(item.get("status", "")) for item in source_reports}
    terminal_statuses = {"completed", "unavailable", "access_token_unavailable", "no_compatible_rows"}
    source_specs = {
        str(item.get("id", "")): item for item in registry.get("sources", [])
        if item.get("enabled", True)
    }
    pending_sources = sorted(
        source_id for source_id in enabled_ids
        if source_status.get(source_id) not in terminal_statuses
        or (source_specs.get(source_id, {}).get("required_for_training") and source_status.get(source_id) != "completed")
    )
    acquisition_complete = not pending_sources
    output = {
        "profile": profile, "registry_version": registry.get("version"), **base_fingerprints,
        "source_revisions": source_revisions, "source_count": len(source_reports),
        "sources": source_reports, "new_records": added_counts, "new_metadata_rows": metadata_counts,
        "total_new_records": sum(added_counts.values()), "task_counts": task_counts,
        "acquisition_complete": acquisition_complete,
        "pending_sources": pending_sources,
        "session_budget_exhausted": session_budget_exhausted,
        "external_media_assets": ({split: _external_asset_report(root, split) for split in SPLITS}
                                   if acquisition_complete and time_budget_seconds is None else {}),
        "completed_sources": sum(1 for item in source_reports if item.get("status") == "completed"),
        "unavailable_sources": sum(1 for item in source_reports if item.get("status") in {"unavailable", "access_token_unavailable"}),
        "access_required_sources": sum(1 for item in source_reports if item.get("status") == "access_required"),
        "metadata_only_sources": sum(1 for item in source_reports if item.get("metadata_only", 0) > 0),
        "metadata_only_rows": sum(int(item.get("metadata_only", 0)) for item in source_reports),
        "sources_with_access_required": sum(1 for item in source_reports if item.get("status") in {"access_token_unavailable", "access_required"}),
        "sources_with_missing_usable_payloads": sum(1 for item in source_reports if item.get("required_for_training") and item.get("status") == "no_compatible_rows"),
    }
    report_path = root / "data" / "acquisition-report.json"
    report_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output

def main() -> None:
    parser = argparse.ArgumentParser(description="Acquire streaming datasets for the unified OneCore model")
    parser.add_argument("--root", default="onecore-ai")
    parser.add_argument("--profile", default="initial")
    parser.add_argument("--source", action="append", default=[])
    parser.add_argument("--time-budget-seconds", type=int, default=0)
    parser.add_argument("--require-tasks", default="")
    parser.add_argument("--min-train-records", type=int, default=25)
    parser.add_argument("--min-holdout-records", type=int, default=5)
    args = parser.parse_args()
    result = acquire_sources(
        args.root,
        profile=args.profile,
        only_sources=set(args.source) if args.source else None,
        time_budget_seconds=args.time_budget_seconds or None,
    )
    required = {value.strip() for value in args.require_tasks.split(",") if value.strip()}
    if required:
        result["task_coverage"] = assert_task_coverage(
            args.root, required, args.min_train_records, args.min_holdout_records
        )
        report_path = Path(args.root) / "data" / "acquisition-report.json"
        report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
