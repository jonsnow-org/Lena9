import numpy as np
import soundfile as sf
from PIL import Image

from onecore.v3.media_ingest import (
    preserve_audio_payload, preserve_image_payload, preserve_video_payload,
)


def test_v3_image_payload_supports_bytes_and_decoded_arrays(tmp_path):
    source = tmp_path / "source.png"
    Image.new("RGB", (29, 43), (20, 30, 40)).save(source)
    raw = source.read_bytes()
    from_bytes = preserve_image_payload({"bytes": raw}, tmp_path / "assets", "image-bytes")
    from_array = preserve_image_payload(
        np.zeros((31, 47, 3), dtype=np.uint8), tmp_path / "assets", "image-array"
    )
    assert (from_bytes["width"], from_bytes["height"]) == (29, 43)
    assert (from_array["width"], from_array["height"]) == (47, 31)


def test_v3_audio_payload_supports_bytes_and_array_metadata(tmp_path):
    source = tmp_path / "source.wav"
    sf.write(source, np.zeros((1200, 2), dtype=np.float32), 24000)
    from_bytes = preserve_audio_payload(
        {"bytes": source.read_bytes()}, tmp_path / "assets", "audio-bytes"
    )
    from_array = preserve_audio_payload(
        {"array": np.zeros((800, 1), dtype=np.float32), "sampling_rate": 16000},
        tmp_path / "assets", "audio-array",
    )
    assert from_bytes["sample_rate"] == 24000 and from_bytes["channels"] == 2
    assert from_array["sample_rate"] == 16000 and from_array["samples"] == 800


def test_v3_video_payload_preserves_all_dataset_frames_without_container(tmp_path):
    frames = [np.full((12, 18, 3), i, dtype=np.uint8) for i in range(9)]
    report = preserve_video_payload(
        {"frames": frames, "timestamps": [i / 30 for i in range(9)], "fps": 30},
        tmp_path / "assets", "video-frames",
    )
    assert report["frame_count"] == 9
    assert len(report["frames"]) == 9
    assert report["timestamp_unit"] == "seconds"
    assert report["frame_limit_applied"] is False
