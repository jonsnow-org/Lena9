# OneCore AI — Executive Handover Note

**Purpose:** Single durable handover point for every scheduled OneCore maintenance session. Read this file before any project action, verify every status against live GitHub state, then update this file at the end of the session. This note is a navigation and anti-duplication aid, not a substitute for source files, workflow logs, artifacts, or tests.

**Last initialized:** 2026-11-26  
**Repository:** `jonsnow-org/Lena9`  
**Active project directory:** `onecore-ai/`  
**Canonical working branch:** `research/onecore-v3-implementation`  
**Frozen historical branch:** `research/onecore-foundation` (V2 archive only; do not develop or train here)  
**Protected scope:** Do not modify `main`, the Lena9 project outside `onecore-ai/`, or Ttbik/Sham repositories.

## 1. Mandatory first actions on every scheduled run

1. Read this handover note completely.
2. Fetch the latest commit SHA and branch state for `research/onecore-v3-implementation`; compare it with the last recorded SHA below. Never assume this note is current.
3. Read the active V3 `onecore-ai/README.md`, `onecore-ai/v3-training-request.json`, relevant architecture/config files, and the relevant operations docs before deciding what to do.
4. Inspect the latest relevant GitHub Actions runs (including workflow name, event, branch, commit SHA, status, jobs, steps and logs), open PRs/issues, artifacts, tokenizer/checkpoint evidence and any active run/lock. Read existing evidence before repeating any operation.
5. Update the status ledger below from live evidence. Distinguish verified completion, pending work, active work, failed work and blocked work.
6. Choose one highest-impact safe unfinished engineering task. Execute it through completion and targeted tests where permissions and tools allow. Do not replace engineering work with a monitoring-only report.
7. Before any training action, prove that the canonical V3 training gates are satisfied and that no conflicting run is active. Do not start optimizer updates while CPU-resource, corpus/tokenizer, checkpoint continuity or other required readiness gates remain unverified.
8. At session end, record the exact new commit/run/artifact/test evidence, what changed, what remains, the exact next action and the exact repository path. If nothing changed, explain why and identify the next safe action. Never claim success without evidence.

## 2. Verified project routing and branch boundaries

- The V3 README explicitly identifies `research/onecore-v3-implementation` as the only active OneCore architecture and `research/onecore-foundation` as frozen V2 history.
- Active project code and configuration live under `onecore-ai/`; V3-specific implementation is under `onecore-ai/v3/`, with V3 request files at `onecore-ai/v3-tokenizer-request.json` and `onecore-ai/v3-training-request.json`.
- The root-level legacy `onecore-ai/training-request.json` belongs to the V2 historical path. Do not use it to trigger V3 work.
- Do not copy V2 weights, checkpoints, optimizer/scheduler state, tokenizer or model manifests into V3. Eligible data-only conversion is governed by the active V3 docs and exact source pins.
- The intended long-term product is one unified multimodal model initialized from scratch. No pretrained weights, adapters, teacher distillation, or Sham model data.
- GitHub Actions is the approved execution environment. Do not introduce paid hosting or alternate compute services.

## 3. Last recorded completed work — historical baseline to re-verify

The active V3 README snapshot read while creating this note recorded the following completed evidence. Treat these as historical pointers; verify the latest live runs and artifacts before relying on them:

