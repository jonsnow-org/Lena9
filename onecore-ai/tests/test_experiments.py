import torch

from onecore.experiments import (
    answer_accuracy, make_prefix_sum_batch, mini_config, no_leakage, train_and_eval,
)
from onecore.model import OneCore


def test_prefix_sum_task_is_correct():
    cfg = mini_config(32, 1, 1)
    tokens, mask = make_prefix_sum_batch(cfg, 4, 6, torch.Generator().manual_seed(1))
    digits = tokens[:, 1:7]
    answers = tokens[:, 8:14]
    assert torch.equal(answers, digits.cumsum(1) % 10)
    assert int(mask.sum()) == 4 * 6
    assert not mask[:, :8].any()  # prompt is never scored


def test_untrained_model_is_near_chance():
    torch.manual_seed(0)
    cfg = mini_config(32, 1, 1)
    model = OneCore(cfg)
    tokens, mask = make_prefix_sum_batch(cfg, 256, 6, torch.Generator().manual_seed(2))
    token_acc, exact = answer_accuracy(model, tokens, mask)
    assert token_acc < 0.35 and exact < 0.05


def test_training_reduces_loss_and_beats_chance():
    # Short run: must clearly beat chance (10%) on held-out data and report real numbers.
    result = train_and_eval("smoke", width=48, unique_blocks=1, cycles=2, steps=150,
                            length=4, batch=64, lr=3e-3)
    assert result.final_train_loss < 2.3  # ln(10) ~ 2.303 is the chance-level loss
    assert result.heldout_token_acc > 0.2
    assert result.parameters > 0


def test_eval_stream_has_no_training_leakage_for_long_inputs():
    assert no_leakage(mini_config(32, 1, 1), length=8) == 0
