from __future__ import annotations

def train_one_epoch(model, data, epochs: int = 1) -> list[float]:
    losses = []
    for _ in range(epochs):
        total = 0.0
        for mel, target in data:
            total += model.train_step(mel, target)
        losses.append(total / max(1, len(data)))
    return losses