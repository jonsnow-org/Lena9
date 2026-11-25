import math

import pytest
import torch

from onecore.android_perf import (
    estimate_decode_latency_ms, estimate_latency_ms, estimate_ram_mb, measure_cpu_latency,
)
from onecore.config import ModelConfig
from onecore.model import OneCore
from onecore.training_loop import train_epochs
from onecore.vocoder import MelVocoder, vocoder_loss


def _tiny_model() -> OneCore:
    return OneCore(ModelConfig(width=64, unique_blocks=1, recurrent_cycles=2,
                               attention_heads=4, max_sequence_length=64))


def test_vocoder_output_shape_and_range():
    v = MelVocoder(n_mels=80, channels=16)
    out = v(torch.randn(2, 6, 80))
    assert out.shape == (2, 6 * v.hop_length)
    assert float(out.abs().max()) <= 1.0


def test_vocoder_rejects_bad_input():
    with pytest.raises(ValueError):
        MelVocoder(n_mels=80, channels=16)(torch.randn(1, 6, 40))


def test_vocoder_learns_a_tone_and_saves_checkpoint(tmp_path):
    torch.manual_seed(0)
    v = MelVocoder(n_mels=16, channels=16, upsample=(4, 4))
    frames = 12
    t = torch.arange(frames * v.hop_length) / 16000.0
    wave = (0.5 * torch.sin(2 * math.pi * 440 * t)).unsqueeze(0)
    mel = torch.zeros(1, frames, 16)
    mel[..., 3] = 1.0
    history = train_epochs(v, [(mel, wave)], vocoder_loss, epochs=40, lr=3e-3,
                           checkpoint_dir=str(tmp_path))
    assert history[-1] < history[0] * 0.8
    assert (tmp_path / "ckpt_epoch_40.pt").exists()


def test_train_epochs_rejects_empty_data():
    with pytest.raises(ValueError):
        train_epochs(MelVocoder(n_mels=16, channels=8, upsample=(2,)), [], vocoder_loss)


def test_ram_and_latency_estimates():
    assert estimate_ram_mb(57.6) == pytest.approx(57.6e6 * 4 / 1024 / 1024)
    assert estimate_ram_mb(57.6, bits=4) < estimate_ram_mb(57.6)
    assert estimate_latency_ms(57.6) > 0
    with pytest.raises(ValueError):
        estimate_ram_mb(0)


def test_decode_latency_counts_recurrence():
    model = _tiny_model()
    assert estimate_decode_latency_ms(model) > 0


def test_measured_cpu_latency_is_positive():
    result = measure_cpu_latency(_tiny_model(), seq_len=16, repeats=2)
    assert result["median_ms"] > 0 and result["ms_per_token"] > 0
