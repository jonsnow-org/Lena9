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
