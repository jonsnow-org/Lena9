from __future__ import annotations

def estimate_ram_mb(params_millions: float, bits: int = 32) -> float:
    bytes_per_param = bits / 8.0
    return params_millions * 1e6 * bytes_per_param / (1024 * 1024)

def estimate_latency_ms(params_millions: float, flops_per_param: float = 2.0, device_gflops: float = 1.0) -> float:
    total_flops = params_millions * 1e6 * flops_per_param
    return (total_flops / (device_gflops * 1e9)) * 1000.0