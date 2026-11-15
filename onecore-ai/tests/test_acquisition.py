from __future__ import annotations

import base64
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import pytest
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
from onecore.data import license_is_trainable, validate_manifest


def _png_base64() -> str:
    stream = io.BytesIO()
    Image.new("RGB", (16, 12), (20, 80, 140)).save(stream, format="PNG")
    return base64.b64encode(stream.getvalue()).decode("ascii")


def _external_metadata(source_id: str, row_id: str) -> dict[str, str]:
    return {
        "license": "cc-by-4.0",
        "source_url": "https://example.org/dataset",
        "attribution": "fixture dataset authors",
        "review_status": "pending",
        "data_class": "external_staged",
        "source_id": source_id,
        "source_revision": "a" * 40,
        "source_row_id_sha256": hashlib.sha256(row_id.encode("utf-8")).hexdigest(),
    }

def test_source_registry_covers_all_shared_modalities() -> None:
    root = Path(__file__).resolve().parents[1]
    registry = yaml.safe_load((root / "data" / "sources.yaml").read_text(encoding="utf-8"))
    sources = registry["sources"]
    ids = {item["id"] for item in sources}
    adapters = {item["adapter"] for item in sources}
    assert len(ids) >= 20
    assert len(ids) == len(sources)
    assert {"text", "tool_use", "audio", "image_url", "image_base64", "video", "video_url",
            "video_repo_file", "video_manifest", "metadata_only"} <= adapters
    for source in sources:
        if not source.get("enabled", True):
            continue
        assert str(source.get("attribution", "")).strip(), source["id"]
        if source.get("license_field"):
            assert source.get("license") == "per-document-license-metadata", source["id"]
        else:
            assert license_is_trainable(source.get("license")), source["id"]
    assert {"fineweb2_hq_ar", "fineweb2_hq_ar_saudi", "fineweb2_hq_ar_moroccan",
            "fineweb2_hq_ar_egyptian", "fineweb2_full_ar", "fineweb2_full_ar_saudi",
            "fineweb2_full_ar_moroccan", "fineweb2_full_ar_egyptian",
            "open_web_math_pro", "fleurs_ar", "open_images_v7", "sard_arabic_documents",
            "finevideo", "laion_bvd_video_55m", "coyo_700m", "conceptual_captions_12m",
            "sharegpt4v_images", "webvid_10m_video", "msrvtt_video",
            "saxo_function_calling", "turkish_mobile_function_calling"} <= ids


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
        "license": "cc-by-4.0",
        "attribution": "SARD test fixture",
        "_resolved_revision": "a" * 40,
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
        "license": "cc-by-4.0",
        "license": "cc-by-2.0",
        "attribution": "Open Images fixture",
        "_resolved_revision": "a" * 40,
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
    image_file = tmp_path / record["image"]
    assert record["asset_content_group_ids"] == [
        f"asset-sha256:{hashlib.sha256(image_file.read_bytes()).hexdigest()}"
    ]
    report = validate_manifest([record], tmp_path, expected_split="train")
    assert report["valid"], report["errors"]



def test_image_adapter_exposes_decode_failure_reason(tmp_path: Path, monkeypatch) -> None:
    import onecore.acquire as acquire_module

    monkeypatch.setattr(acquire_module, "_save_image", lambda _value, _destination: False)
    source = {
        "id": "image-error-test",
        "repo": "fixture/images",
        "adapter": "image",
        "image_field": "image",
        "text_fields": [],
        "license": "cc-by-4.0",
        "attribution": "fixture",
    }
    with pytest.raises(ValueError, match="image adapter could not decode or download"):
        _record_from_row({"image": "https://example.invalid/image.jpg"}, source, "row-1", "train", tmp_path)


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
        "license": "cc-by-4.0",
        "attribution": "Video fixture",
        "_resolved_revision": "a" * 40,
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


