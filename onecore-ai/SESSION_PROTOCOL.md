# OneCore Mandatory Multi-Client Session Protocol

**Status: REQUIRED before every read/write engineering session.**  
**Applies to:** every AI agent, coding assistant, scheduled supervisor, external coding client, human-assisted agent session, and any automation that can inspect or modify `jonsnow-org/Lena9/onecore-ai/`.

This protocol exists because several sessions may work on OneCore between the owner's visits. A chat transcript, remembered summary, old commit SHA, or another agent's report is never sufficient proof of the current project state.

## A. Mandatory read order — before any action

Every client must read these files in full, in this order:

1. `onecore-ai/SESSION_PROTOCOL.md` — this protocol.
2. `onecore-ai/AGENTS.md` — project architecture, branch, safety and test rules.
3. `onecore-ai/docs/EXECUTIVE_HANDOVER.md` — complete current work ledger, completed operations, failures, artifacts, blockers and exact continuation point.
4. `onecore-ai/README.md` and `onecore-ai/v3/README.md` — active architecture, constraints and capability limitations.
5. The exact source, tests, workflows and data/request files relevant to the next task.

Do not begin an edit, dispatch, rerun, restore, training operation, PR action or merge before completing this read sequence.

## B. Live cross-session reconciliation

After reading, query GitHub live. Do not infer from a previous assistant response.

- Confirm repository `jonsnow-org/Lena9` and canonical active branch `research/onecore-v3-implementation`.
- Fetch the branch HEAD SHA now; do not use a SHA copied from an earlier session.
- Inspect all commits since the HEAD recorded in the handover. Read each commit message and diff. Identify which client/session made the change where metadata allows, and whether the work is complete, under review, failed or superseded.
- Inspect the latest 20 relevant Actions runs across the repository and active branch, including `push`, `workflow_dispatch`, reruns and jobs started by other clients. Inspect jobs/steps/artifacts for relevant runs, not only the top-level green/red badge.
- Inspect all open PRs, issues, active workflow runs and any in-progress task/automation that can write to the repository.
- Reconcile discrepancies between this ledger, commit history, workflow evidence and artifacts. Live source and immutable run artifacts outrank older prose. Correct the ledger; never silently discard the discrepancy.
- Do not create a second implementation of a feature that already exists in a newer commit. Review it, test it if not yet verified, and continue from its actual state.
- Do not treat a skipped, cancelled, queued or failed job as a pass. Do not treat a push Verify run as a CPU benchmark, corpus restore, checkpoint audit, evaluation, or optimizer training.

## C. Shared writer lock — required before writes

`onecore-ai/SESSION_LOCK.json` is the shared advisory writer lease for the canonical branch.

1. Read the lock. If `status` is `active` and `lease_expires_at` is in the future, do not edit, commit, dispatch, rerun, or merge. Stay read-only, inspect the holder's latest commit/run, and report that another session owns the write lease.
2. To acquire an unlocked or expired lease, create a commit changing the lock to `status: active`, including a unique session identifier, client name, UTC start time, lease expiry (maximum 60 minutes), current base SHA, and short planned scope. Update the canonical branch with a compare-and-swap against the exact HEAD SHA read before creating the commit. If the ref update rejects because HEAD changed, discard the attempted write, fetch the new HEAD, reconcile the new commits and try again only if the lock remains free.
3. While working, renew the lease in a commit at least every 30 minutes and never let it expire during a long operation. Keep the planned scope narrow. A long-running Actions job does not authorize a second client to edit the same files.
4. Release the lock in a final commit after verifying the result, setting `status: released`, clearing `holder`, and recording the final commit SHA, run IDs, result and UTC release time.
5. Treat a lock as stale only after its expiry and after checking there is no associated active Actions run or recent heartbeat. A client must not steal a valid, unexpired lease.
6. If the client cannot safely write/commit the lock (or cannot use compare-and-swap), it must remain read-only. Do not proceed by assuming no other client is active.

The lease prevents two compliant clients from writing concurrently. It is a repository-level coordination convention, not a GitHub-enforced branch-protection lock; all clients must follow it.

## D. Single source of truth and non-duplication

