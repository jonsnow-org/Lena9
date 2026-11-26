import json
import sys

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



def _mock_artifact_metadata_http(monkeypatch, benchmark, response):
    from types import SimpleNamespace

    monkeypatch.setattr(
        benchmark, "requests",
        SimpleNamespace(get=lambda *args, **kwargs: response),
    )
    monkeypatch.setattr(benchmark, "RemoteZip", object())

def test_pinned_artifact_metadata_checks_the_complete_immutable_identity(monkeypatch):
    from onecore.v3 import resource_benchmark as benchmark

    pinned = benchmark.PINNED_V3_BENCHMARK_ARTIFACTS["corpus"]
    metadata = {
        "id": pinned["artifact_id"],
        "name": pinned["name"],
        "size_in_bytes": pinned["size_in_bytes"],
        "digest": pinned["digest"],
        "expired": False,
        "workflow_run": {"id": pinned["workflow_run_id"]},
    }

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return metadata

    _mock_artifact_metadata_http(monkeypatch, benchmark, FakeResponse())
    result = benchmark._pinned_artifact_metadata(
        "jonsnow-org/Lena9", "test-token", "corpus",
        pinned["artifact_id"], pinned["workflow_run_id"],
    )

    assert result == {
        "id": pinned["artifact_id"],
        "name": pinned["name"],
        "size_in_bytes": pinned["size_in_bytes"],
        "digest": pinned["digest"],
        "workflow_run_id": pinned["workflow_run_id"],
        "expired": False,
    }


@pytest.mark.parametrize(
    ("field", "replacement"),
    [
        ("id", 1),
        ("name", "different-artifact"),
        ("size_in_bytes", 1),
        ("digest", "sha256:" + "0" * 64),
    ],
)
def test_artifact_metadata_rejects_any_pinned_identity_drift(monkeypatch, field, replacement):
    from onecore.v3 import resource_benchmark as benchmark

    pinned = benchmark.PINNED_V3_BENCHMARK_ARTIFACTS["corpus"]
    metadata = {
        "id": pinned["artifact_id"],
        "name": pinned["name"],
        "size_in_bytes": pinned["size_in_bytes"],
        "digest": pinned["digest"],
        "expired": False,
        "workflow_run": {"id": pinned["workflow_run_id"]},
    }
    metadata[field] = replacement

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return metadata

    _mock_artifact_metadata_http(monkeypatch, benchmark, FakeResponse())
    with pytest.raises(RuntimeError, match=f"pinned V3 {field} mismatch"):
        benchmark._artifact_metadata(
            "jonsnow-org/Lena9", pinned["artifact_id"], "test-token",
            pinned["workflow_run_id"],
            expected_name=pinned["name"],
            expected_size_in_bytes=pinned["size_in_bytes"],
            expected_digest=pinned["digest"],
        )


