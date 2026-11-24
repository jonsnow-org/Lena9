"""Print the exact instantiated OneCore v3 parameter and dense-FLOP report."""
from __future__ import annotations

import json
from typing import Any

from .config import V3Config
from .flops import build_v3_flops_report


def build_report() -> dict[str, Any]:
    config = V3Config()
    model = config.build_model()
    parameters = sum(
        parameter.numel() for parameter in model.parameters()
        if parameter.requires_grad
    )
    report: dict[str, Any] = {
        "architecture_version": config.architecture_version,
        "config_sha256": config.fingerprint,
        "trainable_parameters": parameters,
        "state_dict_tensors": len(model.state_dict()),
    }
    report.update({
        "fp32_parameter_storage_bytes": parameters * 4,
        "fp16_parameter_storage_bytes": parameters * 2,
        "adamw_fp32_moments_storage_estimate_bytes": parameters * 8,
        "max_image_context_tokens": config.max_image_context_tokens,
        "max_video_context_tokens": config.max_video_context_tokens,
        "max_flow_context_tokens": config.max_flow_context_tokens,
        "temporal_window_frames": config.temporal_window_frames,
        "temporal_memory_frames": config.temporal_memory_frames,
        "video_generation_chunk_frames": config.video_generation_chunk_frames,
        "attention_complexity": "quadratic_within_each_bounded_context",
        "storage_estimates_exclude_activations_gradients_runtime_buffers": True,
        "quality_certified": False,
        "flops": build_v3_flops_report(config, model=model),
    })
    return report


def main() -> None:
    print(json.dumps(build_report(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
