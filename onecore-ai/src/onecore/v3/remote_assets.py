"""Range-based access to the immutable V3 GitHub corpus artifact.

Only three small JSONL manifests are extracted up front. Media files are
fetched by ZIP byte range on demand, verified against the conversion report,
then deleted after each micro-batch is materialized.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

try:
    import requests
except ImportError:  # pragma: no cover - supplied by corpus-restore extra
    requests = None

try:
    from remotezip import RemoteZip
except ImportError:  # pragma: no cover - supplied by corpus-restore extra
    RemoteZip = None


def _signed_artifact_url(repository_full_name: str, artifact_id: int, token: str) -> str:
    if requests is None or RemoteZip is None:
        raise RuntimeError("remote V3 training requires onecore-ai[corpus-restore]")
    if not token.strip():
        raise ValueError("GITHUB_TOKEN is required for immutable V3 artifact access")
    if isinstance(artifact_id, bool) or not isinstance(artifact_id, int) or artifact_id < 1:
        raise ValueError("corpus artifact ID must be a positive integer")
    url = (
        f"https://api.github.com/repos/{repository_full_name}/actions/"
        f"artifacts/{artifact_id}/zip"
    )
    response = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        allow_redirects=False,
        stream=True,
        timeout=60,
    )
    try:
        if response.status_code not in (301, 302, 303, 307, 308):
            raise RuntimeError(
                f"GitHub corpus artifact did not return a signed redirect: HTTP {response.status_code}"
            )
        signed = response.headers.get("Location")
        if not signed:
            raise RuntimeError("GitHub corpus artifact response omitted its signed URL")
        return signed
    finally:
        response.close()


def _safe_relative(value: str) -> str:
    raw = str(value or "").replace("\\", "/")
    path = PurePosixPath(raw)
    if not raw or path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"unsafe V3 corpus asset path: {raw!r}")
    return path.as_posix()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_v3_manifest_bundle(
    repository_full_name: str,
    artifact_id: int,
    github_token: str,
    output_root: str | Path,
) -> dict[str, str]:
    """Range-extract only the three V3 manifests; never download the 24 GB archive."""
    root = Path(output_root).resolve()
    data_root = root / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    extracted: dict[str, str] = {}
    signed_url = _signed_artifact_url(repository_full_name, artifact_id, github_token)
    with RemoteZip(signed_url, support_suffix_range=False) as archive:
        names = [str(name).replace("\\", "/") for name in archive.namelist()]
        for split in ("train", "validation", "test"):
            suffix = f"data/{split}.jsonl"
            matches = [name for name in names if name == suffix or name.endswith("/" + suffix)]
            if len(matches) != 1:
                raise ValueError(
                    f"expected exactly one {suffix} in V3 artifact; found {len(matches)}"
                )
            destination = data_root / f"{split}.jsonl"
            if destination.exists():
                raise FileExistsError(f"refusing to overwrite extracted V3 manifest: {destination}")
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{destination.name}.", suffix=".partial", dir=data_root
            )
            temporary = Path(temporary_name)
            try:
                with archive.open(matches[0]) as source, os.fdopen(descriptor, "wb") as target:
                    shutil.copyfileobj(source, target, length=8 * 1024 * 1024)
                    target.flush()
                    os.fsync(target.fileno())
                temporary.replace(destination)
            except Exception:
                temporary.unlink(missing_ok=True)
                raise
            extracted[split] = str(destination)
    return extracted


class GitHubArtifactAssetProvider:
    """Extract and SHA-verify one asset at a time from a pinned GitHub ZIP artifact."""

    def __init__(
        self,
        repository_full_name: str,
        artifact_id: int,
        github_token: str,
        assets_root: str | Path,
    ) -> None:
        self.assets_root = Path(assets_root).resolve()
        self.assets_root.mkdir(parents=True, exist_ok=True)
        signed_url = _signed_artifact_url(repository_full_name, artifact_id, github_token)
        self.archive = RemoteZip(signed_url, support_suffix_range=False)
        self.members = [str(name).replace("\\", "/") for name in self.archive.namelist()]
        self.closed = False

    def __call__(self, relative: str, destination: Path, expected_sha256: str) -> None:
        if self.closed:
            raise RuntimeError("V3 remote asset provider is closed")
        safe = _safe_relative(relative)
        expected = str(expected_sha256).lower()
        if len(expected) != 64 or any(char not in "0123456789abcdef" for char in expected):
            raise ValueError(f"invalid trusted V3 asset SHA-256: {safe}")
        target = destination.resolve()
        try:
            target.relative_to(self.assets_root)
        except ValueError as exc:
            raise ValueError(f"V3 asset target escapes cache root: {safe}") from exc
        if target.is_file():
            if _sha256_file(target) != expected:
                raise ValueError(f"cached V3 asset hash mismatch: {safe}")
            return
        suffix = f"data/assets/{safe}"
        matches = [name for name in self.members if name == suffix or name.endswith("/" + suffix)]
        if len(matches) != 1:
            raise ValueError(f"expected exactly one immutable corpus member for {safe}; found {len(matches)}")
        target.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{target.name}.", suffix=".partial", dir=target.parent
        )
        temporary = Path(temporary_name)
        try:
            with self.archive.open(matches[0]) as source, os.fdopen(descriptor, "wb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            if _sha256_file(temporary) != expected:
                raise ValueError(f"downloaded V3 corpus asset SHA-256 mismatch: {safe}")
            temporary.replace(target)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise

    def release(self, relative: str, destination: Path) -> None:
        safe = _safe_relative(relative)
        target = destination.resolve()
        try:
            target.relative_to(self.assets_root)
        except ValueError as exc:
            raise ValueError(f"V3 asset release target escapes cache root: {safe}") from exc
        target.unlink(missing_ok=True)

    def close(self) -> None:
        if not self.closed:
            self.closed = True
            self.archive.close()
