"""The single corrected OneCore V3 architecture and its immutable fingerprint."""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any

from .core import OneCoreV3


@dataclass(frozen=True)
class V3Config:
    architecture_version: str = "onecore-v3-corrected-spec-2"
    width: int = 1024
    unique_blocks: int = 4
    recurrent_cycles: int = 3
    attention_heads: int = 8
    max_sequence_length: int = 512
    text_vocab_size: int = 4096
    vision_codebook_size: int = 512
    audio_codebook_size: int = 256
    motion_codebook_size: int = 256
    special_tokens: int = 24
    patch_size: int = 8
    image_size: int = 64
    audio_bins: int = 80
    audio_group_frames: int = 4
    audio_sample_rate: int = 24_000
    audio_channels: int = 2
    max_video_frames: int = 4
    tldm_latent_slots: int = 16
    dropout: float = 0.05

    def __post_init__(self) -> None:
        if self.architecture_version != "onecore-v3-corrected-spec-2":
            raise ValueError("unknown canonical OneCore architecture contract")
        if self.width <= 0 or self.unique_blocks <= 0 or self.recurrent_cycles <= 0:
            raise ValueError("width, unique_blocks and recurrent_cycles must be positive")
        if self.width % self.attention_heads:
            raise ValueError("width must be divisible by attention_heads")
        if self.image_size % self.patch_size:
            raise ValueError("image_size must be divisible by patch_size")
        if self.max_sequence_length < 2 or self.max_video_frames != 4:
            raise ValueError("the corrected OneCore contract requires sequence length >=2 and max_video_frames=4")
        if (self.text_vocab_size, self.vision_codebook_size, self.audio_codebook_size,
            self.motion_codebook_size, self.special_tokens) != (4096, 512, 256, 256, 24):
            raise ValueError("the corrected shared vocabulary must use 4096/512/256/256/24 tokens")
        if (self.width, self.unique_blocks, self.recurrent_cycles, self.attention_heads,
            self.patch_size, self.image_size, self.audio_bins, self.audio_group_frames,
            self.tldm_latent_slots) != (1024, 4, 3, 8, 8, 64, 80, 4, 16):
            raise ValueError("model tensor dimensions differ from the corrected engineering specification")
        if self.audio_sample_rate != 24_000 or self.audio_channels not in (1, 2):
            raise ValueError("audio must use 24 kHz and one or two source channels")
        if not 0.0 <= self.dropout < 1.0:
            raise ValueError("dropout must be in [0, 1)")

    @property
    def vision_start(self) -> int:
        return self.text_vocab_size

    @property
    def audio_start(self) -> int:
        return self.vision_start + self.vision_codebook_size

    @property
    def motion_start(self) -> int:
        return self.audio_start + self.audio_codebook_size

    @property
    def special_start(self) -> int:
        return self.motion_start + self.motion_codebook_size

    @property
    def vocab_size(self) -> int:
        return self.special_start + self.special_tokens

    @property
    def image_tokens_per_frame(self) -> int:
        side = self.image_size // self.patch_size
        return side * side

    @property
    def audio_token_dim(self) -> int:
        return self.audio_bins * self.audio_group_frames

    def special_id(self, offset: int) -> int:
        if not 0 <= offset < self.special_tokens:
            raise ValueError(f"special token offset {offset} is out of range")
        return self.special_start + offset

    def to_dict(self) -> dict[str, Any]:
        return asdict(self) | {"vocab_size": self.vocab_size}

    @property
    def fingerprint(self) -> str:
        payload = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"), allow_nan=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def build_model(self) -> OneCoreV3:
        return OneCoreV3(self)

    def parameter_report(self) -> dict[str, Any]:
        model = self.build_model()
        return model.parameter_report() | {"config_sha256": self.fingerprint}
