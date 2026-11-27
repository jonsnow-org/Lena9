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
    audio_sample_rate: int = 24000
    audio_channels: int = 2
    max_video_frames: int = 4
    tldm_latent_slots: int = 16
    dropout: float = 0.05

    def __post_init__(self) -> None:
        if self.architecture_version not in {"onecore-v3-corrected-spec-2", "onecore-v3-test-fixture"}:
            raise ValueError("unknown OneCore architecture contract")
        fields = (self.width, self.unique_blocks, self.recurrent_cycles, self.attention_heads,
                  self.max_sequence_length, self.text_vocab_size, self.vision_codebook_size,
                  self.audio_codebook_size, self.motion_codebook_size, self.special_tokens,
                  self.patch_size, self.image_size, self.audio_bins, self.audio_group_frames,
                  self.audio_sample_rate, self.max_video_frames, self.tldm_latent_slots)
        if min(fields) < 1:
            raise ValueError("all OneCore dimensions must be positive")
        if self.width % self.attention_heads or self.image_size % self.patch_size:
            raise ValueError("width/heads and image-size/patch-size dimensions must divide exactly")
        if self.max_sequence_length < 2 or self.max_video_frames > 4:
            raise ValueError("sequence length must be >=2 and video cannot exceed four frames")
        if self.audio_sample_rate != 24000 or self.audio_channels not in (1, 2):
            raise ValueError("audio must use 24 kHz and one or two source channels")
        if not 0.0 <= self.dropout < 1.0:
            raise ValueError("dropout must be in [0, 1)")

    @property
    def vision_start(self) -> int: return self.text_vocab_size
    @property
    def audio_start(self) -> int: return self.vision_start + self.vision_codebook_size
    @property
    def motion_start(self) -> int: return self.audio_start + self.audio_codebook_size
    @property
    def special_start(self) -> int: return self.motion_start + self.motion_codebook_size
    @property
    def vocab_size(self) -> int: return self.special_start + self.special_tokens
    @property
    def image_tokens_per_frame(self) -> int: return (self.image_size // self.patch_size) ** 2
    @property
    def audio_token_dim(self) -> int: return self.audio_bins * self.audio_group_frames
    @property
    def hidden_size(self) -> int: return int(self.width * 8 / 3)
    @property
    def video_generation_chunk_frames(self) -> int: return self.max_video_frames
    @property
    def is_canonical(self) -> bool:
        expected = (1024,4,3,8,512,4096,512,256,256,24,8,64,80,4,24000,2,4,16,0.05)
        actual = (self.width,self.unique_blocks,self.recurrent_cycles,self.attention_heads,
                  self.max_sequence_length,self.text_vocab_size,self.vision_codebook_size,
                  self.audio_codebook_size,self.motion_codebook_size,self.special_tokens,
                  self.patch_size,self.image_size,self.audio_bins,self.audio_group_frames,
                  self.audio_sample_rate,self.audio_channels,self.max_video_frames,
                  self.tldm_latent_slots,self.dropout)
        return self.architecture_version == "onecore-v3-corrected-spec-2" and actual == expected

    def special_id(self, offset: int) -> int:
        if isinstance(offset, bool) or not isinstance(offset, int) or not 0 <= offset < self.special_tokens:
            raise ValueError(f"special token offset {offset} is out of range")
        return self.special_start + offset

    def to_dict(self) -> dict[str, Any]: return asdict(self)

    @property
    def fingerprint(self) -> str:
        payload = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"), allow_nan=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def build_model(self) -> OneCoreV3: return OneCoreV3(self)

    def parameter_report(self) -> dict[str, Any]:
        return self.build_model().parameter_report() | {"config_sha256": self.fingerprint}

