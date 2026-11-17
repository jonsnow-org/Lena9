"""Safe, stack-bounded transport for OneCore's resumable corpus artifacts.

GitHub's artifact globber can overflow while walking a large tree of media
assets. We package the corpus as one tar file, while still accepting the
older directory-shaped artifacts for backward compatibility.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import tarfile
from pathlib import Path, PurePosixPath
from typing import Iterable

DATA_FILES = (
    "train.jsonl",
    "validation.jsonl",
    "test.jsonl",
    "acquisition-report.json",
)
DATA_DIRECTORIES = ("assets", "metadata", "pending", "resume-cache")
DATA_ITEMS = DATA_FILES + DATA_DIRECTORIES


def _iter_data_entries(data_root: Path) -> Iterable[tuple[Path, str]]:
    """Yield corpus entries iteratively, rejecting links and special files."""
    for item in DATA_ITEMS:
        top = data_root / item
        if not top.exists():
            if item in DATA_DIRECTORIES:
                top.mkdir(parents=True, exist_ok=True)
            else:
                raise FileNotFoundError(f"required corpus file is missing: {top}")
        if top.is_symlink():
            raise ValueError(f"corpus symlinks are not supported: {top}")

        if top.is_file():
            yield top, item
            continue
        if not top.is_dir():
            raise ValueError(f"unsupported corpus entry type: {top}")

        yield top, item
        for current, dirnames, filenames in os.walk(top, topdown=True, followlinks=False):
            current_path = Path(current)
            dirnames.sort()
            filenames.sort()
            for dirname in list(dirnames):
                path = current_path / dirname
                if path.is_symlink():
                    raise ValueError(f"corpus symlinks are not supported: {path}")
                if not path.is_dir():
                    raise ValueError(f"unsupported corpus directory entry: {path}")
                yield path, path.relative_to(data_root).as_posix()
            for filename in filenames:
                path = current_path / filename
                if path.is_symlink() or not path.is_file():
                    raise ValueError(f"unsupported corpus file entry: {path}")
                yield path, path.relative_to(data_root).as_posix()


def pack_corpus(project_root: str | Path, output_path: str | Path) -> dict[str, object]:
    """Pack all manifests, assets and resumable caches into one uncompressed tar."""
    project = Path(project_root).resolve()
    data_root = project / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    output = Path(output_path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output == data_root or data_root in output.parents:
        raise ValueError("corpus archive must be written outside onecore-ai/data")

    entries = list(_iter_data_entries(data_root))
    if not entries:
        raise ValueError("corpus archive has no entries")

    with tarfile.open(output, mode="w", format=tarfile.PAX_FORMAT) as archive:
        for source, relative in entries:
            archive.add(source, arcname=relative, recursive=False)

    digest = hashlib.sha256()
    with output.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "archive": str(output),
        "bytes": output.stat().st_size,
        "entries": len(entries),
        "sha256": digest.hexdigest(),
    }


def _safe_members(archive: tarfile.TarFile, data_root: Path) -> list[tarfile.TarInfo]:
    members = archive.getmembers()
    allowed_roots = set(DATA_ITEMS)
    resolved_root = data_root.resolve()
    for member in members:
        name = member.name
        relative = PurePosixPath(name)
        if (
            not name
            or "\x00" in name
            or "\\" in name
            or relative.is_absolute()
            or not relative.parts
            or any(part in {"", ".", ".."} for part in relative.parts)
            or relative.parts[0] not in allowed_roots
        ):
            raise ValueError(f"unsafe corpus archive path: {name!r}")
        if member.issym() or member.islnk() or member.isdev() or member.isfifo():
            raise ValueError(f"unsupported link or special archive entry: {name!r}")
        if not (member.isdir() or member.isfile()):
            raise ValueError(f"unsupported archive entry type: {name!r}")
        destination = data_root.joinpath(*relative.parts).resolve()
        if destination != resolved_root and resolved_root not in destination.parents:
            raise ValueError(f"corpus archive entry escapes the data directory: {name!r}")
    return members


def _copy_legacy_tree(source_root: Path, data_root: Path) -> None:
    """Restore the former upload-artifact layout without following symlinks."""
    for item in DATA_ITEMS:
        source = source_root / item
        if not source.exists():
            continue
        if source.is_symlink():
            raise ValueError(f"legacy corpus contains an unsupported symlink: {source}")
        if source.is_dir():
            for current, dirnames, filenames in os.walk(source, followlinks=False):
                current_path = Path(current)
                for name in [*dirnames, *filenames]:
                    candidate = current_path / name
                    if candidate.is_symlink():
                        raise ValueError(f"legacy corpus contains an unsupported symlink: {candidate}")
            shutil.copytree(source, data_root / item, dirs_exist_ok=True)
        elif source.is_file():
            shutil.copy2(source, data_root / item)
        else:
            raise ValueError(f"unsupported legacy corpus entry: {source}")


def restore_corpus(
    project_root: str | Path, artifact_directory: str | Path
) -> dict[str, object]:
    """Restore a tar-shaped artifact or the original directory-shaped artifact."""
    project = Path(project_root).resolve()
    data_root = project / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    source_root = Path(artifact_directory).resolve()
    if not source_root.is_dir():
        raise NotADirectoryError(f"corpus artifact directory does not exist: {source_root}")

    archives = sorted(path for path in source_root.rglob("*.tar") if path.is_file())
    if len(archives) > 1:
        raise ValueError(f"expected one corpus tar archive, found {len(archives)}")
    if archives:
        archive_path = archives[0]
        with tarfile.open(archive_path, mode="r:") as archive:
            members = _safe_members(archive, data_root)
            archive.extractall(path=data_root, members=members)
        layout = "tar"
        entry_count = len(members)
    else:
        _copy_legacy_tree(source_root, data_root)
        layout = "legacy-directory"
        entry_count = sum(1 for item in DATA_ITEMS if (source_root / item).exists())

    missing = [name for name in DATA_FILES if not (data_root / name).is_file()]
    if missing:
        raise FileNotFoundError(
            "restored corpus is incomplete; missing required files: " + ", ".join(missing)
        )
    return {"layout": layout, "entries": entry_count, "data_root": str(data_root)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Package and restore OneCore corpus artifacts")
    commands = parser.add_subparsers(dest="command", required=True)

    pack_parser = commands.add_parser("pack", help="pack the current corpus into one tar file")
    pack_parser.add_argument("--root", required=True, help="OneCore project root")
    pack_parser.add_argument("--output", required=True, help="destination tar file")

    restore_parser = commands.add_parser("restore", help="restore a downloaded corpus artifact")
    restore_parser.add_argument("--root", required=True, help="OneCore project root")
    restore_parser.add_argument("--artifact-dir", required=True, help="download-artifact destination")

    args = parser.parse_args()
    if args.command == "pack":
        result = pack_corpus(args.root, args.output)
    else:
        result = restore_corpus(args.root, args.artifact_dir)
    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