def test_pinned_artifact_metadata_rejects_changed_cli_artifact_or_run_id():
    from onecore.v3 import resource_benchmark as benchmark

    pinned = benchmark.PINNED_V3_BENCHMARK_ARTIFACTS["corpus"]
    with pytest.raises(RuntimeError, match="must use pinned artifact"):
        benchmark._pinned_artifact_metadata(
            "jonsnow-org/Lena9", "test-token", "corpus",
            pinned["artifact_id"] + 1, pinned["workflow_run_id"],
        )
    with pytest.raises(RuntimeError, match="must use pinned artifact"):
        benchmark._pinned_artifact_metadata(
            "jonsnow-org/Lena9", "test-token", "corpus",
            pinned["artifact_id"], pinned["workflow_run_id"] + 1,
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


def test_process_tree_memory_accounting_includes_loader_worker_peak():
    from onecore.v3.resource_benchmark import _process_tree_memory_accounting

    per_family = {"peak_rss_bytes": 180, "process_tree_peak_rss_bytes_observed": 240}
    loader = {"peak_rss_bytes": 320, "process_tree_peak_rss_bytes_observed": 370}
    joint = {"peak_rss_bytes": 280, "process_tree_peak_rss_bytes_observed": 340}
    result = _process_tree_memory_accounting(
        150, [per_family, loader, joint],
    )

    assert result["max_worker_process_peak_rss_bytes"] == 320
    assert result["observed_process_tree_peak_rss_bytes"] == 370
    assert result["conservative_process_tree_rss_upper_bound_bytes"] == 470
    assert "loader" in result["method"]


def test_distribution_reports_p95_without_mutating_input():
    values = [9, 1, 5, 3]
    assert _distribution(values) == {
        "count": 4, "min": 1.0, "median": 4.0, "p95": 9.0, "max": 9.0,
    }
    assert values == [9, 1, 5, 3]
    assert _distribution([]) is None


def test_family_worker_warms_backward_before_measuring_throughput(monkeypatch, tmp_path):
    from onecore.v3 import resource_benchmark as benchmark

    events = []
    models = []

    class TinyModel(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.scale = torch.nn.Parameter(torch.tensor(1.0))
            self.scale.register_hook(lambda _gradient: events.append("backward"))

        def forward_text(self, input_ids):
            events.append(("forward", torch.is_grad_enabled()))
            return self.scale * torch.ones((*input_ids.shape, 3))

    class TinyConfig:
        def build_model(self):
            model = TinyModel()
            models.append(model)
            return model

    monkeypatch.setattr(benchmark, "V3Config", TinyConfig)
    monkeypatch.setattr(
        benchmark, "_load_worker_input",
        lambda *_args: (torch.tensor([[0, 1]], dtype=torch.long), 2, {}),
    )
    monkeypatch.setattr(benchmark, "_load_current_rss_bytes", lambda: 1024)
    monkeypatch.setattr(benchmark, "_max_rss_bytes", lambda: 2048)
    monkeypatch.setattr(benchmark.torch.cuda, "is_available", lambda: False)
    monkeypatch.setattr(benchmark.torch, "set_num_threads", lambda _value: None)
    monkeypatch.setattr(benchmark.torch, "set_num_interop_threads", lambda _value: None)

    plan = tmp_path / "family-worker-plan.json"
    plan.write_text(json.dumps({
        "family": "text", "record_id": "external-text-sample", "target_tokens": 2,
    }), encoding="utf-8")

    result = benchmark._worker(plan, None, threads=1, iterations=5)

    assert result["status"] == "success", result
    assert result["warmup_forward_passes"] == 1
    assert result["warmup_forward_backward_passes"] == 1
    assert result["measured_iterations"] == 5
    assert result["inference_seconds_distribution"]["count"] == 5
    assert result["forward_backward_seconds_distribution"]["count"] == 5
    assert result["inference_units_per_second_distribution"]["count"] == 5
    assert result["forward_backward_units_per_second_distribution"]["count"] == 5
    assert result["optimizer_step_executed"] is False
    assert events == [("forward", False), ("forward", True), "backward"] + [
        event
        for _ in range(5)
        for event in (("forward", False), ("forward", True), "backward")
    ]
    assert models[0].scale.item() == 1.0
    assert result["inference_seconds_mean"] > 0
    assert result["forward_backward_seconds_mean"] > 0


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
        "image": {
            "record_id": "image-1", "local_paths": ["image.png"],
            "condition_field": "caption", "condition_text": "one two",
            "source_row_id_sha256": "a" * 64,
        },
        "audio": {
            "record_id": "audio-1", "local_paths": ["audio-24k.wav"],
            "duration_seconds": 3.5, "condition_field": "transcript",
            "condition_text": "two three", "source_row_id_sha256": "b" * 64,
        },
        "video": {
            "record_id": "video-1", "local_paths": ["frame-0.png", "frame-1.png", "frame-2.png"],
            "timestamps": [0.0, 0.5, 1.0], "timestamp_unit": "seconds",
            "condition_field": "caption", "condition_text": "three four",
            "source_row_id_sha256": "c" * 64,
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
    for family, text_value, field in (
        ("image", "one two", "caption"),
        ("audio", "two three", "transcript"),
        ("video", "three four", "caption"),
    ):
        planned = plan["families"][family]
        assert planned["condition_field"] == field
        assert planned["condition_ids"] == tokenizer.encode(text_value).ids
        assert planned["condition_tokens"] == len(planned["condition_ids"])
        assert len(planned["condition_text_sha256"]) == 64


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
    condition_ids = torch.tensor([[1, 2]], dtype=torch.long)
    image_batch = _objective_batch_for_family(
        "image", images, config, {}, condition_ids=condition_ids
    )["image"]
    assert image_batch["images"] is images
    assert image_batch["condition_ids"] is condition_ids
    audio_batch = _objective_batch_for_family(
        "audio", waveform, config, {"sample_rate": 24_000},
        condition_ids=condition_ids,
    )
    assert audio_batch["audio"]["waveform"] is waveform
    assert audio_batch["audio"]["sample_rate"] == 24_000
    assert audio_batch["audio"]["condition_ids"] is condition_ids
    video_batch = _objective_batch_for_family(
        "video", (frames, timestamps), config, {}, condition_ids=condition_ids
    )
    assert video_batch["video"]["frames"] is frames
    assert video_batch["video"]["timestamps"] is timestamps
    assert video_batch["video"]["condition_ids"] is condition_ids

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
            family: {
                "family": family, "record_id": f"{family}-sample",
                **(
                    {
                        "condition_ids": [1, 2],
                        "condition_field": "transcript" if family == "audio" else "caption",
                        "condition_text_sha256": "a" * 64,
                        "condition_tokens": 2,
                    }
                    if family in {"image", "audio", "video"} else {}
                ),
            }
            for family in order
        }
    }), encoding="utf-8")

    result = _joint_worker(plan_path, tmp_path / "tokenizer.json", 4)

    assert result["status"] == "success"
    assert [family for family, _payload in calls] == list(order)
    assert result["micro_batch_order"] == list(order)
    assert result["joint_objective"]["name"] == "OneCoreV3Objective"
    assert result["joint_objective"]["alignment_loss_included"] is False
    assert result["joint_objective"]["conditioned_families"] == ["image", "audio", "video"]
    assert result["joint_objective"]["optional_discriminators_included"] is False
    for family, payload in calls:
        if family in {"image", "audio", "video"}:
            assert payload["condition_ids"].tolist() == [[1, 2]]
    assert all(
        f"{family}_loss" in result["family_results"][family]["objective_terms"]
        for family in order
    )
    assert result["optimizer_updates"] == 0
    assert result["optimizer_step_executed"] is False
    assert result["optimizer_state_allocated"] is True
    assert torch.equal(models[0].weight.detach(), initial_weights[0])


