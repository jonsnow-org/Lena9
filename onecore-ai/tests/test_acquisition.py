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
    _grouped_split,
    _record_from_row,
    _stable_split,
    _training_manifest_base,
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
    assert {"text", "audio", "image_url", "image_base64", "video", "video_url",
            "video_repo_file", "video_manifest"} <= adapters
    assert {"fineweb2_hq_ar", "open_web_math_pro", "fleurs_ar", "open_images_v7",
            "sard_arabic_documents", "finevideo", "laion_bvd_video_55m",
            "coyo_700m", "conceptual_captions_12m", "sharegpt4v_images",
            "webvid_10m_video", "msrvtt_video"} <= ids


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
    feature_file = tmp_path / audio_record["audio_features"]
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


def test_sharegpt4v_conversation_is_paired_with_its_image(tmp_path: Path, monkeypatch) -> None:
    import onecore.acquire as acquire_module

    def save_fixture(_value, destination: Path) -> bool:
        destination.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (64, 64), (80, 90, 100)).save(destination, format="PNG")
        return True

    monkeypatch.setattr(acquire_module, "_save_image", save_fixture)
    source = {
        "id": "sharegpt4v-test",
        "repo": "Lin-Chen/ShareGPT4V",
        "adapter": "image_url",
        "image_field": "image",
        "image_url_prefix": "https://images.cocodataset.org/train2017",
        "conversation_field": "conversations",
        "license": "fixture",
        "attribution": "ShareGPT4V fixture",
    }
    record = _record_from_row(
        {
            "image": "coco/train2017/000000000009.jpg",
            "conversations": [
                {"from": "human", "value": "What is visible? <image>"},
                {"from": "gpt", "value": "A tray with food containers."},
            ],
        },
        source, "share-row-1", "train", tmp_path,
    )
    assert record is not None
    assert record["task"] == "image_caption"
    assert "Question: What is visible?" in record["caption"]
    assert "Answer: A tray with food containers." in record["caption"]
    assert (tmp_path / record["image"]).is_file()


def test_video_url_adapter_builds_frames_for_onecore(tmp_path: Path, monkeypatch) -> None:
    import onecore.acquire as acquire_module

    def fake_write_frames(value, assets_root: Path, prefix: str, max_frames: int = 4):
        assert value == "https://media.example/video.mp4"
        saved = []
        for index in range(3):
            relative = f"acquired/{prefix}/frame_{index:02d}.png"
            target = assets_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            Image.new("RGB", (64, 64), (index * 30, 60, 90)).save(target, format="PNG")
            saved.append(relative)
        return saved

    monkeypatch.setattr(acquire_module, "_write_frames", fake_write_frames)
    source = {
        "id": "webvid-test",
        "repo": "TempoFunk/webvid-10M",
        "adapter": "video_url",
        "video_field": "contentUrl",
        "text_fields": ["name"],
        "license": "fixture",
        "attribution": "WebVid fixture",
    }
    record = _record_from_row(
        {"contentUrl": "https://media.example/video.mp4", "name": "Aerial forest view"},
        source, "video-row-1", "train", tmp_path,
    )
    assert record is not None
    assert record["task"] == "video_caption"
    assert record["caption"] == "Aerial forest view"
    assert len(record["frames"]) == 3


def test_video_repo_file_adapter_uses_pinned_hub_revision(tmp_path: Path, monkeypatch) -> None:
    import sys
    import types
    import onecore.acquire as acquire_module

    downloaded = tmp_path / "video.mp4"
    downloaded.write_bytes(b"fake-mp4")
    seen = {}

    def fake_download(**kwargs):
        seen.update(kwargs)
        return str(downloaded)

    fake_hub = types.SimpleNamespace(hf_hub_download=fake_download)
    monkeypatch.setitem(sys.modules, "huggingface_hub", fake_hub)

    def fake_write_frames(value, assets_root: Path, prefix: str, max_frames: int = 4):
        assert value == {"path": str(downloaded)}
        target = assets_root / f"acquired/{prefix}/frame_00.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (64, 64), (10, 20, 30)).save(target, format="PNG")
        return [str(target.relative_to(assets_root))]

    monkeypatch.setattr(acquire_module, "_write_frames", fake_write_frames)
    source = {
        "id": "msrvtt-test",
        "repo": "NTQAI/MSR-VTT-Video-Captioning-Vi",
        "adapter": "video_repo_file",
        "video_field": "video",
        "text_fields": ["caption"],
        "_resolved_revision": "pinned-sha",
        "license": "fixture",
        "attribution": "MSR-VTT fixture",
    }
    record = _record_from_row(
        {"video": "videos/video2447.mp4", "caption": "A conference scene"},
        source, "msrvtt-row-1", "train", tmp_path,
    )
    assert record is not None
    assert record["task"] == "video_caption"
    assert seen["filename"] == "videos/video2447.mp4"
    assert seen["revision"] == "pinned-sha"


