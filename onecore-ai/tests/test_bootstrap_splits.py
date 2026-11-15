import hashlib

import pytest

from onecore.bootstrap import generate_bootstrap
from onecore.data import (
    DatasetError,
    iter_training_records,
    validate_split_disjointness,
    validate_test_data,
    validate_training_data,
    validate_validation_data,
)


def _sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_bootstrap_generates_independent_test_split_without_rewriting_train_or_validation(tmp_path):
    report = generate_bootstrap(tmp_path)
    assert report["status"] == "generated-synthetic-bootstrap"
    assert report["train_records"] == 360
    assert report["validation_records"] == 87
    assert report["test_records"] == 87

    data_root = tmp_path / "data"
    train_manifest = data_root / "train.jsonl"
    validation_manifest = data_root / "validation.jsonl"
    test_manifest = data_root / "test.jsonl"
    train_sha = _sha256(train_manifest)
    validation_sha = _sha256(validation_manifest)

    # Exercise the additive migration used when old bootstrap data lacks test.jsonl.
    test_manifest.unlink()
    migration = generate_bootstrap(tmp_path)
    assert migration["status"] == "added-independent-test-split"
    assert migration["train_manifest_preserved"] is True
    assert migration["validation_manifest_preserved"] is True
    assert _sha256(train_manifest) == train_sha
    assert _sha256(validation_manifest) == validation_sha

    assert validate_training_data(tmp_path)["valid"]
    assert validate_validation_data(tmp_path)["valid"]
    assert validate_test_data(tmp_path)["valid"]
    disjointness = validate_split_disjointness(tmp_path)
    assert disjointness["valid"]
    assert all(
        counts["record_ids"] == 0
        and counts["asset_paths"] == 0
        and counts["asset_content_hashes"] == 0
        for counts in disjointness["cross_split_overlaps"].values()
    )


@pytest.mark.parametrize("split", ["validation", "test"])
def test_training_iterator_rejects_held_out_splits(split):
    with pytest.raises(DatasetError, match="non-training split"):
        iter_training_records([{"id": "held-out", "split": split}])



def test_training_iterator_excludes_unreviewed_external_records():
    records = [
        {"id": "bootstrap", "task": "text", "split": "train",
         "license": "local-owner-synthetic", "source_url": "local://onecore-bootstrap",
         "attribution": "OneCore bootstrap", "review_status": "generated", "text": "bootstrap"},
        {"id": "pending-external", "task": "text", "split": "train",
         "license": "cc-by-4.0", "source_url": "https://example.org/dataset",
         "attribution": "dataset authors", "review_status": "pending",
         "data_class": "external_staged", "text": "not reviewed"},
        {"id": "verified-synthetic", "task": "text", "split": "train",
         "license": "local-owner-synthetic", "source_url": "local://onecore-verified-curriculum",
         "attribution": "OneCore verified curriculum", "review_status": "verified",
         "data_class": "synthetic_verified", "verification": {"method": "reference_solver_v1", "reference": "math.integer_arithmetic.v1"},
         "text": "verified"},
    ]
    selected = iter_training_records(records)
    assert [item["id"] for item in selected] == ["bootstrap", "verified-synthetic"]


def test_both_onecore_training_workflows_use_builtin_release_token_fallback():
    repo_root = Path(__file__).resolve().parents[2]
    for name in ("onecore-bootstrap.yml", "onecore-training.yml"):
        workflow = (repo_root / ".github" / "workflows" / name).read_text(encoding="utf-8")
        assert "secrets.ONECORE_RELEASE_TOKEN || secrets.GITHUB_TOKEN" in workflow