def test_select_train_samples_preserves_same_row_media_conditions(tmp_path):
    import hashlib

    from onecore.v3.resource_benchmark import _select_train_samples

    def base(record_id, task, **payload):
        return {
            "id": record_id, "split": "train", "task": task,
            "data_class": "external",
            "source_url": "https://example.org/dataset",
            "source_id": "dataset-v1", "source_revision": "a" * 40,
            "source_row_id_sha256": hashlib.sha256(record_id.encode()).hexdigest(),
            **payload,
        }

    rows = [
        base("text-1", "text", text="A sufficiently long external text row."),
        base("tool-1", "tool_use", prompt="Find the item", response={"ok": True}),
        base("image-1", "image_caption", caption="A red boat on a lake.", assets={
            "image": {"source_asset": "raw/image.png", "width": 2, "height": 2},
        }),
        base("audio-1", "audio_text", transcript="A spoken weather report.", assets={
            "audio": {
                "source_asset": "raw/audio.wav", "training_asset": "raw/audio.wav",
                "sample_rate": 24_000, "training_sample_rate": 24_000,
                "training_channels": 1, "training_samples": 24_000,
            },
        }),
        base("video-1", "video_caption", caption="A person opens a door.", assets={
            "video": {
                "frames": [f"frames/{index}.png" for index in range(24)],
                "timestamps": [index / 24 for index in range(24)], "timestamp_unit": "seconds",
                "frame_count": 24, "width": 1920, "height": 1080,
                "duration_seconds": 0.08, "fps": 25.0,
            },
        }),
    ]
    manifest = tmp_path / "train.jsonl"
    manifest.write_text("".join(json.dumps(row) + chr(10) for row in rows), encoding="utf-8")

    selected, _stats = _select_train_samples(
        manifest, max_image_megapixels=1.0, max_audio_seconds=5.0,
        max_video_megapixel_frames=16.0, max_video_frames=16,
    )

    assert selected["image"]["condition_field"] == "caption"
    assert selected["image"]["condition_text"] == "A red boat on a lake."
    assert selected["audio"]["condition_field"] == "transcript"
    assert selected["audio"]["condition_text"] == "A spoken weather report."
    assert selected["video"]["condition_field"] == "caption"
    assert selected["video"]["condition_text"] == "A person opens a door."
    assert len(selected["video"]["asset_paths"]) == 7
    assert selected["video"]["benchmark_frame_count"] == 7
    assert selected["video"]["video_megapixel_frames"] <= 16.0
    assert len(selected["video"]["timestamps"]) == 7



