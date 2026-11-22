import numpy as np
import soundfile as sf
from PIL import Image

from onecore.v3.media_ingest import (\n    preserve_audio_payload, preserve_audio_source, preserve_image_source, resample_audio_source,\n)


def test_v3_image_ingest_preserves_native_dimensions_and_original_asset(tmp_path):
    source = tmp_path / "portrait.png"
    Image.new("RGB", (47, 63), (10, 20, 30)).save(source)
    report = preserve_image_source(source, tmp_path / "assets", "portrait/001")

    preserved = tmp_path / "assets" / report["source_asset"]
    assert preserved.is_file()
    assert (report["width"], report["height"]) == (47, 63)
    assert report["resized"] is False
    with Image.open(preserved) as image:
        assert image.size == (47, 63)


def test_v3_audio_ingest_preserves_sample_rate_channels_and_duration(tmp_path):
    source = tmp_path / "stereo.wav"
    waveform = np.zeros((2400, 2), dtype=np.float32)
    sf.write(source, waveform, 24000, subtype="PCM_16")
    report = preserve_audio_source(source, tmp_path / "assets", "audio-001")

    assert (report["sample_rate"], report["channels"], report["samples"]) == (24000, 2, 2400)
    assert abs(report["duration_seconds"] - 0.1) < 1e-6
    assert (tmp_path / "assets" / report["source_asset"]).is_file()


def test_v3_audio_array_ingest_requires_explicit_source_sample_rate(tmp_path):
    import pytest

    with pytest.raises(ValueError, match="original sample_rate"):
        preserve_audio_payload(
            {"array": np.zeros((100, 1), dtype=np.float32)},
            tmp_path / "assets", "missing-rate",
        )


def test_v3_audio_resampling_preserves_raw_and_creates_canonical_training_asset(tmp_path):
    source = tmp_path / "source-44100.wav"
    time = np.arange(4410, dtype=np.float32) / 44100
    waveform = np.stack((np.sin(2 * np.pi * 440 * time),
                         np.sin(2 * np.pi * 660 * time)), axis=1).astype(np.float32)
    sf.write(source, waveform, 44100, subtype="PCM_16")
    report = resample_audio_source(source, tmp_path / "assets", "resample-44100")

    raw = tmp_path / "assets" / report["source_asset"]
    derived = tmp_path / "assets" / report["training_asset"]
    assert raw.is_file() and derived.is_file()
    assert report["sample_rate"] == 44100
    assert report["training_sample_rate"] == 24000
    assert report["channels"] == report["training_channels"] == 2
    assert report["training_samples"] == 2400
    normalized, rate = sf.read(derived, always_2d=True)
    assert rate == 24000 and normalized.shape == (2400, 2)
    assert report["resampled"] is True
    assert report["resampler"] == "scipy.signal.resample_poly"


def test_v3_audio_resampling_uses_identity_for_canonical_rate(tmp_path):
    source = tmp_path / "source-24000.wav"
    sf.write(source, np.zeros((2400, 1), dtype=np.float32), 24000)
    report = resample_audio_source(source, tmp_path / "assets", "already-canonical")
    assert report["training_asset"] == report["source_asset"]
    assert report["resampled"] is False
