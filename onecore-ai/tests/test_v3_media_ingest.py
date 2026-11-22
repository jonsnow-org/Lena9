import numpy as np
import soundfile as sf
from PIL import Image

from onecore.v3.media_ingest import preserve_audio_source, preserve_image_source


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
