import pytest

from onecore.v3.runner import _learning_rate_multiplier


def test_v3_schedule_has_explicit_linear_warmup_and_cosine_floor():
    assert _learning_rate_multiplier(0, warmup_steps=200, total_steps=20_000) == pytest.approx(1 / 200)
    assert _learning_rate_multiplier(199, warmup_steps=200, total_steps=20_000) == pytest.approx(1.0)
    assert _learning_rate_multiplier(20_000, warmup_steps=200, total_steps=20_000) == pytest.approx(0.1)


def test_v3_schedule_reaches_floor_without_becoming_negative():
    values = [
        _learning_rate_multiplier(step, warmup_steps=10, total_steps=100)
        for step in (10, 25, 50, 75, 100, 150)
    ]
    assert values == sorted(values, reverse=True)
    assert min(values) == pytest.approx(0.1)
