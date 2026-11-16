# OneCore GitHub-only training operations

## Single source of truth and isolation

The only working branch is `research/onecore-foundation` in `jonsnow-org/Lena9`. All training, data generation, checkpointing, evaluation, and model-registry work runs on GitHub Actions CPU runners. Do not touch `main`, the Lena9 application, Ttbik, or any Sham model. Both training workflows share the non-cancelling `onecore-training` concurrency group.

## Staged request-file workflow

The scheduled supervisor changes `onecore-ai/training-request.json` on the research branch. That file alone triggers `OneCore — staged GitHub training`; the workflow checks out the exact triggering commit SHA, validates the request, restores the referenced checkpoint, verifies its hash and optimizer/scheduler state, and runs the full CI suite before training.

Request fields:
- `stage`: `text`, `multimodal`, or `evaluate`.
- `steps`: 1–250 optimizer steps per bounded segment.
- `resume_run_id`: numeric GitHub Actions run ID whose artifact is the parent checkpoint.
- `parent_run_id`: provenance run ID, normally the same as `resume_run_id`.

Each segment runs notebooks 00, 01, and 02 as gates. A text segment executes notebook 03; a multimodal segment executes notebook 04; notebook 05 evaluates validation and independent test splits after non-smoke training. The same shared model, optimizer, scheduler, tokenizer, RNG states, and checkpoint lineage continue across stages.

The manual `OneCore — staged training` workflow remains available for operator use. It is serialized with the same lock and runs CI and checkpoint verification before executing notebooks.

## Initial pipeline baseline

The earlier 10-step and 100-step runs used only synthetic engineering curricula. They remain historical diagnostics. The current all-data experiment starts from random initialization and includes every usable data class after the task-family and split-integrity gates pass.

## Architecture and expansion

The first architecture experiment must remain within 50–70M trainable parameters. The instantiated `phone-research.yaml` model is **57,579,201 parameters**, including all trainable image/audio/motion encoders and decoders and counting the tied token embedding/output weight once. This is 8,192 below the earlier approximate 57,587,393 target and remains within the agreed range; CI asserts the exact current count.

100–150M is a later research phase, not a final ceiling. Expansion above 150M remains possible only after quality, data coverage, compute, and checkpoint-lineage evidence justify it. Do not resize or migrate weights silently.

## Dataset stages and isolation

The deterministic engineering bootstrap currently yields 360 training records, 87 validation records, and 87 test records. All are tagged as `bootstrap` data. They exercise the pipeline and now participate in tokenizer fitting and optimizer updates alongside every other usable data class.

Only `train.jsonl` is read by the training iterator. Validation and test manifests are separate, have disjoint record IDs and asset paths, and are checked for identical asset-content hashes across splits. The bootstrap generator adds a missing test manifest without rewriting existing train/validation manifests. Training checkpoint lineage includes both the training-manifest SHA-256 and a fingerprint of the referenced training assets.

All available data classes enter tokenizer fitting and optimizer input when their payloads are usable. Validation and test preserve every available data class and remain isolated from gradient updates.

## Checkpoint integrity and retention

Checkpoint verification checks the internal SHA-256 against `train_result.json`, optimizer step and state, scheduler state, exact parameter count, tokenizer hash, manifest hash, asset hash, and parent checkpoint/run metadata. The initial legacy checkpoint did not record an asset fingerprint; the first continuation established one while preserving the old manifest hash.

Artifacts are retained for 90 days and remain the immediate resume source. Durable GitHub Release upload currently returns `403 Resource not accessible by integration` when using the repository `GITHUB_TOKEN`. The release step is therefore skipped unless the secret `ONECORE_RELEASE_TOKEN` is configured with repository `contents:write` access (or repository/org Actions settings permit release writes). No paid or external training host is involved.

## Promotion

Training completion or a lower loss is not readiness. Promotion requires an independently hashed validation and test bundle from the same checkpoint, full modality coverage, calibrated numeric thresholds for both splits, and no unacceptable regression. Evaluation reports per-codebook usage, perplexity, normalized entropy, dead codes, and max-code concentration for vision/audio/motion on both held-out splits. Collapse thresholds remain uncalibrated.
