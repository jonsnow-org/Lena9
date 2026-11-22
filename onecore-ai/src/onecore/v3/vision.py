"""Variable-resolution image codec primitives for the versioned OneCore v3 architecture.

These modules are trainable building blocks, not a quality-certified generator. They
preserve source aspect ratio and spatial dimensions; quality depends on training data,
losses, compute, and evaluation.
"""
from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn
from torch.nn import functional as F


@dataclass(frozen=True)
class ImageEncoding:
    tokens: torch.Tensor
    grid_height: int
    grid_width: int
    image_height: int
    image_width: int


def _sincos_2d(height: int, width: int, dim: int, *, device: torch.device,
               dtype: torch.dtype) -> torch.Tensor:
    if dim % 4:
        raise ValueError("image token width must be divisible by four for 2-D positions")
    quarter = dim // 4
    frequency = torch.exp(
        torch.arange(quarter, device=device, dtype=torch.float32)
        * (-torch.log(torch.tensor(10_000.0, device=device)) / max(quarter - 1, 1))
    )
    y = torch.linspace(-1.0, 1.0, height, device=device)
    x = torch.linspace(-1.0, 1.0, width, device=device)
    yy, xx = torch.meshgrid(y, x, indexing="ij")
    y_phase = yy.reshape(-1, 1) * frequency.reshape(1, -1)
    x_phase = xx.reshape(-1, 1) * frequency.reshape(1, -1)
    return torch.cat(
        (y_phase.sin(), y_phase.cos(), x_phase.sin(), x_phase.cos()), dim=-1
    ).to(dtype=dtype)


class VariableResolutionImageCodec(nn.Module):
    """Patch-latent image codec that accepts any divisible H×W without resizing."""

    def __init__(self, width: int = 512, patch_size: int = 16) -> None:
        super().__init__()
        if width < 4 or width % 4:
            raise ValueError("width must be >=4 and divisible by four")
        if patch_size < 2:
            raise ValueError("patch_size must be >=2")
        self.width = width
        self.patch_size = patch_size
        self.encoder = nn.Conv2d(3, width, kernel_size=patch_size, stride=patch_size)
        self.decoder = nn.ConvTranspose2d(
            width, 3, kernel_size=patch_size, stride=patch_size
        )
        self.encoder_norm = nn.LayerNorm(width)

    def encode(self, images: torch.Tensor) -> ImageEncoding:
        if images.ndim != 4 or images.shape[1] != 3:
            raise ValueError("images must have shape [batch, 3, height, width]")
        _, _, height, width = images.shape
        if height < self.patch_size or width < self.patch_size:
            raise ValueError("image dimensions must be at least one patch")
        padded_height = ((height + self.patch_size - 1) // self.patch_size) * self.patch_size
        padded_width = ((width + self.patch_size - 1) // self.patch_size) * self.patch_size
        padded = F.pad(images, (0, padded_width - width, 0, padded_height - height))
        features = self.encoder(padded)
        grid_height, grid_width = features.shape[-2:]
        tokens = features.flatten(2).transpose(1, 2)
        positions = _sincos_2d(
            grid_height, grid_width, self.width,
            device=tokens.device, dtype=tokens.dtype,
        )
        tokens = self.encoder_norm(tokens + positions.unsqueeze(0))
        return ImageEncoding(tokens, grid_height, grid_width, height, width)

    def decode(self, encoding: ImageEncoding | torch.Tensor, *,
               grid_height: int | None = None, grid_width: int | None = None) -> torch.Tensor:
        if isinstance(encoding, ImageEncoding):
            tokens = encoding.tokens
            grid_height, grid_width = encoding.grid_height, encoding.grid_width
        else:
            tokens = encoding
        if tokens.ndim != 3 or grid_height is None or grid_width is None:
            raise ValueError("decode requires [B,N,D] tokens and explicit patch-grid dimensions")
        if tokens.shape[1] != grid_height * grid_width or tokens.shape[2] != self.width:
            raise ValueError("token shape does not match the supplied patch grid")
        features = tokens.transpose(1, 2).reshape(
            tokens.shape[0], self.width, grid_height, grid_width
        )
        decoded = self.decoder(features)
        if isinstance(encoding, ImageEncoding):
            decoded = decoded[..., :encoding.image_height, :encoding.image_width]
        return decoded

    def forward(self, images: torch.Tensor) -> tuple[torch.Tensor, ImageEncoding]:
        encoded = self.encode(images)
        return self.decode(encoded), encoded
