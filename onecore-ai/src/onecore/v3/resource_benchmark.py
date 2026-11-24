"""Bounded CPU resource profiling against the already-validated V3 corpus.

This is a measurement harness, not a training runner. It range-reads the existing
GitHub artifacts, extracts only representative real samples, and performs no
optimizer steps or checkpoint writes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
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
from onecore.v3.manifest import TASK_GROUPS, read_v3_manifest
from onecore.v3.report import build_report
from onecore.v3.tokenizer import sha256_file, verify_v3_tokenizer


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _artifact_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _artifact_metadata(repo: str, artifact_id: int, token: str,
                       expected_run_id: int) -> dict[str, Any]:
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
    workflow_run = metadata.get("workflow_run") or {}
    if int(workflow_run.get("id", -1)) != int(expected_run_id):
        raise RuntimeError(
            f"artifact {artifact_id} belongs to run {workflow_run.get('id')}, "
            f"expected immutable run {expected_run_id}"
        )
    return {
        "id": int(metadata["id"]),
        "name": str(metadata.get("name", "")),
        "size_in_bytes": int(metadata.get("size_in_bytes", 0)),
        "expired": bool(metadata.get("expired", False)),
        "workflow_run_id": int(workflow_run["id"]),
    }


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

    for family in ("text", "tool", "image", "audio", "video"):
        value = best.get(family) or fallback.get(family)
        if value is None:
            raise ValueError(f"no immutable external train sample is available for {family}")
        selected[family] = value[1]

    summaries = {name: _distribution(values) for name, values in stats.items()}
    return selected, summaries



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


def _max_rss_bytes() -> int:
    if not sys.platform.startswith("linux"):
        raise RuntimeError("peak RSS measurement currently requires a Linux runner")
    return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) * 1024


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

        with torch.no_grad():
            run_pass(False)
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
            "inference_units_per_second": round(throughput_units / max(mean_inference, 1e-9), 6),
            "forward_backward_units_per_second": round(throughput_units / max(mean_backward, 1e-9), 6),
            "mean_loss_diagnostic_only": round(float(np.mean(losses)), 8),
            "peak_rss_bytes": peak_rss,
            "baseline_current_rss_bytes": baseline_current,
            "baseline_peak_rss_bytes": baseline_peak,
            "peak_rss_growth_bytes": max(0, peak_rss - baseline_peak),
            "cpu_threads": threads,
            "iterations": iterations,
            "optimizer_step_executed": False,
            "elapsed_seconds": round(time.perf_counter() - started, 6),
        }
    except Exception as exc:
        return {
            "status": "failed",
            "family": None,
            "error": f"{type(exc).__name__}: {str(exc)}",
            "traceback": traceback.format_exc()[-4000:],
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
        "corpus": _artifact_metadata(args.github_repo, args.corpus_artifact_id,
                                     args.github_token, args.expected_corpus_run_id),
        "conversion_report": _artifact_metadata(args.github_repo, args.report_artifact_id,
                                                args.github_token, args.expected_report_run_id),
        "tokenizer": _artifact_metadata(args.github_repo, args.tokenizer_artifact_id,
                                        args.github_token, args.expected_tokenizer_run_id),
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
                    expected = gate["asset_hashes"].get(relative)
                    if not isinstance(expected, str) or len(expected) != 64:
                        raise ValueError(f"selected asset is absent from the validated hash map: {relative}")
                    member = _unique_suffix(names, f"data/assets/{relative}")
                    destination = assets_root / relative
                    _extract_member(archive, member, destination)
                    actual = sha256_file(destination)
                    if actual != expected:
                        raise ValueError(f"selected raw/training asset hash mismatch: {relative}")
                    local_paths.append(str(destination))
                sample["local_paths"] = local_paths

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
            completed = subprocess.run(
                command, capture_output=True, text=True, timeout=args.worker_timeout_seconds,
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
            worker_result["case_index"] = index
            benchmark_results.append(worker_result)

        model_report = build_report()
        failed = [item for item in benchmark_results if item.get("status") != "success"]
        result = {
            "format_version": 1,
            "status": "blocked" if failed else "measured",
            "benchmark_kind": "cpu_forward_backward_without_optimizer_step",
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
            "optimizer_updates": 0,
            "optimizer_state_allocated": False,
            "limitations": [
                "All samples are immutable external V3 train records from the validated corpus artifact.",
                "The model is randomly initialized; this is a resource measurement, not a quality evaluation.",
                "Each case measures inference and forward/backward latency in an isolated CPU process.",
                "No optimizer step is executed and AdamW moment tensors are not allocated; measured peak RSS is not a complete optimizer-training memory budget.",
                "Image resolution is native; audio is the preserved 24 kHz training derivative; video uses original stored frame PNGs and timestamps.",
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
    parser.add_argument("--iterations", type=int, default=2)
    parser.add_argument("--max-image-megapixels", type=float, default=2.0)
    parser.add_argument("--max-audio-seconds", type=float, default=5.0)
    parser.add_argument("--max-video-megapixels", type=float, default=1.0)
    parser.add_argument("--max-video-frames", type=int, default=16)
    parser.add_argument("--worker-timeout-seconds", type=int, default=1800)
    parser.add_argument("--tokenizer-json")
    parser.add_argument("--worker-plan")
    args = parser.parse_args(argv)

    if args.threads < 1 or args.iterations < 1 or args.max_video_frames < 1:
        parser.error("threads, iterations and max-video-frames must be positive")
    if args.max_image_megapixels <= 0 or args.max_audio_seconds <= 0 or args.max_video_megapixels <= 0:
        parser.error("media benchmark limits must be positive")
    if args.worker_plan:
        try:
            tokenizer_path = Path(args.tokenizer_json).resolve() if args.tokenizer_json else None
            result = _worker(Path(args.worker_plan), tokenizer_path, args.threads, args.iterations)
            print(json.dumps(result, ensure_ascii=False))
            return 0 if result.get("status") == "success" else 2
        except Exception as exc:
            print(json.dumps({
                "status": "failed", "error": f"{type(exc).__name__}: {str(exc)}",
                "traceback": traceback.format_exc()[-4000:],
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
