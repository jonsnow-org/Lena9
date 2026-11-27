"""Shape-aware dense FLOP accounting for the instantiated OneCore V3 graph.

The counter is exact for convolution and matrix-multiplication arithmetic in the
specified forward workloads. It uses 2 FLOPs per multiply-accumulate. It
intentionally excludes bias additions, normalization, activations, softmax,
masking, pooling, interpolation, quantizer reductions/argmin, data movement,
losses, and backward propagation; those exclusions are reported explicitly.
"""
from __future__ import annotations

import json
import math
from typing import Any

from torch import nn

from .config import V3Config
from .core import OneCoreV3


def _pair(value: Any) -> tuple[int, int]:
    if isinstance(value, tuple):
        return int(value[0]), int(value[1])
    return int(value), int(value)


def _conv1d_output(length: int, layer: nn.Conv1d) -> int:
    kernel = int(layer.kernel_size[0])
    stride = int(layer.stride[0])
    padding = int(layer.padding[0])
    dilation = int(layer.dilation[0])
    return (length + 2 * padding - dilation * (kernel - 1) - 1) // stride + 1


def _conv_transpose1d_output(length: int, layer: nn.ConvTranspose1d) -> int:
    kernel = int(layer.kernel_size[0])
    stride = int(layer.stride[0])
    padding = int(layer.padding[0])
    dilation = int(layer.dilation[0])
    output_padding = int(layer.output_padding[0])
    return (length - 1) * stride - 2 * padding + dilation * (kernel - 1) + output_padding + 1


def _conv2d_output(height: int, width: int, layer: nn.Conv2d) -> tuple[int, int]:
    kh, kw = _pair(layer.kernel_size)
    sh, sw = _pair(layer.stride)
    ph, pw = _pair(layer.padding)
    dh, dw = _pair(layer.dilation)
    out_h = (height + 2 * ph - dh * (kh - 1) - 1) // sh + 1
    out_w = (width + 2 * pw - dw * (kw - 1) - 1) // sw + 1
    return out_h, out_w


def _conv_transpose2d_output(
    height: int, width: int, layer: nn.ConvTranspose2d
) -> tuple[int, int]:
    kh, kw = _pair(layer.kernel_size)
    sh, sw = _pair(layer.stride)
    ph, pw = _pair(layer.padding)
    dh, dw = _pair(layer.dilation)
    oph, opw = _pair(layer.output_padding)
    out_h = (height - 1) * sh - 2 * ph + dh * (kh - 1) + oph + 1
    out_w = (width - 1) * sw - 2 * pw + dw * (kw - 1) + opw + 1
    return out_h, out_w