- V3 architecture budget: 39,906,568 trainable parameters and 123 state-dict tensors; config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`.
- External-only V3 corpus gate passed in Run #605; corpus artifact 14892594659 (24,432,975,285 bytes; SHA-256 `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`). The README recorded train/validation/test coverage and zero synthetic additions; inspect the actual report before asserting these remain valid.
- V3 tokenizer fitting/verification passed in tokenizer Run #2 (45336933362), artifact 14894835517; vocabulary 32,000; tokenizer JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.
- Exact V3 dense forward FLOPs were computed for specified reference shapes; five-family sum recorded as 291,846,632,448 FLOPs. This is not measured training throughput or a training-step FLOP count.
- V3 checkpoint format v1 has tiny-model round-trip/mismatch tests, but a full save/restore against the actual corpus and tokenizer was not yet evidenced in that README snapshot.
- Canonical Verify Run #652 was recorded as 308 passed, 33 warnings. Re-check newer runs before repeating tests.
- A prior executive-task handover additionally recorded V3 revision `93892eb7e1e6df6c599436c8359c57dacf2deee3` and Run #697 (Actions run 45703953550) with 369 passed, 36 warnings; CPU benchmark and corpus restore were skipped and no artifacts were produced. This may be newer than the README snapshot; verify the branch and run history before treating it as current.
- The manual V3 CPU benchmark was attempted in Run #700 (Actions run 45724385251) on commit 359976e333906b228eef39584fecc5d10c9a092d; the run failed, produced no artifact, and its job log endpoint currently returns BlobNotFound. The benchmark step is shown as in_progress in the failed job summary, so the root cause is not established. Do not call this a measured CPU result or repeat the old run unchanged. Commit 9d4ef7a74b70660732c4a199738401f938c2f31c now adds atomic in-place progress snapshots and 30-second heartbeats to the report, and reduces RSS polling from 20 ms to 250 ms. Verify Run #701 passed this change, but the benchmark job was skipped on the push event.
- No successful real optimizer training was evidenced in the above baseline. Do not describe the model as trained or ready.

## 4. Outstanding gates to check before real training

Check each gate against current V3 source, workflow logs and immutable artifacts; update its state to PASS / FAIL / NOT RUN with evidence.

1. **Source and architecture integrity:** exact V3 config/fingerprint, parameter count, FLOPs and tests.
2. **External-only corpus:** pinned corpus artifact, full source provenance, split isolation, exact manifest and asset hashes, quota/coverage checks, no synthetic/owner-curated rows entering real tokenizer fitting or optimizer updates.
3. **Tokenizer:** independently verified V3 tokenizer artifact, exact hash/vocabulary, tied to the correct external train manifest; no V2 tokenizer reuse.
4. **Measured CPU envelope:** actual peak process-tree RSS, throughput and modality-specific rates on the production V3 loader and deterministic quota-complete external sample. Do not substitute parameter/optimizer-storage arithmetic or local guesses.
5. **Real-data shape profile:** image dimensions, audio durations/sample rates and video frame/dimension distributions, with safe bounded profiling.
6. **Full checkpoint continuity:** save/restore against actual corpus/tokenizer with model, optimizer, scheduler, global step, data cursors, Python/NumPy/Torch RNG, hashes and parent lineage all verified.
7. **Trainer readiness:** bounded resumable multi-session V3 trainer, non-cancelling serialization/lock, exact optimizer-step accounting, artifact integrity and safe resume.
8. **Inference/product readiness:** production inference API/CLI, multimodal codec paths, safe tool runtime, CPU execution and honest capability limitations.
9. **Independent evaluation:** external-only held-out validation/test, per-modality metrics, code/tool regression and human review where needed. Do not invent acceptance thresholds or claim readiness from loss/build success alone.

**Training gate:** No optimizer training until all required pre-training gates above have passed with evidence and no conflicting run is active. When the user later confirms that maintenance is complete and real training should begin, proceed through the approved V3 staged workflow only. Until then, focus on maintenance, verification, fixing blockers, and preparing the real training path without starting optimizer updates.

## 5. Anti-repeat and safety rules

- Never rerun a workflow just because it is mentioned in this note. First inspect the latest 20 relevant runs and determine whether the exact requested run/action already exists.
- Never repeat a failed attempt unchanged. Read its logs, isolate the root cause, patch and test first.
- Never confuse a push/Verify run with `workflow_dispatch`, a resource benchmark, corpus restoration, checkpoint audit or optimizer training.
- Do not treat skipped jobs as passed. Do not treat a successful Verify workflow as measured CPU evidence.
- Do not start duplicate training, mutate a checkpoint, delete a parent artifact, refit the tokenizer, restore a 24GB corpus or alter a request file without verifying the intended V3 workflow contract and current state.
- Do not weaken manual-only gates, remove safety guards, bypass branch protection, or merge untested work.
- Preserve the active branch and its existing PR/work context. Reuse existing branches and PRs; do not create duplicates.
- After a verified fix, complete the approved integration/merge path for the active branch where allowed. Never merge to `main` unless the user explicitly changes that boundary.
- If an action is unavailable because the GitHub connection lacks permission or a required dispatch action, state the precise limitation. Do not ask the user to repeat a manual action already recorded as completed.

## 6. Per-session progress ledger — update this section every run

### Current verified state — 2026-11-26
- Canonical active branch: `research/onecore-v3-implementation`. Documentation correction commit `f80db3e52411bc755cb7b0fede96fdda152cc6a3` is based on `fb95402f6e65e7c8d2391099d73b6b722dd7ce2e` and passed Run #704. This handover records that verified result. Always fetch the new HEAD rather than assuming this note's commit is current.
- Frozen V2 branch remains a historical archive only. `main` was observed at `10c4f01663bd65e30335bfe7b4ed3cdfe6584815`; do not modify or merge into it.
- No active OneCore workflow run was present after Run #704 completed. There is no open V3 PR. Open PR #7 and issue #6 are unrelated to V3.
- Latest 20 branch runs were inspected. The current three push Verify runs are:
  - [Run #701](https://github.com/jonsnow-org/Lena9/actions/runs/45769739545), commit `9d4ef7a74b70660732c4a199738401f938c2f31c`: Verify succeeded; the CPU benchmark and corpus-restore jobs were skipped for a push event.
  - [Run #702](https://github.com/jonsnow-org/Lena9/actions/runs/45770552742), commit `298419117267d85355dece40cb49f50c1bab8e50`: Verify succeeded; benchmark and restore jobs were skipped.
  - [Run #703](https://github.com/jonsnow-org/Lena9/actions/runs/45770650495), commit `fb95402f6e65e7c8d2391099d73b6b722dd7ce2e`: Verify succeeded; benchmark and restore jobs were skipped.
  - [Run #704](https://github.com/jonsnow-org/Lena9/actions/runs/45805512269), commit `f80db3e52411bc755cb7b0fede96fdda152cc6a3`: Verify succeeded, including all unit/regression tests, V3 architecture/FLOP assertions, notebooks, FineWeb-2 cursor-resume and workflow isolation. Manual CPU benchmark and corpus-restore jobs were skipped; no resource artifact was produced.
- [Run #700](https://github.com/jonsnow-org/Lena9/actions/runs/45724385251) was the last failed CPU-benchmark attempt on old commit `359976e333906b228eef39584fecc5d10c9a092d`; it produced no benchmark artifact and the job log endpoint returned BlobNotFound. Its precise root cause remains unproven. The progress-snapshot / heartbeat / lower-RSS-polling fix is already committed as `9d4ef7a`; do not rerun #700 unchanged.
- [Run #699](https://github.com/jonsnow-org/Lena9/actions/runs/45723470918) was a workflow_dispatch on `main` and ended cancelled. It did not produce benchmark evidence. Do not retry it or use `main` as the V3 working branch.
- [Run #695](https://github.com/jonsnow-org/Lena9/actions/runs/45695103812) on `main` failed while reading the 24.43 GB corpus via an expired signed Artifact URL (HTTP 403). The refresh-on-403 fix is already on V3 in commit `4af3d63459314f8d9a100db4e513651f01571713`; V3 Verify runs #696 and #697 passed after this fix. Do not retry the old main run.
- [Run #681](https://github.com/jonsnow-org/Lena9/actions/runs/45641782921) was an older V3 manual benchmark failure on a stale SHA due video sample caps; the native-resolution frame-budget correction is already in later branch history. Never repeat #681.
- V3 architecture remains prototype-2: 39,906,568 trainable parameters, 123 state tensors, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, and reference five-family dense forward count 291,846,632,448 FLOPs. FLOPs and parameter-storage estimates are not measured runtime resources.
- Pinned external corpus artifact `14892594659` and conversion report `14893020087` from Run #605 already passed the external-only five-family gate: 654,088 accepted external records; zero synthetic additions; required quotas present. The audit still records 37 unmatched legacy source rows, so do not claim the entire old archive was restored. Do not redownload or restore this corpus again without new evidence that the immutable artifact is unavailable or corrupt.
- Independently verified V3 tokenizer artifact `14894835517` from Run #2 has byte-level BPE vocabulary 32,000 and JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`, fitted on 591,525 external train-text rows only. Validation/test rows used = 0; V2 tokenizer import = false. Do not refit or replace it.
- CPU resource gate: **NOT RUN successfully**. No measured process-tree peak RSS, production V3JointDataLoader throughput, per-family rates, or media shape/duration distributions are available.
- Real-artifact checkpoint continuity: **STEP-ZERO AUDIT IMPLEMENTED; REAL RUN PENDING**. The dedicated audit uses the pinned corpus manifests, conversion report asset-SHA map and verified V3 tokenizer, snapshots real V3JointDataLoader source cursors without downloading media, then saves/restores a step-zero checkpoint with model, optimizer, scheduler, hashes, parent lineage and Python/NumPy/Torch RNG. It performs zero optimizer updates. A post-first-update checkpoint continuation audit remains required later.
- V3 optimizer training is prohibited until the measured CPU resource gate and both initial/post-update checkpoint continuity gates are satisfied. `.github/workflows/onecore-v3-training.yml` remains manual-only and its train job retains the explicit `&& false` guard. No optimizer update was verified or approved.
- GitHub connection capabilities were rechecked: it provides repository file/commit operations and read access to Actions, plus rerun operations for failed jobs, but no workflow-dispatch action. `.github/workflows/onecore-ci.yml` already exposes the correct manual inputs: `benchmark_v3_resources=true`, `restore_v3_corpus=false`. Do not bypass the manual gate or claim a measurement.
- This session corrected misleading V2 operational documentation in commit `f80db3e52411bc755cb7b0fede96fdda152cc6a3`: `docs/training-operations.md` and `notebooks/README.md` are explicitly marked frozen V2 references; the root README points to the active V3 docs; V3 README distinguishes historical Run #620 from current Verify runs and points to this handover for live state. Run #704 passed all Verify steps on this commit.

