from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class ModelConfig:
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
    max_video_frames: int = 4
    dropout: float = 0.05
    expected_parameter_count: int = 57_579_201

    def __post_init__(self) -> None:
        if self.width <= 0 or self.unique_blocks <= 0 or self.recurrent_cycles <= 0:
            raise ValueError("width, unique_blocks, and recurrent_cycles must be positive")
        if self.width % self.attention_heads:
            raise ValueError("width must be divisible by attention_heads")
        if self.image_size % self.patch_size:
            raise ValueError("image_size must be divisible by patch_size")
        values = (
            self.text_vocab_size, self.vision_codebook_size, self.audio_codebook_size,
            self.motion_codebook_size, self.special_tokens,
        )
        if min(values) <= 0:
            raise ValueError("all vocabulary ranges must be positive")

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

    @property
    def hidden_size(self) -> int:
        return int(self.width * 8 / 3)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self) | {"vocab_size": self.vocab_size}

    @classmethod
    def from_mapping(cls, values: dict[str, Any]) -> "ModelConfig":
        allowed = set(cls.__dataclass_fields__)
        unknown = set(values) - allowed
        if unknown:
            raise ValueError(f"unknown model config keys: {sorted(unknown)}")
        return cls(**values)


@dataclass(frozen=True)
class TrainConfig:
    learning_rate: float = 3e-4
    weight_decay: float = 0.1
    adam_betas: tuple[float, float] = (0.9, 0.95)
    gradient_accumulation: int = 4
    max_grad_norm: float = 1.0
    checkpoint_every: int = 25
    max_steps_per_job: int = 250
    total_steps: int = 20_000
    warmup_steps: int = 200
    cpu_threads: int = 4
    tldm_diffusion_weight: float = 0.15

    def __post_init__(self) -> None:
        if self.learning_rate <= 0 or self.gradient_accumulation <= 0:
            raise ValueError("learning rate and gradient accumulation must be positive")
        if len(self.adam_betas) != 2 or not all(0.0 <= value < 1.0 for value in self.adam_betas):
            raise ValueError("adam_betas must contain two values in [0, 1)")
        if self.max_grad_norm <= 0:
            raise ValueError("max_grad_norm must be positive")
        if self.max_steps_per_job <= 0 or self.checkpoint_every <= 0 or self.total_steps <= 0:
            raise ValueError("step limits must be positive")
        if self.warmup_steps < 0 or self.warmup_steps >= self.total_steps:
            raise ValueError("warmup_steps must be in [0, total_steps)")
        if self.cpu_threads < 1:
            raise ValueError("cpu_threads must be positive")
        if self.tldm_diffusion_weight < 0:
            raise ValueError("tldm_diffusion_weight cannot be negative")


def load_config(path: str | Path) -> tuple[ModelConfig, TrainConfig, dict[str, Any]]:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("model"), dict):
        raise ValueError("config must contain a model mapping")
    required_model = {"expected_parameter_count": 57_579_201}
    for key, expected in required_model.items():
        if raw["model"].get(key) != expected:
            raise ValueError(f"model.{key} must equal {expected} (Corrected Specification v2)")
    model = ModelConfig.from_mapping(raw["model"])
    if model.vocab_size != 5144:
        raise ValueError("model vocabulary must be 5144 = 4096+512+256+256+24")
    if model.hidden_size != 2730:
        raise ValueError("derived SwiGLU hidden_size must be int(width*8/3) = 2730")
    train_values = raw.get("training", {})
    required_training = (
        "warmup_steps", "total_steps", "learning_rate", "weight_decay",
        "max_grad_norm", "tldm_diffusion_weight", "adam_betas",
    )
    for key in required_training:
        if key not in train_values:
            raise ValueError(
                f"training.{key} must be explicit in config; silent defaults are forbidden "
                "(Corrected Specification v2)"
            )
    allowed = set(TrainConfig.__dataclass_fields__)
    unknown = set(train_values) - allowed
    if unknown:
        raise ValueError(f"unknown training config keys: {sorted(unknown)}")
    train = TrainConfig(**train_values)
    return model, train, raw