def test_long_natural_text_is_truncated_to_context_not_dropped(tmp_path: Path) -> None:
    from onecore.config import ModelConfig
    from onecore.model import OneCore
    from onecore.train import _record_sequence

    class Encoded:
        ids = [index % 2000 for index in range(1000)]

    class FakeTokenizer:
        def encode(self, _text: str):
            return Encoded()

    cfg = ModelConfig(
        width=32, unique_blocks=1, recurrent_cycles=1, attention_heads=4,
        max_sequence_length=64, text_vocab_size=4096,
        vision_codebook_size=8, audio_codebook_size=8, motion_codebook_size=8,
        special_tokens=24, patch_size=8, image_size=64,
        audio_bins=80, audio_group_frames=4, max_video_frames=4,
    )
    model = OneCore(cfg)
    sequence, _, task = _record_sequence(
        {"id": "long-text", "task": "text", "text": "A long natural-language document"},
        model, FakeTokenizer(), tmp_path,
    )
    assert task == "text"
    assert tuple(sequence.shape) == (1, 64)


def test_source_revision_and_parent_fingerprints_cover_existing_media(tmp_path: Path) -> None:
    from onecore.train import _asset_manifest_sha256

    assets = tmp_path / "data" / "assets"
    assets.mkdir(parents=True)
    image_path = assets / "parent.png"
    Image.new("RGB", (64, 64), (11, 22, 33)).save(image_path, format="PNG")
    record = {
        "id": "parent-image",
        "task": "image_reconstruction",
        "image": "parent.png",
        "license": "fixture",
        "source_url": "https://example.test/source",
        "attribution": "fixture",
        "split": "train",
        "review_status": "pending",
        "data_class": "external_staged",
    }
    manifest = tmp_path / "data" / "train.jsonl"
    manifest.write_text(json.dumps(record, ensure_ascii=False) + "\n", encoding="utf-8")
    base = _training_manifest_base(tmp_path)
    assert base["base_train_records"] == 1
    assert base["base_train_manifest_sha256"] is not None
    assert base["base_asset_manifest_sha256"] == _asset_manifest_sha256(tmp_path, [record])

    appended = {
        "id": "new-text",
        "task": "text",
        "text": "A streamed training sentence.",
        "license": "fixture",
        "source_url": "https://example.test/new",
        "attribution": "fixture",
        "split": "train",
        "review_status": "pending",
        "data_class": "external_staged",
    }
    _append_manifests(tmp_path, {"train": [appended], "validation": [], "test": []})
    assert base["base_train_manifest_sha256"] != _training_manifest_base(tmp_path)["base_train_manifest_sha256"]


def test_long_natural_text_is_truncated_to_context_not_dropped(tmp_path: Path) -> None:
    from onecore.config import ModelConfig
    from onecore.model import OneCore
    from onecore.train import _record_sequence

    class Encoded:
        ids = [index % 2000 for index in range(1000)]

    class FakeTokenizer:
        def encode(self, _text: str):
            return Encoded()

    cfg = ModelConfig(
        width=32, unique_blocks=1, recurrent_cycles=1, attention_heads=4,
        max_sequence_length=64, text_vocab_size=4096,
        vision_codebook_size=8, audio_codebook_size=8, motion_codebook_size=8,
        special_tokens=24, patch_size=8, image_size=64,
        audio_bins=80, audio_group_frames=4, max_video_frames=4,
    )
    model = OneCore(cfg)
    sequence, _, task = _record_sequence(
        {"id": "long-text", "task": "text", "text": "A long natural-language document"},
        model, FakeTokenizer(), tmp_path,
    )
    assert task == "text"
    assert tuple(sequence.shape) == (1, 64)


def test_captions_for_the_same_media_never_cross_dataset_splits() -> None:
    source = {"id": "msrvtt", "split_strategy": "hash", "split_group_field": "video"}
    first = {"video": "videos/video2447.mp4", "caption": "A conference"}
    second = {"video": "videos/video2447.mp4", "caption": "A presenter speaking"}
    split_first = _grouped_split(source, first, "train", "row-1", "stable-seed")
    split_second = _grouped_split(source, second, "train", "row-2", "stable-seed")
    assert split_first == split_second
    assert _grouped_split(
        source, {"video": "videos/video2448.mp4"}, "train", "row-3", "stable-seed"
    ) == _grouped_split(
        source, {"video": "videos/video2448.mp4"}, "train", "row-4", "stable-seed"
    )
