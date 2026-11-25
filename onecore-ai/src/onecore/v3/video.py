"""Variable-duration temporal video codec built on the v3 variable-resolution image codec."""
from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn

from .vision import ImageEncoding, VariableResolutionImageCodec


@dataclass(frozen=True)
class VideoEncoding:
    tokens: torch.Tensor
    grid_height: int
    grid_width: int
    frame_count: int
    image_height: int
    image_width: int
    timestamps: torch.Tensor


class TemporalVideoCodec(nn.Module):
    """Encode all frames with per-spatial-location causal temporal attention.

    Input is [B,T,3,H,W]. Frame count and timestamps are variable; no frame
    subsampling or four-frame truncation is performed in this module.
    """

    def __init__(self, width: int = 512, patch_size: int = 16,
                 temporal_layers: int = 2, attention_heads: int = 8,
                 temporal_window_frames: int = 32, temporal_memory_frames: int = 4) -> None:
        super().__init__()
        if width % attention_heads:
            raise ValueError("width must be divisible by attention_heads")
        if temporal_layers < 1 or temporal_window_frames < 1 or temporal_memory_frames < 0:
            raise ValueError("temporal layer/window must be positive and memory non-negative")
        self.width = width
        self.temporal_window_frames = temporal_window_frames
        self.temporal_memory_frames = temporal_memory_frames
        self.image_codec = VariableResolutionImageCodec(width, patch_size)
        layer = nn.TransformerEncoderLayer(
            d_model=width, nhead=attention_heads, dim_feedforward=4 * width,
            batch_first=True, norm_first=True, activation="gelu",
        )
        self.temporal = nn.TransformerEncoder(layer, num_layers=temporal_layers)
        self.time_projection = nn.Sequential(
            nn.Linear(1, width), nn.SiLU(), nn.Linear(width, width)
        )

    def iter_encode(self, video: torch.Tensor,
                    timestamps: torch.Tensor | None = None,
                    frame_chunk_size: int | None = None):
        """Yield bounded-memory temporal encodings while retaining every frame."""
        if video.ndim != 5 or video.shape[2] != 3:
            raise ValueError("video must have shape [B,T,3,H,W]")
        batch, frames, _, height, width = video.shape
        if frames < 1:
            raise ValueError("video must contain at least one frame")
        if timestamps is None:
            timestamps = torch.arange(
                frames, device=video.device, dtype=video.dtype
            ).unsqueeze(0).expand(batch, -1)
        if timestamps.shape != (batch, frames):
            raise ValueError("timestamps must have shape [B,T]")
        if not torch.isfinite(timestamps).all():
            raise ValueError("timestamps must be finite")
        if frames > 1 and torch.any(timestamps[:, 1:] <= timestamps[:, :-1]):
            raise ValueError("video timestamps must be strictly increasing")
        chunk_size = self.temporal_window_frames if frame_chunk_size is None else int(frame_chunk_size)
        if chunk_size < 1:
            raise ValueError("frame_chunk_size must be positive")
        chunk_size = min(chunk_size, self.temporal_window_frames)
        memory = None
        for start in range(0, frames, chunk_size):
            stop = min(frames, start + chunk_size)
            current_frames = stop - start
            flat_frames = video[:, start:stop].reshape(
                batch * current_frames, 3, height, width
            )
            image_encoding = self.image_codec.encode(flat_frames)
            tokens = image_encoding.tokens.reshape(
                batch, current_frames,
                image_encoding.grid_height * image_encoding.grid_width,
                self.width,
            )
            current_timestamps = timestamps[:, start:stop]
            time_features = self.time_projection(
                current_timestamps.to(video.dtype).unsqueeze(-1)
            )
            tokens = tokens + time_features.unsqueeze(2)
            spatial_tokens = tokens.permute(0, 2, 1, 3).reshape(
                batch * tokens.shape[2], current_frames, self.width
            )
            combined = spatial_tokens if memory is None else torch.cat(
                (memory, spatial_tokens), dim=1
            )
            mask = torch.triu(
                torch.ones(
                    combined.shape[1], combined.shape[1],
                    device=video.device, dtype=torch.bool,
                ),
                diagonal=1,
            )
            processed = self.temporal(combined, mask=mask)
            current_processed = processed[:, -current_frames:]
            if self.temporal_memory_frames:
                memory = processed[:, -self.temporal_memory_frames:].detach()
            else:
                memory = None
            temporal_tokens = current_processed.reshape(
                batch, tokens.shape[2], current_frames, self.width
            ).permute(0, 2, 1, 3)
            yield VideoEncoding(
                temporal_tokens, image_encoding.grid_height, image_encoding.grid_width,
                current_frames, height, width, current_timestamps,
            )

    def encode(self, video: torch.Tensor,
               timestamps: torch.Tensor | None = None) -> VideoEncoding:
        chunks = list(self.iter_encode(video, timestamps=timestamps))
        first = chunks[0]
        return VideoEncoding(
            torch.cat([chunk.tokens for chunk in chunks], dim=1),
            first.grid_height, first.grid_width,
            sum(chunk.frame_count for chunk in chunks),
            first.image_height, first.image_width,
            torch.cat([chunk.timestamps for chunk in chunks], dim=1),
        )

    def decode_frames(self, encoding: VideoEncoding) -> torch.Tensor:
        if encoding.tokens.ndim != 4:
            raise ValueError("video tokens must have shape [B,T,N,D]")
        batch, frames, patches, width = encoding.tokens.shape
        if frames != encoding.frame_count or width != self.width:
            raise ValueError("video encoding metadata does not match token shape")
        if patches != encoding.grid_height * encoding.grid_width:
            raise ValueError("video token count does not match spatial grid")
        frame_tokens = encoding.tokens.reshape(batch * frames, patches, width)
        frame_encoding = ImageEncoding(
            frame_tokens, encoding.grid_height, encoding.grid_width,
            encoding.image_height, encoding.image_width,
        )
        decoded = self.image_codec.decode(frame_encoding)
        return decoded.reshape(batch, frames, 3, encoding.image_height, encoding.image_width)

    def forward(self, video: torch.Tensor,
                timestamps: torch.Tensor | None = None) -> tuple[torch.Tensor, VideoEncoding]:
        encoding = self.encode(video, timestamps=timestamps)
        return self.decode_frames(encoding), encoding
