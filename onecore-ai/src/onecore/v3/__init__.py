"""The sole OneCore V3 package with lazy public exports.

Keep importing the package lightweight: tokenizer/config tooling must not eagerly
load dataset, evaluation, checkpoint-audit and inference dependencies.
"""
from __future__ import annotations

from importlib import import_module
from typing import Any

_EXPORTS = {
    "OneCoreV3": (".core", "OneCoreV3"),
    "V3Config": (".config", "V3Config"),
    "V3_CHECKPOINT_FORMAT_VERSION": (".checkpoint", "V3_CHECKPOINT_FORMAT_VERSION"),
    "V3_DATA_STATE_FORMAT_VERSION": (".checkpoint", "V3_DATA_STATE_FORMAT_VERSION"),
    "fingerprint_validated_v3_manifests": (".checkpoint", "fingerprint_validated_v3_manifests"),
    "load_v3_checkpoint": (".checkpoint", "load_v3_checkpoint"),
    "save_v3_checkpoint": (".checkpoint", "save_v3_checkpoint"),
    "OneCoreV3Objective": (".training", "OneCoreV3Objective"),
    "V3ObjectiveWeights": (".training", "V3ObjectiveWeights"),
    "train_v3_joint_step": (".training", "train_v3_joint_step"),
    "train_v3_step": (".training", "train_v3_step"),
    "V3JointDataLoader": (".dataset", "V3JointDataLoader"),
    "V3JointMicroBatch": (".dataset", "V3JointMicroBatch"),
    "assert_v3_external_coverage": (".manifest", "assert_v3_external_coverage"),
    "read_v3_manifest": (".manifest", "read_v3_manifest"),
    "validate_v3_manifest": (".manifest", "validate_v3_manifest"),
    "V3_SPECIAL_TOKENS": (".tokenizer", "SPECIAL_TOKENS"),
    "iter_external_v3_train_text": (".tokenizer", "iter_external_v3_train_text"),
    "train_v3_tokenizer": (".tokenizer", "train_v3_tokenizer"),
    "verify_v3_tokenizer": (".tokenizer", "verify_v3_tokenizer"),
    "audit_checkpoint_round_trip": (".checkpoint_audit", "audit_checkpoint_round_trip"),
    "evaluate_v3_heldout_splits": (".evaluation", "evaluate_v3_heldout_splits"),
    "OneCoreV3Inference": (".inference", "OneCoreV3Inference"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str) -> Any:
    """Load a public API member only when it is actually requested."""
    try:
        module_name, member_name = _EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc
    module = import_module(module_name, __name__)
    value = getattr(module, member_name)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))
