from pathlib import Path

import pytest

from onecore.config import load_config


def test_repository_config_loads_without_undefined_fields():
    root = Path(__file__).resolve().parents[1]
    model, train, raw = load_config(root / "configs" / "phone-research.yaml")
    assert model.width == 1024
    from onecore.model import OneCore
    instantiated = OneCore(model)
    count = instantiated.count_parameters()
    assert 50_000_000 <= count <= 70_000_000, f'initial OneCore research budget out of agreed range: {count:,}'
    assert model.vocab_size == (
        model.text_vocab_size + model.vision_codebook_size
        + model.audio_codebook_size + model.motion_codebook_size
        + model.special_tokens
    )
    assert train.gradient_accumulation == 4
    assert train.total_steps > train.warmup_steps
    assert raw["seed"] == 20261115


def test_unknown_config_training_key_is_rejected(tmp_path):
    path = tmp_path / "bad.yaml"
    path.write_text(
        "model:\n  width: 32\n  attention_heads: 4\n"
        "training:\n  mystery_optimizer_knob: 1\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="unknown training config keys"):
        load_config(path)
