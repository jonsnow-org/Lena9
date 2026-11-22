import numpy as np
import imageio.v3 as iio

from onecore.v3.media_ingest import preserve_video_source


def test_v3_video_ingest_preserves_every_frame_and_timestamp_metadata(tmp_path):
    source = tmp_path / "seven-frame.gif"
    frames = np.stack([
        np.full((16, 24, 3), index * 20, dtype=np.uint8)
        for index in range(7)
    ])
    iio.imwrite(source, frames, duration=100, loop=0)

    report = preserve_video_source(source, tmp_path / "assets", "clip-007")

    assert report["frame_count"] == 7
    assert len(report["frames"]) == 7
    assert report["frame_limit_applied"] is False
    assert report["timestamp_unit"] == "frame_index"
    assert report["width"] == 24 and report["height"] == 16
    assert (tmp_path / "assets" / report["source_asset"]).is_file()
    assert all((tmp_path / "assets" / path).is_file() for path in report["frames"])
