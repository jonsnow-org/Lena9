import hashlib
import json

import numpy as np
import pytest
import soundfile as sf
import yaml
from PIL import Image
from datasets import Image as HFImage

from onecore.v3.source_utils import source_row_identity
from onecore.v3 import converter as converter_module
from onecore.v3.converter import (
    _default_source_loader, acquire_missing_media_rows, convert_existing_corpus,
    restore_source_media_records, write_v3_manifests,
)


REVISION = "a" * 40


def _record(source_id, row, task, record_id, **fields):
    row_id = source_row_identity(row, source_id, 0)
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

    converted, report = restore_source_media_records(
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

    converted, report = restore_source_media_records(
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

    converted, report = restore_source_media_records(
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
    converted, report = restore_source_media_records(
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
    source_corpus = tmp_path / "source-corpus-data"
    source_corpus.mkdir()
    for split in ("train", "validation", "test"):
        record = {
            "id": f"{split}-text", "source_id": "text-source", "source_revision": REVISION,
            "source_row_id_sha256": hashlib.sha256(f"{split}-row".encode()).hexdigest(),
            "source_url": "https://example.org/text", "split": split,
            "data_class": "external", "task": "text",
            "text": "A sufficiently long existing text sample.",
        }
        (source_corpus / f"{split}.jsonl").write_text(json.dumps(record) + "\n", encoding="utf-8")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [])
    report = convert_existing_corpus(
        source_corpus, registry, tmp_path / "v3", minimum_train=0, minimum_holdout=0,
    )
    assert report["converted_records"] == 3
    assert report["manifest_gate"]["passed"] is True
    assert report["blocked"] is False
    for split in ("train", "validation", "test"):
        assert (tmp_path / "v3" / "data" / f"{split}.jsonl").is_file()



def test_v3_converter_acquires_only_missing_image_holdouts_from_pinned_native_splits(tmp_path):
    validation_row = {"id": "image-validation-01", "image": Image.new("RGB", (40, 30), (1, 2, 3))}
    test_row = {"id": "image-test-01", "image": Image.new("RGB", (50, 35), (4, 5, 6))}
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "openimages", "repo": "finedet/openimages", "config": "default",
        "hf_splits": ["train", "validation", "test"], "adapter": "image",
        "image_field": "image", "split_strategy": "preserve", "enabled": True,
    }])
    calls = []

    def loader(repo, config, split, revision):
        calls.append((repo, config, split, revision))
        return [validation_row] if split == "validation" else [test_row] if split == "test" else []

    records, report = acquire_missing_media_rows(
        [], registry, {"openimages": REVISION},
        minimum_train=0, minimum_holdout=1, source_loader=loader,
    )
    assert [row["split"] for row in records] == ["validation", "test"]
    assert all(row["source_hf_split"] == row["split"] for row in records)
    assert report["added_by_family_split"]["image"]["validation"] == 1
    assert report["added_by_family_split"]["image"]["test"] == 1
    assert report["synthetic_records_added"] == 0
    assert calls == [
        ("finedet/openimages", "default", "validation", REVISION),
        ("finedet/openimages", "default", "test", REVISION),
    ]

    restored, restore_report = restore_source_media_records(
        records, registry, tmp_path / "assets", source_loader=loader,
    )
    assert len(restored) == 2
    assert all(row["assets"]["image"]["source_asset"] for row in restored)
    assert restore_report["converted_records"] == 2



def test_v3_converter_searches_all_nonstandard_source_splits_for_legacy_rows(tmp_path):
    row = {"id": "wavcaps-like-image", "image": Image.new("RGB", (18, 19), (7, 8, 9))}
    record = _record("multi-split-source", row, "image_reconstruction", "multi-split-row")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "multi-split-source", "repo": "org/multi-split", "config": "default",
        "hf_splits": ["catalog-a", "catalog-b"], "adapter": "image",
        "image_field": "image", "split_strategy": "hash", "enabled": True,
    }])
    calls = []

    def loader(repo, config, split, revision):
        calls.append(split)
        return [] if split == "catalog-a" else [row]

    restored, report = restore_source_media_records(
        [record], registry, tmp_path / "assets", source_loader=loader,
    )
    assert len(restored) == 1
    assert calls == ["catalog-a", "catalog-b"]
    assert restored[0]["source_hf_split"] == "catalog-b"
    assert restored[0]["source_hf_row_index"] == 0
    assert report["converted_records"] == 1