def _conv1d_flops(layer: nn.Conv1d, batch: int, length: int) -> tuple[int, int]:
    output_length = _conv1d_output(length, layer)
    if output_length < 1:
        raise ValueError("Conv1d workload produces an empty sequence")
    kernel = int(layer.kernel_size[0])
    macs = (
        batch * output_length * int(layer.out_channels)
        * (int(layer.in_channels) // int(layer.groups)) * kernel
    )
    return 2 * macs, output_length


def _conv_transpose1d_flops(
    layer: nn.ConvTranspose1d, batch: int, length: int
) -> tuple[int, int]:
    output_length = _conv_transpose1d_output(length, layer)
    if output_length < 1:
        raise ValueError("ConvTranspose1d workload produces an empty sequence")
    kernel = int(layer.kernel_size[0])
    macs = (
        batch * length * int(layer.in_channels)
        * (int(layer.out_channels) // int(layer.groups)) * kernel
    )
    return 2 * macs, output_length


def _conv2d_flops(
    layer: nn.Conv2d, batch: int, height: int, width: int
) -> tuple[int, int, int]:
    out_h, out_w = _conv2d_output(height, width, layer)
    if min(out_h, out_w) < 1:
        raise ValueError("Conv2d workload produces an empty spatial grid")
    kh, kw = _pair(layer.kernel_size)
    macs = (
        batch * out_h * out_w * int(layer.out_channels)
        * (int(layer.in_channels) // int(layer.groups)) * kh * kw
    )
    return 2 * macs, out_h, out_w


def _conv_transpose2d_flops(
    layer: nn.ConvTranspose2d, batch: int, height: int, width: int
) -> tuple[int, int, int]:
    out_h, out_w = _conv_transpose2d_output(height, width, layer)
    kh, kw = _pair(layer.kernel_size)
    macs = (
        batch * height * width * int(layer.in_channels)
        * (int(layer.out_channels) // int(layer.groups)) * kh * kw
    )
    return 2 * macs, out_h, out_w


def _linear_flops(layer: nn.Linear, batch_positions: int) -> int:
    return 2 * batch_positions * int(layer.in_features) * int(layer.out_features)


def _transformer_layer_flops(layer: nn.TransformerEncoderLayer, batch: int, sequence: int) -> int:
    """Count Q/K/V, output projection, QKᵀ, AV, and both FFN matrix products."""
    if batch < 1 or sequence < 1:
        raise ValueError("Transformer batch and sequence dimensions must be positive")
    attention = layer.self_attn
    width = int(attention.embed_dim)
    heads = int(attention.num_heads)
    if width % heads:
        raise ValueError("attention width is not divisible by its head count")
    if attention.in_proj_weight is not None:
        qkv = 2 * batch * sequence * int(attention.in_proj_weight.shape[0]) * int(
            attention.in_proj_weight.shape[1]
        )
    else:
        projections = (
            attention.q_proj_weight, attention.k_proj_weight, attention.v_proj_weight
        )
        if any(weight is None for weight in projections):
            raise ValueError("unsupported attention projection layout")
        qkv = sum(
            2 * batch * sequence * int(weight.shape[0]) * int(weight.shape[1])
            for weight in projections
        )
    output_projection = _linear_flops(attention.out_proj, batch * sequence)
    head_width = width // heads
    attention_products = 4 * batch * heads * sequence * sequence * head_width
    feed_forward = (
        _linear_flops(layer.linear1, batch * sequence)
        + _linear_flops(layer.linear2, batch * sequence)
    )
    return qkv + output_projection + attention_products + feed_forward


def _shared_core_flops(model: OneCoreV3, batch: int, sequence: int) -> int:
    one_cycle = sum(
        _transformer_layer_flops(layer, batch, sequence)
        for layer in model.shared_core.layers
    )
    return one_cycle * int(model.shared_core.cycles)


def _tldm_path_flops(model: OneCoreV3, batch: int, text_tokens: int) -> tuple[int, dict[str, int]]:
    slots = min(int(model.tldm_latent_slots), text_tokens)
    thinker = _shared_core_flops(model, batch, slots)
    writer = _shared_core_flops(model, batch, slots + text_tokens)
    tied_head = _linear_flops(model.text_head, batch * text_tokens)
    parts = {
        "latent_thinker_shared_core": thinker,
        "diffusion_writer_shared_core": writer,
        "tied_text_output_projection": tied_head,
    }
    return sum(parts.values()), parts


def _linear_stack_flops(module: nn.Module, batch_positions: int) -> int:
    return sum(
        _linear_flops(layer, batch_positions)
        for layer in module.modules()
        if isinstance(layer, nn.Linear)
    )


def _image_codec_flops(
    codec: nn.Module, batch: int, height: int, width: int
) -> tuple[int, int, int, int]:
    patch = int(codec.patch_size)
    padded_h = math.ceil(height / patch) * patch
    padded_w = math.ceil(width / patch) * patch
    encode_flops, grid_h, grid_w = _conv2d_flops(
        codec.encoder, batch, padded_h, padded_w
    )
    decode_flops, decoded_h, decoded_w = _conv_transpose2d_flops(
        codec.decoder, batch, grid_h, grid_w
    )
    if decoded_h < height or decoded_w < width:
        raise ValueError("image decoder output is smaller than the requested image")
    return encode_flops + decode_flops, grid_h, grid_w, encode_flops


def _image_context_tokens(model: OneCoreV3, grid_h: int, grid_w: int) -> int:
    maximum = int(model.max_image_context_tokens)
    scale = min(1.0, (maximum / (grid_h * grid_w)) ** 0.5)
    context_h = max(1, min(grid_h, maximum, int(grid_h * scale)))
    context_w = max(1, min(grid_w, maximum // context_h))
    return context_h * context_w


def _audio_path_flops(
    model: OneCoreV3, batch: int, samples: int, sample_rate: int
) -> tuple[int, int, dict[str, int]]:
    codec = model.audio_codec
    if sample_rate != int(codec.sample_rate):
        raise ValueError(
            f"audio workload must use canonical {codec.sample_rate} Hz, got {sample_rate}"
        )
    if samples < 1:
        raise ValueError("audio_samples must be positive")
    padded_samples = math.ceil(samples / int(codec.downsample_factor)) * int(
        codec.downsample_factor
    )
    length = padded_samples
    encoder_flops = 0
    for layer in codec.encoder:
        if isinstance(layer, nn.Conv1d):
            value, length = _conv1d_flops(layer, batch, length)
            encoder_flops += value
    latent_length = length
    quantizer_flops = sum(
        2 * batch * latent_length * int(codebook.embedding_dim) * int(codebook.num_embeddings)
        for codebook in codec.quantizer.codebooks
    )
    to_shared, shared_length = _conv1d_flops(model.audio_to_shared, batch, latent_length)
    if shared_length != latent_length:
        raise ValueError("audio-to-shared projection unexpectedly changes sequence length")
    shared_core = _shared_core_flops(model, batch, latent_length)
    from_shared, decoded_latent_length = _conv1d_flops(
        model.shared_to_audio, batch, latent_length
    )
    decoder_flops = 0
    decoded_length = decoded_latent_length
    for layer in codec.decoder:
        if isinstance(layer, nn.ConvTranspose1d):
            value, decoded_length = _conv_transpose1d_flops(layer, batch, decoded_length)
            decoder_flops += value
    parts = {
        "audio_encoder_convolutions": encoder_flops,
        "rvq_codebook_distance_matmuls": quantizer_flops,
        "audio_to_shared_projection": to_shared,
        "shared_recurrent_core": shared_core,
        "shared_to_audio_projection": from_shared,
        "audio_decoder_convolutions": decoder_flops,
    }
    return sum(parts.values()), latent_length, parts


def _video_path_flops(
    model: OneCoreV3,
    batch: int,
    frames: int,
    height: int,
    width: int,
    frame_chunk_size: int | None,
) -> tuple[int, int, int, dict[str, int]]:
    if frames < 1:
        raise ValueError("video_frames must be positive")
    codec = model.video_codec
    image_codec = codec.image_codec
    image_total, grid_h, grid_w, image_encode = _image_codec_flops(
        image_codec, batch * frames, height, width
    )
    # image_total includes both encode and decode; split them to avoid double-counting
    # the decoder below when presenting the video path breakdown.
    image_decode = image_total - image_encode
    patches = grid_h * grid_w
    chunk_size = int(codec.temporal_window_frames) if frame_chunk_size is None else int(
        frame_chunk_size
    )
    if chunk_size < 1:
        raise ValueError("frame_chunk_size must be positive")
    chunk_size = min(chunk_size, int(codec.temporal_window_frames))
    temporal_memory = 0
    shared_memory = 0
    temporal_flops = 0
    shared_flops = 0
    time_projection_flops = 0
    start = 0
    while start < frames:
        current = min(chunk_size, frames - start)
        time_projection_flops += _linear_stack_flops(codec.time_projection, batch * current)
        temporal_sequence = temporal_memory + current
        temporal_flops += sum(
            _transformer_layer_flops(layer, batch * patches, temporal_sequence)
            for layer in codec.temporal.layers
        )
        temporal_memory = min(int(codec.temporal_memory_frames), temporal_sequence)
        local_tokens = current * patches
        context_tokens = min(int(model.max_video_context_tokens), local_tokens)
        shared_flops += _shared_core_flops(
            model, batch, shared_memory + context_tokens
        )
        shared_memory = min(32, shared_memory + context_tokens)
        start += current
    parts = {
        "video_frame_image_encoder": image_encode,
        "video_temporal_transformer": temporal_flops,
        "video_time_projection": time_projection_flops,
        "shared_recurrent_core": shared_flops,
        "video_frame_image_decoder": image_decode,
    }
    return sum(parts.values()), grid_h, grid_w, parts


def _flow_step_flops(
    model: OneCoreV3,
    modality: str,
    batch: int,
    target_tokens: int,
    condition_tokens: int = 0,
) -> tuple[int, dict[str, int], int, int]:
    if modality not in model.flow_velocity_heads:
        raise ValueError(f"unknown flow modality: {modality}")
    if min(batch, target_tokens) < 1 or condition_tokens < 0:
        raise ValueError("flow workload dimensions are invalid")
    context_budget = int(model.max_flow_context_tokens)
    condition_budget = min(condition_tokens, max(0, context_budget // 2))
    target_budget = max(1, context_budget - condition_budget)
    effective_target = min(target_tokens, target_budget)
    sequence = condition_budget + effective_target
    time_flops = _linear_stack_flops(model.flow_time, batch)
    core_flops = _shared_core_flops(model, batch, sequence)
    head_flops = _linear_flops(
        model.flow_velocity_heads[modality], batch * effective_target
    )
    parts = {
        "flow_time_mlp": time_flops,
        "shared_recurrent_core": core_flops,
        "modality_flow_head": head_flops,
    }
    return sum(parts.values()), parts, sequence, effective_target


def _assert_model_matches_config(model: OneCoreV3, config: V3Config) -> None:
    checks = {
        "text vocabulary": int(model.text_embedding.num_embeddings) == int(config.text_vocab_size),
        "shared width": int(model.width) == int(config.width),
        "shared layer count": len(model.shared_core.layers) == int(config.layers),
        "shared recurrent cycles": int(model.shared_core.cycles) == int(config.cycles),
        "attention heads": all(
            int(layer.self_attn.num_heads) == int(config.attention_heads)
            for layer in model.shared_core.layers
        ) and all(
            int(layer.self_attn.num_heads) == int(config.attention_heads)
            for layer in model.video_codec.temporal.layers
        ),
        "image patch size": int(model.image_codec.patch_size) == int(config.patch_size),
        "video image patch size": int(model.video_codec.image_codec.patch_size) == int(config.patch_size),
        "audio channels": int(model.audio_codec.channels) == int(config.audio_channels),
        "audio latent channels": int(model.audio_codec.latent_channels) == int(config.audio_latent_channels),
        "audio hidden channels": int(model.audio_codec.encoder[0].out_channels) == int(config.audio_hidden_channels),
        "audio codebook size": all(
            int(book.num_embeddings) == int(config.audio_codebook_size)
            for book in model.audio_codec.quantizer.codebooks
        ),
        "audio quantizer stages": len(model.audio_codec.quantizer.codebooks) == int(config.audio_quantizer_stages),
        "audio sample rate": int(model.audio_codec.sample_rate) == int(config.audio_sample_rate),
        "temporal layer count": len(model.video_codec.temporal.layers) == int(config.temporal_layers),
        "image context": int(model.max_image_context_tokens) == int(config.max_image_context_tokens),
        "video context": int(model.max_video_context_tokens) == int(config.max_video_context_tokens),
        "flow context": int(model.max_flow_context_tokens) == int(config.max_flow_context_tokens),
        "temporal window": int(model.video_codec.temporal_window_frames) == int(config.temporal_window_frames),
        "temporal memory": int(model.video_codec.temporal_memory_frames) == int(config.temporal_memory_frames),
        "video generation chunk": int(model.video_generation_chunk_frames) == int(config.video_generation_chunk_frames),
        "T-LDM latent slots": int(model.tldm_latent_slots) == int(config.tldm_latent_slots),
    }
    mismatches = [name for name, matches in checks.items() if not matches]
    if mismatches:
        raise ValueError("model/config mismatch for FLOP report: " + ", ".join(mismatches))


def build_v3_flops_report(
    config: V3Config | None = None,
    *,
    model: OneCoreV3 | None = None,
    batch_size: int = 1,
    text_tokens: int = 128,
    image_height: int = 256,
    image_width: int = 256,
    audio_samples: int = 24_000,
    audio_sample_rate: int = 24_000,
    video_frames: int = 13,
    video_height: int = 256,
    video_width: int = 256,
    video_frame_chunk_size: int | None = None,
    flow_steps: int = 32,
) -> dict[str, Any]:
    """Return exact dense forward FLOPs for explicit reference shapes.

    Tool examples share the text forward path. Flow sampling is reported separately
    from the five reconstruction/encoding forward paths.
    """
    config = V3Config() if config is None else config
    model = config.build_model() if model is None else model
    _assert_model_matches_config(model, config)
    if min(batch_size, text_tokens, image_height, image_width, audio_samples,
           video_frames, video_height, video_width, flow_steps) < 1:
        raise ValueError("all FLOP workload dimensions and flow_steps must be positive")

    text_core = _shared_core_flops(model, batch_size, text_tokens)
    text_head = _linear_flops(model.text_head, batch_size * text_tokens)
    tldm_total, tldm_parts = _tldm_path_flops(model, batch_size, text_tokens)
    text_total = text_core + text_head + tldm_total

    image_total, image_grid_h, image_grid_w, image_encoder = _image_codec_flops(
        model.image_codec, batch_size, image_height, image_width
    )
    image_decoder = image_total - image_encoder
    image_context = _image_context_tokens(model, image_grid_h, image_grid_w)
    image_core = _shared_core_flops(model, batch_size, image_context)
    image_forward = image_total + image_core

    audio_forward, audio_latents, audio_parts = _audio_path_flops(
        model, batch_size, audio_samples, audio_sample_rate
    )

    video_forward, video_grid_h, video_grid_w, video_parts = _video_path_flops(
        model, batch_size, video_frames, video_height, video_width,
        video_frame_chunk_size,
    )
    video_patches = video_grid_h * video_grid_w

    flow_targets = {
        "image": image_grid_h * image_grid_w,
        "audio": audio_latents,
        "video": min(video_frames, int(model.video_generation_chunk_frames)) * video_patches,
    }
    flow_report: dict[str, Any] = {}
    for modality, target_tokens in flow_targets.items():
        per_step, parts, sequence, effective_target = _flow_step_flops(
            model, modality, batch_size, target_tokens
        )
        flow_report[modality] = {
            "target_tokens": target_tokens,
            "condition_tokens": 0,
            "unconditioned_reference": True,
            "effective_target_tokens_after_context_cap": effective_target,
            "shared_context_sequence_tokens": sequence,
            "per_step_dense_flops": per_step,
            "sampling_steps": flow_steps,
            "sampling_dense_flops": per_step * flow_steps,
            "breakdown": parts,
        }

    paths = {
        "text": {"dense_flops": text_total, "breakdown": {
            "causal_shared_recurrent_core": text_core,
            "causal_tied_text_output_projection": text_head,
            "native_tldm": tldm_parts,
        }},
        "tool": {"dense_flops": text_total, "same_path_as": "text"},
        "image": {"dense_flops": image_forward, "context_tokens": image_context, "breakdown": {
            "image_encoder": image_encoder, "shared_recurrent_core": image_core,
            "image_decoder": image_decoder,
        }},
        "audio": {"dense_flops": audio_forward, "latent_tokens": audio_latents,
                  "breakdown": audio_parts},
        "video": {"dense_flops": video_forward, "spatial_patches_per_frame": video_patches,
                  "breakdown": video_parts},
    }
    joint_forward = sum(int(paths[name]["dense_flops"]) for name in (
        "text", "tool", "image", "audio", "video"
    ))
    return {
        "architecture_version": config.architecture_version,
        "config_sha256": config.fingerprint,
        "counting_convention": "2 FLOPs per multiply-accumulate; exact for counted dense matrix products and convolutions",
        "scope": "forward arithmetic only; no backward pass or training loss",
        "excluded_operations": [
            "bias additions", "layer normalization", "GELU/SiLU and other activations",
            "softmax and attention masking", "sinusoidal position generation",
            "pooling and interpolation", "RVQ distance reductions and argmin",
            "padding, copies, concatenation, and other memory movement",
        ],
        "reference_workload": {
            "batch_size_per_micro_batch": batch_size,
            "text_tokens": text_tokens,
            "tool_tokens": text_tokens,
            "image_height": image_height,
            "image_width": image_width,
            "audio_samples": audio_samples,
            "audio_sample_rate": audio_sample_rate,
            "audio_channels": int(model.audio_codec.channels),
            "video_frames": video_frames,
            "video_height": video_height,
            "video_width": video_width,
            "video_frame_chunk_size": min(
                int(model.video_codec.temporal_window_frames),
                int(model.video_codec.temporal_window_frames)
                if video_frame_chunk_size is None else int(video_frame_chunk_size),
            ),
            "flow_sampling_steps": flow_steps,
        },
        "paths": paths,
        "flow_sampling": {
            "scope": "unconditioned flow-time MLP + shared core + modality flow head; decoder FLOPs are excluded",
            "modalities": flow_report,
        },
        "joint_five_family_forward_dense_flops": joint_forward,
        "joint_five_family_forward_dense_tflops": joint_forward / 1e12,
    }


def main() -> None:
    print(json.dumps(build_v3_flops_report(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
