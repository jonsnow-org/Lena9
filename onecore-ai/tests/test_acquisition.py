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
    _row_identity,
    _stable_split,
    _training_manifest_base,
)
from onecore.data import validate_manifest


def _png_base64() -> str:
    stream = io.BytesIO()
    Image.new("RGB", (16, 12), (20, 80, 140)).save(stream, format="PNG")
    return base64.b64encode(stream.getvalue()).decode("ascii")


def _external_metadata(source_id: str, row_id: str) -> dict[str, str]:
    return {
        "source_url": "https://example.org/dataset",
        "data_class": "external",
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
    assert {"fineweb2_hq_ar", "fineweb2_hq_ar_saudi", "fineweb2_hq_ar_moroccan",
            "fineweb2_hq_ar_egyptian", "fineweb2_full_ar", "fineweb2_full_ar_saudi",
            "fineweb2_full_ar_moroccan", "fineweb2_full_ar_egyptian",
            "open_web_math_pro", "fleurs_ar", "open_images_v7", "sard_arabic_documents",
            "finevideo", "laion_bvd_video_55m", "coyo_700m", "conceptual_captions_12m",
            "sharegpt4v_images", "webvid_10m_video", "msrvtt_video",
            "saxo_function_calling", "turkish_mobile_function_calling", "videos4camera_bench"} <= ids
    enabled = {item["id"] for item in sources if item.get("enabled", True)}
    assert {"turkish_mobile_function_calling", "open_images_v7", "coyo_700m", "videos4camera_bench"} <= enabled
    assert {"oscar_ar", "proof_pile_2", "stack_v2_edu", "sard_arabic_documents",
            "finevideo", "internvid_10m_flt", "webvid_10m_video", "msrvtt_video"} <= enabled
    stack = next(item for item in sources if item["id"] == "stack_v2_code")
    assert stack["enabled"] is True
    assert stack["required_for_training"] is False
    assert stack["minimum_accepted_records"] == 10000


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
    assert record["data_class"] == "external"
    report = validate_manifest([record], tmp_path, expected_split="train")
    assert report["valid"], report["errors"]


def test_open_image_without_caption_trains_shared_visual_reconstruction(tmp_path: Path) -> None:
    source = {
        "id": "open-images-test",
        "repo": "bitmind/open-images-v7",
        "adapter": "image",
        "image_field": "image",
        "text_fields": [],
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
        }
    with pytest.raises(ValueError, match="image adapter could not decode or download"):
        _record_from_row({"image": "https://example.invalid/image.jpg"}, source, "row-1", "train", tmp_path)


def test_huggingface_video_feature_is_cast_without_auto_decoding() -> None:
    from datasets import Video
    from onecore.acquire import _disable_video_auto_decode

    class FakeDataset:
        features = {"video": Video()}

        def __init__(self) -> None:
            self.cast_call = None

        def cast_column(self, field: str, feature: object):
            self.cast_call = (field, feature)
            return self

    dataset = FakeDataset()
    assert _disable_video_auto_decode(dataset, "video") is dataset
    assert dataset.cast_call is not None
    field, feature = dataset.cast_call
    assert field == "video"
    assert isinstance(feature, Video)
    assert feature.decode is False


def test_audio_and_video_payloads_are_prepared_as_shared_modalities(tmp_path: Path) -> None:
    audio_source = {
        "id": "audio-test",
        "repo": "google/fleurs",
        "adapter": "audio",
        "audio_field": "audio",
        "text_fields": [],
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


def test_video_url_grouping_keeps_segments_in_one_split_and_source_group(tmp_path: Path, monkeypatch) -> None:
    import onecore.acquire as acquire_module

    source = {
        "id": "videos4camera_bench",
        "repo": "syCen/Videos4CameraBench",
        "adapter": "video",
        "video_field": "video",
        "split_group_filename_field": "video",
        "split_strategy": "hash",
        "validation_percent": 10,
        "test_percent": 10,
        }
    rows = [
        {"video": {"src": "https://huggingface.co/datasets/syCen/Videos4CameraBench/resolve/rev/source-video-17.0.1.mp4"}},
        {"video": {"src": "https://huggingface.co/datasets/syCen/Videos4CameraBench/resolve/rev/source-video-17.0.4.mp4"}},
    ]
    first_split = _grouped_split(source, rows[0], "train", "row-1", "video-seed")
    second_split = _grouped_split(source, rows[1], "train", "row-2", "video-seed")
    assert first_split == second_split

    def fake_write_frames(_value, assets_root: Path, prefix: str, max_frames: int = 4) -> list[str]:
        paths = []
        for index in range(2):
            relative = f"acquired/{prefix}/frame_{index:02d}.png"
            target = assets_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            Image.new("RGB", (16, 16), (index * 50 + 20, 40, 70)).save(target, format="PNG")
            paths.append(relative)
        return paths

    monkeypatch.setattr(acquire_module, "_write_frames", fake_write_frames)
    first = _record_from_row(rows[0], source, "row-1", first_split, tmp_path)
    second = _record_from_row(rows[1], source, "row-2", second_split, tmp_path)
    assert first is not None and second is not None
    assert first["task"] == second["task"] == "video_reconstruction"
    assert first["source_group_id"] == second["source_group_id"]
    assert len(first["frames"]) == len(second["frames"]) == 2


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
        "source_url": "https://example.test/source",
        "split": "train",
        "data_class": "external",
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
        "source_url": "https://example.test/new",
        "split": "train",
        "data_class": "external",
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
         "_resolved_revision": "a" * 40},
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
         "source label": "fixture"},
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
         "text_fields": ["name"], "source label": "fixture"},
        "webvid-row-1", "train", tmp_path,
    )
    assert record is not None and record["task"] == "video_caption"
    assert record["caption"] == "A city street"


