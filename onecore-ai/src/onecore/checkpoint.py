from __future__ import annotations

import hashlib
import json
import os
import random
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import torch

FORMAT_VERSION = 2


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_checkpoint(
    path: str | Path,
    model: torch.nn.Module,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler.LRScheduler | None,
    step: int,
    config: dict[str, Any],
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Atomically save model, optimizer, scheduler, RNG, config and lineage."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "format_version": FORMAT_VERSION,
        "step": int(step),
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "scheduler": scheduler.state_dict() if scheduler is not None else None,
        "config": config,
        "metadata": metadata or {},
        "python_rng": random.getstate(),
        "numpy_rng": np.random.get_state(),
        "torch_rng": torch.get_rng_state(),
    }
    fd, temporary = tempfile.mkstemp(prefix=target.name, suffix=".tmp", dir=target.parent)
    os.close(fd)
    try:
        torch.save(payload, temporary)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return {
        "path": str(target), "sha256": sha256_file(target),
        "bytes": target.stat().st_size, "step": int(step),
    }


def load_checkpoint(
    path: str | Path,
    model: torch.nn.Module,
    optimizer: torch.optim.Optimizer | None = None,
    scheduler: torch.optim.lr_scheduler.LRScheduler | None = None,
    map_location: str = "cpu",
) -> tuple[int, dict[str, Any]]:
    """Strict restore: architecture, optimizer, scheduler and RNG must match."""
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"checkpoint not found: {source}")
    payload = torch.load(source, map_location=map_location, weights_only=False)
    if payload.get("format_version") != FORMAT_VERSION:
        raise ValueError(
            f"unsupported checkpoint format {payload.get('format_version')}; expected {FORMAT_VERSION}"
        )
    model.load_state_dict(payload["model"], strict=True)
    if optimizer is not None:
        if "optimizer" not in payload:
            raise ValueError("checkpoint does not contain optimizer state")
        optimizer.load_state_dict(payload["optimizer"])
    if scheduler is not None:
        if payload.get("scheduler") is None:
            raise ValueError("checkpoint does not contain scheduler state")
        scheduler.load_state_dict(payload["scheduler"])
    if "python_rng" in payload:
        random.setstate(payload["python_rng"])
    if "numpy_rng" in payload:
        np.random.set_state(payload["numpy_rng"])
    if "torch_rng" in payload:
        torch.set_rng_state(payload["torch_rng"])
    return int(payload["step"]), payload


def write_json_atomic(path: str | Path, data: dict[str, Any]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=target.name, suffix=".tmp", dir=target.parent)
    os.close(fd)
    try:
        Path(temporary).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
