"""Modality-aware reconstruction, temporal, alignment and adversarial losses for v3."""
from __future__ import annotations

from collections.abc import Sequence

import torch
from torch import nn
from torch.nn import functional as F


def image_pyramid_reconstruction_loss(predicted: torch.Tensor,
                                      target: torch.Tensor,
                                      scales: Sequence[float] = (1.0, 0.5, 0.25),
                                      gradient_weight: float = 0.2) -> torch.Tensor:
    if predicted.shape != target.shape or predicted.ndim != 4 or predicted.shape[1] != 3:
        raise ValueError("images must have matching [B,3,H,W] shapes")
    if not scales or any(not 0 < scale <= 1 for scale in scales):
        raise ValueError("scales must be a non-empty sequence in (0,1]")
    loss = predicted.new_zeros(())
    for scale in scales:
        if scale == 1.0:
            pred, truth = predicted, target
        else:
            size = (max(1, round(target.shape[-2] * scale)),
                    max(1, round(target.shape[-1] * scale)))
            pred = F.interpolate(predicted, size=size, mode="area")
            truth = F.interpolate(target, size=size, mode="area")
        loss = loss + F.l1_loss(pred, truth)
        if gradient_weight:
            pred_dx, truth_dx = pred[..., 1:] - pred[..., :-1], truth[..., 1:] - truth[..., :-1]
            pred_dy, truth_dy = pred[..., 1:, :] - pred[..., :-1, :], truth[..., 1:, :] - truth[..., :-1, :]
            loss = loss + gradient_weight * (
                F.l1_loss(pred_dx, truth_dx) + F.l1_loss(pred_dy, truth_dy)
            )
    return loss / len(scales)


