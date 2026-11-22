"""Versioned OneCore v3 architecture components.

V3 is intentionally checkpoint-incompatible with the v2 baseline.
"""
from .audio import AudioEncoding, NeuralAudioCodec, ResidualVectorQuantizer
from .core import OneCoreV3, SharedSemanticCore
from .video import TemporalVideoCodec, VideoEncoding
from .vision import ImageEncoding, VariableResolutionImageCodec

__all__ = [
    "AudioEncoding", "NeuralAudioCodec", "ResidualVectorQuantizer",
    "OneCoreV3", "SharedSemanticCore",
    "ImageEncoding", "VariableResolutionImageCodec",
    "TemporalVideoCodec", "VideoEncoding",
]
