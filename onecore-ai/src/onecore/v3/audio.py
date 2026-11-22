"""Learned neural waveform codec primitives with residual vector quantization (RVQ).

This is an untrained architecture component. It replaces Griffin–Lim in the v3
architecture path, but it is not production-quality audio until trained and evaluated.
"""
from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn
from torch.nn import functional as F


@dataclass(frozen=True)
class AudioEncoding:
    codes: torch.Tensor
    quantized: torch.Tensor
    commitment_loss: torch.Tensor
    original_samples: int
    padded_samples: int
    sample_rate: int | None = None
    original_channels: int = 1


class ResidualVectorQuantizer(nn.Module):
    def __init__(self, stages: int, codebook_size: int, dimension: int,
                 commitment_weight: float = 0.25) -> None:
        super().__init__()
        if min(stages, codebook_size, dimension) < 1:
            raise ValueError("RVQ dimensions must be positive")
        if commitment_weight < 0:
            raise ValueError("commitment_weight cannot be negative")
        self.codebooks = nn.ModuleList(
            nn.Embedding(codebook_size, dimension) for _ in range(stages)
        )
        self.commitment_weight = commitment_weight
        for codebook in self.codebooks:
            nn.init.uniform_(codebook.weight, -1.0 / codebook.num_embeddings,
                             1.0 / codebook.num_embeddings)

    def forward(self, latents: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        if latents.ndim != 3:
            raise ValueError("latents must have shape [batch, channels, time]")
        residual = latents.transpose(1, 2)
        quantized_sum = torch.zeros_like(residual)
        codes = []
        loss = latents.new_zeros(())
        for codebook in self.codebooks:
            flat = residual.reshape(-1, residual.shape[-1]).float()
            weights = codebook.weight.float()
            distances = (
                flat.square().sum(1, keepdim=True)
                - 2.0 * flat @ weights.t()
                + weights.square().sum(1).unsqueeze(0)
            )
            indices = distances.argmin(dim=1).reshape(residual.shape[:2])
            quantized = codebook(indices)
            loss = loss + F.mse_loss(residual.float(), quantized.detach().float())
            loss = loss + self.commitment_weight * F.mse_loss(
                residual.detach().float(), quantized.float()
            )
            quantized_sum = quantized_sum + quantized
            residual = residual - quantized.detach()
            codes.append(indices)
        straight_through = latents.transpose(1, 2) + (
            quantized_sum - latents.transpose(1, 2)
        ).detach()
        return torch.stack(codes, dim=1), straight_through.transpose(1, 2), loss


class NeuralAudioCodec(nn.Module):
    """A convolutional waveform encoder/decoder with learned multi-stage RVQ."""

    def __init__(self, latent_channels: int = 128, hidden_channels: int = 256,
                 codebook_size: int = 1024, quantizer_stages: int = 8,
                 channels: int = 2) -> None:
        super().__init__()
        if min(latent_channels, hidden_channels, channels) < 1:
            raise ValueError("channel dimensions must be positive")
        self.latent_channels = latent_channels
        self.channels = channels
        self.downsample_factor = 16
        self.encoder = nn.Sequential(
            nn.Conv1d(channels, hidden_channels, kernel_size=8, stride=4, padding=2),
            nn.SiLU(),
            nn.Conv1d(hidden_channels, latent_channels, kernel_size=8, stride=4, padding=2),
        )
        self.quantizer = ResidualVectorQuantizer(
            quantizer_stages, codebook_size, latent_channels
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose1d(
                latent_channels, hidden_channels, kernel_size=8, stride=4, padding=2
            ),
            nn.SiLU(),
            nn.ConvTranspose1d(
                hidden_channels, channels, kernel_size=8, stride=4, padding=2
            ),
        )

    def encode(self, waveform: torch.Tensor, *, sample_rate: int | None = None) -> AudioEncoding:
        original_channels = 1 if waveform.ndim == 2 else (waveform.shape[1] if waveform.ndim == 3 else 0)
        if waveform.ndim == 2:
            waveform = waveform.unsqueeze(1)
        if waveform.ndim != 3 or waveform.shape[1] not in (1, self.channels):
            raise ValueError(f"waveform must have shape [B,T], [B,1,T], or [B,{self.channels},T]")
        if sample_rate is not None and sample_rate < 1:
            raise ValueError("sample_rate must be positive when supplied")
        if waveform.shape[1] == 1 and self.channels > 1:
            waveform = waveform.expand(-1, self.channels, -1)
        if waveform.shape[-1] < 1:
            raise ValueError("waveform cannot be empty")
        original_samples = waveform.shape[-1]
        padded_samples = (
            (original_samples + self.downsample_factor - 1)
            // self.downsample_factor
        ) * self.downsample_factor
        padded = F.pad(waveform, (0, padded_samples - original_samples))
        latents = self.encoder(padded)
        codes, quantized, loss = self.quantizer(latents)
        return AudioEncoding(codes, quantized, loss, original_samples, padded_samples,
                             sample_rate, original_channels)

    def decode(self, encoding: AudioEncoding | torch.Tensor, *,
               original_samples: int | None = None) -> torch.Tensor:
        if isinstance(encoding, AudioEncoding):
            latents = encoding.quantized
            original_samples = encoding.original_samples
            original_channels = encoding.original_channels
        else:
            latents = encoding
        if latents.ndim != 3 or latents.shape[1] != self.latent_channels:
            raise ValueError("latents must have shape [B, latent_channels, time]")
        if original_samples is None or original_samples < 1:
            raise ValueError("original_samples is required when decoding raw latents")
        waveform = self.decoder(latents)
        if isinstance(encoding, AudioEncoding) and original_channels == 1 and waveform.shape[1] > 1:
            waveform = waveform.mean(dim=1, keepdim=True)
        if waveform.shape[-1] < original_samples:
            waveform = F.pad(waveform, (0, original_samples - waveform.shape[-1]))
        return waveform[..., :original_samples]

    def forward(self, waveform: torch.Tensor) -> tuple[torch.Tensor, AudioEncoding]:
        squeeze_channel = waveform.ndim == 2
        encoding = self.encode(waveform)
        reconstruction = self.decode(encoding)
        if squeeze_channel:
            reconstruction = reconstruction.squeeze(1)
        return reconstruction, encoding