def test_manifest_merge_joins_duplicate_asset_content_across_sources_transitively(tmp_path: Path) -> None:
    from onecore.data import validate_split_disjointness

    data_root = tmp_path / "data"
    assets = data_root / "assets" / "acquired"
    assets.mkdir(parents=True)
    frame_one = "acquired/frame-one.png"
    frame_two = "acquired/frame-two.png"
    Image.new("RGB", (16, 16), (20, 40, 60)).save(assets / Path(frame_one).name, format="PNG")
    Image.new("RGB", (16, 16), (80, 100, 120)).save(assets / Path(frame_two).name, format="PNG")
    rows = {
        "train": [{
            "id": "video-record", "task": "video_reconstruction", "split": "train",
            "frames": [frame_one, frame_two],
        }],
        "validation": [{
            "id": "image-record-one", "task": "image_reconstruction", "split": "validation",
            "image": frame_one,
        }],
        "test": [{
            "id": "image-record-two", "task": "image_reconstruction", "split": "test",
            "image": frame_two,
        }],
    }
    added = _append_manifests(tmp_path, rows)
    assert added == {"train": 0, "validation": 0, "test": 3}
    test_records = [
        json.loads(line) for line in (data_root / "test.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert {item["id"] for item in test_records} == {
        "video-record", "image-record-one", "image-record-two",
    }
    assert all(item["split"] == "test" for item in test_records)
    assert all(item.get("asset_content_group_ids") for item in test_records)
    assert validate_split_disjointness(tmp_path)["valid"]

def test_row_identity_disambiguates_reused_dataset_ids_using_full_payload() -> None:
    from onecore.acquire import _row_identity

    first = {"id": "utterance-7", "sentence": "كلمة أولى", "audio": {"bytes": b"first-payload"}}
    second = {"id": "utterance-7", "sentence": "كلمة ثانية", "audio": {"bytes": b"second-payload"}}
    assert _row_identity(first, "fleurs", 1) != _row_identity(second, "fleurs", 2)
    assert _row_identity(first, "fleurs", 1) == _row_identity(first, "fleurs", 99)


def test_manifest_merge_deduplicates_rows_and_keeps_source_group_in_stricter_split(tmp_path: Path) -> None:
    data_root = tmp_path / "data"
    data_root.mkdir()
    rows = {
        "train": [
            {"id": "same-record", "task": "text", "text": "same", "split": "train",
             "source_group_id": "video:42"},
            {"id": "train-caption", "task": "video_caption", "caption": "one", "split": "train",
             "source_group_id": "video:99"},
        ],
        "validation": [
            {"id": "same-record", "task": "text", "text": "same", "split": "validation",
             "source_group_id": "video:42"},
        ],
        "test": [
            {"id": "test-caption", "task": "video_caption", "caption": "two", "split": "test",
             "source_group_id": "video:99"},
        ],
    }
    added = _append_manifests(tmp_path, rows)
    assert added == {"train": 0, "validation": 1, "test": 2}
    validation = [json.loads(line) for line in (data_root / "validation.jsonl").read_text().splitlines()]
    test = [json.loads(line) for line in (data_root / "test.jsonl").read_text().splitlines()]
    assert [item["id"] for item in validation] == ["same-record"]
    assert {item["id"] for item in test} == {"train-caption", "test-caption"}
    assert all(item["split"] == "validation" for item in validation)
    assert all(item["split"] == "test" for item in test)


def test_records_share_stable_media_group_identity_across_captions(tmp_path: Path) -> None:
    source = {
        "id": "media-group-test",
        "repo": "fixture/media-groups",
        "adapter": "text",
        "text_fields": ["caption"],
        "split_group_field": "video_id",
        "license": "cc-by-4.0",
        "attribution": "fixture",
    }
    first = _record_from_row(
        {"id": "caption-1", "video_id": "video-77", "caption": "A long enough first caption for the record."},
        source, "row-1", "train", tmp_path,
    )
    second = _record_from_row(
        {"id": "caption-2", "video_id": "video-77", "caption": "A different second caption for the same video."},
        source, "row-2", "train", tmp_path,
    )
    assert first is not None and second is not None
    assert first["id"] != second["id"]
    assert first["source_group_id"] == second["source_group_id"]


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
        "license": "cc-by-4.0",
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
        "license": "cc-by-4.0",
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
        "license": "cc-by-4.0",
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
        "license": "cc-by-4.0",
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
        "license": "cc-by-4.0",
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


def test_tool_use_adapter_maps_external_function_call_records(tmp_path: Path) -> None:
    saxo = _record_from_row(
        {"system": "You can call get_exchange_rate.", "instruction": "Get USD to TRY conversion.",
         "output": '<functioncall> {"name":"get_exchange_rate","arguments":{"base_currency":"USD","target_currency":"TRY"}}'},
        {"id": "saxo-tool", "repo": "Saxo/alpaca_function_calling_dataset",
         "adapter": "tool_use", "system_fields": ["system"],
         "text_fields": ["instruction"], "response_fields": ["output"],
         "license": "apache-2.0", "attribution": "fixture", "_resolved_revision": "a" * 40},
        "saxo-row-1", "train", tmp_path,
    )
    assert saxo is not None and saxo["task"] == "tool_use"
    assert "get_exchange_rate" in saxo["prompt"]
    assert "functioncall" in saxo["response"]
    assert validate_manifest([saxo], tmp_path, expected_split="train")["valid"]

    mobile = _record_from_row(
        {"user_content": "Send a message to Ahmed", "tool_name": "send_message",
         "tool_arguments": '{"recipient":"Ahmed","message":"Hello"}'},
        {"id": "mobile-tool", "repo": "BTX24/turkish-mobile-function-calling-dataset",
         "adapter": "tool_use", "text_fields": ["user_content"],
         "tool_name_field": "tool_name", "tool_arguments_field": "tool_arguments",
         "license": "apache-2.0", "attribution": "fixture"},
        "mobile-row-1", "train", tmp_path,
    )
    assert mobile is not None and mobile["task"] == "tool_use"
    parsed = json.loads(mobile["response"])
    assert parsed["name"] == "send_message"
    assert parsed["arguments"]["recipient"] == "Ahmed"


def test_video_url_adapter_resolves_source_url_alias(tmp_path: Path, monkeypatch) -> None:
    import onecore.acquire as acquire_module

    def fake_write_frames(value, assets_root: Path, prefix: str, max_frames: int = 4):
        assert value == "https://media.example/clip.mp4"
        target = assets_root / f"acquired/{prefix}/frame_00.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (64, 64), (90, 40, 20)).save(target, format="PNG")
        return [str(target.relative_to(assets_root))]

    monkeypatch.setattr(acquire_module, "_write_frames", fake_write_frames)
    record = _record_from_row(
        {"video_url": "https://media.example/clip.mp4", "name": "A city street"},
        {"id": "webvid-alias", "repo": "video-fixture", "adapter": "video_url",
         "video_field": "contentUrl", "video_url_fields": ["contentUrl", "video_url", "url"],
         "text_fields": ["name"], "license": "cc-by-4.0", "attribution": "fixture"},
        "webvid-row-1", "train", tmp_path,
    )
    assert record is not None and record["task"] == "video_caption"
    assert record["caption"] == "A city street"


def test_bootstrap_is_excluded_from_real_training_sampler() -> None:
    import random
    from onecore.data import TRAINABLE_DATA_CLASSES, iter_training_records
    from onecore.train import _weighted_record

    assert "bootstrap" not in TRAINABLE_DATA_CLASSES
    assert "synthetic_unverified" not in TRAINABLE_DATA_CLASSES
    assert "synthetic_verified" not in TRAINABLE_DATA_CLASSES
    assert "external_staged" in TRAINABLE_DATA_CLASSES
    rows = [
        {"id": "bootstrap-1", "task": "text", "split": "train", "data_class": "bootstrap"},
        {**_external_metadata("sampler-text-source", "external-1"),
         "id": "external-1", "task": "text", "split": "train",
         "text": "A sufficiently long authentic imported external text sample."},
        {**_external_metadata("sampler-tool-source", "external-2"),
         "id": "external-2", "task": "tool_use", "split": "train",
         "prompt": "Please call the lookup tool with this query.",
         "response": '{"name":"lookup","arguments":{"query":"sample"}}'},
    ]
    selected = iter_training_records(rows, {"text", "tool_use"})
    assert [item["id"] for item in selected] == ["external-1", "external-2"]
    sampled = [_weighted_record({"text": [selected[0]], "tool_use": [selected[1]]}, "text", random.Random(i))
               for i in range(100)]
    assert all(item["data_class"] == "external_staged" for item in sampled)

def test_external_coverage_gate_counts_imported_records_not_bootstrap(tmp_path: Path) -> None:
    from onecore.acquire import assert_external_task_coverage

    data = tmp_path / "data"
    assets = data / "assets" / "acquired"
    assets.mkdir(parents=True)
    task_ids = {"text": "text", "tool": "tool_use", "image": "image_caption",
                "audio": "audio_text", "video": "video_caption"}
    for split in ("train", "validation", "test"):
        image_rel = f"acquired/{split}-image.png"
        audio_rel = f"acquired/{split}-audio.npy"
        frame_rels = [f"acquired/{split}-frame-1.png", f"acquired/{split}-frame-2.png"]
        Image.new("RGB", (16, 16), (30, 70, 120)).save(assets / Path(image_rel).name, format="PNG")
        np.save(assets / Path(audio_rel).name, np.zeros((8, 80), dtype=np.float32), allow_pickle=False)
        for index, relative in enumerate(frame_rels):
            Image.new("RGB", (16, 16), (40 + index * 30, 90, 140)).save(
                assets / Path(relative).name, format="PNG"
            )
        records = [
            {**_external_metadata(f"{split}-text-source", f"{split}-text"),
             "id": f"{split}-text", "task": "text", "split": split,
             "text": "This is a sufficiently long imported external text sample."},
            {**_external_metadata(f"{split}-tool-source", f"{split}-tool"),
             "id": f"{split}-tool", "task": "tool_use", "split": split,
             "prompt": "Call the search tool with a simple query.",
             "response": '{"name":"search","arguments":{"query":"example"}}'},
            {**_external_metadata(f"{split}-image-source", f"{split}-image"),
             "id": f"{split}-image", "task": "image_caption", "split": split,
             "image": image_rel, "caption": "A small fixture image."},
            {**_external_metadata(f"{split}-audio-source", f"{split}-audio"),
             "id": f"{split}-audio", "task": "audio_text", "split": split,
             "audio_features": audio_rel, "transcript": "Fixture speech transcript."},
            {**_external_metadata(f"{split}-video-source", f"{split}-video"),
             "id": f"{split}-video", "task": "video_caption", "split": split,
             "frames": frame_rels, "caption": "A fixture video with two frames."},
            {**_external_metadata(f"{split}-metadata-image-source", f"{split}-metadata-image"),
             "id": f"{split}-metadata-image", "task": "image_caption", "split": split,
             "caption": "Metadata-only image record with no image payload."},
            {**_external_metadata(f"{split}-metadata-audio-source", f"{split}-metadata-audio"),
             "id": f"{split}-metadata-audio", "task": "audio_text", "split": split,
             "transcript": "Metadata-only audio record with no audio payload."},
            {**_external_metadata(f"{split}-metadata-video-source", f"{split}-metadata-video"),
             "id": f"{split}-metadata-video", "task": "video_caption", "split": split,
             "caption": "Metadata-only video record with no frames."},
            {"id": f"{split}-bootstrap", "task": "text", "split": split,
             "data_class": "bootstrap"},
        ]
        (data / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(item) for item in records) + "\n", encoding="utf-8"
        )
    coverage = assert_external_task_coverage(
        tmp_path, set(task_ids), minimum_train=1, minimum_holdout=1
    )
    for split in ("train", "validation", "test"):
        assert coverage[split] == {group: 1 for group in task_ids}

