from __future__ import annotations

import json
import math
import random
from typing import List


class NeuralVocoder:
    def __init__(self, in_dim: int = 8, hidden: int = 16, out_dim: int = 1, seed: int = 0) -> None:
        rng = random.Random(seed)
        self.in_dim = in_dim
        self.hidden = hidden
        self.out_dim = out_dim
        self.w1 = [[rng.uniform(-0.5, 0.5) for _ in range(in_dim)] for _ in range(hidden)]
        self.b1 = [0.0 for _ in range(hidden)]
        self.w2 = [[rng.uniform(-0.5, 0.5) for _ in range(hidden)] for _ in range(out_dim)]
        self.b2 = [0.0 for _ in range(out_dim)]

    def _relu(self, x: float) -> float:
        return x if x > 0 else 0.0

    def forward(self, x: List[float]) -> List[float]:
        if len(x) != self.in_dim:
            raise ValueError("input dimension mismatch")
        h = [self._relu(sum(self.w1[i][j] * x[j] for j in range(self.in_dim)) + self.b1[i]) for i in range(self.hidden)]
        out = [sum(self.w2[k][i] * h[i] for i in range(self.hidden)) + self.b2[k] for k in range(self.out_dim)]
        return out

    def backward(self, x: List[float], target: List[float], lr: float = 0.01) -> float:
        pred = self.forward(x)
        # gradient on output weights
        h = [self._relu(sum(self.w1[i][j] * x[j] for j in range(self.in_dim)) + self.b1[i]) for i in range(self.hidden)]
        loss = sum((pred[k] - target[k]) ** 2 for k in range(self.out_dim)) / self.out_dim
        for k in range(self.out_dim):
            grad = 2 * (pred[k] - target[k]) / self.out_dim
            for i in range(self.hidden):
                self.w2[k][i] -= lr * grad * h[i]
            self.b2[k] -= lr * grad
        return loss

    def save_checkpoint(self, path: str) -> None:
        state = {
            "in_dim": self.in_dim,
            "hidden": self.hidden,
            "out_dim": self.out_dim,
            "w1": self.w1,
            "b1": self.b1,
            "w2": self.w2,
            "b2": self.b2,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(state, f)

    @classmethod
    def load_checkpoint(cls, path: str) -> "NeuralVocoder":
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
        obj = cls(state["in_dim"], state["hidden"], state["out_dim"])
        obj.w1 = state["w1"]
        obj.b1 = state["b1"]
        obj.w2 = state["w2"]
        obj.b2 = state["b2"]
        return obj