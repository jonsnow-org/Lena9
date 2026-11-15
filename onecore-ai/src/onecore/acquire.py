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


def _row_identity(row: dict[str, Any], source_id: str, index: int) -> str:
    for key in ("id", "sample_id", "image_name", "filename", "file", "url", "path", "video_id"):
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    metadata = row.get("metadata")
    if isinstance(metadata, dict):
        for key in ("id", "content_id", "blob_id", "filename", "path"):
            value = metadata.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
    return f"{source_id}:{index}:{_stable_hash(json.dumps(row, default=str, sort_keys=True)[:2048])}"


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
        if raw:
            return Image.open(io.BytesIO(raw)).convert("RGB")
        if path and Path(path).is_file():
            return Image.open(path).convert("RGB")
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
        if raw or path:
            try:
                import soundfile as sf
                source = io.BytesIO(raw) if raw else str(path)
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
    text = _first_text(row, list(source.get("text_fields") or []))
    if adapter == "text":
        if len(text) < 24:
            return None
        record.update({"task": "text", "text": text[:2200]})
    elif adapter in {"image", "image_url", "image_base64"}:
        image_value = _nested(row, str(source.get("image_field") or "image"))
        relative = f"acquired/{prefix}.png"
        if not _save_image(image_value, assets_root / relative):
            return None
        if text:
            record.update({"task": "image_caption", "image": relative, "caption": text[:700]})
        else:
            record.update({"task": "image_reconstruction", "image": relative})
    elif adapter == "audio":
        audio_value = _nested(row, str(source.get("audio_field") or "audio"))
        relative = f"acquired/{prefix}.npy"
        if not _save_audio_features(audio_value, assets_root / relative):
            return None
        if text:
            record.update({"task": "audio_text", "audio_features": relative, "transcript": text[:900]})
        else:
            record.update({"task": "audio_reconstruction", "audio_features": relative})
    elif adapter == "video":
        video_value = _nested(row, str(source.get("video_field") or "video"))
        frames = _write_frames(video_value, assets_root, prefix)
        if not frames:
            # Some video records publish a direct media URL rather than decoded frames.
            url = row.get("video_url") or row.get("url")
            if isinstance(url, str) and url.lower().split("?")[0].endswith((".mp4", ".webm", ".mov")):
                try:
                    request = urllib.request.Request(url, headers={"User-Agent": "OneCore-data-ingest/1.0"})
                    with urllib.request.urlopen(request, timeout=45) as response:
                        raw = response.read(80 * 1024 * 1024)
                    frames = _write_frames({"bytes": raw}, assets_root, prefix)
                except Exception:
                    frames = []
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


def _append_manifests(project_root: Path, rows_by_split: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for split in SPLITS:
        path = project_root / "data" / f"{split}.jsonl"
        existing: list[dict[str, Any]] = []
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    item = json.loads(line)
                    item.pop("_line", None)
                    existing.append(item)
        seen = {str(item.get("id")) for item in existing}
        added = [item for item in rows_by_split[split] if str(item.get("id")) not in seen]
        combined = existing + added
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(
            "\n".join(json.dumps(item, ensure_ascii=False, sort_keys=True) for item in combined) + "\n",
            encoding="utf-8",
        )
        os.replace(temp, path)
        counts[split] = len(added)
    return counts


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
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    try:
        from datasets import load_dataset
    except Exception as exc:
        raise RuntimeError("The datasets package is required for OneCore source acquisition") from exc

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

        report = {"source": source_id, "repo": source.get("repo"), "status": "started",
                  "read": 0, "accepted": 0, "failed_rows": 0, "by_split": {}}
        limits = {str(k): int(v) for k, v in (source.get("limits") or {}).items()}
        for hf_split in source.get("hf_splits", ["train"]):
            try:
                dataset = load_dataset(
                    str(source["repo"]),
                    str(source.get("config") or "default"),
                    split=str(hf_split),
                    streaming=True,
                    token=token,
                )
                target_count = sum(limits.values()) or 1
                max_scan = max(target_count * int(defaults.get("max_scan_multiplier", 12)), target_count + 200)
                filled = {split: 0 for split in SPLITS}
                scanned = 0
                for row in dataset:
                    scanned += 1
                    report["read"] += 1
                    if not isinstance(row, dict):
                        continue
                    row_id = _row_identity(row, source_id, scanned)
                    assigned = _assign_split(source, str(hf_split), row_id, seed)
                    if assigned not in SPLITS or filled[assigned] >= limits.get(assigned, 0):
                        if scanned >= max_scan or all(filled[s] >= limits.get(s, 0) for s in SPLITS):
                            break
                        continue
                    if source.get("adapter") in {"video_manifest", "metadata_only"}:
                        fields = {
                            key: row.get(key) for key in (
                                "video_id", "youtube_id", "url", "video_url", "start",
                                "end", "timestamp", "caption", "text", "language",
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
    output = {
        "profile": profile,
        "registry_version": registry.get("version"),
        "source_count": len(source_reports),
        "sources": source_reports,
        "new_records": added_counts,
        "new_metadata_rows": metadata_counts,
        "total_new_records": sum(added_counts.values()),
    }
    report_path = root / "data" / "acquisition-report.json"
    report_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Acquire streaming datasets for the unified OneCore model")
    parser.add_argument("--root", default="onecore-ai")
    parser.add_argument("--profile", default="initial")
    parser.add_argument("--source", action="append", default=[])
    args = parser.parse_args()
    result = acquire_sources(
        args.root,
        profile=args.profile,
        only_sources=set(args.source) if args.source else None,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
