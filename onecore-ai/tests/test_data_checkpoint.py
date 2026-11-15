import json

import yaml

import pytest
import torch

from onecore.checkpoint import load_checkpoint, save_checkpoint
from onecore.config import ModelConfig
from onecore.data import validate_manifest
from onecore.model import OneCore
from onecore.train import run_training


def tiny_config():
    return ModelConfig(
        width=32, unique_blocks=1, recurrent_cycles=1, attention_heads=4,
        max_sequence_length=32, text_vocab_size=64, vision_codebook_size=8,
        audio_codebook_size=4, motion_codebook_size=4, special_tokens=24,
        patch_size=4, image_size=8, audio_bins=8, audio_group_frames=2,
        max_video_frames=2, dropout=0.0,
    )


def test_manifest_rejects_missing_license_and_path_escape(tmp_path):
    assets = tmp_path / "assets"
    assets.mkdir()
    outside = tmp_path / "outside.png"
    outside.write_bytes(b"not-an-image")
    record = {
        "id": "x1", "task": "image_caption", "license": "CC-BY-4.0",
        "source_url": "https://example.org/source", "attribution": "dataset author",
        "split": "train", "review_status": "approved", "image": "../outside.png", "caption": "an image",
    }
    report = validate_manifest([record], assets)
    assert not report["valid"]
    assert any("escapes assets root" in error for error in report["errors"])


def test_manifest_requires_explicit_provenance():
    record = {
        "id": "x1", "task": "text", "license": "unknown",
        "source_url": "not-a-url", "attribution": "", "split": "train", "review_status": "generated",
        "text": "hello",
    }
    report = validate_manifest([record], ".")
    assert not report["valid"]
    assert len(report["errors"]) >= 3


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
            "learning_rate": 1e-3, "weight_decay": 0.0, "gradient_accumulation": 1,
            "max_grad_norm": 1.0, "checkpoint_every": 1, "max_steps_per_job": 10,
            "total_steps": 10, "warmup_steps": 0, "cpu_threads": 1,
        },
        "seed": 42,
    }), encoding="utf-8")
    report = run_training(tmp_path, config_path, "smoke", 1, tmp_path / "run-state")
    assert report["optimizer_step"] == 1
    assert report["optimizer_data_class_counts"] == {}
    assert report["excluded_data_class_counts"] == {}
    assert (tmp_path / "run-state" / "checkpoint.pt").is_file()
