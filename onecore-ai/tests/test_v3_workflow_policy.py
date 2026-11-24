from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


def test_canonical_onecore_ci_runs_on_v3_only_and_restore_is_explicit():
    workflow = (WORKFLOWS / "onecore-ci.yml").read_text(encoding="utf-8")
    assert "branches: [research/onecore-v3-implementation]" in workflow
    assert "branches: [research/onecore-foundation, research/onecore-v3-implementation]" not in workflow
    restore = workflow.split("  v3-corpus-restore:", 1)[1]
    assert "github.event_name == 'push'" in restore
    assert "contains(github.event.head_commit.message, '[onecore-v3-corpus-restore]')" in restore


def test_v2_training_is_archived_and_cannot_run_from_canonical_v3():
    training = (WORKFLOWS / "onecore-training.yml").read_text(encoding="utf-8")
    assert "if: false" in training
    bootstrap = (WORKFLOWS / "onecore-bootstrap.yml").read_text(encoding="utf-8")
    assert "OneCore V2 (ARCHIVED)" in bootstrap
    assert "branches: [research/onecore-foundation]" in bootstrap
