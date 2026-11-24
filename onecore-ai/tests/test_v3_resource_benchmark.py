import json

import pytest

import torch

from onecore.v3.resource_benchmark import (
    _build_joint_plan,
    _distribution,
    _manifest_bundle_fingerprint,
    _preallocate_adamw_state,
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
        row("tool-1", "tool_use", "external_reviewed", prompt="prompt", response="reply"),
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


def test_joint_plan_contains_one_bounded_micro_batch_for_each_family(tmp_path):
    from tokenizers import Tokenizer, models, pre_tokenizers

    tokenizer = Tokenizer(models.WordLevel(
        {"[UNK]": 0, "one": 1, "two": 2, "three": 3, "four": 4},
        unk_token="[UNK]",
    ))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer_path = tmp_path / "joint-tokenizer.json"
    tokenizer.save(str(tokenizer_path))

    selected = {
        "text": {"record_id": "text-1", "text": "one two three four"},
        "tool": {"record_id": "tool-1", "text": "one two three"},
        "image": {"record_id": "image-1", "local_paths": ["image.png"]},
        "audio": {
            "record_id": "audio-1", "local_paths": ["audio-24k.wav"],
            "duration_seconds": 3.5,
        },
        "video": {
            "record_id": "video-1", "local_paths": ["frame-0.png", "frame-1.png", "frame-2.png"],
            "timestamps": [0.0, 0.5, 1.0], "timestamp_unit": "seconds",
        },
    }

    plan = _build_joint_plan(
        selected, tokenizer_path, max_audio_seconds=2.0, max_video_frames=2,
    )

    assert plan["micro_batch_order"] == ["text", "tool", "image", "audio", "video"]
    assert set(plan["families"]) == set(plan["micro_batch_order"])
    assert plan["families"]["text"]["target_tokens"] == 4
    assert plan["families"]["tool"]["target_tokens"] == 3
    assert plan["families"]["audio"]["target_seconds"] == 2.0
    assert plan["families"]["video"]["frame_paths"] == ["frame-0.png", "frame-1.png"]
    assert plan["families"]["video"]["timestamps"] == [0.0, 0.5]


def test_adamw_state_preallocation_measures_moments_without_updating_weights():
    model = torch.nn.Sequential(torch.nn.Linear(3, 4), torch.nn.Linear(4, 2))
    before = [parameter.detach().clone() for parameter in model.parameters()]
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.0, weight_decay=0.0)

    report = _preallocate_adamw_state(optimizer)

    parameters = list(model.parameters())
    expected_parameter_bytes = sum(
        parameter.numel() * parameter.element_size() for parameter in parameters
    )
    expected_state_bytes = sum(
        2 * parameter.numel() * parameter.element_size() + torch.tensor(0.0).element_size()
        for parameter in parameters
    )
    assert report["parameter_count"] == sum(parameter.numel() for parameter in parameters)
    assert report["parameter_tensor_count"] == len(parameters)
    assert report["parameter_bytes"] == expected_parameter_bytes
    assert report["state_parameter_count"] == len(parameters)
    assert report["state_tensor_count"] == 3 * len(parameters)
    assert report["optimizer_state_bytes"] == expected_state_bytes

    for parameter, original in zip(parameters, before, strict=True):
        state = optimizer.state[parameter]
        assert set(state) == {"step", "exp_avg", "exp_avg_sq"}
        assert state["step"].shape == torch.Size([])
        assert state["step"].item() == 0.0
        assert state["exp_avg"].shape == parameter.shape
        assert state["exp_avg_sq"].shape == parameter.shape
        assert torch.count_nonzero(state["exp_avg"]).item() == 0
        assert torch.count_nonzero(state["exp_avg_sq"]).item() == 0
        assert torch.equal(parameter, original)


def test_adamw_state_preallocation_rejects_non_adamw_optimizer():
    model = torch.nn.Linear(2, 2)
    optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
    with pytest.raises(TypeError, match="requires torch.optim.AdamW"):
        _preallocate_adamw_state(optimizer)
