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

def test_adaptive_inference_uses_configured_tolerance(monkeypatch):
    import torch

    from onecore.model import OneCore

    cfg = ModelConfig(
        width=32,
        unique_blocks=1,
        recurrent_cycles=3,
        attention_heads=4,
        max_sequence_length=8,
        text_vocab_size=16,
        vision_codebook_size=4,
        audio_codebook_size=4,
        motion_codebook_size=4,
        special_tokens=8,
        patch_size=2,
        image_size=4,
        audio_bins=4,
        audio_group_frames=1,
        thinker_latents=2,
        dropout=0.0,
        adaptive_tolerance=0.06,
    )
    model = OneCore(cfg).eval()
    distributions = iter((
        torch.tensor([[0.55, 0.45]]),
        torch.tensor([[0.50, 0.50]]),
    ))
    monkeypatch.setattr(
        torch,
        "softmax",
        lambda _logits, dim: next(distributions),
    )

    _, used_cycles = model.forward_hidden_adaptive(
        torch.tensor([[0, 1]]),
        min_cycles=1,
        max_cycles=3,
    )
    assert used_cycles == 2
