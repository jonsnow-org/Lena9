import hashlib
from pathlib import Path

import pytest
import yaml

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



def test_training_iterator_admits_every_available_data_class():
    records = [
        {"id": "bootstrap", "task": "text", "split": "train",
         "source_url": "local://onecore-bootstrap",
         "text": "bootstrap"},
        {"id": "pending-external", "task": "text", "split": "train",
         "source_url": "https://example.org/dataset",
         "data_class": "external", "source_id": "external-text-source",
         "source_revision": "a" * 40, "source_row_id_sha256": "b" * 64,
         "text": "imported real external sample"},
        {"id": "verified-synthetic", "task": "text", "split": "train",
         "source_url": "local://onecore-verified-curriculum",
         "data_class": "synthetic_verified", "verification": {"method": "reference_solver_v1", "reference": "math.integer_arithmetic.v1"},
         "text": "verified synthetic sample"},
        {"id": "local-owner", "task": "text", "split": "train",
         "source_url": "local://owner-created-notes",
         "data_class": "owner_curated", "text": "local owner-created sample"},
    ]
    selected = iter_training_records(records)
    assert [item["id"] for item in selected] == ["bootstrap", "pending-external", "verified-synthetic", "local-owner"]


def test_both_onecore_training_workflows_use_builtin_release_token_fallback():
    repo_root = Path(__file__).resolve().parents[2]
    bootstrap = (repo_root / ".github" / "workflows" / "onecore-bootstrap.yml").read_text(encoding="utf-8")
    training = (repo_root / ".github" / "workflows" / "onecore-training.yml").read_text(encoding="utf-8")
    assert "secrets.ONECORE_RELEASE_TOKEN || secrets.GITHUB_TOKEN" in bootstrap
    assert "secrets.ONECORE_RELEASE_TOKEN || secrets.GITHUB_TOKEN" in training


