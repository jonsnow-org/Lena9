from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import torch
import yaml
from PIL import Image

from .audio import log_mel_spectrogram


SPLITS = ("train", "validation", "test")


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()



def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def _stable_split(source_id: str, row_id: str, seed: str = "onecore-shard-v1") -> str:
    bucket = int(_stable_hash(f"{seed}:{source_id}:{row_id}")[:8], 16) % 100
    if bucket < 96:
        return "train"
    if bucket < 98:
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
    for key in ("id", "sample_id", "__key__", "image_name", "filename", "file", "url", "path",
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
    return f"{primary or source_id}:{_stable_hash(normalized)}"}


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


def _license_for_row(row: dict[str, Any], source: dict[str, Any]) -> str:
    field = source.get("license_field")
    if field:
        value = _nested(row, str(field))
        if isinstance(value, list):
            value = ",".join(str(item) for item in value if item)
        if value is not None and str(value).strip():
            return str(value).strip()[:240]
    metadata = row.get("metadata")
    if isinstance(metadata, dict):
        for key in ("license", "detected_licenses"):
            value = metadata.get(key)
            if isinstance(value, list):
                value = ",".join(str(item) for item in value if item)
            if value is not None and str(value).strip():
                return str(value).strip()[:240]
    return str(source.get("license") or "source-card-terms")


