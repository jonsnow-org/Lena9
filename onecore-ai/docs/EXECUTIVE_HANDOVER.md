# OneCore executive handover

Updated: 2026-11-28T09:20:15.890Z

## Canonical product state

**OneCore is one model, one active implementation, one tokenizer, one joint trainer, and one checkpoint lineage.** The active implementation is `onecore-ai/src/onecore/v3/` on `research/onecore-v3-implementation`. There is no V2 model, parallel trainer, or notebook-training path in the active tree. The V3 path name identifies the adopted implementation, not a second product.

The only adopted model contract is `onecore-v3-corrected-spec-2`:
- **57,579,201 trainable parameters**.
- Width 1,024; unified vocabulary 5,144, including exactly 4,096 text BPE tokens.
- Four unique Transformer blocks reused across three cycles (12 applications); eight attention heads; SwiGLU width 2,730; RMSNorm; context 512.
- One shared semantic Transformer with shared embeddings and tied text output projection.
- Image, audio and video codecs and heads belong to the same model and checkpoint.
- Native T-LDM uses 16 latent slots through the same core and tied text head. It adds zero trainable parameters; text/tool objective weight is 0.15.

No pretrained body, external model weights, adapters, LoRA or teacher outputs are imported. The model remains **untrained** and generation quality is not certified.

## Single-path consolidation

- Removed 65 parallel legacy model, trainer, action, workflow and notebook files from the active branch in commit `432ac41054536673aa05717ca10da66926794f40`.
- Moved shared source-row identity, nested-field and pinned-video helpers into the canonical source utilities; removed notebook-specific routing. Cursor writing is pipeline-scoped, with compatibility for reading old cursor snapshots only.
- Retained the pinned data-only source registry snapshot for the existing corpus artifact. It is provenance/manifest data, not another model, trainer or checkpoint.
- The active tree audit found no V2 model path, alternate trainer or notebook-training path under the canonical OneCore source tree.

## Corrected tokenizer — verified and pinned

