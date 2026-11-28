# OneCore AI

**One model. One architecture. One training lineage.**

OneCore is a from-scratch unified multimodal model. The sole implementation is under `onecore-ai/src/onecore/v3/`. Text, tool, image, audio and video tasks share one semantic Transformer core, one parameter set, one checkpoint lineage and one optimizer/scheduler/RNG lineage.

Before making engineering changes, read `AGENTS.md`, `SESSION_PROTOCOL.md` and the complete `docs/EXECUTIVE_HANDOVER.md`. Inspect the live branch, lock, pull request and Actions evidence; do not rely only on a prior report.

## Canonical model — corrected-spec-3

The repository owner's current contract is `onecore-v3-corrected-spec-3`:

- **32,000 text BPE tokens** and **33,048 unified token IDs**.
- **86,152,897 trainable parameters**; the text embedding and output head are tied and counted once.
- Width 1,024; four unique Transformer blocks reused over three cycles; eight attention heads; SwiGLU hidden width 2,730; context 512.
- One shared text embedding and tied output projection.
- Image, waveform-audio and video paths use their modality codecs and flow heads while sharing the semantic core.
- Native T-LDM uses 16 latent slots and the same Transformer and tied text head. It adds zero trainable parameters. Its configured objective weight is 0.15 for text and tool batches.

Corrected-spec-3 supersedes the historical corrected-spec-2 contract (4,096 text tokens, 5,144 unified IDs and 57,579,201 parameters). This is an architecture and checkpoint-lineage change, not a tokenizer-only change. See `docs/ADR-corrected-spec-3.md`.

## Tokenizer and data provenance

The active tokenizer is being adopted without refitting from the immutable historical 32K artifact:

- Source run `45336933362`, artifact `14894835517`, name `onecore-v3-tokenizer-45325008221`.
- Archive SHA-256: `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- Tokenizer JSON SHA-256: `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.
- Source evidence SHA-256: `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`.
- 591,525 external TRAIN text rows; manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external text-row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`.
- Validation/test rows used: 0; V2 tokenizer imported: false. The tokenizer JSON bytes must remain unchanged; only the evidence sidecar is re-attested with the corrected-spec-3 tokenizer-contract fingerprint.

The 4K tokenizer artifact `15256164799` is retained as immutable historical evidence, not as the active tokenizer. The original corpus artifact `14892594659` remains the pinned data input; do not redownload or refit without proof that an artifact is missing, expired or corrupt. The conversion report records 37 unmatched historical source rows and 1,302 non-external rows excluded; no synthetic data was added.

## Source layout and workflows

- `src/onecore/v3/core.py`: one shared multimodal model and native T-LDM.
- `src/onecore/v3/training.py`: joint text/tool/image/audio/video objective.
- `src/onecore/v3/runner.py`: bounded, checkpointed CPU training entry point.
- `src/onecore/v3/checkpoint.py`: strict checkpoint integrity and lineage.
- `src/onecore/v3/tokenizer.py`: sole tokenizer training, adoption and verification path.
- `src/onecore/v3/flops.py`: configuration-aware dense FLOPs accounting.
- `.github/workflows/onecore-ci.yml`: canonical verification and explicitly selected real-artifact gates.
- `.github/workflows/onecore-v3-tokenizer.yml`: verifies and adopts the existing 32K tokenizer; does not refit.
- `.github/workflows/onecore-v3-training.yml`: only optimizer workflow; it remains fail-closed.
- `.github/workflows/onecore-source-package.yml`: source-only archive.

## Readiness and training gates

The model is **untrained** and its output quality is **not certified**. Theoretical storage and FLOPs are not runtime measurements. Current theoretical estimates: FP32 parameters 344,611,588 bytes; FP16 parameters 172,305,794 bytes; AdamW FP32 moments 689,223,176 bytes; full training-state estimate 1,378,446,352 bytes. These are not claims about runner RAM feasibility.

No optimizer update has been performed. Keep the training job's `&& false` guard. Before any update, require:
1. Successful real-corpus CPU benchmark for the exact corrected-spec-3 config/tokenizer/corpus, including process-tree peak RSS, production loader throughput and per-family timings.
2. Successful real-artifact step-zero checkpoint save/restore audit for the exact corrected-spec-3 config and adopted tokenizer.
3. Valid five-family external coverage and artifact/hash provenance, with no conflicting run.
4. Explicit owner authorization for the first bounded segment of five joint updates, checkpointing every update.

After the first update, run the separate non-zero-step continuation audit of AdamW state, five-family cursors, parent checkpoint SHA and RNG state before any longer run. CI success alone is not evidence of resource feasibility, training, or quality.
