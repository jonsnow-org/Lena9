"""Post-training weight quantization for OneCore (measured, not assumed).

Weights are quantized per output channel with a symmetric scale. The model
keeps its tied embedding/LM-head identity: the shared table is quantized once.
`quantize_model` returns a *simulated-quantization* copy (weights are rounded to
the integer grid and de-quantized back to float) so that quality loss can be
measured honestly on CPU before any packed low-bit runtime exists.
"""
from __future__ import annotations

import copy
import math
from dataclasses import dataclass

import torch
from torch import nn

from .model import OneCore


def quantize_tensor(values: list[float], bits: int = 8) -> list[int]:
    """Map values in [0, 1] onto the unsigned integer grid 0..2**bits-1 (round half up)."""
    if bits <= 0 or bits > 16:
        raise ValueError("bits must be in 1..16")
    top = (1 << bits) - 1
    return [min(top, max(0, math.floor(min(1.0, max(0.0, v)) * top + 0.5))) for v in values]


def quantize_weight(weight: torch.Tensor, bits: int = 8) -> tuple[torch.Tensor, torch.Tensor]:
    """Symmetric per-row quantization. Returns (int codes, per-row float scale)."""
    if bits < 2 or bits > 8:
        raise ValueError("weight bits must be in 2..8")
    if weight.ndim < 2:
        raise ValueError("weight must be at least 2-D")
    qmax = (1 << (bits - 1)) - 1
    flat = weight.detach().float().reshape(weight.shape[0], -1)
    scale = (flat.abs().amax(dim=1) / qmax).clamp_min(1e-12)
    codes = torch.round(flat / scale[:, None]).clamp(-qmax, qmax).to(torch.int8)
    return codes.reshape(weight.shape), scale


def dequantize_weight(codes: torch.Tensor, scale: torch.Tensor) -> torch.Tensor:
    flat = codes.float().reshape(codes.shape[0], -1) * scale[:, None]
    return flat.reshape(codes.shape)


@dataclass(frozen=True)
class QuantizationReport:
    bits: int
    tensors: int
    packed_weight_bytes: int
    fp32_weight_bytes: int
    compression_ratio: float
    mean_relative_error: float


@torch.no_grad()
def quantize_model(model: OneCore, bits: int = 8) -> tuple[OneCore, QuantizationReport]:
    """Return a simulated-quantized deep copy of `model` and a size/error report."""
    clone = copy.deepcopy(model)
    seen: set[int] = set()
    packed_bits = 0
    fp32_bytes = 0
    errors: list[float] = []
    tensors = 0
    for _, param in clone.named_parameters():
        if id(param) in seen:  # the tied embedding/head is counted once
            continue
        seen.add(id(param))
        fp32_bytes += param.numel() * 4
        if param.ndim < 2:  # norms/biases stay full precision
            packed_bits += param.numel() * 32
            continue
        codes, scale = quantize_weight(param.data, bits)
        restored = dequantize_weight(codes, scale)
        denom = param.data.float().norm().clamp_min(1e-12)
        errors.append(float((restored - param.data.float()).norm() / denom))
        param.data.copy_(restored.to(param.dtype))
        packed_bits += param.numel() * bits + scale.numel() * 32
        tensors += 1
    packed_bytes = math.ceil(packed_bits / 8)
    report = QuantizationReport(
        bits=bits, tensors=tensors, packed_weight_bytes=packed_bytes,
        fp32_weight_bytes=fp32_bytes, compression_ratio=fp32_bytes / packed_bytes,
        mean_relative_error=sum(errors) / max(1, len(errors)),
    )
    return clone, report


@torch.no_grad()
def logits_drift(reference: OneCore, quantized: OneCore, ids: torch.Tensor) -> dict[str, float]:
    """Measure how far quantization moves the next-token distribution."""
    reference.eval()
    quantized.eval()
    p = torch.softmax(reference(ids).float(), dim=-1)
    q = torch.softmax(quantized(ids).float(), dim=-1)
    kl = (p * (p.clamp_min(1e-12).log() - q.clamp_min(1e-12).log())).sum(-1).mean()
    agree = (p.argmax(-1) == q.argmax(-1)).float().mean()
    return {"mean_kl": float(kl), "top1_agreement": float(agree)}
