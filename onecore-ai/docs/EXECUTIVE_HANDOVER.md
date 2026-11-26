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
- Added independent held-out evaluation in `onecore/v3/dataset.py` and `onecore/v3/evaluation.py`: deterministic external-only validation/test samples, the same media materializers/hash checks, per-family objective diagnostics, record-ID hashes, and explicit checks that model weights, gradients, train cursors and RNG remain unchanged. The current follow-up binds evaluation to a non-zero-step SHA-pinned inference runtime with a matching loader config; it does not certify generated output quality.
- Added `onecore.v3.checkpoint_audit`, tests, a dedicated CI job and manual input. The audit binds the real corpus manifest bundle, conversion report/asset hash map and pinned tokenizer, snapshots the actual V3 loader cursors using lazy-assets mode, saves/restores a step-zero checkpoint including model/optimizer/scheduler/RNG/lineage, and records a report without any optimizer update or media download. This audit is intentionally narrower than the later post-update continuation gate.
- Runs #709 and #710 passed Verify. First marker run #711 failed only because an older policy test expected no `github.event.head_commit.message` anywhere after the corpus job; that string was confined to the separate audit job, but the test sliced the remainder of the workflow. Updated the test to bound the corpus-restore job and explicitly validate the one-shot marker scope. Run #712 then passed all Verify steps. This commit now reuses the single-use marker `[run-v3-checkpoint-audit]` to launch the real-artifact audit once; ordinary future pushes skip it.
- The OneCore supervisor task instructions were updated to require actual code/test work at every invocation and avoid completed work. Its recurrence remains daily because the available scheduler supports daily/weekly/monthly only; it cannot save an hourly recurrence.
- Run #715 passed all Verify steps (385 passed tests, 44 warnings); the initial evaluation fixture needed `audio_channels=2` to match its stereo fixture records. The source codec's mono/stereo validation was not loosened.
- The all-family held-out evaluator fixture exposed a NaN from 1x1 image-pyramid gradient tensors in Run #719. The fix only computes finite differences along axes that have adjacent pixels; a one-pixel regression was added. Run #721 passed with 386 tests / 45 warnings.
- Added the artifact-bound held-out evaluation CLI and CI job in commit `f1521f3478eab346444334909ee264cd635f2042`. It refuses step-zero, incomplete or hash-mismatched training artifacts, binds the run lineage and resource evidence, loads the existing pinned corpus and conversion-report asset hash map, and evaluates only validation/test. The job did not run because no completed trained V3 checkpoint run ID was supplied.
- Run #722 passed 388 tests / 45 warnings, including the all-family held-out objective fixture, training-artifact metadata validation, YAML/workflow policy tests, notebooks, and FineWeb-2 cursor-resume. Run #725 passed 388 tests / 45 warnings again on the latest docs HEAD, including exact tokenizer-byte SHA preservation in the inference runtime.
- The evaluator now reports objective diagnostics only; it has not yet run against a trained real-corpus checkpoint and is not a generation-quality certification.
- No CPU resource benchmark, corpus restore, tokenizer fit, or optimizer training was run.

### Remaining / blocked
- The real-artifact step-zero checkpoint audit **passed** in Actions run `45813123352` on commit `616a0051a02171b8f578f0313137687bde7380f5`; report artifact `15114513841` was uploaded successfully. The audit used the pinned real manifest/tokenizer/asset-hash evidence, restored model/optimizer/scheduler and RNG state, and round-tripped the five family cursors at `global_step=0` with zero optimizer updates. This is initial-state serialization evidence only; do not repeat it. A separate post-update continuation audit remains mandatory after the first approved optimizer update.
- Preserve the passing step-zero audit artifact as initial-state serialization evidence only. Once the CPU resource gate is independently passed and the first bounded optimizer update is explicitly approved, execute a separate post-update checkpoint round-trip with populated AdamW moments, advanced per-family/source cursors, exact parent artifact SHA and all RNG states before any longer training segment.
- The inference implementation/CLI, held-out objective evaluator, and artifact-bound evaluation CLI/workflow now exist. Commit `f1521f3478eab346444334909ee264cd635f2042` added `onecore.v3.evaluation_cli`, its tests, and the manual `evaluate_v3_checkpoint_run_id` / one-shot marker workflow. Verify Run `45815210752` passed **388 tests, 45 warnings**; the held-out evaluation job was skipped because no completed trained V3 checkpoint run ID was supplied. The model is untrained and quality is uncertified; the evaluator has been exercised only on deterministic tiny fixtures, not on a trained real-corpus checkpoint. The bounded multi-session trainer remains blocked until measured CPU resource evidence and the post-first-update checkpoint gate are available.
- The latest fully completed Verify is Run #725 on commit `90242572fa0df5400088634ec6cce8c13891ff9c`: **388 passed, 45 warnings**. The follow-up `a8e4d29be0310ef99ed1975af8ba70d432c371a4` preserves the original tokenizer byte digest in the runtime, not a reserialized digest. Run #725 includes this change and passed.
- When the dispatch action remains unavailable, do not spend every run repeating the same blocker report. Continue the next highest-impact, non-blocked V3 engineering task; never ask the owner to repeat an action already recorded as complete.

