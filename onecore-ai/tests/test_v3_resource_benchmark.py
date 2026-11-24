import json

import pytest

from onecore.v3.resource_benchmark import (
    _distribution,
    _manifest_bundle_fingerprint,
    _safe_relative,
    _unique_basename,
    _unique_suffix,
)


def test_artifact_member_selectors_require_one_exact_match():
    assert _unique_suffix(
        ["data/train.jsonl", "data/assets/a.png"], "data/train.jsonl"
    ) == "data/train.jsonl"
    assert _unique_basename(
        ["folder/onecore-v3-tokenizer.json", "folder/other.json"],
        "onecore-v3-tokenizer.json",
    ) == "folder/onecore-v3-tokenizer.json"
    with pytest.raises(ValueError, match="found 0"):
        _unique_suffix(["data/test.jsonl"], "data/train.jsonl")
    with pytest.raises(ValueError, match="found 2"):
        _unique_suffix(["a/data/train.jsonl", "b/data/train.jsonl"], "data/train.jsonl")


@pytest.mark.parametrize("value", ["", "../secret", "/absolute/file", "a/../b", r"a\\..\\b"])
def test_benchmark_rejects_unsafe_asset_paths(value):
    with pytest.raises(ValueError, match="unsafe V3 asset path"):
        _safe_relative(value)


def test_distribution_reports_p95_without_mutating_input():
    values = [9, 1, 5, 3]
    assert _distribution(values) == {
        "count": 4, "min": 1.0, "median": 4.0, "p95": 9.0, "max": 9.0,
    }
    assert values == [9, 1, 5, 3]
    assert _distribution([]) is None


def test_manifest_bundle_fingerprint_matches_serialized_identity(tmp_path):
    import hashlib

    manifests = {}
    for split in ("train", "validation", "test"):
        path = tmp_path / f"{split}.jsonl"
        path.write_text(json.dumps({
            "id": f"{split}-text", "split": split, "task": "text",
            "data_class": "external",
            "source_url": "https://example.org/dataset",
            "source_id": "dataset-v1", "source_revision": "a" * 40,
            "source_row_id_sha256": hashlib.sha256(split.encode()).hexdigest(),
            "text": "An externally sourced sentence long enough for testing.",
        }) + "\n", encoding="utf-8")
        manifests[split] = path
    gate = {
        "asset_hashes": {"raw/image.png": hashlib.sha256(b"image").hexdigest()},
        "coverage": {
            "train": {"text": 100, "tool": 100, "image": 100, "audio": 100, "video": 100},
            "validation": {"text": 10, "tool": 10, "image": 10, "audio": 10, "video": 10},
            "test": {"text": 10, "tool": 10, "image": 10, "audio": 10, "video": 10},
        },
    }
    digest, files = _manifest_bundle_fingerprint(manifests, gate)
    identity = {
        "format": "onecore-v3-validated-manifest-bundle-v1",
        "splits": files,
        "asset_sha256": gate["asset_hashes"],
        "coverage": gate["coverage"],
    }
    expected = hashlib.sha256(json.dumps(
        identity, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")).hexdigest()
    assert digest == expected


def test_tokenizer_artifact_filename_is_taken_from_its_own_evidence():
    from onecore.v3.resource_benchmark import _tokenizer_members

    names = [
        "onecore-v3-tokenizer-run605-vocab32000.json",
        "tokenizer-run-summary.json",
        "onecore-v3-tokenizer-run605-vocab32000.json.evidence.json",
    ]
    evidence = {"tokenizer_file": "onecore-v3-tokenizer-run605-vocab32000.json"}
    assert _tokenizer_members(names, evidence) == (
        "onecore-v3-tokenizer-run605-vocab32000.json",
        "onecore-v3-tokenizer-run605-vocab32000.json.evidence.json",
        "onecore-v3-tokenizer-run605-vocab32000.json",
    )
    with pytest.raises(ValueError, match="plain tokenizer JSON filename"):
        _tokenizer_members(names, {"tokenizer_file": "../tokenizer.json"})

def test_sequence_length_distributions_use_real_tokenizer_and_external_train_only(tmp_path):
    import hashlib

    from tokenizers import Tokenizer, models, pre_tokenizers

    from onecore.v3.resource_benchmark import _sequence_length_distributions

    tokenizer = Tokenizer(models.WordLevel(
        {"[UNK]": 0, "hello": 1, "world": 2, "prompt": 3, "reply": 4},
        unk_token="[UNK]",
    ))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer_path = tmp_path / "v3-tokenizer.json"
    tokenizer.save(str(tokenizer_path))

    def row(record_id, task, data_class, **payload):
        return {
            "id": record_id,
            "split": "train",
            "task": task,
            "data_class": data_class,
            "source_id": "pinned-dataset-v1",
            "source_revision": "a" * 40,
            "source_row_id_sha256": hashlib.sha256(record_id.encode()).hexdigest(),
            **payload,
        }

    rows = [
        row("text-1", "text", "external_staged", text="hello world"),
        row("tool-1", "tool", "external_reviewed", prompt="prompt", response="reply"),
        row("bootstrap-1", "text", "bootstrap", text="hello world"),
    ]
    manifest = tmp_path / "train.jsonl"
    manifest.write_text(
        "".join(json.dumps(item) + "\n" for item in rows),
        encoding="utf-8",
    )

    result = _sequence_length_distributions(manifest, tokenizer_path, batch_size=1)

    assert result["text"] == {
        "count": 1, "min": 2.0, "median": 2.0, "p95": 2.0, "max": 2.0,
    }
    assert result["tool"] == {
        "count": 1, "min": 2.0, "median": 2.0, "p95": 2.0, "max": 2.0,
    }


def test_sequence_length_distributions_reject_non_train_rows(tmp_path):
    from tokenizers import Tokenizer, models

    from onecore.v3.resource_benchmark import _sequence_length_distributions

    tokenizer = Tokenizer(models.WordLevel({"[UNK]": 0}, unk_token="[UNK]"))
    tokenizer_path = tmp_path / "v3-tokenizer.json"
    tokenizer.save(str(tokenizer_path))
    manifest = tmp_path / "train.jsonl"
    manifest.write_text(json.dumps({
        "id": "validation-text",
        "split": "validation",
        "task": "text",
        "data_class": "external",
        "text": "must not be profiled",
    }) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="only the V3 train manifest"):
        _sequence_length_distributions(manifest, tokenizer_path)
