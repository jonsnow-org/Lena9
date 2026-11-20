from __future__ import annotations

import math


class NeuralVocoder:
    def __init__(self, hidden: int = 32) -> None:
        self.hidden = hidden
        self.w1 = [0.1] * hidden
        self.b1 = [0.0] * hidden
        self.w2 = [0.1] * hidden
        self.b2 = 0.0

    def forward(self, mel: list[float]) -> list[float]:
        h = [math.tanh(self.w1[i] * (mel[i % len(mel)] if i < len(mel) else 0.0) + self.b1[i]) for i in range(self.hidden)]
        out = [math.tanh(sum(self.w2[j] * h[j] for j in range(self.hidden)) + self.b2)]
        return out

    def train_step(self, mel: list[float], target: float, lr: float = 0.01) -> float:
        pred = self.forward(mel)[0]
        err = pred - target
        # simple gradient update on output bias
        self.b2 -= lr * err
        return abs(err)