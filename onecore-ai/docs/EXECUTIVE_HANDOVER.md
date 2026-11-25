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
- A prior handover identified the highest blocker as genuine CPU RSS/throughput evidence. The next required measurement at that time was a new V3 manual measurement on the corrected current revision with `benchmark_v3_resources=true` and `restore_v3_corpus=false`; do not blindly repeat that instruction—inspect the latest runs first and determine whether it remains outstanding.
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
- Date/time (Europe/Istanbul):
- Active branch:
- Latest branch commit SHA:
- Latest relevant workflow run(s):
- Active run/lock:
- Corpus artifact + verification:
- Tokenizer artifact + verification:
- CPU resource benchmark:
- Full checkpoint restore:
- Trainer / optimizer state:
- PR / integration state:

### Completed in this session
- Change:
- Commit / PR:
- Tests and exact results:
- Artifact/run evidence:

### Remaining / blocked
- Item:
- Evidence and blocker:
- Required owner/action:

### Exact continuation point
- Repository path/file:
- Last inspected line/function/workflow:
- Next single engineering action:
- Preconditions / safety checks:

### Do-not-repeat list
- Exact completed run IDs/actions and why they must not be repeated:

**Update policy:** Replace the ledger with current verified facts after every scheduled session. Keep older important evidence in Git history; do not leave stale status at the top or silently erase a known blocker.