def test_onecore_bootstrap_uses_bounded_acquisition_and_alternating_checkpointed_sessions():
    repo_root = Path(__file__).resolve().parents[2]
    bootstrap = (repo_root / ".github" / "workflows" / "onecore-bootstrap.yml").read_text(encoding="utf-8")
    acquire_action = (repo_root / ".github" / "actions" / "onecore-acquire" / "action.yml").read_text(encoding="utf-8")
    train_action = (repo_root / ".github" / "actions" / "onecore-train" / "action.yml").read_text(encoding="utf-8")
    training = (repo_root / ".github" / "workflows" / "onecore-training.yml").read_text(encoding="utf-8")
    bootstrap_doc = yaml.safe_load(bootstrap)
    acquire_doc = yaml.safe_load(acquire_action)
    train_doc = yaml.safe_load(train_action)
    assert acquire_doc["runs"]["using"] == "composite"
    assert train_doc["runs"]["using"] == "composite"
    assert bootstrap_doc["jobs"]["finalize_acquisition"]["outputs"]["complete"].startswith("${{")
    assert bootstrap_doc["jobs"]["dataset_gate"]["if"].startswith("${{")
    assert "always() && needs.finalize_acquisition.result == 'success' && needs.finalize_acquisition.outputs.complete == 'true'" in bootstrap
    assert "always() && needs.dataset_gate.result == 'success'" in bootstrap
    assert "always() && needs.train_all.result == 'success'" in bootstrap
    assert "base_corpus_artifact_name" in bootstrap
    assert 'print(f"request_stage={stage}")' in bootstrap
    assert "REQUEST_STAGE" in bootstrap
    assert "train_existing" in bootstrap
    assert "repair_video_existing" in bootstrap
    assert "request_stage: ${{ steps.select.outputs.request_stage }}" in bootstrap
    assert 'only_sources={"videos4camera_bench"}' in bootstrap
    assert "time_budget_seconds=1200" in bootstrap and "source_budget_seconds=1200" in bootstrap
    assert "onecore-corpus-video-repair-snapshot" in bootstrap
    assert "needs.finalize_acquisition.outputs.request_stage == 'repair_video_existing'" in bootstrap
    assert "needs.prepare.outputs.request_stage == 'acquire'" in bootstrap
    assert 'run-id: ${{ needs.finalize_acquisition.outputs.artifact_run_id }}' in bootstrap
    assert 'github-token: ${{ github.token }}' in bootstrap
    assert "onecore-corpus-acq-progress" in bootstrap
    assert "resume_notice" in bootstrap_doc["jobs"]
    assert "cancel-in-progress: true" in bootstrap
    assert "timeout-minutes: 330" in bootstrap
    assert "onecore-corpus-" in bootstrap
    assert "onecore-corpus-final" in bootstrap
    assert "ONECORE_REQUIRED_TASKS: \"text,tool,image,audio,video\"" in bootstrap
    assert bootstrap.count('budget_seconds: "540"') == 1
    assert bootstrap.count('source_budget_seconds: "60"') == 1
    assert "required_tasks:" in acquire_action
    assert 'default: "540"' in acquire_action
    assert "source_budget_seconds:" in acquire_action
    assert 'default: "60"' in acquire_action
    assert "source_budget_seconds must be between 60 and 120" in acquire_action
    assert "REQUIRED_TASKS: ${{ inputs.required_tasks }}" in acquire_action
    assert "MIN_TRAIN_RECORDS: ${{ inputs.min_train_records }}" in acquire_action
    assert "MIN_HOLDOUT_RECORDS: ${{ inputs.min_holdout_records }}" in acquire_action
    assert "assert_task_coverage" in acquire_action
    assert "acquisition_complete" in acquire_action
    assert "ONECORE_ACQUIRE_BUDGET_SECONDS" in acquire_action
    assert "persist_acquisition_progress" in acquire_action
    assert "onecore.artifacts pack" in acquire_action
    assert "onecore.artifacts restore" in acquire_action
    assert "onecore-corpus.tar" in acquire_action
    artifact_source = (repo_root / "onecore-ai" / "src" / "onecore" / "artifacts.py").read_text(encoding="utf-8")
    assert '"assets", "metadata", "pending", "resume-cache"' in artifact_source
    assert "ONECORE_FINALIZE_DATA_GATE: \"1\"" in bootstrap
    assert "start_fresh_joint_training" in bootstrap
    assert "./.github/actions/onecore-acquire" in bootstrap
    assert "./.github/actions/onecore-train" in bootstrap
    assert "steps: \"15\"" in bootstrap
    assert "onecore-state-train-10" in bootstrap
    assert "Notebook order: 03, 04, 03, 04, 03, 04, 03, 04, 03, 04" in bootstrap
    jobs = bootstrap_doc["jobs"]
    assert "train_all" in jobs
    assert not any(f"train_{index:02d}" in jobs for index in range(1, 11))
    train_job = jobs["train_all"]
    assert train_job["needs"] == ["dataset_gate", "prepare"]
    assert "resume_checkpoint_run_id" in bootstrap
    assert "resume_checkpoint_artifact_name" in bootstrap
    assert "checkpoint_run_id" in train_doc["inputs"]
    assert "github-token: ${{ github.token }}" in train_action
    assert "repository: ${{ github.repository }}" in train_action
    assert "run-id: ${{ inputs.checkpoint_run_id != '' && inputs.checkpoint_run_id || github.run_id }}" in train_action
    assert "resume_checkpoint_session:" in bootstrap
    assert train_job["timeout-minutes"] == 360
    segments = [step for step in train_job["steps"] if str(step.get("id", "")).startswith("train")]
    assert "resume_checkpoint_session == '0'" in segments[0]["if"]
    for index, step in enumerate(segments[1:], 2):
        assert f"resume_checkpoint_session == '{index-1}'" in step["if"]
        assert f"resume_checkpoint_session == '{index-1}'" in step["with"]["setup_environment"]
        assert f"resume_checkpoint_session == '{index-1}'" in step["with"]["restore_corpus"]
        assert "checkpoint_run_id:" in step["with"] or index > 2
    expected_notebooks = [
        "03_text_pretraining.ipynb", "04_multimodal_curriculum.ipynb",
        "03_text_pretraining.ipynb", "04_multimodal_curriculum.ipynb",
        "03_text_pretraining.ipynb", "04_multimodal_curriculum.ipynb",
        "03_text_pretraining.ipynb", "04_multimodal_curriculum.ipynb",
        "03_text_pretraining.ipynb", "04_multimodal_curriculum.ipynb",
    ]
    assert len(segments) == 10
    for index, step in enumerate(segments, 1):
        assert step["id"] == f"train{index:02d}"
        assert step["uses"] == "./.github/actions/onecore-train"
        assert step["with"]["steps"] == "15"
        assert step["with"]["notebook"] == expected_notebooks[index - 1]
        if index == 1:
            assert step["with"]["setup_environment"] == "true"
            assert step["with"]["restore_corpus"] == "true"
        else:
            assert f"resume_checkpoint_session == '{index-1}'" in step["with"]["setup_environment"]
            assert f"resume_checkpoint_session == '{index-1}'" in step["with"]["restore_corpus"]
            assert "checkpoint_run_id:" in step["with"]
    assert "artifact_run_id == github.run_id" in bootstrap
    assert train_job["outputs"]["optimizer_step"] == "${{ steps.train10.outputs.optimizer_step }}"
    evaluate = jobs["evaluate"]
    assert evaluate["needs"] == "train_all"
    assert sum(step.get("uses", "").startswith("actions/download-artifact@") for step in evaluate["steps"]) == 2
    assert not any("onecore-corpus-final" in str(step.get("with", {})) for step in evaluate["steps"])
    assert train_doc["inputs"]["setup_environment"]["default"] == "true"
    assert train_doc["inputs"]["restore_corpus"]["default"] == "true"
    train_steps = train_doc["runs"]["steps"]
    for step_name in ("Set up Python", "Install CPU-only PyTorch and OneCore dependencies"):
        step = next(item for item in train_steps if item.get("name") == step_name)
        assert step["if"] == "${{ inputs.setup_environment == 'true' }}"
    for step_name in ("Restore the validated corpus", "Restore the validated corpus snapshot (tar or legacy layout)"):
        step = next(item for item in train_steps if item.get("name") == step_name)
        assert step["if"] == "${{ inputs.restore_corpus == 'true' }}"
    assert "optimizer_step" in train_action and "checkpoint_sha256" in train_action
    assert "optimizer, scheduler, RNG" in train_action
    assert "text,tool,image,audio,video" in training
    assert "cancel-in-progress: true" in bootstrap
    assert "gh workflow run onecore-training.yml" not in bootstrap
