from __future__ import annotations

def estimate_ram_mb(params_millions: float, bits: int = 32) -> float:
    bytes_per_param = bits / 8.0
    return params_millions * 1e6 * bytes_per_param / (1024 * 1024)