def test_acquisition_resume_promotes_pending_rows_and_skips_processed_source_rows(tmp_path: Path, monkeypatch) -> None:
    import sys
    import types
    import yaml
    from onecore.acquire import acquire_sources

    rows = [
        {"id": "row-1", "assigned": "train", "text": "This is a real external sample number one."},
        {"id": "row-2", "assigned": "train", "text": "This is a real external sample number two."},
        {"id": "row-3", "assigned": "validation", "text": "This is a real external validation sample."},
        {"id": "row-4", "assigned": "test", "text": "This is a real external test sample."},
        {"id": "row-5", "assigned": "train", "text": "This is a real external sample number five."},
        {"id": "row-6", "assigned": "train", "text": "This is a real external sample number six."},
    ]
    skip_calls: list[int] = []
    load_calls: list[dict[str, object]] = []

    class FakeDataset:
        def __init__(self, values):
            self.values = list(values)
            self.features = {}
        def __iter__(self):
            return iter(self.values)
        def skip(self, offset: int):
            skip_calls.append(offset)
            return FakeDataset(self.values[offset:])

    def fake_load_dataset(**kwargs):
        load_calls.append(dict(kwargs))
        return FakeDataset(rows)

    datasets_module = types.ModuleType("datasets")
    datasets_module.Audio = lambda decode=False: object()
    datasets_module.load_dataset = fake_load_dataset
    hub_module = types.ModuleType("huggingface_hub")
    class FakeHfApi:
        def __init__(self, token=None):
            self.token = token
        def dataset_info(self, repo_id, token=None):
            return types.SimpleNamespace(sha="a" * 40)
    hub_module.HfApi = FakeHfApi
    monkeypatch.setitem(sys.modules, "datasets", datasets_module)
    monkeypatch.setitem(sys.modules, "huggingface_hub", hub_module)
    monkeypatch.setattr(
        "onecore.acquire._grouped_split",
        lambda source, row, hf_split, row_id, seed: str(row["assigned"]),
    )

    source_file = tmp_path / "sources.yaml"
    registry = {
        "version": "resume-test-v1",
        "defaults": {"split_seed": "onecore-shard-v1", "max_scan_multiplier": 12},
        "sources": [{
            "id": "resume-text", "repo": "fixture/resume-text", "adapter": "text",
            "enabled": True, "revision": "a" * 40, "hf_splits": ["train"], "text_fields": ["text"],
            "limits": {"train": 1, "validation": 1, "test": 1},
            "profile_limits": {"expanded": {"train": 3, "validation": 1, "test": 1}},
        }],
    }
    source_file.write_text(yaml.safe_dump(registry), encoding="utf-8")

    initial = acquire_sources(tmp_path / "onecore", profile="initial", source_file=source_file)
    initial_source = initial["sources"][0]
    assert initial_source["by_split"]["train"]["total_scanned"] == 4
    assert initial_source["pending_rows_by_output_split"] == {"train": 1, "validation": 0, "test": 0}
    assert initial_source["accepted_by_output_split"] == {"train": 1, "validation": 1, "test": 1}

    expanded = acquire_sources(tmp_path / "onecore", profile="expanded", source_file=source_file)
    expanded_source = expanded["sources"][0]
    assert skip_calls == [4]
    assert len(load_calls) == 2
    assert expanded_source["by_split"]["train"]["start_offset"] == 4
    assert expanded_source["by_split"]["train"]["scanned"] == 1
    assert expanded_source["by_split"]["train"]["total_scanned"] == 5
    assert expanded_source["pending_rows_promoted"] == 1
    assert expanded_source["pending_rows_by_output_split"] == {"train": 0, "validation": 0, "test": 0}
    assert expanded_source["accepted_by_output_split"] == {"train": 3, "validation": 1, "test": 1}
    assert expanded_source["new_accepted_by_output_split"] == {"train": 2, "validation": 0, "test": 0}
    assert expanded["task_counts"] == {
        "train": {"text": 3, "tool": 0, "image": 0, "audio": 0, "video": 0},
        "validation": {"text": 1, "tool": 0, "image": 0, "audio": 0, "video": 0},
        "test": {"text": 1, "tool": 0, "image": 0, "audio": 0, "video": 0},
    }