@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="RSS sampling uses Linux /proc")
def test_monitored_subprocess_samples_parent_and_worker_rss_and_emits_heartbeats():
    from onecore.v3.resource_benchmark import (
        _load_current_rss_bytes,
        _run_monitored_subprocess,
    )

    baseline_parent_rss = _load_current_rss_bytes()
    heartbeats = []
    code = (
        "import time; "
        "payload = bytearray(32 * 1024 * 1024); "
        "[(payload.__setitem__(index, 1)) for index in range(0, len(payload), 4096)]; "
        "time.sleep(0.3)"
    )
    completed, observed_tree_peak = _run_monitored_subprocess(
        [sys.executable, "-c", code],
        timeout=10,
        poll_interval=0.01,
        heartbeat_interval=0.05,
        heartbeat_callback=lambda elapsed, peak: heartbeats.append((elapsed, peak)),
    )

    assert completed.returncode == 0
    assert observed_tree_peak >= baseline_parent_rss + 16 * 1024 * 1024
    assert heartbeats and heartbeats[-1][0] >= heartbeats[0][0]


def test_atomic_progress_snapshot_replaces_the_previous_state_without_partial_files(tmp_path):
    from onecore.v3.resource_benchmark import _write_json_atomic

    output = tmp_path / "resource-report.json"
    _write_json_atomic(output, {"status": "in_progress", "current_stage": "loader"})
    assert json.loads(output.read_text(encoding="utf-8"))["current_stage"] == "loader"

    _write_json_atomic(output, {"status": "failed", "current_stage": "loader", "error": "worker timeout"})
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["status"] == "failed"
    assert payload["error"] == "worker timeout"
    assert not output.with_name(output.name + ".partial").exists()


def test_parent_failure_preserves_current_run_progress_snapshot(monkeypatch, tmp_path):
    from pathlib import Path
    from onecore.v3 import resource_benchmark as benchmark

    output = tmp_path / "resource-report.json"
    monkeypatch.setenv("GITHUB_RUN_ID", "12345")

    def fail_after_progress(args):
        benchmark._write_json_atomic(Path(args.output), {
            "format_version": 1,
            "status": "in_progress",
            "github_run_id": "12345",
            "current_stage": "benchmark_production_v3_joint_data_loader",
            "completed_stages": ["validate_pinned_artifacts"],
            "optimizer_updates": 0,
        })
        raise RuntimeError("simulated worker failure")

    monkeypatch.setattr(benchmark, "_run_parent", fail_after_progress)
    assert benchmark.main(["--github-token", "test-token", "--output", str(output)]) == 1

    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["status"] == "failed"
    assert payload["current_stage"] == "benchmark_production_v3_joint_data_loader"
    assert payload["completed_stages"] == ["validate_pinned_artifacts"]
    assert payload["error"] == "RuntimeError: simulated worker failure"
    assert payload["optimizer_updates"] == 0


