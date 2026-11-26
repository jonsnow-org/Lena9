"""Independent held-out V3 objective evaluation; no optimizer or train cursor updates."""
from __future__ import annotations

import hashlib
import math
import random
from collections import defaultdict
from statistics import fmean
from typing import Any

import numpy as np
import torch

from .core import OneCoreV3
from .dataset import FAMILIES, V3JointDataLoader
from .training import OneCoreV3Objective


def _require_sha256(value: str, field: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ValueError(f"{field} must be a lowercase SHA-256 digest")
    return value


def evaluate_v3_heldout_splits(
    model: OneCoreV3,
    loader: V3JointDataLoader,
    *,
    checkpoint_sha256: str,
    per_family_records: int = 10,
    families: tuple[str, ...] = FAMILIES,
    seed: int = 20261126,
) -> dict[str, Any]:
    """Measure deterministic objective components on independent validation/test samples."""
    if not isinstance(model, OneCoreV3):
        raise TypeError("model must be an instantiated OneCoreV3")
    if not isinstance(loader, V3JointDataLoader):
        raise TypeError("loader must be a validated V3JointDataLoader")
    checkpoint_sha256 = _require_sha256(checkpoint_sha256, "checkpoint_sha256")
    if model.training:
        raise ValueError("V3 held-out evaluation requires model.eval()")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise ValueError("V3 held-out evaluation requires a model with no pending gradients")
    if (
        not isinstance(families, tuple)
        or not families
        or len(set(families)) != len(families)
        or any(family not in FAMILIES for family in families)
    ):
        raise ValueError("families must be a non-empty tuple of unique V3 families")
    if (
        isinstance(per_family_records, bool)
        or not isinstance(per_family_records, int)
        or not 1 <= per_family_records <= 1000
    ):
        raise ValueError("per_family_records must be an integer from 1 to 1000")
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise ValueError("evaluation seed must be an integer")

    train_state_before = loader.state_dict()
    python_rng_before = random.getstate()
    numpy_rng_before = np.random.get_state()
    torch_rng_before = torch.get_rng_state().clone()
    objective = OneCoreV3Objective(model)
    report: dict[str, Any] = {
        "status": "evaluated",
        "evaluation_kind": "independent_external_only_v3_heldout_objective",
        "architecture_family": "onecore-v3",
        "config_sha256": loader.config.fingerprint,
        "manifest_sha256": loader.manifest_sha256,
        "train_manifest_sha256": loader.train_manifest_sha256,
        "tokenizer_sha256": loader.tokenizer_sha256,
        "checkpoint_sha256": checkpoint_sha256,
        "splits": {},
        "families": list(families),
        "per_family_records": per_family_records,
        "seed": seed,
        "optimizer_updates": 0,
        "training_cursor_unchanged": True,
        "quality_certified": False,
        "interpretation": (
            "Objective components are held-out diagnostics only. They are not "
            "generation-quality certification, and no promotion thresholds are implied."
        ),
    }

    try:
        for split_index, split in enumerate(("validation", "test")):
            split_report: dict[str, Any] = {}
            accumulators: dict[str, dict[str, list[float]]] = {
                family: defaultdict(list) for family in families
            }
            identities: dict[str, list[str]] = {family: [] for family in families}
            for batch_index, item in enumerate(loader.iter_evaluation_micro_batches(
                split,
                per_family=per_family_records,
                families=families,
                seed=seed,
            )):
                if item.metadata.get("split") != split or item.metadata.get("data_class") != "external":
                    raise ValueError("held-out V3 evaluator received a non-held-out or non-external row")
                if item.family not in accumulators:
                    raise ValueError(f"held-out V3 evaluator received an unexpected family: {item.family}")
                torch.manual_seed(seed + split_index * 1_000_003 + batch_index)
                with torch.inference_mode():
                    values = objective(item.batch)
                for name, tensor in values.items():
                    scalar = float(tensor.detach().float().cpu().item())
                    if not math.isfinite(scalar):
                        raise ValueError(f"V3 held-out metric is non-finite: {split}/{item.family}/{name}")
                    accumulators[item.family][name].append(scalar)
                identities[item.family].append(item.record_id)

            for family in families:
                metrics = accumulators[family]
                if len(identities[family]) != per_family_records:
                    raise ValueError(
                        f"V3 held-out evaluation sample count mismatch: "
                        f"{split}/{family}={len(identities[family])}, expected {per_family_records}"
                    )
                split_report[family] = {
                    "sample_count": len(identities[family]),
                    "record_ids_sha256": hashlib.sha256(
                        "\n".join(sorted(identities[family])).encode("utf-8")
                    ).hexdigest(),
                    "mean_losses": {
                        name: fmean(values)
                        for name, values in sorted(metrics.items())
                    },
                }
            report["splits"][split] = split_report
    finally:
        random.setstate(python_rng_before)
        np.random.set_state(numpy_rng_before)
        torch.set_rng_state(torch_rng_before)

    if loader.state_dict() != train_state_before:
        raise RuntimeError("V3 held-out evaluation changed train split cursors")
    if any(parameter.grad is not None for parameter in model.parameters()):
        raise RuntimeError("V3 held-out evaluation left gradients on model parameters")
    return report
