# ADR: OneCore corrected-spec-3 — 32,000 text tokens

- **Status:** Accepted by the repository owner on 2026-11-28.
- **Scope:** The sole canonical model under `onecore-ai/src/onecore/v3/`.

## Decision

Set the active text BPE vocabulary to exactly 32,000 tokens and the architecture version to `onecore-v3-corrected-spec-3`. Preserve all other architecture dimensions: width 1,024; four unique Transformer blocks reused for three cycles; eight attention heads; SwiGLU hidden width 2,730; context 512; 16 native T-LDM latent slots; T-LDM objective weight 0.15 for text/tool.

The unified vocabulary has 33,048 IDs:
- Text: 0–31,999.
- Vision: 32,000–32,511.
- Audio: 32,512–32,767.
- Motion: 32,768–33,023.
- Special: 33,024–33,047.

Corrected-spec-3 supersedes corrected-spec-2 (4,096 text tokens, 5,144 unified IDs, 57,579,201 trainable parameters). It is a model-shape and checkpoint-lineage change, not a cosmetic tokenizer setting.

## Parameter impact

Because the text output head is tied to the shared embedding, the vocabulary expansion adds one embedding matrix delta only:

`(33,048 - 5,144) × 1,024 = 28,573,696` additional parameters.

The resulting exact trainable parameter count is **86,152,897**.

Theoretical storage only (not measured RAM): FP32 parameters 344,611,588 bytes; FP16 parameters 172,305,794 bytes; AdamW FP32 moments 689,223,176 bytes; parameters plus moments 1,033,834,764 bytes; full training state estimate 1,378,446,352 bytes.

## FLOPs contract

All FLOPs calculations must consume the actual `V3Config` dimensions and unified vocabulary; no hardcoded 5,144 output vocabulary in report paths.

- Joint training step, T=128: 1,516,166,184,960 analytic dense FLOPs.
- Joint training step, T=512: 6,136,611,471,360 analytic dense FLOPs.
- Five-family forward sum at sequence lengths 512/512/121/244/512: 1,514,126,278,656.
- Five-family dense training sum: 4,542,378,835,968.

These are analytic estimates, not runtime measurements.

## Tokenizer provenance and adoption

Use the original immutable 32K tokenizer artifact:
- Run 45336933362; artifact 14894835517; name `onecore-v3-tokenizer-45325008221`.
- ZIP SHA-256 `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`; size 394,036 bytes.
- Tokenizer JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.
- Original sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`.
- It records 591,525 external TRAIN text rows, manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`, external-row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`, zero validation/test rows and no V2 tokenizer import.

Adoption verifies the original run, artifact metadata, archive bytes/digest, exact members, original sidecar and JSON hashes, BPE/NFC/ByteLevel contract, vocabulary/special IDs and all split/provenance evidence. It copies tokenizer JSON bytes unchanged and emits a new evidence sidecar that binds:
1. the full corrected-spec-3 model config fingerprint; and
2. a tokenizer-only contract fingerprint (algorithm, NFC normalization, vocabulary and special-token IDs).

This allows tokenizer compatibility to be checked independently from tensor-shape compatibility without making checkpoints compatible across different full config fingerprints. No refit is required; validation/test must remain excluded.

## Training safety

No optimizer update is authorized by this ADR. The training workflow remains fail-closed. Before training, require a real CPU resource benchmark and a real-artifact step-zero checkpoint save/restore audit for corrected-spec-3, plus valid five-family provenance and explicit owner authorization. The first authorized segment is five joint updates with one checkpoint after each update. After its first update, perform a separate non-zero-step continuation audit before any longer run.
