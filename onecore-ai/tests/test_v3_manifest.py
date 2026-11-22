import hashlib

import pytest
from PIL import Image

from onecore.v3.manifest import assert_v3_external_coverage, validate_v3_manifest


def _external(source_id, row_id):
    return {
        "source_url": "https://example.org/dataset",
        "data_class": "external",
        "source_id": source_id,
        "source_revision": "b" * 40,
        "source_row_id_sha256": hashlib.sha256(row_id.encode()).hexdigest(),
    }


def _records(root):
    rows = []
    for split_index, split in enumerate(("train", "validation", "test")):
        assets = root / split
        (assets / "raw").mkdir(parents=True)
        (assets / "frames").mkdir()
        Image.new("RGB", (16, 16), (split_index + 1, 2, 3)).save(assets / "raw/image.png")
        (assets / "raw/audio.wav").write_bytes(f"audio-{split}".encode())
        (assets / "processed").mkdir()
        (assets / "processed/audio.wav").write_bytes(f"normalized-audio-{split}".encode())
        Image.new("RGB", (16, 16), (4, split_index + 5, 6)).save(assets / "frames/0.png")
        Image.new("RGB", (16, 16), (7, 8, split_index + 9)).save(assets / "frames/1.png")
        rows.extend([
            {**_external(f"{split}-text", f"{split}-text-row"), "id": f"{split}-text",
             "split": split, "task": "text", "text": "A sufficiently long external text sample."},
            {**_external(f"{split}-tool", f"{split}-tool-row"), "id": f"{split}-tool",
             "split": split, "task": "tool_use", "prompt": "Search for a fact.",
             "response": '{"name":"search","arguments":{"query":"x"}}'},
            {**_external(f"{split}-image", f"{split}-image-row"), "id": f"{split}-image",
             "split": split, "task": "image_caption",
             "assets": {"image": {"source_asset": f"{split}/raw/image.png"}}},
            {**_external(f"{split}-audio", f"{split}-audio-row"), "id": f"{split}-audio",
             "split": split, "task": "audio_text",
             "assets": {"audio": {"source_asset": f"{split}/raw/audio.wav",
                                  "training_asset": f"{split}/processed/audio.wav"}}},
            {**_external(f"{split}-video", f"{split}-video-row"), "id": f"{split}-video",
             "split": split, "task": "video_caption",
             "assets": {"video": {"frames": [f"{split}/frames/0.png", f"{split}/frames/1.png"]}}},
        ])
    return rows


def test_v3_manifest_requires_external_provenance_raw_assets_and_disjoint_splits(tmp_path):
    records = _records(tmp_path)
    report = assert_v3_external_coverage(
        records, tmp_path, minimum_train=1, minimum_holdout=1
    )
    assert report["passed"]
    assert report["accepted_external_records"] == 15
    assert report["coverage"]["validation"]["image"] == 1
    assert "train/processed/audio.wav" in report["asset_hashes"]


def test_v3_manifest_does_not_count_bootstrap_media(tmp_path):
    records = _records(tmp_path)
    records = [
        {**row, "data_class": "bootstrap"} if row["task"] == "image_caption" else row
        for row in records
    ]
    report = validate_v3_manifest(records, tmp_path, minimum_train=1, minimum_holdout=1)
    assert not report["passed"]
    assert any("validation/image: 0" in error for error in report["errors"])


def test_v3_manifest_rejects_cross_split_asset_leakage(tmp_path):
    records = _records(tmp_path)
    records[7]["assets"] = records[2]["assets"]
    report = validate_v3_manifest(records, tmp_path, minimum_train=1, minimum_holdout=1)
    assert not report["passed"]
    assert any("asset hash leaks across" in error for error in report["errors"])


def test_v3_manifest_rejects_missing_raw_media(tmp_path):
    records = _records(tmp_path)
    records[2]["assets"]["image"]["source_asset"] = "train/raw/missing.png"
    with pytest.raises(RuntimeError, match="missing asset"):
        assert_v3_external_coverage(
            records, tmp_path, minimum_train=1, minimum_holdout=1
        )



def test_v3_manifest_rejects_duplicate_source_rows_within_same_split(tmp_path):
    records = _records(tmp_path)
    duplicate = dict(records[0])
    duplicate["id"] = "train-text-duplicate"
    records.append(duplicate)
    report = validate_v3_manifest(records, tmp_path, minimum_train=1, minimum_holdout=1)
    assert not report["passed"]
    assert any("duplicate source row" in error for error in report["errors"])


def test_v3_manifest_rejects_duplicate_assets_within_same_split(tmp_path):
    records = _records(tmp_path)
    records[3]["assets"] = records[2]["assets"]
    report = validate_v3_manifest(records, tmp_path, minimum_train=1, minimum_holdout=1)
    assert not report["passed"]
    assert any("duplicated within split" in error for error in report["errors"])