def test_weighted_training_sampler_uses_only_external_rows() -> None:
    import random
    from onecore.data import TRAINABLE_DATA_CLASSES, iter_training_records
    from onecore.train import _weighted_record

    assert {"bootstrap", "synthetic", "external", "owner_curated", "other"} <= TRAINABLE_DATA_CLASSES
    rows = [
        {"id": "bootstrap-1", "task": "text", "split": "train", "data_class": "bootstrap", "text": "bootstrap"},
        {"id": "synthetic-1", "task": "text", "split": "train", "data_class": "synthetic", "text": "synthetic"},
        {**_external_metadata("sampler-text-source", "external-1"),
         "id": "external-1", "task": "text", "split": "train", "text": "Imported text sample."},
        {**_external_metadata("sampler-tool-source", "external-2"),
         "id": "external-2", "task": "tool_use", "split": "train",
         "prompt": "Please call the lookup tool with this query.",
         "response": '{"name":"lookup","arguments":{"query":"sample"}}'},
    ]
    selected = iter_training_records(rows, {"text", "tool_use"})
    assert {item["id"] for item in selected} == {"bootstrap-1", "synthetic-1", "external-1", "external-2"}
    production_rows = iter_training_records(
        rows, {"text", "tool_use"}, allowed_data_classes={"external"}
    )
    assert {item["id"] for item in production_rows} == {"external-1", "external-2"}
    text_rows = [item for item in selected if item["task"] == "text"]
    tool_rows = [item for item in selected if item["task"] == "tool_use"]
    sampled = [
        _weighted_record({"text": text_rows, "tool_use": tool_rows}, "text", random.Random(i))
        for i in range(100)
    ]
    assert {item["data_class"] for item in sampled} == {"external"}
    assert all(item["id"] in {"external-1", "external-2"} for item in sampled)
    assert {item["id"] for item in production_rows} == {"external-1", "external-2"}


