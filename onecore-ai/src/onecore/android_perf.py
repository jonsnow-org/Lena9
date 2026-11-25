"""Deployment cost estimates and *measured* CPU latency for OneCore.

The analytic helpers are first-order estimates. `measure_cpu_latency` runs the
real model on the host CPU; a desktop/CI number is NOT an Android number and
must be re-measured on a device before any mobile claim is made.
"""
from __future__ import annotations

import time

import torch

from .model import OneCore


def estimate_ram_mb(params_millions: float, bits: int = 32) -> float:
    if params_millions <= 0 or bits <= 0:
        raise ValueError("params_millions and bits must be positive")
    return params_millions * 1e6 * (bits / 8.0) / (1024 * 1024)


def estimate_latency_ms(params_millions: float, flops_per_param: float = 2.0,
                        device_gflops: float = 1.0) -> float:
    """Lower-bound compute time for one token through all stored weights (no recurrence)."""
    if params_millions <= 0 or device_gflops <= 0:
        raise ValueError("params_millions and device_gflops must be positive")
    return params_millions * 1e6 * flops_per_param / (device_gflops * 1e9) * 1000.0


def estimate_decode_latency_ms(model: OneCore, device_gflops: float = 1.0) -> float:
    """Per-token cost counting recurrence: block weights are applied `cycles` times."""
    cfg = model.cfg
    block_params = sum(p.numel() for b in model.blocks for p in b.parameters())
    head_params = model.token_embedding.weight.numel()
    effective = block_params * cfg.recurrent_cycles + head_params
    return effective * 2.0 / (device_gflops * 1e9) * 1000.0


@torch.no_grad()
def measure_cpu_latency(model: OneCore, seq_len: int = 64, repeats: int = 3,
                        threads: int | None = None) -> dict[str, float]:
    """Time a real forward pass on this host (median of `repeats`)."""
    if seq_len < 1 or seq_len > model.cfg.max_sequence_length or repeats < 1:
        raise ValueError("invalid seq_len or repeats")
    if threads:
        torch.set_num_threads(threads)
    model.eval()
    ids = torch.randint(0, model.cfg.text_vocab_size, (1, seq_len))
    model(ids)  # warm-up
    times = []
    for _ in range(repeats):
        start = time.perf_counter()
        model(ids)
        times.append((time.perf_counter() - start) * 1000.0)
    times.sort()
    median = times[len(times) // 2]
    return {"seq_len": seq_len, "median_ms": median, "ms_per_token": median / seq_len,
            "threads": float(torch.get_num_threads())}
