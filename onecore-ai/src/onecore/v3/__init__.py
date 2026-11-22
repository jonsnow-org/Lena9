"""Versioned OneCore v3 architecture components.

V3 is intentionally checkpoint-incompatible with the v2 baseline.
"""
from .audio import AudioEncoding, NeuralAudioCodec, ResidualVectorQuantizer
from .core import OneCoreV3, SharedSemanticCore
from .config import V3Config
from .training import OneCoreV3Objective, V3ObjectiveWeights, train_v3_discriminator_step, train_v3_step
from .manifest import assert_v3_external_coverage, read_v3_manifest, validate_v3_manifest
from .converter import acquire_missing_media_rows, convert_v2_corpus, restore_v2_media_records, write_v3_manifests
from .video import TemporalVideoCodec, VideoEncoding
from .vision import ImageEncoding, VariableResolutionImageCodec

__all__ = [
    "AudioEncoding", "NeuralAudioCodec", "ResidualVectorQuantizer",
    "OneCoreV3", "SharedSemanticCore", "V3Config",
    "OneCoreV3Objective", "V3ObjectiveWeights", "train_v3_step", "train_v3_discriminator_step",
    "assert_v3_external_coverage", "read_v3_manifest", "validate_v3_manifest",
    "acquire_missing_media_rows", "convert_v2_corpus", "restore_v2_media_records", "write_v3_manifests",
    "ImageEncoding", "VariableResolutionImageCodec",
    "TemporalVideoCodec", "VideoEncoding",
]
