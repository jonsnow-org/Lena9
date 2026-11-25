from __future__ import annotations

import random
from typing import Iterable


def generate_text_samples(count: int = 10, seed: int = 0) -> list[str]:
    rng = random.Random(seed)
    samples = []
    for _ in range(count):
        a = rng.randint(1, 20)
        b = rng.randint(1, 20)
        samples.append(f"{a} + {b} = {a + b}")
    return samples


def generate_image_patches(count: int = 4, size: int = 8) -> list[list[list[int]]]:
    rng = random.Random(1)
    return [[[rng.randint(0, 255) for _ in range(3)] for _ in range(size)] for _ in range(count)]