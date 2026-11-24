"""Exact OneCore FLOPs accounting from Corrected Specification v2.

FLOPs count one multiply and one add as two operations. The functions use
actual sequence lengths; Joint has five micro-batches and Text has four.
"""
from __future__ import annotations


def block_flops(
    seq_len: int, width: int = 1024, hidden: int = 2730,
    heads: int = 8, head_dim: int = 128,
) -> int:
    if min(seq_len, width, hidden, heads, head_dim) <= 0:
        raise ValueError("FLOPs dimensions must be positive")
    if heads * head_dim != width:
        raise ValueError("heads * head_dim must equal width")
    qkv = seq_len * width * 3 * width
    qk = heads * seq_len * seq_len * head_dim
    av = heads * seq_len * seq_len * head_dim
    out = seq_len * width * width
    mlp = 3 * seq_len * width * hidden
    return 2 * (qkv + qk + av + out + mlp)


def lm_head_flops(seq_len: int, vocab: int = 5144, width: int = 1024) -> int:
    if min(seq_len, vocab, width) <= 0:
        raise ValueError("LM-head dimensions must be positive")
    return 2 * seq_len * vocab * width


def causal_forward_flops(seq_len: int) -> int:
    return 12 * block_flops(seq_len) + lm_head_flops(seq_len)


def tldm_forward_flops(seq_len: int) -> int:
    thinker = 12 * block_flops(16)
    writer = 12 * block_flops(seq_len) + lm_head_flops(seq_len)
    return thinker + writer


def micro_batch_forward_flops(seq_len: int) -> int:
    return causal_forward_flops(seq_len) + tldm_forward_flops(seq_len)


def micro_batch_train_flops(seq_len: int) -> int:
    return 3 * micro_batch_forward_flops(seq_len)


def joint_step_train_flops(seq_len: int) -> int:
    return 5 * micro_batch_train_flops(seq_len)


def text_step_train_flops(seq_len: int) -> int:
    return 4 * micro_batch_train_flops(seq_len)