- The complete `EXECUTIVE_HANDOVER.md` is the durable engineering ledger. After each session, update it with the current branch HEAD, changed files, commit SHA, exact Actions run/job IDs, artifacts/digests, test totals, failed/skipped jobs, outstanding risks and the precise next file/function/task.
- Distinguish **implemented**, **unit-tested**, **CI-verified**, **run against real artifacts**, **trained**, **evaluated**, and **commercially cleared**. These are different states.
- Add completed run IDs, failed attempts and their root causes to the do-not-repeat list. Never retry an unchanged failed run. Never repeat successful corpus restore, tokenizer fitting, step-zero checkpoint audit, or other completed work without evidence the artifact is missing, expired or corrupt.
- Before a repeated operation, write down what changed since the last attempt and what the new run will prove. If nothing material changed, do not rerun.
- Never infer CPU/RAM/throughput from parameter counts, FLOPs, theoretical storage or synthetic fixtures.
- Preserve immutable artifact IDs, hashes, corpus/tokenizer pins, checkpoints and lineage. Never delete or mutate a valid parent artifact before proving a verified successor exists.
- Do not mix V2 and V3 model state, branches, tokenizers, optimizer/scheduler state, or checkpoints.
- Keep all OneCore edits inside `onecore-ai/` unless the owner explicitly authorizes a broader change. The repository-root `AGENTS.md` contains legacy Literium/Kilo instructions; for the OneCore subtree, the scoped `onecore-ai/AGENTS.md` and this protocol are authoritative. Do not switch to `kilo/ivory-engine-kc6`.
- Do not change `main`, the frozen V2 branch, unrelated application directories, Ttbik or Sham unless the owner explicitly directs that exact action.
- Never start optimizer updates while any required training gate is missing or while an incompatible workflow is active. Do not remove a fail-closed guard merely to obtain a green run.

## E. Current review facts that all clients must preserve

Cross-session review dated **2026-11-26** found the following live facts:

- The session work reviewed was on the canonical branch `research/onecore-v3-implementation`. The 11 commits after `51efb59531d3e55a47a2b9b054b489e69fdd11e8` changed files only under `onecore-ai/`; the final reviewed branch HEAD was `6474bcbec1270ec15cae97f19cb0bd91b8f2923b`.
- The other session added a source-license evidence audit, an empty-by-default `data/license-review.yaml`, tests, documentation and fail-closed filtering for Stack V2 code. The configured Stack V2 `allowed_license_ids` list is empty, so Stack V2 code payloads are not accepted by that path.
- The license review registry currently has `sources: {}`. Therefore **zero sources are commercially cleared** by this evidence registry. The audit is an evidence-completeness report/CLI with `--require-commercial-clearance`; it is not proof that the dataset licenses have been legally interpreted, and at this reviewed HEAD the audit is not wired as an automatic gate in the V3 optimizer workflow. Do not claim commercial readiness or that the license audit itself blocks every training path. Before commercial release, source-specific authoritative terms and human review must be recorded and the fail-closed audit must pass for the actual external sources used.
- The concurrent session had intermediate failing Verify runs while developing/fixing the audit (runs #728–#737). Concrete issues recorded in the handover include a missing `hashlib` import and a negative test that mutated the wrong SHA field. The manual `workflow_dispatch` Run #736 also failed at the unit-test step; CPU benchmark, corpus restore, step-zero audit and held-out evaluation jobs were all skipped. It produced no CPU-resource artifact and no optimizer update.
- Verify Run #738 on commit `adc75b327c0ab184c492c87272372d7f967e3712` completed successfully with **398 passed, 45 warnings**. Run #739 on commit `6474bcbec1270ec15cae97f19cb0bd91b8f2923b` also completed successfully; all 17 steps in its Verify job passed. Its optional CPU benchmark, restore, checkpoint audit and held-out evaluation jobs were skipped.
- At this review there were no active Actions runs and no open OneCore PR. Open PR #7 is an unrelated Literium revenue-share note; do not treat it as OneCore work.
- The reviewed commits did not change model weights, tokenizer bytes, pinned corpus artifacts, V3 training request or optimizer lineage. No new optimizer update or successful CPU measurement was produced by runs #736–#739.
- The repository-root `AGENTS.md` still contains stale instructions for `kilo/ivory-engine-kc6`; the scoped `onecore-ai/AGENTS.md` overrides them for this subtree. Keep this override explicit.

These facts are a dated snapshot, not a substitute for the live reconciliation required in section B. If a later commit/run changes them, verify it and update this protocol and the handover.

## F. Mandatory end-of-session handoff

Before finishing any write session:

1. Run focused tests and the canonical Verify workflow appropriate to the change; wait for completion and inspect job steps.
2. Update `EXECUTIVE_HANDOVER.md` with the actual result, including failures and skipped jobs.
3. Release `SESSION_LOCK.json` in the same final commit where possible, or in a final follow-up commit.
4. Fetch the live branch again and verify that it points to the final commit; confirm there is no unrecorded concurrent commit.
5. Provide a concise handoff with direct links. Do not leave undocumented work, a held lock, or claims that depend on temporary chat context.

**If a later client has not read this file and the complete handover, it must not write to OneCore.**
