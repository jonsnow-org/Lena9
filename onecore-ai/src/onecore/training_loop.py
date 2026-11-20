from __future__ import annotations

import os
from typing import Iterable, Tuple


def train_one_epoch(model, data: Iterable[Tuple[list[float], list[float]]], epochs: int = 1, lr: float = 0.01, checkpoint_dir: str | None = None) -> list[float]:
    losses = []
    for epoch in range(epochs):
        total = 0.0
        count = 0
        for x, y in data:
            total += model.backward(x, y, lr=lr)
            count += 1
        avg = total / max(1, count)
        losses.append(avg)
        if checkpoint_dir:
            os.makedirs(checkpoint_dir, exist_ok=True)
            model.save_checkpoint(os.path.join(checkpoint_dir, f"ckpt_epoch_{epoch+1}.json"))
    return losses