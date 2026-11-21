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
    assert count == 57_579_201, (
        f"Corrected Specification v2 exact parameter count changed: {count:,}"
    )
    assert model.vocab_size == 5144
    assert model.hidden_size == 2730
    assert raw["model"]["expected_parameter_count"] == 57579201
    assert train.gradient_accumulation == 4
    assert train.weight_decay == 0.1
    assert tuple(train.adam_betas) == (0.9, 0.95)
    assert train.warmup_steps == 200
    assert train.total_steps == 20000
    assert train.tldm_diffusion_weight == 0.15
    assert raw["seed"] == 20261115


def test_unknown_config_training_key_is_rejected(tmp_path):
    path = tmp_path / "bad.yaml"
    path.write_text(
        "model:\n  expected_parameter_count: 57579201\n"
        "training:\n  learning_rate: 0.001\n  weight_decay: 0.1\n"
        "  adam_betas: [0.9, 0.95]\n  max_grad_norm: 1.0\n"
        "  tldm_diffusion_weight: 0.15\n  warmup_steps: 1\n"
        "  total_steps: 10\n  mystery_optimizer_knob: 1\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="unknown training config keys"):
        load_config(path)


def test_missing_explicit_schedule_is_rejected(tmp_path):
    path = tmp_path / "missing-schedule.yaml"
    path.write_text(
        "model:\n  expected_parameter_count: 57579201\n"
        "training:\n  learning_rate: 0.001\n  weight_decay: 0.1\n"
        "  adam_betas: [0.9, 0.95]\n  max_grad_norm: 1.0\n"
        "  tldm_diffusion_weight: 0.15\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="training.warmup_steps must be explicit"):
        load_config(path)


def test_wrong_exact_parameter_budget_is_rejected(tmp_path):
    path = tmp_path / "wrong-budget.yaml"
    path.write_text(
        "model:\n  expected_parameter_count: 57579200\n"
        "training:\n  learning_rate: 0.001\n  weight_decay: 0.1\n"
        "  adam_betas: [0.9, 0.95]\n  max_grad_norm: 1.0\n"
        "  tldm_diffusion_weight: 0.15\n  warmup_steps: 1\n  total_steps: 10\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="expected_parameter_count must equal 57579201"):
        load_config(path)


def test_missing_total_steps_is_rejected(tmp_path):
    path = tmp_path / "missing-total-steps.yaml"
    path.write_text(
        "model:\\n  expected_parameter_count: 57579201\\n"
        "training:\\n  learning_rate: 0.001\\n  weight_decay: 0.1\\n"
        "  adam_betas: [0.9, 0.95]\\n  max_grad_norm: 1.0\\n"
        "  tldm_diffusion_weight: 0.15\\n  warmup_steps: 1\\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="training.total_steps must be explicit"):
        load_config(path)
