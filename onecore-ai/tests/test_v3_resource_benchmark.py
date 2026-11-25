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

    monkeypatch.setattr(benchmark.requests, "get", lambda *args, **kwargs: FakeResponse())
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

    monkeypatch.setattr(benchmark.requests, "get", lambda *args, **kwargs: FakeResponse())
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
                "frames": ["frames/0.png", "frames/1.png"],
                "timestamps": [0.0, 0.04], "timestamp_unit": "seconds",
                "frame_count": 2, "width": 2, "height": 2,
                "duration_seconds": 0.08, "fps": 25.0,
            },
        }),
    ]
    manifest = tmp_path / "train.jsonl"
    manifest.write_text("".join(json.dumps(row) + chr(10) for row in rows), encoding="utf-8")

    selected, _stats = _select_train_samples(
        manifest, max_image_megapixels=1.0, max_audio_seconds=5.0,
        max_video_megapixels=1.0, max_video_frames=2,
    )

    assert selected["image"]["condition_field"] == "caption"
    assert selected["image"]["condition_text"] == "A red boat on a lake."
    assert selected["audio"]["condition_field"] == "transcript"
    assert selected["audio"]["condition_text"] == "A spoken weather report."
    assert selected["video"]["condition_field"] == "caption"
    assert selected["video"]["condition_text"] == "A person opens a door."



@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="RSS sampling uses Linux /proc")
def test_monitored_subprocess_samples_parent_and_worker_rss():
    from onecore.v3.resource_benchmark import (
        _load_current_rss_bytes,
        _run_monitored_subprocess,
    )

    baseline_parent_rss = _load_current_rss_bytes()
    code = (
        "import time; "
        "payload = bytearray(32 * 1024 * 1024); "
        "[(payload.__setitem__(index, 1)) for index in range(0, len(payload), 4096)]; "
        "time.sleep(0.3)"
    )
    completed, observed_tree_peak = _run_monitored_subprocess(
        [sys.executable, "-c", code], timeout=10,
    )

    assert completed.returncode == 0
    assert observed_tree_peak >= baseline_parent_rss + 16 * 1024 * 1024
