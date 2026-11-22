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
