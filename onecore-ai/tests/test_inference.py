import json

import pytest
import torch
import yaml
from tokenizers import Tokenizer, models, pre_tokenizers

from onecore.checkpoint import save_checkpoint, sha256_file
from onecore.config import ModelConfig
from onecore.inference import load_inference_session
from onecore.model import OneCore


def _tiny_config() -> ModelConfig:
    return ModelConfig(
        width=32,
        unique_blocks=1,
        recurrent_cycles=1,
        attention_heads=4,
        max_sequence_length=32,
        text_vocab_size=64,
        vision_codebook_size=8,
        audio_codebook_size=4,
        motion_codebook_size=4,
        special_tokens=24,
        patch_size=4,
        image_size=8,
        audio_bins=8,
        audio_group_frames=2,
        max_video_frames=2,
        dropout=0.0,
    )


def _write_tokenizer(path, vocabulary=None):
    vocabulary = vocabulary or {"[UNK]": 0, "hello": 1, "world": 2}
    tokenizer = Tokenizer(models.WordLevel(vocabulary, unk_token="[UNK]"))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer.save(str(path))


def _inference_bundle(tmp_path):
    root = tmp_path
    config_path = root / "phone-research.yaml"
    checkpoint_path = root / "checkpoint.pt"
    tokenizer_path = root / "tokenizer.json"
    report_path = root / "train_result.json"

    config = _tiny_config()
    config_path.write_text(
        yaml.safe_dump({
            "model": config.to_dict(),
            "training": {
                "learning_rate": 0.0003,
                "weight_decay": 0.1,
                "adam_betas": [0.9, 0.95],
                "warmup_steps": 2,
                "total_steps": 20,
                "max_grad_norm": 1.0,
                "tldm_diffusion_weight": 0.15,
            },
        }),
        encoding="utf-8",
    )
    _write_tokenizer(tokenizer_path)

    model = OneCore(config)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.0003, weight_decay=0.1)
    saved = save_checkpoint(
        checkpoint_path,
        model,
        optimizer,
        scheduler=None,
        step=0,
        config={"model": config.to_dict(), "training": {}},
        metadata={
            "tokenizer_sha256": sha256_file(tokenizer_path),
            "lineage_id": "onecore-inference-test",
        },
    )
    report_path.write_text(
        json.dumps({
            "optimizer_step": 0,
            "checkpoint": {"sha256": saved["sha256"]},
        }),
        encoding="utf-8",
    )
    return config_path, checkpoint_path, tokenizer_path


def test_load_inference_session_verifies_checkpoint_and_tokenizer_lineage(tmp_path):
    config_path, checkpoint_path, tokenizer_path = _inference_bundle(tmp_path)

    session, info = load_inference_session(
        config_path, checkpoint_path, tokenizer_path, device="cpu"
    )

    assert session.model.training is False
    assert info["optimizer_step"] == 0
    assert info["lineage_id"] == "onecore-inference-test"
    assert info["parameter_count"] == session.model.count_parameters()
    assert info["checkpoint_sha256"] == sha256_file(checkpoint_path)
    assert info["tokenizer_sha256"] == sha256_file(tokenizer_path)


def test_load_inference_session_rejects_a_tokenizer_from_another_lineage(tmp_path):
    config_path, checkpoint_path, tokenizer_path = _inference_bundle(tmp_path)
    _write_tokenizer(tokenizer_path, {"[UNK]": 0, "different": 1})

    with pytest.raises(ValueError, match="tokenizer fingerprint"):
        load_inference_session(config_path, checkpoint_path, tokenizer_path, device="cpu")


def test_load_inference_session_rejects_architecture_config_mismatch(tmp_path):
    config_path, checkpoint_path, tokenizer_path = _inference_bundle(tmp_path)
    config = _tiny_config()
    incompatible = ModelConfig(
        width=64,
        unique_blocks=1,
        recurrent_cycles=1,
        attention_heads=4,
        max_sequence_length=32,
        text_vocab_size=64,
        vision_codebook_size=8,
        audio_codebook_size=4,
        motion_codebook_size=4,
        special_tokens=24,
        patch_size=4,
        image_size=8,
        audio_bins=8,
        audio_group_frames=2,
        max_video_frames=2,
        dropout=0.0,
    )
    config_path.write_text(
        yaml.safe_dump({
            "model": incompatible.to_dict(),
            "training": {
                "learning_rate": 0.0003,
                "weight_decay": 0.1,
                "adam_betas": [0.9, 0.95],
                "warmup_steps": 2,
                "total_steps": 20,
                "max_grad_norm": 1.0,
                "tldm_diffusion_weight": 0.15,
            },
        }),
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError):
        load_inference_session(config_path, checkpoint_path, tokenizer_path, device="cpu")
