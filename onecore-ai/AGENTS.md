# OneCore — engineering instructions for the single model

These instructions apply to all work under `onecore-ai/`. The sole canonical model implementation is `onecore-ai/src/onecore/v3/`; there is no second model, parallel trainer, notebook training line or alternate checkpoint lineage.

> **Mandatory cross-session entry check:** Before any write, read `SESSION_PROTOCOL.md`, this file and the complete `docs/EXECUTIVE_HANDOVER.md`. Then inspect the live repository branch, recent commits, latest 20 relevant Actions runs and jobs, open OneCore PRs and active tasks. Acquire `SESSION_LOCK.json` using the compare-and-swap procedure. If another valid lock exists or the lock cannot be acquired safely, remain read-only.

## 1. Repository boundaries

- Repository: `jonsnow-org/Lena9`.
- The only active engineering branch is `research/onecore-v3-implementation`.
- The only model source is `src/onecore/v3/`; do not create another model directory or another active branch.
- Keep OneCore changes under `onecore-ai/`, except the canonical GitHub workflows under `.github/workflows/` that are explicitly part of the OneCore build.
- Do not write directly to `main`; deliver a reviewed pull request after branch verification.
- Do not modify Ttbik, Sham or unrelated application directories.

## 2. One model, one lineage

- Preserve the single current architecture, its exact configuration fingerprint and parameter count.
- All tasks share the same Transformer semantic core and checkpoint. T-LDM reuses the same core and tied text head; it is not a separate network.
- Do not add a second model, an alternate implementation, a parallel trainer, a separate tokenizer, a second optimizer state, a duplicate workflow or a new notebook-based training path.
- Do not import external model weights, adapters, LoRA, donor bodies or teacher-model outputs. The model starts from random initialization.
- Do not silently change tensor dimensions, vocabulary, modality codec contracts, sequence budgets or optimizer settings. A deliberate model change requires recalculating parameter/FLOPs/resource contracts and starting a new compatible checkpoint lineage.

## 3. Data integrity

- Preserve the exact pinned corpus, source revisions, source-row identities, media payload hashes and train/validation/test split assignments.
- Only verified external train records may enter tokenizer fitting or optimizer updates. Synthetic and owner-curated fixtures are not substitutes for real corpus coverage.
- Validation and test never enter the training iterator or gradient updates.
- Do not redownload the existing corpus or refit the existing tokenizer without evidence that the exact artifact is missing, expired or corrupt.
- The source-corpus artifact is a data input only; it does not imply or retain another model implementation.
- Preserve privacy, safety, source provenance and all existing fail-closed data checks.

## 4. Training gates — fail closed

- Never remove, bypass or weaken the explicit guard in `.github/workflows/onecore-v3-training.yml`.
- No optimizer update is allowed until the live handover confirms: successful real-corpus CPU resource benchmark tied to the current configuration/manifest/tokenizer hashes; a real-artifact step-zero checkpoint save/restore audit for the current configuration; valid five-family external coverage; verified tokenizer bytes; no conflicting workflow; and explicit owner authorization.
- A push Verify run is not a CPU benchmark, corpus restore, checkpoint audit, evaluation or training run.
- The approved initial segment is five optimizer updates, checkpoint every update. Do not change steps or hyperparameters without explicit review.
- Each joint update accumulates one micro-batch per family in order: text, tool, image, audio, video; the optimizer steps once.
- T-LDM loss weight is 0.15 for text/tool batches and must remain explicit in `v3-training-request.json` and the workflow input.
- After the first authorized update, perform the separate non-zero-step continuation audit with AdamW moments, advanced family cursors, parent checkpoint SHA and RNG states before a longer run.

## 5. Shared writer lock and handover

- `SESSION_LOCK.json` is mandatory for all concurrent clients and scheduled supervisors.
- Acquire and update it by compare-and-swap against the exact live branch HEAD. An active, unexpired lease forbids writes by other clients; they must remain read-only.
- Renew at least every 30 minutes during long sessions and never let the lease expire mid-write.
- Release the lease in the final handover commit, recording the exact verified HEAD, commit, Actions run/job IDs, test counts, skipped gates and remaining risks.
- `docs/EXECUTIVE_HANDOVER.md` is the single source of truth for continuation. Distinguish implemented, tested, CI-verified, run against real artifacts, trained and evaluated.
- Never repeat a successful artifact operation without proof the artifact is missing, expired or corrupt. Never retry an unchanged failed run.
- No new branches, scheduled tasks, workflows or side systems without the owner's explicit authorization.
