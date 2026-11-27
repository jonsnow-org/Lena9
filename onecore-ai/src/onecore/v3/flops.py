"""Exact FLOPs formulas from the corrected OneCore specification, Section 5."""
from __future__ import annotations

from typing import Any

from .config import V3Config
from .core import OneCoreV3

DEFAULT_WIDTH = 1024
DEFAULT_HIDDEN = 2730
DEFAULT_HEADS = 8
DEFAULT_HEAD_DIM = 128
DEFAULT_VOCAB = 5144
SHARED_BLOCK_APPLICATIONS = 12


def block_flops(seq_len: int, width: int = DEFAULT_WIDTH, hidden: int = DEFAULT_HIDDEN,
                heads: int = DEFAULT_HEADS, head_dim: int = DEFAULT_HEAD_DIM) -> int:
    if min(seq_len, width, hidden, heads, head_dim) < 1:
        raise ValueError("sequence and model dimensions must be positive")
    qkv = seq_len * width * 3 * width
    qk = heads * seq_len * seq_len * head_dim
    av = heads * seq_len * seq_len * head_dim
    output = seq_len * width * width
    mlp = 3 * seq_len * width * hidden
    return 2 * (qkv + qk + av + output + mlp)


def lm_head_flops(seq_len: int, vocab: int = DEFAULT_VOCAB, width: int = DEFAULT_WIDTH) -> int:
    if min(seq_len, vocab, width) < 1:
        raise ValueError("sequence, vocabulary and width must be positive")
    return 2 * seq_len * vocab * width


def causal_forward_flops(seq_len: int) -> int:
    return SHARED_BLOCK_APPLICATIONS * block_flops(seq_len) + lm_head_flops(seq_len)


def tldm_forward_flops(seq_len: int) -> int:
    thinker = SHARED_BLOCK_APPLICATIONS * block_flops(16)
    writer = SHARED_BLOCK_APPLICATIONS * block_flops(seq_len) + lm_head_flops(seq_len)
    return thinker + writer


def micro_batch_forward_flops(seq_len: int) -> int:
    return causal_forward_flops(seq_len) + tldm_forward_flops(seq_len)


def micro_batch_train_flops(seq_len: int) -> int:
    return 3 * micro_batch_forward_flops(seq_len)


def joint_step_train_flops(seq_len: int) -> int:
    return 5 * micro_batch_train_flops(seq_len)


def text_step_train_flops(seq_len: int) -> int:
    return 4 * micro_batch_train_flops(seq_len)


def _path(sequence_tokens: int) -> dict[str, Any]:
    causal = causal_forward_flops(sequence_tokens)
    thinker = SHARED_BLOCK_APPLICATIONS * block_flops(16)
    writer_body = SHARED_BLOCK_APPLICATIONS * block_flops(sequence_tokens)
    projection = lm_head_flops(sequence_tokens)
    tldm = thinker + writer_body + projection
    return {
        "sequence_tokens": sequence_tokens,
        "dense_flops": causal + tldm,
        "causal_forward_flops": causal,
        "native_tldm_forward_flops": tldm,
        "breakdown": {
            "causal_shared_core": SHARED_BLOCK_APPLICATIONS * block_flops(sequence_tokens),
            "native_tldm": {
                "thinker_shared_core": thinker,
                "writer_shared_core": writer_body,
                "tied_text_output_projection": projection,
                "additional_trainable_parameters": 0,
            },
        },
        "scope": "12 shared block applications plus tied LM head; codec projection FLOPs excluded per the specification's Section 5 formula",
    }


def build_v3_flops_report(config: V3Config, model: OneCoreV3 | None = None) -> dict[str, Any]:
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    model = model or config.build_model()
    if model.cfg.to_dict() != config.to_dict():
        raise ValueError("FLOPs model/config mismatch")
    if config.is_canonical:
        expected = {
            128: 1_296_720_199_680,
            512: 5_258_827_530_240,
        }
        for length, value in expected.items():
            if joint_step_train_flops(length) != value:
                raise AssertionError(f"corrected specification FLOPs mismatch at T={length}")
    paths = {
        "text": _path(512),
        "tool": _path(512),
        "image": _path(121),
        "audio": _path(244),
        "video": _path(512),
    }
    joint_forward = sum(int(item["dense_flops"]) for item in paths.values())
    joint_train = 3 * joint_forward
    examples = {}
    for length in (64, 128, 256, 512):
        examples[str(length)] = {
            "block_flops": block_flops(length),
            "causal_forward_flops": causal_forward_flops(length),
            "tldm_forward_flops": tldm_forward_flops(length),
            "micro_batch_forward_flops": micro_batch_forward_flops(length),
            "micro_batch_train_flops": micro_batch_train_flops(length),
            "joint_step_train_flops": joint_step_train_flops(length),
            "text_step_train_flops": text_step_train_flops(length),
        }
    return {
        "config_sha256": config.fingerprint,
        "counting_convention": "2 FLOPs per multiply-accumulate; QKV, QK, AV, output, SwiGLU and tied LM head included",
        "shared_block_applications": SHARED_BLOCK_APPLICATIONS,
        "width": config.width,
        "hidden": config.hidden_size,
        "heads": config.attention_heads,
        "head_dim": config.width // config.attention_heads,
        "vocabulary": config.vocab_size,
        "tldm_latent_slots": config.tldm_latent_slots,
        "tldm_additional_trainable_parameters": 0,
        "paths": paths,
        "joint_five_family_forward_dense_flops": joint_forward,
        "joint_five_family_train_dense_flops": joint_train,
        "joint_micro_batches_per_update": 5,
        "text_micro_batches_per_update": 4,
        "sequence_length_examples": examples,
        "excluded_from_counter": ["codec projections", "VQ distance reductions and argmin", "normalization", "activation functions", "softmax", "masking", "optimizer arithmetic", "data movement", "loss arithmetic"],
        "measured_runtime": False,
    }
