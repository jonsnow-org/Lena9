# OneCore — canonical training operations

## Single operating path

OneCore has one model implementation, one tokenizer, one trainer and one checkpoint lineage. Use only these workflows:

- `.github/workflows/onecore-ci.yml`: canonical integrity tests and explicitly selected runtime gates.
- `.github/workflows/onecore-v3-tokenizer.yml`: the single tokenizer fit/verification workflow.
- `.github/workflows/onecore-v3-training.yml`: the only optimizer-training workflow; it is currently fail-closed.

Do not use notebook-based training, a second request file, an alternate trainer or any legacy model directory.

## Immutable inputs

The external five-family corpus is already present as artifact `14892594659` from run `45325008221`; its SHA-256 is `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`. The associated conversion report is artifact `14893020087`, SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`.

The historical tokenizer artifact `14894835517` from run `45336933362` has 32,000 tokens and is not used by the corrected model. It remains preserved for provenance. The one canonical replacement uses request `onecore-ai/v3-tokenizer-request.json` to fit exactly 4,096 text BPE tokens from the pinned external TRAIN split only. The new artifact is accepted only after verifying its run, artifact digest, tokenizer JSON SHA-256, 4,096 vocabulary size, external train-row count, manifest SHA and zero validation/test rows.

## First authorized training segment

The immutable request is `onecore-ai/v3-training-request.json`:

| Setting | Value |
|---|---:|
| Updates in one authorized segment | 5 |
| Total schedule | 20,000 |
| Warmup | 200 |
| Learning rate | 0.0003 |
| Weight decay | 0.1 |
| Gradient clipping | 1.0 |
| Checkpoint cadence | Every update |
| AdamW betas | (0.9, 0.95) |
| CPU threads | 4 |
| Seed | 20261124 |
| Native T-LDM weight | 0.15 |

One joint optimizer update accumulates one micro-batch per family in this exact order: text, tool, image, audio, video. There is one optimizer step after the five family objectives are accumulated.

## Required gates before any update

1. A real-corpus CPU benchmark must measure process-tree peak RSS, production loader throughput, per-family forward/backward timings and joint objective/AdamW allocation for the current configuration.
2. A full real-artifact step-zero checkpoint save/restore audit must pass for the current configuration fingerprint. The earlier step-zero artifact predates native T-LDM and does not qualify for the current fingerprint.
3. The external-only five-family corpus report and replacement tokenizer evidence must pass their hash, split and payload checks, including exact 4,096 vocabulary equality with the current config. The old 32,000-token artifact is excluded.
4. No conflicting run may be active.
5. The owner must explicitly authorize the first bounded segment.

A Verify/push run, a parameter count, analytical FLOPs, synthetic fixtures or a previous configuration's audit is not a resource benchmark.

## After the first update

Before any longer run, perform a separate non-zero-step continuation audit. It must prove the populated AdamW moments, exact parent-checkpoint SHA, advanced five-family/source cursors, scheduler/global step and Python/NumPy/Torch RNG states all survive save/restore.

## Current state

No optimizer update has been verified for the current T-LDM-enabled configuration. No trained checkpoint or independent held-out quality evaluation exists. The historical 32,000-token tokenizer is excluded; the corrected 4,096-token BPE is being generated from the immutable external TRAIN split. Keep the `&& false` training guard in `onecore-v3-training.yml` intact until the replacement tokenizer, real CPU benchmark, current-config step-zero checkpoint audit and explicit owner authorization are complete. Do not start training by changing a push trigger or substituting an ordinary CI run.
