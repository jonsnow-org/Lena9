import json

import yaml

import pytest
import torch

from onecore.checkpoint import load_checkpoint, save_checkpoint
from onecore.config import ModelConfig
from onecore.data import validate_manifest
from onecore.model import OneCore
from onecore.train import _joint_micro_batches, run_training


def tiny_config():
    return ModelConfig(
        width=32, unique_blocks=1, recurrent_cycles=1, attention_heads=4,
        max_sequence_length=32, text_vocab_size=64, vision_codebook_size=8,
        audio_codebook_size=4, motion_codebook_size=4, special_tokens=24,
        patch_size=4, image_size=8, audio_bins=8, audio_group_frames=2,
        max_video_frames=2, dropout=0.0,
    )


def test_manifest_accepts_minimal_records_and_rejects_path_escape(tmp_path):
    assets = tmp_path / "assets"
    assets.mkdir()
    outside = tmp_path / "outside.png"
    outside.write_bytes(b"not-an-image")
    record = {
        "id": "x1", "task": "image_caption", "source_url": "https://example.org/source", "split": "train", "image": "../outside.png", "caption": "an image",
    }
    report = validate_manifest([record], assets)
    assert not report["valid"]
    assert any("escapes assets root" in error for error in report["errors"])


def test_manifest_requires_a_valid_source():
    record = {
        "id": "x1", "task": "text", "source_url": "not-a-url", "split": "train", "text": "hello",
    }
    report = validate_manifest([record], ".")
    assert not report["valid"]
    assert any("source_url" in error for error in report["errors"])


def test_checkpoint_roundtrip_preserves_model_optimizer_scheduler_and_rng(tmp_path):
    torch.manual_seed(11)
    model = OneCore(tiny_config())
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lambda step: 1.0 / (step + 1))
    ids = torch.randint(0, model.cfg.text_vocab_size, (1, 8))
    loss = model(ids).square().mean()
    loss.backward()
    optimizer.step()
    scheduler.step()
    path = tmp_path / "checkpoint.pt"
    saved = save_checkpoint(
        path, model, optimizer, scheduler, 17,
        {"model": model.cfg.to_dict()}, {"tokenizer_sha256": "test"},
    )
    assert saved["bytes"] > 0 and len(saved["sha256"]) == 64

    restored = OneCore(tiny_config())
    restored_optimizer = torch.optim.AdamW(restored.parameters(), lr=1e-3)
    restored_scheduler = torch.optim.lr_scheduler.LambdaLR(restored_optimizer, lambda step: 1.0 / (step + 1))
    step, payload = load_checkpoint(path, restored, restored_optimizer, restored_scheduler)
    assert step == 17
    assert payload["config"]["model"]["width"] == 32
    assert payload["metadata"]["tokenizer_sha256"] == "test"
    assert restored_scheduler.last_epoch == scheduler.last_epoch
    for left, right in zip(model.parameters(), restored.parameters()):
        assert torch.equal(left, right)


def test_smoke_training_segment_saves_checkpoint_and_empty_data_class_counts(tmp_path):
    model_config = tiny_config().to_dict()
    model_config.pop("vocab_size")
    config_path = tmp_path / "smoke-config.yaml"
    config_path.write_text(yaml.safe_dump({
        "model": model_config,
        "training": {
            "learning_rate": 1e-3, "weight_decay": 0.0, "adam_betas": [0.9, 0.95], "gradient_accumulation": 1,
            "max_grad_norm": 1.0, "checkpoint_every": 1, "max_steps_per_job": 10,
            "total_steps": 10, "warmup_steps": 0, "cpu_threads": 1, "tldm_diffusion_weight": 0.15,
        },
        "seed": 42,
    }), encoding="utf-8")
    report = run_training(tmp_path, config_path, "smoke", 1, tmp_path / "run-state")
    assert report["optimizer_step"] == 1
    assert report["optimizer_data_class_counts"] == {}
    assert report["excluded_data_class_counts"] == {}
    assert (tmp_path / "run-state" / "checkpoint.pt").is_file()



