"""Fail-closed provenance check for a manual OneCore V3 CPU benchmark artifact."""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

API_ROOT = "https://api.github.com/repos"
EXPECTED_WORKFLOW_ID = 419034892
EXPECTED_WORKFLOW_PATH = ".github/workflows/onecore-ci.yml"
EXPECTED_BRANCH = "research/onecore-v3-implementation"
VERIFY_JOB_NAME = "Verify OneCore isolation, architecture, and tests"
BENCHMARK_JOB_NAME = "Measure V3 CPU memory and throughput from existing artifacts"
ARTIFACT_PREFIX = "onecore-v3-resource-benchmark-"


def _get_json(url: str, token: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"GitHub API returned a non-object payload for {url}")
    return payload


def _successful_job(jobs: list[dict[str, Any]], name: str) -> dict[str, Any]:
    matches = [job for job in jobs if job.get("name") == name]
    if len(matches) != 1:
        raise ValueError(f"resource benchmark run must contain exactly one {name!r} job")
    job = matches[0]
    if job.get("status") != "completed" or job.get("conclusion") != "success":
        raise ValueError(f"resource benchmark job did not complete successfully: {name}")
    return job


def verify_resource_benchmark_artifact(repo: str, run_id: str | int, token: str) -> dict[str, Any]:
    """Verify the source run, both required jobs, and its immutable report artifact."""
    parts = repo.split("/") if isinstance(repo, str) else []
    if (
        len(parts) != 2
        or any(part in {"", ".", ".."} for part in parts)
        or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo)
    ):
        raise ValueError("repository must be an owner/name pair")
    if not isinstance(token, str) or not token.strip():
        raise ValueError("a GitHub Actions read token is required")
    if isinstance(run_id, bool) or not re.fullmatch(r"[0-9]+", str(run_id)):
        raise ValueError("resource benchmark run id must be a positive integer")
    numeric_run_id = int(run_id)
    if numeric_run_id <= 0:
        raise ValueError("resource benchmark run id must be a positive integer")

    run_url = f"{API_ROOT}/{repo}/actions/runs/{numeric_run_id}"
    run = _get_json(run_url, token)
    if run.get("id") != numeric_run_id:
        raise ValueError("GitHub returned a different workflow run id")
    expected_run_fields = {
        "workflow_id": EXPECTED_WORKFLOW_ID,
        "path": EXPECTED_WORKFLOW_PATH,
        "event": "workflow_dispatch",
        "head_branch": EXPECTED_BRANCH,
        "status": "completed",
        "conclusion": "success",
    }
    for field, expected in expected_run_fields.items():
        if run.get(field) != expected:
            raise ValueError(f"resource benchmark run has an invalid {field}: {run.get(field)!r}")

    head_sha = run.get("head_sha")
    if not isinstance(head_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", head_sha):
        raise ValueError("resource benchmark run is missing a valid V3 commit SHA")

    jobs_url = f"{API_ROOT}/{repo}/actions/runs/{numeric_run_id}/jobs?per_page=100"
    jobs_payload = _get_json(jobs_url, token)
    jobs = jobs_payload.get("jobs")
    if not isinstance(jobs, list):
        raise ValueError("GitHub did not return the benchmark run's job list")
    verify_job = _successful_job(jobs, VERIFY_JOB_NAME)
    benchmark_job = _successful_job(jobs, BENCHMARK_JOB_NAME)

    artifacts_url = f"{API_ROOT}/{repo}/actions/runs/{numeric_run_id}/artifacts?per_page=100"
    artifacts_payload = _get_json(artifacts_url, token)
    artifacts = artifacts_payload.get("artifacts")
    if not isinstance(artifacts, list):
        raise ValueError("GitHub did not return the benchmark run's artifact list")
    expected_name = f"{ARTIFACT_PREFIX}{numeric_run_id}"
    matches = [artifact for artifact in artifacts if artifact.get("name") == expected_name]
    if len(matches) != 1:
        raise ValueError(f"resource benchmark run must publish exactly one {expected_name!r} artifact")
    artifact = matches[0]
    if artifact.get("expired") is not False:
        raise ValueError("resource benchmark artifact is expired or its expiry state is unknown")
    artifact_id = artifact.get("id")
    size = artifact.get("size_in_bytes")
    digest = artifact.get("digest")
    workflow_run = artifact.get("workflow_run")
    if isinstance(artifact_id, bool) or not isinstance(artifact_id, int) or artifact_id <= 0:
        raise ValueError("resource benchmark artifact id is invalid")
    if isinstance(size, bool) or not isinstance(size, int) or size <= 0:
        raise ValueError("resource benchmark artifact size is invalid")
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise ValueError("resource benchmark artifact does not expose a valid SHA-256 digest")
    if not isinstance(workflow_run, dict) or workflow_run.get("id") != numeric_run_id:
        raise ValueError("resource benchmark artifact is not owned by the selected workflow run")

    return {
        "format_version": 1,
        "repository": repo,
        "run_id": numeric_run_id,
        "workflow_id": EXPECTED_WORKFLOW_ID,
        "workflow_path": EXPECTED_WORKFLOW_PATH,
        "event": "workflow_dispatch",
        "run_status": "completed",
        "run_conclusion": "success",
        "head_branch": EXPECTED_BRANCH,
        "head_sha": head_sha,
        "verify_job_id": verify_job.get("id"),
        "benchmark_job_id": benchmark_job.get("id"),
        "artifact_id": artifact_id,
        "artifact_name": expected_name,
        "artifact_size_bytes": size,
        "artifact_digest": digest,
        "artifact_expired": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify a manual OneCore V3 CPU benchmark artifact")
    parser.add_argument("--repo", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    metadata = verify_resource_benchmark_artifact(args.repo, args.run_id, token or "")
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as stream:
            stream.write(f"artifact_name={metadata['artifact_name']}\n")
            stream.write(f"artifact_id={metadata['artifact_id']}\n")
            stream.write(f"artifact_digest={metadata['artifact_digest']}\n")
            stream.write(f"artifact_size_bytes={metadata['artifact_size_bytes']}\n")
            stream.write(f"benchmark_head_sha={metadata['head_sha']}\n")
    print(json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
