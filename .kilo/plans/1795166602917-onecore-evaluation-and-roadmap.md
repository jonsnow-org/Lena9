# OneCore Evaluation, Issues, and Development Roadmap

## 1. Project Evaluation

Strengths:
- Unified single-checkpoint design with tied embedding/LM head; no donor weights.
- Recurrent shared blocks (4×3) keep param count ~57.6M within 50–70M CI budget.
- T-LDM latent diffusion path adds 0 trainable params and reuses shared components.
- Modality codecs (image/audio/motion) are part of checkpoint and quantized into shared vocab.
- Adaptive inference pass and codebook usage metrics included.
- Strict tool runtime (allowlisted, no shell/Python execution).

Weaknesses:
- First research baseline only; synthetic curriculum; no broad knowledge.
- Griffin-Lim baseline vocoder (not neural) → low audio quality.
- Small vocab (4096 text) and image 64×64 / 8×8 patches → limited fidelity.
- Codebook collapse risk despite seeding.
- No quantization/low-bit inference yet.
- No Android CPU/RAM/battery benchmark yet.

## 2. Issues / Bugs Needing Fix

1. Codebook collapse: monitor `codebook_usage`; add periodic re-seeding / EMA updates; tests `test_evaluate_codebooks`.
2. T-LDM diffusion leaves masked tokens unrevealed → RuntimeError; ensure reveal_count covers all positions; verify `generate_tldm` final pass.
3. Adaptive inference tolerance (0.015) may stop too early; expose as config; add tests.
4. `forward_tldm_hidden` uses interpolation size mismatch risk when latent_slots > seq; verify `compress_to_latents` clamps slots.
5. Audio decoder reshaping: `decode_audio_codes` reshape to (-1, audio_bins) may misalign grouped frames; verify.
6. Video generation stream concatenation may produce invalid token sequences; add validation tests.
7. Parameter budget enforcement in CI should fail build if outside 50–70M.
8. `initialize_codebook` device/dtype handling; ensure centers copied in correct dtype.
9. Missing robustness: input validation for empty sequences in `compress_to_latents` (already checks <1).
10. Documentation: never describe bootstrap checkpoint as trained intelligence.

## 3. Development Roadmap (before implementation)

Phase A — Stabilize baseline (no new capability):
- Fix above issues; add focused unit tests.
- Add codebook usage/collapse metrics to CI.
- Validate T-LDM round-trip reconstruction on synthetic data.

Phase B — Data & curriculum:
- Expand paired multimodal corpus (text/image/audio/video/tool).
- Measure text/tool and cross-modal generalization on held-out data.

Phase C — Architecture experiments:
- Compare recurrent cycles vs equal-compute non-recurrent baseline.
- Tune unique_blocks/cycles under param budget.

Phase D — Quality improvements:
- Replace Griffin-Lim with neural vocoder (still within checkpoint).
- Increase image resolution and vocab if budget allows.

Phase E — Deployment:
- Quantization/low-bit inference after stable full-precision baseline.
- Android CPU/RAM/battery benchmark; optimize.

## 4. Validation Plan

- Run `onecore-ai` tests: architecture, config, tokenizer corpus, evaluate codebooks, tool eval/episodes.
- CI param budget check.
- Reconstruction quality metrics on synthetic modalities.
- Held-out generalization eval.

## 5. Open Questions

- Target param budget increase beyond 70M?
- Neural vocoder in-checkpoint vs external? (must stay in-checkpoint per contract)
- Adaptive pass tolerance default?