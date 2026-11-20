from __future__ import annotations

def quantize_tensor(values: list[float], bits: int = 8) -> list[int]:
    if bits <= 0:
        raise ValueError("bits must be positive")
    scale = (1 << bits) - 1
    return [int(round(v * scale)) for v in values]