def test_parent_failure_does_not_overwrite_a_previous_run_report(monkeypatch, tmp_path):
    from onecore.v3 import resource_benchmark as benchmark

    output = tmp_path / "resource-report.json"
    original = {"status": "measured", "github_run_id": "previous-run"}
    benchmark._write_json_atomic(output, original)
    monkeypatch.setenv("GITHUB_RUN_ID", "current-run")
    monkeypatch.setattr(
        benchmark, "_run_parent",
        lambda _args: (_ for _ in ()).throw(FileExistsError("refusing to overwrite")),
    )

    assert benchmark.main(["--github-token", "test-token", "--output", str(output)]) == 1
    assert json.loads(output.read_text(encoding="utf-8")) == original


def test_parent_benchmark_defaults_to_five_measured_iterations_and_rejects_short_runs(monkeypatch):
    from onecore.v3 import resource_benchmark as benchmark

    captured = {}

    def fake_run_parent(args):
        captured["iterations"] = args.iterations
        captured["video_budget"] = args.max_video_megapixel_frames
        return 0

    monkeypatch.setattr(benchmark, "_run_parent", fake_run_parent)
    assert benchmark.main(["--github-token", "test-token"]) == 0
    assert captured["iterations"] == 5
    assert captured["video_budget"] == 16.0
    assert benchmark.main(["--github-token", "test-token", "--max-video-megapixels", "1"]) == 0
    assert captured["video_budget"] == 16.0
    with pytest.raises(SystemExit) as error:
        benchmark.main(["--iterations", "4", "--worker-plan", "unused.json"])
    assert error.value.code == 2


def test_video_budget_preserves_native_resolution_and_bounds_total_megapixel_frames():
    from onecore.v3.resource_benchmark import _bounded_video_frame_count

    assert _bounded_video_frame_count(
        24, 1920 * 1080 / 1_000_000,
        max_video_megapixel_frames=16.0, max_video_frames=16,
    ) == 7
    assert _bounded_video_frame_count(
        24, 1280 * 720 / 1_000_000,
        max_video_megapixel_frames=16.0, max_video_frames=16,
    ) == 16
    assert _bounded_video_frame_count(
        24, 3840 * 2160 / 1_000_000,
        max_video_megapixel_frames=16.0, max_video_frames=16,
    ) == 1
    assert _bounded_video_frame_count(
        1, 7680 * 4320 / 1_000_000,
        max_video_megapixel_frames=16.0, max_video_frames=16,
    ) == 0


def test_loader_video_quota_uses_adaptive_native_resolution_frame_windows(monkeypatch, tmp_path):
    from pathlib import Path
    from onecore.v3 import resource_benchmark as benchmark

    monkeypatch.setattr(benchmark, "TASK_GROUPS", {"video": {"video_caption"}})
    monkeypatch.setattr(benchmark, "external_record_is_trainable", lambda _row: True)
    monkeypatch.setattr(benchmark, "has_immutable_external_provenance", lambda _row: True)

    manifests = {}
    originals = {}
    for split, count in (("train", 100), ("validation", 10), ("test", 10)):
        rows = []
        for index in range(count):
            record_id = f"{split}-video-{index:03d}"
            rows.append({
                "id": record_id,
                "split": split,
                "task": "video_caption",
                "source_id": "pinned-video-dataset",
                "source_revision": "a" * 40,
                "source_row_id_sha256": "b" * 64,
                "caption": "A continuous video clip.",
                "assets": {
                    "video": {
                        "frames": [f"assets/video/{record_id}/frame-{frame:03d}.png" for frame in range(24)],
                        "timestamps": [frame / 24 for frame in range(24)],
                        "width": 1920,
                        "height": 1080,
                        "frame_count": 24,
                    }
                },
            })
        path = tmp_path / f"{split}.jsonl"
        payload = "".join(json.dumps(row, sort_keys=True) + chr(10) for row in rows)
        path.write_text(payload, encoding="utf-8")
        manifests[split] = path
        originals[split] = payload

    selected, report = benchmark._select_loader_benchmark_rows(
        manifests,
        max_image_megapixels=2.0,
        max_audio_seconds=5.0,
        max_video_megapixel_frames=16.0,
        max_video_frames=16,
    )

    for split, quota in (("train", 100), ("validation", 10), ("test", 10)):
        rows = selected[split]["video"]
        assert len(rows) == quota
        assert report["coverage"][split]["video"] == {
            "eligible_external_rows_within_caps": quota,
            "rejected_by_resource_caps": 0,
            "selected_rows": quota,
        }
        for row in rows:
            video = row["assets"]["video"]
            assert (video["width"], video["height"]) == (1920, 1080)
            assert len(video["frames"]) == 7
            assert video["frame_count"] == 7
            assert len(video["timestamps"]) == 7
            view = row["benchmark_view"]
            assert view["transform"] == "prefix_frame_window_under_megapixel_frame_budget"
            assert view["source_frame_count"] == 24
            assert view["selected_frame_count"] == 7
            assert view["selected_megapixel_frames"] <= 16.0
            assert view["selected_megapixel_frames"] == pytest.approx(14.5152)

    for split, path in manifests.items():
        assert path.read_text(encoding="utf-8") == originals[split]