def test_v3_image_identity_stream_reenables_only_hf_image_decoding():
    class FakeStreamingDataset:
        def __init__(self):
            self.features = {
                "image": HFImage(decode=False),
                "audio": object(),
            }
            self.cast_calls = []

        def cast_column(self, name, feature):
            self.cast_calls.append((name, feature))
            self.features[name] = feature
            return self

    stream = FakeStreamingDataset()
    source = {"adapter": "image", "image_field": "image"}

    result = converter_module._enable_source_image_identity_decoding(stream, source)

    assert result is stream
    assert [name for name, _ in stream.cast_calls] == ["image"]
    assert isinstance(stream.features["image"], HFImage)
    assert stream.features["image"].decode is True
    assert stream.features["audio"] is not None


def test_v3_image_identity_decode_does_not_change_audio_or_video_streams():
    stream = object()
    assert converter_module._enable_source_image_identity_decoding(
        stream, {"adapter": "audio", "audio_field": "audio"}
    ) is stream
    assert converter_module._enable_source_image_identity_decoding(
        stream, {"adapter": "video", "video_field": "video"}
    ) is stream


def test_v3_default_source_loader_disables_automatic_media_decoding(monkeypatch):
    calls = {"load": None, "decode": []}

    class FakeStreamingDataset:
        def decode(self, enabled=True):
            calls["decode"].append(enabled)
            return self

    stream = FakeStreamingDataset()

    def fake_load_dataset(**kwargs):
        calls["load"] = kwargs
        return stream

    monkeypatch.setattr(converter_module, "load_dataset", fake_load_dataset)
    result = _default_source_loader("org/pinned-media", "main", "train", REVISION)

    assert result is stream
    assert calls["decode"] == [False]
    assert calls["load"] == {
        "path": "org/pinned-media",
        "name": "main",
        "split": "train",
        "streaming": True,
        "revision": REVISION,
    }


def test_v3_default_source_loader_fails_closed_without_stream_decode_control(monkeypatch):
    class UnsupportedStream:
        pass

    monkeypatch.setattr(converter_module, "load_dataset", lambda **_: UnsupportedStream())
    try:
        _default_source_loader("org/pinned-media", None, "train", REVISION)
    except RuntimeError as exc:
        assert "decode(False)" in str(exc)
    else:
        raise AssertionError("source loader must not silently invoke automatic TorchCodec decoding")


def test_v3_converter_restores_missing_local_media_path_from_pinned_dataset_viewer(tmp_path, monkeypatch):
    row = {
        "id": "audio-viewer-001",
        "audio": {"path": "/runner/work/missing-audio.wav", "bytes": b""},
        "transcription": "A pinned audio example.",
    }
    record = _record(
        "audio-source", row, "audio_text", "audio-viewer-001",
        transcript="A pinned audio example.", audio_features="legacy.npy",
    )
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "audio-source", "repo": "org/audio-data", "config": "default",
        "hf_splits": ["train"], "adapter": "audio", "audio_field": "audio",
        "text_fields": ["transcription"], "enabled": True,
    }])
    media_url = (
        "https://datasets-server.huggingface.co/cached-assets/org/audio-data/"
        f"--/{REVISION}/--/default/train/0/audio/audio.wav?Expires=9999999999&Signature=test"
    )
    viewer_row = {
        "id": "audio-viewer-001",
        "audio": [{"src": media_url, "type": "audio/wav"}],
        "transcription": "A pinned audio example.",
    }
    viewer_calls = []
    payload_calls = []

    def viewer_loader(repo, config, split, offset, length):
        viewer_calls.append((repo, config, split, offset, length))
        return {"rows": [{"row_idx": 0, "row": viewer_row}], "partial": False}

    def fake_preserve_audio_payload(value, assets_root, record_id):
        payload_calls.append(value)
        return {
            "source_asset": "raw/audio/source.wav", "sample_rate": 16000,
            "channels": 1, "samples": 160, "duration_seconds": 0.01,
        }

    def fake_resample_audio_source(source, assets_root, record_id, target_sample_rate):
        return {
            "training_asset": "processed/audio/source-24000hz.wav",
            "training_sample_rate": target_sample_rate, "training_channels": 1,
            "training_samples": 240, "resampled": True,
            "resampler": "scipy.signal.resample_poly", "resample_ratio": {"up": 3, "down": 2},
        }

    monkeypatch.setattr(converter_module, "preserve_audio_payload", fake_preserve_audio_payload)
    monkeypatch.setattr(converter_module, "resample_audio_source", fake_resample_audio_source)
    restored, report = restore_source_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: [row], viewer_row_loader=viewer_loader,
    )

    assert len(restored) == 1
    assert payload_calls == [{"src": media_url}]
    assert viewer_calls == [("org/audio-data", "default", "train", 0, 100)]
    assert restored[0]["source_hf_row_index"] == 0
    assert restored[0]["source_media_locator"] == {
        "provider": "huggingface-datasets-server", "config": "default",
        "split": "train", "row_index": 0, "revision": REVISION,
    }
    assert report["dataset_viewer_media_restored_records"] == 1


