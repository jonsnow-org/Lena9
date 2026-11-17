from __future__ import annotations

import io
import tarfile
from pathlib import Path

import pytest

from onecore.artifacts import pack_corpus, restore_corpus


def _write_corpus(root: Path) -> None:
    data = root / "data"
    data.mkdir(parents=True)
    for name in ("train.jsonl", "validation.jsonl", "test.jsonl"):
        (data / name).write_text('{"id":"sample"}\n', encoding="utf-8")
    (data / "acquisition-report.json").write_text('{"acquisition_complete": false}\n', encoding="utf-8")
    for name in ("assets", "metadata", "pending", "resume-cache"):
        (data / name).mkdir()
    (data / "assets" / "image.bin").write_bytes(b"image-payload")
    (data / "metadata" / "source.jsonl").write_text('{"source":"demo"}\n', encoding="utf-8")
    (data / "pending" / "deferred.jsonl").write_text('{"id":"later"}\n', encoding="utf-8")
    (data / "resume-cache" / "source-progress.json").write_text('{"demo":{}}', encoding="utf-8")


def test_pack_and_restore_round_trip_all_corpus_state(tmp_path: Path) -> None:
    source = tmp_path / "source"
    _write_corpus(source)
    archive_path = tmp_path / "onecore-corpus.tar"
    packed = pack_corpus(source, archive_path)

    artifact_dir = tmp_path / "artifact"
    artifact_dir.mkdir()
    (artifact_dir / "onecore-corpus.tar").write_bytes(archive_path.read_bytes())
    restored = tmp_path / "restored"
    result = restore_corpus(restored, artifact_dir)

    assert packed["bytes"] > 0
    assert result["layout"] == "tar"
    assert (restored / "data" / "train.jsonl").is_file()
    assert (restored / "data" / "assets" / "image.bin").read_bytes() == b"image-payload"
    assert (restored / "data" / "metadata" / "source.jsonl").is_file()
    assert (restored / "data" / "pending" / "deferred.jsonl").is_file()
    assert (restored / "data" / "resume-cache" / "source-progress.json").is_file()


def test_restore_accepts_legacy_directory_shaped_artifact(tmp_path: Path) -> None:
    artifact = tmp_path / "legacy"
    _write_corpus(artifact)
    restored = tmp_path / "restored"

    result = restore_corpus(restored, artifact)

    assert result["layout"] == "legacy-directory"
    assert (restored / "data" / "train.jsonl").read_text(encoding="utf-8").startswith("{")
    assert (restored / "data" / "assets" / "image.bin").read_bytes() == b"image-payload"


def test_restore_rejects_path_traversal_in_tar_archive(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact"
    artifact.mkdir()
    archive_path = artifact / "onecore-corpus.tar"
    with tarfile.open(archive_path, "w") as archive:
        payload = b"do-not-write-outside"
        info = tarfile.TarInfo("../escape.txt")
        info.size = len(payload)
        archive.addfile(info, io.BytesIO(payload))

    with pytest.raises(ValueError, match="unsafe corpus archive path"):
        restore_corpus(tmp_path / "restored", artifact)
    assert not (tmp_path / "escape.txt").exists()


def test_pack_rejects_symlinked_corpus_assets(tmp_path: Path) -> None:
    source = tmp_path / "source"
    _write_corpus(source)
    asset = source / "data" / "assets" / "image.bin"
    target = source / "outside.bin"
    target.write_bytes(b"outside")
    asset.unlink()
    asset.symlink_to(target)

    with pytest.raises(ValueError, match="symlinks are not supported"):
        pack_corpus(source, tmp_path / "onecore-corpus.tar")
