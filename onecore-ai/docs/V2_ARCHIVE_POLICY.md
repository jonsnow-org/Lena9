# OneCore AI — V2 legacy archive

**Status: ARCHIVED — no active model-development or optimizer-training work is permitted on this branch.**

The only active OneCore architecture is V3 on `research/onecore-v3-implementation`. This Foundation branch is retained as a historical reference for the original V2 architecture, its corrected specification, source manifests, engineering history, and existing checkpoint lineage.

## Preservation contract

- Preserve all V2 source, configuration, data manifests, source provenance, checkpoint artifacts, run records, and evaluation evidence.
- Do not delete, overwrite, resize, or reinterpret any V2 checkpoint.
- Do not start new V2 optimizer updates, resume a V2 training lineage, or create a new V2 tokenizer.
- Do not copy V2 model weights, optimizer/scheduler state, tokenizer, or checkpoint payload into V3.
- V3 may use the dedicated data-only converter to reuse eligible external text/tool rows and to rehydrate original media from immutable pinned source revisions. That does not constitute V2 weight migration.
- The legacy training workflows remain in the repository for auditability, but every job is disabled. Any new training must be designed and run on the canonical V3 line after its own readiness gates pass.

## V2 specification reference

The historical V2 architecture remains governed by **Corrected Specification v2**:

- 57,579,201 trainable parameters (exact count).
- Vocabulary 5,144; width 1,024; hidden width 2,730.
- Four unique Transformer blocks reused over three cycles; eight attention heads.
- Maximum sequence length 512; image path 64×64; maximum video frames four.
- Unified external-only data gate: 100 train / 10 validation / 10 test records per family for text, tool, image, audio and video.
- T-LDM loss weight 0.15; joint update uses five family microbatches. Text-only/smoke gradient accumulation of four does not apply to joint updates.
- Promotion thresholds remain `not-approved`; do not invent quality thresholds or make readiness claims.

These values describe V2 only. V3 has its own architecture fingerprint, vocabulary, parameter/FLOPs calculations, tokenizer and checkpoint format.

## Archive controls

The V2 `onecore-bootstrap.yml` and `onecore-training.yml` workflows are disabled at the job level. Their historical definitions remain intact except for the archive guards, and the V2 CI verification workflow remains available to protect the historical source and contract.



## Archive-guard verification follow-up — 2026-11-24

The initial archive-guard test found duplicate job-level `if` keys in jobs that already had conditional execution. The corrected archive commit replaces each existing job-level condition rather than inserting a second key:

- `onecore-bootstrap.yml`: eight top-level jobs; each has exactly one job-level guard beginning with `if: ${{ false && ... }}` (or `if: ${{ false }}` where no historical condition existed).
- `onecore-training.yml`: its single manual-training job has exactly one job-level guard beginning with `if: ${{ false`.
- Step-level conditions and the historical job bodies remain preserved for audit; the job-level expression prevents the jobs from running.
- Run #58 on commit `c379a824a041fcf53d307d20ff505248c6809df2` concluded `skipped`, confirming the archived push-triggered bootstrap did not execute a job.

The regression test asserts both the parsed expression and exactly one job-level `if` per job. Full Foundation CI on this corrected head remains required; Run #610 tested the prior duplicate-guard commit and is not evidence against this correction.


## Full-tree restoration — 2026-11-24

The V2 archive branch was repaired from the last verified complete Foundation tree after an earlier documentation-only update accidentally omitted unrelated repository entries. The repaired Foundation commit preserves the complete repository tree and applies only the intended archive/verification files on top of it. The V2 source, notebook, manifest, checkpoint lineage, and Actions history remain preserved. The canonical V3 branch and `main` are unchanged.

The Foundation CI now also checks the archive guard independently of the unit tests: every job in both legacy V2 training workflows must have exactly one job-level `if` with a leading `false` guard.


## Preserve historical job conditions under the archive guard — 2026-11-24

Archive expressions now use `false && (original job condition)` where a job previously had an `if` condition. This guarantees the job is never eligible to run while preserving the original dependency/order condition for audit and regression tests. Jobs without a prior condition use `if: ${{ false }}`. Both the regression test and CI guard assert the leading false term and exactly one job-level `if` per job.
