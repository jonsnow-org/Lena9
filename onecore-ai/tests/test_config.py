from pathlib import Path

import pytest
import re
import yaml

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
    assert model.thinker_latents == 16
    assert model.vocab_size == 5144
    assert raw["model"]["hidden_size"] == 2730
    assert raw["model"]["vocab_size"] == 5144
    assert raw["model"]["n_blocks"] == 4
    assert raw["model"]["n_cycles"] == 3
    assert raw["model"]["n_heads"] == 8
    assert raw["data_gate"] == {
        "min_train_per_family": 100,
        "min_holdout_per_family": 10,
        "required_families": ["text", "tool", "image", "audio", "video"],
    }
    assert raw["model"]["expected_parameter_count"] == 57579201
    assert train.gradient_accumulation == 4
    assert train.weight_decay == 0.1
    assert tuple(train.adam_betas) == (0.9, 0.95)
    assert train.warmup_steps == 200
    assert train.total_steps == 20000
    assert train.tldm_diffusion_weight == 0.15
    assert train.seed == 20261115
    assert raw["training"]["seed"] == 20261115
    assert "seed" not in raw


def test_unknown_config_training_key_is_rejected(tmp_path):
    path = tmp_path / "bad.yaml"
    path.write_text(
        """model:
  expected_parameter_count: 57579201
training:
  seed: 20261115
  learning_rate: 0.001
  weight_decay: 0.1
  adam_betas: [0.9, 0.95]
  max_grad_norm: 1.0
  tldm_diffusion_weight: 0.15
  warmup_steps: 1
  total_steps: 10
  mystery_optimizer_knob: 1
""",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="unknown training config keys"):
        load_config(path, validate_spec_v2=False)


def test_missing_explicit_schedule_is_rejected(tmp_path):
    path = tmp_path / "missing-schedule.yaml"
    path.write_text(
        """model:
  expected_parameter_count: 57579201
training:
  seed: 20261115
  learning_rate: 0.001
  weight_decay: 0.1
  adam_betas: [0.9, 0.95]
  max_grad_norm: 1.0
  tldm_diffusion_weight: 0.15
""",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="training.warmup_steps must be explicit"):
        load_config(path, validate_spec_v2=False)


def test_missing_total_steps_is_rejected(tmp_path):
    path = tmp_path / "missing-total-steps.yaml"
    path.write_text(
        """model:
  expected_parameter_count: 57579201
training:
  seed: 20261115
  learning_rate: 0.001
  weight_decay: 0.1
  adam_betas: [0.9, 0.95]
  max_grad_norm: 1.0
  tldm_diffusion_weight: 0.15
  warmup_steps: 1
""",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="training.total_steps must be explicit"):
        load_config(path, validate_spec_v2=False)


def test_wrong_exact_parameter_budget_is_rejected(tmp_path):
    path = tmp_path / "wrong-budget.yaml"
    path.write_text(
        """model:
  expected_parameter_count: 57579200
training:
  seed: 20261115
  learning_rate: 0.001
  weight_decay: 0.1
  adam_betas: [0.9, 0.95]
  max_grad_norm: 1.0
  tldm_diffusion_weight: 0.15
  warmup_steps: 1
  total_steps: 10
""",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="expected_parameter_count must be 57579201"):
        load_config(path)


def test_legacy_checkpoint_same_architecture_but_old_optimizer_is_not_resumable():
    from onecore.train import _validate_resume_configuration

    root = Path(__file__).resolve().parents[1]
    model, _, raw = load_config(root / "configs" / "phone-research.yaml")
    legacy_model = model.to_dict()
    legacy_model.pop("expected_parameter_count")
    legacy_model.pop("thinker_latents")
    legacy_model.pop("hidden_size")
    legacy_training = {
        "learning_rate": 0.0003,
        "weight_decay": 0.01,
        "gradient_accumulation": 4,
        "max_grad_norm": 1.0,
        "checkpoint_every": 25,
        "max_steps_per_job": 250,
        "cpu_threads": 4,
    }
    with pytest.raises(ValueError, match="optimizer/schedule config"):
        _validate_resume_configuration(
            {"model": legacy_model, "training": legacy_training},
            model,
            raw,
        )


def test_v2_checkpoint_with_exact_architecture_and_training_config_can_resume():
    from onecore.train import _validate_resume_configuration

    root = Path(__file__).resolve().parents[1]
    model, _, raw = load_config(root / "configs" / "phone-research.yaml")
    _validate_resume_configuration(
        {"model": model.to_dict(), "training": raw["training"]},
        model,
        raw,
    )


def test_tldm_thinker_latents_must_be_positive():
    from onecore.config import ModelConfig

    with pytest.raises(ValueError, match="thinker_latents must be positive"):
        ModelConfig(thinker_latents=0)


def test_model_config_rejects_wrong_derived_vocab_and_hidden_assertions():
    from onecore.config import ModelConfig

    root = Path(__file__).resolve().parents[1]
    _, _, raw = load_config(root / "configs" / "phone-research.yaml")
    with pytest.raises(ValueError, match="model.vocab_size must equal 5144"):
        ModelConfig.from_mapping({**raw["model"], "vocab_size": 5143})
    with pytest.raises(ValueError, match="model.hidden_size must equal 2730"):
        ModelConfig.from_mapping({**raw["model"], "hidden_size": 2729})


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("expected_parameter_count", 57579200, "expected_parameter_count must be 57579201"),
        ("vocab_size", 5143, "vocab_size must be 5144"),
        ("hidden_size", 2729, "hidden_size must be int(1024*8/3) = 2730"),
    ],
)
def test_corrected_spec_v2_model_values_are_hard_anchored(tmp_path, field, value, message):
    root = Path(__file__).resolve().parents[1]
    raw = yaml.safe_load((root / "configs" / "phone-research.yaml").read_text(encoding="utf-8"))
    raw["model"][field] = value
    path = tmp_path / f"wrong-{field}.yaml"
    path.write_text(yaml.safe_dump(raw, sort_keys=False), encoding="utf-8")
    with pytest.raises(ValueError, match=re.escape(message)):
        load_config(path)


def test_training_seed_is_required_and_cannot_fall_back_silently(tmp_path):
    root = Path(__file__).resolve().parents[1]
    raw = yaml.safe_load((root / "configs" / "phone-research.yaml").read_text(encoding="utf-8"))
    raw["training"].pop("seed")
    path = tmp_path / "missing-seed.yaml"
    path.write_text(yaml.safe_dump(raw, sort_keys=False), encoding="utf-8")
    with pytest.raises(ValueError, match="training.seed must be explicit"):
        load_config(path)


def test_checkpoint_without_training_seed_remains_resumable():
    from onecore.train import _validate_resume_configuration

    root = Path(__file__).resolve().parents[1]
    model, _, raw = load_config(root / "configs" / "phone-research.yaml")
    legacy_training = dict(raw["training"])
    legacy_training.pop("seed")
    _validate_resume_configuration(
        {"model": model.to_dict(), "training": legacy_training},
        model,
        raw,
    )
