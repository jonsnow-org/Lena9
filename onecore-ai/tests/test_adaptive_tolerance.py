from onecore.config import ModelConfig

def test_adaptive_tolerance_default():
    cfg = ModelConfig()
    assert cfg.adaptive_tolerance == 0.015

def test_adaptive_tolerance_validation():
    try:
        ModelConfig(adaptive_tolerance=-1)
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")