def test_joint_sampler_picks_one_record_from_each_of_five_families():
    import random

    records_by_task = {
        "text": [
            {"id": "bootstrap-text", "task": "text", "data_class": "bootstrap"},
            {"id": "text-1", "task": "text", "data_class": "external"},
        ],
        "tool_use": [
            {"id": "synthetic-tool", "task": "tool_use", "data_class": "synthetic"},
            {"id": "tool-1", "task": "tool_use", "data_class": "external"},
        ],
        "image_caption": [
            {"id": "image-bootstrap", "task": "image_caption", "data_class": "bootstrap"},
            {"id": "image-1", "task": "image_caption", "data_class": "external"},
        ],
        "image_reconstruction": [{"id": "image-2", "task": "image_reconstruction", "data_class": "external"}],
        "audio_text": [{"id": "audio-1", "task": "audio_text", "data_class": "external"}],
        "audio_reconstruction": [{"id": "audio-2", "task": "audio_reconstruction", "data_class": "external"}],
        "video_caption": [{"id": "video-1", "task": "video_caption", "data_class": "external"}],
        "video_reconstruction": [{"id": "video-2", "task": "video_reconstruction", "data_class": "external"}],
    }
    batch = _joint_micro_batches(records_by_task, random.Random(17))
    assert len(batch) == 5
    assert {family for family, _ in batch} == {"text", "tool", "image", "audio", "video"}
    allowed_tasks = {
        "text": {"text"}, "tool": {"tool_use"},
        "image": {"image_caption", "image_reconstruction"},
        "audio": {"audio_text", "audio_reconstruction"},
        "video": {"video_caption", "video_reconstruction"},
    }
    for family, record in batch:
        assert record["task"] in allowed_tasks[family]
        assert record["data_class"] == "external"


def test_joint_sampler_rejects_missing_external_family_before_any_update():
    import random

    records_by_task = {
        "text": [{"id": "text-1", "task": "text", "data_class": "external"}],
        "tool_use": [{"id": "tool-1", "task": "tool_use", "data_class": "external"}],
        "image_caption": [{"id": "image-1", "task": "image_caption", "data_class": "external"}],
        "audio_text": [{"id": "audio-1", "task": "audio_text", "data_class": "external"}],
        "video_caption": [{"id": "video-bootstrap-only", "task": "video_caption", "data_class": "bootstrap"}],
    }
    with pytest.raises(ValueError, match="all five families"):
        _joint_micro_batches(records_by_task, random.Random(3))


def test_split_disjointness_hashes_each_repeated_asset_path_once(tmp_path, monkeypatch):
    import onecore.data as data_module

    data_root = tmp_path / "data"
    assets = data_root / "assets"
    assets.mkdir(parents=True)
    asset = assets / "shared.bin"
    asset.write_bytes(b"one shared media payload")

    manifests = {
        "train": [
            {"id": "train-1", "split": "train", "image": "shared.bin"},
            {"id": "train-2", "split": "train", "image": "shared.bin"},
            {"id": "train-3", "split": "train", "image": "shared.bin"},
        ],
        "validation": [{"id": "validation-1", "split": "validation"}],
        "test": [{"id": "test-1", "split": "test"}],
    }
    for split, records in manifests.items():
        (data_root / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(record) for record in records) + "\n",
            encoding="utf-8",
        )

    calls = []
    original = data_module._sha256_asset_file

    def counted_hash(path):
        calls.append(path)
        return original(path)

    monkeypatch.setattr(data_module, "_sha256_asset_file", counted_hash)
    monkeypatch.setattr(
        data_module,
        "read_manifest",
        lambda _path: pytest.fail("split-integrity must stream JSONL instead of materializing rows"),
    )
    report = data_module.validate_split_disjointness(tmp_path)

    assert report["valid"] is True
    assert calls == [asset.resolve()]


def test_split_disjointness_still_detects_identical_content_at_different_paths(tmp_path):
    from onecore.data import DatasetError, validate_split_disjointness

    data_root = tmp_path / "data"
    assets = data_root / "assets"
    assets.mkdir(parents=True)
    payload = b"same media bytes stored at separate paths"
    (assets / "train.bin").write_bytes(payload)
    (assets / "validation.bin").write_bytes(payload)

    manifests = {
        "train": [{"id": "train-1", "split": "train", "image": "train.bin"}],
        "validation": [{"id": "validation-1", "split": "validation", "image": "validation.bin"}],
        "test": [{"id": "test-1", "split": "test"}],
    }
    for split, records in manifests.items():
        (data_root / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(record) for record in records) + "\n",
            encoding="utf-8",
        )

    with pytest.raises(DatasetError, match="identical asset content leakage"):
        validate_split_disjointness(tmp_path)


def test_manifest_file_validation_streams_rows_without_read_manifest(tmp_path, monkeypatch):
    import onecore.data as data_module

    data_root = tmp_path / "data"
    (data_root / "assets").mkdir(parents=True)
    record = {
        "id": "streamed-text-1",
        "task": "text",
        "source_url": "https://example.org/source",
        "split": "train",
        "data_class": "external",
        "source_id": "streamed-source",
        "source_revision": "c" * 40,
        "source_row_id_sha256": "d" * 64,
        "text": "This is a streamed manifest record with enough text content.",
    }
    (data_root / "train.jsonl").write_text(json.dumps(record) + "\n", encoding="utf-8")
    monkeypatch.setattr(
        data_module,
        "read_manifest",
        lambda _path: pytest.fail("file validators must use the streaming iterator"),
    )

    report = data_module.validate_training_data(tmp_path)

    assert report["valid"] is True
    assert report["records"] == 1
    assert report["task_counts"] == {"text": 1}