The historical 32,000-token tokenizer artifact `14894835517` (run `45336933362`, JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`) is preserved as provenance only and is not used by the adopted model.

The replacement was fitted successfully from the pinned external TRAIN text:
- Tokenizer workflow run **#6**, ID `46128204163`, source commit `27e2e2ba5339b6f45f60fa90f88ae28d5fd5d87f`, conclusion success.
- Artifact **`15256164799`**, name `onecore-corrected-spec-tokenizer-4096-45325008221`, **42,523 bytes**, ZIP digest `sha256:ba29243d09e77ca06c9700f9529e9cf313dbd5f9eb208b903fdbb97224699370`; expiry `2027-02-26T08:57:37Z`.
- File `onecore-tokenizer-text4096-20261128.json`; exact vocabulary **4,096**; JSON SHA-256 `6e1c5ed9bf3c44f9e520edf04a90caf97c15fa622f9b5df8d651345fef27dacd`.
- Fitted on **591,525 external TRAIN text records** from `data/train.jsonl`; manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external-row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`.
- Validation/test rows used: **0**. Imported V2 tokenizer: **false**. The workflow range-read only `data/train.jsonl`; it did not download the full 24.4-GB corpus archive.

Five-family external coverage verified by the same pipeline:
- Train: text 591,525; tool 14,000; image 900; audio 1,100; video 100.
- Validation: text 22,552; tool 400; image 10; audio 165; video 10.
- Test: text 22,758; tool 400; image 10; audio 148; video 10.

**Data-provenance caveat:** the conversion report records 1,302 non-external rows excluded and 37 historical pinned source rows not found, with no synthetic rows added. The final external-only manifest gate passed (`blocked=false`), while `restoration_incomplete=true` remains recorded for those unmatched legacy rows. Do not claim that every historical source row was restored; only the eligible external coverage above passed.

The sole training request, `onecore-ai/v3-training-request.json`, pins the tokenizer run, artifact ID/name/digest/size, source commit, JSON SHA, vocabulary, row count, manifest SHA, external-row fingerprint and zero-heldout evidence. The only training workflow verifies run metadata, artifact metadata/digest, file bytes and tokenizer evidence before use.

## Verification and source package

- **CI #802**, run `46129654620`, PR event, exact merge head `00828fe9fa7e4c412ed913e61974f076fa7cb1d7`: **success**. Compile, exact architecture/parameter/FLOPs/T-LDM checks, **206 passed in 12.42s**, single-model/fail-closed guard checks and FineWeb-2 exact cursor-resume smoke test all passed.
- Optional CPU benchmark, current-config step-zero checkpoint audit, corpus restore and held-out checkpoint evaluation were **skipped** in #802. They are not counted as passed.
- **Source package #37**, run `46129386512`, built from the identical code tree before the ancestry-only merge commit: artifact `15256134386`, **239,737 bytes**, SHA-256 `da8e13c11498a93a1dd65aa816ae2e4b4ef785f438f16b0ebeb9763361e333bb`. Source-only; no model weights, datasets, checkpoints, secrets or runtime state.
- CI #801 on the parent code tree also passed 206 tests; PR CI #802 separately verified the exact current PR head after its merge commit.

## Training and promotion gates still open

No optimizer update has been performed. There is no step-zero checkpoint for the current configuration, no successful current-config CPU resource measurement, no non-zero-step continuation audit and no trained held-out evaluation.

The sole optimizer workflow `.github/workflows/onecore-v3-training.yml` remains fail-closed with `&& false`. Do not remove that guard or update weights until all of the following pass:
1. A real CPU benchmark for this exact config/corpus/tokenizer: process-tree peak RSS, production loader throughput, per-family forward/backward timings and joint objective/AdamW allocation.
2. A real-artifact step-zero save/restore audit for this exact architecture and tokenizer fingerprint.
3. No conflicting run is active.
4. Explicit owner authorization for the first bounded segment of **five joint updates**, checkpointing every update.

After the first update, separately audit AdamW moments, parent checkpoint SHA, scheduler/global step, five-family source cursors and Python/NumPy/Torch RNG state before any longer run. CI success, analytic FLOPs, previous-config measurements or a parameter report are not substitutes for the CPU/checkpoint gates.

The GitHub connection used for this work can inspect and rerun existing jobs but does not expose a workflow-dispatch action for selecting the manual benchmark/checkpoint inputs. No fake benchmark or push-trigger substitute was used.

## Pull request and branch state

- Repository: `jonsnow-org/Lena9`.
- Active branch: `research/onecore-v3-implementation`.
- Current code/ancestry head at handover: `00828fe9fa7e4c412ed913e61974f076fa7cb1d7`.
- **PR #12:** <https://github.com/jonsnow-org/Lena9/pull/12> — open, unmerged and `mergeable=true`; target `main`. Its head is the commit above.
- The PR's initial divergence was resolved with merge commit `00828fe9...`, whose parents are prior verified OneCore head `eccc4baa3a6bb7b36b848e1845388cbd1253ff83` and main `10c4f01663bd65e30335bfe7b4ed3cdfe6584815`. The merge commit's tree is byte-for-byte the same Git tree as the already-tested parent `eccc4baa...`; it changed ancestry only. No non-OneCore application files were present in the main-only diff.
- `main` remains at `10c4f01663bd65e30335bfe7b4ed3cdfe6584815`; it has **not** been modified or merged.
- The old `research/onecore-foundation` ref remains at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`. Do not delete or repoint it before PR #12 merges. After that merge, neutralize the legacy ref with compare-and-swap so it no longer retains a distinct active implementation. The available connection has no branch-delete operation.

## Multi-client coordination

Every client must read `SESSION_PROTOCOL.md`, `AGENTS.md` and this complete handover before writing. Check live HEAD and the latest 20 relevant runs, acquire/renew the shared writer lock with compare-and-swap, and record commits, tests, jobs, artifacts, failures and skipped gates. Never start a second model, trainer, notebook workflow, branch or checkpoint lineage.
