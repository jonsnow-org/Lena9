from __future__ import annotations

import base64
import io
import json
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

from onecore.acquire import (
    _append_manifests,
    _assign_split,
    _record_from_row,
    _stable_split,
)
from onecore.data import validate_manifest


def _png_base64() -> str:
    stream = io.BytesIO()
    Image.new("RGB", (16, 12), (20, 80, 140)).save(stream, format="PNG")
    return base64.b64encode(stream.getvalue()).decode("ascii")


def test_source_registry_covers_all_shared_modalities() -> None:
    root = Path(__file__).resolve().parents[1]
    registry = yaml.safe_load((root / "data" / "sources.yaml").read_text(encoding="utf-8"))
    sources = registry["sources"]
    ids = {item["id"] for item in sources}
    adapters = {item["adapter"] for item in sources}
    assert len(ids) >= 20
    assert len(ids) == len(sources)
    assert {"text", "audio", "image_url", "image_base64", "video", "video_manifest"} <= adapters
    assert {"fineweb2_hq_ar", "open_web_math_pro", "fleurs_ar", "open_images_v7",
            "sard_arabic_documents", "finevideo", "laion_bvd_video_55m"} <= ids


def test_split_assignment_is_stable_and_preserves_published_holdouts() -> None:
    source = {"id": "test-source", "split_strategy": "hash"}
    first = _stable_split("test-source", "document-17")
    assert first == _stable_split("test-source", "document-17")
    assert first in {"train", "validation", "test"}
    assert _assign_split(source, "test", "document-17", "seed") == "test"
    assert _assign_split(source, "validation", "document-17", "seed") == "validation"
    partitions = {_stable_split("s", f"row-{i}") for i in range(500)}
    assert partitions == {"train", "validation", "test"}


def test_arabic_document_images_become_captioned_onecore_records(tmp_path: Path) -> None:
    source = {
        "id": "sard-test",
        "repo": "riotu-lab/SARD",
        "adapter": "image_base64",
        "image_field": "image_base64",
        "text_fields": ["chunk"],
        "license": "source-test-license",
        "attribution": "SARD test fixture",
    }
    record = _record_from_row(
        {"image_base64": _png_base64(), "chunk": "نص عربي تجريبي لقراءة المستند"},
        source,
        "row-1",
        "train",
        tmp_path,
    )
    assert record is not None
    assert record["task"] == "image_caption"
    assert record["data_class"] == "external_staged"
    assert record["review_status"] == "pending"
    report = validate_manifest([record], tmp_path, expected_split="train")
    assert report["valid"], report["errors"]


def test_open_image_without_caption_trains_shared_visual_reconstruction(tmp_path: Path) -> None:
    source = {
        "id": "open-images-test",
        "repo": "bitmind/open-images-v7",
        "adapter": "image",
        "image_field": "image",
        "text_fields": [],
        "license": "source-test-license",
        "attribution": "Open Images fixture",
    }
    record = _record_from_row(
        {"image": Image.new("RGB", (16, 16), (40, 90, 130))},
        source,
        "image-1",
        "train",
        tmp_path,
    )
    assert record is not None
    assert record["task"] == "image_reconstruction"
    assert "caption" not in record
    report = validate_manifest([record], tmp_path, expected_split="train")
    assert report["valid"], report["errors"]


def test_audio_and_video_payloads_are_prepared_as_shared_modalities(tmp_path: Path) -> None:
    audio_source = {
        "id": "audio-test",
        "repo": "google/fleurs",
        "adapter": "audio",
        "audio_field": "audio",
        "text_fields": [],
        "license": "cc-by-4.0",
        "attribution": "FLEURS test fixture",
    }
    wave = np.sin(np.arange(8000, dtype=np.float32) * (2.0 * np.pi * 220.0 / 16000))
    audio_record = _record_from_row(
        {"audio": {"array": wave, "sampling_rate": 16000}},
        audio_source,
        "audio-1",
        "train",
        tmp_path,
    )
    assert audio_record is not None
    assert audio_record["task"] == "audio_reconstruction"
    feature_file = tmp_path / "data" / "assets" / audio_record["audio_features"]
    features = np.load(feature_file, allow_pickle=False)
    assert features.ndim == 2 and features.shape[1] == 80

    video_source = {
        "id": "video-test",
        "repo": "video-fixture",
        "adapter": "video",
        "video_field": "video",
        "text_fields": [],
        "license": "source-test-license",
        "attribution": "Video fixture",
    }
    video_record = _record_from_row(
        {"video": [Image.new("RGB", (16, 16), (i * 40, 20, 60)) for i in range(4)]},
        video_source,
        "video-1",
        "train",
        tmp_path,
    )
    assert video_record is not None
    assert video_record["task"] == "video_reconstruction"
    assert len(video_record["frames"]) == 4
    report = validate_manifest([video_record], tmp_path, expected_split="train")
    assert report["valid"], report["errors"]


def test_manifest_merge_is_idempotent_and_split_local(tmp_path: Path) -> None:
    data_root = tmp_path / "data"
    data_root.mkdir()
    for split in ("train", "validation", "test"):
        (data_root / f"{split}.jsonl").write_text("", encoding="utf-8")
    rows = {
        "train": [{"id": "x", "task": "text", "split": "train"}],
        "validation": [{"id": "y", "task": "text", "split": "validation"}],
        "test": [],
    }
    first = _append_manifests(tmp_path, rows)
    second = _append_manifests(tmp_path, rows)
    assert first == {"train": 1, "validation": 1, "test": 0}
    assert second == {"train": 0, "validation": 0, "test": 0}
    train = [json.loads(line) for line in (data_root / "train.jsonl").read_text().splitlines()]
    validation = [json.loads(line) for line in (data_root / "validation.jsonl").read_text().splitlines()]
    assert [item["id"] for item in train] == ["x"]
    assert [item["id"] for item in validation] == ["y"]
