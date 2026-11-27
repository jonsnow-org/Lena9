"""The sole OneCore model implementation and its training/evidence interfaces."""
from .core import OneCoreV3
from .config import V3Config
from .checkpoint import (
    V3_CHECKPOINT_FORMAT_VERSION, V3_DATA_STATE_FORMAT_VERSION,
    fingerprint_validated_v3_manifests, load_v3_checkpoint, save_v3_checkpoint,
)
from .training import OneCoreV3Objective, V3ObjectiveWeights, train_v3_joint_step, train_v3_step
from .dataset import V3JointDataLoader, V3JointMicroBatch
from .manifest import assert_v3_external_coverage, read_v3_manifest, validate_v3_manifest
from .tokenizer import (
    SPECIAL_TOKENS as V3_SPECIAL_TOKENS,
    iter_external_v3_train_text, train_v3_tokenizer, verify_v3_tokenizer,
)
from .checkpoint_audit import audit_checkpoint_round_trip
from .evaluation import evaluate_v3_heldout_splits
from .inference import OneCoreV3Inference

__all__ = [
    "OneCoreV3", "V3Config", "OneCoreV3Inference", "OneCoreV3Objective",
    "V3ObjectiveWeights", "train_v3_step", "train_v3_joint_step",
    "V3JointDataLoader", "V3JointMicroBatch", "V3_CHECKPOINT_FORMAT_VERSION",
    "V3_DATA_STATE_FORMAT_VERSION", "fingerprint_validated_v3_manifests",
    "save_v3_checkpoint", "load_v3_checkpoint", "V3_SPECIAL_TOKENS",
    "iter_external_v3_train_text", "train_v3_tokenizer", "verify_v3_tokenizer",
    "audit_checkpoint_round_trip", "evaluate_v3_heldout_splits",
    "assert_v3_external_coverage", "read_v3_manifest", "validate_v3_manifest",
]
