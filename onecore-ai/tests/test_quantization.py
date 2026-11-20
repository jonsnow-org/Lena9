import pytest
import torch

from onecore.config import ModelConfig
from onecore.model import OneCore
from onecore.quantization import (
    dequantize_weight, logits_drift, quantize_model, quantize_tensor, quantize_weight,
)


def _tiny_model() -> OneCore:
    torch.manual_seed(0)
    return OneCore(ModelConfig(width=64, unique_blocks=1, recurrent_cycles=2,
                               attention_heads=4, max_sequence_length=64))


def test_quantize_tensor_grid():
    # Values chosen away from exact .5 ties so the expectation is unambiguous.
    assert quantize_tensor([0.0, 0.4, 1.0], bits=4) == [0, 6, 15]
    assert quantize_tensor([-1.0, 2.0], bits=8) == [0, 255]  # clamped into [0, 1]
    with pytest.raises(ValueError):
        quantize_tensor([0.1], bits=0)


def test_weight_roundtrip_error_shrinks_with_more_bits():
    w = torch.randn(32, 64)
    errors = []
    for bits in (2, 4, 8):
        codes, scale = quantize_weight(w, bits)
        errors.append(float((dequantize_weight(codes, scale) - w).norm() / w.norm()))
    assert errors[0] > errors[1] > errors[2]
    assert errors[2] < 0.02


def test_quantize_model_keeps_tying_and_reports_compression():
    model = _tiny_model()
    q, report = quantize_model(model, bits=8)
    assert q.lm_head.weight is q.token_embedding.weight
    assert report.compression_ratio > 2.5
    assert q.count_parameters() == model.count_parameters()


def test_int8_model_stays_close_to_reference_and_int2_drifts_more():
    model = _tiny_model()
    ids = torch.randint(0, model.cfg.text_vocab_size, (2, 24))
    d8 = logits_drift(model, quantize_model(model, 8)[0], ids)
    d2 = logits_drift(model, quantize_model(model, 2)[0], ids)
    assert d8["mean_kl"] < d2["mean_kl"]
    assert d8["top1_agreement"] >= d2["top1_agreement"]
