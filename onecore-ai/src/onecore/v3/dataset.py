"""Manifest-backed, resumable five-family data loading for OneCore V3."""
from __future__ import annotations

import hashlib
import json
import math
import random
from array import array
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Mapping
from urllib.parse import urlparse

import numpy as np
import soundfile as sf
import torch
from PIL import Image
from tokenizers import Tokenizer

from onecore.data import external_record_is_trainable, has_immutable_external_provenance

from .checkpoint import V3_DATA_STATE_FORMAT_VERSION, fingerprint_validated_v3_manifests
from .config import V3Config
from .manifest import TASK_GROUPS
from .tokenizer import verify_v3_tokenizer

FAMILIES = tuple(TASK_GROUPS)
TASK_TO_FAMILY = {task: family for family, tasks in TASK_GROUPS.items() for task in tasks}
CONDITION_FIELDS = {
    "image_caption": "caption",
    "audio_text": "transcript",
    "video_caption": "caption",
}


@dataclass(frozen=True)
class V3JointMicroBatch:
    family: str
    batch: dict[str, Any]
    record_id: str
    source_id: str
    source_revision: str
    source_row_id_sha256: str
    metadata: dict[str, Any]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_relative(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("V3 asset path must be a non-empty relative path")
    normalized = value.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"unsafe V3 asset path: {value!r}")
    return path.as_posix()


def _asset_paths(record: Mapping[str, Any]) -> list[str]:
    assets = record.get("assets")
    if not isinstance(assets, dict):
        return []
    paths: list[str] = []
    for family, media in assets.items():
        if not isinstance(media, dict):
            continue
        for field in ("source_asset", "training_asset", "asset_path"):
            value = media.get(field)
            if isinstance(value, str) and value.strip():
                paths.append(_safe_relative(value))
        frames = media.get("frames")
        if isinstance(frames, list):
            paths.extend(_safe_relative(item) for item in frames)
    return list(dict.fromkeys(paths))


def _window_start(row_hash: str, epoch: int, maximum: int, family: str) -> int:
    if maximum <= 0:
        return 0
    seed = int.from_bytes(
        hashlib.sha256(f"{family}:{row_hash}:{epoch}".encode()).digest()[:8], "big"
    )
    return random.Random(seed).randrange(maximum + 1)


def _cursor_id(family: str, source_id: str, revision: str) -> str:
    return f"{family}::{source_id}@{revision}"