### Completed in this session
- Read the entire executive handover, active root README, V3 README, V3 request file, active workflows, resource benchmark source/tests, and legacy operations references.
- Inspected the live branch HEAD, current main HEAD, the latest 20 V3 branch run records, current open PRs/issues, and active-run status. No duplicate run or existing manual benchmark was started.
- Corrected the legacy V2 documentation labels and active README pointers in the current branch only. No runtime code, training request, corpus, tokenizer, checkpoint, workflow trigger, V2 branch, or `main` was changed.
- The existing Run #681 resource artifact (15033704533) was inspected: it is a failed partial report because the stale video sample cap selected 16 of 100 required train rows. The adaptive native-resolution video cap correction already exists in later branch history. Run #700 produced no artifact; neither attempt was repeated.
- Source review confirmed V3 already has `runner.py`, `training.py`, `dataset.py`, `checkpoint.py`, their tests, and a staged training workflow; this work did not recreate those components.
- Hardened the V3 runner resource-evidence gate: exactly one successful isolated case per family; exact 100/10/10 production-loader sample quotas; positive per-family record and unit throughput; a positive integer loader step count; and a conservative process-tree RSS bound that cannot be below observed peak. Added regression tests for missing/duplicate families, incomplete video quota, missing/zero modality throughput, and inconsistent RSS accounting.
- Hardened the V3 resource-evidence acceptance gate in `runner.py`; Run #706 passed.
- Added SHA-256-pinned V3 inference runtime and `onecore-v3-infer` CLI for text, image, audio and video. It validates the trusted checkpoint digest before deserialization, validates config/tokenizer/state tensors, and refuses step-zero checkpoints by default. Runs #707 and #708 passed all Verify steps; their tests exercised each media path shape, text decoding, digest rejection, untrained-checkpoint refusal and correct BOS/EOS handling.
- Added `onecore.v3.checkpoint_audit`, tests, a dedicated CI job and manual input. The audit binds the real corpus manifest bundle, conversion report/asset hash map and pinned tokenizer, snapshots the actual V3 loader cursors using lazy-assets mode, saves/restores a step-zero checkpoint including model/optimizer/scheduler/RNG/lineage, and records a report without any optimizer update or media download. This audit is intentionally narrower than the later post-update continuation gate.
- Runs #709 and #710 passed Verify. On Run #710, the checkpoint-audit job was skipped because it is not dispatched by a normal push; this commit adds a single-use commit-message marker `[run-v3-checkpoint-audit]` to launch that job once while ordinary future pushes continue to skip it.
- The OneCore supervisor task instructions were updated to require actual code/test work at every invocation and avoid completed work. Its recurrence remains daily because the available scheduler supports daily/weekly/monthly only; it cannot save an hourly recurrence.
- No CPU resource benchmark, corpus restore, tokenizer fit, or optimizer training was run.

