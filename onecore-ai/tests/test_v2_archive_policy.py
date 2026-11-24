from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


def _load_workflow(path: Path):
    # BaseLoader preserves GitHub Actions' "on" key as a string.
    return yaml.load(path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def _assert_all_jobs_disabled(path: Path) -> None:
    workflow = _load_workflow(path)
    jobs = workflow.get("jobs")
    assert isinstance(jobs, dict) and jobs
    for name, job in jobs.items():
        assert job.get("if") == "${{ false }}", f"legacy job {name} must be disabled"
        # A duplicated job-level if can override the archive guard in YAML parsers.
        lines = path.read_text(encoding="utf-8").splitlines()
        start = next(i for i, line in enumerate(lines) if line == f"  {name}:")
        stop = next(
            (i for i in range(start + 1, len(lines)) if lines[i].startswith("  ") and not lines[i].startswith("    ")),
            len(lines),
        )
        job_if_count = sum(1 for line in lines[start + 1:stop] if line.startswith("    if:"))
        assert job_if_count == 1, f"legacy job {name} must have exactly one job-level if"


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
