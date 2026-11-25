"""Small, honest, CPU-only architecture experiments for OneCore.

Everything here trains *miniature* OneCore instances from random init on a
procedurally generated algorithmic task. Results say whether an architectural
idea helps at tiny scale; they are not evidence about the 57.6M model or about
general intelligence. Train/eval sequences are drawn from disjoint RNG streams
and eval sequences are checked against the training set to prevent leakage.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, asdict

import torch
from torch.nn import functional as F

from .config import ModelConfig
from .model import BOS, EOS, MASK, OneCore

DIGITS = 10
SEP = 10  # text-vocab id used as the separator between input and answer


def mini_config(width: int, unique_blocks: int, recurrent_cycles: int,
                max_len: int = 64) -> ModelConfig:
    return ModelConfig(
        width=width, unique_blocks=unique_blocks, recurrent_cycles=recurrent_cycles,
        attention_heads=4, max_sequence_length=max_len, text_vocab_size=16,
        vision_codebook_size=8, audio_codebook_size=8, motion_codebook_size=8,
        dropout=0.0,
    )


def make_prefix_sum_batch(cfg: ModelConfig, batch: int, length: int,
                          generator: torch.Generator) -> tuple[torch.Tensor, torch.Tensor]:
    """Input digits d1..dn, then SEP, then running sum mod 10 at every position.

    Returns (tokens, loss_mask). Only answer positions are scored, so a model
    cannot score well by copying the input.
    """
    digits = torch.randint(0, DIGITS, (batch, length), generator=generator)
    sums = digits.cumsum(dim=1) % DIGITS
    bos = torch.full((batch, 1), cfg.special_id(BOS))
    sep = torch.full((batch, 1), SEP)
    eos = torch.full((batch, 1), cfg.special_id(EOS))
    tokens = torch.cat([bos, digits, sep, sums, eos], dim=1)
    mask = torch.zeros_like(tokens, dtype=torch.bool)
    mask[:, length + 2: length + 2 + length] = True  # positions holding the answer digits
    return tokens, mask


def answer_accuracy(model: OneCore, tokens: torch.Tensor, mask: torch.Tensor) -> tuple[float, float]:
    """(per-token accuracy, exact-sequence accuracy) under teacher forcing on answer positions."""
    model.eval()
    with torch.no_grad():
        pred = model(tokens[:, :-1]).argmax(-1)
    target = tokens[:, 1:]
    m = mask[:, 1:]
    correct = (pred == target) & m
    per_token = float(correct.sum() / m.sum())
    exact = float(((pred == target) | ~m).all(dim=1).float().mean())
    return per_token, exact


@dataclass(frozen=True)
class RunResult:
    name: str
    unique_blocks: int
    cycles: int
    parameters: int
    effective_block_applications: int
    steps: int
    final_train_loss: float
    heldout_token_acc: float
    heldout_exact_acc: float
    seconds: float


def train_and_eval(name: str, width: int, unique_blocks: int, cycles: int, steps: int,
                   length: int = 8, batch: int = 64, lr: float = 2e-3, seed: int = 0,
                   eval_size: int = 512) -> RunResult:
    torch.manual_seed(seed)
    cfg = mini_config(width, unique_blocks, cycles)
    model = OneCore(cfg)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    warmup = max(1, steps // 20)
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / warmup) * max(0.05, 1 - s / steps))
    train_gen = torch.Generator().manual_seed(1000 + seed)
    eval_gen = torch.Generator().manual_seed(999_999)  # disjoint stream
    eval_tokens, eval_mask = make_prefix_sum_batch(cfg, eval_size, length, eval_gen)

    start = time.perf_counter()
    loss_value = float("nan")
    model.train()
    for _ in range(steps):
        tokens, mask = make_prefix_sum_batch(cfg, batch, length, train_gen)
        logits = model(tokens[:, :-1])
        target = tokens[:, 1:]
        m = mask[:, 1:]
        loss = F.cross_entropy(logits[m], target[m])
        if not torch.isfinite(loss):
            raise FloatingPointError(f"non-finite loss in run {name}")
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        loss_value = float(loss.detach())
    seconds = time.perf_counter() - start
    token_acc, exact_acc = answer_accuracy(model, eval_tokens, eval_mask)
    return RunResult(name, unique_blocks, cycles, model.count_parameters(),
                     unique_blocks * cycles, steps, loss_value, token_acc, exact_acc, seconds)


def depth_comparison(width: int = 96, steps: int = 400, length: int = 8,
                     seeds: tuple[int, ...] = (0,)) -> list[RunResult]:
    """Recurrent vs equal-compute non-recurrent vs equal-parameter non-recurrent."""
    plans = [
        ("recurrent 2x3", 2, 3),            # 2 stored blocks, 6 applications
        ("equal-compute 6x1", 6, 1),        # 6 stored blocks, 6 applications
        ("equal-params 2x1", 2, 1),         # 2 stored blocks, 2 applications
    ]
    results = []
    for seed in seeds:
        for name, blocks, cycles in plans:
            results.append(train_and_eval(f"{name} s{seed}", width, blocks, cycles, steps,
                                          length=length, seed=seed))
    return results


def no_leakage(cfg: ModelConfig, length: int, train_seed_base: int = 1000,
               eval_seed: int = 999_999, samples: int = 256) -> int:
    """Count eval sequences that also appear in a sample of the training stream (want 0 for long inputs)."""
    eval_tokens, _ = make_prefix_sum_batch(cfg, samples, length, torch.Generator().manual_seed(eval_seed))
    train_tokens, _ = make_prefix_sum_batch(cfg, samples * 4, length,
                                            torch.Generator().manual_seed(train_seed_base))
    train_set = {tuple(r.tolist()) for r in train_tokens}
    return sum(tuple(r.tolist()) in train_set for r in eval_tokens)


def report_rows(results: list[RunResult]) -> list[dict]:
    return [asdict(r) for r in results]


if __name__ == "__main__":  # python -m onecore.experiments [steps] [length]  (CPU, minutes)
    import json
    import sys

    torch.set_num_threads(2)
    rows = report_rows(depth_comparison(
        width=96, steps=int(sys.argv[1]) if len(sys.argv) > 1 else 500,
        length=int(sys.argv[2]) if len(sys.argv) > 2 else 8))
    print(json.dumps(rows, indent=1))