### Remaining / blocked
- The real-artifact step-zero checkpoint audit is launched once by the current commit marker `[run-v3-checkpoint-audit]`; inspect the resulting audit job/artifact and update this ledger from its actual outcome. Normal commits must not rerun the audit. The CPU resource benchmark remains a separate manual-only gate; do not replay #700 or #681 unchanged or make it a push-triggered job.
- After the step-zero audit passes, preserve its artifact as evidence of initial-state serialization only. Once the CPU resource gate is independently passed and a first bounded optimizer update is approved, execute a separate post-update checkpoint round-trip with populated AdamW moments, advanced per-family/source cursors, exact parent artifact SHA and all RNG states.
- The inference implementation/CLI now exists but the model is untrained and quality is uncertified. The bounded multi-session trainer remains blocked by resource/checkpoint gates. Independent held-out five-family evaluation is still unfinished.
- When the dispatch action remains unavailable, do not spend every run repeating the same blocker report. Continue the next highest-impact, non-blocked V3 engineering task; never ask the owner to repeat an action already recorded as complete.

### Exact continuation point
- Active inference path: `onecore-ai/src/onecore/v3/inference.py` and CLI `onecore-v3-infer`.
- Active checkpoint audit: `onecore-ai/src/onecore/v3/checkpoint_audit.py` and `onecore-ai/tests/test_v3_checkpoint_audit.py`; dedicated job `v3-checkpoint-artifact-audit` in `.github/workflows/onecore-ci.yml`.
- The current one-shot audit launch uses push commit marker `[run-v3-checkpoint-audit]`; once it completes, inspect job logs and the `onecore-v3-checkpoint-audit-*` artifact.
- CPU resource benchmark implementation remains `onecore-ai/src/onecore/v3/resource_benchmark.py`; atomic progress snapshots, 30-second worker heartbeats, and 250 ms RSS polling are already implemented and covered by tests.
- Relevant tests: `onecore-ai/tests/test_v3_resource_benchmark.py`.
- Manual workflow: `.github/workflows/onecore-ci.yml`, job `v3-resource-benchmark`; required inputs are `benchmark_v3_resources=true` and `restore_v3_corpus=false`.
- Next required runtime action: obtain a valid workflow-dispatch capability for the existing workflow and run the benchmark once on the current branch HEAD. Until then, continue safe V3 engineering preparation without training or re-running completed data/tokenizer work.

### Do-not-repeat list
- Corpus Run #605 / artifact `14892594659` and conversion report `14893020087`: external-only gate already validated; no repeat restore/redownload.
- Tokenizer Run #2 / artifact `14894835517`: verified 32k external train-only tokenizer exists; no repeat fit.
- Run #700 / `45724385251`: failed benchmark without artifact; fix already committed; no unchanged retry.
- Run #681 / `45641782921`: stale video-cap benchmark failure; later fix exists; no repeat.
- Runs #701–#710: completed push Verify only; resource benchmark and corpus-restore jobs were skipped, not passed. Runs #706–#710 include the resource-evidence gate, inference runtime and step-zero checkpoint audit workflow code; Run #710’s audit job was skipped pending explicit selection. Do not mistake these Verify runs for resource measurements or real-artifact checkpoint evidence.
- Run #699 / `45723470918`: cancelled on `main`; no V3 benchmark evidence and no retry.
- Historical V3 training Run #1 / `45483538417`: failed with no artifact and ambiguous optimizer step; never resume or accept its lineage.
- No V3 optimizer training, full corpus restore, tokenizer refit, checkpoint mutation, branch creation, or merge to `main` until explicit gates are satisfied.
