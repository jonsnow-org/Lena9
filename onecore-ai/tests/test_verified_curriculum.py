from __future__ import annotations

import hashlib
import json

from onecore.curriculum_reference import verify_record
from onecore.data import read_manifest, validate_manifest, validate_split_disjointness
from onecore.verified_curriculum import generate_verified_curriculum


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def test_small_verified_curriculum_is_reproducible_and_split_disjoint(tmp_path):
    root = tmp_path / "onecore-ai"
    data = root / "data"
    assets = data / "assets"
    assets.mkdir(parents=True)
    for split in ("train", "validation", "test"):
        (data / f"{split}.jsonl").write_text("", encoding="utf-8")

    counts = {"train": 9, "validation": 9, "test": 9}
    report = generate_verified_curriculum(root, counts)
    assert report["status"] == "generated"
    assert report["record_counts"] == {split: 72 for split in counts}
    assert report["validation_report"]["cross_split_overlaps"] == {
        "train__validation": {"domain_problem_hashes": 0, "scene_hashes": 0},
        "train__test": {"domain_problem_hashes": 0, "scene_hashes": 0},
        "validation__test": {"domain_problem_hashes": 0, "scene_hashes": 0},
    }

    manifest_hashes = {}
    for split in ("train", "validation", "test"):
        records = read_manifest(data / f"{split}.jsonl")
        gate = validate_manifest(records, assets, expected_split=split)
        assert gate["valid"], gate["errors"]
        generated = [
            record for record in records
            if record.get("data_class") == "synthetic_verified"
            and record.get("curriculum_version") == "onecore-verified-curriculum-v2"
        ]
        assert len(generated) == 72
        assert all(verify_record(record) for record in generated)
        assert all(record.get("verification", {}).get("method") == "deterministic_reference_solver_v1" for record in generated)
        assert all(
            isinstance(record.get("verification", {}).get("asset_sha256"), dict)
            for record in generated if record["task"] in {
                "image_caption", "image_reconstruction", "audio_text", "audio_reconstruction",
                "video_caption", "video_reconstruction",
            }
        )
        manifest_hashes[split] = _sha256(data / f"{split}.jsonl")

    split_report = validate_split_disjointness(root)
    assert split_report["valid"], split_report
    repeated = generate_verified_curriculum(root, counts)
    assert repeated["status"] == "already-present"
    assert repeated["records_added"] == {split: 0 for split in counts}
    assert manifest_hashes == {split: _sha256(data / f"{split}.jsonl") for split in counts}
    acquisition_report = json.loads((data / "acquisition-report.json").read_text(encoding="utf-8"))
    assert acquisition_report["verified_curriculum"]["promotion_eligible"] is False
    assert acquisition_report["extended_train_manifest_sha256"] == manifest_hashes["train"]