def audio_multiresolution_stft_loss(predicted: torch.Tensor, target: torch.Tensor,
                                    fft_sizes: Sequence[int] = (256, 512, 1024),
                                    waveform_weight: float = 1.0,
                                    log_magnitude_weight: float = 1.0,
                                    convergence_weight: float = 1.0) -> torch.Tensor:
    if predicted.shape != target.shape:
        raise ValueError("predicted and target audio must have identical shapes")
    if predicted.ndim == 2:
        predicted = predicted.unsqueeze(1)
        target = target.unsqueeze(1)
    if predicted.ndim != 3 or predicted.shape[1] not in (1, 2):
        raise ValueError("audio must be mono [B,T] or mono/stereo [B,C,T] with C in {1,2}")
    if not fft_sizes or any(size < 16 for size in fft_sizes):
        raise ValueError("fft_sizes must contain values >=16")
    # Flatten batch and channel axes so each mono/stereo channel contributes
    # equally to the waveform and multi-resolution spectral losses.
    pred_wave = predicted.float().reshape(-1, predicted.shape[-1])
    target_wave = target.float().reshape(-1, target.shape[-1])
    loss = waveform_weight * F.l1_loss(pred_wave, target_wave)
    for n_fft in fft_sizes:
        hop = max(1, n_fft // 4)
        if pred_wave.shape[-1] < n_fft:
            pad = n_fft - pred_wave.shape[-1]
            pred = F.pad(pred_wave, (0, pad))
            truth = F.pad(target_wave, (0, pad))
        else:
            pred, truth = pred_wave, target_wave
        window = torch.hann_window(n_fft, device=pred.device, dtype=pred.dtype)
        pred_mag = torch.stft(pred, n_fft=n_fft, hop_length=hop, window=window,
                              return_complex=True).abs()
        target_mag = torch.stft(truth, n_fft=n_fft, hop_length=hop, window=window,
                                return_complex=True).abs()
        log_loss = F.l1_loss(torch.log(pred_mag.clamp_min(1e-7)),
                             torch.log(target_mag.clamp_min(1e-7)))
        convergence = torch.linalg.vector_norm(pred_mag - target_mag) / (
            torch.linalg.vector_norm(target_mag) + 1e-7
        )
        loss = loss + log_magnitude_weight * log_loss + convergence_weight * convergence
    return loss / (len(fft_sizes) + 1)


def video_temporal_consistency_loss(predicted: torch.Tensor,
                                    target: torch.Tensor) -> torch.Tensor:
    if predicted.shape != target.shape or predicted.ndim != 5 or predicted.shape[2] != 3:
        raise ValueError("videos must have matching [B,T,3,H,W] shapes")
    if predicted.shape[1] < 2:
        return predicted.new_zeros(())
    pred_motion = predicted[:, 1:] - predicted[:, :-1]
    target_motion = target[:, 1:] - target[:, :-1]
    return F.l1_loss(pred_motion, target_motion)


def symmetric_cross_modal_alignment_loss(left: torch.Tensor,
                                         right: torch.Tensor,
                                         temperature: float = 0.07) -> torch.Tensor:
    if left.ndim != 2 or right.shape != left.shape or left.shape[0] < 2:
        raise ValueError("paired embeddings must have matching [B,D] shapes with B>=2")
    if temperature <= 0:
        raise ValueError("temperature must be positive")
    left = F.normalize(left.float(), dim=-1)
    right = F.normalize(right.float(), dim=-1)
    logits = left @ right.t() / temperature
    labels = torch.arange(left.shape[0], device=left.device)
    return 0.5 * (F.cross_entropy(logits, labels) + F.cross_entropy(logits.t(), labels))


class ImagePatchDiscriminator(nn.Module):
    """Patch discriminator for adversarial image-decoder training."""

    def __init__(self, base_channels: int = 64) -> None:
        super().__init__()
        self.network = nn.Sequential(
            nn.Conv2d(3, base_channels, 4, 2, 1), nn.LeakyReLU(0.2),
            nn.Conv2d(base_channels, base_channels * 2, 4, 2, 1),
            nn.LeakyReLU(0.2),
            nn.Conv2d(base_channels * 2, base_channels * 4, 4, 2, 1),
            nn.LeakyReLU(0.2),
            nn.Conv2d(base_channels * 4, 1, 3, 1, 1),
        )

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        if images.ndim != 4 or images.shape[1] != 3:
            raise ValueError("discriminator input must have shape [B,3,H,W]")
        return self.network(images)


class MultiScaleAudioDiscriminator(nn.Module):
    """Waveform discriminator operating at several temporal scales."""

    def __init__(self, base_channels: int = 32, scales: int = 3) -> None:
        super().__init__()
        if base_channels < 1 or scales < 1:
            raise ValueError("base_channels and scales must be positive")
        self.discriminators = nn.ModuleList([
            nn.Sequential(
                nn.Conv1d(1, base_channels, 15, 4, 7), nn.LeakyReLU(0.2),
                nn.Conv1d(base_channels, base_channels * 2, 15, 4, 7),
                nn.LeakyReLU(0.2),
                nn.Conv1d(base_channels * 2, base_channels * 4, 7, 2, 3),
                nn.LeakyReLU(0.2),
                nn.Conv1d(base_channels * 4, 1, 3, 1, 1),
            )
            for _ in range(scales)
        ])

    def forward(self, waveform: torch.Tensor) -> list[torch.Tensor]:
        if waveform.ndim == 2:
            waveform = waveform.unsqueeze(1)
        if waveform.ndim != 3 or waveform.shape[1] != 1:
            raise ValueError("discriminator input must be mono [B,T] or [B,1,T]")
        outputs = []
        current = waveform
        for index, discriminator in enumerate(self.discriminators):
            if current.shape[-1] < 8:
                current = F.pad(current, (0, 8 - current.shape[-1]))
            outputs.append(discriminator(current))
            if index + 1 < len(self.discriminators):
                current = F.avg_pool1d(current, kernel_size=4, stride=2, padding=1)
        return outputs


def discriminator_hinge_loss(real_scores: torch.Tensor | Sequence[torch.Tensor],
                              fake_scores: torch.Tensor | Sequence[torch.Tensor]) -> torch.Tensor:
    real_items = [real_scores] if isinstance(real_scores, torch.Tensor) else list(real_scores)
    fake_items = [fake_scores] if isinstance(fake_scores, torch.Tensor) else list(fake_scores)
    if not real_items or len(real_items) != len(fake_items):
        raise ValueError("real and fake discriminator score lists must be non-empty and aligned")
    return sum(
        F.relu(1.0 - real).mean() + F.relu(1.0 + fake).mean()
        for real, fake in zip(real_items, fake_items, strict=True)
    ) / len(real_items)


def generator_hinge_loss(fake_scores: torch.Tensor | Sequence[torch.Tensor]) -> torch.Tensor:
    items = [fake_scores] if isinstance(fake_scores, torch.Tensor) else list(fake_scores)
    if not items:
        raise ValueError("fake discriminator scores cannot be empty")
    return -sum(score.mean() for score in items) / len(items)
