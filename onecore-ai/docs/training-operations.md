# OneCore — canonical training operations

## Single operating path

OneCore has one model implementation, one tokenizer, one trainer and one checkpoint lineage. Use only these workflows:

- `.github/workflows/onecore-ci.yml`: canonical integrity tests and explicitly selected runtime gates.
- `.github/workflows/onecore-v3-tokenizer.yml`: the single tokenizer fit/verification workflow.
- `.github/workflows/onecore-v3-training.yml`: the only optimizer-training workflow; it is currently fail-closed.

Do not use notebook-based training, a second request file, an alternate trainer or any legacy model directory.

## Immutable inputs

The external five-family corpus is already present as artifact `14892594659` from run `45325008221`; its SHA-256 is `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`. The associated conversion report is artifact `14893020087`, SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`.

The preserved tokenizer artifact is `14894835517` from run `45336933362`; its GitHub ZIP digest is `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`, and the recorded tokenizer JSON SHA-256 is `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`. Its evidence records 32,000 tokens, but the corrected model config requires 4,096 text tokens. The artifact is preserved and must not be silently truncated, remapped or refitted; owner approval is required to resolve this compatibility blocker.

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
3. The external-only five-family corpus report and exact tokenizer evidence must pass their hash, split and payload checks, including exact vocabulary equality with the current config. The existing 32,000-token artifact currently fails that 4,096-token compatibility requirement.
4. No conflicting run may be active.
5. The owner must explicitly authorize the first bounded segment.

A Verify/push run, a parameter count, analytical FLOPs, synthetic fixtures or a previous configuration's audit is not a resource benchmark.

## After the first update

Before any longer run, perform a separate non-zero-step continuation audit. It must prove the populated AdamW moments, exact parent-checkpoint SHA, advanced five-family/source cursors, scheduler/global step and Python/NumPy/Torch RNG states all survive save/restore.

## Current state

No optimizer update has been verified for the current T-LDM-enabled configuration. No trained checkpoint or independent held-out quality evaluation exists. The pinned tokenizer artifact is 32,000 tokens, while the corrected config expects 4,096 text tokens; this must be resolved by the owner before training. Keep the `&& false` training guard in `onecore-v3-training.yml` intact until the resource, checkpoint and authorization gates are complete. Do not start training by changing a push trigger or substituting an ordinary CI run.