def test_task_coverage_gate_counts_all_usable_records(tmp_path: Path) -> None:
    from onecore.acquire import assert_task_coverage

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
    coverage = assert_task_coverage(
        tmp_path, set(task_ids), minimum_train=1, minimum_holdout=1
    )
    for split in ("train", "validation", "test"):
        assert coverage[split] == {group: 1 for group in task_ids}

def test_imported_record_needs_no_policy_metadata(tmp_path: Path) -> None:
    record = {
        "id": "imported-record", "task": "text", "text": "An imported sample.",
        "source_url": "https://example.org/data", "split": "train", "data_class": "external",
    }
    assert validate_manifest([record], tmp_path, expected_split="train")["valid"]


def test_training_iterator_accepts_all_available_data_classes() -> None:
    from onecore.data import iter_training_records
    records = [
        {"id": "external", "task": "text", "split": "train", "source_url": "https://example.org/a", "text": "external"},
        {"id": "synthetic", "task": "text", "split": "train", "source_url": "local://onecore-verified-curriculum", "text": "synthetic"},
        {"id": "owner", "task": "text", "split": "train", "source_url": "local://owner-created-notes", "text": "owner"},
        {"id": "bootstrap", "task": "text", "split": "train", "source_url": "local://onecore-bootstrap", "text": "bootstrap"},
    ]
    assert {item["id"] for item in iter_training_records(records)} == {"external", "synthetic", "owner", "bootstrap"}


def test_source_limits_apply_initial_and_expanded_profile_overrides() -> None:
    from onecore.acquire import _source_limits
    source = {
        "id": "profile-test",
        "limits": {"train": 10, "validation": 2, "test": 2},
        "profile_limits": {"expanded": {"train": 100, "validation": 20}},
    }
    assert _source_limits(source, "initial") == {"train": 10, "validation": 2, "test": 2}
    assert _source_limits(source, "expanded") == {"train": 100, "validation": 20, "test": 2}


def test_persist_acquisition_progress_uses_cumulative_offsets(tmp_path: Path) -> None:
    from onecore.acquire import persist_acquisition_progress

    data = tmp_path / "onecore" / "data"
    data.mkdir(parents=True)
    (data / "acquisition-report.json").write_text(json.dumps({
        "sources": [{
            "source": "resume-text", "revision": "a" * 40,
            "by_split": {"train": {"start_offset": 4, "scanned": 1, "total_scanned": 5}},
        }],
    }), encoding="utf-8")
    state = persist_acquisition_progress(tmp_path / "onecore")
    progress = json.loads((data / "resume-cache" / "source-progress.json").read_text(encoding="utf-8"))
    assert state["sources"] == 1
    assert progress["resume-text"] == {"revision": "a" * 40, "by_split": {"train": 5}}

def test_metadata_only_adapter_never_materializes_a_training_record(tmp_path: Path) -> None:
    source = {
        "id": "metadata-only-test",
        "repo": "fixture/catalog",
        "adapter": "metadata_only",
        "_resolved_revision": "a" * 40,
    }
    record = _record_from_row(
        {"id": "catalog-item-1", "caption": "Catalog description without media pixels"},
        source, "catalog-row-1", "train", tmp_path,
    )
    assert record is None

def test_asset_report_counts_all_usable_media_files(tmp_path: Path) -> None:
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

def test_task_coverage_gate_counts_all_usable_records(tmp_path: Path) -> None:
    from onecore.acquire import assert_task_coverage
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
            {**_external_metadata(f"{split}-additional-source-source", f"{split}-additional-source-text"),
             "id": f"{split}-additional-source-text", "task": "text", "split": split,
             "text": "This additional imported text should be included."},
            {"id": f"{split}-bootstrap", "task": "text", "split": split,
             "data_class": "bootstrap"},
        ]
        (data / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(item) for item in records) + "\n", encoding="utf-8"
        )
    coverage = assert_task_coverage(tmp_path, set(groups), minimum_train=1, minimum_holdout=1)
    for split in ("train", "validation", "test"):
        assert coverage[split] == {group: (2 if group == "text" else 1) for group in groups}