def test_bootstrap_training_and_heldout_evaluation_use_separate_jobs():
    from pathlib import Path

    repository_root = Path(__file__).resolve().parents[2]
    workflow = (repository_root / ".github" / "workflows" / "onecore-bootstrap.yml").read_text(
        encoding="utf-8"
    )
    import yaml

    yaml.safe_load(workflow)
    training_job = workflow.split("  train_all:\n", 1)[1].split("\n  evaluate:\n", 1)[0]
    evaluation_job = workflow.split("\n  evaluate:\n", 1)[1].split("\n  evaluate_existing:\n", 1)[0]

    assert "Execute independent validation and held-out test" not in training_job
    assert "05_evaluation_and_promotion.ipynb" not in training_job
    assert "05_evaluation_and_promotion.ipynb" in evaluation_job
    assert 'ONECORE_EXECUTE_EVALUATION: "1"' in evaluation_job
    assert "needs.prepare.outputs.base_corpus_run_id" in evaluation_job
    assert "onecore-evaluation-${{ github.run_id }}" in evaluation_job


def test_external_manifest_records_require_immutable_row_provenance():
    from onecore.data import validate_manifest

    valid = {
        "id": "external-row-1",
        "task": "text",
        "source_url": "https://example.org/dataset",
        "split": "train",
        "data_class": "external",
        "source_id": "dataset-a",
        "source_revision": "a" * 40,
        "source_row_id_sha256": "b" * 64,
        "text": "A real external training example with immutable provenance.",
    }
    assert validate_manifest([valid], ".")["valid"] is True

    invalid = {**valid, "source_row_id_sha256": ""}
    report = validate_manifest([invalid], ".")
    assert report["valid"] is False
    assert any("immutable source_revision" in error for error in report["errors"])


def test_split_disjointness_rejects_same_external_source_row_in_two_splits(tmp_path):
    from onecore.data import DatasetError, validate_split_disjointness

    data_root = tmp_path / "data"
    (data_root / "assets").mkdir(parents=True)
    shared = {
        "source_id": "dataset-a",
        "source_revision": "a" * 40,
        "source_row_id_sha256": "b" * 64,
        "source_url": "https://example.org/dataset",
        "data_class": "external",
        "task": "text",
        "text": "same source row copied across splits",
    }
    manifests = {
        "train": [{**shared, "id": "train-row", "split": "train"}],
        "validation": [{**shared, "id": "validation-row", "split": "validation"}],
        "test": [{"id": "test-row", "task": "text", "source_url": "local://onecore-bootstrap",
                  "data_class": "bootstrap", "split": "test", "text": "engineering-only"}],
    }
    for split, records in manifests.items():
        (data_root / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(record) for record in records) + "\n",
            encoding="utf-8",
        )

    with pytest.raises(DatasetError, match="identical source-row provenance leakage"):
        validate_split_disjointness(tmp_path)


def test_external_provenance_audit_checks_all_splits_without_rehashing_assets(tmp_path):
    from onecore.data import DatasetError, validate_external_provenance_disjointness

    data_root = tmp_path / "data"
    (data_root / "assets").mkdir(parents=True)
    base = {
        "task": "text",
        "source_url": "https://example.org/dataset",
        "data_class": "external",
        "source_id": "dataset-a",
        "source_revision": "a" * 40,
        "text": "A real external source row with pinned provenance.",
    }
    manifests = {
        "train": [{**base, "id": "train-1", "split": "train", "source_row_id_sha256": "b" * 64}],
        "validation": [{**base, "id": "validation-1", "split": "validation", "source_row_id_sha256": "c" * 64}],
        "test": [{**base, "id": "test-1", "split": "test", "source_row_id_sha256": "d" * 64}],
    }
    for split, records in manifests.items():
        (data_root / f"{split}.jsonl").write_text(
            "\\n".join(json.dumps(record) for record in records) + "\\n",
            encoding="utf-8",
        )

    report = validate_external_provenance_disjointness(tmp_path)
    assert report["valid"] is True
    assert report["external_records_by_split"] == {"train": 1, "validation": 1, "test": 1}
    assert report["unique_source_rows"] == 3
    assert report["cross_split_source_row_overlaps"] == 0

    manifests["test"][0]["source_row_id_sha256"] = "b" * 64
    (data_root / "test.jsonl").write_text(
        json.dumps(manifests["test"][0]) + "\\n", encoding="utf-8"
    )
    with pytest.raises(DatasetError, match="identical external source row"):
        validate_external_provenance_disjointness(tmp_path)