def _record_from_row(
    row: dict[str, Any], source: dict[str, Any], row_id: str, split: str,
    assets_root: Path,
) -> dict[str, Any] | None:
    source_id = str(source["id"])
    adapter = str(source.get("adapter", "text"))
    prefix = f"{source_id}/{_stable_hash(row_id)[:20]}"
    source_url = str(source.get("url") or f"https://huggingface.co/datasets/{source['repo']}")
    attribution = str(source.get("attribution") or source["repo"])
    record_id = f"hf-{source_id}-{_stable_hash(row_id)[:24]}"
    record: dict[str, Any] = {
        "id": record_id,
        "license": _license_for_row(row, source),
        "source_url": source_url,
        "attribution": attribution,
        "split": split,
        "review_status": "pending",
        "data_class": "external_staged",
    }
    group_field = source.get("split_group_field")
    group_value = _nested(row, str(group_field)) if group_field else None
    if group_value is not None and str(group_value).strip():
        record["source_group_id"] = f"{source_id}:{str(group_value).strip()}"
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
    if adapter == "text":
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
            return None
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
            return None
        if text:
            record.update({"task": "audio_text", "audio_features": relative, "transcript": text[:900]})
        else:
            record.update({"task": "audio_reconstruction", "audio_features": relative})
    elif adapter in {"video", "video_url", "video_repo_file"}:
        video_value = _nested(row, str(source.get("video_field") or "video"))
        if adapter == "video_url":
            aliases = source.get("video_url_fields") or ["video_url", "contentUrl", "url"]
            if not (isinstance(video_value, str) and video_value.startswith(("http://", "https://"))):
                video_value = next((
                    row.get(str(field)) for field in aliases
                    if isinstance(row.get(str(field)), str)
                    and row.get(str(field)).startswith(("http://", "https://"))
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
            return None
        if text:
            record.update({"task": "video_caption", "frames": frames, "caption": text[:700]})
        else:
            record.update({"task": "video_reconstruction", "frames": frames})
    elif adapter == "video_manifest":
        # Metadata remains registered for later media resolution; no video pixels are fabricated.
        return None
    else:
        raise ValueError(f"unknown acquisition adapter: {adapter}")
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
    return _stable_split(str(source["id"]), row_id, seed)


def _grouped_split(
    source: dict[str, Any], row: dict[str, Any], hf_split: str, row_id: str, seed: str
) -> str:
    """Keep captions/segments of one media item in the same held-out partition."""
    group_field = source.get("split_group_field")
    group_value = _nested(row, str(group_field)) if group_field else None
    if group_value is None or not str(group_value).strip():
        return _assign_split(source, hf_split, row_id, seed)
    group_identity = f"{hf_split}:{str(group_value).strip()}"
    return _assign_split(source, hf_split, group_identity, seed)


def _append_manifests(project_root: Path, rows_by_split: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    """Append idempotently and keep repeated records/media groups in one split.

    When an identical record or grouped media appears in multiple incoming
    partitions, the stricter partition wins (test > validation > train).
    Conflicts with already-persisted partitions are rejected.
    """
    priority = {"train": 0, "validation": 1, "test": 2}
    existing_by_split: dict[str, list[dict[str, Any]]] = {}
    existing_ids: dict[str, str] = {}
    existing_groups: dict[str, str] = {}
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
                group_id = str(item.get("source_group_id", "")).strip()
                if group_id:
                    if group_id in existing_groups and existing_groups[group_id] != split:
                        raise ValueError(f"existing source group occurs in multiple splits: {group_id}")
                    existing_groups[group_id] = split
        existing_by_split[split] = existing

    incoming = [(split, dict(item)) for split in SPLITS for item in rows_by_split.get(split, [])]
    record_targets: dict[str, str] = {}
    group_targets: dict[str, str] = {}
    for source_split, item in incoming:
        record_id = str(item.get("id", "")).strip()
        if not record_id:
            raise ValueError(f"new {source_split} manifest record has an empty ID")
        if record_id in existing_ids:
            continue
        old_target = record_targets.get(record_id)
        if old_target is None or priority[source_split] > priority[old_target]:
            record_targets[record_id] = source_split
        group_id = str(item.get("source_group_id", "")).strip()
        if not group_id:
            continue
        existing_target = existing_groups.get(group_id)
        if existing_target is not None and existing_target != source_split:
            raise ValueError(
                f"new source group {group_id} conflicts with existing {existing_target} split"
            )
        old_group_target = group_targets.get(group_id)
        if old_group_target is None or priority[source_split] > priority[old_group_target]:
            group_targets[group_id] = source_split

    additions: dict[str, list[dict[str, Any]]] = {split: [] for split in SPLITS}
    for source_split, item in incoming:
        record_id = str(item.get("id", "")).strip()
        if record_id in existing_ids:
            continue
        group_id = str(item.get("source_group_id", "")).strip()
        target = record_targets[record_id]
        if group_id and group_id in group_targets and priority[group_targets[group_id]] > priority[target]:
            target = group_targets[group_id]
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


def external_task_coverage(project_root: str | Path) -> dict[str, dict[str, int]]:
    """Count external usable examples by modality, excluding deterministic bootstrap rows."""
    root = Path(project_root).resolve()
    task_groups = {
        "text": {"text"},
        "tool": {"tool_use"},
        "image": {"image_caption", "image_reconstruction"},
        "audio": {"audio_text", "audio_reconstruction"},
        "video": {"video_caption", "video_reconstruction"},
    }
    accepted_classes = {"external_staged", "external_reviewed"}
    coverage: dict[str, dict[str, int]] = {}
    for split in SPLITS:
        path = root / "data" / f"{split}.jsonl"
        records = [
            json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ] if path.is_file() else []
        records = [record for record in records if record.get("data_class") in accepted_classes]
        coverage[split] = {
            group: sum(1 for record in records if record.get("task") in tasks)
            for group, tasks in task_groups.items()
        }
    return coverage


def assert_external_task_coverage(
    project_root: str | Path, required_tasks: set[str],
    minimum_train: int = 25, minimum_holdout: int = 5,
) -> dict[str, dict[str, int]]:
    coverage = external_task_coverage(project_root)
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

def acquire_sources(
    project_root: str | Path,
    profile: str = "initial",
    source_file: str | Path | None = None,
    only_sources: set[str] | None = None,
) -> dict[str, Any]:
    """Stream selected Hugging Face datasets into OneCore's shared manifest/assets.

    Rows are deterministically sharded by source identity, so repeated GitHub jobs
    regenerate the same fixed corpus and preserve the checkpoint's data fingerprint.
    """
    root = Path(project_root).resolve()
    registry_path = Path(source_file) if source_file else root / "data" / "sources.yaml"
    registry = yaml.safe_load(registry_path.read_text(encoding="utf-8"))
    defaults = registry.get("defaults", {})
    seed = str(defaults.get("split_seed", "onecore-shard-v1"))
    assets_root = root / "data" / "assets"
    rows_by_split: dict[str, list[dict[str, Any]]] = {split: [] for split in SPLITS}
    source_reports: list[dict[str, Any]] = []
    base_fingerprints = _training_manifest_base(root)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    try:
        from datasets import Audio, load_dataset
        from huggingface_hub import HfApi
    except Exception as exc:
        raise RuntimeError("datasets and huggingface_hub are required for OneCore source acquisition") from exc

    previous_report_candidates = (
        root / "run-state" / "acquisition-report.json",
        root / "data" / "acquisition-report.json",
    )
    previous_report = {}
    for previous_report_path in previous_report_candidates:
        if previous_report_path.is_file():
            previous_report = json.loads(previous_report_path.read_text(encoding="utf-8"))
            break
    prior_revisions = previous_report.get("source_revisions", {})
    source_revisions: dict[str, str] = {}
    hub_api = HfApi(token=token)
    metadata_rows: dict[str, list[dict[str, Any]]] = {}
    for source in registry.get("sources", []):
        source_id = str(source.get("id", ""))
        if only_sources and source_id not in only_sources:
            continue
        if not source.get("enabled", True):
            source_reports.append({"source": source_id, "status": "disabled"})
            continue
        if source.get("requires_access") and not token:
            source_reports.append({"source": source_id, "status": "access_token_unavailable"})
            continue

        revision = source.get("revision") or prior_revisions.get(source_id)
        revision_error = None
        if not revision:
            try:
                revision = hub_api.dataset_info(str(source["repo"]), token=token).sha
            except Exception as exc:
                revision_error = f"{type(exc).__name__}: {str(exc)[:240]}"
                revision = None
        if revision:
            source_revisions[source_id] = str(revision)
        report = {
            "source": source_id, "repo": source.get("repo"), "revision": revision,
            "status": "started", "read": 0, "accepted": 0, "failed_rows": 0, "by_split": {},
        }
        if revision_error:
            report["revision_lookup_warning"] = revision_error
        limits = {str(k): int(v) for k, v in (source.get("limits") or {}).items()}
        for hf_split in source.get("hf_splits", ["train"]):
            try:
                load_kwargs = {
                    "path": str(source["repo"]),
                    "name": str(source.get("config") or "default"),
                    "split": str(hf_split),
                    "streaming": True,
                    "token": token,
                }
                if revision:
                    load_kwargs["revision"] = str(revision)
                dataset = load_dataset(**load_kwargs)
                if source.get("adapter") == "audio":
                    audio_field = str(source.get("audio_field") or "audio")
                    features = getattr(dataset, "features", None) or {}
                    audio_feature = features.get(audio_field) if hasattr(features, "get") else None
                    if audio_feature is not None and audio_feature.__class__.__name__ == "Audio":
                        dataset = dataset.cast_column(audio_field, Audio(decode=False))
                target_count = sum(limits.values()) or 1
                max_scan = max(target_count * int(defaults.get("max_scan_multiplier", 12)), target_count + 200)
                filled = {split: 0 for split in SPLITS}
                scanned = 0
                for row in dataset:
                    scanned += 1
                    report["read"] += 1
                    if not isinstance(row, dict):
                        continue
                    raw_identity = _row_identity(row, source_id, scanned)
                    row_id = raw_identity
                    assigned = _grouped_split(source, row, str(hf_split), row_id, seed)
                    if assigned not in SPLITS or filled[assigned] >= limits.get(assigned, 0):
                        if scanned >= max_scan or all(filled[s] >= limits.get(s, 0) for s in SPLITS):
                            break
                        continue
                    if source.get("adapter") in {"video_manifest", "metadata_only"}:
                        fields = {
                            key: row.get(key) for key in (
                                "video_id", "youtube_id", "videoid", "clip_id", "url", "contentUrl",
                                "video_url", "video_path", "zip_folder", "page_dir",
                                "image", "image_url", "conversations", "captions", "start", "end",
                                "span_start", "span_end", "timestamp", "timestamps", "keyframe",
                                "segment", "recipe_type", "name", "sentence", "caption", "text", "language",
                            ) if row.get(key) is not None
                        }
                        metadata_rows.setdefault(source_id, []).append({
                            "id": f"hf-{source_id}-{_stable_hash(row_id)[:24]}",
                            "source": source.get("repo"),
                            "source_url": str(source.get("url") or f"https://huggingface.co/datasets/{source['repo']}"),
                            "attribution": source.get("attribution"),
                            "split": assigned,
                            "fields": fields,
                        })
                        filled[assigned] += 1
                        report["accepted"] += 1
                        report["metadata_only"] = report.get("metadata_only", 0) + 1
                        continue
                    try:
                        source["_resolved_revision"] = revision
                        record = _record_from_row(row, source, row_id, assigned, assets_root)
                    except Exception:
                        record = None
                    if record is None:
                        report["failed_rows"] += 1
                    else:
                        rows_by_split[assigned].append(record)
                        filled[assigned] += 1
                        report["accepted"] += 1
                    if scanned >= max_scan or all(filled[s] >= limits.get(s, 0) for s in SPLITS):
                        break
                report["by_split"][str(hf_split)] = {"scanned": scanned, "accepted": filled}
            except Exception as exc:
                report.setdefault("errors", []).append(
                    {"split": str(hf_split), "type": type(exc).__name__, "message": str(exc)[:500]}
                )
        report["status"] = "completed" if report["accepted"] else (
            "unavailable" if report.get("errors") else "no_compatible_rows"
        )
        source_reports.append(report)

    added_counts = _append_manifests(root, rows_by_split)
    metadata_counts: dict[str, int] = {}
    metadata_root = root / "data" / "metadata"
    for source_id, entries in metadata_rows.items():
        metadata_root.mkdir(parents=True, exist_ok=True)
        target = metadata_root / f"{source_id}.jsonl"
        existing = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines() if line.strip()] if target.is_file() else []
        known = {item.get("id") for item in existing}
        merged = existing + [item for item in entries if item.get("id") not in known]
        target.write_text(
            "\n".join(json.dumps(item, ensure_ascii=False, sort_keys=True) for item in merged)
            + ("\n" if merged else ""), encoding="utf-8"
        )
        metadata_counts[source_id] = len(merged) - len(existing)
    task_groups = {
        "text": {"text"}, "tool": {"tool_use"},
        "image": {"image_caption", "image_reconstruction"},
        "audio": {"audio_text", "audio_reconstruction"},
        "video": {"video_caption", "video_reconstruction"},
    }
    external_task_counts = {}
    for split in SPLITS:
        manifest = root / "data" / f"{split}.jsonl"
        records = [json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()] if manifest.is_file() else []
        external = [item for item in records if item.get("data_class") in {"external_staged", "external_reviewed"}]
        external_task_counts[split] = {group: sum(1 for item in external if item.get("task") in tasks) for group, tasks in task_groups.items()}
    output = {
        "profile": profile,
        "registry_version": registry.get("version"),
        **base_fingerprints,
        "source_revisions": source_revisions,
        "source_count": len(source_reports),
        "sources": source_reports,
        "new_records": added_counts,
        "new_metadata_rows": metadata_counts,
        "total_new_records": sum(added_counts.values()),
        "external_task_counts": external_task_counts,
        "completed_sources": sum(1 for item in source_reports if item.get("status") == "completed"),
        "unavailable_sources": sum(1 for item in source_reports if item.get("status") == "unavailable"),
        "metadata_only_sources": sum(1 for item in source_reports if item.get("metadata_only", 0) > 0),
        "sources_with_access_required": sum(1 for item in source_reports if item.get("status") == "access_token_unavailable"),
    }
    report_path = root / "data" / "acquisition-report.json"
    report_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Acquire streaming datasets for the unified OneCore model")
    parser.add_argument("--root", default="onecore-ai")
    parser.add_argument("--profile", default="initial")
    parser.add_argument("--source", action="append", default=[])
    parser.add_argument("--require-tasks", default="")
    parser.add_argument("--min-train-records", type=int, default=25)
    parser.add_argument("--min-holdout-records", type=int, default=5)
    args = parser.parse_args()
    result = acquire_sources(
        args.root,
        profile=args.profile,
        only_sources=set(args.source) if args.source else None,
    )
    required = {value.strip() for value in args.require_tasks.split(",") if value.strip()}
    if required:
        result["external_task_coverage"] = assert_external_task_coverage(
            args.root, required, args.min_train_records, args.min_holdout_records
        )
        report_path = Path(args.root) / "data" / "acquisition-report.json"
        report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