def test_v3_converter_rejects_dataset_viewer_media_from_a_different_revision(tmp_path, monkeypatch):
    row = {
        "id": "audio-viewer-wrong-revision",
        "audio": {"path": "/runner/work/missing-audio.wav", "bytes": None},
        "transcription": "Pinned row.",
    }
    record = _record(
        "audio-source", row, "audio_text", "audio-viewer-wrong-revision",
        transcript="Pinned row.", audio_features="legacy.npy",
    )
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "audio-source", "repo": "org/audio-data", "config": "default",
        "hf_splits": ["train"], "adapter": "audio", "audio_field": "audio",
        "text_fields": ["transcription"], "enabled": True,
    }])
    other_revision = "b" * 40
    viewer_row = {
        "id": "audio-viewer-wrong-revision",
        "audio": [{
            "src": (
                "https://datasets-server.huggingface.co/cached-assets/org/audio-data/"
                f"--/{other_revision}/--/default/train/0/audio/audio.wav?Signature=test"
            )
        }],
        "transcription": "Pinned row.",
    }
    monkeypatch.setattr(
        converter_module, "preserve_audio_payload",
        lambda *_: (_ for _ in ()).throw(AssertionError("unpinned media must not be opened")),
    )
    restored, report = restore_source_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: [row],
        viewer_row_loader=lambda *_: {"rows": [{"row_idx": 0, "row": viewer_row}]},
    )
    assert restored == []
    assert report["blocked"] is True
    assert any("does not match the pinned source revision" in error for error in report["errors"])

def test_v3_converter_prefers_encoded_bytes_over_a_missing_local_path(tmp_path, monkeypatch):
    row = {
        "id": "audio-inline-bytes-001",
        "audio": {"path": "/runner/work/missing-audio.wav", "bytes": b"encoded-audio"},
        "transcription": "A pinned audio example.",
    }
    record = _record(
        "audio-source", row, "audio_text", "audio-inline-bytes-001",
        transcript="A pinned audio example.", audio_features="legacy.npy",
    )
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "audio-source", "repo": "org/audio-data", "config": "default",
        "hf_splits": ["train"], "adapter": "audio", "audio_field": "audio",
        "text_fields": ["transcription"], "enabled": True,
    }])
    payload_calls = []

    def fake_preserve_audio_payload(value, assets_root, record_id):
        payload_calls.append(value)
        return {
            "source_asset": "raw/audio/source.wav", "sample_rate": 16000,
            "channels": 1, "samples": 160, "duration_seconds": 0.01,
        }

    def fake_resample_audio_source(source, assets_root, record_id, target_sample_rate):
        return {
            "training_asset": "processed/audio/source-24000hz.wav",
            "training_sample_rate": target_sample_rate, "training_channels": 1,
            "training_samples": 240, "resampled": True,
            "resampler": "scipy.signal.resample_poly", "resample_ratio": {"up": 3, "down": 2},
        }

    monkeypatch.setattr(converter_module, "preserve_audio_payload", fake_preserve_audio_payload)
    monkeypatch.setattr(converter_module, "resample_audio_source", fake_resample_audio_source)
    restored, report = restore_source_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: [row],
        viewer_row_loader=lambda *_: (_ for _ in ()).throw(
            AssertionError("non-empty encoded bytes must be used before remote fallback")
        ),
    )

    assert len(restored) == 1
    assert payload_calls == [{"bytes": b"encoded-audio"}]
    assert report["dataset_viewer_media_restored_records"] == 0
    assert report["errors"] == []