def test_refreshing_artifact_session_retries_expired_signed_urls_for_get_and_head():
    from onecore.v3 import resource_benchmark as benchmark

    class Response:
        def __init__(self, status_code):
            self.status_code = status_code
            self.closed = False

        def close(self):
            self.closed = True

    class FakeSession:
        def __init__(self, responses):
            self.responses = list(responses)
            self.calls = []
            self.closed = False

        def get(self, url, **kwargs):
            self.calls.append(("get", url, kwargs))
            return self.responses.pop(0)

        def head(self, url, **kwargs):
            self.calls.append(("head", url, kwargs))
            return self.responses.pop(0)

        def close(self):
            self.closed = True

    for method in ("get", "head"):
        expired = Response(403)
        accepted = Response(206 if method == "get" else 200)
        fake = FakeSession([expired, accepted])
        refreshes = []
        old_url = "https://artifact.invalid/archive.zip?sig=expired-secret"
        new_url = "https://artifact.invalid/archive.zip?sig=fresh-secret"
        client = benchmark._RefreshingArtifactSession(
            old_url,
            lambda: (refreshes.append(True) or new_url),
            session=fake,
        )
        response = getattr(client, method)(
            "the-original-remotezip-url",
            headers={"Range": "bytes=10-20"},
            stream=True,
        )

        assert response is accepted
        assert refreshes == [True]
        assert expired.closed is True
        assert [call[1] for call in fake.calls] == [old_url, new_url]
        assert all(call[2]["headers"]["Range"] == "bytes=10-20" for call in fake.calls)
        client.close()
        assert fake.closed is True


def test_refreshing_artifact_session_redacts_signed_url_after_second_403():
    from onecore.v3 import resource_benchmark as benchmark

    class Response:
        def __init__(self):
            self.status_code = 403
            self.closed = False

        def close(self):
            self.closed = True

    class FakeSession:
        def __init__(self, responses):
            self.responses = list(responses)
            self.urls = []

        def get(self, url, **kwargs):
            self.urls.append(url)
            return self.responses.pop(0)

    first, second = Response(), Response()
    old_url = "https://artifact.invalid/archive.zip?sig=expired-secret"
    new_url = "https://artifact.invalid/archive.zip?sig=fresh-secret"
    fake = FakeSession([first, second])
    client = benchmark._RefreshingArtifactSession(
        old_url, lambda: new_url, session=fake
    )

    with pytest.raises(RuntimeError, match="signed URL redacted") as error:
        client.get("ignored", headers={"Range": "bytes=0-1"}, stream=True)

    assert fake.urls == [old_url, new_url]
    assert old_url not in str(error.value)
    assert new_url not in str(error.value)
    assert first.closed is True and second.closed is True
