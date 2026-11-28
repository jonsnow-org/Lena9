"""Single shared-vocabulary objective and one five-family optimizer update."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

from .core import (AUDIO_END, AUDIO_START, BOS, EOS, IMAGE_END, IMAGE_START,
                   MASK, MOTION_START, TEXT_START, TOOL_END, TOOL_START,
                   VIDEO_END, VIDEO_FRAME, VIDEO_START, OneCoreV3)


@dataclass(frozen=True)
class V3ObjectiveWeights:
    text: float = 1.0
    tool: float = 1.0
    tldm_diffusion: float = 0.15
    codec_reconstruction: float = 1.0
    codec_commitment: float = 1.0


def _append_condition(sequence: torch.Tensor, condition: torch.Tensor | None,
                      *, limit: int, config: Any) -> torch.Tensor:
    if condition is None:
        return torch.cat((sequence, sequence.new_full((sequence.shape[0], 1), config.special_id(EOS))), dim=1)
    if limit < 0:
        raise ValueError("family sequence leaves no room for its text condition")
    condition = condition.to(device=sequence.device, dtype=torch.long)[:, :limit]
    marker = sequence.new_full((sequence.shape[0], 1), config.special_id(TEXT_START))
    end = sequence.new_full((sequence.shape[0], 1), config.special_id(EOS))
    return torch.cat((sequence, marker, condition, end), dim=1)


def _sequence_loss(model: OneCoreV3, sequence: torch.Tensor) -> torch.Tensor:
    if sequence.ndim != 2 or sequence.shape[1] < 2:
        raise ValueError("OneCore family sequence must have shape [batch, length>=2]")
    if sequence.shape[1] > model.cfg.max_sequence_length:
        raise ValueError("OneCore family sequence exceeds the configured context")
    logits = model.forward_text(sequence[:, :-1])
    return F.cross_entropy(logits.reshape(-1, model.cfg.vocab_size), sequence[:, 1:].reshape(-1))


def _tldm_masked_span_loss(model: OneCoreV3, sequence: torch.Tensor) -> torch.Tensor:
    length = sequence.shape[1]
    if length < 3:
        return sequence.float().sum() * 0.0
    width = min(32, length // 4, length - 2)
    start = int(torch.randint(1, length - width, (1,), device=sequence.device).item())
    masked = sequence.clone()
    masked[:, start:start + width] = model.cfg.special_id(MASK)
    logits = model.forward_tldm(masked, latent_slots=model.cfg.tldm_latent_slots)
    return F.cross_entropy(
        logits[:, start:start + width].reshape(-1, model.cfg.vocab_size),
        sequence[:, start:start + width].reshape(-1),
    )


class OneCoreV3Objective(nn.Module):
    """One causal shared-vocabulary loss + VQ/MSE auxiliaries + native T-LDM."""
    def __init__(self, model: OneCoreV3, weights: V3ObjectiveWeights | None = None,
                 image_discriminator: nn.Module | None = None,
                 audio_discriminator: nn.Module | None = None) -> None:
        super().__init__()
        if image_discriminator is not None or audio_discriminator is not None:
            raise ValueError("separate discriminator networks are not part of the corrected OneCore model")
        self.model = model
        self.weights = weights or V3ObjectiveWeights()

    def forward(self, batch: dict[str, Any]) -> dict[str, torch.Tensor]:
        if not isinstance(batch, dict) or len(batch) != 1:
            raise ValueError("each OneCore micro-batch must contain exactly one data family")
        family, sample = next(iter(batch.items()))
        if family not in {"text", "tool", "image", "audio", "video"} or not isinstance(sample, dict):
            raise ValueError("unsupported OneCore family micro-batch")
        model, cfg = self.model, self.model.cfg
        aux = next(model.parameters()).new_zeros(())
        condition = sample.get("condition_ids")

        if family in {"text", "tool"}:
            ids = sample.get("input_ids")
            if not isinstance(ids, torch.Tensor) or ids.ndim != 2:
                raise ValueError(f"{family} input_ids must have shape [batch, tokens]")
            if family == "text":
                ids = ids[:, :cfg.max_sequence_length - 2].long()
                sequence = torch.cat((ids.new_full((ids.shape[0], 1), cfg.special_id(BOS)), ids,
                                      ids.new_full((ids.shape[0], 1), cfg.special_id(EOS))), dim=1)
            else:
                ids = ids[:, :cfg.max_sequence_length - 4].long()
                sequence = torch.cat((ids.new_full((ids.shape[0], 1), cfg.special_id(BOS)),
                                      ids.new_full((ids.shape[0], 1), cfg.special_id(TOOL_START)), ids,
                                      ids.new_full((ids.shape[0], 1), cfg.special_id(TOOL_END)),
                                      ids.new_full((ids.shape[0], 1), cfg.special_id(EOS))), dim=1)
        elif family == "image":
            images = sample.get("images")
            if not isinstance(images, torch.Tensor) or images.ndim != 4:
                raise ValueError("image batch must contain [batch,3,height,width] pixels")
            images = F.interpolate(images.float(), size=(cfg.image_size, cfg.image_size), mode="bicubic", align_corners=False)
            codes, latents, commitment = model.encode_image(images)
            reconstruction = model.decode_image_latents(latents)
            aux = self.weights.codec_reconstruction * F.mse_loss(reconstruction, images) + self.weights.codec_commitment * commitment
            sequence = torch.cat((codes.new_full((codes.shape[0], 1), cfg.special_id(BOS)),
                                  codes.new_full((codes.shape[0], 1), cfg.special_id(IMAGE_START)),
                                  codes.reshape(codes.shape[0], -1),
                                  codes.new_full((codes.shape[0], 1), cfg.special_id(IMAGE_END))), dim=1)
            sequence = _append_condition(sequence, condition, limit=cfg.max_sequence_length - sequence.shape[1] - 2, config=cfg)
        elif family == "audio":
            waveform = sample.get("waveform")
            rate = sample.get("sample_rate")
            if not isinstance(waveform, torch.Tensor) or isinstance(rate, bool) or rate != cfg.audio_sample_rate:
                raise ValueError("audio batch requires a waveform normalized to 24 kHz")
            mel = model._waveform_to_log_mel(waveform, int(rate))
            codes, latents, commitment = model.encode_audio(mel)
            decoded = model.decode_audio_latents(latents).reshape(mel.shape[0], -1, cfg.audio_bins)
            reconstructed = F.interpolate(decoded.transpose(1, 2), size=mel.shape[1], mode="linear", align_corners=False).transpose(1, 2)
            aux = self.weights.codec_reconstruction * F.mse_loss(reconstructed, mel) + self.weights.codec_commitment * commitment
            sequence = torch.cat((codes.new_full((codes.shape[0], 1), cfg.special_id(BOS)),
                                  codes.new_full((codes.shape[0], 1), cfg.special_id(AUDIO_START)),
                                  codes.reshape(codes.shape[0], -1),
                                  codes.new_full((codes.shape[0], 1), cfg.special_id(AUDIO_END))), dim=1)
            sequence = _append_condition(sequence, condition, limit=min(52, cfg.max_sequence_length - sequence.shape[1] - 2), config=cfg)
        else:
            frames = sample.get("frames")
            if not isinstance(frames, torch.Tensor) or frames.ndim != 5 or not 1 <= frames.shape[1] <= cfg.max_video_frames:
                raise ValueError(f"video must contain 1..{cfg.max_video_frames} frames")
            batch_size, frame_count = frames.shape[:2]
            frames = F.interpolate(frames.flatten(0, 1).float(), size=(cfg.image_size, cfg.image_size), mode="bicubic", align_corners=False).reshape(batch_size, frame_count, 3, cfg.image_size, cfg.image_size)
            flat = frames.flatten(0, 1)
            image_codes, image_latents, image_commit = model.encode_image(flat)
            image_recon = model.decode_image_latents(image_latents)
            aux = F.mse_loss(image_recon, flat) + image_commit
            image_codes = image_codes.reshape(batch_size, frame_count, -1)
            pieces = [image_codes.new_full((batch_size, 1), cfg.special_id(BOS)),
                      image_codes.new_full((batch_size, 1), cfg.special_id(VIDEO_START))]
            motion_codes = None
            if frame_count > 1:
                differences = frames[:, 1:] - frames[:, :-1]
                motion_codes, motion_latents, motion_commit = model.encode_motion(differences.flatten(0, 1))
                motion_recon = model.decode_motion_latents(motion_latents)
                aux = aux + F.mse_loss(motion_recon, differences.flatten(0, 1)) + motion_commit
                motion_codes = motion_codes.reshape(batch_size, frame_count - 1, -1)
            for index in range(frame_count):
                pieces.extend((image_codes.new_full((batch_size, 1), cfg.special_id(VIDEO_FRAME)), image_codes[:, index]))
                if index < frame_count - 1:
                    pieces.extend((image_codes.new_full((batch_size, 1), cfg.special_id(MOTION_START)), motion_codes[:, index]))
            pieces.append(image_codes.new_full((batch_size, 1), cfg.special_id(VIDEO_END)))
            sequence = torch.cat(pieces, dim=1)
            sequence = _append_condition(
                sequence, condition,
                limit=min(52, cfg.max_sequence_length - sequence.shape[1] - 2),
                config=cfg,
            )

        language = _sequence_loss(model, sequence)
        tldm = _tldm_masked_span_loss(model, sequence) if self.weights.tldm_diffusion > 0 else language.new_zeros(())
        total = language + aux + self.weights.tldm_diffusion * tldm
        return {"language_loss": language, "aux_loss": aux, "tldm_loss": tldm, "total": total}


def train_v3_joint_step(model: OneCoreV3, optimizer: torch.optim.Optimizer,
                        micro_batches: Any, *, objective: OneCoreV3Objective | None = None,
                        max_grad_norm: float = 1.0) -> dict[str, float]:
    if max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be positive")
    items = tuple(micro_batches)
    order = ("text", "tool", "image", "audio", "video")
    if len(items) != 5 or tuple(getattr(item, "family", None) for item in items) != order:
        raise ValueError("one joint optimizer update requires exactly text/tool/image/audio/video in order")
    objective = objective or OneCoreV3Objective(model)
    model.train()
    optimizer.zero_grad(set_to_none=True)
    metrics: dict[str, float] = {}
    total_values: list[torch.Tensor] = []
    for item in items:
        batch = getattr(item, "batch", None)
        if not isinstance(batch, dict) or len(batch) != 1 or next(iter(batch)) != item.family:
            raise ValueError("each joint micro-batch must contain exactly its declared family")
        losses = objective(batch)
        total = losses.get("total")
        if not isinstance(total, torch.Tensor) or total.ndim != 0:
            raise ValueError(f"missing scalar total loss for {item.family}")
        (total / 5.0).backward()
        total_values.append(total.detach())
        for name, value in losses.items():
            metrics[f"{item.family}/{name}"] = float(value.detach().cpu())
    norm = torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
    optimizer.step()
    metrics["total"] = float(torch.stack(total_values).mean().cpu())
    metrics["gradient_norm"] = float(norm.detach().cpu())
    metrics["optimizer_updates"] = 1.0
    metrics["family_micro_batches"] = 5.0
    return metrics


def train_v3_step(model: OneCoreV3, optimizer: torch.optim.Optimizer,
                  batch: dict[str, Any], *, objective: OneCoreV3Objective | None = None,
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
    values = {key: float(value.detach().cpu()) for key, value in losses.items()}
    values["gradient_norm"] = float(norm.detach().cpu())
    values["optimizer_updates"] = 1.0
    return values
