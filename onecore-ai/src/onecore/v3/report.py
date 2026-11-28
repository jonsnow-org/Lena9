"""Exact architecture, parameter and storage report for the sole OneCore model."""
from __future__ import annotations

import json
from typing import Any

from .config import V3Config
from .flops import build_v3_flops_report


def build_report() -> dict[str, Any]:
    config = V3Config()
    model = config.build_model()
    parameters = model.count_parameters()
    if config.is_canonical and parameters != 86_152_897:
        raise AssertionError(f"OneCore parameter budget must be 57,579,201, got {parameters:,}")
    report: dict[str, Any] = {
        "architecture_version": config.architecture_version,
        "config_sha256": config.fingerprint,
        "trainable_parameters": parameters,
        "state_dict_tensors": len(model.state_dict()),
        "width": config.width,
        "hidden_size": config.hidden_size,
        "unique_blocks": config.unique_blocks,
        "recurrent_cycles": config.recurrent_cycles,
        "shared_block_applications": config.unique_blocks * config.recurrent_cycles,
        "text_vocab_size": config.text_vocab_size,
        "vision_codebook_size": config.vision_codebook_size,
        "audio_codebook_size": config.audio_codebook_size,
        "motion_codebook_size": config.motion_codebook_size,
        "special_tokens": config.special_tokens,
        "unified_vocab_size": config.vocab_size,
        "tldm_latent_slots": config.tldm_latent_slots,
        "tldm_additional_trainable_parameters": 0,
        "fp32_parameter_storage_bytes": parameters * 4,
        "fp16_parameter_storage_bytes": parameters * 2,
        "int8_storage_bound_bytes": parameters,
        "theoretical_4bit_storage_bound_bytes": (parameters + 1) // 2,
        "adamw_fp32_moments_storage_estimate_bytes": parameters * 8,
        "full_training_state_storage_estimate_bytes": parameters * 16,
        "checkpoint_parameters_plus_adamw_moments_estimate_bytes": parameters * 12,
        "quantized_runtime_available": False,
        "quality_certified": False,
        "promotion_status": "blocked_pending_measured_heldout_evaluation_and_approved_thresholds",
        "flops": build_v3_flops_report(config, model=model),
    }
    return report


def main() -> None:
    print(json.dumps(build_report(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