### Exact continuation point
- Active inference path: `onecore-ai/src/onecore/v3/inference.py` and CLI `onecore-v3-infer`.
- Active held-out evaluation path: `onecore-ai/src/onecore/v3/dataset.py` (`iter_evaluation_micro_batches`), `onecore-ai/src/onecore/v3/evaluation.py`, and `onecore-ai/src/onecore/v3/evaluation_cli.py` (`onecore-v3-evaluate`). Workflow job: `v3-heldout-evaluation`; it must remain skipped until a real completed training run ID is provided.
- Active checkpoint audit: `onecore-ai/src/onecore/v3/checkpoint_audit.py` and `onecore-ai/tests/test_v3_checkpoint_audit.py`; dedicated job `v3-checkpoint-artifact-audit` in `.github/workflows/onecore-ci.yml`.
- The one-shot marker-based real-artifact step-zero audit is complete (Run `45813123352`, artifact `15114513841`). Preserve it as initial-state evidence; do not relaunch it. The next runtime gate is still the manual CPU resource benchmark.
- CPU resource benchmark implementation remains `onecore-ai/src/onecore/v3/resource_benchmark.py`; atomic progress snapshots, 30-second worker heartbeats, and 250 ms RSS polling are already implemented and covered by tests.
- Relevant tests: `onecore-ai/tests/test_v3_resource_benchmark.py`.
- Manual workflow: `.github/workflows/onecore-ci.yml`, job `v3-resource-benchmark`; required inputs are `benchmark_v3_resources=true` and `restore_v3_corpus=false`.
- Next required runtime action: obtain a valid workflow-dispatch capability for the existing workflow and run the benchmark once on the current branch HEAD. Until then, continue safe V3 engineering preparation without training or re-running completed data/tokenizer work.

### Do-not-repeat list
- Corpus Run #605 / artifact `14892594659` and conversion report `14893020087`: external-only gate already validated; no repeat restore/redownload.
- Tokenizer Run #2 / artifact `14894835517`: verified 32k external train-only tokenizer exists; no repeat fit.
- Run #700 / `45724385251`: failed benchmark without artifact; fix already committed; no unchanged retry.
- Run #681 / `45641782921`: stale video-cap benchmark failure; later fix exists; no repeat.
- Historical Runs #701–#710 were push Verify only; the resource benchmark and corpus restore were skipped. Run #711 failed a workflow-policy test; Run #712 passed after its test was scoped correctly. Subsequent Verify runs must still be distinguished from resource measurement and checkpoint-audit jobs. The step-zero real-artifact audit later passed in Run `45813123352`; recent code/documentation Verify runs `45814665639` and `45815150358` also passed. No successful CPU resource benchmark is evidenced.
- Run #699 / `45723470918`: cancelled on `main`; no V3 benchmark evidence and no retry.
- Historical V3 training Run #1 / `45483538417`: failed with no artifact and ambiguous optimizer step; never resume or accept its lineage.
- No V3 optimizer training, full corpus restore, tokenizer refit, checkpoint mutation, branch creation, or merge to `main` until explicit gates are satisfied.


### Supervisor execution record — 2026-11-26

- Added `onecore-ai/AGENTS.md` in commit `4e647bfd4d43cafcf6cf3568ab1a28ae4060a772`. It provides scoped V3 rules for the project subtree and resolves the conflict with the stale root `AGENTS.md` without changing the root file, `main`, V2, Ttbik or other application directories. CI Run `45814665639` passed: 385 tests passed, 45 warnings; compile, V3 architecture/FLOP assertions, unit/regression tests, specification checks, architecture notebook, notebook preflights, FineWeb-2 resume and workflow-isolation checks all succeeded.
- Expanded the held-out evaluator regression test to exercise all five families (text, tool, image, audio, video), checkpoint/config hash binding, zero optimizer updates, unchanged model state, unchanged training cursors and RNG preservation. The first expanded run `45814941055` correctly exposed a real issue: image-pyramid gradient loss became NaN when a downsampled level was 1×1 because one or both finite-difference tensors were empty.
- Fixed `onecore-ai/src/onecore/v3/losses.py` to compute horizontal/vertical gradient terms only when that axis has adjacent pixels. Added `test_v3_image_pyramid_loss_handles_one_pixel_pyramid_levels` in `onecore-ai/tests/test_v3_losses.py`.
- Latest implementation/test commit: `280530908e6da6958b17417d9db779337a0ba52b`. Full CI Run `45815150358` passed: **386 passed, 45 warnings**. Compile, exact parameter/FLOP budget, all unit/regression tests, V2 spec checks, architecture notebook, safe notebook preflights, FineWeb-2 cursor-resume smoke test, notebook validation and workflow isolation all succeeded.
- These evaluation checks use small deterministic fixtures to test software behavior only. They do not represent a real trained checkpoint, do not certify model quality, and do not satisfy the independent real-corpus evaluation requirement.
- No production model weights, tokenizer, corpus, checkpoint lineage, training request or workflow training guard was changed. No optimizer update was performed.
- The implementation/test baseline commit `280530908e6da6958b17417d9db779337a0ba52b` passed Run `45815150358` (386 passed, 45 warnings). The artifact-bound evaluation workflow/code commit `f1521f3478eab346444334909ee264cd635f2042` passed Run `45815210752` (388 passed, 45 warnings); its held-out job was skipped because no trained checkpoint run exists. The current V3 branch head at this ledger refresh is `90242572fa0df5400088634ec6cce8c13891ff9c`. The CPU resource benchmark remains the next runtime gate and no successful measured RSS/throughput report is evidenced. Training remains blocked; do not remove the `&& false` guard. The canonical workflow exposes manual inputs `benchmark_v3_resources=true` and `restore_v3_corpus=false`. The connected GitHub actions currently available to this session provide read/rerun and repository file operations but no workflow-dispatch action, so the manual CPU benchmark cannot be started from this tool connection.


