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

## Multi-terabyte streaming crawlers and notebook resume

The acquisition path reads upstream datasets incrementally; it does **not** download the FineWeb-2 or The Stack v2 archives in full.

- FineWeb-2 is read through Hugging Face `IterableDataset` streaming from verified language shards. Enabled shards currently include Arabic dialects plus Turkish, German, French, Spanish, Portuguese, Indonesian, Japanese, and Russian. The English `eng_Latn` directory was checked and is not published in this repository, so it remains disabled rather than generating repeatable source failures.
- The Stack v2 source streams its metadata rows from the gated `bigcode/the-stack-v2` repository. For each row that passes the explicit SPDX permissive-license and language filters, the crawler fetches only that blob from Software Heritage S3, decompresses it in memory, rejects binary/oversized payloads, and writes a text/code training record. It never mirrors the complete S3 bucket.
- Each stream has an independent cursor at `data/resume-cache/crawlers/<notebook>/<source>/<split>.json`. The cursor is bound to the dataset repository, config, split, and pinned revision. Hugging Face `state_dict/load_state_dict` resumes at the shard/row position; the monotonic raw-row offset is retained as a fallback. The cursor is saved every 64 raw rows and again at session exit. Manifest IDs and the pending-row ledger make replay after a sudden runner stop idempotent.
- Text/code cursors belong to `03_text_pretraining`; image/audio/video cursors belong to `04_multimodal_curriculum`. Every bounded acquisition session executes Notebook 03 in acquisition-only mode for its enabled text/code sources, then Notebook 04 in acquisition-only mode for its enabled media sources; each calls `acquire_sources` with only its own source IDs and its own time slice. Notebook 02 then reads the shared report and runs integrity/task/split gates without rescanning either source family. The same notebooks later execute their training branches against the unified corpus and the same checkpoint.
- A scan limit or session timeout is reported as `partial`, never as source exhaustion. A required source cannot be reported as complete unless its configured minimum number of usable records has reached the manifest. A record containing only a Stack SWH/blob identifier is not a training example.

### Stack v2 access prerequisites

The Stack v2 dataset is gated. The Hugging Face token in GitHub Actions must have accepted access to `bigcode/the-stack-v2`. Fetching actual file contents also requires the Software Heritage/INRIA-approved AWS credentials. Configure these repository Actions secrets; values are never committed or printed:

- `HF_TOKEN` — an approved Hugging Face read token.
- `STACK_V2_AWS_ACCESS_KEY_ID`
- `STACK_V2_AWS_SECRET_ACCESS_KEY`
- `STACK_V2_AWS_SESSION_TOKEN` — only for temporary credentials.

Until both gates are satisfied, the source is explicitly reported as `access_required` and keeps the data gate closed. Do not substitute metadata-only rows or claim that The Stack code has been ingested. The current connected Hugging Face account did not have access to the gated dataset at the time of this change; the crawler is prepared but cannot be declared live against Stack v2 content until the repository secrets and dataset approval are present.

## Checkpoint integrity and retention

Checkpoint verification checks the internal SHA-256 against `train_result.json`, optimizer step and state, scheduler state, exact parameter count, tokenizer hash, manifest hash, asset hash, and parent checkpoint/run metadata. The initial legacy checkpoint did not record an asset fingerprint; the first continuation established one while preserving the old manifest hash.

Artifacts are retained for 90 days and remain the immediate resume source. Durable GitHub Release upload currently returns `403 Resource not accessible by integration` when using the repository `GITHUB_TOKEN`. The release step is therefore skipped unless the secret `ONECORE_RELEASE_TOKEN` is configured with repository `contents:write` access (or repository/org Actions settings permit release writes). No paid or external training host is involved.

## Promotion

Training completion or a lower loss is not readiness. Promotion requires an independently hashed validation and test bundle from the same checkpoint, full modality coverage, calibrated numeric thresholds for both splits, and no unacceptable regression. Evaluation reports per-codebook usage, perplexity, normalized entropy, dead codes, and max-code concentration for vision/audio/motion on both held-out splits. Collapse thresholds remain uncalibrated.
