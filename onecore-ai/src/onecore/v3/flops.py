"""Config-aware FLOPs formulas for the canonical OneCore V3 model."""
from __future__ import annotations
from typing import Any
from .config import V3Config
from .core import OneCoreV3

DEFAULT_WIDTH = 1024
DEFAULT_HIDDEN = 2730
DEFAULT_HEADS = 8
DEFAULT_HEAD_DIM = 128
DEFAULT_VOCAB = 33048
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


def _dims(config: V3Config | None) -> tuple[int, int, int, int, int, int]:
    if config is None:
        return DEFAULT_WIDTH, DEFAULT_HIDDEN, DEFAULT_HEADS, DEFAULT_HEAD_DIM, DEFAULT_VOCAB, SHARED_BLOCK_APPLICATIONS
    return (config.width, config.hidden_size, config.attention_heads,
            config.width // config.attention_heads, config.vocab_size,
            config.unique_blocks * config.recurrent_cycles)


def _block(seq_len: int, config: V3Config | None) -> int:
    width, hidden, heads, head_dim, _, _ = _dims(config)
    return block_flops(seq_len, width, hidden, heads, head_dim)


def _head(seq_len: int, config: V3Config | None) -> int:
    width, _, _, _, vocab, _ = _dims(config)
    return lm_head_flops(seq_len, vocab, width)


def causal_forward_flops(seq_len: int, config: V3Config | None = None) -> int:
    return _dims(config)[5] * _block(seq_len, config) + _head(seq_len, config)


def tldm_forward_flops(seq_len: int, config: V3Config | None = None) -> int:
    apps = _dims(config)[5]
    latent = 16 if config is None else config.tldm_latent_slots
    return apps * _block(latent, config) + apps * _block(seq_len, config) + _head(seq_len, config)


def micro_batch_forward_flops(seq_len: int, config: V3Config | None = None) -> int:
    return causal_forward_flops(seq_len, config) + tldm_forward_flops(seq_len, config)


def micro_batch_train_flops(seq_len: int, config: V3Config | None = None) -> int:
    return 3 * micro_batch_forward_flops(seq_len, config)


def joint_step_train_flops(seq_len: int, config: V3Config | None = None) -> int:
    return 5 * micro_batch_train_flops(seq_len, config)


def text_step_train_flops(seq_len: int, config: V3Config | None = None) -> int:
    return 4 * micro_batch_train_flops(seq_len, config)


def _path(sequence_tokens: int, config: V3Config) -> dict[str, Any]:
    apps = _dims(config)[5]
    causal_core = apps * _block(sequence_tokens, config)
    causal = causal_core + _head(sequence_tokens, config)
    thinker = apps * _block(config.tldm_latent_slots, config)
    writer_body = apps * _block(sequence_tokens, config)
    projection = _head(sequence_tokens, config)
    tldm = thinker + writer_body + projection
    return {
        "sequence_tokens": sequence_tokens, "dense_flops": causal + tldm,
        "causal_forward_flops": causal, "native_tldm_forward_flops": tldm,
        "breakdown": {
            "causal_shared_core": causal_core,
            "native_tldm": {"thinker_shared_core": thinker, "writer_shared_core": writer_body,
                            "tied_text_output_projection": projection, "additional_trainable_parameters": 0},
        },
        "scope": "config-specific shared block applications plus tied LM head; codec projection FLOPs excluded per the specification's Section 5 formula",
    }


def build_v3_flops_report(config: V3Config, model: OneCoreV3 | None = None) -> dict[str, Any]:
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    model = model or config.build_model()
    if model.cfg.to_dict() != config.to_dict():
        raise ValueError("FLOPs model/config mismatch")
    if config.is_canonical:
        expected = {128: 1_516_166_184_960, 512: 6_136_611_471_360}
        for length, value in expected.items():
            if joint_step_train_flops(length, config) != value:
                raise AssertionError(f"corrected-spec-3 FLOPs mismatch at T={length}")
    paths = {"text": _path(512, config), "tool": _path(512, config),
             "image": _path(121, config), "audio": _path(244, config), "video": _path(512, config)}
    joint_forward = sum(int(item["dense_flops"]) for item in paths.values())
    examples = {}
    for length in (64, 128, 256, 512):
        examples[str(length)] = {
            "block_flops": _block(length, config),
            "causal_forward_flops": causal_forward_flops(length, config),
            "tldm_forward_flops": tldm_forward_flops(length, config),
            "micro_batch_forward_flops": micro_batch_forward_flops(length, config),
            "micro_batch_train_flops": micro_batch_train_flops(length, config),
            "joint_step_train_flops": joint_step_train_flops(length, config),
            "text_step_train_flops": text_step_train_flops(length, config),
        }
    width, hidden, heads, head_dim, vocab, apps = _dims(config)
    return {
        "config_sha256": config.fingerprint,
        "counting_convention": "2 FLOPs per multiply-accumulate; QKV, QK, AV, output, SwiGLU and tied LM head included",
        "shared_block_applications": apps, "width": width, "hidden": hidden,
        "heads": heads, "head_dim": head_dim, "vocabulary": vocab,
        "tldm_latent_slots": config.tldm_latent_slots, "tldm_additional_trainable_parameters": 0,
        "paths": paths, "joint_five_family_forward_dense_flops": joint_forward,
        "joint_five_family_train_dense_flops": 3 * joint_forward,
        "joint_micro_batches_per_update": 5, "text_micro_batches_per_update": 4,
        "sequence_length_examples": examples,
        "excluded_from_counter": ["codec projections", "VQ distance reductions and argmin", "normalization", "activation functions", "softmax", "masking", "optimizer arithmetic", "data movement", "loss arithmetic"],
        "measured_runtime": False,
    }
