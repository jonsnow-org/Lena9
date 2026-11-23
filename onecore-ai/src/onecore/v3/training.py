"""Joint multimodal v3 objectives and explicit optimizer-step helpers."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

from .core import OneCoreV3
from .losses import (
    audio_multiresolution_stft_loss,
    discriminator_hinge_loss,
    generator_hinge_loss,
    image_pyramid_reconstruction_loss,
    symmetric_cross_modal_alignment_loss,
    video_temporal_consistency_loss,
)


@dataclass(frozen=True)
class V3ObjectiveWeights:
    text: float = 1.0
    tool: float = 1.0
    image_flow: float = 1.0
    image_reconstruction: float = 1.0
    image_adversarial: float = 0.1
    audio_flow: float = 1.0
    audio_reconstruction: float = 1.0
    audio_commitment: float = 0.25
    audio_adversarial: float = 0.1
    video_flow: float = 1.0
    video_reconstruction: float = 1.0
    video_temporal: float = 1.0
    alignment: float = 0.1


@contextmanager
def _frozen_parameters(module: nn.Module):
    original = [parameter.requires_grad for parameter in module.parameters()]
    try:
        for parameter in module.parameters():
            parameter.requires_grad_(False)
        yield
    finally:
        for parameter, requires_grad in zip(module.parameters(), original, strict=True):
            parameter.requires_grad_(requires_grad)


class OneCoreV3Objective(nn.Module):
    """Compute text/tool, image, audio, video, flow and optional GAN objectives.

    Batch contract:
      text/tool: {input_ids, labels?}
      image: {images, condition_ids?}
      audio: {waveform, condition_ids?}
      video: {frames, timestamps?, condition_ids?}
    All keys are optional, but at least one family must be supplied.
    """

    def __init__(self, model: OneCoreV3, weights: V3ObjectiveWeights | None = None,
                 image_discriminator: nn.Module | None = None,
                 audio_discriminator: nn.Module | None = None) -> None:
        super().__init__()
        self.model = model
        self.weights = weights or V3ObjectiveWeights()
        self.image_discriminator = image_discriminator
        self.audio_discriminator = audio_discriminator

    def _alignment(self, condition: torch.Tensor | None,
                   modality_latents: torch.Tensor) -> torch.Tensor | None:
        if condition is None or condition.shape[0] < 2:
            return None
        return symmetric_cross_modal_alignment_loss(
            condition.mean(dim=1), modality_latents.mean(dim=1)
        )

    def forward(self, batch: dict[str, Any]) -> dict[str, torch.Tensor]:
        losses: dict[str, torch.Tensor] = {}
        alignment_terms: list[torch.Tensor] = []
        total = next(self.model.parameters()).new_zeros(())

        for family, weight in (("text", self.weights.text), ("tool", self.weights.tool)):
            sample = batch.get(family)
            if sample is None:
                continue
            input_ids = sample["input_ids"]
            labels = sample.get("labels", input_ids)
            if input_ids.ndim != 2 or labels.shape != input_ids.shape or input_ids.shape[1] < 2:
                raise ValueError(f"{family} input_ids/labels must match [B,T>=2]")
            logits = self.model.forward_text(input_ids)
            loss = F.cross_entropy(
                logits[:, :-1].reshape(-1, logits.shape[-1]),
                labels[:, 1:].reshape(-1), ignore_index=-100,
            )
            losses[f"{family}_loss"] = loss
            total = total + weight * loss

        sample = batch.get("image")
        if sample is not None:
            images = sample["images"]
            condition = self.model.text_condition(sample.get("condition_ids"))
            encoding = self.model.image_codec.encode(images)
            reconstruction, _ = self.model.forward_image(images)
            flow = self.model.flow_matching_loss(encoding.tokens, 1, condition)
            recon = image_pyramid_reconstruction_loss(reconstruction, images)
            losses["image_flow_loss"] = flow
            losses["image_reconstruction_loss"] = recon
            total = total + self.weights.image_flow * flow
            total = total + self.weights.image_reconstruction * recon
            if self.image_discriminator is not None:
                with _frozen_parameters(self.image_discriminator):
                    adversarial = generator_hinge_loss(self.image_discriminator(reconstruction))
                losses["image_adversarial_loss"] = adversarial
                total = total + self.weights.image_adversarial * adversarial
            aligned = self._alignment(condition, encoding.tokens)
            if aligned is not None:
                alignment_terms.append(aligned)

        sample = batch.get("audio")
        if sample is not None:
            waveform = sample["waveform"]
            condition = self.model.text_condition(sample.get("condition_ids"))
            sample_rate = int(sample.get("sample_rate", 0))
            if sample_rate < 1:
                raise ValueError("audio batch requires explicit normalized sample_rate metadata")
            encoding = self.model.audio_codec.encode(waveform, sample_rate=sample_rate)
            shared_latents = self.model.audio_to_shared(encoding.quantized).transpose(1, 2)
            reconstruction, _ = self.model.forward_audio(waveform, sample_rate=sample_rate)
            flow = self.model.flow_matching_loss(shared_latents, 2, condition)
            recon = audio_multiresolution_stft_loss(reconstruction, waveform)
            losses["audio_flow_loss"] = flow
            losses["audio_reconstruction_loss"] = recon
            losses["audio_commitment_loss"] = encoding.commitment_loss
            total = total + self.weights.audio_flow * flow
            total = total + self.weights.audio_reconstruction * recon
            total = total + self.weights.audio_commitment * encoding.commitment_loss
            if self.audio_discriminator is not None:
                with _frozen_parameters(self.audio_discriminator):
                    adversarial = generator_hinge_loss(self.audio_discriminator(reconstruction))
                losses["audio_adversarial_loss"] = adversarial
                total = total + self.weights.audio_adversarial * adversarial
            aligned = self._alignment(condition, shared_latents)
            if aligned is not None:
                alignment_terms.append(aligned)

        sample = batch.get("video")
        if sample is not None:
            frames = sample["frames"]
            timestamps = sample.get("timestamps")
            condition = self.model.text_condition(sample.get("condition_ids"))
            encoding = self.model.video_codec.encode(frames, timestamps=timestamps)
            latents = encoding.tokens.reshape(
                encoding.tokens.shape[0], -1, self.model.width
            )
            reconstruction, _ = self.model.forward_video(frames, timestamps=timestamps)
            flow = self.model.flow_matching_loss(latents, 3, condition)
            recon = image_pyramid_reconstruction_loss(
                reconstruction.flatten(0, 1), frames.flatten(0, 1)
            )
            temporal = video_temporal_consistency_loss(reconstruction, frames)
            losses["video_flow_loss"] = flow
            losses["video_reconstruction_loss"] = recon
            losses["video_temporal_loss"] = temporal
            total = total + self.weights.video_flow * flow
            total = total + self.weights.video_reconstruction * recon
            total = total + self.weights.video_temporal * temporal
            aligned = self._alignment(condition, latents)
            if aligned is not None:
                alignment_terms.append(aligned)

        if not losses:
            raise ValueError("joint v3 batch must include at least one modality family")
        if alignment_terms:
            alignment = torch.stack(alignment_terms).mean()
            losses["alignment_loss"] = alignment
            total = total + self.weights.alignment * alignment
        losses["total"] = total
        return losses


def train_v3_step(model: OneCoreV3, optimizer: torch.optim.Optimizer,
                  batch: dict[str, Any], *,
                  objective: OneCoreV3Objective | None = None,
                  max_grad_norm: float = 1.0) -> dict[str, float]:
    if max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be positive")
    objective = objective or OneCoreV3Objective(model)
    model.train()
    optimizer.zero_grad(set_to_none=True)
    losses = objective(batch)
    losses["total"].backward()
    norm = torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
    optimizer.step()
    metrics = {name: float(value.detach().cpu()) for name, value in losses.items()}
    metrics["gradient_norm"] = float(norm.detach().cpu())
    return metrics


def train_v3_discriminator_step(
    optimizer: torch.optim.Optimizer, *,
    image_discriminator: nn.Module | None = None,
    audio_discriminator: nn.Module | None = None,
    real_images: torch.Tensor | None = None,
    fake_images: torch.Tensor | None = None,
    real_audio: torch.Tensor | None = None,
    fake_audio: torch.Tensor | None = None,
) -> dict[str, float]:
    optimizer.zero_grad(set_to_none=True)
    terms: dict[str, torch.Tensor] = {}
    if image_discriminator is not None:
        if real_images is None or fake_images is None:
            raise ValueError("image discriminator requires real_images and fake_images")
        terms["image_discriminator_loss"] = discriminator_hinge_loss(
            image_discriminator(real_images), image_discriminator(fake_images.detach())
        )
    if audio_discriminator is not None:
        if real_audio is None or fake_audio is None:
            raise ValueError("audio discriminator requires real_audio and fake_audio")
        terms["audio_discriminator_loss"] = discriminator_hinge_loss(
            audio_discriminator(real_audio), audio_discriminator(fake_audio.detach())
        )
    if not terms:
        raise ValueError("at least one discriminator and real/fake pair is required")
    total = torch.stack(list(terms.values())).sum()
    total.backward()
    optimizer.step()
    return {name: float(value.detach().cpu()) for name, value in terms.items()} | {
        "total_discriminator_loss": float(total.detach().cpu())
    }
