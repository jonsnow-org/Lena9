import hashlib
from pathlib import Path

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



def test_training_iterator_admits_external_records_and_excludes_every_synthetic_class():
    records = [
        {"id": "bootstrap", "task": "text", "split": "train",
         "license": "local-owner-synthetic", "source_url": "local://onecore-bootstrap",
         "attribution": "OneCore bootstrap", "review_status": "generated", "text": "bootstrap"},
        {"id": "pending-external", "task": "text", "split": "train",
         "license": "cc-by-4.0", "source_url": "https://example.org/dataset",
         "attribution": "dataset authors", "review_status": "pending",
         "data_class": "external_staged", "license": "cc-by-4.0",
         "source_id": "external-text-source",
         "source_revision": "a" * 40, "source_row_id_sha256": "b" * 64,
         "text": "imported real external sample"},
        {"id": "verified-synthetic", "task": "text", "split": "train",
         "license": "local-owner-synthetic", "source_url": "local://onecore-verified-curriculum",
         "attribution": "OneCore verified curriculum", "review_status": "verified",
         "data_class": "synthetic_verified", "verification": {"method": "reference_solver_v1", "reference": "math.integer_arithmetic.v1"},
         "text": "verified synthetic sample"},
        {"id": "local-owner", "task": "text", "split": "train",
         "license": "cc-by-4.0", "source_url": "local://owner-created-notes",
         "attribution": "local owner", "review_status": "approved",
         "data_class": "owner_curated", "text": "local owner-created sample"},
    ]
    selected = iter_training_records(records)
    assert [item["id"] for item in selected] == ["pending-external"]


def test_both_onecore_training_workflows_use_builtin_release_token_fallback():
    repo_root = Path(__file__).resolve().parents[2]
    for name in ("onecore-bootstrap.yml", "onecore-training.yml"):
        workflow = (repo_root / ".github" / "workflows" / name).read_text(encoding="utf-8")
        assert "secrets.ONECORE_RELEASE_TOKEN || secrets.GITHUB_TOKEN" in workflow

def test_workflows_use_stage_specific_external_data_gates_and_license_guard():
    repo_root = Path(__file__).resolve().parents[2]
    bootstrap = (repo_root / ".github" / "workflows" / "onecore-bootstrap.yml").read_text(encoding="utf-8")
    training = (repo_root / ".github" / "workflows" / "onecore-training.yml").read_text(encoding="utf-8")
    assert "ONECORE_REQUIRED_TASKS:" in bootstrap
    assert "ONECORE_REQUIRED_TASKS:" in training
    assert "text,tool,image,audio,video" in bootstrap
    assert "text,tool,image,audio,video" in training
    assert "stage == 'acquire' && 'text,tool,image,audio,video'" in bootstrap
    assert "stage == 'multimodal' && 'text,tool,image,audio,video'" in bootstrap
    assert "inputs.stage == 'multimodal' && 'text,tool,image,audio,video'" in training
    assert "Enforce commercial license and immutable provenance before corpus artifact upload" in bootstrap
    assert "ONECORE_DATA_PROFILE:" in bootstrap
    assert "start_fresh_joint_training = request.get" in bootstrap
    assert "steps.request.outputs.start_fresh_joint_training == 'true'" in bootstrap
    assert "ONECORE_SKIP_ACQUISITION: ${{ steps.request.outputs.stage != 'acquire'" in bootstrap
    assert "(steps.request.outputs.stage != 'acquire' || steps.request.outputs.start_fresh_joint_training == 'true')" in bootstrap
    assert "Restore prior verified corpus as the base for incremental acquisition" in bootstrap
    assert "Start fresh random-initialized OneCore joint multimodal training in the same CPU job" in bootstrap
    assert "gh workflow run onecore-training.yml" not in bootstrap
    assert "acquisition-only stage; no checkpoint alias created" in bootstrap