@pytest.mark.parametrize(("license_id", "expected"), [
    ("odc-by", True), ("odc-by-1.0", True), ("CC-BY-4.0", True),
    ("CC-BY-SA-4.0", True), ("Apache-2.0", True), ("MIT", True),
    ("CC-BY-NC-4.0", False), ("CC-BY-ND-4.0", False),
    ("AGPL-3.0", False), ("dataset-card-terms", False),
    ("source-card-terms", False), ("per-document-license-metadata", False),
    ("unknown", False),
])
def test_commercial_training_license_allowlist(license_id: str, expected: bool) -> None:
    assert license_is_trainable(license_id) is expected


def test_external_manifest_requires_approved_license_and_immutable_provenance(tmp_path: Path) -> None:
    record = {
        "id": "external-license-test", "task": "text", "text": "licensed external text",
        "license": "cc-by-4.0", "source_url": "https://example.org/dataset",
        "attribution": "dataset authors", "split": "train", "review_status": "pending",
        "data_class": "external_staged", "source_id": "test-source",
        "source_revision": "a" * 40, "source_row_id_sha256": "b" * 64,
    }
    assert validate_manifest([record], tmp_path, expected_split="train")["valid"]
    blocked = {**record, "id": "external-nc", "license": "cc-by-nc-4.0"}
    report = validate_manifest([blocked], tmp_path, expected_split="train")
    assert not report["valid"]
    assert any("not approved for commercial training" in error for error in report["errors"])
    unpinned = {**record, "id": "external-unpinned", "source_revision": "main"}
    report = validate_manifest([unpinned], tmp_path, expected_split="train")
    assert not report["valid"]
    assert any("immutable source_revision" in error for error in report["errors"])


