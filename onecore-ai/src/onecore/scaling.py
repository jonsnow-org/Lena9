from __future__ import annotations

from .config import ModelConfig


def scaled_config(width: int, unique_blocks: int, recurrent_cycles: int) -> ModelConfig:
    if width <= 0 or unique_blocks <= 0 or recurrent_cycles <= 0:
        raise ValueError("scaling params must be positive")
    return ModelConfig(
        width=width,
        unique_blocks=unique_blocks,
        recurrent_cycles=recurrent_cycles,
    )