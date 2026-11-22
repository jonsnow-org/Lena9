"""Versioned OneCore v3 architecture components.

V3 is intentionally checkpoint-incompatible with the v2 baseline.
"""
from .audio import AudioEncoding, NeuralAudioCodec, ResidualVectorQuantizer
from .core import OneCoreV3, SharedSemanticCore
from .config import V3Config
from .training import OneCoreV3Objective, V3ObjectiveWeights, train_v3_discriminator_step, train_v3_step
from .video import TemporalVideoCodec, VideoEncoding
from .vision import ImageEncoding, VariableResolutionImageCodec

__all__ = [
    "AudioEncoding", "NeuralAudioCodec", "ResidualVectorQuantizer",
    "OneCoreV3", "SharedSemanticCore", "V3Config",
    "OneCoreV3Objective", "V3ObjectiveWeights", "train_v3_step", "train_v3_discriminator_step",
    "ImageEncoding", "VariableResolutionImageCodec",
    "TemporalVideoCodec", "VideoEncoding",
]
