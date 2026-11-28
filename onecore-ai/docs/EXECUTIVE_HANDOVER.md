# OneCore executive handover

Updated: 2026-11-28 09:10 UTC

## Canonical product state

OneCore is one model, one active implementation, one tokenizer, one joint trainer, and one checkpoint lineage. The active implementation is onecore-ai/src/onecore/v3/ on research/onecore-v3-implementation. There is no V2 model, trainer, or notebook-training path in this active branch. The V3 path name identifies the adopted implementation and is not a second product.

The adopted corrected contract is onecore-v3-corrected-spec-2:
- 57,579,201 trainable parameters.
- Width 1,024; unified vocabulary 5,144 including exactly 4,096 text BPE tokens.
- Four unique Transformer blocks reused for three cycles (12 applications); eight attention heads; SwiGLU width 2,730; RMSNorm; context 512.
- One shared semantic Transformer, shared embeddings and tied text output projection.
- Image, audio and video codecs and flow heads belong to the same model and checkpoint.
- Native T-LDM uses 16 latent slots through the same core and tied text head. It adds zero trainable parameters; text/tool objective weight is 0.15.

No pretrained body, external weights, adapters, LoRA or teacher outputs are imported. The model remains untrained and generation quality is not certified.

## Single-path consolidation

- Removed 65 parallel legacy model, trainer, action, workflow and notebook files from the active branch in commit 432ac41054536673aa05717ca10da66926794f40.
- Moved shared source-row identity, nested-field and pinned-video helpers into the canonical source utilities; removed notebook-specific source routing. Cursor writing is pipeline-scoped, with old serialized cursor-key compatibility only for existing progress.
- Retained the pinned data-only source registry snapshot for the existing corpus artifact. It is provenance and manifest data, not another model or checkpoint.
- The active tree audit at 073d387d92fde4c393553ede7dc7c966222debe1 found no V2 model path, alternate trainer or notebook-training path under the active OneCore tree.

## Corrected tokenizer: verified and pinned

The old 32,000-token tokenizer artifact 14894835517 (run 45336933362, JSON SHA-256 569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76) is preserved as historical provenance only. It is not used by the adopted model.

The replacement was fitted successfully from the pinned external TRAIN text:
- Tokenizer workflow run #6, ID 46128204163, source commit 27e2e2ba5339b6f45f60fa90f88ae28d5fd5d87f, conclusion success.
- Artifact 15256164799, name onecore-corrected-spec-tokenizer-4096-45325008221, 42,523 bytes, ZIP digest sha256:ba29243d09e77ca06c9700f9529e9cf313dbd5f9eb208b903fdbb97224699370; expiry 2027-02-26T08:57:37Z.
- File onecore-tokenizer-text4096-20261128.json; exact vocabulary 4,096; JSON SHA-256 6e1c5ed9bf3c44f9e520edf04a90caf97c15fa622f9b5df8d651345fef27dacd.
- Fitted on 591,525 external TRAIN text records from data/train.jsonl; manifest SHA-256 d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205; external-row fingerprint 6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720.
- Validation/test rows used: 0. Imported V2 tokenizer: false. The workflow range-read only data/train.jsonl; it did not download the full 24.4-GB corpus archive.

The same run revalidated five-family external coverage:
- Train: text 591,525; tool 14,000; image 900; audio 1,100; video 100.
- Validation: text 22,552; tool 400; image 10; audio 165; video 10.
- Test: text 22,758; tool 400; image 10; audio 148; video 10.

Data-provenance caveat: the conversion report records 1,302 non-external rows excluded and 37 legacy pinned source rows not found, with no synthetic rows added. The final external-only manifest gate passed (blocked=false), while the report preserves restoration_incomplete=true for those unmatched legacy rows. Do not describe every historical source row as restored; the eligible external coverage above is what passed.

The sole training request, onecore-ai/v3-training-request.json, now pins the tokenizer run, artifact ID/name/digest/size, source commit, JSON SHA, vocabulary, row count, manifest SHA, external-row fingerprint and held-out-zero evidence. The only training workflow verifies run metadata, artifact metadata and digest, file bytes and tokenizer evidence before use.

