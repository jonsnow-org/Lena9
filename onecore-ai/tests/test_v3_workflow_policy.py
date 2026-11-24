from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


def test_canonical_onecore_ci_runs_on_v3_only_and_restore_is_explicit():
    workflow = (WORKFLOWS / "onecore-ci.yml").read_text(encoding="utf-8")
    assert "branches: [research/onecore-v3-implementation]" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "branches: [research/onecore-foundation, research/onecore-v3-implementation]" not in workflow
    assert "workflow_dispatch:" in workflow
    assert "restore_v3_corpus:" in workflow
    assert "default: false" in workflow
    restore = workflow.split("  v3-corpus-restore:", 1)[1]
    assert "github.event_name == 'workflow_dispatch'" in restore
    assert "inputs.restore_v3_corpus == true" in restore
    assert "github.event.head_commit.message" not in restore


def test_v2_training_is_archived_and_cannot_run_from_canonical_v3():
    training = (WORKFLOWS / "onecore-training.yml").read_text(encoding="utf-8")
    assert "if: false" in training
    bootstrap = (WORKFLOWS / "onecore-bootstrap.yml").read_text(encoding="utf-8")
    assert "OneCore V2 (ARCHIVED)" in bootstrap
    assert "branches: [research/onecore-foundation]" in bootstrap



def test_v3_tokenizer_workflow_is_pinned_idempotent_and_does_not_train():
    import json
    request_data = json.loads(
        (ROOT / "onecore-ai" / "v3-tokenizer-request.json").read_text(encoding="utf-8")
    )
    workflow = (WORKFLOWS / "onecore-v3-tokenizer.yml").read_text(encoding="utf-8")
    assert request_data["source_run_id"] == 45325008221
    assert request_data["source_artifact_id"] == 14892594659
    assert request_data["source_artifact_name"] == "onecore-v3-corpus-45325008221"
    assert request_data["minimum_text_records"] >= 100
    assert request_data["output_artifact_name"] == "onecore-v3-tokenizer-45325008221"
    assert "workflow_dispatch:" in workflow
    assert 'paths: ["onecore-ai/v3-tokenizer-request.json"]' in workflow
    assert "cancel-in-progress: false" in workflow
    assert "extract_v3_train_manifest" in workflow
    assert "onecore.v3.tokenizer" in workflow
    assert "validation_or_test_rows_used" in workflow
    assert "onecore.v3.training" not in workflow
    assert "train_v3_step(" not in workflow


def test_v3_tokenizer_fit_waits_for_same_sha_ci_and_rechecks_source_evidence():
    import json
    request_data = json.loads(
        (ROOT / "onecore-ai" / "v3-tokenizer-request.json").read_text(encoding="utf-8")
    )
    workflow = (WORKFLOWS / "onecore-v3-tokenizer.yml").read_text(encoding="utf-8")
    assert request_data["fit_revision"] == 2
    assert request_data["source_artifact_digest"].startswith("sha256:")
    assert request_data["source_artifact_size_bytes"] == 24432975285
    assert request_data["source_report_artifact_id"] == 14893020087
    assert request_data["source_report_artifact_size_bytes"] == 892194
    assert "Wait for canonical V3 Verify on this exact commit" in workflow
    assert "GITHUB_SHA" in workflow
    assert "source_report_artifact_digest" in workflow
    assert "source_artifact_digest" in workflow
    assert "onecore-v3-conversion-report-45325008221" in workflow
    assert "manifest_gate" in workflow
    assert "actions/download-artifact@v7" in workflow
    assert "train_v3_step(" not in workflow