def test_restore_progress_reuses_completed_media_without_rescanning(tmp_path):
    image = Image.new("RGB", (14, 11), (3, 4, 5))
    row = {"id": "resume-image-01", "image": image}
    record = _record("resume-source", row, "image_reconstruction", "resume-image-record")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "resume-source", "repo": "org/resume", "config": "default",
        "hf_splits": ["train"], "adapter": "image", "image_field": "image", "enabled": True,
    }])
    assets = tmp_path / "assets"
    progress = tmp_path / "restore-progress.jsonl"
    restored, first = restore_source_media_records(
        [record], registry, assets, source_loader=lambda *_: [row], progress_path=progress,
    )
    assert len(restored) == 1 and first["resumed_media_records"] == 0
    assert progress.is_file()
    def must_not_scan(*_):
        raise AssertionError("completed media must be resumed without re-scanning")
    resumed, second = restore_source_media_records(
        [record], registry, assets, source_loader=must_not_scan, progress_path=progress,
    )
    assert len(resumed) == 1 and second["resumed_media_records"] == 1
    assert second["blocked"] is False


def test_fleurs_tar_fallback_extracts_only_matched_wav_files(tmp_path, monkeypatch):
    import io
    import shutil
    import tarfile
    from onecore.v3.converter import _extract_fleurs_audio_for_rows

    archive = tmp_path / "train.tar.gz"
    with tarfile.open(archive, "w:gz") as handle:
        for name, payload in (("audio/keep.wav", b"wanted"), ("audio/other.wav", b"ignore")):
            info = tarfile.TarInfo(name)
            info.size = len(payload)
            handle.addfile(info, io.BytesIO(payload))
    monkeypatch.setattr(converter_module, "hf_hub_download", lambda **_: str(archive))
    row = {"audio": {"path": "/runner/missing/keep.wav"}}
    matched = [("rowhash", {"id": "fleurs-record"}, row, 4)]
    extracted, staging = _extract_fleurs_audio_for_rows(
        matched, {"repo": "google/fleurs", "config": "ar_eg", "audio_field": "audio"},
        "train", REVISION, tmp_path / "assets",
    )
    try:
        assert set(extracted) == {"fleurs-record"}
        assert extracted["fleurs-record"].read_bytes() == b"wanted"
        assert len(list(staging.iterdir())) == 1
    finally:
        shutil.rmtree(staging, ignore_errors=True)



def test_dataset_viewer_filter_fallback_uses_exact_row_key_and_pinned_revision():
    from onecore.v3.converter import _dataset_viewer_media_value

    revision = "d" * 40
    source_row = {"id": "07027116", "audio": {"path": "/runner/missing/07027116.wav"}}
    media_url = (
        "https://datasets-server.huggingface.co/cached-assets/org/audio/"
        f"--/{revision}/--/default/bbc/7/audio/audio.wav?Signature=valid"
    )
    calls = []

    def rows_loader(*_):
        raise RuntimeError("rows endpoint exceeds source row-group scan limit")

    def filter_loader(repo, config, split, where):
        calls.append((repo, config, split, where))
        return {
            "rows": [{
                "row_idx": 7,
                "row": {"id": "07027116", "audio": [{"src": media_url}]},
            }]
        }

    value = converter_module._dataset_viewer_media_value(
        source_row,
        {"repo": "org/audio", "config": "default", "audio_field": "audio"},
        "audio", revision, "bbc", 7,
        viewer_row_loader=rows_loader,
        filter_row_loader=filter_loader,
    )
    assert value == {"src": media_url}
    assert calls == [('org/audio', 'default', 'bbc', '"id"=\'07027116\'')]