## Verification and source package

- CI #800, run ID 46129051669, commit 073d387d92fde4c393553ede7dc7c966222debe1: success. Verify completed compile, exact 57,579,201 parameter/FLOPs and T-LDM checks, 206 passed, one-model/guard checks and FineWeb-2 exact cursor-resume smoke test.
- The optional CPU benchmark, current-config step-zero checkpoint audit, corpus-restore job and held-out checkpoint evaluation were skipped in #800; these are not counted as passed.
- Source package #36, run ID 46129051666, same commit: success. Artifact 15256682737, name onecore-source-code-073d387d92fde4c393553ede7dc7c966222debe1, 238,785 bytes, SHA-256 7570f98ee6b60cb1dcbf5980a83d070b3b2616e0942e4701022bd1ffaaeb9cf2. Source-only; no weights, datasets, checkpoints, secrets or runtime state.
- CI #799 on 86bb7310eea93cdf29a4cbc6e29fc6fe70e026c7 also passed 206 tests after the training request and workflow were pinned to the new tokenizer.
- The tokenizer fit itself passed all 11 workflow steps; its evidence above is from the completed run, not inferred from a request file.

## Training and promotion gates still open

No optimizer update has been performed. There is no step-zero checkpoint for the current configuration, no successful current-config resource measurement, no non-zero-step continuation audit, and no trained held-out evaluation.

The sole optimizer workflow, .github/workflows/onecore-v3-training.yml, remains fail-closed with && false. Do not remove that guard or update weights until all of the following are true:
1. A real CPU benchmark is measured for this exact config/corpus/tokenizer: process-tree peak RSS, production loader throughput, per-family forward/backward timing and joint objective/AdamW allocation.
2. A real-artifact step-zero save/restore audit passes for this exact configuration and tokenizer fingerprint.
3. No conflicting run is active.
4. The owner explicitly authorizes the first bounded segment of five joint updates, checkpointing every update.

After the first update, separately audit AdamW moments, parent checkpoint SHA, scheduler/global step, five-family cursors and Python/NumPy/Torch RNG state before any longer run. CI success, analytic FLOPs, previous-config measurements or a parameter report are not substitutes for the CPU/checkpoint gates.

The workflow contains manual inputs for benchmark/checkpoint operations. The current GitHub connection can inspect and rerun existing jobs but does not expose a workflow-dispatch action to select these inputs; no fake benchmark or push-trigger substitute was used.

## Branch, main and pull request

- Repository: jonsnow-org/Lena9.
- Active branch: research/onecore-v3-implementation, verified HEAD 073d387d92fde4c393553ede7dc7c966222debe1.
- main remains at 10c4f01663bd65e30335bfe7b4ed3cdfe6584815; this session has not modified main.
- main is four commits beyond the branch merge base. Those commits include the older 39.9M/32K model workflow and a legacy CPU-audit attempt; that push run failed with the benchmark job skipped. The active branch carries the corrected 57.58M/4096 contract and its own explicit benchmark/checkpoint gates. Do not merge the stale model workflow back into the active implementation.
- The only currently open PR is unrelated PR #7. The canonical OneCore PR has not yet been opened; open exactly one PR after the final handover/lock commit and its checks pass.
- The former research/onecore-foundation ref still points to 6d5dd21982f8f4a835e07b0f004b1621be57ba96. Do not delete or repoint it before the canonical PR merges. After the PR merges, neutralize that ref with compare-and-swap so it cannot retain a distinct active implementation. No branch-delete operation is exposed by the current connection.

## Mandatory multi-client coordination protocol

Every client must read SESSION_PROTOCOL.md, AGENTS.md and this complete handover before writing. Check live HEAD and the latest 20 relevant runs, acquire/renew the shared writer lock with compare-and-swap, and record commits, tests, jobs, artifacts, failures and skipped gates. Never start a second model, trainer, notebook workflow, branch or checkpoint lineage.
