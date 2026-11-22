import hashlib
import json

import numpy as np
import soundfile as sf
import yaml
from PIL import Image

from onecore.acquire import _row_identity
from onecore.v3.converter import convert_v2_corpus, restore_v2_media_records, write_v3_manifests


REVISION = "a" * 40


def _record(source_id, row, task, record_id, **fields):
    row_id = _row_identity(row, source_id, 0)
    return {
        "id": record_id,
        "source_id": source_id,
        "source_revision": REVISION,
        "source_row_id_sha256": hashlib.sha256(row_id.encode()).hexdigest(),
        "source_url": "https://huggingface.co/datasets/example/source",
        "split": "train",
        "data_class": "external",
        "task": task,
        **fields,
    }


def _write_registry(path, sources):
    path.write_text(yaml.safe_dump({"sources": sources}), encoding="utf-8")


def test_v3_converter_reuses_text_and_rehydrates_native_image_from_pinned_revision(tmp_path):
    image = Image.new("RGB", (47, 63), (20, 30, 40))
    row = {"id": "image-001", "image": image, "caption": "A native-resolution test image."}
    text_record = {
        "id": "text-001", "source_id": "text-source", "source_revision": REVISION,
        "source_row_id_sha256": hashlib.sha256(b"text-row").hexdigest(),
        "source_url": "https://example.org/text", "split": "train",
        "data_class": "external", "task": "text", "text": "A sufficiently long existing text row.",
    }
    image_record = _record("image-source", row, "image_caption", "image-001",
                           caption="A native-resolution test image.", image="legacy-64px.png")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "image-source", "repo": "org/image-data", "config": "default",
        "hf_splits": ["train"], "adapter": "image", "image_field": "image",
        "text_fields": ["caption"], "enabled": True,
    }])
    calls = []

    def loader(repo, config, split, revision):
        calls.append((repo, config, split, revision))
        return [row]

    converted, report = restore_v2_media_records(
        [text_record, image_record], registry, tmp_path / "assets",
        source_loader=loader,
    )
    by_id = {item["id"]: item for item in converted}
    assert by_id["text-001"]["text"] == text_record["text"]
    assert "image" not in by_id["image-001"]
    image_asset = by_id["image-001"]["assets"]["image"]["source_asset"]
    assert (tmp_path / "assets" / image_asset).is_file()
    assert by_id["image-001"]["assets"]["image"]["width"] == 47
    assert by_id["image-001"]["assets"]["image"]["height"] == 63
    assert calls == [("org/image-data", "default", "train", REVISION)]
    assert report["converted_records"] == 2
    assert report["synthetic_records_added"] == 0


def test_v3_converter_resamples_audio_and_keeps_source_and_training_assets(tmp_path):
    time = np.arange(4410, dtype=np.float32) / 44100
    waveform = np.stack((np.sin(2 * np.pi * 220 * time),
                         np.sin(2 * np.pi * 330 * time)), axis=1).astype(np.float32)
    row = {"id": "audio-001", "audio": {"array": waveform, "sampling_rate": 44100}}
    record = _record("audio-source", row, "audio_text", "audio-001",
                     transcript="A spoken audio transcript.", audio_features="legacy-mel.npy")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "audio-source", "repo": "org/audio-data", "config": "default",
        "hf_splits": ["train"], "adapter": "audio", "audio_field": "audio",
        "text_fields": ["transcription"], "enabled": True,
    }])

    converted, report = restore_v2_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: [row],
    )
    audio_assets = converted[0]["assets"]["audio"]
    raw = tmp_path / "assets" / audio_assets["source_asset"]
    normalized = tmp_path / "assets" / audio_assets["training_asset"]
    assert raw.is_file() and normalized.is_file()
    assert audio_assets["sample_rate"] == 44100
    assert audio_assets["training_sample_rate"] == 24000
    normalized_wave, rate = sf.read(normalized, always_2d=True)
    assert rate == 24000 and normalized_wave.shape == (2400, 2)
    assert "audio_features" not in converted[0]
    assert report["converted_records"] == 1


def test_v3_converter_restores_every_video_frame_and_preserves_timestamps(tmp_path):
    frames = [np.full((12, 16, 3), index, dtype=np.uint8) for index in range(7)]
    row = {"id": "video-001", "video": {"frames": frames, "timestamps": [i / 2 for i in range(7)], "fps": 2}}
    record = _record("video-source", row, "video_caption", "video-001",
                     caption="A seven-frame clip.", frames=["legacy-0.png", "legacy-1.png"])
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "video-source", "repo": "org/video-data", "config": "default",
        "hf_splits": ["train"], "adapter": "video", "video_field": "video",
        "enabled": True,
    }])

    converted, report = restore_v2_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: [row],
    )
    video_assets = converted[0]["assets"]["video"]
    assert video_assets["frame_count"] == 7
    assert len(video_assets["frames"]) == 7
    assert video_assets["timestamps"] == [i / 2 for i in range(7)]
    assert video_assets["frame_limit_applied"] is False
    assert "frames" not in converted[0]
    assert all((tmp_path / "assets" / path).is_file() for path in video_assets["frames"])
    assert report["converted_records"] == 1


def test_v3_converter_never_fetches_disabled_sources_or_adds_synthetic_rows(tmp_path):
    row = {"id": "image-disabled", "image": Image.new("RGB", (8, 8))}
    record = _record("disabled-source", row, "image_reconstruction", "disabled-row")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "disabled-source", "repo": "org/disabled", "config": "default",
        "hf_splits": ["train"], "adapter": "image", "image_field": "image",
        "enabled": False,
    }])
    calls = []
    converted, report = restore_v2_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *args: calls.append(args) or [row],
    )
    assert converted == []
    assert calls == []
    assert report["skipped"]["source_disabled"] == 1
    assert report["synthetic_records_added"] == 0


def test_v3_manifest_writer_atomically_writes_three_split_files(tmp_path):
    records = [
        {"id": "train-1", "split": "train", "task": "text"},
        {"id": "val-1", "split": "validation", "task": "text"},
        {"id": "test-1", "split": "test", "task": "text"},
    ]
    paths = write_v3_manifests(records, tmp_path)
    assert set(paths) == {"train", "validation", "test"}
    assert '"id": "train-1"' in (tmp_path / "data/train.jsonl").read_text()
    assert '"id": "val-1"' in (tmp_path / "data/validation.jsonl").read_text()
    assert '"id": "test-1"' in (tmp_path / "data/test.jsonl").read_text()



def test_v3_corpus_conversion_writes_all_splits_and_reports_manifest_gate(tmp_path):
    v2 = tmp_path / "v2-data"
    v2.mkdir()
    for split in ("train", "validation", "test"):
        record = {
            "id": f"{split}-text", "source_id": "text-source", "source_revision": REVISION,
            "source_row_id_sha256": hashlib.sha256(f"{split}-row".encode()).hexdigest(),
            "source_url": "https://example.org/text", "split": split,
            "data_class": "external", "task": "text",
            "text": "A sufficiently long existing text sample.",
        }
        (v2 / f"{split}.jsonl").write_text(json.dumps(record) + "\n", encoding="utf-8")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [])
    report = convert_v2_corpus(
        v2, registry, tmp_path / "v3", minimum_train=0, minimum_holdout=0,
    )
    assert report["converted_records"] == 3
    assert report["manifest_gate"]["passed"] is True
    assert report["blocked"] is False
    for split in ("train", "validation", "test"):
        assert (tmp_path / "v3" / "data" / f"{split}.jsonl").is_file()