def test_dataset_viewer_filter_fallback_rejects_wrong_revision():
    other_revision = "e" * 40
    pinned_revision = "d" * 40
    source_row = {"file": "ARA NORM 0001.wav"}
    bad_url = (
        "https://datasets-server.huggingface.co/cached-assets/org/audio/"
        f"--/{other_revision}/--/default/train/0/audio/audio.wav?Signature=bad"
    )
    with pytest.raises(ValueError, match="does not match the pinned source revision"):
        converter_module._dataset_viewer_filter_media_value(
            source_row,
            {"repo": "org/audio", "config": "default", "audio_field": "audio"},
            "audio", pinned_revision, "train",
            filter_row_loader=lambda *_: {
                "rows": [{
                    "row_idx": 0,
                    "row": {"file": "ARA NORM 0001.wav", "audio": [{"src": bad_url}]},
                }]
            },
        )


def test_v3_restore_uses_stateful_cursor_to_resume_bounded_source_scan(tmp_path):
    rows = [
        {"id": f"row-{index}", "image": Image.new("RGB", (17, 13), (index, 9, 10))}
        for index in range(6)
    ]
    record = _record("cursor-source", rows[5], "image_reconstruction", "cursor-image-005")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "cursor-source", "repo": "org/cursor-images", "config": "default",
        "hf_splits": ["train"], "adapter": "image", "image_field": "image",
        "enabled": True,
    }])

    class StatefulRows:
        def __init__(self, payload, position=0):
            self.payload = payload
            self.position = position

        def __iter__(self):
            while self.position < len(self.payload):
                row = self.payload[self.position]
                self.position += 1
                yield row

        def state_dict(self):
            return {"position": self.position}

        def load_state_dict(self, state):
            self.position = int(state["position"])
            return self

    progress = tmp_path / "restore-progress.jsonl"
    first, first_report = restore_source_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: StatefulRows(rows),
        progress_path=progress,
        max_scan_rows_per_source_split=2,
        cursor_root=tmp_path,
    )
    assert first == []
    assert first_report["deferred_source_splits"] == [{
        "source_id": "cursor-source", "split": "train", "remaining_records": 1,
        "reason": "bounded_scan_or_retry_checkpoint",
    }]
    cursor_file = tmp_path / "data/resume-cache/crawlers/v3-corpus-restore-image-source_corpus-identity/cursor-source/train.json"
    assert cursor_file.is_file()
    cursor_state = json.loads(cursor_file.read_text(encoding="utf-8"))
    assert cursor_state["rows_read"] == 2
    assert cursor_state["cursor_mode"] == "state_dict"

    second, second_report = restore_source_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: StatefulRows(rows),
        progress_path=progress,
        max_scan_rows_per_source_split=4,
        cursor_root=tmp_path,
    )
    assert len(second) == 1
    image_asset = second[0]["assets"]["image"]["source_asset"]
    assert (tmp_path / "assets" / image_asset).is_file()
    assert second_report["deferred_source_splits"] == []
    final_cursor = json.loads(cursor_file.read_text(encoding="utf-8"))
    assert final_cursor["rows_read"] == 6


def test_v3_image_restore_retries_pinned_viewer_if_local_path_disappears(tmp_path, monkeypatch):
    row = {"id": "image-viewer-race-001", "image": {"path": "/runner/cache/disappeared.jpg"}}
    record = _record("image-race-source", row, "image_reconstruction", "image-viewer-race-001")
    registry = tmp_path / "sources.yaml"
    _write_registry(registry, [{
        "id": "image-race-source", "repo": "org/image-race", "config": "default",
        "hf_splits": ["train"], "adapter": "image", "image_field": "image",
        "enabled": True,
    }])
    media_url = (
        "https://datasets-server.huggingface.co/cached-assets/org/image-race/"
        f"--/{REVISION}/--/default/train/0/image/image.jpg?Expires=9999999999&Signature=test"
    )
    preserve_calls = []

    def fake_preserve(value, assets_root, record_id):
        preserve_calls.append(value)
        if len(preserve_calls) == 1:
            raise FileNotFoundError("local image cache disappeared during copy")
        return {
            "source_asset": "raw/images/image-viewer-race-001.jpg",
            "width": 20, "height": 12, "resized": False,
        }

    monkeypatch.setattr(converter_module, "preserve_image_payload", fake_preserve)
    monkeypatch.setattr(converter_module, "_needs_dataset_viewer_fallback", lambda value: False)
    viewer_row = {"id": "image-viewer-race-001", "image": {"src": media_url}}
    restored, report = restore_source_media_records(
        [record], registry, tmp_path / "assets",
        source_loader=lambda *_: [row],
        viewer_row_loader=lambda *_: {"rows": [{"row_idx": 0, "row": viewer_row}]},
    )
    assert len(restored) == 1
    assert preserve_calls == [row["image"], {"src": media_url}]
    assert report["dataset_viewer_media_restored_records"] == 1
    assert report["errors"] == []