def test_optional_gated_source_access_does_not_block_bootstrap() -> None:
    from onecore.acquire import _source_access_status

    assert _source_access_status({"required_for_training": False}) == "optional_access_required"
    assert _source_access_status({"required_for_training": True}) == "access_required"


def test_source_row_identity_is_independent_of_legacy_row_offset() -> None:
    row = {"id": "stable-17", "text": "A stable row whose identity is content-derived."}
    assert _row_identity(row, "fineweb_ar", 1) == _row_identity(row, "fineweb_ar", 50_000)


def test_video_adapter_resolves_relative_hub_video_path_at_pinned_revision(tmp_path: Path, monkeypatch) -> None:
    import sys
    import types
    import onecore.acquire as acquire_module

    downloaded = tmp_path / "hub-video.mp4"
    downloaded.write_bytes(b"test-video")
    calls = {}

    def fake_hub_download(**kwargs):
        calls.update(kwargs)
        return str(downloaded)

    monkeypatch.setitem(
        sys.modules, "huggingface_hub",
        types.SimpleNamespace(hf_hub_download=fake_hub_download),
    )

    def fake_write_frames(value, assets_root: Path, prefix: str, max_frames: int = 4):
        assert value == {"path": str(downloaded), "bytes": None}
        relative = f"acquired/{prefix}/frame_00.png"
        target = assets_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (16, 16), (30, 60, 90)).save(target, format="PNG")
        return [relative]

    monkeypatch.setattr(acquire_module, "_write_frames", fake_write_frames)
    revision = "a" * 40
    source = {
        "id": "videos4camera_bench",
        "repo": "syCen/Videos4CameraBench",
        "adapter": "video",
        "video_field": "video",
        "text_fields": ["caption"],
        "_resolved_revision": revision,
    }
    record = _record_from_row(
        {
            "video": {
                "path": "hf://datasets/syCen/Videos4CameraBench@"
                        + revision + "/-2uIa-XMJC0.5.3.mp4",
                "bytes": None,
            },
            "caption": "A short video segment for the pinned source.",
        },
        source,
        "video-relative-path-row",
        "train",
        tmp_path,
    )

    assert record is not None
    assert record["task"] == "video_caption"
    assert len(record["frames"]) == 1
    assert calls == {
        "repo_id": "syCen/Videos4CameraBench",
        "filename": "-2uIa-XMJC0.5.3.mp4",
        "repo_type": "dataset",
        "revision": revision,
        "token": None,
    }


def test_video_adapter_rejects_unsafe_relative_hub_paths() -> None:
    from onecore.acquire import _resolve_video_asset

    source = {
        "repo": "syCen/Videos4CameraBench",
        "_resolved_revision": "a" * 40,
    }
    with pytest.raises(ValueError, match="unsafe"):
        _resolve_video_asset({"path": "../outside.mp4", "bytes": None}, source)


def test_video_adapter_rejects_hugging_face_uri_from_other_repo_or_revision() -> None:
    from onecore.acquire import _resolve_video_asset

    source = {
        "repo": "syCen/Videos4CameraBench",
        "_resolved_revision": "a" * 40,
    }
    with pytest.raises(ValueError, match="repository or revision"):
        _resolve_video_asset(
            {
                "path": "hf://datasets/another/dataset@" + ("a" * 40) + "/clip.mp4",
                "bytes": None,
            },
            source,
        )
    with pytest.raises(ValueError, match="repository or revision"):
        _resolve_video_asset(
            {
                "path": "hf://datasets/syCen/Videos4CameraBench@" + ("b" * 40) + "/clip.mp4",
                "bytes": None,
            },
            source,
        )


def test_default_external_task_gate_is_corrected_v2():
    import inspect
    from onecore.acquire import assert_task_coverage

    parameters = inspect.signature(assert_task_coverage).parameters
    assert parameters["minimum_train"].default == 100
    assert parameters["minimum_holdout"].default == 10
