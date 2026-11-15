from __future__ import annotations

import math
from typing import Iterable

import torch
from torch import nn
from torch.nn import functional as F

from .config import ModelConfig


# Special-token offsets in the model's single vocabulary.
BOS, EOS, PAD = 0, 1, 2
IMAGE_START, IMAGE_END = 3, 4
AUDIO_START, AUDIO_END = 5, 6
VIDEO_START, VIDEO_FRAME, VIDEO_END = 7, 8, 9
TOOL_START, TOOL_END, TURN_START, TURN_END = 10, 11, 12, 13
TEXT_START, ANSWER_START, NO_ANSWER, MOTION_START = 14, 15, 16, 17


def patchify(images: torch.Tensor, patch_size: int) -> torch.Tensor:
    """Convert BCHW RGB images into B,N,(P*P*C) non-overlapping patches."""
    if images.ndim != 4 or images.shape[1] != 3:
        raise ValueError("images must have shape [batch, 3, height, width]")
    b, c, h, w = images.shape
    if h % patch_size or w % patch_size:
        raise ValueError("image dimensions must be divisible by patch_size")
    p = patch_size
    return images.reshape(b, c, h // p, p, w // p, p).permute(0, 2, 4, 3, 5, 1).reshape(
        b, (h // p) * (w // p), p * p * c
    )


def unpatchify(patches: torch.Tensor, height: int, width: int, patch_size: int) -> torch.Tensor:
    b, n, d = patches.shape
    p = patch_size
    channels = d // (p * p)
    if d != p * p * channels or n != (height // p) * (width // p):
        raise ValueError("patch tensor shape does not match requested image dimensions")
    return patches.reshape(b, height // p, width // p, p, p, channels).permute(
        0, 5, 1, 3, 2, 4
    ).reshape(b, channels, height, width)



class RMSNorm(nn.Module):
    def __init__(self, width: int, eps: float = 1e-6) -> None:
        super().__init__()
        self.weight = nn.Parameter(torch.ones(width))
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        normed = x.float() * torch.rsqrt(x.float().pow(2).mean(dim=-1, keepdim=True) + self.eps)
        return normed.to(x.dtype) * self.weight


class SharedAttention(nn.Module):
    def __init__(self, cfg: ModelConfig) -> None:
        super().__init__()
        self.heads = cfg.attention_heads
        self.head_dim = cfg.width // cfg.attention_heads
        self.qkv = nn.Linear(cfg.width, 3 * cfg.width, bias=False)
        self.out = nn.Linear(cfg.width, cfg.width, bias=False)
        self.dropout = cfg.dropout

    def forward(self, x: torch.Tensor, causal: bool) -> torch.Tensor:
        b, t, width = x.shape
        q, k, v = self.qkv(x).view(b, t, 3, self.heads, self.head_dim).unbind(dim=2)
        q, k, v = (z.transpose(1, 2) for z in (q, k, v))
        y = F.scaled_dot_product_attention(
            q, k, v, is_causal=causal,
            dropout_p=self.dropout if self.training else 0.0,
        )
        return self.out(y.transpose(1, 2).contiguous().view(b, t, width))


class SwiGLU(nn.Module):
    def __init__(self, width: int) -> None:
        super().__init__()
        hidden = int(width * 8 / 3)
        self.gate = nn.Linear(width, hidden, bias=False)
        self.up = nn.Linear(width, hidden, bias=False)
        self.down = nn.Linear(hidden, width, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.down(F.silu(self.gate(x)) * self.up(x))


class RecurrentBlock(nn.Module):
    """A block whose weights are reused at every recurrent reasoning cycle."""
    def __init__(self, cfg: ModelConfig) -> None:
        super().__init__()
        self.norm1 = RMSNorm(cfg.width)
        self.attn = SharedAttention(cfg)
        self.norm2 = RMSNorm(cfg.width)
        self.mlp = SwiGLU(cfg.width)

    def forward(self, x: torch.Tensor, causal: bool) -> torch.Tensor:
        x = x + self.attn(self.norm1(x), causal=causal)
        x = x + self.mlp(self.norm2(x))
        return x


class VectorQuantizer:
    """Straight-through nearest-neighbour quantization against a slice of shared token embeddings."""
    def __init__(self, owner: "OneCore", offset: int, count: int) -> None:
        self.owner = owner
        self.offset = offset
        self.count = count

    def forward(self, features: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        codebook = self.owner.token_embedding.weight[self.offset:self.offset + self.count]
        flat = features.reshape(-1, features.shape[-1]).float()
        cb = codebook.float()
        distances = (
            flat.pow(2).sum(dim=1, keepdim=True)
            - 2 * flat @ cb.t()
            + cb.pow(2).sum(dim=1).unsqueeze(0)
        )
        local_ids = distances.argmin(dim=-1).view(features.shape[:-1])
        ids = local_ids + self.offset
        quantized = F.embedding(ids, self.owner.token_embedding.weight)
        commitment = F.mse_loss(features.float(), quantized.detach().float())
        codebook_loss = F.mse_loss(quantized.float(), features.detach().float())
        straight_through = features + (quantized - features).detach()
        return ids, straight_through, commitment + 0.25 * codebook_loss

    def __call__(self, features: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        # Deliberately not an nn.Module: it references the owner's shared embedding
        # table, so registering the owner as a child would create a module cycle.
        return self.forward(features)


class OneCore(nn.Module):
    """One randomly initialized, shared-weight, recurrent multimodal model.

    Text, image, audio, video-motion and tool/action symbols share one
    vocabulary, embedding table, recurrent Transformer core and LM head.
    Every trainable front-end/decoder is part of this same checkpoint.
    """
    def __init__(self, cfg: ModelConfig) -> None:
        super().__init__()
        self.cfg = cfg
        self.token_embedding = nn.Embedding(cfg.vocab_size, cfg.width)
        self.position_embedding = nn.Embedding(cfg.max_sequence_length, cfg.width)
        self.modality_embedding = nn.Embedding(5, cfg.width)
        self.cycle_embedding = nn.Embedding(cfg.recurrent_cycles, cfg.width)
        self.blocks = nn.ModuleList([RecurrentBlock(cfg) for _ in range(cfg.unique_blocks)])
        self.final_norm = RMSNorm(cfg.width)
        self.lm_head = nn.Linear(cfg.width, cfg.vocab_size, bias=False)
        self.lm_head.weight = self.token_embedding.weight

        patch_dim = cfg.patch_size * cfg.patch_size * 3
        self.image_encoder = nn.Linear(patch_dim, cfg.width)
        self.image_decoder = nn.Linear(cfg.width, patch_dim)
        self.audio_encoder = nn.Linear(cfg.audio_token_dim, cfg.width)
        self.audio_decoder = nn.Linear(cfg.width, cfg.audio_token_dim)
        self.motion_encoder = nn.Linear(patch_dim, cfg.width)
        self.motion_decoder = nn.Linear(cfg.width, patch_dim)
        self.halt_head = nn.Linear(cfg.width, 1)

        self.vision_quantizer = VectorQuantizer(self, cfg.vision_start, cfg.vision_codebook_size)
        self.audio_quantizer = VectorQuantizer(self, cfg.audio_start, cfg.audio_codebook_size)
        self.motion_quantizer = VectorQuantizer(self, cfg.motion_start, cfg.motion_codebook_size)

        nn.init.normal_(self.token_embedding.weight, mean=0.0, std=0.02)
        nn.init.normal_(self.position_embedding.weight, mean=0.0, std=0.01)
        nn.init.normal_(self.modality_embedding.weight, mean=0.0, std=0.01)
        nn.init.normal_(self.cycle_embedding.weight, mean=0.0, std=0.01)
        # Explicitly tied after initialization; no separate output parameter exists.
        self.lm_head.weight = self.token_embedding.weight

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    @torch.no_grad()
    def initialize_codebook(self, features: torch.Tensor, offset: int, count: int,
                            iterations: int = 8, seed: int = 0) -> None:
        """Initialize a modality codebook from this model's own random-init encoder features.

        This is activation-based codebook seeding, not imported/pretrained weights.
        It prevents the scale mismatch between random embedding rows and encoder
        activations from collapsing every patch onto a tiny subset of codes.
        """
        if iterations < 1:
            raise ValueError("iterations must be positive")
        vectors = features.detach().reshape(-1, self.cfg.width).float()
        if vectors.shape[0] == 0:
            raise ValueError("cannot initialize a codebook from zero feature vectors")
        generator = torch.Generator(device=vectors.device).manual_seed(seed)
        if vectors.shape[0] >= count:
            indices = torch.randperm(vectors.shape[0], generator=generator, device=vectors.device)[:count]
            centers = vectors[indices].clone()
        else:
            indices = torch.randint(vectors.shape[0], (count,), generator=generator, device=vectors.device)
            centers = vectors[indices].clone()
            centers = centers + torch.randn(centers.shape, generator=generator, device=vectors.device) * (
                vectors.std().clamp_min(1e-4) * 0.01
            )
        for _ in range(iterations):
            distances = (
                vectors.square().sum(dim=1, keepdim=True)
                - 2.0 * vectors @ centers.t()
                + centers.square().sum(dim=1).unsqueeze(0)
            )
            assignments = distances.argmin(dim=1)
            sums = torch.zeros_like(centers)
            sums.index_add_(0, assignments, vectors)
            cluster_counts = torch.bincount(assignments, minlength=count).to(vectors.device)
            nonempty = cluster_counts > 0
            centers[nonempty] = sums[nonempty] / cluster_counts[nonempty].unsqueeze(1)
            if (~nonempty).any():
                replacement = torch.randint(
                    vectors.shape[0], ((~nonempty).sum().item(),),
                    generator=generator, device=vectors.device,
                )
                centers[~nonempty] = vectors[replacement]
        self.token_embedding.weight[offset:offset + count].copy_(
            centers.to(self.token_embedding.weight.dtype)
        )

    @torch.no_grad()
    def codebook_usage(self, features: torch.Tensor, offset: int, count: int) -> dict[str, int | float]:
        ids, _, _ = VectorQuantizer(self, offset, count).forward(features)
        used = int(torch.unique(ids).numel())
        return {"used_codes": used, "total_codes": count, "usage_fraction": used / count}

    def _modality_ids(self, ids: torch.Tensor) -> torch.Tensor:
        result = torch.zeros_like(ids)
        result = torch.where((ids >= self.cfg.vision_start) & (ids < self.cfg.audio_start), 1, result)
        result = torch.where((ids >= self.cfg.audio_start) & (ids < self.cfg.motion_start), 2, result)
        result = torch.where((ids >= self.cfg.motion_start) & (ids < self.cfg.special_start), 3, result)
        special = ids >= self.cfg.special_start
        result = torch.where(special, 4, result)
        return result.long()

    def forward_hidden(self, ids: torch.Tensor, causal: bool = True) -> torch.Tensor:
        if ids.ndim != 2:
            raise ValueError("token ids must have shape [batch, sequence]")
        if ids.shape[1] > self.cfg.max_sequence_length:
            raise ValueError("sequence exceeds configured maximum length")
        if ids.min().item() < 0 or ids.max().item() >= self.cfg.vocab_size:
            raise ValueError("token id outside configured vocabulary")
        positions = torch.arange(ids.shape[1], device=ids.device).unsqueeze(0)
        x = self.token_embedding(ids) + self.position_embedding(positions)
        x = x + self.modality_embedding(self._modality_ids(ids))
        for cycle in range(self.cfg.recurrent_cycles):
            x = x + self.cycle_embedding.weight[cycle].view(1, 1, -1)
            for block in self.blocks:
                x = block(x, causal=causal)
        return self.final_norm(x)

    def forward(self, ids: torch.Tensor, causal: bool = True) -> torch.Tensor:
        return self.lm_head(self.forward_hidden(ids, causal=causal))

    def encode_image(self, images: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        images = images.float()
        patches = patchify(images, self.cfg.patch_size)
        features = self.image_encoder(patches)
        ids, quantized, qloss = self.vision_quantizer(features)
        return ids, quantized, qloss

    def decode_image_latents(self, latents: torch.Tensor, height: int | None = None,
                             width: int | None = None) -> torch.Tensor:
        h = height or self.cfg.image_size
        w = width or self.cfg.image_size
        patches = torch.sigmoid(self.image_decoder(latents))
        return unpatchify(patches, h, w, self.cfg.patch_size)

    def decode_image_codes(self, ids: torch.Tensor, height: int | None = None,
                           width: int | None = None) -> torch.Tensor:
        return self.decode_image_latents(self.token_embedding(ids), height, width)

    def encode_audio(self, log_mel: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        if log_mel.ndim != 3 or log_mel.shape[-1] != self.cfg.audio_bins:
            raise ValueError("log_mel must have shape [batch, frames, audio_bins]")
        group = self.cfg.audio_group_frames
        pad = (-log_mel.shape[1]) % group
        if pad:
            log_mel = F.pad(log_mel, (0, 0, 0, pad))
        chunks = log_mel.reshape(log_mel.shape[0], -1, self.cfg.audio_token_dim)
        features = self.audio_encoder(chunks)
        ids, quantized, qloss = self.audio_quantizer(features)
        return ids, quantized, qloss

    def decode_audio_latents(self, latents: torch.Tensor) -> torch.Tensor:
        return self.audio_decoder(latents)

    def decode_audio_codes(self, ids: torch.Tensor) -> torch.Tensor:
        return self.decode_audio_latents(self.token_embedding(ids))

    def encode_motion(self, frame_differences: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        patches = patchify(frame_differences, self.cfg.patch_size)
        features = self.motion_encoder(patches)
        return self.motion_quantizer(features)

    def decode_motion_latents(self, latents: torch.Tensor, height: int | None = None,
                              width: int | None = None) -> torch.Tensor:
        h = height or self.cfg.image_size
        w = width or self.cfg.image_size
        patches = self.motion_decoder(latents)
        return unpatchify(torch.tanh(patches), h, w, self.cfg.patch_size)

    def decode_motion_codes(self, ids: torch.Tensor, height: int | None = None,
                            width: int | None = None) -> torch.Tensor:
        return self.decode_motion_latents(self.token_embedding(ids), height, width)

    @torch.no_grad()
    def generate(self, prompt_ids: torch.Tensor, max_new_tokens: int = 64,
                 allowed_range: tuple[int, int] | None = None,
                 allowed_token_ids: list[int] | None = None,
                 stop_token_ids: list[int] | None = None,
                 temperature: float = 0.8, top_k: int = 40) -> torch.Tensor:
        if prompt_ids.ndim != 2 or prompt_ids.shape[1] == 0:
            raise ValueError("prompt_ids must be a non-empty [batch, sequence] tensor")
        if temperature <= 0 or max_new_tokens < 0:
            raise ValueError("temperature must be positive and max_new_tokens non-negative")
        if allowed_range is not None and allowed_token_ids is not None:
            raise ValueError("choose allowed_range or allowed_token_ids, not both")
        if allowed_range is not None:
            start, end = allowed_range
            if not 0 <= start < end <= self.cfg.vocab_size:
                raise ValueError("invalid allowed token range")
        if allowed_token_ids is not None:
            if not allowed_token_ids or any(i < 0 or i >= self.cfg.vocab_size for i in allowed_token_ids):
                raise ValueError("allowed_token_ids must contain valid token IDs")
        stop_ids = set(stop_token_ids or [])
        if any(i < 0 or i >= self.cfg.vocab_size for i in stop_ids):
            raise ValueError("stop token outside model vocabulary")
        if allowed_range is not None and any(not allowed_range[0] <= i < allowed_range[1] for i in stop_ids):
            raise ValueError("stop tokens must be included in the allowed token set")
        if allowed_token_ids is not None and not stop_ids.issubset(set(allowed_token_ids)):
            raise ValueError("stop tokens must be included in allowed_token_ids")
        self.eval()
        output = prompt_ids
        stopped = torch.zeros(prompt_ids.shape[0], dtype=torch.bool, device=prompt_ids.device)
        for _ in range(max_new_tokens):
            context = output[:, -self.cfg.max_sequence_length:]
            logits = self(context, causal=True)[:, -1, :] / temperature
            if allowed_range is not None:
                mask = torch.ones_like(logits, dtype=torch.bool)
                mask[:, allowed_range[0]:allowed_range[1]] = False
                logits = logits.masked_fill(mask, float("-inf"))
            if allowed_token_ids is not None:
                mask = torch.ones_like(logits, dtype=torch.bool)
                mask[:, allowed_token_ids] = False
                logits = logits.masked_fill(mask, float("-inf"))
            if top_k > 0:
                finite_counts = torch.isfinite(logits).sum(dim=-1)
                k = min(top_k, int(finite_counts.min().item()))
                if k > 0:
                    threshold = torch.topk(logits, k, dim=-1).values[:, -1, None]
                    logits = logits.masked_fill(logits < threshold, float("-inf"))
            next_id = torch.multinomial(torch.softmax(logits, dim=-1), num_samples=1)
            next_id = torch.where(stopped[:, None], torch.full_like(next_id, self.cfg.special_id(PAD)), next_id)
            output = torch.cat([output, next_id], dim=1)
            if stop_ids:
                just_stopped = torch.zeros_like(stopped)
                for token_id in stop_ids:
                    just_stopped |= next_id.squeeze(1).eq(token_id)
                stopped |= just_stopped
                if bool(stopped.all()):
                    break
        return output

    @torch.no_grad()
    def generate_text(self, prompt_ids: torch.Tensor, max_new_tokens: int = 128,
                      temperature: float = 0.8, top_k: int = 40) -> torch.Tensor:
        """Generate text-only tokens through the unified core."""
        allowed = list(range(self.cfg.text_vocab_size)) + [self.cfg.special_id(EOS)]
        return self.generate(
            prompt_ids, max_new_tokens=max_new_tokens, allowed_token_ids=allowed,
            stop_token_ids=[self.cfg.special_id(EOS)], temperature=temperature, top_k=top_k,
        )

    @torch.no_grad()
    def generate_tool_payload(self, prompt_ids: torch.Tensor, max_new_tokens: int = 96,
                              temperature: float = 0.5, top_k: int = 20) -> torch.Tensor:
        """Generate a text-encoded JSON tool payload; caller must validate with ToolRuntime."""
        return self.generate(
            prompt_ids, max_new_tokens=max_new_tokens,
            allowed_range=(0, self.cfg.text_vocab_size),
            temperature=temperature, top_k=top_k,
        )

    @torch.no_grad()
    def forward_hidden_adaptive(self, ids: torch.Tensor, min_cycles: int = 1,
                                max_cycles: int | None = None,
                                tolerance: float = 0.015) -> tuple[torch.Tensor, int]:
        """Inference-time recurrent compute, stopping when next-token distributions stabilize.

        Training uses the configured fixed cycle count. This parameter-free
        rule is an adaptive-compute heuristic, not a learned halting guarantee.
        """
        if ids.ndim != 2 or ids.shape[1] > self.cfg.max_sequence_length:
            raise ValueError("invalid token tensor for adaptive inference")
        max_cycles = max_cycles or self.cfg.recurrent_cycles
        if not 1 <= min_cycles <= max_cycles <= self.cfg.recurrent_cycles:
            raise ValueError("adaptive cycles must be within configured recurrent depth")
        positions = torch.arange(ids.shape[1], device=ids.device).unsqueeze(0)
        x = self.token_embedding(ids) + self.position_embedding(positions)
        x = x + self.modality_embedding(self._modality_ids(ids))
        previous_logits = None
        used_cycles = max_cycles
        for cycle in range(max_cycles):
            x = x + self.cycle_embedding.weight[cycle].view(1, 1, -1)
            for block in self.blocks:
                x = block(x, causal=True)
            current_logits = self.lm_head(self.final_norm(x)[:, -1, :]).float()
            if cycle + 1 >= min_cycles and previous_logits is not None:
                delta = (torch.softmax(current_logits, -1) - torch.softmax(previous_logits, -1)).abs().mean()
                if float(delta) <= tolerance:
                    used_cycles = cycle + 1
                    break
            previous_logits = current_logits
        return self.final_norm(x), used_cycles

    @torch.no_grad()
    def generate_image(self, max_new_tokens: int | None = None,
                       temperature: float = 0.8, top_k: int = 40) -> tuple[torch.Tensor, torch.Tensor]:
        prompt = torch.tensor([[self.cfg.special_id(BOS), self.cfg.special_id(IMAGE_START)]])
        count = max_new_tokens or self.cfg.image_tokens_per_frame
        generated = self.generate(
            prompt, max_new_tokens=count,
            allowed_range=(self.cfg.vision_start, self.cfg.audio_start),
            temperature=temperature, top_k=top_k,
        )
        codes = generated[:, prompt.shape[1]:]
        return codes, self.decode_image_codes(codes)

    @torch.no_grad()
    def generate_audio(self, code_count: int, temperature: float = 0.8,
                       top_k: int = 40) -> tuple[torch.Tensor, torch.Tensor]:
        if code_count <= 0:
            raise ValueError("audio code_count must be positive")
        prompt = torch.tensor([[self.cfg.special_id(BOS), self.cfg.special_id(AUDIO_START)]])
        generated = self.generate(
            prompt, max_new_tokens=code_count,
            allowed_range=(self.cfg.audio_start, self.cfg.motion_start),
            temperature=temperature, top_k=top_k,
        )
        codes = generated[:, prompt.shape[1]:]
        mel = self.decode_audio_codes(codes).reshape(
            codes.shape[0], -1, self.cfg.audio_bins
        )
        return codes, mel

    @torch.no_grad()
    def generate_video(self, frame_count: int = 4, temperature: float = 0.8,
                       top_k: int = 40) -> tuple[torch.Tensor, torch.Tensor]:
        """Autoregressively generate a frame/motion token stream through the shared core."""
        if not 1 <= frame_count <= self.cfg.max_video_frames:
            raise ValueError(f"frame_count must be between 1 and {self.cfg.max_video_frames}")
        prompt = torch.tensor([[
            self.cfg.special_id(BOS), self.cfg.special_id(VIDEO_START),
            self.cfg.special_id(VIDEO_FRAME),
        ]])
        frame_codes = self.generate(
            prompt, max_new_tokens=self.cfg.image_tokens_per_frame,
            allowed_range=(self.cfg.vision_start, self.cfg.audio_start),
            temperature=temperature, top_k=top_k,
        )[:, prompt.shape[1]:]
        stream = torch.cat([prompt, frame_codes], dim=1)
        frames = [self.decode_image_codes(frame_codes)]
        for _ in range(frame_count - 1):
            motion_prefix = torch.tensor([[self.cfg.special_id(MOTION_START)]])
            stream = torch.cat([stream, motion_prefix], dim=1)
            motion_codes_full = self.generate(
                stream, max_new_tokens=self.cfg.image_tokens_per_frame,
                allowed_range=(self.cfg.motion_start, self.cfg.special_start),
                temperature=temperature, top_k=top_k,
            )
            motion_codes = motion_codes_full[:, stream.shape[1]:]
            stream = torch.cat([motion_codes_full, torch.tensor([[self.cfg.special_id(VIDEO_FRAME)]])], dim=1)
            frame_codes_full = self.generate(
                stream, max_new_tokens=self.cfg.image_tokens_per_frame,
                allowed_range=(self.cfg.vision_start, self.cfg.audio_start),
                temperature=temperature, top_k=top_k,
            )
            frame_codes = frame_codes_full[:, stream.shape[1]:]
            stream = frame_codes_full
            frames.append(self.decode_image_codes(frame_codes))
        return torch.cat(frames, dim=0), stream

    def adaptive_thought_steps(self, ids: torch.Tensor) -> torch.Tensor:
        """Predict a scalar continuation score per token; used by research evaluation only."""
        hidden = self.forward_hidden(ids, causal=True)
        return torch.sigmoid(self.halt_head(hidden)).squeeze(-1)

    def parameter_report(self) -> dict[str, int | float]:
        total = self.count_parameters()
        return {
            "parameters": total,
            "parameters_millions": round(total / 1_000_000, 3),
            "fp32_weight_bytes": total * 4,
            "fp16_weight_bytes": total * 2,
            "theoretical_4bit_weight_bytes": math.ceil(total / 2),
            "theoretical_1_58bit_weight_bytes": math.ceil(total * 1.58 / 8),
            "quantization_status": "full-precision training; low-bit packing is not yet enabled",
            "unique_blocks": self.cfg.unique_blocks,
            "recurrent_cycles": self.cfg.recurrent_cycles,
            "effective_block_applications": self.cfg.unique_blocks * self.cfg.recurrent_cycles,
        }
