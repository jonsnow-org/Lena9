"""Inference-only runtime for trusted OneCore V3 checkpoints.

The checkpoint must come from a trusted OneCore training artifact. Its SHA-256
is checked before deserialization. This runtime never executes generated tool
calls or treats model output as code.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Sequence

import numpy as np
import torch
from PIL import Image
from tokenizers import Tokenizer

from .config import V3Config
from .core import OneCoreV3

_REQUIRED_SPECIAL_TOKENS = ("[UNK]", "[BOS]", "[EOS]", "[PAD]")
_HEX = frozenset("0123456789abcdef")


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_sha256(value: str, field: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in _HEX for character in value)
    ):
        raise ValueError(f"{field} must be a lowercase SHA-256 hex digest")
    return value


def _finite_state_tensor(name: str, tensor: torch.Tensor) -> None:
    if not isinstance(tensor, torch.Tensor):
        raise ValueError(f"V3 checkpoint model tensor is invalid: {name}")
    if tensor.is_floating_point() or tensor.is_complex():
        if not torch.isfinite(tensor).all().item():
            raise ValueError(f"V3 checkpoint contains non-finite model weights: {name}")


class OneCoreV3Inference:
    """Read-only multimodal inference facade over one verified V3 checkpoint."""

    def __init__(
        self,
        model: OneCoreV3,
        tokenizer: Tokenizer,
        config: V3Config,
        *,
        checkpoint_sha256: str,
        tokenizer_sha256: str,
        global_step: int,
        device: torch.device,
    ) -> None:
        self.model = model
        self.tokenizer = tokenizer
        self.config = config
        self.checkpoint_sha256 = _require_sha256(checkpoint_sha256, "checkpoint_sha256")
        self.tokenizer_sha256 = _require_sha256(tokenizer_sha256, "tokenizer_sha256")
        self.global_step = global_step
        self.device = device
        self.special_ids = {
            token: tokenizer.token_to_id(token)
            for token in _REQUIRED_SPECIAL_TOKENS
        }
        if any(value is None for value in self.special_ids.values()):
            raise ValueError("V3 inference tokenizer is missing a required special token")
        self.model.eval()
        for parameter in self.model.parameters():
            parameter.requires_grad_(False)

    @classmethod
    def from_checkpoint(
        cls,
        checkpoint_path: str | Path,
        *,
        expected_checkpoint_sha256: str,
        device: str | torch.device = "cpu",
        allow_untrained: bool = False,
    ) -> "OneCoreV3Inference":
        """Load only a hash-pinned checkpoint from a trusted OneCore artifact.

        torch.load must deserialize the full training checkpoint format, which
        contains Python and NumPy RNG state in addition to tensors. Do not point
        this method at arbitrary or user-uploaded pickle files.
        """
        expected_sha = _require_sha256(
            expected_checkpoint_sha256, "expected_checkpoint_sha256"
        )
        path = Path(checkpoint_path).resolve()
        if not path.is_file():
            raise FileNotFoundError(f"OneCore V3 checkpoint not found: {path}")
        actual_sha = sha256_file(path)
        if actual_sha != expected_sha:
            raise ValueError("OneCore V3 checkpoint SHA-256 does not match the trusted artifact digest")

        target_device = torch.device(device)
        if target_device.type == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA was requested for V3 inference but is not available")
        if target_device.type not in {"cpu", "cuda"}:
            raise ValueError("V3 inference supports CPU or CUDA devices only")

        payload = torch.load(path, map_location="cpu", weights_only=False)
        if not isinstance(payload, dict):
            raise ValueError("V3 checkpoint payload must be a mapping")
        version = payload.get("format_version")
        if isinstance(version, bool) or version != 1:
            raise ValueError("unsupported OneCore V3 checkpoint format")
        if payload.get("architecture_family") != "onecore-v3":
            raise ValueError("checkpoint is not a OneCore V3 artifact")

        config_value = payload.get("config")
        if not isinstance(config_value, dict):
            raise ValueError("OneCore V3 checkpoint is missing its architecture config")
        try:
            config = V3Config(**config_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"OneCore V3 checkpoint config is invalid: {exc}") from exc
        if config.to_dict() != config_value:
            raise ValueError("OneCore V3 checkpoint config is not in canonical form")
        if payload.get("config_sha256") != config.fingerprint:
            raise ValueError("OneCore V3 checkpoint configuration fingerprint mismatch")

        raw_step = payload.get("global_step")
        if isinstance(raw_step, bool) or not isinstance(raw_step, int) or raw_step < 0:
            raise ValueError("OneCore V3 checkpoint global_step is invalid")
        if raw_step < 1 and not allow_untrained:
            raise ValueError(
                "refusing inference from an untrained checkpoint; "
                "set allow_untrained=True only for architecture smoke tests"
            )

        tokenizer_json = payload.get("tokenizer_json")
        if not isinstance(tokenizer_json, bytes):
            raise ValueError("OneCore V3 checkpoint is missing its tokenizer JSON bytes")
        tokenizer_sha = hashlib.sha256(tokenizer_json).hexdigest()
        if tokenizer_sha != payload.get("tokenizer_sha256"):
            raise ValueError("OneCore V3 checkpoint tokenizer SHA-256 mismatch")
        try:
            tokenizer = Tokenizer.from_str(tokenizer_json.decode("utf-8"))
        except Exception as exc:
            raise ValueError(f"OneCore V3 checkpoint tokenizer JSON is invalid: {exc}") from exc
        actual_vocab = int(tokenizer.get_vocab_size(with_added_tokens=True))
        saved_vocab = payload.get("tokenizer_vocab_size")
        if (
            isinstance(saved_vocab, bool)
            or not isinstance(saved_vocab, int)
            or actual_vocab != saved_vocab
            or actual_vocab != config.text_vocab_size
        ):
            raise ValueError("OneCore V3 checkpoint tokenizer vocabulary does not match its config")
        if payload.get("tokenizer_file") is not None:
            raise ValueError("unexpected tokenizer path metadata in OneCore V3 checkpoint")
        for token in _REQUIRED_SPECIAL_TOKENS:
            if tokenizer.token_to_id(token) is None:
                raise ValueError(f"OneCore V3 inference tokenizer is missing {token}")

        model_state = payload.get("model_state_dict")
        if not isinstance(model_state, dict):
            raise ValueError("OneCore V3 checkpoint is missing model_state_dict")
        model = config.build_model()
        current_state = model.state_dict()
        if set(model_state) != set(current_state):
            missing = sorted(set(current_state) - set(model_state))
            extra = sorted(set(model_state) - set(current_state))
            raise ValueError(
                "OneCore V3 checkpoint model keys differ from the config "
                f"(missing={missing[:5]}, extra={extra[:5]})"
            )
        for name, current_tensor in current_state.items():
            saved_tensor = model_state[name]
            _finite_state_tensor(name, saved_tensor)
            if saved_tensor.shape != current_tensor.shape or saved_tensor.dtype != current_tensor.dtype:
                raise ValueError(f"OneCore V3 checkpoint tensor shape/dtype mismatch: {name}")
        model.load_state_dict(model_state, strict=True)
        model.to(target_device)
        model.eval()
        return cls(
            model,
            tokenizer,
            config,
            checkpoint_sha256=actual_sha,
            tokenizer_sha256=tokenizer_sha,
            global_step=raw_step,
            device=target_device,
        )

    def _prompt_ids(self, prompt: str, *, append_eos: bool = False) -> list[int]:
        if not isinstance(prompt, str):
            raise TypeError("prompt must be a string")
        encoded = self.tokenizer.encode(prompt, add_special_tokens=False).ids
        values = [int(self.special_ids["[BOS]"]), *encoded]
        if append_eos:
            values.append(int(self.special_ids["[EOS]"]))
        return values

    def _condition_tensor(self, prompt: str | None) -> torch.Tensor | None:
        if prompt is None:
            return None
        ids = self._prompt_ids(prompt, append_eos=True)
        return torch.tensor([ids], dtype=torch.long, device=self.device)

    @torch.inference_mode()
    def generate_text(
        self,
        prompt: str,
        *,
        max_new_tokens: int = 128,
        temperature: float = 0.0,
        top_k: int = 50,
        seed: int | None = None,
        max_context_tokens: int = 512,
    ) -> str:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("text generation prompt must not be empty")
        if isinstance(max_new_tokens, bool) or not isinstance(max_new_tokens, int) or not 1 <= max_new_tokens <= 2048:
            raise ValueError("max_new_tokens must be an integer from 1 to 2048")
        if not math.isfinite(temperature) or temperature < 0 or temperature > 5:
            raise ValueError("temperature must be finite and in [0, 5]")
        if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 1:
            raise ValueError("top_k must be a positive integer")
        if isinstance(max_context_tokens, bool) or not isinstance(max_context_tokens, int) or max_context_tokens < 2:
            raise ValueError("max_context_tokens must be an integer >= 2")

        sequence = self._prompt_ids(prompt, append_eos=False)
        if len(sequence) > max_context_tokens:
            sequence = [sequence[0], *sequence[-(max_context_tokens - 1):]]
        generated: list[int] = []
        generator = None
        if seed is not None:
            generator = torch.Generator(device=self.device)
            generator.manual_seed(int(seed))
        eos_id = int(self.special_ids["[EOS]"])
        blocked_ids = {
            int(self.special_ids["[UNK]"]),
            int(self.special_ids["[BOS]"]),
            int(self.special_ids["[PAD]"]),
        }

        for _ in range(max_new_tokens):
            input_ids = torch.tensor([sequence], dtype=torch.long, device=self.device)
            logits = self.model.forward_text(input_ids)[0, -1].float()
            logits = logits.clone()
            for token_id in blocked_ids:
                logits[token_id] = -torch.inf
            if temperature == 0:
                next_id = int(torch.argmax(logits).item())
            else:
                logits = logits / temperature
                if top_k < logits.numel():
                    top_values, _ = torch.topk(logits, top_k)
                    logits[logits < top_values[-1]] = -torch.inf
                probabilities = torch.softmax(logits, dim=-1)
                next_id = int(torch.multinomial(probabilities, 1, generator=generator).item())
            generated.append(next_id)
            if next_id == eos_id:
                break
            sequence.append(next_id)
            if len(sequence) > max_context_tokens:
                sequence = [sequence[0], *sequence[-(max_context_tokens - 1):]]
        return self.tokenizer.decode(generated, skip_special_tokens=True)

    @torch.inference_mode()
    def generate_image(
        self,
        prompt: str | None,
        *,
        height: int = 256,
        width: int = 256,
        steps: int = 32,
    ) -> torch.Tensor:
        if min(height, width, steps) < 1:
            raise ValueError("image dimensions and flow steps must be positive")
        return self.model.generate_image(
            height,
            width,
            condition_ids=self._condition_tensor(prompt),
            steps=steps,
        )

    @torch.inference_mode()
    def generate_audio(
        self,
        prompt: str | None,
        *,
        samples: int,
        steps: int = 32,
    ) -> torch.Tensor:
        if min(samples, steps) < 1:
            raise ValueError("audio samples and flow steps must be positive")
        return self.model.generate_audio(
            samples,
            condition_ids=self._condition_tensor(prompt),
            steps=steps,
        )

    @torch.inference_mode()
    def generate_video_chunks(
        self,
        prompt: str | None,
        *,
        frames: int,
        height: int,
        width: int,
        steps: int = 32,
        chunk_frames: int | None = None,
    ):
        if min(frames, height, width, steps) < 1:
            raise ValueError("video frame count, dimensions and flow steps must be positive")
        yield from self.model.generate_video_chunks(
            frames,
            height,
            width,
            condition_ids=self._condition_tensor(prompt),
            steps=steps,
            chunk_frames=chunk_frames,
        )

    @torch.inference_mode()
    def generate_video(
        self,
        prompt: str | None,
        *,
        frames: int,
        height: int,
        width: int,
        steps: int = 32,
        chunk_frames: int | None = None,
    ) -> torch.Tensor:
        chunks = list(self.generate_video_chunks(
            prompt,
            frames=frames,
            height=height,
            width=width,
            steps=steps,
            chunk_frames=chunk_frames,
        ))
        return torch.cat(chunks, dim=1)


def _save_image(path: Path, tensor: torch.Tensor) -> None:
    image = tensor[0].detach().float().cpu().clamp(0, 1)
    array = (image.permute(1, 2, 0).numpy() * 255.0).round().astype(np.uint8)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, mode="RGB").save(path)


def _save_audio(path: Path, tensor: torch.Tensor, sample_rate: int) -> None:
    try:
        import soundfile as sf
    except ImportError as exc:
        raise RuntimeError("audio output requires the soundfile package") from exc
    audio = tensor[0].detach().float().cpu().clamp(-1, 1).transpose(0, 1).numpy()
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, sample_rate, subtype="PCM_16")


def _save_video(path: Path, tensor: torch.Tensor, fps: float) -> None:
    try:
        import imageio.v3 as iio
    except ImportError as exc:
        raise RuntimeError("video output requires imageio and imageio-ffmpeg") from exc
    video = tensor[0].detach().float().cpu().clamp(0, 1)
    frames = (video.permute(0, 2, 3, 1).numpy() * 255.0).round().astype(np.uint8)
    path.parent.mkdir(parents=True, exist_ok=True)
    iio.imwrite(path, frames, fps=fps)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run inference from a trusted OneCore V3 checkpoint")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--device", default="cpu", choices=("cpu", "cuda"))
    parser.add_argument("--task", required=True, choices=("text", "image", "audio", "video"))
    parser.add_argument("--prompt", default="")
    parser.add_argument("--output")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--steps", type=int, default=32)
    parser.add_argument("--max-new-tokens", type=int, default=128)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--top-k", type=int, default=50)
    parser.add_argument("--height", type=int, default=256)
    parser.add_argument("--width", type=int, default=256)
    parser.add_argument("--duration-seconds", type=float, default=1.0)
    parser.add_argument("--frames", type=int, default=16)
    parser.add_argument("--fps", type=float, default=8.0)
    args = parser.parse_args(argv)

    runtime = OneCoreV3Inference.from_checkpoint(
        args.checkpoint,
        expected_checkpoint_sha256=args.checkpoint_sha256,
        device=args.device,
    )
    if args.task == "text":
        result = runtime.generate_text(
            args.prompt,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_k=args.top_k,
            seed=args.seed,
        )
        print(result)
        return 0

    if not args.output:
        parser.error("--output is required for image, audio and video tasks")
    output = Path(args.output)
    if args.task == "image":
        _save_image(output, runtime.generate_image(
            args.prompt or None, height=args.height, width=args.width, steps=args.steps
        ))
    elif args.task == "audio":
        if not math.isfinite(args.duration_seconds) or args.duration_seconds <= 0:
            parser.error("--duration-seconds must be finite and positive")
        samples = round(args.duration_seconds * runtime.config.audio_sample_rate)
        _save_audio(output, runtime.generate_audio(
            args.prompt or None, samples=samples, steps=args.steps
        ), runtime.config.audio_sample_rate)
    else:
        if not math.isfinite(args.fps) or args.fps <= 0:
            parser.error("--fps must be finite and positive")
        _save_video(output, runtime.generate_video(
            args.prompt or None,
            frames=args.frames,
            height=args.height,
            width=args.width,
            steps=args.steps,
        ), args.fps)
    print(json.dumps({
        "task": args.task,
        "output": str(output.resolve()),
        "checkpoint_sha256": runtime.checkpoint_sha256,
        "global_step": runtime.global_step,
        "quality_certified": False,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