def test_training_iterator_excludes_external_rows_without_license_or_source_sha() -> None:
    from onecore.data import iter_training_records
    valid = {
        "id": "valid-external", "task": "text", "text": "real licensed text",
        "split": "train", "data_class": "external_staged", "license": "cc-by-4.0",
        "source_id": "source", "source_revision": "a" * 40,
        "source_row_id_sha256": "b" * 64,
    }
    invalid_license = {**valid, "id": "invalid-license", "license": "cc-by-nc-4.0"}
    missing_provenance = {**valid, "id": "missing-provenance", "source_revision": ""}
    selected = iter_training_records([valid, invalid_license, missing_provenance])
    assert [item["id"] for item in selected] == ["valid-external"]


def test_source_limits_apply_initial_and_expanded_profile_overrides() -> None:
    from onecore.acquire import _source_limits
    source = {
        "id": "profile-test",
        "limits": {"train": 10, "validation": 2, "test": 2},
        "profile_limits": {"expanded": {"train": 100, "validation": 20}},
    }
    assert _source_limits(source, "initial") == {"train": 10, "validation": 2, "test": 2}
    assert _source_limits(source, "expanded") == {"train": 100, "validation": 20, "test": 2}


def test_metadata_only_adapter_never_materializes_a_training_record(tmp_path: Path) -> None:
    source = {
        "id": "metadata-only-test",
        "repo": "fixture/catalog",
        "adapter": "metadata_only",
        "license": "cc-by-4.0",
        "attribution": "fixture catalog authors",
        "_resolved_revision": "a" * 40,
    }
    record = _record_from_row(
        {"id": "catalog-item-1", "caption": "Catalog description without media pixels"},
        source, "catalog-row-1", "train", tmp_path,
    )
    assert record is None

