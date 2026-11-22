"""Shared, variable-length semantic backbone and multimodal integration for OneCore v3."""
from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F

from .audio import AudioEncoding, NeuralAudioCodec
from .video import TemporalVideoCodec, VideoEncoding
from .vision import ImageEncoding, VariableResolutionImageCodec


def _sincos_1d(length: int, width: int, *, device: torch.device,
               dtype: torch.dtype) -> torch.Tensor:
    if width % 2:
        raise ValueError("shared width must be even for sinusoidal positions")
    half = width // 2
    inv_freq = torch.exp(
        torch.arange(half, device=device, dtype=torch.float32)
        * (-torch.log(torch.tensor(10_000.0, device=device)) / max(half - 1, 1))
    )
    positions = torch.arange(length, device=device, dtype=torch.float32).unsqueeze(1)
    phase = positions * inv_freq.unsqueeze(0)
    return torch.cat((phase.sin(), phase.cos()), dim=-1).to(dtype=dtype)


class SharedSemanticCore(nn.Module):
    """Shared Transformer over continuous modality latents or text token embeddings.

    Positional features are generated from the current sequence length, so there
    is no learned 512-position table. Attention remains quadratic; long sequences
    still require chunking, memory measurements, and an efficient-attention plan.
    """

    def __init__(self, width: int = 512, layers: int = 8,
                 attention_heads: int = 8, dropout: float = 0.0) -> None:
        super().__init__()
        if width % 2 or width % attention_heads:
            raise ValueError("width must be even and divisible by attention_heads")
        if layers < 1:
            raise ValueError("layers must be positive")
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=width, nhead=attention_heads, dim_feedforward=4 * width,
            dropout=dropout, batch_first=True, norm_first=True, activation="gelu",
        )
        self.layers = nn.TransformerEncoder(encoder_layer, num_layers=layers)
        self.norm = nn.LayerNorm(width)
        self.width = width

    def forward(self, latents: torch.Tensor, *, causal: bool = False) -> torch.Tensor:
        if latents.ndim != 3 or latents.shape[-1] != self.width:
            raise ValueError("latents must have shape [B, sequence, shared_width]")
        if latents.shape[1] < 1:
            raise ValueError("shared sequence cannot be empty")
        positions = _sincos_1d(
            latents.shape[1], self.width, device=latents.device, dtype=latents.dtype
        )
        mask = None
        if causal:
            mask = torch.triu(
                torch.ones(
                    latents.shape[1], latents.shape[1],
                    device=latents.device, dtype=torch.bool,
                ),
                diagonal=1,
            )
        return self.norm(self.layers(latents + positions.unsqueeze(0), mask=mask))