def test_dataset_viewer_filter_loader_retries_transient_http_errors(monkeypatch):
    from urllib.error import HTTPError

    calls = []
    payload = {"rows": [{"row": {"id": "retry-ok"}}]}

    class Response:
        def __enter__(self):
            return self
        def __exit__(self, *_):
            return False
        def read(self):
            return json.dumps(payload).encode("utf-8")

    def flaky_urlopen(request, timeout):
        calls.append((request.full_url, timeout))
        if len(calls) < 3:
            raise HTTPError(request.full_url, 502, "Bad Gateway", hdrs=None, fp=None)
        return Response()

    sleeps = []
    monkeypatch.setattr(converter_module, "urlopen", flaky_urlopen)
    monkeypatch.setattr(converter_module.time, "sleep", sleeps.append)

    result = converter_module._default_dataset_viewer_filter_loader(
        "org/video-data", "default", "train", '"file"=\'clip-001.mp4\''
    )

    assert result == payload
    assert len(calls) == 3
    assert sleeps == [1, 2]


def test_dataset_viewer_filter_loader_does_not_retry_permanent_http_errors(monkeypatch):
    from urllib.error import HTTPError

    calls = []

    def missing_urlopen(request, timeout):
        calls.append(request.full_url)
        raise HTTPError(request.full_url, 404, "Not Found", hdrs=None, fp=None)

    monkeypatch.setattr(converter_module, "urlopen", missing_urlopen)
    monkeypatch.setattr(converter_module.time, "sleep", lambda *_: None)

    with pytest.raises(HTTPError):
        converter_module._default_dataset_viewer_filter_loader(
            "org/video-data", "default", "train", '"file"=\'missing.mp4\''
        )
    assert len(calls) == 1



@pytest.mark.parametrize(
    ("gate_passed", "expected_blocked"),
    [(True, False), (False, True)],
)
def test_convert_existing_corpus_blocks_only_when_final_manifest_gate_fails(
    tmp_path, monkeypatch, gate_passed, expected_blocked,
):
    source_root = tmp_path / "source_corpus"
    source_root.mkdir()
    legacy_record = {
        "id": "legacy-text-001",
        "split": "train",
        "task": "text",
        "data_class": "external",
        "text": "A preserved externally sourced legacy row.",
    }
    for split in ("train", "validation", "test"):
        payload = [legacy_record] if split == "train" else []
        (source_root / f"{split}.jsonl").write_text(
            "".join(json.dumps(row) + "\n" for row in payload),
            encoding="utf-8",
        )

    restore_report = {
        "blocked": True,
        "skipped": {"pinned_source_row_not_found": 37},
        "errors": [],
        "deferred_source_splits": [],
    }

    def fake_restore(records, *args, **kwargs):
        assert len(records) == 1
        return records, dict(restore_report)

    monkeypatch.setattr(converter_module, "restore_source_media_records", fake_restore)
    monkeypatch.setattr(
        converter_module,
        "validate_v3_manifest",
        lambda *args, **kwargs: {"passed": gate_passed, "errors": []},
    )

    report = convert_existing_corpus(
        source_root,
        tmp_path / "sources.yaml",
        tmp_path / "output",
        fill_missing_media=False,
    )

    assert report["blocked"] is expected_blocked
    assert report["restoration_incomplete"] is True
    assert report["acquisition_incomplete"] is False
    assert report["skipped"]["pinned_source_row_not_found"] == 37
    assert report["manifest_gate"]["passed"] is gate_passed
