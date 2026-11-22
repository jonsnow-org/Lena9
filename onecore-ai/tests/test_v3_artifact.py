import pytest

from onecore.v3.artifact import REQUIRED_MEMBERS, select_artifact_members


def test_artifact_extractor_selects_only_required_manifest_members():
    names = [
        "onecore-ai/data/train.jsonl",
        "onecore-ai/data/validation.jsonl",
        "onecore-ai/data/test.jsonl",
        "onecore-ai/data/acquisition-report.json",
        "onecore-ai/data/assets/large-media.bin",
        "onecore-ai/run-state/train.jsonl",
    ]
    selected = select_artifact_members(names)
    assert set(selected) == set(REQUIRED_MEMBERS)
    assert selected["train.jsonl"] == "onecore-ai/data/train.jsonl"
    assert selected["acquisition-report.json"] == "onecore-ai/data/acquisition-report.json"


def test_artifact_extractor_rejects_missing_or_ambiguous_manifests():
    names = [
        "data/train.jsonl",
        "data/validation.jsonl",
        "data/test.jsonl",
        "data/acquisition-report.json",
        "other/data/train.jsonl",
    ]
    with pytest.raises(ValueError, match="exactly one"):
        select_artifact_members(names)



def test_artifact_extractor_uses_explicit_ranges_for_signed_blob_url(monkeypatch, tmp_path):
    import io

    import onecore.v3.artifact as artifact

    class RedirectResponse:
        status_code = 302
        headers = {"Location": "https://signed.example/artifact.zip"}

        def close(self):
            pass

    monkeypatch.setattr(artifact.requests, "get", lambda *args, **kwargs: RedirectResponse())
    calls = {}
    payloads = {
        "data/train.jsonl": b'{"id":"train"}\\n',
        "data/validation.jsonl": b'{"id":"validation"}\\n',
        "data/test.jsonl": b'{"id":"test"}\\n',
        "data/acquisition-report.json": b'{"source_revisions":{}}',
    }

    class FakeRemoteZip:
        def __init__(self, url, **kwargs):
            calls["url"] = url
            calls["kwargs"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def namelist(self):
            return list(payloads)

        def open(self, member):
            return io.BytesIO(payloads[member])

    monkeypatch.setattr(artifact, "RemoteZip", FakeRemoteZip)
    result = artifact.extract_v2_artifact_manifests(
        "jonsnow-org/Lena9", 14715699177, "test-token", tmp_path
    )

    assert calls["url"] == "https://signed.example/artifact.zip"
    assert calls["kwargs"]["support_suffix_range"] is False
    assert result["range_download"] is True
    assert result["full_archive_downloaded"] is False
    assert (tmp_path / "data" / "train.jsonl").read_bytes() == payloads["data/train.jsonl"]
    assert (tmp_path / "data" / "acquisition-report.json").read_bytes() == payloads["data/acquisition-report.json"]



def test_artifact_extractor_reads_manifests_from_stored_corpus_tar(monkeypatch, tmp_path):
    import io
    import tarfile
    import zipfile
    from types import SimpleNamespace

    import onecore.v3.artifact as artifact

    payloads = {
        "train.jsonl": b'{"id":"train"}\n',
        "validation.jsonl": b'{"id":"validation"}\n',
        "test.jsonl": b'{"id":"test"}\n',
        "acquisition-report.json": b'{"source_revisions":{}}',
    }
    tar_buffer = io.BytesIO()
    with tarfile.open(fileobj=tar_buffer, mode="w") as tar:
        for name, payload in payloads.items():
            info = tarfile.TarInfo(name)
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
    tar_bytes = tar_buffer.getvalue()

    class RedirectResponse:
        status_code = 302
        headers = {"Location": "https://signed.example/artifact.zip"}

        def close(self):
            pass

    monkeypatch.setattr(artifact.requests, "get", lambda *args, **kwargs: RedirectResponse())
    calls = {}

    class FakeRemoteZip:
        def __init__(self, url, **kwargs):
            calls["url"] = url
            calls["kwargs"] = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def namelist(self):
            return ["onecore-corpus.tar"]

        def getinfo(self, member):
            assert member == "onecore-corpus.tar"
            return SimpleNamespace(compress_type=zipfile.ZIP_STORED)

        def open(self, member):
            assert member == "onecore-corpus.tar"
            return io.BytesIO(tar_bytes)

    monkeypatch.setattr(artifact, "RemoteZip", FakeRemoteZip)
    result = artifact.extract_v2_artifact_manifests(
        "jonsnow-org/Lena9", 14715699177, "test-token", tmp_path
    )

    assert calls["url"] == "https://signed.example/artifact.zip"
    assert calls["kwargs"]["support_suffix_range"] is False
    assert result["container_layout"] == "stored-tar"
    assert result["container_member"] == "onecore-corpus.tar"
    assert result["range_download"] is True
    assert result["full_archive_downloaded"] is False
    for name, payload in payloads.items():
        assert (tmp_path / "data" / name).read_bytes() == payload



def test_artifact_manifest_helpers_import_without_optional_range_dependency():
    # The standard dev extra intentionally does not install RemoteZip; helper
    # functions and converter fixture tests must remain usable without corpus-restore.
    from onecore.v3 import artifact

    assert artifact.REQUIRED_MEMBERS == (
        "train.jsonl", "validation.jsonl", "test.jsonl", "acquisition-report.json"
    )
    assert callable(artifact.select_artifact_members)


def test_artifact_range_extraction_fails_fast_without_optional_dependency(monkeypatch, tmp_path):
    import onecore.v3.artifact as artifact

    monkeypatch.setattr(artifact, "RemoteZip", None)
    with pytest.raises(RuntimeError, match="corpus-restore"):
        artifact.extract_v2_artifact_manifests(
            "jonsnow-org/Lena9", 14715699177, "test-token", tmp_path
        )