def test_external_asset_report_counts_only_real_licensed_media_files(tmp_path: Path) -> None:
    from onecore.acquire import _external_asset_report
    data = tmp_path / "data"
    assets = data / "assets" / "acquired"
    assets.mkdir(parents=True)
    image_path = "acquired/image.png"
    audio_path = "acquired/audio.npy"
    frame_one = "acquired/frame_01.png"
    frame_two = "acquired/frame_02.png"
    Image.new("RGB", (16, 16), (20, 80, 140)).save(assets / Path(image_path).name, format="PNG")
    np.save(assets / Path(audio_path).name, np.zeros((8, 80), dtype=np.float32), allow_pickle=False)
    Image.new("RGB", (16, 16), (70, 80, 140)).save(assets / Path(frame_one).name, format="PNG")
    Image.new("RGB", (16, 16), (100, 80, 140)).save(assets / Path(frame_two).name, format="PNG")
    records = [
        {**_external_metadata("image-source", "image-record"),
         "id": "image-record", "task": "image_reconstruction", "split": "train", "image": image_path},
        {**_external_metadata("audio-source", "audio-record"),
         "id": "audio-record", "task": "audio_reconstruction", "split": "train", "audio_features": audio_path},
        {**_external_metadata("video-source", "video-record"),
         "id": "video-record", "task": "video_reconstruction", "split": "train", "frames": [frame_one, frame_two]},
        {**_external_metadata("metadata-source", "metadata-only"),
         "id": "metadata-only", "task": "video_caption", "split": "train",
         "caption": "Metadata-only video caption with no frames."},
    ]
    (data / "train.jsonl").write_text(
        "\n".join(json.dumps(item) for item in records) + "\n", encoding="utf-8"
    )
    report = _external_asset_report(tmp_path, "train")
    assert report["records_by_task"] == {
        "image_reconstruction": 1, "audio_reconstruction": 1, "video_reconstruction": 1,
    }
    assert report["metadata_only_records"] == 1
    assert report["unusable_external_records"] == 1
    assert report["image_files"] == 1
    assert report["audio_feature_files"] == 1
    assert report["video_frame_files"] == 2
    assert report["unique_asset_files"] == 4
    assert report["missing_asset_files"] == 0

