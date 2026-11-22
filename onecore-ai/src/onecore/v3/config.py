"""Explicit versioned configuration and fingerprinting for OneCore v3."""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass

from .core import OneCoreV3


@dataclass(frozen=True)
class V3Config:
    architecture_version: str = "onecore-v3-prototype-1"
    text_vocab_size: int = 32_000
    width: int = 512
    layers: int = 8
    attention_heads: int = 8
    patch_size: int = 16
    audio_latent_channels: int = 128
    audio_hidden_channels: int = 256
    audio_codebook_size: int = 1024
    audio_quantizer_stages: int = 8
    temporal_layers: int = 2
    max_image_context_tokens: int = 256
    max_video_context_tokens: int = 256
    max_flow_context_tokens: int = 256
    temporal_window_frames: int = 32
    temporal_memory_frames: int = 4
    video_generation_chunk_frames: int = 8
    dropout: float = 0.0

    def __post_init__(self) -> None:
        if self.architecture_version != "onecore-v3-prototype-1":
            raise ValueError("unknown OneCore v3 architecture version")
        if self.text_vocab_size < 2 or self.width < 4 or self.width % 4:
            raise ValueError("invalid vocabulary or shared width")
        if self.width % self.attention_heads:
            raise ValueError("width must be divisible by attention_heads")
        if self.patch_size < 2 or min(
            self.audio_latent_channels, self.audio_hidden_channels,
            self.audio_codebook_size, self.audio_quantizer_stages, self.layers,
            self.temporal_layers, self.max_image_context_tokens,
            self.max_video_context_tokens, self.max_flow_context_tokens,
            self.temporal_window_frames, self.video_generation_chunk_frames,
        ) < 1 or self.temporal_memory_frames < 0:
            raise ValueError("codec and layer dimensions must be positive")
        if not 0.0 <= self.dropout < 1.0:
            raise ValueError("dropout must be in [0, 1)")

    def to_dict(self) -> dict[str, int | float | str]:
        return asdict(self)

    @property
    def fingerprint(self) -> str:
        payload = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def build_model(self) -> OneCoreV3:
        return OneCoreV3(**{
            key: value for key, value in self.to_dict().items()
            if key != "architecture_version"
        })

    def parameter_report(self) -> dict[str, int | str]:
        model = self.build_model()
        return {
            "architecture_version": self.architecture_version,
            "config_sha256": self.fingerprint,
            "trainable_parameters": sum(
                parameter.numel() for parameter in model.parameters()
                if parameter.requires_grad
            ),
            "state_dict_tensors": len(model.state_dict()),
        }
