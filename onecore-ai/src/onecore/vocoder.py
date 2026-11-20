"""Small trainable neural mel vocoder (log-mel frames -> waveform), PyTorch.

Replaces the earlier pure-Python toy. It is a standalone module: it is NOT yet
part of the OneCore checkpoint, so the exact 57,579,201-parameter budget is
unchanged. Folding it into the single checkpoint is a deliberate later step that
requires updating the budget regression test and the lineage record.

Architecture: Conv1d stack over mel frames, then a transposed-conv upsampler
whose total stride equals the STFT hop length (160 samples at 16 kHz).
Loss: waveform L1 + multi-resolution log-STFT magnitude L1.
"""
from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F


class MelVocoder(nn.Module):
    def __init__(self, n_mels: int = 80, channels: int = 128,
                 upsample: tuple[int, ...] = (5, 4, 4, 2)) -> None:
        super().__init__()
        if n_mels < 1 or channels < 4 or not upsample or min(upsample) < 1:
            raise ValueError("invalid vocoder configuration")
        self.n_mels = n_mels
        self.hop_length = 1
        for factor in upsample:
            self.hop_length *= factor
        self.pre = nn.Conv1d(n_mels, channels, kernel_size=7, padding=3)
        layers: list[nn.Module] = []
        width = channels
        for factor in upsample:
            out = max(8, width // 2)
            layers += [
                nn.LeakyReLU(0.1),
                nn.ConvTranspose1d(width, out, kernel_size=2 * factor, stride=factor,
                                   padding=factor // 2 + factor % 2,
                                   output_padding=factor % 2),
                nn.Conv1d(out, out, kernel_size=5, padding=2),
            ]
            width = out
        self.up = nn.Sequential(*layers)
        self.post = nn.Conv1d(width, 1, kernel_size=7, padding=3)

    def forward(self, log_mel: torch.Tensor) -> torch.Tensor:
        """log_mel [batch, frames, n_mels] -> waveform [batch, frames * hop_length]."""
        if log_mel.ndim != 3 or log_mel.shape[-1] != self.n_mels:
            raise ValueError("log_mel must have shape [batch, frames, n_mels]")
        x = self.pre(log_mel.transpose(1, 2))
        x = self.up(x)
        return torch.tanh(self.post(F.leaky_relu(x, 0.1))).squeeze(1)

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


def stft_loss(pred: torch.Tensor, target: torch.Tensor,
              sizes: tuple[int, ...] = (256, 512, 1024)) -> torch.Tensor:
    """Multi-resolution log-magnitude STFT L1 distance."""
    total = pred.new_zeros(())
    for n_fft in sizes:
        if pred.shape[-1] < n_fft:
            continue
        window = torch.hann_window(n_fft, device=pred.device)
        a = torch.stft(pred, n_fft, n_fft // 4, window=window, return_complex=True).abs()
        b = torch.stft(target, n_fft, n_fft // 4, window=window, return_complex=True).abs()
        total = total + F.l1_loss(torch.log(a + 1e-5), torch.log(b + 1e-5))
    return total


def vocoder_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    length = min(pred.shape[-1], target.shape[-1])
    pred, target = pred[..., :length], target[..., :length]
    return F.l1_loss(pred, target) + stft_loss(pred, target)