class V3JointDataLoader:
    """Validated external-only five-family loader with strict resumable cursors.

    Default windows are 512 text tokens, 5 seconds of canonical-rate audio and
    16 contiguous video frames. Raw assets remain unchanged; each epoch selects
    a deterministic new window. Images are loaded at native resolution.

    A benchmark manifest view may index a quota-complete slice of a larger train
    manifest while verifying the tokenizer against its original full-manifest
    SHA. Benchmark views are deliberately non-checkpointable.
    """

    def __init__(
        self,
        manifest_paths: Mapping[str, str | Path],
        assets_root: str | Path,
        tokenizer_path: str | Path,
        *,
        config: V3Config | None = None,
        max_text_tokens: int | None = 512,
        audio_window_seconds: float | None = 5.0,
        video_window_frames: int | None = 16,
        benchmark_manifest_view: bool = False,
        tokenizer_train_manifest_sha256: str | None = None,
        trusted_asset_hashes: Mapping[str, str] | None = None,
        asset_provider: Callable[[str, Path, str], None] | Any | None = None,
    ) -> None:
        if not isinstance(manifest_paths, Mapping) or set(manifest_paths) != {
            "train", "validation", "test"
        }:
            raise ValueError("manifest_paths must contain exactly train, validation, and test")
        self.config = config or V3Config()
        if not isinstance(self.config, V3Config):
            raise TypeError("config must be a V3Config instance")
        if max_text_tokens is not None and (
            isinstance(max_text_tokens, bool) or not isinstance(max_text_tokens, int)
            or max_text_tokens < 2
        ):
            raise ValueError("max_text_tokens must be None or an integer >= 2")
        if audio_window_seconds is not None and (
            not math.isfinite(float(audio_window_seconds)) or float(audio_window_seconds) <= 0
        ):
            raise ValueError("audio_window_seconds must be None or finite and positive")
        if video_window_frames is not None and (
            isinstance(video_window_frames, bool) or not isinstance(video_window_frames, int)
            or video_window_frames < 1
        ):
            raise ValueError("video_window_frames must be None or a positive integer")

        if not isinstance(benchmark_manifest_view, bool):
            raise TypeError("benchmark_manifest_view must be a boolean")
        if benchmark_manifest_view:
            if (
                not isinstance(tokenizer_train_manifest_sha256, str)
                or len(tokenizer_train_manifest_sha256) != 64
                or any(char not in "0123456789abcdef" for char in tokenizer_train_manifest_sha256.lower())
            ):
                raise ValueError(
                    "benchmark manifest view requires the full tokenizer train-manifest SHA-256"
                )
            tokenizer_train_sha = tokenizer_train_manifest_sha256.lower()
        else:
            if tokenizer_train_manifest_sha256 is not None:
                raise ValueError(
                    "tokenizer_train_manifest_sha256 override is only allowed for a benchmark manifest view"
                )
            tokenizer_train_sha = None

        self.benchmark_manifest_view = benchmark_manifest_view
        self.manifest_paths = {key: Path(value).resolve() for key, value in manifest_paths.items()}
        self.assets_root = Path(assets_root).resolve()
        self.tokenizer_path = Path(tokenizer_path).resolve()
        self.asset_provider = asset_provider
        if asset_provider is not None and not isinstance(trusted_asset_hashes, Mapping):
            raise ValueError("lazy V3 assets require the conversion report's trusted asset SHA-256 map")
        if asset_provider is None and trusted_asset_hashes is not None:
            raise ValueError("trusted asset hashes require an asset provider")
        self.max_text_tokens = max_text_tokens
        self.audio_window_seconds = (
            None if audio_window_seconds is None else float(audio_window_seconds)
        )
        self.video_window_frames = video_window_frames

        self.fingerprint = fingerprint_validated_v3_manifests(
            self.manifest_paths, self.assets_root, minimum_train=100, minimum_holdout=10,
            trusted_asset_hashes=(dict(trusted_asset_hashes) if trusted_asset_hashes is not None else None),
            lazy_assets=asset_provider is not None,
        )
        self.manifest_sha256 = self.fingerprint["manifest_sha256"]
        self.train_manifest_sha256 = self.fingerprint["manifest_files"]["train"]["sha256"]
        validation = self.fingerprint.get("validation")
        if not isinstance(validation, dict) or not isinstance(validation.get("asset_hashes"), dict):
            raise RuntimeError("validated V3 manifest omitted the asset hash map")
        self._asset_hashes = dict(validation["asset_hashes"])

        expected_tokenizer_train_sha = (
            tokenizer_train_sha if self.benchmark_manifest_view else self.train_manifest_sha256
        )
        self.tokenizer_train_manifest_sha256 = expected_tokenizer_train_sha
        self.tokenizer_evidence = verify_v3_tokenizer(
            self.tokenizer_path,
            config=self.config,
            expected_train_manifest_sha256=expected_tokenizer_train_sha,
        )
        self.tokenizer = Tokenizer.from_file(str(self.tokenizer_path))
        self.tokenizer_sha256 = self.tokenizer_evidence["tokenizer_sha256"]

        self._source_offsets: dict[str, array] = {}
        self._source_metadata: dict[str, dict[str, str]] = {}
        self._family_sources: dict[str, list[str]] = {family: [] for family in FAMILIES}
        self._build_train_index()
        self._train_manifest_signature = self._stat_signature(self.manifest_paths["train"])

        self._cursor_counts = {key: 0 for key in self._source_offsets}
        self._cursor_last_hash = {key: None for key in self._source_offsets}
        self._family_state = {
            family: {
                "rows_consumed": 0,
                "last_record_id": None,
                "last_source_cursor_id": None,
            }
            for family in FAMILIES
        }
        self._verified_assets: dict[str, tuple[int, int, int]] = {}
        self._manifest_stream = self.manifest_paths["train"].open("rb")

    @staticmethod
    def _stat_signature(path: Path) -> tuple[int, int, int]:
        stat = path.stat()
        return int(stat.st_size), int(stat.st_mtime_ns), int(stat.st_ctime_ns)

    @property
    def current_step(self) -> int:
        return min(self._family_state[family]["rows_consumed"] for family in FAMILIES)

    @property
    def sampling_policy(self) -> dict[str, Any]:
        return {
            "family_order": list(FAMILIES),
            "source_sampling": "least_consumed_fraction_then_source_cursor_id",
            "max_text_tokens": self.max_text_tokens,
            "audio_window_seconds": self.audio_window_seconds,
            "video_window_frames": self.video_window_frames,
            "image_policy": "native_resolution_no_resize",
            "audio_policy": f"canonical_{self.config.audio_sample_rate}_hz_training_asset",
            "video_policy": "contiguous_deterministic_epoch_window_all_frames_preserved",
            "paired_condition_policy": "same_external_row_caption_or_transcript_for_caption_tasks_only",
        }

    def _build_train_index(self) -> None:
        manifest = self.manifest_paths["train"]
        seen_ids: set[str] = set()
        before = self._stat_signature(manifest)
        with manifest.open("rb") as stream:
            while True:
                offset = stream.tell()
                raw_line = stream.readline()
                if not raw_line:
                    break
                if not raw_line.strip():
                    continue
                try:
                    row = json.loads(raw_line.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise ValueError(f"{manifest}: invalid train JSONL: {exc}") from exc
                if not isinstance(row, dict):
                    raise ValueError("V3 train manifest rows must be JSON objects")
                if row.get("split") != "train":
                    raise ValueError("V3 train manifest contains a non-train row")
                if not external_record_is_trainable(row):
                    continue
                if not has_immutable_external_provenance(row):
                    raise ValueError(f"external V3 row lacks immutable provenance: {row.get('id')}")
                record_id = str(row.get("id", "")).strip()
                if not record_id or record_id in seen_ids:
                    raise ValueError("V3 train manifest contains an empty or duplicate record id")
                seen_ids.add(record_id)
                family = TASK_TO_FAMILY.get(str(row.get("task", "")))
                if family is None:
                    raise ValueError(f"unsupported external V3 task: {row.get('task')!r}")
                self._validate_payload(row, family)

                source_id = str(row["source_id"]).strip()
                revision = str(row["source_revision"]).strip().lower()
                source_url = str(row["source_url"]).strip()
                parsed = urlparse(source_url)
                if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                    raise ValueError(f"invalid source URL for V3 row {record_id}")
                key = _cursor_id(family, source_id, revision)
                metadata = {
                    "family": family,
                    "source_id": source_id,
                    "source_revision": revision,
                    "source_url": source_url,
                }
                existing = self._source_metadata.get(key)
                if existing is None:
                    self._source_metadata[key] = metadata
                    self._source_offsets[key] = array("Q")
                    self._family_sources[family].append(key)
                elif existing != metadata:
                    raise ValueError(f"source metadata changed within cursor {key}")
                self._source_offsets[key].append(offset)
        if self._stat_signature(manifest) != before:
            raise RuntimeError("V3 train manifest changed while its source index was built")
        for family in FAMILIES:
            self._family_sources[family].sort()
            if not self._family_sources[family]:
                raise ValueError(f"validated V3 train manifest has no usable {family} rows")

    def _validate_payload(self, row: dict[str, Any], family: str) -> None:
        record_id = str(row.get("id", ""))
        if family == "text":
            if not isinstance(row.get("text"), str) or not row["text"].strip():
                raise ValueError(f"V3 text row has no text payload: {record_id}")
            return
        if family == "tool":
            if not isinstance(row.get("prompt"), str) or not row["prompt"].strip():
                raise ValueError(f"V3 tool row has no prompt: {record_id}")
            if row.get("response") is None or row.get("response") == "":
                raise ValueError(f"V3 tool row has no response: {record_id}")
            return

        assets = row.get("assets")
        media = assets.get(family) if isinstance(assets, dict) else None
        if not isinstance(media, dict):
            raise ValueError(f"V3 {family} row has no media metadata: {record_id}")
        condition_field = CONDITION_FIELDS.get(str(row.get("task", "")))
        if condition_field is not None:
            condition_text = row.get(condition_field)
            if not isinstance(condition_text, str) or not condition_text.strip():
                raise ValueError(
                    f"V3 {family} caption/transcript task is missing paired condition text: {record_id}"
                )
        paths = _asset_paths(row)
        if not paths or any(path not in self._asset_hashes for path in paths):
            raise ValueError(f"V3 {family} row has an asset absent from the validated hash map: {record_id}")
        if family == "image":
            _safe_relative(media.get("source_asset"))
        elif family == "audio":
            _safe_relative(media.get("training_asset"))
            rate = media.get("training_sample_rate")
            channels = media.get("training_channels", media.get("channels"))
            if isinstance(rate, bool) or not isinstance(rate, int) or rate != self.config.audio_sample_rate:
                raise ValueError(f"V3 audio row is not canonical {self.config.audio_sample_rate} Hz: {record_id}")
            if isinstance(channels, bool) or not isinstance(channels, int):
                raise ValueError(f"V3 audio row has invalid channel metadata: {record_id}")
            if channels not in (1, int(self.config.audio_channels)):
                raise ValueError(f"V3 audio channels are incompatible with config: {record_id}")
        else:
            frames = media.get("frames")
            if not isinstance(frames, list) or not frames:
                raise ValueError(f"V3 video row has no preserved frames: {record_id}")
            if media.get("timestamps") is not None and (
                not isinstance(media["timestamps"], list)
                or len(media["timestamps"]) != len(frames)
            ):
                raise ValueError(f"V3 video timestamps do not match frames: {record_id}")

    def _condition_ids(
        self, row: dict[str, Any], family: str, epoch: int,
    ) -> tuple[torch.Tensor | None, dict[str, Any]]:
        field = CONDITION_FIELDS.get(str(row.get("task", "")))
        if field is None:
            return None, {}
        value = row.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"V3 {family} row is missing paired condition text: {row.get('id')}")
        text_value = value.strip()
        token_ids = self.tokenizer.encode(text_value).ids
        total_tokens = len(token_ids)
        row_hash = str(row.get("source_row_id_sha256", "")).lower()
        if self.max_text_tokens is not None and total_tokens > self.max_text_tokens:
            start = _window_start(
                row_hash, epoch, total_tokens - self.max_text_tokens, f"{family}_condition"
            )
            token_ids = token_ids[start:start + self.max_text_tokens]
        else:
            start = 0
        if not token_ids:
            raise ValueError(f"V3 {family} condition tokenization produced an empty sequence")
        tensor = torch.tensor(token_ids, dtype=torch.long).unsqueeze(0)
        return tensor, {
            "condition_field": field,
            "condition_source": "same_external_record",
            "condition_text_sha256": hashlib.sha256(text_value.encode("utf-8")).hexdigest(),
            "condition_tokens": len(token_ids),
            "source_condition_tokens": total_tokens,
            "condition_window_start": start,
        }

    def _resolve_asset(self, relative: str, record_id: str) -> Path:
        safe = _safe_relative(relative)
        target = (self.assets_root / safe).resolve()
        try:
            target.relative_to(self.assets_root)
        except ValueError as exc:
            raise ValueError(f"V3 asset escapes assets root: {safe}") from exc
        expected = self._asset_hashes.get(safe)
        if not isinstance(expected, str) or len(expected) != 64:
            raise ValueError(f"V3 asset has no validated SHA-256 entry: {safe}")
        if not target.is_file():
            if self.asset_provider is None:
                raise FileNotFoundError(f"V3 asset is missing for {record_id}: {safe}")
            self.asset_provider(safe, target, expected.lower())
        if not target.is_file():
            raise FileNotFoundError(f"V3 lazy asset provider did not materialize {record_id}: {safe}")
        signature = self._stat_signature(target)
        if self._verified_assets.get(safe) != signature:
            if _sha256_file(target) != expected:
                raise ValueError(f"V3 asset SHA-256 changed after manifest validation: {safe}")
            self._verified_assets[safe] = signature
        return target

    def _release_asset(self, relative: str, target: Path) -> None:
        release = getattr(self.asset_provider, "release", None)
        if callable(release):
            release(relative, target)
            self._verified_assets.pop(relative, None)

    def _read_row(self, cursor_id: str, index: int) -> dict[str, Any]:
        if self._stat_signature(self.manifest_paths["train"]) != self._train_manifest_signature:
            raise RuntimeError("V3 train manifest changed after validation")
        offsets = self._source_offsets[cursor_id]
        if not 0 <= index < len(offsets):
            raise IndexError("V3 source cursor index is outside the train manifest")
        self._manifest_stream.seek(offsets[index])
        row = json.loads(self._manifest_stream.readline().decode("utf-8"))
        metadata = self._source_metadata[cursor_id]
        if (
            str(row.get("source_id", "")).strip() != metadata["source_id"]
            or str(row.get("source_revision", "")).strip().lower() != metadata["source_revision"]
            or str(row.get("source_url", "")).strip() != metadata["source_url"]
            or TASK_TO_FAMILY.get(str(row.get("task", ""))) != metadata["family"]
            or row.get("split") != "train"
            or not external_record_is_trainable(row)
        ):
            raise ValueError(f"V3 source cursor row identity changed: {cursor_id}")
        row_hash = str(row.get("source_row_id_sha256", "")).strip().lower()
        if len(row_hash) != 64 or any(c not in "0123456789abcdef" for c in row_hash):
            raise ValueError(f"V3 source cursor row hash is invalid: {cursor_id}")
        return row

    def _materialize(
        self, family: str, row: dict[str, Any], source_count: int, source_size: int,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        record_id = str(row["id"])
        row_hash = str(row["source_row_id_sha256"]).lower()
        epoch = source_count // source_size
        metadata = {
            "record_id": record_id,
            "source_id": str(row["source_id"]),
            "source_revision": str(row["source_revision"]),
            "source_row_id_sha256": row_hash,
            "split": "train",
            "data_class": "external",
        }

        if family in {"text", "tool"}:
            if family == "text":
                text_value = row["text"]
            else:
                response = row["response"]
                response_text = response if isinstance(response, str) else json.dumps(
                    response, ensure_ascii=False, sort_keys=True
                )
                text_value = row["prompt"] + "\n" + response_text
            token_ids = self.tokenizer.encode(text_value).ids
            total_tokens = len(token_ids)
            if self.max_text_tokens is not None and total_tokens > self.max_text_tokens:
                start = _window_start(row_hash, epoch, total_tokens - self.max_text_tokens, family)
                token_ids = token_ids[start:start + self.max_text_tokens]
            else:
                start = 0
            if len(token_ids) < 2:
                raise ValueError(f"V3 {family} row has fewer than two token IDs: {record_id}")
            input_ids = torch.tensor(token_ids, dtype=torch.long).unsqueeze(0)
            metadata.update({
                "sequence_tokens": len(token_ids),
                "source_sequence_tokens": total_tokens,
                "token_window_start": start,
            })
            return {family: {"input_ids": input_ids}}, metadata

        media = row["assets"][family]
        condition_ids, condition_metadata = self._condition_ids(row, family, epoch)
        metadata.update(condition_metadata)
        if family == "image":
            relative = _safe_relative(media["source_asset"])
            image_path = self._resolve_asset(relative, record_id)
            try:
                with Image.open(image_path) as image:
                    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy() / 255.0
            finally:
                self._release_asset(relative, image_path)
            tensor = torch.from_numpy(pixels).permute(2, 0, 1).unsqueeze(0).contiguous()
            metadata.update({
                "width": int(tensor.shape[-1]), "height": int(tensor.shape[-2]),
                "resized": False, "asset_paths": [relative],
            })
            batch = {"images": tensor}
            if condition_ids is not None:
                batch["condition_ids"] = condition_ids
            return {"image": batch}, metadata

        if family == "audio":
            relative = _safe_relative(media["training_asset"])
            path = self._resolve_asset(relative, record_id)
            raw_asset = media.get("source_asset")
            # The conversion report already binds the preserved raw source hash.
            # Training consumes only the canonical derivative; avoid downloading the
            # potentially much larger raw source file solely for a second existence check.
            try:
                with sf.SoundFile(str(path)) as stream:
                    rate, channels, total = int(stream.samplerate), int(stream.channels), int(len(stream))
                    if rate != int(self.config.audio_sample_rate):
                        raise ValueError(f"V3 audio row is not canonical {self.config.audio_sample_rate} Hz")
                    if channels not in (1, int(self.config.audio_channels)):
                        raise ValueError(f"V3 audio channels are incompatible with config: {record_id}")
                    declared_channels = int(media.get("training_channels", media.get("channels", channels)))
                    if channels != declared_channels or total < 1:
                        raise ValueError(f"V3 audio metadata/payload mismatch: {record_id}")
                    window = total if self.audio_window_seconds is None else min(
                        total, max(1, int(round(self.audio_window_seconds * rate)))
                    )
                    start = _window_start(row_hash, epoch, total - window, family)
                    stream.seek(start)
                    samples = stream.read(frames=window, dtype="float32", always_2d=True)
            finally:
                self._release_asset(relative, path)
            if samples.shape[0] != window:
                raise ValueError(f"V3 audio window read was incomplete: {record_id}")
            waveform = torch.from_numpy(samples.T.copy()).unsqueeze(0).contiguous()
            metadata.update({
                "sample_rate": rate, "channels": channels, "samples": window,
                "source_samples": total, "duration_seconds": float(window / rate),
                "window_start_sample": start, "asset_paths": [relative],
            })
            batch = {"waveform": waveform, "sample_rate": rate}
            if condition_ids is not None:
                batch["condition_ids"] = condition_ids
            return {"audio": batch}, metadata

        frame_paths = [_safe_relative(path) for path in media["frames"]]
        if media.get("frame_count") is not None and int(media["frame_count"]) != len(frame_paths):
            raise ValueError(f"V3 video frame_count metadata mismatch: {record_id}")
        count = len(frame_paths)
        window = count if self.video_window_frames is None else min(count, self.video_window_frames)
        start = _window_start(row_hash, epoch, count - window, family)
        selected = frame_paths[start:start + window]
        frames = []
        dimensions = set()
        for relative in selected:
            frame_path = self._resolve_asset(relative, record_id)
            try:
                with Image.open(frame_path) as image:
                    pixels = np.asarray(image.convert("RGB"), dtype=np.float32).copy() / 255.0
                dimensions.add((int(pixels.shape[0]), int(pixels.shape[1])))
                frames.append(pixels)
            finally:
                self._release_asset(relative, frame_path)
        if not frames or len(dimensions) != 1:
            raise ValueError(f"V3 video frames are empty or inconsistent: {record_id}")
        video = torch.from_numpy(np.stack(frames)).permute(0, 3, 1, 2).unsqueeze(0).contiguous()
        timestamps = None
        if isinstance(media.get("timestamps"), list):
            values = [float(value) for value in media["timestamps"][start:start + window]]
            if len(values) != window or not all(math.isfinite(value) for value in values):
                raise ValueError(f"V3 video timestamp window is invalid: {record_id}")
            if len(values) > 1 and any(b <= a for a, b in zip(values, values[1:])):
                raise ValueError(f"V3 video timestamps are not strictly increasing: {record_id}")
            timestamps = torch.tensor(values, dtype=torch.float32).unsqueeze(0)
        metadata.update({
            "frames": window, "source_frames": count,
            "height": int(video.shape[-2]), "width": int(video.shape[-1]),
            "window_start_frame": start, "timestamp_unit": media.get("timestamp_unit"),
            "timestamps_supplied": timestamps is not None, "asset_paths": selected,
        })
        batch = {"frames": video, "timestamps": timestamps}
        if condition_ids is not None:
            batch["condition_ids"] = condition_ids
        return {"video": batch}, metadata

    def _prepare_family(self, family: str) -> tuple[V3JointMicroBatch, str, str]:
        keys = self._family_sources[family]
        cursor_id = min(
            keys,
            key=lambda key: (self._cursor_counts[key] / len(self._source_offsets[key]), key),
        )
        consumed = self._cursor_counts[cursor_id]
        offsets = self._source_offsets[cursor_id]
        row = self._read_row(cursor_id, consumed % len(offsets))
        batch, metadata = self._materialize(family, row, consumed, len(offsets))
        item = V3JointMicroBatch(
            family, batch, str(row["id"]), str(row["source_id"]),
            str(row["source_revision"]), str(row["source_row_id_sha256"]).lower(), metadata,
        )
        return item, cursor_id, item.source_row_id_sha256

    def next_joint_micro_batches(self) -> tuple[V3JointMicroBatch, ...]:
        """Build all five batches before committing any cursor."""
        pending = [self._prepare_family(family) for family in FAMILIES]
        for item, cursor_id, row_hash in pending:
            self._cursor_counts[cursor_id] += 1
            self._cursor_last_hash[cursor_id] = row_hash
            state = self._family_state[item.family]
            state["rows_consumed"] += 1
            state["last_record_id"] = item.record_id
            state["last_source_cursor_id"] = cursor_id
        return tuple(item for item, _cursor_id, _row_hash in pending)

    def state_dict(self) -> dict[str, Any]:
        if self.benchmark_manifest_view:
            raise RuntimeError(
                "benchmark manifest view cannot be serialized as a training checkpoint data state"
            )
        source_cursors = {}
        for cursor_id in sorted(self._source_metadata):
            metadata = self._source_metadata[cursor_id]
            rows = int(self._cursor_counts[cursor_id])
            source_cursors[cursor_id] = {
                **metadata,
                "data_class": "external",
                "split": "train",
                "rows_consumed": rows,
                "cursor_state": {"mode": "offset", "offset": rows},
                "last_source_row_id_sha256": self._cursor_last_hash[cursor_id],
            }
        return json.loads(json.dumps({
            "format_version": V3_DATA_STATE_FORMAT_VERSION,
            "manifest_sha256": self.manifest_sha256,
            "train_manifest_sha256": self.train_manifest_sha256,
            "config_sha256": self.config.fingerprint,
            "tokenizer_sha256": self.tokenizer_sha256,
            "split": "train",
            "sampling_policy": self.sampling_policy,
            "families": self._family_state,
            "source_cursors": source_cursors,
        }, ensure_ascii=False, sort_keys=True))

    def load_state_dict(self, state: Mapping[str, Any]) -> None:
        if self.benchmark_manifest_view:
            raise RuntimeError(
                "benchmark manifest view cannot restore a training checkpoint data state"
            )
        if not isinstance(state, Mapping):
            raise TypeError("V3 loader state must be a mapping")
        try:
            value = json.loads(json.dumps(dict(state), ensure_ascii=False, sort_keys=True))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"V3 loader state is not JSON-serializable: {exc}") from exc

        expected = {
            "format_version": V3_DATA_STATE_FORMAT_VERSION,
            "manifest_sha256": self.manifest_sha256,
            "train_manifest_sha256": self.train_manifest_sha256,
            "config_sha256": self.config.fingerprint,
            "tokenizer_sha256": self.tokenizer_sha256,
            "split": "train",
            "sampling_policy": self.sampling_policy,
        }
        for field, expected_value in expected.items():
            if value.get(field) != expected_value:
                raise ValueError(f"V3 loader state {field} mismatch")

        families, cursors = value.get("families"), value.get("source_cursors")
        if not isinstance(families, dict) or set(families) != set(FAMILIES):
            raise ValueError("V3 loader state must contain exactly the five families")
        if not isinstance(cursors, dict) or set(cursors) != set(self._source_metadata):
            raise ValueError("V3 source cursor set does not match the validated train manifest")

        staged_counts: dict[str, int] = {}
        staged_hashes: dict[str, str | None] = {}
        for cursor_id, metadata in self._source_metadata.items():
            cursor = cursors[cursor_id]
            if not isinstance(cursor, dict):
                raise ValueError(f"V3 source cursor is invalid: {cursor_id}")
            for field, expected_value in {
                **metadata, "data_class": "external", "split": "train",
            }.items():
                if cursor.get(field) != expected_value:
                    raise ValueError(f"V3 source cursor {field} mismatch: {cursor_id}")
            rows = cursor.get("rows_consumed")
            if isinstance(rows, bool) or not isinstance(rows, int) or rows < 0:
                raise ValueError(f"V3 source cursor rows_consumed is invalid: {cursor_id}")
            cursor_state = cursor.get("cursor_state")
            if (
                not isinstance(cursor_state, dict)
                or cursor_state.get("mode") != "offset"
                or cursor_state.get("offset") != rows
            ):
                raise ValueError(f"V3 source cursor offset mismatch: {cursor_id}")
            last_hash = cursor.get("last_source_row_id_sha256")
            if rows == 0:
                if last_hash is not None:
                    raise ValueError(f"empty V3 source cursor has a row hash: {cursor_id}")
            else:
                if (
                    not isinstance(last_hash, str) or len(last_hash) != 64
                    or any(char not in "0123456789abcdef" for char in last_hash)
                ):
                    raise ValueError(f"V3 source cursor row hash is invalid: {cursor_id}")
                last_row = self._read_row(
                    cursor_id, (rows - 1) % len(self._source_offsets[cursor_id])
                )
                if str(last_row.get("source_row_id_sha256", "")).lower() != last_hash:
                    raise ValueError(f"V3 source cursor row anchor mismatch: {cursor_id}")
            staged_counts[cursor_id] = rows
            staged_hashes[cursor_id] = last_hash

        staged_families = {}
        family_steps = []
        for family in FAMILIES:
            family_state = families[family]
            if not isinstance(family_state, dict):
                raise ValueError(f"V3 family cursor is invalid: {family}")
            rows = family_state.get("rows_consumed")
            if isinstance(rows, bool) or not isinstance(rows, int) or rows < 0:
                raise ValueError(f"V3 family rows_consumed is invalid: {family}")
            total = sum(staged_counts[key] for key in self._family_sources[family])
            if rows != total:
                raise ValueError(f"V3 family/source cursor totals mismatch: {family}")
            last_id = family_state.get("last_record_id")
            last_cursor = family_state.get("last_source_cursor_id")
            if rows == 0:
                if last_id is not None or last_cursor is not None:
                    raise ValueError(f"empty V3 family cursor has a last-record identity: {family}")
            else:
                if last_cursor not in self._family_sources[family] or staged_counts[last_cursor] < 1:
                    raise ValueError(f"V3 family last-source cursor is invalid: {family}")
                last_row = self._read_row(
                    last_cursor,
                    (staged_counts[last_cursor] - 1) % len(self._source_offsets[last_cursor]),
                )
                if str(last_row.get("id", "")) != last_id:
                    raise ValueError(f"V3 family last-record anchor mismatch: {family}")
            family_steps.append(rows)
            staged_families[family] = {
                "rows_consumed": rows,
                "last_record_id": last_id,
                "last_source_cursor_id": last_cursor,
            }
        if len(set(family_steps)) != 1:
            raise ValueError("V3 joint family cursors have diverged step counts")

        self._cursor_counts = staged_counts
        self._cursor_last_hash = staged_hashes
        self._family_state = staged_families

    def close(self) -> None:
        stream = getattr(self, "_manifest_stream", None)
        if stream is not None and not stream.closed:
            stream.close()
        close_provider = getattr(self.asset_provider, "close", None)
        if callable(close_provider):
            close_provider()

    def __enter__(self) -> "V3JointDataLoader":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback_value: Any) -> None:
        self.close()