def test_external_coverage_gate_counts_only_licensed_pinned_records(tmp_path: Path) -> None:
    from onecore.acquire import assert_external_task_coverage
    groups = {"text": "text", "tool": "tool_use", "image": "image_reconstruction",
              "audio": "audio_reconstruction", "video": "video_reconstruction"}
    data = tmp_path / "data"
    assets = data / "assets" / "acquired"
    assets.mkdir(parents=True)
    for split in ("train", "validation", "test"):
        image_rel = f"acquired/{split}-image.png"
        audio_rel = f"acquired/{split}-audio.npy"
        frame_rels = [f"acquired/{split}-frame-1.png", f"acquired/{split}-frame-2.png"]
        Image.new("RGB", (16, 16), (30, 70, 120)).save(assets / Path(image_rel).name, format="PNG")
        np.save(assets / Path(audio_rel).name, np.zeros((8, 80), dtype=np.float32), allow_pickle=False)
        for index, relative in enumerate(frame_rels):
            Image.new("RGB", (16, 16), (40 + index * 30, 90, 140)).save(
                assets / Path(relative).name, format="PNG"
            )
        records = [
            {**_external_metadata(f"{split}-text-source", f"{split}-text"),
             "id": f"{split}-text", "task": "text", "split": split,
             "text": "This is a sufficiently long imported external text sample."},
            {**_external_metadata(f"{split}-tool-source", f"{split}-tool"),
             "id": f"{split}-tool", "task": "tool_use", "split": split,
             "prompt": "Call the search tool with a simple query.",
             "response": '{"name":"search","arguments":{"query":"example"}}'},
            {**_external_metadata(f"{split}-image-source", f"{split}-image"),
             "id": f"{split}-image", "task": "image_reconstruction", "split": split,
             "image": image_rel},
            {**_external_metadata(f"{split}-audio-source", f"{split}-audio"),
             "id": f"{split}-audio", "task": "audio_reconstruction", "split": split,
             "audio_features": audio_rel},
            {**_external_metadata(f"{split}-video-source", f"{split}-video"),
             "id": f"{split}-video", "task": "video_reconstruction", "split": split,
             "frames": frame_rels},
            {**_external_metadata(f"{split}-unlicensed-source", f"{split}-unlicensed-text"),
             "id": f"{split}-unlicensed-text", "task": "text", "split": split,
             "license": "cc-by-nc-4.0", "text": "This noncommercial text must be excluded."},
            {"id": f"{split}-bootstrap", "task": "text", "split": split,
             "data_class": "bootstrap"},
        ]
        (data / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(item) for item in records) + "\n", encoding="utf-8"
        )
    coverage = assert_external_task_coverage(tmp_path, set(groups), minimum_train=1, minimum_holdout=1)
    for split in ("train", "validation", "test"):
        assert coverage[split] == {group: 1 for group in groups}
