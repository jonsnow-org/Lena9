# OneCore — mandatory multi-client session protocol

**Required before every engineering session.** This protocol applies to every AI agent, coding client, human-assisted automation and scheduled supervisor that can inspect or modify `onecore-ai/`.

## A. Read order

Before any write, dispatch, rerun, merge or training operation, read these files completely and in order:

1. `onecore-ai/SESSION_PROTOCOL.md`.
2. `onecore-ai/AGENTS.md`.
3. `onecore-ai/docs/EXECUTIVE_HANDOVER.md`.
4. `onecore-ai/README.md` and `onecore-ai/ARCHITECTURE.md`.
5. The exact source, tests, workflows and request files relevant to the next task.

Do not infer the current state from chat history or a previous report.

## B. Live reconciliation

Query GitHub live before taking action:

- Confirm repository `jonsnow-org/Lena9` and the single active branch `research/onecore-v3-implementation`.
- Fetch its current HEAD SHA.
- Inspect commits since the HEAD recorded by the handover and read their diffs.
- Inspect the **latest 20 relevant** Actions runs, including their event, commit SHA, conclusion, jobs, steps and artifacts. A green push Verify is not evidence that an optional runtime job executed.
- Inspect all open OneCore PRs, relevant issues, active runs and tasks that can write to the repository.
- Reconcile the source, artifacts, run logs and handover. If a newer client has changed the project, do not duplicate or overwrite that work.
- Do not treat queued, skipped, cancelled or failed jobs as passes. Distinguish code verification from real-corpus CPU measurement, checkpoint audits, model training and independent evaluation.

## C. Shared writer lease

`onecore-ai/SESSION_LOCK.json` is the shared advisory writer lease.

1. If `status=active` and `lease_expires_at_utc` is in the future, do not write, commit, rerun, dispatch or merge. Remain read-only.
2. To acquire an unlocked or expired lease, create a commit setting `status=active`, a unique session ID, holder/client, UTC start and expiry (maximum 60 minutes), exact base HEAD and a short planned scope.
3. Move the branch with compare-and-swap against the exact HEAD SHA read before the lock commit. If the ref update rejects, reread the branch and reconcile; never force an unreviewed overwrite.
4. Renew at least every 30 minutes during long work and never let an active write proceed on an expired lease.
5. Release the lease in the final handover commit, setting `status=released`, clearing holder/session/expiry fields and recording final SHA, CI runs, result and UTC release time.
6. If compare-and-swap or the lock cannot be used safely, remain read-only.

The lease is a repository coordination convention, not GitHub-enforced branch protection; all clients must follow it.

## D. One model and one source of truth

- There is exactly one active OneCore model implementation: `onecore-ai/src/onecore/v3/`.
- There is one joint trainer, one tokenizer path, one checkpoint lineage and one optimizer/scheduler/RNG lineage.
- Do not create or revive a second architecture, branch, model package, training workflow, notebook trainer or duplicate request.
- T-LDM is native to the same shared Transformer and tied text output head. Do not implement it as a separate service or model.
- Generic provenance/data utilities and the pinned source-corpus artifact are not model implementations; preserve them when the canonical loader depends on them.
- Keep all OneCore code/doc changes within `onecore-ai/`, except the canonical workflows under `.github/workflows/`.
- Do not change `main` directly. Merge the canonical branch through a reviewed pull request only after verification.

## E. Integrity and do-not-repeat rules

- The complete `EXECUTIVE_HANDOVER.md` is the durable engineering ledger.
- Record the current branch HEAD, changed files, commit SHA, exact Actions run/job IDs, artifact identifiers and digests, test totals, failures, skipped jobs, risks and precise continuation point after each session.
- Distinguish implemented, unit-tested, CI-verified, run on real artifacts, trained and independently evaluated. These are different states.
- Preserve immutable corpus/tokenizer/checkpoint artifacts and lineage. Do not reacquire the corpus or refit the tokenizer without evidence of loss, expiry or corruption.
- Do not infer RAM, throughput or quality from parameter counts, FLOPs, theoretical storage or synthetic fixtures.
- Never use validation/test data for tokenizer fitting, optimizer updates or training-time tuning.
- Do not retry a failed run unchanged. Record the failure cause and the actual correction first.
- Preserve privacy, safety and source provenance checks.

## F. Training gates

The optimizer workflow must remain fail-closed until all required gates are complete for the **current configuration fingerprint**: real-corpus five-family coverage, exact tokenizer evidence, measured CPU peak process-tree RSS and throughput, current-config real-artifact step-zero checkpoint round-trip and explicit owner authorization.

The first authorized segment is five joint optimizer updates with a checkpoint every update. After the first update, run a non-zero-step checkpoint-continuation audit checking populated AdamW state, advanced five-family cursors, parent checkpoint SHA and RNG state. No longer segment may begin until that audit passes.
