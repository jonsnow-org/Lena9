from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import torch
from PIL import Image
from tokenizers import Tokenizer

from .audio import log_mel_to_waveform
from .model import (
    AUDIO_END, AUDIO_START, BOS, EOS, IMAGE_END, IMAGE_START, MOTION_START,
    TEXT_START, TOOL_START, VIDEO_END, VIDEO_FRAME, VIDEO_START, OneCore,
)
from .tool_runtime import ToolRuntime


class InferenceSession:
    """Single-checkpoint multimodal inference and safe local-tool execution."""

    def __init__(self, model: OneCore, tokenizer: Tokenizer,
                 tools: ToolRuntime | None = None) -> None:
        self.model = model.eval()
        self.tokenizer = tokenizer
        self.tools = tools or ToolRuntime()
        self.cfg = model.cfg
        self.device = next(model.parameters()).device

    def _text_ids(self, text: str) -> list[int]:
        ids = self.tokenizer.encode(text).ids
        if not ids or any(token < 0 or token >= self.cfg.text_vocab_size for token in ids):
            raise ValueError("input tokenizer IDs are outside the model text vocabulary")
        return ids

    def _prompt(self, text: str) -> list[int]:
        return [self.cfg.special_id(BOS), *self._text_ids(text)]

    def _generate_completion(
        self,
        prefix: torch.Tensor,
        max_new_tokens: int,
        allowed_token_ids: list[int] | None = None,
        allowed_range: tuple[int, int] | None = None,
        temperature: float = 0.8,
        top_k: int = 40,
        decoding: str = "causal",
        diffusion_steps: int = 8,
    ) -> torch.Tensor:
        """Run either the causal baseline or OneCore's native latent-diffusion writer."""
        if decoding == "causal":
            full = self.model.generate(
                prefix,
                max_new_tokens=max_new_tokens,
                allowed_token_ids=allowed_token_ids,
                allowed_range=allowed_range,
                temperature=temperature,
                top_k=top_k,
            )
            return full[:, prefix.shape[1]:]
        if decoding != "tldm":
            raise ValueError("decoding must be 'causal' or 'tldm'")
        if allowed_token_ids is not None and allowed_range is not None:
            raise ValueError("choose allowed_token_ids or allowed_range, not both")
        allowed = allowed_token_ids
        if allowed_range is not None:
            start, end = allowed_range
            allowed = list(range(start, end))
        return self.model.generate_tldm(
            prefix,
            block_size=max_new_tokens,
            diffusion_steps=diffusion_steps,
            allowed_token_ids=allowed,
            temperature=temperature,
            top_k=top_k,
        )

    @staticmethod
    def _as_image_batch(image: torch.Tensor) -> torch.Tensor:
        if image.ndim == 3:
            image = image.unsqueeze(0)
        if image.ndim != 4 or image.shape[1] != 3:
            raise ValueError("image must have shape [3,H,W] or [1,3,H,W]")
        return image.float()

    def chat(self, prompt: str, max_new_tokens: int = 160,
             temperature: float = 0.8, top_k: int = 40,
             decoding: str = "causal", diffusion_steps: int = 8) -> str:
        ids = torch.tensor([self._prompt(prompt)], dtype=torch.long, device=self.device)
        allowed = list(range(self.cfg.text_vocab_size)) + [self.cfg.special_id(EOS)]
        new_ids = self._generate_completion(
            ids, max_new_tokens=max_new_tokens, allowed_token_ids=allowed,
            temperature=temperature, top_k=top_k, decoding=decoding,
            diffusion_steps=diffusion_steps,
        )[0].tolist()
        eos = self.cfg.special_id(EOS)
        if eos in new_ids:
            new_ids = new_ids[:new_ids.index(eos)]
        new_ids = [token for token in new_ids if token < self.cfg.text_vocab_size]
        return self.tokenizer.decode(new_ids, skip_special_tokens=True)

    def describe_image(self, image: torch.Tensor, prompt: str = "Describe the image.",
                       max_new_tokens: int = 120, decoding: str = "causal",
                       diffusion_steps: int = 8) -> str:
        batch = self._as_image_batch(image).to(self.device)
        image_ids, _, _ = self.model.encode_image(batch)
        prefix = [
            self.cfg.special_id(BOS), self.cfg.special_id(IMAGE_START),
            *image_ids[0].flatten().tolist(), self.cfg.special_id(IMAGE_END),
            self.cfg.special_id(TEXT_START), *self._text_ids(prompt),
        ]
        return self._continue_text(prefix, max_new_tokens, decoding=decoding, diffusion_steps=diffusion_steps)

    def describe_audio(self, log_mel: torch.Tensor, prompt: str = "Describe the sound.",
                       max_new_tokens: int = 120, decoding: str = "causal",
                       diffusion_steps: int = 8) -> str:
        if log_mel.ndim == 2:
            log_mel = log_mel.unsqueeze(0)
        if log_mel.ndim != 3:
            raise ValueError("log_mel must have shape [frames,bins] or [1,frames,bins]")
        ids, _, _ = self.model.encode_audio(log_mel.to(self.device).float())
        prefix = [
            self.cfg.special_id(BOS), self.cfg.special_id(AUDIO_START),
            *ids[0].flatten().tolist(), self.cfg.special_id(AUDIO_END),
            self.cfg.special_id(TEXT_START), *self._text_ids(prompt),
        ]
        return self._continue_text(prefix, max_new_tokens, decoding=decoding, diffusion_steps=diffusion_steps)

    def describe_video(self, frames: Iterable[torch.Tensor],
                       prompt: str = "Describe the video and its motion.",
                       max_new_tokens: int = 160, decoding: str = "causal",
                       diffusion_steps: int = 8) -> str:
        images = [self._as_image_batch(frame).to(self.device) for frame in frames]
        if not 1 <= len(images) <= self.cfg.max_video_frames:
            raise ValueError(f"video must contain 1..{self.cfg.max_video_frames} frames")
        prefix = [self.cfg.special_id(BOS), self.cfg.special_id(VIDEO_START)]
        previous = None
        for image in images:
            ids, _, _ = self.model.encode_image(image)
            prefix.extend([self.cfg.special_id(VIDEO_FRAME), *ids[0].flatten().tolist()])
            if previous is not None:
                motion_ids, _, _ = self.model.encode_motion(image - previous)
                prefix.extend([self.cfg.special_id(MOTION_START), *motion_ids[0].flatten().tolist()])
            previous = image
        prefix.extend([
            self.cfg.special_id(VIDEO_END), self.cfg.special_id(TEXT_START),
            *self._text_ids(prompt),
        ])
        return self._continue_text(prefix, max_new_tokens, decoding=decoding, diffusion_steps=diffusion_steps)

    def generate_image(self, prompt: str, temperature: float = 0.9,
                       top_k: int = 40, decoding: str = "causal",
                       diffusion_steps: int = 8) -> torch.Tensor:
        prefix = torch.tensor([[
            *self._prompt(prompt), self.cfg.special_id(IMAGE_START)
        ]], dtype=torch.long, device=self.device)
        codes = self._generate_completion(
            prefix, self.cfg.image_tokens_per_frame,
            allowed_range=(self.cfg.vision_start, self.cfg.audio_start),
            temperature=temperature, top_k=top_k, decoding=decoding,
            diffusion_steps=diffusion_steps,
        )
        return self.model.decode_image_codes(codes)

    def generate_audio(self, prompt: str, code_count: int = 32,
                       temperature: float = 0.9, top_k: int = 40,
                       griffin_lim_iterations: int = 24, decoding: str = "causal",
                       diffusion_steps: int = 8) -> tuple[torch.Tensor, torch.Tensor]:
        if code_count < 1:
            raise ValueError("code_count must be positive")
        prefix = torch.tensor([[
            *self._prompt(prompt), self.cfg.special_id(AUDIO_START)
        ]], dtype=torch.long, device=self.device)
        codes = self._generate_completion(
            prefix, code_count,
            allowed_range=(self.cfg.audio_start, self.cfg.motion_start),
            temperature=temperature, top_k=top_k, decoding=decoding,
            diffusion_steps=diffusion_steps,
        )
        log_mel = self.model.decode_audio_codes(codes).reshape(
            codes.shape[0], -1, self.cfg.audio_bins
        )
        waveform = log_mel_to_waveform(
            log_mel[0], n_iter=griffin_lim_iterations,
        )
        return waveform.cpu(), log_mel.cpu()

    def generate_video(self, prompt: str, frame_count: int = 4,
                       temperature: float = 0.9, top_k: int = 40,
                       decoding: str = "causal", diffusion_steps: int = 8) -> torch.Tensor:
        if not 1 <= frame_count <= self.cfg.max_video_frames:
            raise ValueError(f"frame_count must be between 1 and {self.cfg.max_video_frames}")
        prefix = torch.tensor([[
            *self._prompt(prompt), self.cfg.special_id(VIDEO_START),
            self.cfg.special_id(VIDEO_FRAME),
        ]], dtype=torch.long, device=self.device)
        image_range = (self.cfg.vision_start, self.cfg.audio_start)
        motion_range = (self.cfg.motion_start, self.cfg.special_start)
        first_codes = self._generate_completion(
            prefix, self.cfg.image_tokens_per_frame, allowed_range=image_range,
            temperature=temperature, top_k=top_k, decoding=decoding,
            diffusion_steps=diffusion_steps,
        )
        frames = [self.model.decode_image_codes(first_codes)]
        stream = torch.cat([prefix, first_codes], dim=1)
        for _ in range(frame_count - 1):
            motion_prefix = torch.cat([
                stream, torch.tensor([[self.cfg.special_id(MOTION_START)]], device=self.device)
            ], dim=1)
            motion_codes = self._generate_completion(
                motion_prefix, self.cfg.image_tokens_per_frame, allowed_range=motion_range,
                temperature=temperature, top_k=top_k, decoding=decoding,
                diffusion_steps=diffusion_steps,
            )
            next_frame_prefix = torch.cat([
                motion_prefix, motion_codes,
                torch.tensor([[self.cfg.special_id(VIDEO_FRAME)]], device=self.device)
            ], dim=1)
            frame_codes = self._generate_completion(
                next_frame_prefix, self.cfg.image_tokens_per_frame, allowed_range=image_range,
                temperature=temperature, top_k=top_k, decoding=decoding,
                diffusion_steps=diffusion_steps,
            )
            frames.append(self.model.decode_image_codes(frame_codes))
            stream = torch.cat([next_frame_prefix, frame_codes], dim=1)
        return torch.cat(frames, dim=0)

    def generate_tool_call(self, prompt: str, max_new_tokens: int = 96,
                           decoding: str = "causal", diffusion_steps: int = 8) -> dict:
        prefix = torch.tensor([[
            *self._prompt(prompt), self.cfg.special_id(TOOL_START)
        ]], dtype=torch.long, device=self.device)
        allowed = list(range(self.cfg.text_vocab_size)) + [
            self.cfg.special_id(TOOL_END), self.cfg.special_id(EOS),
        ]
        payload_ids = self._generate_completion(
            prefix, max_new_tokens, allowed_token_ids=allowed,
            temperature=0.5, top_k=20, decoding=decoding,
            diffusion_steps=diffusion_steps,
        )[0].tolist()
        terminators = {self.cfg.special_id(TOOL_END), self.cfg.special_id(EOS)}
        stop_positions = [index for index, token in enumerate(payload_ids) if token in terminators]
        if stop_positions:
            payload_ids = payload_ids[:min(stop_positions)]
        payload_ids = [token for token in payload_ids if token < self.cfg.text_vocab_size]
        payload = self.tokenizer.decode(payload_ids, skip_special_tokens=True).strip()
        # Validate strict JSON and allowlisted tool name before dispatch. The model's
        # generated string is untrusted data, never Python or shell code.
        parsed = json.loads(payload)
        return {"payload": payload, "execution": self.tools.dispatch(parsed)}

    def _continue_text(self, prefix: list[int], max_new_tokens: int,
                       decoding: str = "causal", diffusion_steps: int = 8) -> str:
        ids = torch.tensor([prefix], dtype=torch.long, device=self.device)
        allowed = list(range(self.cfg.text_vocab_size)) + [self.cfg.special_id(EOS)]
        generated = self._generate_completion(
            ids, max_new_tokens, allowed_token_ids=allowed,
            decoding=decoding, diffusion_steps=diffusion_steps,
        )[0].tolist()
        eos = self.cfg.special_id(EOS)
        if eos in generated:
            generated = generated[:generated.index(eos)]
        generated = [token for token in generated if token < self.cfg.text_vocab_size]
        return self.tokenizer.decode(generated, skip_special_tokens=True)
