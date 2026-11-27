# OneCore executive handover

## Canonical product state

**OneCore is one model, with one active implementation and one training path.** The sole model source is `onecore-ai/src/onecore/v3/` on branch `research/onecore-v3-implementation`. No parallel model package, old trainer, notebook-based training line or alternate checkpoint lineage remains in this branch.

The adopted corrected model contract (`onecore-v3-corrected-spec-2`):

- **57,579,201 trainable parameters**.
- Shared width 1,024; unified vocabulary 5,144 (text BPE 4,096, vision 512, audio 256, motion 256, special 24).
- Four unique Transformer blocks reused for three recurrent cycles; eight attention heads; SwiGLU hidden width 2,730; RMSNorm; maximum context 512.
- One shared semantic Transformer and tied text embedding/output projection.
- Image/audio/video codecs and modality flow heads inside the same model/checkpoint.
- Native T-LDM uses 16 latent slots through the same shared core and tied text head. It adds zero trainable parameters. Initial text/tool masked-diffusion loss weight is 0.15.

This model has not been trained. Output quality is not certified.

## Single-model consolidation completed

1. Integrated native T-LDM into the canonical model, objective, request, workflow and FLOPs report:
   - `c19cda838029c67e81c0dae90d39e7c822b96c3e`: native latent thinker/writer and iterative generation through the same shared Transformer.
   - `5880190ca6f8c0042c0418c3d7fa87e78f98c567`: masked diffusion loss in text/tool objectives; explicit weight 0.15.
   - `7e93fb450b7fd646221fb3bd24b2b83b9903247b`: FLOPs accounting and tests for masked-token identity, tied weights, parameter invariance, objective and generation.
2. Removed **65 files** from the active branch in `432ac41054536673aa05717ca10da66926794f40`: the parallel old model modules, old training code, duplicate workflows/actions, notebook-training tree, old tests and obsolete model configuration/specification files.
3. Moved generic row identity, nested-field and pinned-video data helpers into `src/onecore/v3/source_utils.py`; generalized corpus conversion names. No model weights or checkpoints were carried over.
4. Removed notebook-specific source routing and notebook fields from the active source registry. The shared cursor now writes `pipeline_id`; it reads the old serialized key only for backward compatibility with existing progress files.
5. Kept a pinned data-only source-registry snapshot for corpus artifact `14892594659`. It preserves the original acquisition provenance and is used only by the explicit corpus-restore operation. It does not contain a second model, weights or training state. Dataset identifiers such as `stack_v2_edu` name upstream datasets, not OneCore versions.
6. Rewrote the README, architecture notes, agent instructions, session protocol, T-LDM and training-operation documents around one model and one training path. The research config now records T-LDM and the bounded training settings explicitly.

## Final CI and source-package evidence

- Run #771: `45961095125`, commit `6dcf4f54787a68bae06c90265f016e744620f228` — **success**, all Verify steps passed: compile, exact parameter/FLOPs assertions, **211 passed / 47 warnings**, single-model/guard checks, and FineWeb-2 exact cursor resume.
- Source package Run #8: `45961095117`, same commit — **success**. Artifact `15181136805`, name `onecore-source-code-6dcf4f54787a68bae06c90265f016e744620f228`, size **250,632 bytes**, SHA-256 `b3956136fb5e73ac05057ccedfb73e536e2df8554badcd6d7e245ff82efae151`. This is a source-only archive; it excludes model weights, checkpoints, datasets and runtime state.
- Earlier failures #766–#769 were resolved by the subsequent source-helper, identifier and cursor-path corrections. Do not rerun unchanged failed commits.

## Preserved data inputs

- Five-family corpus artifact `14892594659`, run `45325008221`, size 24,432,975,285 bytes, SHA-256 `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`.
- Conversion report artifact `14893020087`, SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`.
- Tokenizer artifact `14894835517`, run `45336933362`; 32,000-token BPE fitted on 591,525 external train-text rows only; tokenizer JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.

These artifacts are data/tokenizer inputs to the one model, not another model. Preserve them; do not repeat acquisition or tokenizer fitting without evidence that an exact artifact is missing, expired or corrupt.

## Runtime/training gates still open

There is **no successful measured CPU benchmark** for the current T-LDM-enabled configuration: no verified process-tree peak RSS, production loader throughput or complete per-family/joint timing report.

The previous step-zero checkpoint audit predates the T-LDM configuration fingerprint and does not satisfy the current gate. A new real-artifact checkpoint save/restore audit is required for the exact current model/configuration. No optimizer update, non-zero-step checkpoint, post-update continuation audit or real held-out evaluation has occurred.

The sole optimizer-training workflow `.github/workflows/onecore-v3-training.yml` remains explicitly fail-closed with `&& false`. Keep it blocked until the current-config CPU benchmark, current-config checkpoint audit and explicit owner authorization pass. The first authorized segment remains five joint optimizer updates, checkpointing every update. After the first update, audit AdamW moments, parent checkpoint SHA, advanced five-family cursors, scheduler and RNG before longer training.

## Merge/branch cleanup

- Repository: `jonsnow-org/Lena9`.
- Active branch: `research/onecore-v3-implementation`, HEAD at verification `6dcf4f54787a68bae06c90265f016e744620f228`.
- `main` is still at `10c4f01663bd65e30335bfe7b4ed3cdfe6584815` and has not been modified in this consolidation.
- The active branch is 74 commits ahead and 4 behind `main`; open one reviewed PR and merge only after its own PR checks pass.
- The old `research/onecore-foundation` ref still points to its former contents at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`. After the canonical PR merges, repoint this legacy ref to the new `main` SHA with compare-and-swap so it no longer names a different model implementation. The available GitHub connector has no branch-delete operation; the branch name may remain as an inert pointer, but it must not retain a second code line.

## Mandatory multi-client coordination protocol

Every client must read `SESSION_PROTOCOL.md`, `AGENTS.md` and this complete handover before writing. Check live HEAD and the latest 20 relevant runs, use the shared writer lock with compare-and-swap, and record exact commits, tests, jobs, artifacts, failures and skipped gates. The lock for this consolidation has been released. Do not recreate a parallel model, trainer, notebook workflow, branch or checkpoint lineage.