class OneCoreV3(nn.Module):
    """A shared semantic core with variable-resolution/duration modality codecs.

    This class defines the integrated trainable architecture. It is deliberately
    checkpoint-incompatible with v2. It is not a pretrained or quality-certified
    generator; dedicated generation objectives and corpus-scale training remain
    required before claiming production capability.
    """

    def __init__(self, *, text_vocab_size: int = 32_000, width: int = 512,
                 layers: int = 8, attention_heads: int = 8, patch_size: int = 16,
                 audio_latent_channels: int = 128, audio_hidden_channels: int = 256,
                 audio_codebook_size: int = 1024, audio_quantizer_stages: int = 8,
                 temporal_layers: int = 2, dropout: float = 0.0,
                 max_image_context_tokens: int = 256, max_video_context_tokens: int = 256,
                 max_flow_context_tokens: int = 256, temporal_window_frames: int = 32,
                 temporal_memory_frames: int = 4, video_generation_chunk_frames: int = 8) -> None:
        super().__init__()
        if text_vocab_size < 2:
            raise ValueError("text_vocab_size must be at least two")
        if min(max_image_context_tokens, max_video_context_tokens, max_flow_context_tokens,
               video_generation_chunk_frames) < 1 or temporal_window_frames < 1 or temporal_memory_frames < 0:
            raise ValueError("context budgets and temporal windows must be positive; memory non-negative")
        self.width = width
        self.max_image_context_tokens = max_image_context_tokens
        self.max_video_context_tokens = max_video_context_tokens
        self.max_flow_context_tokens = max_flow_context_tokens
        self.video_generation_chunk_frames = video_generation_chunk_frames
        self.text_embedding = nn.Embedding(text_vocab_size, width)
        self.modality_embedding = nn.Embedding(5, width)
        self.shared_core = SharedSemanticCore(width, layers, attention_heads, dropout)
        self.text_head = nn.Linear(width, text_vocab_size, bias=False)
        self.text_head.weight = self.text_embedding.weight
        self.flow_time = nn.Sequential(nn.Linear(1, width), nn.SiLU(), nn.Linear(width, width))
        self.flow_velocity_head = nn.Linear(width, width)

        self.image_codec = VariableResolutionImageCodec(width, patch_size)
        self.audio_codec = NeuralAudioCodec(
            audio_latent_channels, audio_hidden_channels,
            audio_codebook_size, audio_quantizer_stages,
        )
        self.audio_to_shared = nn.Conv1d(audio_latent_channels, width, kernel_size=1)
        self.shared_to_audio = nn.Conv1d(width, audio_latent_channels, kernel_size=1)
        self.video_codec = TemporalVideoCodec(
            width, patch_size, temporal_layers, attention_heads,
            temporal_window_frames, temporal_memory_frames,
        )

    def forward_text(self, token_ids: torch.Tensor) -> torch.Tensor:
        if token_ids.ndim != 2 or token_ids.dtype not in (torch.int32, torch.int64):
            raise ValueError("token_ids must be an integer tensor [B,T]")
        hidden = self.shared_core(
            self.text_embedding(token_ids) + self.modality_embedding.weight[0], causal=True
        )
        return self.text_head(hidden)

    def forward_image(self, images: torch.Tensor) -> tuple[torch.Tensor, ImageEncoding]:
        encoding = self.image_codec.encode(images)
        batch = encoding.tokens.shape[0]
        local = encoding.tokens.reshape(
            batch, encoding.grid_height, encoding.grid_width, self.width
        ).permute(0, 3, 1, 2)
        grid_height, grid_width = encoding.grid_height, encoding.grid_width
        scale = min(1.0, (self.max_image_context_tokens / (grid_height * grid_width)) ** 0.5)
        context_height = max(1, min(grid_height, self.max_image_context_tokens, int(grid_height * scale)))
        context_width = max(1, min(grid_width, self.max_image_context_tokens // context_height))
        context = F.adaptive_avg_pool2d(local, (context_height, context_width))
        context_tokens = context.flatten(2).transpose(1, 2)
        shared_context = self.shared_core(
            context_tokens + self.modality_embedding.weight[1], causal=False
        )
        shared_grid = shared_context.transpose(1, 2).reshape(
            batch, self.width, context_height, context_width
        )
        broadcast = F.interpolate(
            shared_grid, size=(grid_height, grid_width), mode="bilinear", align_corners=False
        )
        processed_tokens = (
            local + broadcast
        ).permute(0, 2, 3, 1).reshape(batch, grid_height * grid_width, self.width)
        processed = ImageEncoding(
            processed_tokens, grid_height, grid_width,
            encoding.image_height, encoding.image_width,
        )
        return self.image_codec.decode(processed), processed

    def forward_audio(self, waveform: torch.Tensor) -> tuple[torch.Tensor, AudioEncoding]:
        encoding = self.audio_codec.encode(waveform)
        shared = self.audio_to_shared(encoding.quantized).transpose(1, 2)
        shared = self.shared_core(
            shared + self.modality_embedding.weight[2], causal=False
        ).transpose(1, 2)
        decoded_latents = self.shared_to_audio(shared)
        processed = AudioEncoding(
            encoding.codes, decoded_latents, encoding.commitment_loss,
            encoding.original_samples, encoding.padded_samples,
        )
        reconstruction = self.audio_codec.decode(processed)
        if waveform.ndim == 2:
            reconstruction = reconstruction.squeeze(1)
        return reconstruction, processed

    def forward_video_chunks(self, video: torch.Tensor,
                             timestamps: torch.Tensor | None = None,
                             frame_chunk_size: int | None = None):
        """Yield decoded input-video chunks with bounded temporal/global context."""
        memory = None
        for encoding in self.video_codec.iter_encode(
            video, timestamps=timestamps, frame_chunk_size=frame_chunk_size
        ):
            batch, frames, patches, width = encoding.tokens.shape
            local = encoding.tokens.reshape(batch, frames * patches, width)
            context = F.adaptive_avg_pool1d(
                local.transpose(1, 2),
                min(self.max_video_context_tokens, local.shape[1]),
            ).transpose(1, 2)
            context = context + self.modality_embedding.weight[3]
            sequence = context if memory is None else torch.cat((memory, context), dim=1)
            shared_sequence = self.shared_core(sequence, causal=True)
            current_shared = shared_sequence[:, -context.shape[1]:]
            broadcast = F.interpolate(
                current_shared.transpose(1, 2), size=local.shape[1],
                mode="linear", align_corners=False,
            ).transpose(1, 2)
            processed_tokens = (local + broadcast).reshape(
                batch, frames, patches, width
            )
            processed = VideoEncoding(
                processed_tokens, encoding.grid_height, encoding.grid_width,
                encoding.frame_count, encoding.image_height, encoding.image_width,
                encoding.timestamps,
            )
            yield self.video_codec.decode_frames(processed)
            history = current_shared if memory is None else torch.cat(
                (memory, current_shared), dim=1
            )
            memory = F.adaptive_avg_pool1d(
                history.transpose(1, 2), min(32, history.shape[1])
            ).transpose(1, 2).detach()

    def forward_video(self, video: torch.Tensor,
                      timestamps: torch.Tensor | None = None,
                      frame_chunk_size: int | None = None) -> tuple[torch.Tensor, VideoEncoding]:
        chunks = list(self.forward_video_chunks(
            video, timestamps=timestamps, frame_chunk_size=frame_chunk_size
        ))
        reconstruction = torch.cat(chunks, dim=1)
        encoding = self.video_codec.encode(video, timestamps=timestamps,
                                           frame_chunk_size=frame_chunk_size)
        return reconstruction, encoding

    def text_condition(self, token_ids: torch.Tensor | None) -> torch.Tensor | None:
        if token_ids is None:
            return None
        if token_ids.ndim != 2 or token_ids.dtype not in (torch.int32, torch.int64):
            raise ValueError("condition token_ids must be an integer tensor [B,T]")
        return self.text_embedding(token_ids) + self.modality_embedding.weight[0]

    def predict_flow_velocity(self, noisy_latents: torch.Tensor, times: torch.Tensor,
                              modality: int,
                              condition_tokens: torch.Tensor | None = None) -> torch.Tensor:
        """Predict the flow-matching velocity for one modality's continuous latents."""
        if noisy_latents.ndim != 3 or noisy_latents.shape[-1] != self.width:
            raise ValueError("noisy_latents must have shape [B,N,shared_width]")
        if not 1 <= modality <= 3:
            raise ValueError("flow modality must be image=1, audio=2, or video=3")
        batch = noisy_latents.shape[0]
        times = torch.as_tensor(times, device=noisy_latents.device, dtype=noisy_latents.dtype)
        if times.ndim == 0:
            times = times.expand(batch)
        if times.shape != (batch,):
            raise ValueError("times must be scalar or shape [B]")
        if condition_tokens is None:
            condition_tokens = noisy_latents.new_zeros((batch, 0, self.width))
        if condition_tokens.ndim != 3 or condition_tokens.shape[0] != batch or condition_tokens.shape[2] != self.width:
            raise ValueError("condition_tokens must have shape [B,C,shared_width]")
        time_features = self.flow_time(times.reshape(batch, 1)).unsqueeze(1)
        modality_features = self.modality_embedding.weight[modality].view(1, 1, -1)
        target_tokens = noisy_latents + time_features + modality_features
        context_budget = self.max_flow_context_tokens
        condition_budget = min(condition_tokens.shape[1], max(0, context_budget // 2))
        target_budget = max(1, context_budget - condition_budget)
        if condition_tokens.shape[1] > condition_budget:
            condition_tokens = F.adaptive_avg_pool1d(
                condition_tokens.transpose(1, 2), condition_budget
            ).transpose(1, 2)
        if target_tokens.shape[1] > target_budget:
            compact_target = F.adaptive_avg_pool1d(
                target_tokens.transpose(1, 2), target_budget
            ).transpose(1, 2)
        else:
            compact_target = target_tokens
        sequence = torch.cat((condition_tokens, compact_target), dim=1)
        hidden = self.shared_core(sequence, causal=False)
        predicted = self.flow_velocity_head(hidden[:, condition_tokens.shape[1]:])
        if predicted.shape[1] != noisy_latents.shape[1]:
            predicted = F.interpolate(
                predicted.transpose(1, 2), size=noisy_latents.shape[1],
                mode="linear", align_corners=False,
            ).transpose(1, 2)
        return predicted

    def flow_matching_loss(self, clean_latents: torch.Tensor, modality: int,
                           condition_tokens: torch.Tensor | None = None,
                           noise: torch.Tensor | None = None,
                           times: torch.Tensor | None = None) -> torch.Tensor:
        """Rectified-flow objective; training data and modality-specific sampling remain external."""
        if clean_latents.ndim != 3 or clean_latents.shape[-1] != self.width:
            raise ValueError("clean_latents must have shape [B,N,shared_width]")
        if noise is None:
            noise = torch.randn_like(clean_latents)
        if noise.shape != clean_latents.shape:
            raise ValueError("noise shape must match clean_latents")
        if times is None:
            times = torch.rand(clean_latents.shape[0], device=clean_latents.device,
                               dtype=clean_latents.dtype)
        times = torch.as_tensor(times, device=clean_latents.device, dtype=clean_latents.dtype)
        if times.ndim == 0:
            times = times.expand(clean_latents.shape[0])
        if times.shape != (clean_latents.shape[0],):
            raise ValueError("times must be scalar or shape [B]")
        noisy = clean_latents * (1.0 - times[:, None, None]) + noise * times[:, None, None]
        target_velocity = noise - clean_latents
        predicted = self.predict_flow_velocity(noisy, times, modality, condition_tokens)
        return torch.nn.functional.mse_loss(predicted, target_velocity)

    @torch.no_grad()
    def sample_flow_latents(self, shape: tuple[int, int, int], modality: int,
                            condition_tokens: torch.Tensor | None = None,
                            steps: int = 32, generator: torch.Generator | None = None,
                            device: torch.device | str | None = None) -> torch.Tensor:
        """Euler sampler for a trained rectified-flow head; untrained output is noise-like."""
        if len(shape) != 3 or min(shape) < 1 or shape[-1] != self.width:
            raise ValueError("shape must be positive [B,N,shared_width]")
        if steps < 1:
            raise ValueError("steps must be positive")
        if modality not in (1, 2, 3):
            raise ValueError("flow modality must be image=1, audio=2, or video=3")
        if device is None:
            device = self.text_embedding.weight.device
        sample = torch.randn(shape, device=device, dtype=self.text_embedding.weight.dtype,
                             generator=generator)
        for index in range(steps):
            time_value = 1.0 - index / steps
            times = torch.full((shape[0],), time_value, device=sample.device,
                               dtype=sample.dtype)
            velocity = self.predict_flow_velocity(sample, times, modality, condition_tokens)
            sample = sample - velocity / steps
        return sample

    @torch.no_grad()
    def generate_image(self, height: int, width: int, condition_ids: torch.Tensor | None = None,
                       steps: int = 32) -> torch.Tensor:
        if min(height, width) < 1:
            raise ValueError("image height and width must be positive")
        patch = self.image_codec.patch_size
        grid_height = (height + patch - 1) // patch
        grid_width = (width + patch - 1) // patch
        condition = self.text_condition(condition_ids)
        batch = 1 if condition is None else condition.shape[0]
        latents = self.sample_flow_latents(
            (batch, grid_height * grid_width, self.width), 1, condition, steps
        )
        return self.image_codec.decode(
            ImageEncoding(latents, grid_height, grid_width, height, width)
        )

    @torch.no_grad()
    def generate_audio(self, samples: int, condition_ids: torch.Tensor | None = None,
                       steps: int = 32) -> torch.Tensor:
        if samples < 1:
            raise ValueError("samples must be positive")
        latent_length = (samples + self.audio_codec.downsample_factor - 1) // self.audio_codec.downsample_factor
        condition = self.text_condition(condition_ids)
        batch = 1 if condition is None else condition.shape[0]
        shared_latents = self.sample_flow_latents(
            (batch, latent_length, self.width), 2, condition, steps
        )
        audio_latents = self.shared_to_audio(shared_latents.transpose(1, 2))
        return self.audio_codec.decode(audio_latents, original_samples=samples)

    @torch.no_grad()
    def generate_video_chunks(self, frames: int, height: int, width: int,
                              condition_ids: torch.Tensor | None = None,
                              timestamps: torch.Tensor | None = None,
                              steps: int = 32, chunk_frames: int | None = None):
        """Yield decoded video chunks while carrying a compact latent memory forward."""
        if min(frames, height, width) < 1:
            raise ValueError("video frames, height, and width must be positive")
        chunk_frames = self.video_generation_chunk_frames if chunk_frames is None else int(chunk_frames)
        if chunk_frames < 1:
            raise ValueError("chunk_frames must be positive")
        patch = self.video_codec.image_codec.patch_size
        grid_height = (height + patch - 1) // patch
        grid_width = (width + patch - 1) // patch
        patches = grid_height * grid_width
        condition = self.text_condition(condition_ids)
        batch = 1 if condition is None else condition.shape[0]
        if timestamps is None:
            timestamps = torch.arange(frames, device=self.text_embedding.weight.device,
                                      dtype=self.text_embedding.weight.dtype)
            timestamps = timestamps.unsqueeze(0).expand(batch, -1)
        if timestamps.shape != (batch, frames):
            raise ValueError("timestamps must have shape [B,frames]")
        memory = None
        for start in range(0, frames, chunk_frames):
            stop = min(frames, start + chunk_frames)
            current_timestamps = timestamps[:, start:stop]
            time_tokens = self.video_codec.time_projection(
                current_timestamps.to(self.text_embedding.weight.dtype).unsqueeze(-1)
            )
            condition_parts = [part for part in (condition, memory, time_tokens) if part is not None]
            current_condition = torch.cat(condition_parts, dim=1)
            current_frames = stop - start
            latents = self.sample_flow_latents(
                (batch, current_frames * patches, self.width), 3,
                current_condition, steps,
            ).reshape(batch, current_frames, patches, self.width)
            encoding = VideoEncoding(
                latents, grid_height, grid_width, current_frames, height, width,
                current_timestamps,
            )
            yield self.video_codec.decode_frames(encoding)
            history = latents.reshape(batch, current_frames * patches, self.width)
            combined_history = history if memory is None else torch.cat((memory, history), dim=1)
            memory = F.adaptive_avg_pool1d(
                combined_history.transpose(1, 2), min(32, combined_history.shape[1])
            ).transpose(1, 2)

    @torch.no_grad()
    def generate_video(self, frames: int, height: int, width: int,
                       condition_ids: torch.Tensor | None = None,
                       timestamps: torch.Tensor | None = None,
                       steps: int = 32, chunk_frames: int | None = None) -> torch.Tensor:
        chunks = list(self.generate_video_chunks(
            frames, height, width, condition_ids, timestamps, steps, chunk_frames
        ))
        return torch.cat(chunks, dim=1)
