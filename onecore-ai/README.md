# OneCore AI — from-scratch compact general intelligence

**One unified, multimodal research model initialized randomly from scratch.** No pretrained model weights, adapters, teacher-model outputs, or model downloads are used.

OneCore is isolated under `onecore-ai/` in `jonsnow-org/Lena9` and developed only on `research/onecore-foundation`. Workflows are path-filtered, pinned to their triggering commit, and serialized with the non-cancelling `onecore-training` lock.

## Research hypothesis

A compact model may spend parameters more efficiently by combining a shared recurrent Transformer core, a shared token embedding/output space, small trainable modality encoders/decoders, and adaptive compute. This is a hypothesis to test, not a claim of frontier-level capability.

## Non-negotiable rules

1. All trainable weights start randomly initialized.
2. No external checkpoints, pretrained encoders, LoRA adapters, teacher distillation, or Sham model data.
3. One checkpoint contains the shared core and all trainable modality modules.
4. Train, validation, and test manifests remain isolated; held-out data never enters the training iterator.
5. Training, data generation, checkpointing, and evaluation run only on GitHub Actions.
6. Training success or lower loss does not imply model readiness.
7. Preserve lineage and do not resize/rebase checkpoints silently.

## Project layout

- `src/onecore/model.py`: shared recurrent multimodal architecture and trainable components.
- `src/onecore/data.py`: manifest contract, provenance classes, split validation and leakage checks.
- `src/onecore/train.py`: bounded resumable CPU trainer with manifest/asset fingerprints and parent checkpoint lineage.
- `src/onecore/checkpoint.py`: atomic checkpoints and integrity hashes.
- `src/onecore/evaluate.py`: separate validation/test evaluation and verified-data promotion gate.
- `src/onecore/inference.py`: shared-core text/image/audio/video and allowlisted tool-call inference.
- `src/onecore/bootstrap.py`: deterministic synthetic engineering curriculum; not a broad knowledge corpus.
- `src/onecore/tool_runtime.py`: safe allowlisted tool dispatcher; generated text is never executed as code.
- `src/onecore/audio.py`: log-mel preparation and approximate Griffin–Lim waveform decoder (not a production neural vocoder).
- `notebooks/`: six ordered research notebooks executed on GitHub Actions.
- `.github/workflows/onecore-*.yml`: isolated CI and serialized training workflows.

## First architecture budget and future expansion

The first experiment must contain 50–70M trainable parameters. The instantiated `phone-research.yaml` model is **57,579,201 parameters**, including all trainable image/audio/motion modules and counting the tied token embedding/output weight once. This is 8,192 below the earlier approximate target of 57,587,393 and is protected by an exact CI regression test.

Configuration: width 1024, four unique recurrent blocks, three recurrent cycles (12 block applications), eight attention heads, 4,096 text-token slots plus learned modality code ranges/special tokens, 8×8 RGB image patches, and 80-bin log-mel frames grouped by four.

100–150M is a later research phase, not a final ceiling. Expansion above 150M is possible only when independent quality, data coverage, compute, and lineage evidence justify it. Full precision remains the baseline; quantization follows a measured full-precision baseline.

## Dataset stages

The current deterministic bootstrap contains 360 training, 87 validation, and 87 test records. It exercises the pipeline only and is not broad world knowledge. The training iterator reads only `train.jsonl`; validation/test are separately hashed and checked for record-ID, asset-path, and exact asset-content leakage.

Data classes separate `bootstrap`, `synthetic_unverified`, `synthetic_verified`, `external_reviewed`, `external_staged`, and `owner_curated`. Every usable record in the train split enters tokenizer fitting and optimizer updates, including imported sources, bootstrap examples, synthetic curricula, and owner-created data. Validation and test preserve every available data class while remaining isolated from gradient updates. Reports show per-class contribution counts; promotion depends on independent held-out evaluation, modality coverage, and measured quality thresholds.


## GitHub-only training and checkpoint retention

Training runs in bounded segments of up to 250 optimizer steps per job. The request-file workflow is triggered by a commit changing `onecore-ai/training-request.json`; it pins the exact commit, runs CI, restores model/optimizer/scheduler/RNG/tokenizer state, and executes the selected notebook stage followed by validation/test evaluation. Checkpoints are Actions artifacts, not Git objects. The same job reruns `compileall`, the full pytest suite, six-notebook integrity validation, and workflow isolation/serialization checks before any optimizer step; a failed preflight blocks training.

Artifacts are retained for 90 days. Durable GitHub Release upload currently receives `403 Resource not accessible by integration` from the repository `GITHUB_TOKEN`; a release is skipped unless `ONECORE_RELEASE_TOKEN` is configured with `contents:write` access or repository/org Actions settings permit release writes. Training itself remains GitHub Actions-only and does not use paid/external hosts.

## Current research status

The earlier 10-step engineering run and 100-step synthetic-curriculum experiment are historical pipeline diagnostics only. The current data run starts from fresh random initialization and includes all usable records regardless of data class. Evaluation measures held-out codebook usage, entropy, perplexity, dead codes, and max-code concentration; promotion remains blocked until independent modality coverage and calibrated numeric quality thresholds are in place.

See `docs/training-operations.md`, `data/README.md`, and `notebooks/README.md` for operational details.
