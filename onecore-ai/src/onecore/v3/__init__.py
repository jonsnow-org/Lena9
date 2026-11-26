"""Versioned OneCore v3 architecture components.

V3 is intentionally checkpoint-incompatible with the v2 baseline.
"""
from .audio import AudioEncoding, NeuralAudioCodec, ResidualVectorQuantizer
from .core import OneCoreV3, SharedSemanticCore
from .config import V3Config
from .checkpoint import (
    V3_CHECKPOINT_FORMAT_VERSION, V3_DATA_STATE_FORMAT_VERSION,
    fingerprint_validated_v3_manifests,
    load_v3_checkpoint, save_v3_checkpoint,
)
from .training import (
    OneCoreV3Objective, V3ObjectiveWeights, train_v3_discriminator_step,
    train_v3_joint_step, train_v3_step,
)
from .dataset import V3JointDataLoader, V3JointMicroBatch
from .manifest import assert_v3_external_coverage, read_v3_manifest, validate_v3_manifest
from .tokenizer import (
    SPECIAL_TOKENS as V3_SPECIAL_TOKENS,
    iter_external_v3_train_text,
    train_v3_tokenizer,
    verify_v3_tokenizer,
)
from .checkpoint_audit import audit_checkpoint_round_trip
from .evaluation import evaluate_v3_heldout_splits
from .inference import OneCoreV3Inference
from .video import TemporalVideoCodec, VideoEncoding
from .vision import ImageEncoding, VariableResolutionImageCodec

__all__ = [
    "AudioEncoding", "NeuralAudioCodec", "ResidualVectorQuantizer",
    "OneCoreV3", "SharedSemanticCore", "V3Config", "OneCoreV3Inference", "audit_checkpoint_round_trip", "evaluate_v3_heldout_splits",
    "V3_CHECKPOINT_FORMAT_VERSION", "V3_DATA_STATE_FORMAT_VERSION",
    "save_v3_checkpoint", "load_v3_checkpoint",
    "fingerprint_validated_v3_manifests",
    "V3_SPECIAL_TOKENS", "iter_external_v3_train_text",
    "train_v3_tokenizer", "verify_v3_tokenizer",
    "OneCoreV3Objective", "V3ObjectiveWeights", "train_v3_step",
    "train_v3_joint_step", "train_v3_discriminator_step",
    "V3JointDataLoader", "V3JointMicroBatch",
    "assert_v3_external_coverage", "read_v3_manifest", "validate_v3_manifest",
    "ImageEncoding", "VariableResolutionImageCodec",
    "TemporalVideoCodec", "VideoEncoding",
]