### Supervisor follow-up — 2026-11-26 (Actions Run #738)

- The live V3 branch HEAD is `adc75b327c0ab184c492c87272372d7f967e3712`.
- A concurrent OneCore source-license change in commit `a2d21219b8c34b7da29f075aaca6f07db888e196` added retained-evidence SHA-256 verification. Its push Verify run #735 (`45818515228`) exposed a missing `hashlib` import. The subsequent workflow-dispatch run #736 (`45820758282`) hit the same test failure before optional jobs could run.
- Commit `f8164c435c3f9326bd3ac6739e751329a83a922b` added the missing import. Verify run #737 (`45821086050`) then exposed a stale test fixture: it attempted to replace a hard-coded SHA that was not the dynamically generated digest, so the malformed-hash test was a no-op.
- Commit `adc75b327c0ab184c492c87272372d7f967e3712` corrected the fixture to compute the real SHA-256 from `_EVIDENCE_BYTES`, replace that exact digest with an invalid value, and assert that the fixture changed.
- Actions run #738 (`45821364269`) on the current HEAD completed successfully: **398 passed, 45 warnings**. Compile, exact parameter/FLOP budgets, corrected specification checks, architecture notebook, safe notebook preflights, FineWeb-2 cursor-resume, notebook validation and workflow-isolation checks all passed.
- The earlier workflow-dispatch run #736 failed in the Verify job; its CPU resource benchmark, corpus restore, step-zero audit and held-out evaluation jobs were skipped. Its artifact list was empty. It produced **no** measured RSS/throughput evidence. The CPU resource gate remains outstanding.
- No optimizer updates were performed. The V3 training workflow guard remains intentionally fail-closed; retain it until the resource benchmark and all required approvals are satisfied.
- Next runtime action remains a manual dispatch on the current branch HEAD with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. The available GitHub connection in this session still has no workflow-dispatch action; do not substitute a push run or a Verify pass for the benchmark.


## 7. Mandatory multi-client coordination protocol — 2026-11-26

- Added `SESSION_PROTOCOL.md` and `SESSION_LOCK.json`. Every AI/client/scheduled supervisor working below `onecore-ai/` must read the protocol, `AGENTS.md` and this complete handover before any write, dispatch, rerun or merge.
- The shared lock requires compare-and-swap against the live branch HEAD; a valid active lease means other clients remain read-only. Release the lease after verification and update this handover before exit.
- Reviewed commits from `51efb59531d3e55a47a2b9b054b489e69fdd11e8` to the preceding HEAD `6474bcbec1270ec15cae97f19cb0bd91b8f2923b`: 11 commits, all paths confined to `onecore-ai/`. The concurrent work added a fail-closed source-license audit and Stack V2 exact license-ID filtering. No changes to model weights, V3 tokenizer, pinned corpus artifact, V3 training request or optimizer state were found in that comparison.
- Intermediate Verify failures #728–#737 were followed by successful Run #738 (398 passed, 45 warnings) and Run #739 (all 17 Verify steps passed). Run #736 was a manual workflow dispatch but failed unit tests; CPU benchmark, restore, checkpoint audit and held-out evaluation were skipped. No resource artifact or optimizer update resulted.
- The license review registry currently contains no approved source entries. The audit currently provides evidence/reporting and does not automatically gate the V3 optimizer workflow. Commercial readiness must remain false until source-specific reviews for the actual training sources are completed and audited.
- Review found no active Actions runs, no open OneCore PR and no unresolved failure on the latest #739 Verify job. PR #7 is unrelated.
- Exact reviewed continuation head before this protocol change: `6474bcbec1270ec15cae97f19cb0bd91b8f2923b`. Always reconcile against the live HEAD at the next session.
