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
    thinker_latents: int = 16
    dropout: float = 0.05
    expected_parameter_count: int | None = None

    def __post_init__(self) -> None:
        if self.width <= 0 or self.unique_blocks <= 0 or self.recurrent_cycles <= 0:
            raise ValueError("width, unique_blocks, and recurrent_cycles must be positive")
        if self.width % self.attention_heads:
            raise ValueError("width must be divisible by attention_heads")
        if self.image_size % self.patch_size:
            raise ValueError("image_size must be divisible by patch_size")
        if self.thinker_latents < 1:
            raise ValueError("thinker_latents must be positive")
        values = (
            self.text_vocab_size, self.vision_codebook_size, self.audio_codebook_size,
            self.motion_codebook_size, self.special_tokens,
        )
        if min(values) <= 0:
            raise ValueError("all vocabulary ranges must be positive")
        if self.expected_parameter_count is None:
            object.__setattr__(self, "expected_parameter_count", self.computed_parameter_count)

    @property
    def computed_parameter_count(self) -> int:
        width = self.width
        hidden = self.hidden_size
        patch_dim = self.patch_size * self.patch_size * 3
        audio_dim = self.audio_bins * self.audio_group_frames
        embeddings = (
            self.vocab_size * width
            + self.max_sequence_length * width
            + 5 * width
            + self.recurrent_cycles * width
        )
        per_block = 2 * width + 4 * width * width + 3 * width * hidden
        final_norm = width
        codecs = (
            patch_dim * width + width
            + width * patch_dim + patch_dim
            + audio_dim * width + width
            + width * audio_dim + audio_dim
            + patch_dim * width + width
            + width * patch_dim + patch_dim
            + width + 1
        )
        return embeddings + self.unique_blocks * per_block + final_norm + codecs

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
        return asdict(self) | {"vocab_size": self.vocab_size, "hidden_size": self.hidden_size}

    @classmethod
    def from_mapping(cls, values: dict[str, Any]) -> "ModelConfig":
        normalized = dict(values)
        aliases = {
            "n_blocks": "unique_blocks",
            "n_cycles": "recurrent_cycles",
            "n_heads": "attention_heads",
        }
        for alias, target in aliases.items():
            if alias in normalized:
                if target in normalized:
                    raise ValueError(f"specify only one of {alias} or {target}")
                normalized[target] = normalized.pop(alias)
        expected_vocab = normalized.pop("vocab_size", None)
        expected_hidden = normalized.pop("hidden_size", None)
        allowed = set(cls.__dataclass_fields__)
        unknown = set(normalized) - allowed
        if unknown:
            raise ValueError(f"unknown model config keys: {sorted(unknown)}")
        model = cls(**normalized)
        if expected_vocab is not None and int(expected_vocab) != model.vocab_size:
            raise ValueError(
                f"model.vocab_size must equal {model.vocab_size} from the configured vocabulary ranges"
            )
        if expected_hidden is not None and int(expected_hidden) != model.hidden_size:
            raise ValueError(
                f"model.hidden_size must equal {model.hidden_size} from int(width * 8 / 3)"
            )
        return model


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
    if raw["model"].get("expected_parameter_count") is None:
        raise ValueError("model.expected_parameter_count must be explicit; silent parameter budgets are forbidden")
    model = ModelConfig.from_mapping(raw["model"])
    if model.expected_parameter_count != model.computed_parameter_count:
        raise ValueError(
            f"model.expected_parameter_count must equal {model.computed_parameter_count} "
            f"from the configured tensor shapes, got {model.expected_parameter_count}"
        )
    train_values = raw.get("training", {})
    allowed = set(TrainConfig.__dataclass_fields__)
    unknown = set(train_values) - allowed
    if unknown:
        raise ValueError(f"unknown training config keys: {sorted(unknown)}")
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
    train = TrainConfig(**train_values)
    return model, train, raw
