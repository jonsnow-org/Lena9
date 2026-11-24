from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


def _load_workflow(path: Path):
    # BaseLoader keeps the GitHub Actions key "on" as a string (PyYAML 1.1
    # SafeLoader otherwise treats it as a boolean).
    return yaml.load(path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def _assert_all_jobs_disabled(path: Path) -> None:
    workflow = _load_workflow(path)
    jobs = workflow.get("jobs")
    assert isinstance(jobs, dict) and jobs
    assert all(str(job.get("if", "")).strip() == "${{ false }}" for job in jobs.values())


def test_v2_archive_bootstrap_has_no_runnable_job():
    path = WORKFLOWS / "onecore-bootstrap.yml"
    workflow = _load_workflow(path)
    assert workflow["name"].startswith("OneCore V2 (ARCHIVED)")
    assert workflow["on"]["push"]["branches"] == ["research/onecore-foundation"]
    _assert_all_jobs_disabled(path)


def test_v2_archive_manual_training_has_no_runnable_job():
    path = WORKFLOWS / "onecore-training.yml"
    workflow = _load_workflow(path)
    assert workflow["name"].startswith("OneCore V2 (ARCHIVED)")
    assert "workflow_dispatch" in workflow["on"]
    _assert_all_jobs_disabled(path)


def test_v2_archive_readme_explicitly_preserves_checkpoint_lineage():
    text = (ROOT / "onecore-ai" / "README.md").read_text(encoding="utf-8")
    assert "ARCHIVED" in text
    assert "57,579,201" in text
    assert "Do not copy V2 model weights" in text
