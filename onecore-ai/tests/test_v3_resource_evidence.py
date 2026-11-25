from copy import deepcopy

import pytest

from onecore.v3 import resource_evidence


def _fixture():
    run = {
        "id": 123456,
        "workflow_id": resource_evidence.EXPECTED_WORKFLOW_ID,
        "path": resource_evidence.EXPECTED_WORKFLOW_PATH,
        "event": "workflow_dispatch",
        "head_branch": resource_evidence.EXPECTED_BRANCH,
        "head_sha": "a" * 40,
        "status": "completed",
        "conclusion": "success",
    }
    jobs = [
        {"id": 1, "name": resource_evidence.VERIFY_JOB_NAME, "status": "completed", "conclusion": "success"},
        {"id": 2, "name": resource_evidence.BENCHMARK_JOB_NAME, "status": "completed", "conclusion": "success"},
    ]
    artifacts = [{
        "id": 987,
        "name": "onecore-v3-resource-benchmark-123456",
        "size_in_bytes": 4096,
        "digest": "sha256:" + "b" * 64,
        "expired": False,
        "workflow_run": {"id": 123456},
    }]
    return {"run": run, "jobs": jobs, "artifacts": artifacts}


def _install_api(monkeypatch, payload):
    repo = "jonsnow-org/Lena9"
    base = f"{resource_evidence.API_ROOT}/{repo}/actions/runs/123456"

    def fake_get(url, token):
        assert token == "read-token"
        if url == base:
            return deepcopy(payload["run"])
        if url == base + "/jobs?per_page=100":
            return {"jobs": deepcopy(payload["jobs"])}
        if url == base + "/artifacts?per_page=100":
            return {"artifacts": deepcopy(payload["artifacts"])}
        raise AssertionError(f"unexpected GitHub API URL: {url}")

    monkeypatch.setattr(resource_evidence, "_get_json", fake_get)


def test_resource_evidence_accepts_only_a_successful_manual_v3_benchmark(monkeypatch):
    payload = _fixture()
    _install_api(monkeypatch, payload)
    result = resource_evidence.verify_resource_benchmark_artifact(
        "jonsnow-org/Lena9", "123456", "read-token"
    )
    assert result["run_id"] == 123456
    assert result["head_sha"] == "a" * 40
    assert result["artifact_id"] == 987
    assert result["artifact_name"] == "onecore-v3-resource-benchmark-123456"
    assert result["artifact_digest"] == "sha256:" + "b" * 64
    assert result["verify_job_id"] == 1
    assert result["benchmark_job_id"] == 2


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("workflow_id", 999, "workflow_id"),
        ("path", ".github/workflows/other.yml", "path"),
        ("event", "push", "event"),
        ("head_branch", "main", "head_branch"),
        ("status", "in_progress", "status"),
        ("conclusion", "failure", "conclusion"),
        ("head_sha", "not-a-commit", "commit SHA"),
    ],
)
def test_resource_evidence_rejects_wrong_run_identity(monkeypatch, field, value, message):
    payload = _fixture()
    payload["run"][field] = value
    _install_api(monkeypatch, payload)
    with pytest.raises(ValueError, match=message):
        resource_evidence.verify_resource_benchmark_artifact(
            "jonsnow-org/Lena9", "123456", "read-token"
        )


@pytest.mark.parametrize(
    ("job_index", "status", "conclusion"),
    [(0, "completed", "failure"), (1, "completed", "skipped"), (1, "in_progress", None)],
)
def test_resource_evidence_rejects_failed_or_skipped_jobs(monkeypatch, job_index, status, conclusion):
    payload = _fixture()
    payload["jobs"][job_index]["status"] = status
    payload["jobs"][job_index]["conclusion"] = conclusion
    _install_api(monkeypatch, payload)
    with pytest.raises(ValueError, match="did not complete successfully"):
        resource_evidence.verify_resource_benchmark_artifact(
            "jonsnow-org/Lena9", "123456", "read-token"
        )


@pytest.mark.parametrize("artifacts", [[], [
    {
        "id": 987, "name": "onecore-v3-resource-benchmark-123456",
        "size_in_bytes": 4096, "digest": "sha256:" + "b" * 64,
        "expired": True, "workflow_run": {"id": 123456},
    },
], [
    {
        "id": 987, "name": "onecore-v3-resource-benchmark-123456",
        "size_in_bytes": 4096, "digest": "not-a-digest",
        "expired": False, "workflow_run": {"id": 123456},
    },
], [
    {
        "id": 987, "name": "onecore-v3-resource-benchmark-123456",
        "size_in_bytes": 4096, "digest": "sha256:" + "b" * 64,
        "expired": False, "workflow_run": {"id": 999},
    },
]])
def test_resource_evidence_rejects_missing_expired_or_unbound_artifacts(monkeypatch, artifacts):
    payload = _fixture()
    payload["artifacts"] = artifacts
    _install_api(monkeypatch, payload)
    with pytest.raises(ValueError):
        resource_evidence.verify_resource_benchmark_artifact(
            "jonsnow-org/Lena9", "123456", "read-token"
        )


def test_resource_evidence_rejects_invalid_repository_run_id_and_token():
    with pytest.raises(ValueError, match="owner/name"):
        resource_evidence.verify_resource_benchmark_artifact("../Lena9", "123456", "read-token")
    with pytest.raises(ValueError, match="positive integer"):
        resource_evidence.verify_resource_benchmark_artifact("jonsnow-org/Lena9", "12x", "read-token")
    with pytest.raises(ValueError, match="token"):
        resource_evidence.verify_resource_benchmark_artifact("jonsnow-org/Lena9", "123456", "")
