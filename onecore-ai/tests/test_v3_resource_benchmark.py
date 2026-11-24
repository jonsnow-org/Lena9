import json

import pytest

import torch

from onecore.v3.resource_benchmark import (
    _build_joint_plan,
    _distribution,
    _joint_worker,
    _manifest_bundle_fingerprint,
    _objective_batch_for_family,
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


def test_objective_batch_builder_matches_each_v3_family_contract():
    from types import SimpleNamespace

    config = SimpleNamespace(audio_sample_rate=24_000)
    text_ids = torch.tensor([[1, 2, 3]])
    tool_ids = torch.tensor([[3, 2, 1]])
    images = torch.rand(1, 3, 8, 8)
    waveform = torch.rand(1, 2, 24)
    frames = torch.rand(1, 2, 3, 8, 8)
    timestamps = torch.tensor([[0.0, 0.04]])

    assert _objective_batch_for_family("text", text_ids, config, {})["text"]["input_ids"] is text_ids
    assert _objective_batch_for_family("tool", tool_ids, config, {})["tool"]["input_ids"] is tool_ids
    assert _objective_batch_for_family("image", images, config, {})["image"]["images"] is images
    audio_batch = _objective_batch_for_family(
        "audio", waveform, config, {"sample_rate": 24_000}
    )
    assert audio_batch["audio"]["waveform"] is waveform
    assert audio_batch["audio"]["sample_rate"] == 24_000
    video_batch = _objective_batch_for_family(
        "video", (frames, timestamps), config, {}
    )
    assert video_batch["video"]["frames"] is frames
    assert video_batch["video"]["timestamps"] is timestamps

    with pytest.raises(ValueError, match="canonical sample rate"):
        _objective_batch_for_family("audio", waveform, config, {"sample_rate": 48_000})
    with pytest.raises(ValueError, match="frames and timestamps"):
        _objective_batch_for_family("video", frames, config, {})
    with pytest.raises(ValueError, match="unsupported objective"):
        _objective_batch_for_family("unknown", text_ids, config, {})


def test_joint_worker_uses_onecore_v3_objective_for_all_five_micro_batches(
    monkeypatch, tmp_path,
):
    from types import SimpleNamespace
    from onecore.v3 import resource_benchmark as benchmark

    order = ("text", "tool", "image", "audio", "video")
    loaded = {
        "text": torch.tensor([[1, 2]], dtype=torch.long),
        "tool": torch.tensor([[2, 3]], dtype=torch.long),
        "image": torch.ones(1, 3, 2, 2),
        "audio": torch.ones(1, 1, 8),
        "video": (
            torch.ones(1, 2, 3, 2, 2),
            torch.tensor([[0.0, 0.04]]),
        ),
    }
    metadata = {
        "text": {}, "tool": {}, "image": {},
        "audio": {"sample_rate": 24_000}, "video": {},
    }
    calls = []
    models = []
    initial_weights = []

    class TinyConfig:
        audio_sample_rate = 24_000

        def build_model(self):
            model = torch.nn.Linear(1, 1, bias=False)
            models.append(model)
            initial_weights.append(model.weight.detach().clone())
            return model

    class OneCoreV3Objective:
        def __init__(self, model):
            self.model = model
            self.weights = SimpleNamespace(
                text=1.0, tool=1.0, image_flow=1.0, image_reconstruction=1.0,
                image_adversarial=0.1, audio_flow=1.0, audio_reconstruction=1.0,
                audio_commitment=0.25, audio_adversarial=0.1, video_flow=1.0,
                video_reconstruction=1.0, video_temporal=1.0, alignment=0.1,
            )
            self.image_discriminator = None
            self.audio_discriminator = None

        def __call__(self, batch):
            family, payload = next(iter(batch.items()))
            calls.append((family, payload))
            loss = self.model.weight.square().sum()
            return {"total": loss, f"{family}_loss": loss}

    def fake_load(plan, tokenizer_path):
        family = plan["family"]
        return loaded[family], 2, metadata[family]

    monkeypatch.setattr(benchmark, "V3Config", TinyConfig)
    monkeypatch.setattr(benchmark, "OneCoreV3Objective", OneCoreV3Objective)
    monkeypatch.setattr(benchmark, "_load_worker_input", fake_load)
    monkeypatch.setattr(benchmark, "_load_current_rss_bytes", lambda: 1024)
    monkeypatch.setattr(benchmark, "_max_rss_bytes", lambda: 2048)
    monkeypatch.setattr(benchmark.torch, "set_num_threads", lambda value: None)
    monkeypatch.setattr(benchmark.torch, "set_num_interop_threads", lambda value: None)
    monkeypatch.setattr(benchmark.torch.cuda, "is_available", lambda: False)

    plan_path = tmp_path / "joint-plan.json"
    plan_path.write_text(json.dumps({
        "families": {
            family: {"family": family, "record_id": f"{family}-sample"}
            for family in order
        }
    }), encoding="utf-8")

    result = _joint_worker(plan_path, tmp_path / "tokenizer.json", 4)

    assert result["status"] == "success"
    assert [family for family, _payload in calls] == list(order)
    assert result["micro_batch_order"] == list(order)
    assert result["joint_objective"]["name"] == "OneCoreV3Objective"
    assert result["joint_objective"]["alignment_loss_included"] is False
    assert result["joint_objective"]["optional_discriminators_included"] is False
    assert all(
        f"{family}_loss" in result["family_results"][family]["objective_terms"]
        for family in order
    )
    assert result["optimizer_updates"] == 0
    assert result["optimizer_step_executed"] is False
    assert result["optimizer_state_allocated"] is True
    assert torch.equal(models[0].weight.detach(), initial_weights[0])
