"""Range-based extraction of small manifests from large GitHub artifacts.

Only the V2 JSONL manifests and acquisition report are fetched from the existing
corpus artifact. The 15.8 GB ZIP is never downloaded or expanded in full.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable

try:
    import requests
except ImportError:  # pragma: no cover - corpus-restore extra supplies requests
    requests = None

try:
    from remotezip import RemoteZip
except ImportError:  # optional outside the explicit corpus-restore workflow
    RemoteZip = None

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
    if requests is None or RemoteZip is None:
        raise RuntimeError(
            "range artifact extraction requires the optional dependency group: "
            "pip install -e 'onecore-ai[corpus-restore]'"
        )
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
        api_url, headers=headers, allow_redirects=False, stream=True, timeout=60
    )
    try:
        if response.status_code not in (301, 302, 303, 307, 308):
            raise RuntimeError(
                f"GitHub artifact endpoint did not return a signed redirect: HTTP {response.status_code}"
            )
        signed_url = response.headers.get("Location")
        if not signed_url:
            raise RuntimeError("GitHub artifact endpoint omitted the signed download Location header")
    finally:
        response.close()

    root = Path(output_root).resolve()
    data_root = root / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    temporary: list[Path] = []
    extracted: dict[str, str] = {}
    # GitHub's signed artifact blob accepts explicit byte ranges, but its
    # storage endpoint may ignore suffix ranges. Force RemoteZip to use HEAD
    # plus an explicit bytes=start-end request instead of bytes=-N.
    container_member: str | None = None
    container_layout = "flat-zip"
    with RemoteZip(signed_url, support_suffix_range=False) as archive:
        names = archive.namelist()
        tar_members = [name for name in names if PurePosixPath(name).name == "onecore-corpus.tar"]
        if len(tar_members) > 1:
            raise ValueError(f"expected at most one onecore-corpus.tar in artifact ZIP; found {len(tar_members)}")
        if tar_members:
            container_member = tar_members[0]
            info = archive.getinfo(container_member)
            if info.compress_type != zipfile.ZIP_STORED:
                raise RuntimeError(
                    "onecore-corpus.tar must be stored without ZIP compression for bounded range extraction"
                )
            container_layout = "stored-tar"
            staged: dict[str, Path] = {}
            try:
                with archive.open(container_member) as tar_stream:
                    with tarfile.open(fileobj=tar_stream, mode="r|") as tar_archive:
                        for member in tar_archive:
                            filename = member.name
                            if filename not in REQUIRED_MEMBERS:
                                continue
                            if not member.isfile() or member.issym() or member.islnk():
                                raise ValueError(f"required corpus member is not a regular file: {filename}")
                            if filename in staged:
                                raise ValueError(f"duplicate required corpus member in tar: {filename}")
                            source = tar_archive.extractfile(member)
                            if source is None:
                                raise ValueError(f"could not read required corpus member: {filename}")
                            temp = data_root / f".{filename}.partial"
                            temporary.append(temp)
                            with source, temp.open("wb") as target:
                                shutil.copyfileobj(source, target, length=8 * 1024 * 1024)
                            staged[filename] = temp
                            if len(staged) == len(REQUIRED_MEMBERS):
                                break
                missing = sorted(set(REQUIRED_MEMBERS) - set(staged))
                if missing:
                    raise ValueError(
                        "corpus tar is missing required manifest files: " + ", ".join(missing)
                    )
                for filename, temp in staged.items():
                    destination = data_root / filename
                    temp.replace(destination)
                    extracted[filename] = str(destination)
            except Exception:
                for temp in temporary:
                    temp.unlink(missing_ok=True)
                raise
        else:
            members = select_artifact_members(names)
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
        "container_layout": container_layout,
        "container_member": container_member,
    }



def select_v3_train_manifest_member(names: Iterable[str]) -> str:
    """Select exactly one V3 train manifest from a GitHub Actions artifact ZIP."""
    normalized = [str(name).replace("\\", "/") for name in names]
    matches = [
        name for name in normalized
        if name == "data/train.jsonl" or name.endswith("/data/train.jsonl")
    ]
    if len(matches) != 1:
        raise ValueError(
            "expected exactly one V3 data/train.jsonl in artifact ZIP; "
            f"found {len(matches)}"
        )
    return matches[0]


def extract_v3_train_manifest(
    repository_full_name: str,
    artifact_id: int,
    github_token: str,
    output_path: str | Path,
) -> dict[str, object]:
    """Range-extract only V3 data/train.jsonl; do not download its media archive."""
    target = Path(output_path).resolve()
    if target.exists():
        raise FileExistsError(f"refusing to overwrite existing V3 train manifest: {target}")

    if requests is None or RemoteZip is None:
        raise RuntimeError(
            "range artifact extraction requires the optional dependency group: "
            "pip install -e 'onecore-ai[corpus-restore]'"
        )
    if not github_token.strip():
        raise ValueError("GITHUB_TOKEN is required to read the V3 corpus artifact")
    if artifact_id < 1:
        raise ValueError("artifact_id must be positive")
    target.parent.mkdir(parents=True, exist_ok=True)

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
        api_url, headers=headers, allow_redirects=False, stream=True, timeout=60
    )
    try:
        if response.status_code not in (301, 302, 303, 307, 308):
            raise RuntimeError(
                "GitHub V3 artifact endpoint did not return a signed redirect: "
                f"HTTP {response.status_code}"
            )
        signed_url = response.headers.get("Location")
        if not signed_url:
            raise RuntimeError("GitHub V3 artifact endpoint omitted the signed download Location")
    finally:
        response.close()

    temporary: Path | None = None
    try:
        with RemoteZip(signed_url, support_suffix_range=False) as archive:
            member = select_v3_train_manifest_member(archive.namelist())
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{target.name}.", suffix=".partial", dir=target.parent
            )
            temporary = Path(temporary_name)
            with archive.open(member) as source, os.fdopen(descriptor, "wb") as output:
                shutil.copyfileobj(source, output, length=8 * 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
        if target.exists():
            raise FileExistsError(f"refusing to overwrite existing V3 train manifest: {target}")
        temporary.replace(target)
    except Exception:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        raise

    digest = hashlib.sha256()
    size_bytes = 0
    with target.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
            size_bytes += len(chunk)
    return {
        "path": str(target),
        "member": member,
        "artifact_id": artifact_id,
        "sha256": digest.hexdigest(),
        "size_bytes": size_bytes,
        "range_download": True,
        "full_archive_downloaded": False,
    }
