"""Shared, variable-length semantic backbone and multimodal integration for OneCore v3."""
from __future__ import annotations

import torch
from torch import nn

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
                 temporal_layers: int = 2, dropout: float = 0.0) -> None:
        super().__init__()
        if text_vocab_size < 2:
            raise ValueError("text_vocab_size must be at least two")
        self.width = width
        self.text_embedding = nn.Embedding(text_vocab_size, width)
        self.modality_embedding = nn.Embedding(5, width)
        self.shared_core = SharedSemanticCore(width, layers, attention_heads, dropout)
        self.text_head = nn.Linear(width, text_vocab_size, bias=False)
        self.text_head.weight = self.text_embedding.weight

        self.image_codec = VariableResolutionImageCodec(width, patch_size)
        self.audio_codec = NeuralAudioCodec(
            audio_latent_channels, audio_hidden_channels,
            audio_codebook_size, audio_quantizer_stages,
        )
        self.audio_to_shared = nn.Conv1d(audio_latent_channels, width, kernel_size=1)
        self.shared_to_audio = nn.Conv1d(width, audio_latent_channels, kernel_size=1)
        self.video_codec = TemporalVideoCodec(
            width, patch_size, temporal_layers, attention_heads
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
        shared = self.shared_core(
            encoding.tokens + self.modality_embedding.weight[1], causal=False
        )
        processed = ImageEncoding(
            shared, encoding.grid_height, encoding.grid_width,
            encoding.image_height, encoding.image_width,
        )
        return self.image_codec.decode(processed), processed

    def forward_audio(self, waveform: torch.Tensor) -> tuple[torch.Tensor, AudioEncoding]:
        encoding = self.audio_codec.encode(waveform)
        shared = self.audio_to_shared(encoding.quantized).transpose(1, 2)
        shared = self.shared_core(
            shared + self.modality_embedding.weight[2], causal=False
        ).transpose(1, 2)
        decoded_latents = self.shared_to_audio(shared.transpose(1, 2))
        processed = AudioEncoding(
            encoding.codes, decoded_latents, encoding.commitment_loss,
            encoding.original_samples, encoding.padded_samples,
        )
        return self.audio_codec.decode(processed), processed

    def forward_video(self, video: torch.Tensor,
                      timestamps: torch.Tensor | None = None) -> tuple[torch.Tensor, VideoEncoding]:
        encoding = self.video_codec.encode(video, timestamps=timestamps)
        batch, frames, patches, width = encoding.tokens.shape
        shared = self.shared_core(
            (encoding.tokens + self.modality_embedding.weight[3]).reshape(
                batch, frames * patches, width
            ), causal=True
        ).reshape(batch, frames, patches, width)
        processed = VideoEncoding(
            shared, encoding.grid_height, encoding.grid_width,
            encoding.frame_count, encoding.image_height, encoding.image_width,
            encoding.timestamps,
        )
        return self.video_codec.decode_frames(processed), processed
