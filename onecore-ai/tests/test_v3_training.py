import torch

from onecore.v3 import OneCoreV3
from onecore.v3.training import OneCoreV3Objective, train_v3_step


def _tiny_model():
    return OneCoreV3(
        text_vocab_size=128, width=32, layers=1, attention_heads=4,
        patch_size=8, audio_latent_channels=16, audio_hidden_channels=24,
        audio_codebook_size=32, audio_quantizer_stages=3,
        temporal_layers=1, max_image_context_tokens=16,
        max_video_context_tokens=16, max_flow_context_tokens=16,
        temporal_window_frames=8, temporal_memory_frames=2,
        video_generation_chunk_frames=4, dropout=0.0,
    )


def test_v3_joint_objective_and_optimizer_step_cover_all_modalities():
    torch.manual_seed(31)
    model = _tiny_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    batch = {
        "text": {"input_ids": torch.randint(0, 128, (2, 8))},
        "tool": {
            "input_ids": torch.randint(0, 128, (2, 8)),
            "labels": torch.randint(0, 128, (2, 8)),
        },
        "image": {
            "images": torch.rand(2, 3, 32, 32),
            "condition_ids": torch.randint(0, 128, (2, 5)),
        },
        "audio": {
            "waveform": torch.rand(2, 1024),
            "sample_rate": 24_000,
            "condition_ids": torch.randint(0, 128, (2, 5)),
        },
        "video": {
            "frames": torch.rand(2, 3, 3, 16, 16),
            "timestamps": torch.tensor([[0.0, 0.1, 0.2], [0.0, 0.12, 0.24]]),
            "condition_ids": torch.randint(0, 128, (2, 5)),
        },
    }
    metrics = train_v3_step(model, optimizer, batch, max_grad_norm=1.0)

    assert "total" in metrics and metrics["total"] > 0
    assert "text_loss" in metrics and "tool_loss" in metrics
    assert "image_flow_loss" in metrics and "image_reconstruction_loss" in metrics
    assert "audio_flow_loss" in metrics and "audio_reconstruction_loss" in metrics
    assert "video_flow_loss" in metrics and "video_temporal_loss" in metrics
    assert "alignment_loss" in metrics
    assert metrics["gradient_norm"] > 0


def test_v3_objective_rejects_empty_batches():
    model = _tiny_model()
    objective = OneCoreV3Objective(model)
    try:
        objective({})
    except ValueError as exc:
        assert "at least one modality" in str(exc)
    else:
        raise AssertionError("empty joint batch must fail")


def test_v3_audio_objective_accepts_stereo_waveform():
    torch.manual_seed(37)
    model = _tiny_model()
    objective = OneCoreV3Objective(model)
    waveform = torch.rand(2, 2, 2048)

    losses = objective({
        "audio": {
            "waveform": waveform,
            "sample_rate": 24_000,
        }
    })
    losses["total"].backward()

    assert torch.isfinite(losses["audio_reconstruction_loss"])
    assert "audio_flow_loss" in losses
    assert any(parameter.grad is not None for parameter in model.parameters())
