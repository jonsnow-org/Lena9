"""Bounded CPU resource profiling against the already-validated V3 corpus.

This is a measurement harness, not a training runner. It range-reads the existing
GitHub artifacts, extracts representative real samples plus a quota-complete
five-family loader slice, and performs no optimizer steps or checkpoint writes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import random
import resource
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

import numpy as np
import soundfile as sf
import torch
from PIL import Image
from tokenizers import Tokenizer
from torch.nn import functional as F

try:
    import requests
    from remotezip import RemoteZip
except ImportError:  # supplied only by the explicit corpus-restore extra
    requests = None
    RemoteZip = None

from onecore.data import external_record_is_trainable, has_immutable_external_provenance
from onecore.v3.config import V3Config
from onecore.v3.dataset import CONDITION_FIELDS, V3JointDataLoader, _asset_paths, _window_start
from onecore.v3.manifest import TASK_GROUPS, read_v3_manifest
from onecore.v3.report import build_report
from onecore.v3.tokenizer import sha256_file, verify_v3_tokenizer
from onecore.v3.training import OneCoreV3Objective

MIN_MEASURED_ITERATIONS = 5


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _artifact_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


PINNED_V3_BENCHMARK_ARTIFACTS: dict[str, dict[str, Any]] = {
    "corpus": {
        "artifact_id": 14892594659,
        "workflow_run_id": 45325008221,
        "name": "onecore-v3-corpus-45325008221",
        "size_in_bytes": 24_432_975_285,
        "digest": "sha256:302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2",
    },
    "conversion_report": {
        "artifact_id": 14893020087,
        "workflow_run_id": 45325008221,
        "name": "onecore-v3-conversion-report-45325008221",
        "size_in_bytes": 892_194,
        "digest": "sha256:151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba",
    },
    "tokenizer": {
        "artifact_id": 14894835517,
        "workflow_run_id": 45336933362,
        "name": "onecore-v3-tokenizer-45325008221",
        "size_in_bytes": 394_036,
        "digest": "sha256:47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6",
    },
}


def _artifact_metadata(
    repo: str,
    artifact_id: int,
    token: str,
    expected_run_id: int,
    *,
    expected_name: str,
    expected_size_in_bytes: int,
    expected_digest: str,
) -> dict[str, Any]:
    if requests is None or RemoteZip is None:
        raise RuntimeError("resource benchmark requires onecore-ai[corpus-restore]")
    response = requests.get(
        f"https://api.github.com/repos/{repo}/actions/artifacts/{artifact_id}",
        headers=_artifact_headers(token), timeout=60,
    )
    response.raise_for_status()
    metadata = response.json()
    if metadata.get("expired"):
        raise RuntimeError(f"required V3 artifact {artifact_id} is expired")

    actual_id = int(metadata.get("id", -1))
    actual_name = str(metadata.get("name", ""))
    actual_size = int(metadata.get("size_in_bytes", -1))
    actual_digest = metadata.get("digest")
    workflow_run = metadata.get("workflow_run") or {}
    actual_run_id = int(workflow_run.get("id", -1))
    expected = {
        "id": int(artifact_id),
        "name": expected_name,
        "size_in_bytes": int(expected_size_in_bytes),
        "digest": expected_digest,
        "workflow_run_id": int(expected_run_id),
    }
    actual = {
        "id": actual_id,
        "name": actual_name,
        "size_in_bytes": actual_size,
        "digest": actual_digest,
        "workflow_run_id": actual_run_id,
    }
    for field, expected_value in expected.items():
        if actual[field] != expected_value:
            raise RuntimeError(
                f"pinned V3 {field} mismatch for artifact {artifact_id}: "
                f"actual={actual[field]!r}, expected={expected_value!r}"
            )
    return {
        **actual,
        "expired": bool(metadata.get("expired", False)),
    }


def _pinned_artifact_metadata(
    repo: str,
    token: str,
    kind: str,
    requested_artifact_id: int,
    requested_run_id: int,
) -> dict[str, Any]:
    pinned = PINNED_V3_BENCHMARK_ARTIFACTS.get(kind)
    if pinned is None:
        raise ValueError(f"unknown pinned V3 benchmark artifact kind: {kind}")
    if (
        int(requested_artifact_id) != pinned["artifact_id"]
        or int(requested_run_id) != pinned["workflow_run_id"]
    ):
        raise RuntimeError(
            f"resource benchmark {kind} must use pinned artifact "
            f"{pinned['artifact_id']} from run {pinned['workflow_run_id']}"
        )
    return _artifact_metadata(
        repo,
        pinned["artifact_id"],
        token,
        pinned["workflow_run_id"],
        expected_name=pinned["name"],
        expected_size_in_bytes=pinned["size_in_bytes"],
        expected_digest=pinned["digest"],
    )


def _signed_artifact_url(repo: str, artifact_id: int, token: str) -> str:
    response = requests.get(
        f"https://api.github.com/repos/{repo}/actions/artifacts/{artifact_id}/zip",
        headers=_artifact_headers(token), allow_redirects=False, stream=True, timeout=60,
    )
    try:
        if response.status_code not in {301, 302, 303, 307, 308}:
            raise RuntimeError(
                f"artifact {artifact_id} did not return a signed redirect: "
                f"HTTP {response.status_code}"
            )
        location = response.headers.get("Location")
        if not location:
            raise RuntimeError(f"artifact {artifact_id} omitted its signed URL")
        return location
    finally:
        response.close()


def _unique_suffix(names: list[str], suffix: str) -> str:
    normalized = [str(name).replace("\\", "/") for name in names]
    matches = [name for name in normalized if name == suffix or name.endswith("/" + suffix)]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one artifact member ending in {suffix!r}; found {len(matches)}")
    return matches[0]


def _unique_basename(names: list[str], basename: str) -> str:
    matches = [name for name in names if PurePosixPath(str(name).replace("\\", "/")).name == basename]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one artifact member named {basename!r}; found {len(matches)}")
    return matches[0]

def _tokenizer_members(names: list[str], evidence: dict[str, Any]) -> tuple[str, str, str]:
    filename = evidence.get("tokenizer_file")
    if not isinstance(filename, str) or not filename or PurePosixPath(filename).name != filename:
        raise ValueError("tokenizer evidence must name a plain tokenizer JSON filename")
    tokenizer_member = _unique_basename(names, filename)
    evidence_member = _unique_basename(names, filename + ".evidence.json")
    return tokenizer_member, evidence_member, filename


def _safe_relative(value: Any) -> str:
    raw = str(value or "").replace("\\", "/")
    path = PurePosixPath(raw)
    if not raw or path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"unsafe V3 asset path: {raw!r}")
    return path.as_posix()


def _extract_member(archive: Any, member: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise FileExistsError(f"refusing to overwrite benchmark input: {destination}")
    temporary = destination.with_name(destination.name + ".partial")
    try:
        with archive.open(member) as source, temporary.open("wb") as target:
            shutil.copyfileobj(source, target, length=1024 * 1024)
            target.flush()
            os.fsync(target.fileno())
        temporary.replace(destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def _extract_verified_asset(
    archive: Any,
    members: list[str],
    relative: str,
    assets_root: Path,
    asset_hashes: dict[str, Any],
) -> Path:
    safe = _safe_relative(relative)
    expected = asset_hashes.get(safe)
    if (
        not isinstance(expected, str) or len(expected) != 64
        or any(char not in "0123456789abcdef" for char in expected.lower())
    ):
        raise ValueError(f"selected V3 asset has no valid manifest SHA-256: {safe}")
    destination = assets_root / safe
    if destination.exists():
        actual = sha256_file(destination)
        if actual != expected.lower():
            raise ValueError(f"existing benchmark asset hash mismatch: {safe}")
        return destination
    member = _unique_suffix(members, f"data/assets/{safe}")
    _extract_member(archive, member, destination)
    actual = sha256_file(destination)
    if actual != expected.lower():
        raise ValueError(f"selected corpus asset SHA-256 mismatch: {safe}")
    return destination


def _read_conversion_report(repo: str, artifact_id: int, token: str) -> tuple[dict[str, Any], bytes]:
    url = _signed_artifact_url(repo, artifact_id, token)
    matches: list[tuple[dict[str, Any], bytes]] = []
    with RemoteZip(url, support_suffix_range=False) as archive:
        for name in archive.namelist():
            if not str(name).lower().endswith(".json"):
                continue
            info = archive.getinfo(name)
            if int(info.file_size) > 12 * 1024 * 1024:
                continue
            with archive.open(name) as stream:
                payload = stream.read(12 * 1024 * 1024 + 1)
            if len(payload) > 12 * 1024 * 1024:
                continue
            try:
                value = json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if isinstance(value, dict) and isinstance(value.get("manifest_gate"), dict):
                matches.append((value, payload))
    if len(matches) != 1:
        raise ValueError(
            f"conversion report artifact must contain exactly one manifest-gate JSON; found {len(matches)}"
        )
    return matches[0]


def _distribution(values: list[float | int]) -> dict[str, float | int] | None:
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    index = max(0, min(len(ordered) - 1, math.ceil(0.95 * len(ordered)) - 1))
    return {
        "count": len(ordered),
        "min": ordered[0],
        "median": float(np.median(ordered)),
        "p95": ordered[index],
        "max": ordered[-1],
    }


def _family(task: str) -> str | None:
    return next((name for name, tasks in TASK_GROUPS.items() if task in tasks), None)


def _select_train_samples(
    train_manifest: Path,
    *,
    max_image_megapixels: float,
    max_audio_seconds: float,
    max_video_megapixels: float,
    max_video_frames: int,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    selected: dict[str, dict[str, Any]] = {}
    best: dict[str, tuple[float, dict[str, Any]]] = {}
    fallback: dict[str, tuple[float, dict[str, Any]]] = {}
    best_conditioned: dict[str, tuple[float, dict[str, Any]]] = {}
    fallback_conditioned: dict[str, tuple[float, dict[str, Any]]] = {}
    stats: dict[str, list[float]] = {
        "text_characters": [], "tool_characters": [],
        "image_megapixels": [], "image_width": [], "image_height": [],
        "audio_duration_seconds": [], "audio_source_sample_rate": [],
        "audio_training_sample_rate": [], "audio_training_channels": [],
        "video_frame_count": [], "video_duration_seconds": [],
        "video_megapixels_per_frame": [], "video_fps": [],
    }

    for row in read_v3_manifest(train_manifest):
        if str(row.get("split", "")) != "train":
            raise ValueError("resource benchmark accepts only the V3 train manifest")
        if not external_record_is_trainable(row) or not has_immutable_external_provenance(row):
            continue
        family = _family(str(row.get("task", "")))
        if family is None:
            continue
        record_id = str(row.get("id", "")).strip()
        if not record_id:
            continue
        candidate: dict[str, Any] = {
            "family": family,
            "record_id": record_id,
            "source_id": str(row.get("source_id", "")),
            "source_revision": str(row.get("source_revision", "")),
            "source_row_id_sha256": str(row.get("source_row_id_sha256", "")),
        }
        condition_field = CONDITION_FIELDS.get(str(row.get("task", "")))
        if condition_field is not None:
            condition_text = row.get(condition_field)
            if not isinstance(condition_text, str) or not condition_text.strip():
                continue
            candidate["condition_field"] = condition_field
            candidate["condition_text"] = condition_text.strip()

        if family == "text":
            text_value = row.get("text")
            if not isinstance(text_value, str) or not text_value.strip():
                continue
            candidate["text"] = text_value
            candidate["characters"] = len(text_value)
            stats["text_characters"].append(len(text_value))
            score = float(len(text_value))
            if score > best.get(family, (-1.0, {}))[0]:
                best[family] = (score, candidate)

        elif family == "tool":
            prompt = row.get("prompt")
            response = row.get("response")
            if not isinstance(prompt, str):
                continue
            response_text = response if isinstance(response, str) else json.dumps(
                response, ensure_ascii=False, sort_keys=True
            )
            text_value = prompt + "\n" + response_text
            candidate["text"] = text_value
            candidate["characters"] = len(text_value)
            stats["tool_characters"].append(len(text_value))
            score = float(len(text_value))
            if score > best.get(family, (-1.0, {}))[0]:
                best[family] = (score, candidate)

        elif family == "image":
            media = (row.get("assets") or {}).get("image") or {}
            path = media.get("source_asset")
            width, height = int(media.get("width", 0)), int(media.get("height", 0))
            if not path or min(width, height) < 1:
                continue
            pixels = width * height
            megapixels = pixels / 1_000_000
            stats["image_megapixels"].append(megapixels)
            stats["image_width"].append(width)
            stats["image_height"].append(height)
            candidate.update({
                "asset_paths": [_safe_relative(path)],
                "width": width, "height": height, "megapixels": megapixels,
            })
            if megapixels <= max_image_megapixels and megapixels > best.get(family, (-1.0, {}))[0]:
                best[family] = (megapixels, candidate)
            if megapixels < fallback.get(family, (float("inf"), {}))[0]:
                fallback[family] = (megapixels, candidate)
            if condition_field is not None:
                if megapixels <= max_image_megapixels and megapixels > best_conditioned.get(family, (-1.0, {}))[0]:
                    best_conditioned[family] = (megapixels, candidate)
                if megapixels < fallback_conditioned.get(family, (float("inf"), {}))[0]:
                    fallback_conditioned[family] = (megapixels, candidate)

        elif family == "audio":
            media = (row.get("assets") or {}).get("audio") or {}
            path = media.get("training_asset")
            source_path = media.get("source_asset")
            training_rate = int(media.get("training_sample_rate", 0))
            training_channels = int(media.get("training_channels", media.get("channels", 0)))
            samples = int(media.get("training_samples", 0))
            duration = samples / training_rate if samples > 0 and training_rate > 0 else float(
                media.get("duration_seconds", 0.0)
            )
            if not path or duration <= 0 or training_rate != 24_000 or training_channels not in (1, 2):
                continue
            stats["audio_duration_seconds"].append(duration)
            stats["audio_source_sample_rate"].append(int(media.get("sample_rate", 0)))
            stats["audio_training_sample_rate"].append(training_rate)
            stats["audio_training_channels"].append(training_channels)
            candidate.update({
                "asset_paths": [_safe_relative(path)],
                "source_asset": _safe_relative(source_path) if source_path else None,
                "duration_seconds": duration,
                "training_sample_rate": training_rate,
                "training_channels": training_channels,
            })
            if duration <= max_audio_seconds and duration > best.get(family, (-1.0, {}))[0]:
                best[family] = (duration, candidate)
            if duration < fallback.get(family, (float("inf"), {}))[0]:
                fallback[family] = (duration, candidate)
            if condition_field is not None:
                if duration <= max_audio_seconds and duration > best_conditioned.get(family, (-1.0, {}))[0]:
                    best_conditioned[family] = (duration, candidate)
                if duration < fallback_conditioned.get(family, (float("inf"), {}))[0]:
                    fallback_conditioned[family] = (duration, candidate)

        else:
            media = (row.get("assets") or {}).get("video") or {}
            frames = media.get("frames")
            if not isinstance(frames, list) or not frames:
                continue
            width, height = int(media.get("width", 0)), int(media.get("height", 0))
            frame_count = int(media.get("frame_count", len(frames)))
            duration = media.get("duration_seconds")
            fps = media.get("fps")
            megapixels = (width * height / 1_000_000) if width > 0 and height > 0 else 0.0
            stats["video_frame_count"].append(frame_count)
            if isinstance(duration, (int, float)) and duration > 0:
                stats["video_duration_seconds"].append(float(duration))
            if megapixels > 0:
                stats["video_megapixels_per_frame"].append(megapixels)
            if isinstance(fps, (int, float)) and fps > 0:
                stats["video_fps"].append(float(fps))
            safe_frames = [_safe_relative(item) for item in frames[:max_video_frames]]
            timestamps = media.get("timestamps")
            if isinstance(timestamps, list):
                if len(timestamps) != len(frames):
                    raise ValueError(f"video timestamp count mismatch in record {record_id}")
                timestamps = timestamps[:len(safe_frames)]
            else:
                timestamps = None
            candidate.update({
                "asset_paths": safe_frames,
                "frame_count": frame_count,
                "benchmark_frame_count": len(safe_frames),
                "timestamps": timestamps,
                "timestamp_unit": media.get("timestamp_unit"),
                "width": width, "height": height,
                "megapixels_per_frame": megapixels,
                "duration_seconds": duration,
                "fps": fps,
            })
            score = float(len(safe_frames))
            if megapixels <= max_video_megapixels and score > best.get(family, (-1.0, {}))[0]:
                best[family] = (score, candidate)
            if megapixels < fallback.get(family, (float("inf"), {}))[0]:
                fallback[family] = (megapixels, candidate)
            if condition_field is not None:
                if megapixels <= max_video_megapixels and score > best_conditioned.get(family, (-1.0, {}))[0]:
                    best_conditioned[family] = (score, candidate)
                if megapixels < fallback_conditioned.get(family, (float("inf"), {}))[0]:
                    fallback_conditioned[family] = (megapixels, candidate)

    for family in ("text", "tool", "image", "audio", "video"):
        value = (
            best_conditioned.get(family)
            or best.get(family)
            or fallback_conditioned.get(family)
            or fallback.get(family)
        )
        if value is None:
            raise ValueError(f"no immutable external train sample is available for {family}")
        selected[family] = value[1]

    summaries = {name: _distribution(values) for name, values in stats.items()}
    return selected, summaries



def _select_loader_benchmark_rows(
    manifest_paths: dict[str, Path],
    *,
    max_image_megapixels: float,
    max_audio_seconds: float,
    max_video_megapixels: float,
    max_video_frames: int,
    seed: int = 20261124,
) -> tuple[dict[str, dict[str, list[dict[str, Any]]]], dict[str, Any]]:
    """Choose a deterministic, quota-complete external sample for the real V3 loader."""
    required = {"train", "validation", "test"}
    if set(manifest_paths) != required:
        raise ValueError("loader benchmark requires train, validation and test manifests")
    if min(max_image_megapixels, max_audio_seconds, max_video_megapixels) <= 0 or max_video_frames < 1:
        raise ValueError("loader benchmark resource caps must be positive")

    rows_by_split: dict[str, dict[str, list[dict[str, Any]]]] = {}
    selection_stats: dict[str, Any] = {}
    for split in ("train", "validation", "test"):
        quota = 100 if split == "train" else 10
        reservoirs = {family: [] for family in TASK_GROUPS}
        seen = {family: 0 for family in TASK_GROUPS}
        rejected_by_cap = {family: 0 for family in TASK_GROUPS}
        rngs = {
            family: random.Random(int.from_bytes(
                hashlib.sha256(f"{seed}:{split}:{family}".encode("utf-8")).digest()[:8],
                "big",
            ))
            for family in TASK_GROUPS
        }

        for row in read_v3_manifest(manifest_paths[split]):
            if str(row.get("split", "")) != split:
                raise ValueError(f"V3 {split} manifest contains a row assigned to another split")
            if not external_record_is_trainable(row) or not has_immutable_external_provenance(row):
                continue
            family = _family(str(row.get("task", "")))
            if family is None:
                continue
            record_id = str(row.get("id", "")).strip()
            if not record_id:
                raise ValueError(f"external V3 {split}/{family} row has no record ID")

            candidate = row
            if family == "image":
                media = (row.get("assets") or {}).get("image") or {}
                width, height = int(media.get("width", 0)), int(media.get("height", 0))
                if min(width, height) < 1 or width * height / 1_000_000 > max_image_megapixels:
                    rejected_by_cap[family] += 1
                    continue
            elif family == "audio":
                media = (row.get("assets") or {}).get("audio") or {}
                rate = int(media.get("training_sample_rate", 0))
                samples = int(media.get("training_samples", 0))
                duration = samples / rate if samples > 0 and rate > 0 else float(
                    media.get("duration_seconds", 0.0)
                )
                if rate != 24_000 or duration <= 0 or duration > max_audio_seconds:
                    rejected_by_cap[family] += 1
                    continue
            elif family == "video":
                media = (row.get("assets") or {}).get("video") or {}
                frames = media.get("frames")
                width, height = int(media.get("width", 0)), int(media.get("height", 0))
                if (
                    not isinstance(frames, list) or not frames
                    or min(width, height) < 1
                    or width * height / 1_000_000 > max_video_megapixels
                ):
                    rejected_by_cap[family] += 1
                    continue
                if len(frames) > max_video_frames:
                    original_count = len(frames)
                    media["frames"] = frames[:max_video_frames]
                    media["frame_count"] = len(media["frames"])
                    timestamps = media.get("timestamps")
                    if isinstance(timestamps, list):
                        if len(timestamps) != original_count:
                            raise ValueError(f"V3 video timestamps mismatch for benchmark row {record_id}")
                        media["timestamps"] = timestamps[:max_video_frames]
                    candidate["benchmark_view"] = {
                        "transform": "prefix_frame_window",
                        "source_frame_count": original_count,
                        "selected_frame_count": len(media["frames"]),
                    }

            seen[family] += 1
            reservoir = reservoirs[family]
            if len(reservoir) < quota:
                reservoir.append(candidate)
            else:
                replacement = rngs[family].randrange(seen[family])
                if replacement < quota:
                    reservoir[replacement] = candidate

        for family, selected in reservoirs.items():
            if len(selected) < quota:
                raise ValueError(
                    f"not enough bounded external {split}/{family} rows for loader benchmark: "
                    f"selected {len(selected)}, required {quota}; eligible={seen[family]}, "
                    f"rejected_by_resource_caps={rejected_by_cap[family]}"
                )
            selected.sort(key=lambda row: str(row["id"]))
        rows_by_split[split] = reservoirs
        selection_stats[split] = {
            family: {
                "eligible_external_rows_within_caps": seen[family],
                "rejected_by_resource_caps": rejected_by_cap[family],
                "selected_rows": len(reservoirs[family]),
            }
            for family in TASK_GROUPS
        }

    return rows_by_split, {
        "algorithm": "seeded_reservoir_sampling_over_external_immutable_rows",
        "seed": seed,
        "quotas": {"train_per_family": 100, "validation_per_family": 10, "test_per_family": 10},
        "resource_caps": {
            "image_megapixels": max_image_megapixels,
            "audio_seconds": max_audio_seconds,
            "video_megapixels_per_frame": max_video_megapixels,
            "video_frames": max_video_frames,
        },
        "coverage": selection_stats,
        "video_prefix_clipping": "preserve source row identity and timestamps; select first bounded frames only in benchmark manifests",
    }


def _write_loader_benchmark_manifests(
    rows_by_split: dict[str, dict[str, list[dict[str, Any]]]],
    destination: Path,
) -> dict[str, Path]:
    destination.mkdir(parents=True, exist_ok=False)
    paths: dict[str, Path] = {}
    for split in ("train", "validation", "test"):
        rows = [
            row
            for family in TASK_GROUPS
            for row in rows_by_split[split][family]
        ]
        rows.sort(key=lambda row: (str(row.get("task", "")), str(row.get("id", ""))))
        path = destination / f"{split}.jsonl"
        with path.open("x", encoding="utf-8") as stream:
            for row in rows:
                stream.write(json.dumps(
                    row, ensure_ascii=False, sort_keys=True, separators=(",", ":")
                ) + "\n")
        paths[split] = path
    return paths


def _sequence_length_distributions(
    train_manifest: Path,
    tokenizer_path: Path,
    *,
    batch_size: int = 128,
) -> dict[str, dict[str, float | int] | None]:
    """Measure real tokenizer sequence lengths over external train text/tool rows.

    Encoding is batched and bounded; only integer lengths are retained, never the
    full tokenized corpus. Validation/test and non-external rows cannot enter the
    reported distributions.
    """
    if batch_size < 1:
        raise ValueError("sequence-length batch_size must be positive")
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    pending: dict[str, list[str]] = {"text": [], "tool": []}
    lengths: dict[str, list[int]] = {"text": [], "tool": []}

    def flush(family: str) -> None:
        values = pending[family]
        if not values:
            return
        encoded = tokenizer.encode_batch(values, add_special_tokens=True)
        lengths[family].extend(len(item.ids) for item in encoded)
        values.clear()

    for row in read_v3_manifest(train_manifest):
        if str(row.get("split", "")) != "train":
            raise ValueError("sequence-length profiling accepts only the V3 train manifest")
        if not external_record_is_trainable(row) or not has_immutable_external_provenance(row):
            continue
        family = _family(str(row.get("task", "")))
        if family == "text":
            value = row.get("text")
            if not isinstance(value, str) or not value.strip():
                continue
        elif family == "tool":
            prompt = row.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                continue
            response = row.get("response")
            response_text = response if isinstance(response, str) else json.dumps(
                response, ensure_ascii=False, sort_keys=True
            )
            value = prompt + "\n" + response_text
        else:
            continue

        pending[family].append(value)
        if len(pending[family]) >= batch_size:
            flush(family)

    flush("text")
    flush("tool")
    return {family: _distribution(values) for family, values in lengths.items()}


def _manifest_bundle_fingerprint(
    manifests: dict[str, Path], gate: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    asset_hashes = gate.get("asset_hashes")
    coverage = gate.get("coverage")
    if not isinstance(asset_hashes, dict) or not asset_hashes:
        raise ValueError("conversion report does not contain the validated V3 asset SHA-256 map")
    file_digests: dict[str, dict[str, Any]] = {}
    for split, path in manifests.items():
        file_digests[split] = {
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "records": sum(1 for _ in read_v3_manifest(path)),
        }
    identity = {
        "format": "onecore-v3-validated-manifest-bundle-v1",
        "splits": file_digests,
        "asset_sha256": asset_hashes,
        "coverage": coverage,
    }
    encoded = json.dumps(
        identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")
    return _sha256(encoded), file_digests


def _load_current_rss_bytes() -> int:
    try:
        for line in Path("/proc/self/status").read_text(encoding="utf-8").splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return 0


def _load_pid_rss_bytes(pid: int) -> int:
    try:
        for line in Path(f"/proc/{pid}/status").read_text(encoding="utf-8").splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return 0


def _run_monitored_subprocess(
    command: list[str], *, timeout: int, poll_interval: float = 0.02,
) -> tuple[subprocess.CompletedProcess[str], int]:
    """Run one worker and sample the combined parent+child resident set.

    The child also reports its kernel ru_maxrss high-water mark. The sampled
    process-tree value complements that exact per-process figure; a separate
    sum of per-process high-water marks is reported as a conservative bound.
    """
    if not sys.platform.startswith("linux"):
        raise RuntimeError("process-tree RSS sampling requires a Linux runner")
    if timeout < 1 or poll_interval <= 0:
        raise ValueError("worker timeout and RSS sampling interval must be positive")

    process = subprocess.Popen(
        command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    peak_tree_rss = _load_current_rss_bytes() + _load_pid_rss_bytes(process.pid)
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            stdout, stderr = process.communicate()
            raise subprocess.TimeoutExpired(
                command, timeout, output=stdout, stderr=stderr,
            )
        try:
            stdout, stderr = process.communicate(timeout=min(poll_interval, remaining))
            break
        except subprocess.TimeoutExpired:
            current_tree_rss = (
                _load_current_rss_bytes() + _load_pid_rss_bytes(process.pid)
            )
            peak_tree_rss = max(peak_tree_rss, current_tree_rss)

    peak_tree_rss = max(peak_tree_rss, _load_current_rss_bytes())
    completed = subprocess.CompletedProcess(
        command, process.returncode, stdout, stderr,
    )
    return completed, peak_tree_rss


def _max_rss_bytes() -> int:
    if not sys.platform.startswith("linux"):
        raise RuntimeError("peak RSS measurement currently requires a Linux runner")
    return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) * 1024


def _preallocate_adamw_state(optimizer: torch.optim.Optimizer) -> dict[str, int]:
    """Allocate AdamW moment tensors without executing an optimizer step.

    This deliberately measures the full parameter-state footprint while keeping
    model weights unchanged and optimizer_updates at zero.
    """
    if not isinstance(optimizer, torch.optim.AdamW):
        raise TypeError("joint memory profiling requires torch.optim.AdamW")
    parameters = [
        parameter
        for group in optimizer.param_groups
        for parameter in group.get("params", [])
        if parameter.requires_grad
    ]
    if not parameters:
        raise ValueError("AdamW memory profiling requires trainable parameters")
    if len({id(parameter) for parameter in parameters}) != len(parameters):
        raise ValueError("AdamW memory profiling rejects duplicated parameters")

    parameter_bytes = sum(parameter.numel() * parameter.element_size() for parameter in parameters)
    state_bytes = 0
    state_tensor_count = 0
    for parameter in parameters:
        state = optimizer.state[parameter]
        if state:
            raise ValueError("AdamW state must be empty before memory preallocation")
        step = torch.zeros((), dtype=torch.float32, device="cpu")
        exp_avg = torch.zeros_like(parameter, memory_format=torch.preserve_format)
        exp_avg_sq = torch.zeros_like(parameter, memory_format=torch.preserve_format)
        optimizer.state[parameter] = {
            "step": step,
            "exp_avg": exp_avg,
            "exp_avg_sq": exp_avg_sq,
        }
        state_bytes += (
            step.numel() * step.element_size()
            + exp_avg.numel() * exp_avg.element_size()
            + exp_avg_sq.numel() * exp_avg_sq.element_size()
        )
        state_tensor_count += 3

    return {
        "parameter_count": sum(parameter.numel() for parameter in parameters),
        "parameter_tensor_count": len(parameters),
        "parameter_bytes": parameter_bytes,
        "state_parameter_count": len(parameters),
        "state_tensor_count": state_tensor_count,
        "optimizer_state_bytes": state_bytes,
    }


def _load_worker_input(plan: dict[str, Any], tokenizer_path: Path | None) -> tuple[Any, int | float, dict[str, Any]]:
    family = plan["family"]
    metadata: dict[str, Any] = {}
    if family in {"text", "tool"}:
        if tokenizer_path is None:
            raise ValueError("text/tool benchmark requires the real V3 tokenizer JSON")
        tokenizer = Tokenizer.from_file(str(tokenizer_path))
        ids = tokenizer.encode(str(plan["text"])).ids
        requested = int(plan["target_tokens"])
        ids = ids[:requested]
        if len(ids) < 2:
            raise ValueError(f"selected {family} sample contains fewer than two tokens")
        tensor = torch.tensor(ids, dtype=torch.long).unsqueeze(0)
        metadata["sequence_tokens"] = len(ids)
        return tensor, len(ids), metadata

    if family == "image":
        with Image.open(plan["image_path"]) as image:
            image = image.convert("RGB")
            array = np.asarray(image, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(array).permute(2, 0, 1).unsqueeze(0).contiguous()
        metadata.update({"height": int(tensor.shape[-2]), "width": int(tensor.shape[-1])})
        return tensor, float(tensor.shape[-2] * tensor.shape[-1]) / 1_000_000, metadata

    if family == "audio":
        samples, sample_rate = sf.read(
            plan["audio_path"], dtype="float32", always_2d=True,
        )
        if int(sample_rate) != 24_000:
            raise ValueError(f"training audio asset is not canonical 24 kHz: {sample_rate}")
        seconds = float(plan["target_seconds"])
        target_samples = max(1, min(len(samples), int(seconds * sample_rate)))
        samples = samples[:target_samples]
        waveform = torch.from_numpy(samples.T.copy()).unsqueeze(0).contiguous()
        if waveform.shape[1] not in (1, 2):
            raise ValueError(f"unsupported audio channel count: {waveform.shape[1]}")
        metadata.update({
            "sample_rate": int(sample_rate),
            "channels": int(waveform.shape[1]),
            "samples": int(waveform.shape[-1]),
            "duration_seconds": float(waveform.shape[-1] / sample_rate),
        })
        return waveform, metadata["duration_seconds"], metadata

    if family == "video":
        paths = list(plan["frame_paths"])[:int(plan["target_frames"])]
        arrays: list[np.ndarray] = []
        dimensions: set[tuple[int, int]] = set()
        for path in paths:
            with Image.open(path) as image:
                array = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
            dimensions.add((int(array.shape[0]), int(array.shape[1])))
            arrays.append(array)
        if not arrays or len(dimensions) != 1:
            raise ValueError("video benchmark sample has no frames or inconsistent frame dimensions")
        video = torch.from_numpy(np.stack(arrays)).permute(0, 3, 1, 2).unsqueeze(0).contiguous()
        timestamps_value = plan.get("timestamps")
        timestamps = None
        if isinstance(timestamps_value, list):
            timestamps = torch.tensor(
                timestamps_value[:len(paths)], dtype=torch.float32
            ).unsqueeze(0)
        metadata.update({
            "frames": len(paths),
            "height": int(video.shape[-2]),
            "width": int(video.shape[-1]),
            "timestamp_unit": plan.get("timestamp_unit"),
            "timestamps_supplied": timestamps is not None,
        })
        return (video, timestamps), len(paths), metadata

    raise ValueError(f"unsupported benchmark family: {family}")


def _objective_batch_for_family(
    family: str,
    loaded: Any,
    config: V3Config,
    input_metadata: dict[str, Any],
    condition_ids: torch.Tensor | None = None,
) -> dict[str, Any]:
    """Build the exact one-family micro-batch accepted by OneCoreV3Objective."""
    if condition_ids is not None and (
        not isinstance(condition_ids, torch.Tensor)
        or condition_ids.ndim != 2
        or condition_ids.dtype not in (torch.int32, torch.int64)
        or condition_ids.shape[0] != 1
        or condition_ids.shape[1] < 1
    ):
        raise ValueError("media condition_ids must be a non-empty integer tensor [1,T]")
    if family in {"text", "tool"}:
        if condition_ids is not None:
            raise ValueError("text/tool batches already contain their semantic text input")
        return {family: {"input_ids": loaded}}
    if family == "image":
        payload = {"images": loaded}
        if condition_ids is not None:
            payload["condition_ids"] = condition_ids
        return {"image": payload}
    if family == "audio":
        sample_rate = input_metadata.get("sample_rate")
        if (
            isinstance(sample_rate, bool)
            or not isinstance(sample_rate, int)
            or sample_rate != int(config.audio_sample_rate)
        ):
            raise ValueError(
                "audio objective micro-batch must carry the configured canonical sample rate"
            )
        payload = {"waveform": loaded, "sample_rate": sample_rate}
        if condition_ids is not None:
            payload["condition_ids"] = condition_ids
        return {"audio": payload}
    if family == "video":
        if not isinstance(loaded, tuple) or len(loaded) != 2:
            raise ValueError("video objective micro-batch must contain frames and timestamps")
        frames, timestamps = loaded
        payload = {"frames": frames, "timestamps": timestamps}
        if condition_ids is not None:
            payload["condition_ids"] = condition_ids
        return {"video": payload}
    raise ValueError(f"unsupported objective micro-batch family: {family}")


def _worker(plan_path: Path, tokenizer_path: Path | None, threads: int,
            iterations: int) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        if not sys.platform.startswith("linux"):
            raise RuntimeError("resource benchmark requires a Linux CPU runner")
        if torch.cuda.is_available():
            raise RuntimeError("resource benchmark must run with CUDA unavailable")
        torch.set_num_threads(threads)
        torch.set_num_interop_threads(1)
        torch.manual_seed(20261124)
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        config = V3Config()
        init_started = time.perf_counter()
        model = config.build_model().cpu()
        model.train()
        model_init_seconds = time.perf_counter() - init_started
        load_started = time.perf_counter()
        loaded, units, input_metadata = _load_worker_input(plan, tokenizer_path)
        if plan["family"] == "video":
            video, timestamps = loaded
        else:
            tensor = loaded
        input_load_seconds = time.perf_counter() - load_started
        baseline_current = _load_current_rss_bytes()
        baseline_peak = _max_rss_bytes()

        def run_pass(backward: bool) -> float:
            family = plan["family"]
            if family in {"text", "tool"}:
                logits = model.forward_text(tensor)
                loss = F.cross_entropy(
                    logits[:, :-1].reshape(-1, logits.shape[-1]),
                    tensor[:, 1:].reshape(-1),
                )
                if backward:
                    loss.backward()
                return float(loss.detach())
            if family == "image":
                reconstruction, _encoding = model.forward_image(tensor)
                loss = F.mse_loss(reconstruction, tensor)
                if backward:
                    loss.backward()
                return float(loss.detach())
            if family == "audio":
                reconstruction, encoding = model.forward_audio(
                    tensor, sample_rate=config.audio_sample_rate,
                )
                loss = F.mse_loss(reconstruction, tensor) + encoding.commitment_loss
                if backward:
                    loss.backward()
                return float(loss.detach())

            offset = 0
            losses: list[float] = []
            for reconstruction in model.forward_video_chunks(
                video, timestamps=timestamps,
                frame_chunk_size=config.video_generation_chunk_frames,
            ):
                expected = video[:, offset:offset + reconstruction.shape[1]]
                loss = F.mse_loss(reconstruction, expected)
                if backward:
                    loss.backward()
                losses.append(float(loss.detach()))
                offset += reconstruction.shape[1]
            if offset != video.shape[1]:
                raise RuntimeError("video benchmark did not process every selected frame")
            return float(sum(losses) / max(1, len(losses)))

        warmup_forward_started = time.perf_counter()
        with torch.no_grad():
            run_pass(False)
        warmup_forward_seconds = time.perf_counter() - warmup_forward_started

        # Materialize autograd/gradient buffers before measuring steady-state
        # forward+backward throughput. This remains diagnostic-only: no optimizer
        # exists in this worker and no parameter update is performed.
        model.zero_grad(set_to_none=True)
        warmup_forward_backward_started = time.perf_counter()
        run_pass(True)
        warmup_forward_backward_seconds = time.perf_counter() - warmup_forward_backward_started
        model.zero_grad(set_to_none=True)

        inference_times: list[float] = []
        backward_times: list[float] = []
        losses: list[float] = []
        for _ in range(iterations):
            inference_started = time.perf_counter()
            with torch.no_grad():
                losses.append(run_pass(False))
            inference_times.append(time.perf_counter() - inference_started)

            model.zero_grad(set_to_none=True)
            backward_started = time.perf_counter()
            losses.append(run_pass(True))
            backward_times.append(time.perf_counter() - backward_started)
            model.zero_grad(set_to_none=True)

        peak_rss = _max_rss_bytes()
        mean_inference = float(np.mean(inference_times))
        mean_backward = float(np.mean(backward_times))
        throughput_units = float(units)
        return {
            "status": "success",
            "family": plan["family"],
            "record_id": plan["record_id"],
            "target": plan.get("target_tokens", plan.get("target_seconds", plan.get("target_frames", "native"))),
            "input_metadata": input_metadata,
            "units": throughput_units,
            "unit_name": {
                "text": "tokens", "tool": "tokens", "image": "megapixels",
                "audio": "audio_seconds", "video": "frames",
            }[plan["family"]],
            "model_init_seconds": round(model_init_seconds, 6),
            "input_load_seconds": round(input_load_seconds, 6),
            "inference_seconds_mean": round(mean_inference, 6),
            "forward_backward_seconds_mean": round(mean_backward, 6),
            "inference_seconds_distribution": _distribution(inference_times),
            "forward_backward_seconds_distribution": _distribution(backward_times),
            "inference_units_per_second": round(throughput_units / max(mean_inference, 1e-9), 6),
            "forward_backward_units_per_second": round(throughput_units / max(mean_backward, 1e-9), 6),
            "inference_units_per_second_distribution": _distribution([
                throughput_units / max(value, 1e-9) for value in inference_times
            ]),
            "forward_backward_units_per_second_distribution": _distribution([
                throughput_units / max(value, 1e-9) for value in backward_times
            ]),
            "mean_loss_diagnostic_only": round(float(np.mean(losses)), 8),
            "peak_rss_bytes": peak_rss,
            "baseline_current_rss_bytes": baseline_current,
            "baseline_peak_rss_bytes": baseline_peak,
            "peak_rss_growth_bytes": max(0, peak_rss - baseline_peak),
            "cpu_threads": threads,
            "iterations": iterations,
            "backward_objective": "reconstruction_diagnostic_only",
            "optimizer_step_executed": False,
            "warmup_forward_passes": 1,
            "warmup_forward_seconds": round(warmup_forward_seconds, 6),
            "warmup_forward_backward_passes": 1,
            "warmup_forward_backward_seconds": round(warmup_forward_backward_seconds, 6),
            "measured_iterations": iterations,
            "elapsed_seconds": round(time.perf_counter() - started, 6),
        }
    except Exception as exc:
        return {
            "status": "failed",
            "family": None,
            "error": f"{type(exc).__name__}: {str(exc)}",
            "traceback": traceback.format_exc()[-4000:],
        }


def _joint_worker(
    plan_path: Path,
    tokenizer_path: Path | None,
    threads: int,
) -> dict[str, Any]:
    """Measure one real micro-batch from each family plus full AdamW state memory."""
    started = time.perf_counter()
    try:
        if not sys.platform.startswith("linux"):
            raise RuntimeError("joint resource benchmark requires a Linux runner")
        if torch.cuda.is_available():
            raise RuntimeError("joint resource benchmark must run with CUDA unavailable")
        if tokenizer_path is None:
            raise ValueError("joint resource benchmark requires the real V3 tokenizer JSON")
        torch.set_num_threads(threads)
        torch.set_num_interop_threads(1)
        torch.manual_seed(20261124)

        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        family_plans = plan.get("families")
        order = ("text", "tool", "image", "audio", "video")
        if not isinstance(family_plans, dict) or set(family_plans) != set(order):
            raise ValueError("joint plan must contain exactly text, tool, image, audio and video")
        for family in order:
            if family_plans[family].get("family") != family:
                raise ValueError(f"joint plan family identity mismatch for {family}")

        config = V3Config()
        init_started = time.perf_counter()
        model = config.build_model().cpu()
        model.train()
        model_init_seconds = time.perf_counter() - init_started

        load_started = time.perf_counter()
        inputs: dict[str, tuple[Any, int | float, dict[str, Any]]] = {}
        for family in order:
            inputs[family] = _load_worker_input(family_plans[family], tokenizer_path)
        input_load_seconds = time.perf_counter() - load_started
        baseline_current = _load_current_rss_bytes()
        baseline_peak = _max_rss_bytes()

        objective = OneCoreV3Objective(model)
        objective_weights = dict(vars(objective.weights))
        alignment_loss_included = False
        model.zero_grad(set_to_none=True)
        family_results: dict[str, dict[str, Any]] = {}
        joint_forward_backward_started = time.perf_counter()
        for family in order:
            loaded, units, input_metadata = inputs[family]
            family_started = time.perf_counter()
            raw_condition_ids = family_plans[family].get("condition_ids")
            condition_ids = None
            if raw_condition_ids is not None:
                if (
                    not isinstance(raw_condition_ids, list)
                    or not raw_condition_ids
                    or any(
                        isinstance(value, bool) or not isinstance(value, int) or value < 0
                        for value in raw_condition_ids
                    )
                ):
                    raise ValueError(f"joint {family} condition_ids must be a non-empty list of token IDs")
                condition_ids = torch.tensor(raw_condition_ids, dtype=torch.long).unsqueeze(0)
                for key in (
                    "condition_field", "condition_text_sha256", "condition_tokens",
                    "source_condition_tokens", "condition_window_start",
                ):
                    if key in family_plans[family]:
                        input_metadata[key] = family_plans[family][key]
            batch = _objective_batch_for_family(
                family, loaded, config, input_metadata, condition_ids=condition_ids,
            )
            losses = objective(batch)
            total_loss = losses.get("total")
            if not isinstance(total_loss, torch.Tensor) or total_loss.ndim != 0:
                raise ValueError(
                    f"OneCoreV3Objective returned no scalar total loss for {family}"
                )
            total_loss.backward()
            objective_terms: dict[str, float] = {}
            for name, value in losses.items():
                if name == "total":
                    continue
                if not isinstance(value, torch.Tensor) or value.ndim != 0:
                    raise ValueError(
                        f"OneCoreV3Objective returned a non-scalar loss term: {family}/{name}"
                    )
                objective_terms[name] = float(value.detach())
            alignment_loss_included = alignment_loss_included or (
                "alignment_loss" in objective_terms
            )

            elapsed = time.perf_counter() - family_started
            unit_name = {
                "text": "tokens", "tool": "tokens", "image": "megapixels",
                "audio": "audio_seconds", "video": "frames",
            }[family]
            family_results[family] = {
                "record_id": family_plans[family]["record_id"],
                "units": float(units),
                "unit_name": unit_name,
                "conditioned": condition_ids is not None,
                "input_metadata": input_metadata,
                "objective_terms": objective_terms,
                "loss_diagnostic_only": round(float(total_loss.detach()), 8),
                "forward_backward_seconds": round(elapsed, 6),
                "forward_backward_units_per_second": round(float(units) / max(elapsed, 1e-9), 6),
            }

        joint_forward_backward_seconds = time.perf_counter() - joint_forward_backward_started
        gradient_bytes = sum(
            parameter.grad.numel() * parameter.grad.element_size()
            for parameter in model.parameters()
            if parameter.grad is not None
        )
        optimizer = torch.optim.AdamW(
            (parameter for parameter in model.parameters() if parameter.requires_grad),
            lr=0.0,
            weight_decay=0.0,
        )
        optimizer_memory = _preallocate_adamw_state(optimizer)
        peak_rss = _max_rss_bytes()
        return {
            "status": "success",
            "benchmark_kind": "joint_five_family_onecore_v3_objective_plus_adamw_state_preallocation_no_step",
            "micro_batch_order": list(order),
            "micro_batch_count": len(order),
            "joint_objective": {
                "name": "OneCoreV3Objective",
                "weights": objective_weights,
                "alignment_loss_included": alignment_loss_included,
                "conditioned_families": [
                    family for family in order if family_plans[family].get("condition_ids") is not None
                ],
                "alignment_note": (
                    "single-record micro-batches can use paired text conditions, "
                    "but do not form a contrastive batch for alignment loss"
                ),
                "optional_discriminators_included": (
                    objective.image_discriminator is not None
                    or objective.audio_discriminator is not None
                ),
                "gradient_accumulation": (
                    "one backward per family in text/tool/image/audio/video order; "
                    "gradients retained across the five micro-batches"
                ),
            },
            "family_results": family_results,
            "model_init_seconds": round(model_init_seconds, 6),
            "input_load_seconds": round(input_load_seconds, 6),
            "joint_forward_backward_seconds": round(joint_forward_backward_seconds, 6),
            "parameter_count": optimizer_memory["parameter_count"],
            "parameter_bytes": optimizer_memory["parameter_bytes"],
            "gradient_bytes": gradient_bytes,
            "optimizer_state_bytes": optimizer_memory["optimizer_state_bytes"],
            "optimizer_state_parameter_count": optimizer_memory["state_parameter_count"],
            "optimizer_state_tensor_count": optimizer_memory["state_tensor_count"],
            "peak_rss_bytes": peak_rss,
            "baseline_current_rss_bytes": baseline_current,
            "baseline_peak_rss_bytes": baseline_peak,
            "peak_rss_growth_bytes": max(0, peak_rss - baseline_peak),
            "cpu_threads": threads,
            "optimizer_updates": 0,
            "optimizer_step_executed": False,
            "optimizer_state_allocated": True,
            "elapsed_seconds": round(time.perf_counter() - started, 6),
        }
    except Exception as exc:
        return {
            "status": "failed",
            "benchmark_kind": "joint_five_family_onecore_v3_objective_plus_adamw_state_preallocation_no_step",
            "error": f"{type(exc).__name__}: {str(exc)}",
            "traceback": traceback.format_exc()[-5000:],
            "optimizer_updates": 0,
            "optimizer_step_executed": False,
        }


def _build_plans(selected: dict[str, dict[str, Any]], tokenizer_path: Path,
                 max_video_frames: int) -> list[dict[str, Any]]:
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    plans: list[dict[str, Any]] = []
    for family in ("text", "tool"):
        sample = selected[family]
        token_count = len(tokenizer.encode(sample["text"]).ids)
        targets = sorted({min(token_count, target) for target in (128, 256, 512) if token_count >= 2})
        for target in targets:
            plans.append({
                "family": family, "record_id": sample["record_id"],
                "text": sample["text"], "target_tokens": target,
            })
    image = selected["image"]
    plans.append({
        "family": "image", "record_id": image["record_id"],
        "image_path": image["local_paths"][0],
    })
    audio = selected["audio"]
    duration = float(audio["duration_seconds"])
    audio_targets = sorted({min(duration, target) for target in (1.0, 5.0) if duration > 0})
    for target in audio_targets:
        plans.append({
            "family": "audio", "record_id": audio["record_id"],
            "audio_path": audio["local_paths"][0], "target_seconds": target,
        })
    video = selected["video"]
    frame_count = len(video["local_paths"])
    video_targets = sorted({min(frame_count, target) for target in (8, max_video_frames) if frame_count >= 1})
    for target in video_targets:
        plans.append({
            "family": "video", "record_id": video["record_id"],
            "frame_paths": video["local_paths"][:target],
            "timestamps": video.get("timestamps"),
            "timestamp_unit": video.get("timestamp_unit"),
            "target_frames": target,
        })
    return plans


def _condition_plan_fields(
    sample: dict[str, Any], family: str, tokenizer: Tokenizer,
) -> dict[str, Any]:
    field = sample.get("condition_field")
    value = sample.get("condition_text")
    if field is None and value is None:
        return {}
    expected_field = {"image": "caption", "audio": "transcript", "video": "caption"}.get(family)
    if field != expected_field or not isinstance(value, str) or not value.strip():
        raise ValueError(f"joint {family} paired condition metadata is invalid")
    row_hash = str(sample.get("source_row_id_sha256", "")).strip().lower()
    if len(row_hash) != 64 or any(char not in "0123456789abcdef" for char in row_hash):
        raise ValueError(f"joint {family} paired condition has no immutable row hash")
    text_value = value.strip()
    token_ids = tokenizer.encode(text_value).ids
    total_tokens = len(token_ids)
    if not token_ids:
        raise ValueError(f"joint {family} paired condition tokenization is empty")
    if total_tokens > 512:
        start = _window_start(row_hash, 0, total_tokens - 512, f"{family}_condition")
        token_ids = token_ids[start:start + 512]
    else:
        start = 0
    return {
        "condition_ids": token_ids,
        "condition_field": field,
        "condition_text_sha256": hashlib.sha256(text_value.encode("utf-8")).hexdigest(),
        "condition_tokens": len(token_ids),
        "source_condition_tokens": total_tokens,
        "condition_window_start": start,
    }


def _build_joint_plan(
    selected: dict[str, dict[str, Any]],
    tokenizer_path: Path,
    *,
    max_audio_seconds: float,
    max_video_frames: int,
) -> dict[str, Any]:
    """Build one bounded, real external micro-batch for each of the five families."""
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    families: dict[str, dict[str, Any]] = {}

    for family in ("text", "tool"):
        sample = selected[family]
        token_count = len(tokenizer.encode(sample["text"]).ids)
        target_tokens = min(token_count, 512)
        if target_tokens < 2:
            raise ValueError(f"joint {family} sample contains fewer than two tokens")
        families[family] = {
            "family": family,
            "record_id": sample["record_id"],
            "text": sample["text"],
            "target_tokens": target_tokens,
        }

    image = selected["image"]
    if not image.get("local_paths"):
        raise ValueError("joint image sample has no verified local asset")
    families["image"] = {
        "family": "image",
        "record_id": image["record_id"],
        "image_path": image["local_paths"][0],
    }
    families["image"].update(_condition_plan_fields(image, "image", tokenizer))

    audio = selected["audio"]
    audio_duration = float(audio.get("duration_seconds", 0.0))
    if audio_duration <= 0 or not audio.get("local_paths"):
        raise ValueError("joint audio sample has no verified canonical training asset")
    families["audio"] = {
        "family": "audio",
        "record_id": audio["record_id"],
        "audio_path": audio["local_paths"][0],
        "target_seconds": min(audio_duration, max_audio_seconds),
    }
    families["audio"].update(_condition_plan_fields(audio, "audio", tokenizer))

    video = selected["video"]
    frame_paths = list(video.get("local_paths") or [])[:max_video_frames]
    if not frame_paths:
        raise ValueError("joint video sample has no verified local frames")
    timestamps = video.get("timestamps")
    families["video"] = {
        "family": "video",
        "record_id": video["record_id"],
        "frame_paths": frame_paths,
        "timestamps": timestamps[:len(frame_paths)] if isinstance(timestamps, list) else None,
        "timestamp_unit": video.get("timestamp_unit"),
        "target_frames": len(frame_paths),
    }
    families["video"].update(_condition_plan_fields(video, "video", tokenizer))

    return {
        "format_version": 1,
        "micro_batch_order": ["text", "tool", "image", "audio", "video"],
        "families": families,
    }


def _loader_worker(plan_path: Path, threads: int) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        if not sys.platform.startswith("linux"):
            raise RuntimeError("V3 loader benchmark requires a Linux CPU runner")
        if torch.cuda.is_available():
            raise RuntimeError("V3 loader benchmark must run with CUDA unavailable")
        if threads < 1:
            raise ValueError("loader benchmark CPU threads must be positive")
        torch.set_num_threads(threads)
        torch.set_num_interop_threads(1)
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        source_bundle_sha = str(plan.get("source_manifest_bundle_sha256", "")).lower()
        if (
            len(source_bundle_sha) != 64
            or any(char not in "0123456789abcdef" for char in source_bundle_sha)
        ):
            raise ValueError("loader benchmark requires the validated full manifest-bundle SHA-256")
        iterations = int(plan.get("iterations", 20))
        warmup = int(plan.get("warmup_iterations", 2))
        if iterations < 1 or warmup < 0 or warmup >= iterations:
            raise ValueError("loader benchmark requires iterations > warmup_iterations >= 0")

        baseline_current = _load_current_rss_bytes()
        baseline_peak = _max_rss_bytes()
        init_started = time.perf_counter()
        loader = V3JointDataLoader(
            {key: Path(value) for key, value in plan["manifest_paths"].items()},
            Path(plan["assets_root"]),
            Path(plan["tokenizer_path"]),
            config=V3Config(),
            max_text_tokens=int(plan.get("max_text_tokens", 512)),
            audio_window_seconds=float(plan.get("audio_window_seconds", 5.0)),
            video_window_frames=int(plan.get("video_window_frames", 16)),
            benchmark_manifest_view=True,
            tokenizer_train_manifest_sha256=str(plan["tokenizer_train_manifest_sha256"]),
        )
        initialization_seconds = time.perf_counter() - init_started
        step_latencies: list[float] = []
        family_totals = {
            family: {
                "records": 0, "units": 0.0, "pixel_megapixels": 0.0,
                "referenced_asset_file_bytes": 0,
            }
            for family in TASK_GROUPS
        }
        measured_asset_paths = 0
        assets_root = Path(plan["assets_root"])
        with loader:
            for index in range(iterations):
                step_started = time.perf_counter()
                micro_batches = loader.next_joint_micro_batches()
                step_elapsed = time.perf_counter() - step_started
                if tuple(item.family for item in micro_batches) != tuple(TASK_GROUPS):
                    raise RuntimeError("V3 loader did not return the five families in canonical order")
                if index >= warmup:
                    step_latencies.append(step_elapsed)
                    for item in micro_batches:
                        family = item.family
                        payload = item.batch[family]
                        totals = family_totals[family]
                        totals["records"] += 1
                        if family in {"text", "tool"}:
                            totals["units"] += int(payload["input_ids"].shape[-1])
                        elif family == "image":
                            images = payload["images"]
                            pixels = int(images.shape[-2]) * int(images.shape[-1])
                            totals["units"] += pixels / 1_000_000
                            totals["pixel_megapixels"] += pixels / 1_000_000
                        elif family == "audio":
                            waveform = payload["waveform"]
                            rate = int(payload["sample_rate"])
                            if rate != 24_000:
                                raise ValueError("V3 loader emitted non-canonical audio sample rate")
                            totals["units"] += int(waveform.shape[-1]) / rate
                        else:
                            frames = payload["frames"]
                            frame_count = int(frames.shape[1])
                            pixels = int(frames.shape[-2]) * int(frames.shape[-1])
                            totals["units"] += frame_count
                            totals["pixel_megapixels"] += frame_count * pixels / 1_000_000
                        for relative in item.metadata.get("asset_paths", []):
                            asset_path = (assets_root / _safe_relative(relative)).resolve()
                            try:
                                asset_path.relative_to(assets_root.resolve())
                            except ValueError as exc:
                                raise ValueError("V3 loader emitted an asset outside its benchmark root") from exc
                            if not asset_path.is_file():
                                raise FileNotFoundError(f"V3 loader benchmark asset disappeared: {relative}")
                            totals["referenced_asset_file_bytes"] += asset_path.stat().st_size
                            measured_asset_paths += 1
                del micro_batches

            final_step = loader.current_step
            if final_step != iterations:
                raise RuntimeError(
                    f"V3 loader consumed {final_step} joint steps, expected {iterations}"
                )
            manifest_sha256 = loader.manifest_sha256
            train_manifest_sha256 = loader.train_manifest_sha256
            tokenizer_sha256 = loader.tokenizer_sha256
            train_manifest_records = int(loader.fingerprint["manifest_files"]["train"]["records"])
            source_cursor_count = len(loader._source_metadata)

        measured_seconds = float(sum(step_latencies))
        if measured_seconds <= 0 or len(step_latencies) != iterations - warmup:
            raise RuntimeError("V3 loader benchmark did not produce measured step timings")
        peak_rss = _max_rss_bytes()
        per_family = {}
        for family, totals in family_totals.items():
            unit_name = {
                "text": "tokens", "tool": "tokens", "image": "megapixels",
                "audio": "audio_seconds", "video": "frames",
            }[family]
            per_family[family] = {
                **totals,
                "unit_name": unit_name,
                "records_per_second": round(totals["records"] / measured_seconds, 6),
                "units_per_second": round(totals["units"] / measured_seconds, 6),
                "pixel_megapixels_per_second": round(
                    totals["pixel_megapixels"] / measured_seconds, 6
                ),
                "referenced_asset_file_bytes_per_second": round(
                    totals["referenced_asset_file_bytes"] / measured_seconds, 3
                ),
            }
        return {
            "status": "success",
            "benchmark_kind": "v3_joint_data_loader_five_family_materialization_only_no_model_forward_no_optimizer_step",
            "manifest_sha256": manifest_sha256,
            "train_manifest_sha256": train_manifest_sha256,
            "tokenizer_train_manifest_sha256": str(plan["tokenizer_train_manifest_sha256"]),
            "source_manifest_bundle_sha256": str(plan["source_manifest_bundle_sha256"]),
            "tokenizer_sha256": tokenizer_sha256,
            "train_manifest_records": train_manifest_records,
            "source_cursor_count": source_cursor_count,
            "iterations_including_warmup": iterations,
            "warmup_iterations": warmup,
            "measured_joint_steps": len(step_latencies),
            "measured_micro_batches": len(step_latencies) * len(TASK_GROUPS),
            "loader_initialization_seconds": round(initialization_seconds, 6),
            "measured_seconds": round(measured_seconds, 6),
            "joint_steps_per_second": round(len(step_latencies) / measured_seconds, 6),
            "five_family_micro_batches_per_second": round(
                len(step_latencies) * len(TASK_GROUPS) / measured_seconds, 6
            ),
            "mean_joint_step_seconds": round(float(np.mean(step_latencies)), 6),
            "p95_joint_step_seconds": _distribution(step_latencies)["p95"],
            "family_throughput": per_family,
            "asset_paths_materialized": measured_asset_paths,
            "baseline_current_rss_bytes": baseline_current,
            "baseline_peak_rss_bytes": baseline_peak,
            "peak_rss_bytes": peak_rss,
            "peak_rss_growth_bytes": max(0, peak_rss - baseline_peak),
            "cpu_threads": threads,
            "cuda_available": False,
            "benchmark_manifest_view": True,
            "checkpointable": False,
            "optimizer_updates": 0,
            "checkpoint_writes": 0,
            "elapsed_seconds": round(time.perf_counter() - started, 6),
            "limitations": [
                "The production V3JointDataLoader is exercised on a deterministic quota-complete 100/10/10-per-family sample from the immutable corpus.",
                "Validation and test rows are used only for manifest/asset integrity checks; the loader indexes and consumes train rows only.",
                "The tokenizer remains verified against the original full train manifest; the benchmark-only manifest slice cannot be serialized as checkpoint data state.",
                "Video rows are prefix-clipped only in temporary benchmark manifests to the configured bounded frame count; original corpus assets and manifests are unchanged.",
                "Referenced asset file sizes are footprint metadata, not an exact count of bytes read from storage.",
                "This measures data materialization only, not model forward/backward, optimizer updates, a full-corpus epoch, or generation quality.",
            ],
        }
    except Exception as exc:
        return {
            "status": "failed",
            "benchmark_kind": "v3_joint_data_loader_five_family_materialization_only_no_model_forward_no_optimizer_step",
            "error": f"{type(exc).__name__}: {str(exc)}",
            "traceback": traceback.format_exc()[-5000:],
            "optimizer_updates": 0,
            "checkpoint_writes": 0,
        }


def _process_tree_memory_accounting(
    parent_peak_rss_bytes: int,
    worker_results: list[dict[str, Any]],
) -> dict[str, Any]:
    if isinstance(parent_peak_rss_bytes, bool) or parent_peak_rss_bytes < 0:
        raise ValueError("parent peak RSS must be a non-negative integer")
    worker_peak_values = [
        int(item["peak_rss_bytes"])
        for item in worker_results
        if isinstance(item.get("peak_rss_bytes"), int) and item["peak_rss_bytes"] > 0
    ]
    observed_tree_peaks = [
        int(item["process_tree_peak_rss_bytes_observed"])
        for item in worker_results
        if isinstance(item.get("process_tree_peak_rss_bytes_observed"), int)
    ]
    max_worker_peak_rss = max(worker_peak_values, default=0)
    return {
        "parent_process_peak_rss_bytes": parent_peak_rss_bytes,
        "max_worker_process_peak_rss_bytes": max_worker_peak_rss,
        "observed_process_tree_peak_rss_bytes": max(
            [parent_peak_rss_bytes, *observed_tree_peaks]
        ),
        "conservative_process_tree_rss_upper_bound_bytes": (
            parent_peak_rss_bytes + max_worker_peak_rss
        ),
        "sampling_interval_seconds": 0.02,
        "method": (
            "Linux per-process ru_maxrss plus sampled /proc parent+worker RSS, "
            "including per-family, five-family loader and joint workers; the conservative "
            "upper bound sums separate per-process maxima and may exceed the true "
            "simultaneous process-tree peak"
        ),
    }


def _run_parent(args: argparse.Namespace) -> int:
    if not sys.platform.startswith("linux"):
        raise RuntimeError("resource benchmark must run on Linux")
    if not args.github_token:
        raise ValueError("GITHUB_TOKEN is required to read the immutable V3 artifacts")
    output = Path(args.output).resolve()
    if output.exists():
        raise FileExistsError(f"refusing to overwrite resource benchmark report: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    artifact_info = {
        "corpus": _pinned_artifact_metadata(
            args.github_repo, args.github_token, "corpus",
            args.corpus_artifact_id, args.expected_corpus_run_id,
        ),
        "conversion_report": _pinned_artifact_metadata(
            args.github_repo, args.github_token, "conversion_report",
            args.report_artifact_id, args.expected_report_run_id,
        ),
        "tokenizer": _pinned_artifact_metadata(
            args.github_repo, args.github_token, "tokenizer",
            args.tokenizer_artifact_id, args.expected_tokenizer_run_id,
        ),
    }
    with tempfile.TemporaryDirectory(prefix="onecore-v3-resource-benchmark-") as temporary:
        root = Path(temporary)
        gate_report, gate_payload = _read_conversion_report(
            args.github_repo, args.report_artifact_id, args.github_token,
        )
        gate = gate_report["manifest_gate"]
        if gate.get("passed") is not True:
            raise RuntimeError("the immutable V3 conversion report does not show manifest_gate.passed=true")
        if not isinstance(gate.get("asset_hashes"), dict):
            raise RuntimeError("the immutable conversion report has no asset SHA-256 map")
        coverage = gate.get("coverage") or {}
        for split in ("train", "validation", "test"):
            minimum = 100 if split == "train" else 10
            for family in ("text", "tool", "image", "audio", "video"):
                count = int((coverage.get(split) or {}).get(family, 0))
                if count < minimum:
                    raise RuntimeError(f"V3 manifest gate coverage below quota: {split}/{family}={count}")

        corpus_url = _signed_artifact_url(args.github_repo, args.corpus_artifact_id, args.github_token)
        data_root = root / "corpus" / "data"
        data_root.mkdir(parents=True)
        manifest_paths: dict[str, Path] = {}
        loader_manifest_paths: dict[str, Path] = {}
        loader_selection: dict[str, Any] = {}
        with RemoteZip(corpus_url, support_suffix_range=False) as archive:
            names = archive.namelist()
            for split in ("train", "validation", "test"):
                member = _unique_suffix(names, f"data/{split}.jsonl")
                destination = data_root / f"{split}.jsonl"
                _extract_member(archive, member, destination)
                manifest_paths[split] = destination

            selected, distributions = _select_train_samples(
                manifest_paths["train"],
                max_image_megapixels=args.max_image_megapixels,
                max_audio_seconds=args.max_audio_seconds,
                max_video_megapixels=args.max_video_megapixels,
                max_video_frames=args.max_video_frames,
            )
            assets_root = data_root / "assets"
            for family in ("image", "audio", "video"):
                sample = selected[family]
                local_paths: list[str] = []
                for relative in sample["asset_paths"]:
                    destination = _extract_verified_asset(
                        archive, names, relative, assets_root, gate["asset_hashes"],
                    )
                    local_paths.append(str(destination))
                sample["local_paths"] = local_paths

            loader_rows, loader_selection = _select_loader_benchmark_rows(
                manifest_paths,
                max_image_megapixels=args.max_image_megapixels,
                max_audio_seconds=args.max_audio_seconds,
                max_video_megapixels=args.max_video_megapixels,
                max_video_frames=args.max_video_frames,
            )
            loader_manifest_paths = _write_loader_benchmark_manifests(
                loader_rows, root / "loader-manifests",
            )
            extracted_loader_assets: set[str] = set()
            for split in ("train", "validation", "test"):
                for family in TASK_GROUPS:
                    for row in loader_rows[split][family]:
                        for relative in _asset_paths(row):
                            if relative in extracted_loader_assets:
                                continue
                            _extract_verified_asset(
                                archive, names, relative, assets_root, gate["asset_hashes"],
                            )
                            extracted_loader_assets.add(relative)

        tokenizer_url = _signed_artifact_url(args.github_repo, args.tokenizer_artifact_id, args.github_token)
        tokenizer_root = root / "tokenizer"
        tokenizer_root.mkdir()
        with RemoteZip(tokenizer_url, support_suffix_range=False) as archive:
            names = archive.namelist()
            evidence_candidates = [
                name for name in names
                if PurePosixPath(str(name).replace("\\", "/")).name.endswith(".json.evidence.json")
            ]
            if len(evidence_candidates) != 1:
                raise ValueError(
                    "tokenizer artifact must contain exactly one JSON evidence sidecar; "
                    f"found {len(evidence_candidates)}"
                )
            with archive.open(evidence_candidates[0]) as stream:
                evidence_payload = stream.read(2 * 1024 * 1024 + 1)
            if len(evidence_payload) > 2 * 1024 * 1024:
                raise ValueError("tokenizer evidence sidecar exceeds the bounded size limit")
            evidence_metadata = json.loads(evidence_payload.decode("utf-8"))
            tokenizer_member, evidence_member, tokenizer_filename = _tokenizer_members(
                names, evidence_metadata,
            )
            tokenizer_path = tokenizer_root / tokenizer_filename
            evidence_path = tokenizer_path.with_name(tokenizer_path.name + ".evidence.json")
            _extract_member(archive, tokenizer_member, tokenizer_path)
            _extract_member(archive, evidence_member, evidence_path)

        train_manifest_sha = sha256_file(manifest_paths["train"])
        tokenizer_evidence = verify_v3_tokenizer(
            tokenizer_path, expected_train_manifest_sha256=train_manifest_sha,
        )
        tokenizer_evidence.pop("tokenizer_path", None)
        tokenizer_evidence.pop("evidence_path", None)
        manifest_bundle_sha, manifest_files = _manifest_bundle_fingerprint(manifest_paths, gate)
        sequence_distributions = _sequence_length_distributions(
            manifest_paths["train"], tokenizer_path,
        )

        loader_plan_path = root / "loader-benchmark-plan.json"
        loader_plan_path.write_text(json.dumps({
            "manifest_paths": {split: str(path) for split, path in loader_manifest_paths.items()},
            "assets_root": str(assets_root),
            "tokenizer_path": str(tokenizer_path),
            "tokenizer_train_manifest_sha256": train_manifest_sha,
            "source_manifest_bundle_sha256": manifest_bundle_sha,
            "iterations": args.loader_iterations,
            "warmup_iterations": args.loader_warmup_iterations,
            "max_text_tokens": 512,
            "audio_window_seconds": args.max_audio_seconds,
            "video_window_frames": args.max_video_frames,
            "selection": loader_selection,
        }, ensure_ascii=False), encoding="utf-8")
        loader_command = [
            sys.executable, "-m", "onecore.v3.resource_benchmark",
            "--loader-plan", str(loader_plan_path),
            "--threads", str(args.threads),
        ]
        loader_completed, loader_process_tree_peak = _run_monitored_subprocess(
            loader_command, timeout=args.worker_timeout_seconds,
        )
        try:
            loader_result = json.loads(loader_completed.stdout.strip())
        except json.JSONDecodeError:
            loader_result = {
                "status": "failed",
                "error": f"loader worker returned no JSON (exit={loader_completed.returncode})",
                "stdout_tail": loader_completed.stdout[-2000:],
                "stderr_tail": loader_completed.stderr[-2000:],
                "optimizer_updates": 0,
                "checkpoint_writes": 0,
            }
        if loader_completed.returncode != 0 and loader_result.get("status") == "success":
            loader_result["status"] = "failed"
            loader_result["error"] = f"loader worker exit code {loader_completed.returncode}"
        loader_result["process_tree_peak_rss_bytes_observed"] = loader_process_tree_peak
        loader_result["sample_selection"] = loader_selection

        for family in ("text", "tool"):
            sample = selected[family]
            sample["token_count"] = len(Tokenizer.from_file(str(tokenizer_path)).encode(sample["text"]).ids)
        plans = _build_plans(selected, tokenizer_path, args.max_video_frames)
        benchmark_results: list[dict[str, Any]] = []
        for index, plan in enumerate(plans, 1):
            plan_path = root / f"worker-plan-{index:02d}.json"
            plan_path.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
            command = [
                sys.executable, "-m", "onecore.v3.resource_benchmark",
                "--worker-plan", str(plan_path),
                "--tokenizer-json", str(tokenizer_path),
                "--threads", str(args.threads),
                "--iterations", str(args.iterations),
            ]
            completed, process_tree_peak = _run_monitored_subprocess(
                command, timeout=args.worker_timeout_seconds,
            )
            try:
                worker_result = json.loads(completed.stdout.strip())
            except json.JSONDecodeError:
                worker_result = {
                    "status": "failed",
                    "error": f"worker returned no JSON (exit={completed.returncode})",
                    "stdout_tail": completed.stdout[-2000:],
                    "stderr_tail": completed.stderr[-2000:],
                }
            if completed.returncode != 0 and worker_result.get("status") == "success":
                worker_result["status"] = "failed"
                worker_result["error"] = f"worker exit code {completed.returncode}"
            worker_result["process_tree_peak_rss_bytes_observed"] = process_tree_peak
            worker_result["case_index"] = index
            benchmark_results.append(worker_result)

        joint_plan = _build_joint_plan(
            selected,
            tokenizer_path,
            max_audio_seconds=args.max_audio_seconds,
            max_video_frames=args.max_video_frames,
        )
        joint_plan_path = root / "worker-plan-joint.json"
        joint_plan_path.write_text(
            json.dumps(joint_plan, ensure_ascii=False), encoding="utf-8"
        )
        joint_command = [
            sys.executable, "-m", "onecore.v3.resource_benchmark",
            "--joint-plan", str(joint_plan_path),
            "--tokenizer-json", str(tokenizer_path),
            "--threads", str(args.threads),
        ]
        joint_completed, joint_process_tree_peak = _run_monitored_subprocess(
            joint_command, timeout=args.worker_timeout_seconds,
        )
        try:
            joint_result = json.loads(joint_completed.stdout.strip())
        except json.JSONDecodeError:
            joint_result = {
                "status": "failed",
                "error": f"joint worker returned no JSON (exit={joint_completed.returncode})",
                "stdout_tail": joint_completed.stdout[-2000:],
                "stderr_tail": joint_completed.stderr[-2000:],
                "optimizer_updates": 0,
                "optimizer_step_executed": False,
            }
        if joint_completed.returncode != 0 and joint_result.get("status") == "success":
            joint_result["status"] = "failed"
            joint_result["error"] = f"joint worker exit code {joint_completed.returncode}"
        joint_result["process_tree_peak_rss_bytes_observed"] = joint_process_tree_peak

        model_report = build_report()
        failed = [item for item in benchmark_results if item.get("status") != "success"]
        if loader_result.get("status") != "success":
            failed.append(loader_result)
        if joint_result.get("status") != "success":
            failed.append(joint_result)
        parent_peak_rss = _max_rss_bytes()
        memory_accounting = _process_tree_memory_accounting(
            parent_peak_rss, [*benchmark_results, loader_result, joint_result],
        )
        result = {
            "format_version": 1,
            "status": "blocked" if failed else "measured",
            "benchmark_kind": "cpu_v3_joint_loader_plus_per_family_diagnostics_and_joint_objective_without_optimizer_step",
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "github_run_id": os.environ.get("GITHUB_RUN_ID"),
            "artifacts": artifact_info,
            "conversion_report_sha256": _sha256(gate_payload),
            "manifest_gate": {
                "passed": True,
                "coverage": coverage,
                "accepted_external_records": gate.get("accepted_external_records"),
                "unique_asset_hashes": gate.get("unique_asset_hashes"),
                "asset_hash_count": len(gate["asset_hashes"]),
            },
            "manifest_bundle_sha256": manifest_bundle_sha,
            "manifest_files": manifest_files,
            "train_manifest_sha256": train_manifest_sha,
            "tokenizer": tokenizer_evidence,
            "config_sha256": V3Config().fingerprint,
            "model_report": model_report,
            "memory_accounting": memory_accounting,
            "cpu": {
                "platform": platform.platform(),
                "machine": platform.machine(),
                "processor": platform.processor(),
                "torch_version": torch.__version__,
                "cuda_available": torch.cuda.is_available(),
                "threads": args.threads,
            },
            "shape_distributions": distributions,
            "sequence_length_distributions": sequence_distributions,
            "selected_samples": {
                family: {
                    key: value for key, value in sample.items()
                    if key not in {"text", "local_paths", "asset_paths"}
                }
                for family, sample in selected.items()
            },
            "benchmarks": benchmark_results,
            "data_loader_benchmark": loader_result,
            "joint_training_memory": joint_result,
            "optimizer_updates": 0,
            "optimizer_state_allocated": joint_result.get("optimizer_state_allocated") is True,
            "limitations": [
                "All samples are immutable external V3 train records from the validated corpus artifact.",
                "The model is randomly initialized; this is a resource measurement, not a quality evaluation.",
                "Per-family isolated cases measure forward latency and reconstruction-only backward diagnostics; their backward rates are not the full training objective.",
                "The joint case executes OneCoreV3Objective once per family micro-batch, calls backward in the required five-family order, and accumulates gradients. It then preallocates AdamW state without calling optimizer.step or changing model weights.",
                "The joint case uses one bounded real train micro-batch per family; optional GAN discriminators and paired alignment loss are absent unless the selected sample provides condition_ids. It is a measured resource sample, not a full training run or a quality result.",
                "The production V3JointDataLoader is separately measured on a deterministic quota-complete 100/10/10-per-family sample; it measures data materialization only and does not represent a full-corpus epoch or model compute.",
                "Image resolution is native; audio is the preserved 24 kHz training derivative; video uses original stored frame PNGs and timestamps.",
                "Per-worker peak RSS is the Linux kernel ru_maxrss value; sampled process-tree RSS includes the parent and active worker, while the conservative bound sums separate per-process maxima and may overestimate simultaneous use.",
                "No source acquisition, corpus conversion, tokenizer fitting, V2 import, or checkpoint mutation occurs.",
            ],
        }
        temporary_output = output.with_name(output.name + ".partial")
        temporary_output.write_text(
            json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary_output.replace(output)
        print(json.dumps({
            "status": result["status"],
            "report": str(output),
            "manifest_bundle_sha256": manifest_bundle_sha,
            "tokenizer_sha256": tokenizer_evidence["tokenizer_sha256"],
            "benchmark_cases": len(benchmark_results),
            "failed_cases": len(failed),
            "peak_rss_bytes": [item.get("peak_rss_bytes") for item in benchmark_results],
            "joint_peak_rss_bytes": joint_result.get("peak_rss_bytes"),
            "loader_joint_steps_per_second": loader_result.get("joint_steps_per_second"),
            "loader_peak_rss_bytes": loader_result.get("peak_rss_bytes"),
            "memory_accounting": memory_accounting,
            "joint_optimizer_state_bytes": joint_result.get("optimizer_state_bytes"),
        }, ensure_ascii=False, indent=2))
        return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Measure V3 CPU RSS and per-family throughput from existing validated artifacts."
    )
    parser.add_argument("--github-repo", default="jonsnow-org/Lena9")
    parser.add_argument("--github-token", default=os.environ.get("GITHUB_TOKEN", ""))
    parser.add_argument("--corpus-artifact-id", type=int, default=14892594659)
    parser.add_argument("--expected-corpus-run-id", type=int, default=45325008221)
    parser.add_argument("--report-artifact-id", type=int, default=14893020087)
    parser.add_argument("--expected-report-run-id", type=int, default=45325008221)
    parser.add_argument("--tokenizer-artifact-id", type=int, default=14894835517)
    parser.add_argument("--expected-tokenizer-run-id", type=int, default=45336933362)
    parser.add_argument("--output", default="onecore-v3-resource-benchmark.json")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--iterations", type=int, default=MIN_MEASURED_ITERATIONS)
    parser.add_argument("--max-image-megapixels", type=float, default=2.0)
    parser.add_argument("--max-audio-seconds", type=float, default=5.0)
    parser.add_argument("--max-video-megapixels", type=float, default=1.0)
    parser.add_argument("--max-video-frames", type=int, default=16)
    parser.add_argument("--worker-timeout-seconds", type=int, default=1800)
    parser.add_argument("--tokenizer-json")
    parser.add_argument("--worker-plan")
    parser.add_argument("--joint-plan")
    parser.add_argument("--loader-plan")
    parser.add_argument("--loader-iterations", type=int, default=22)
    parser.add_argument("--loader-warmup-iterations", type=int, default=2)
    args = parser.parse_args(argv)

    if args.threads < 1 or args.max_video_frames < 1:
        parser.error("threads and max-video-frames must be positive")
    if args.iterations < MIN_MEASURED_ITERATIONS:
        parser.error(f"per-family throughput benchmark requires at least {MIN_MEASURED_ITERATIONS} measured iterations")
    if args.max_image_megapixels <= 0 or args.max_audio_seconds <= 0 or args.max_video_megapixels <= 0:
        parser.error("media benchmark limits must be positive")
    worker_modes = [bool(args.worker_plan), bool(args.joint_plan), bool(args.loader_plan)]
    if sum(worker_modes) > 1:
        parser.error("worker-plan, joint-plan and loader-plan are mutually exclusive")
    if args.loader_iterations < 2 or not 0 <= args.loader_warmup_iterations < args.loader_iterations:
        parser.error("loader iterations must exceed non-negative warmup iterations")
    if any(worker_modes):
        try:
            tokenizer_path = Path(args.tokenizer_json).resolve() if args.tokenizer_json else None
            if args.worker_plan:
                result = _worker(Path(args.worker_plan), tokenizer_path, args.threads, args.iterations)
            elif args.joint_plan:
                result = _joint_worker(Path(args.joint_plan), tokenizer_path, args.threads)
            else:
                result = _loader_worker(Path(args.loader_plan), args.threads)
            print(json.dumps(result, ensure_ascii=False))
            return 0 if result.get("status") == "success" else 2
        except Exception as exc:
            print(json.dumps({
                "status": "failed", "error": f"{type(exc).__name__}: {str(exc)}",
                "traceback": traceback.format_exc()[-5000:],
                "optimizer_updates": 0,
                "optimizer_step_executed": False,
            }, ensure_ascii=False))
            return 2
    try:
        return _run_parent(args)
    except Exception as exc:
        failure = {
            "format_version": 1,
            "status": "failed",
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "error": f"{type(exc).__name__}: {str(exc)}",
            "traceback": traceback.format_exc()[-6000:],
            "optimizer_updates": 0,
        }
        output = Path(args.output).resolve()
        if not output.exists():
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(failure, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
