"""Range-based extraction of small manifests from large GitHub artifacts.

Only the V2 JSONL manifests and acquisition report are fetched from the existing
corpus artifact. The 15.8 GB ZIP is never downloaded or expanded in full.
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Iterable

import requests
from remotezip import RemoteZip

REQUIRED_MEMBERS = (
    "train.jsonl",
    "validation.jsonl",
    "test.jsonl",
    "acquisition-report.json",
)


def select_artifact_members(names: Iterable[str]) -> dict[str, str]:
    normalized = [str(name).replace("\\", "/") for name in names]
    selected: dict[str, str] = {}
    for filename in REQUIRED_MEMBERS:
        matches = [
            name for name in normalized
            if name == f"data/{filename}" or name.endswith(f"/data/{filename}")
        ]
        if len(matches) != 1:
            raise ValueError(
                f"expected exactly one data/{filename} in artifact ZIP; "
                f"found {len(matches)}"
            )
        selected[filename] = matches[0]
    return selected


def extract_v2_artifact_manifests(
    repository_full_name: str,
    artifact_id: int,
    github_token: str,
    output_root: str | Path,
) -> dict[str, object]:
    """Range-extract only three manifests and acquisition report from a GH artifact."""
    if not github_token.strip():
        raise ValueError("GITHUB_TOKEN is required to read the existing workflow artifact")
    if artifact_id < 1:
        raise ValueError("artifact_id must be positive")
    api_url = (
        f"https://api.github.com/repos/{repository_full_name}/actions/"
        f"artifacts/{artifact_id}/zip"
    )
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    response = requests.get(
        api_url, headers=headers, allow_redirects=True, stream=True, timeout=60
    )
    try:
        if response.status_code != 200:
            raise RuntimeError(
                f"GitHub artifact download URL resolution failed: HTTP {response.status_code}"
            )
        signed_url = response.url
    finally:
        response.close()

    root = Path(output_root).resolve()
    data_root = root / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    temporary: list[Path] = []
    extracted: dict[str, str] = {}
    with RemoteZip(signed_url) as archive:
        members = select_artifact_members(archive.namelist())
        try:
            for filename, member in members.items():
                destination = data_root / filename
                temp = data_root / f".{filename}.partial"
                temporary.append(temp)
                with archive.open(member) as source, temp.open("wb") as target:
                    shutil.copyfileobj(source, target, length=8 * 1024 * 1024)
                temp.replace(destination)
                extracted[filename] = str(destination)
        except Exception:
            for temp in temporary:
                temp.unlink(missing_ok=True)
            raise
    return {
        "data_root": str(data_root),
        "files": extracted,
        "artifact_id": artifact_id,
        "range_download": True,
        "full_archive_downloaded": False,
    }
