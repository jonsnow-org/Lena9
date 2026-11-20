"""Generic bounded training loop for standalone torch modules (e.g. MelVocoder).

OneCore's own resumable trainer lives in `train.py`; this helper is for small
auxiliary modules and for quick, honest loss-curve measurements.
"""
from __future__ import annotations

import os
from typing import Callable, Iterable

import torch
from torch import nn


def train_epochs(model: nn.Module, batches: Iterable[tuple[torch.Tensor, torch.Tensor]],
                 loss_fn: Callable[[torch.Tensor, torch.Tensor], torch.Tensor],
                 epochs: int = 1, lr: float = 1e-3, max_grad_norm: float = 1.0,
                 checkpoint_dir: str | None = None) -> list[float]:
    """Train for `epochs` passes; returns the mean loss per epoch. Raises on NaN/Inf."""
    if epochs < 1 or lr <= 0:
        raise ValueError("epochs and lr must be positive")
    data = list(batches)
    if not data:
        raise ValueError("no training batches supplied")
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
    history: list[float] = []
    model.train()
    for epoch in range(epochs):
        total = 0.0
        for x, y in data:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(x), y)
            if not torch.isfinite(loss):
                raise FloatingPointError("non-finite loss during training")
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            optimizer.step()
            total += float(loss)
        history.append(total / len(data))
        if checkpoint_dir:
            os.makedirs(checkpoint_dir, exist_ok=True)
            tmp = os.path.join(checkpoint_dir, f".ckpt_epoch_{epoch + 1}.tmp")
            torch.save(model.state_dict(), tmp)
            os.replace(tmp, os.path.join(checkpoint_dir, f"ckpt_epoch_{epoch + 1}.pt"))
    return history
