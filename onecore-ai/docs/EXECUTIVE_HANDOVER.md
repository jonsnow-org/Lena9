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

### Current verified state
- Date/time (Europe/Istanbul): 2026-11-26 09:42
- Active branch: research/onecore-v3-implementation only. Frozen V2 branch research/onecore-foundation remains at 6d5dd21982f8f4a835e07b0f004b1621be57ba96.
- Latest branch commit SHA: 9d4ef7a74b70660732c4a199738401f938c2f31c — fix(onecore-v3): retain CPU benchmark progress and reduce RSS polling overhead.
- Latest relevant workflow runs:
  - [Run #701 — Verify](https://github.com/jonsnow-org/Lena9/actions/runs/45769739545), commit 9d4ef7a74b70660732c4a199738401f938c2f31c: completed successfully. Compile, exact V3 parameter/FLOP checks, unit/regression tests, corrected V2-spec checks, architecture notebook, safe notebook preflights, FineWeb-2 cursor-resume smoke test, notebook validation, and workflow isolation/lock checks all completed successfully. CPU benchmark and corpus restore jobs were skipped because this was a push event. No artifacts were produced by this Verify run.
  - [Run #700 — manual CPU benchmark attempt](https://github.com/jonsnow-org/Lena9/actions/runs/45724385251), old commit 359976e333906b228eef39584fecc5d10c9a092d: failed after approximately 94 minutes. The benchmark job's final step summary remains inconsistent (in_progress while the parent run is failed); no artifacts were produced, and the job-log endpoint returns BlobNotFound. Root cause is unverified.
  - [Run #698 — prior Verify](https://github.com/jonsnow-org/Lena9/actions/runs/45723082992): successful on the previous commit.
  - [Run #1 — historical V3 training attempt](https://github.com/jonsnow-org/Lena9/actions/runs/45483538417): failed with no artifacts; the optimizer command step is listed as in progress in the failed job summary. Logs are unavailable; do not infer a successful or resumable checkpoint.
- Active run/lock: none. The repository Actions query for status=in_progress returned zero runs after Run #701 completed. No V3 training or corpus-restore lock is held.
- Architecture: active V3 prototype-2 config is 39,906,568 trainable parameters, 123 state-dict tensors, config SHA-256 6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708. Five-family dense forward reference sum is 291,846,632,448 FLOPs; this is not measured runtime throughput.
- Corpus artifact + verification:
  - [Corpus artifact from Run #605](https://github.com/jonsnow-org/Lena9/actions/runs/45325008221/artifacts/14892594659): 24,432,975,285 bytes, SHA-256 302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2; artifact is still non-expired.
  - [Conversion report artifact](https://github.com/jonsnow-org/Lena9/actions/runs/45325008221/artifacts/14893020087): 892,194 bytes, archive digest sha256:151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba. The report ZIP was downloaded and inspected (the 24.43 GB corpus ZIP was not downloaded). Its JSON SHA-256 is 5976ad7f5e3149a31bd1da67308bf228cf0afb31ba970e00481dda04b1f73941.
  - Live report values: manifest_gate.passed=true, top-level blocked=false, acquisition_incomplete=false, synthetic_records_added=0, converted_records=654088, accepted_external_records=654088, and asset_hashes contains 20,607 entries / 20,569 unique hashes. Coverage: train text/tool/image/audio/video = 591,525 / 14,000 / 900 / 1,100 / 100; validation = 22,552 / 400 / 10 / 165 / 10; test = 22,758 / 400 / 10 / 148 / 10. Missing-media deficits are zero and errors are empty. Skips: 1,302 non-external rows and 37 pinned_source_row_not_found.
  - Important distinction: restoration_incomplete=true records the 37 unmatched pinned legacy rows, while the final external-only V3 manifest gate still passes and is not blocked. Preserve this distinction; do not call the entire legacy archive fully restored.
- Tokenizer artifact + verification:
  - [Tokenizer artifact from Run #2](https://github.com/jonsnow-org/Lena9/actions/runs/45336933362/artifacts/14894835517): 394,036 bytes, ZIP digest sha256:47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6; non-expired.
  - The downloaded ZIP contains a 32,000-token byte-level BPE JSON (1,741,549 bytes; SHA-256 569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76) and an evidence sidecar. Evidence binds 591,525 external train-text records, train-manifest SHA-256 d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205, external text-row SHA-256 6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720, validation/test rows used = 0, and V2 tokenizer import = false. Tokenizer summary confirms the 24.43 GB corpus archive was not downloaded for fitting; only data/train.jsonl was range-extracted.
- CPU resource benchmark: NOT RUN successfully. Run #700 failed with no benchmark artifact and unavailable logs. No measured peak RSS, V3JointDataLoader throughput, modality rates, or actual image/audio/video shape distributions are available. Commit 9d4ef7a now makes the same report path an atomic progress/final snapshot, records stage boundaries and 30-second worker heartbeats, and samples process-tree RSS every 0.25 seconds; per-worker ru_maxrss remains the kernel high-water measurement. Run #701 Verify does not count as this benchmark.
- Full checkpoint restore: NOT RUN against the actual V3 corpus and tokenizer. Only tiny-model checkpoint round-trip/mismatch tests have passed. No V3 checkpoint artifact, train_result.json, evaluation.json, or model-registry file exists in the active branch tree or the failed V3 training run artifacts.
- Trainer / optimizer state: no verified durable V3 optimizer lineage exists. Current .github/workflows/onecore-v3-training.yml is manual-only and the train job condition contains && false; do not remove this gate. Historical Run #1 is ambiguous because its optimizer command step is shown in progress but no artifact/logs survive. No optimizer update was started by this session.
- PR / integration state: no open V3 PR. Open PR #7 and issue #6 are unrelated. main currently points to 10c4f01663bd65e30335bfe7b4ed3cdfe6584815; this session did not modify it. No changes were made to the frozen V2 branch or other repositories.

### Completed in this session
- Change: hardened onecore-ai/src/onecore/v3/resource_benchmark.py so the benchmark writes atomic progress snapshots to the same report path already uploaded by the workflow, updates the active stage/worker and RSS heartbeat every 30 seconds, preserves partial evidence on controlled failure, and refuses to overwrite a report from another run. Changed parent/worker RSS polling from 20 ms to 250 ms to reduce needless polling overhead while retaining the worker kernel ru_maxrss high-water metric.
- Tests: added regression coverage for atomic progress replacement, failure preservation for the current run, refusal to overwrite a prior run report, and subprocess heartbeat callbacks in onecore-ai/tests/test_v3_resource_benchmark.py.
- Commit: [9d4ef7a74b70660732c4a199738401f938c2f31c](https://github.com/jonsnow-org/Lena9/commit/9d4ef7a74b70660732c4a199738401f938c2f31c).
- CI: [Run #701](https://github.com/jonsnow-org/Lena9/actions/runs/45769739545) completed successfully; all job steps passed. The job-log download endpoint returned BlobNotFound, so no exact pytest count is claimed. The manual benchmark and restore jobs were skipped as expected for a push event.
- No training request was changed, no optimizer update was executed, no checkpoint was mutated, no PR was created, and no merge to main occurred.

### Remaining / blocked
- CPU benchmark dispatch: the workflow is deliberately manual-only. The connected GitHub toolset exposes repository reads and file/commit writes but no workflow_dispatch action; its fetch operation is GET-only. I did not bypass the manual-only gate. The exact required action is one dispatch of .github/workflows/onecore-ci.yml on research/onecore-v3-implementation with benchmark_v3_resources=true and restore_v3_corpus=false, after Verify has passed. Do not repeat Run #700 unchanged; use the new commit 9d4ef7a.
- After a successful measured CPU artifact exists, implement and run the full-corpus/tokenizer checkpoint save/restore audit (model, optimizer, scheduler, global step, data cursors, Python/NumPy/Torch RNG, hashes and lineage).
- Only after the CPU and checkpoint gates pass should the bounded multi-session trainer be designed/activated. The current && false guard remains mandatory for now.
- The V3 production inference/API path and independent held-out multimodal quality evaluation remain unimplemented/unverified.
- Documentation cleanup remains: onecore-ai/docs/training-operations.md and onecore-ai/notebooks/README.md still describe the frozen V2 branch/57,579,201-parameter contract in places. They must be clearly labeled V2 legacy or reconciled with the active V3 architecture before training instructions are exposed.

### Exact continuation point
- Repository path/file: onecore-ai/src/onecore/v3/resource_benchmark.py, functions _run_monitored_subprocess, _run_parent, and main; regression tests in onecore-ai/tests/test_v3_resource_benchmark.py.
- Last inspected line/function/workflow: atomic progress snapshots are written at artifact validation, corpus/media extraction, tokenizer verification, loader start/completion, each family benchmark, joint five-family objective, and final report. The CI path is .github/workflows/onecore-ci.yml job v3-resource-benchmark.
- Next single engineering action: obtain the missing workflow-dispatch capability or have the manual CPU benchmark dispatched once with the exact inputs above; then inspect the new report artifact and use its measured resource/shape evidence to scope the full V3 checkpoint audit.
- Preconditions / safety checks: confirm Verify success on the exact branch head; confirm no active run/lock; do not enable restore_v3_corpus; do not start the optimizer training workflow; do not redownload/refit the existing corpus/tokenizer.

### Do-not-repeat list
- Run #605 / 45325008221 corpus conversion and artifacts 14892594659 + 14893020087: validated external-only coverage already exists; do not repeat corpus restore or redownload the 24.43 GB archive.
- Tokenizer Run #2 / 45336933362 / artifact 14894835517: independently fitted external train-only 32k tokenizer exists; do not refit or replace it.
- Run #700 / 45724385251: failed manual CPU benchmark with no artifact and unavailable logs; do not repeat unchanged. The progress/heartbeat fix is in commit 9d4ef7a.
- Run #701 / 45769739545: successful push Verify only; CPU benchmark and corpus restore were skipped. Do not mistake this for measured CPU evidence or rerun it without a code change.
- V3 training Run #1 / 45483538417: failed with no artifact and ambiguous optimizer-step completion; do not resume or treat it as a valid checkpoint.
- No V3 optimizer training, full-corpus checkpoint restore, or tokenizer fitting was performed in this session.

**Update policy:** Replace the ledger with current verified facts after every scheduled session. Keep older important evidence in Git history; do not leave stale status at the top or silently erase a known blocker.
