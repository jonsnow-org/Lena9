# OneCore GitHub-only training operations

## Single source of truth and isolation

The only working branch is `research/onecore-foundation` in `jonsnow-org/Lena9`. All training, data generation, checkpointing, evaluation, and model-registry work runs on GitHub Actions CPU runners. Do not touch `main`, the Lena9 application, Ttbik, or any Sham model. The bootstrap and manually dispatched training workflows share the `onecore-training-v2` concurrency group. The bootstrap cancels an older in-progress bootstrap when a newer training request is submitted, preventing stale acquisition cycles from continuing in parallel.

## Staged request-file workflow

The scheduled supervisor changes `onecore-ai/training-request.json` on the research branch. That file alone triggers `OneCore — staged GitHub training`; the workflow checks out the exact triggering commit SHA, validates the request, restores the referenced checkpoint, verifies its hash and optimizer/scheduler state, and runs the full CI suite before training.

Request fields:
- `stage`: `text`, `multimodal`, or `evaluate`.
- `steps`: 1–250 optimizer steps per bounded segment.
- `resume_run_id`: numeric GitHub Actions run ID whose artifact is the parent checkpoint.
- `parent_run_id`: provenance run ID, normally the same as `resume_run_id`.

Each segment runs notebooks 00, 01, and 02 as gates. A text segment executes notebook 03; a multimodal segment executes notebook 04; notebook 05 evaluates validation and independent test splits after non-smoke training. The same shared model, optimizer, scheduler, tokenizer, RNG states, and checkpoint lineage continue across stages.

The manual `OneCore — staged training` workflow remains available for operator use. It is serialized with the same lock and runs CI and checkpoint verification before executing notebooks.

## Reusing an existing corpus before acquisition

Set `stage` to `train_existing` in `onecore-ai/training-request.json` to validate and train directly from the referenced `base_corpus_run_id` / `base_corpus_artifact_name`. This mode skips the acquisition job entirely. It restores the saved artifact once in the dataset-gate job, checks the five external task families and the independent train/validation/test splits, and proceeds to the existing 150-step from-scratch training chain only when the payload gate passes. If it fails, the gate reports the exact missing family/split counts; switch back to `acquire` only for the missing source families rather than rerunning the entire registry.

For a corpus that is complete except for decoded video payloads, set `stage` to `repair_video_existing`. This restores the referenced snapshot and resumes only the saved `videos4camera_bench` cursor for a bounded 20-minute pass; all other crawlers stay skipped. The gate keeps the 100/10/10 thresholds. If more video work is needed, it uploads `onecore-corpus-video-repair-progress` in the current run; point the next request to that run and artifact to continue from the committed cursor. If diagnostics show video decode/conversion errors rather than low volume, retry from the original base artifact after applying the decoder fix, not from a cursor that may have passed unreadable rows.

## Native OneCore T-LDM objective

The training step computes both the normal causal next-token loss and a native masked-block diffusion loss. The latter is implemented by `OneCore.forward_tldm`: pooled latent context is refined by the same recurrent blocks, then masked positions are predicted with the tied vocabulary head. A contiguous target span is replaced by the reserved mask token before the forward pass. Default objective weight: `0.15`; configure through `training.tldm_diffusion_weight`.

Each joint optimizer update applies the same objective to the sampled text, tool, image, audio and video records. The checkpoint therefore contains one randomly initialized OneCore model and one optimizer lineage; there is no frozen donor or sidecar head. The native path adds zero parameters and preserves the exact architecture parameter count, but performs additional recurrent compute. CPU cost and held-out improvement will be reported by the actual run.

## Initial pipeline baseline

The earlier 10-step and 100-step runs used only synthetic engineering curricula. They remain historical diagnostics. The current all-data experiment starts from random initialization and includes every usable data class after the task-family and split-integrity gates pass.

## Architecture and expansion

The instantiated architecture is guarded by the exact v2 parameter count; future scaling is allowed only with complete recomputation and retraining. The instantiated `phone-research.yaml` model is **57,579,201 parameters**, including all trainable image/audio/motion encoders and decoders and counting the tied token embedding/output weight once. This is 8,192 below the earlier approximate the discarded approximate parameter estimate target and remains within the agreed range; CI asserts the exact current count.

100–150M is a later research phase, not a final ceiling. Expansion above 150M remains possible only after quality, data coverage, compute, and checkpoint-lineage evidence justify it. Do not resize or migrate weights silently.

## Dataset stages and isolation

The deterministic engineering bootstrap currently yields 360 training records, 87 validation records, and 87 test records. All are tagged as `bootstrap` data. They exercise the pipeline and now participate in tokenizer fitting and optimizer updates alongside every other usable data class.

Only `train.jsonl` is read by the training iterator. Validation and test manifests are separate, have disjoint record IDs and asset paths, and are checked for identical asset-content hashes across splits. The bootstrap generator adds a missing test manifest without rewriting existing train/validation manifests. Training checkpoint lineage includes both the training-manifest SHA-256 and a fingerprint of the referenced training assets.

All available data classes enter tokenizer fitting and optimizer input when their payloads are usable. Validation and test preserve every available data class and remain isolated from gradient updates.

## Multi-terabyte streaming crawlers and notebook resume

The acquisition path reads upstream datasets incrementally; it does **not** download the FineWeb-2 or The Stack v2 archives in full.

- FineWeb-2 is read through Hugging Face `IterableDataset` streaming from verified language shards. Enabled shards currently include Arabic dialects plus Turkish, German, French, Spanish, Portuguese, Indonesian, Japanese, and Russian. The English `eng_Latn` directory was checked and is not published in this repository, so it remains disabled rather than generating repeatable source failures.
- The Stack v2 source streams its metadata rows from the gated `bigcode/the-stack-v2` repository. For each row that passes the explicit SPDX permissive-license and language filters, the crawler fetches only that blob from Software Heritage S3, decompresses it in memory, rejects binary/oversized payloads, and writes a text/code training record. It never mirrors the complete S3 bucket.
- Each stream has an independent cursor at `data/resume-cache/crawlers/<notebook>/<source>/<split>.json`. The cursor is bound to the dataset repository, config, split, and pinned revision. Hugging Face `state_dict/load_state_dict` resumes at the shard/row position; the monotonic raw-row offset is retained as a fallback. The cursor state is captured while reading, but committed to disk only after the corresponding manifest records and pending/payload files have been durably written. If the runner is interrupted before that data commit, the next session replays from the previous cursor rather than skipping uncommitted records. Manifest IDs and the pending-row ledger make replay after a sudden runner stop idempotent.
- When a restored corpus contains only a large legacy row offset and no compatible HF `state_dict`, the crawler avoids an unbounded `dataset.skip(offset)`. For offsets above 5,000 rows it replays from the start, matches the immutable source-row SHA against existing manifests/pending rows before payload conversion, then commits the current HF state cursor after manifest durability. This one-time compatibility replay preserves existing records and avoids re-downloading their media payloads. Each source emits elapsed time, rows read, records accepted and legacy replay splits to the job log.
- Text/code cursors belong to `03_text_pretraining`; image/audio/video cursors belong to `04_multimodal_curriculum`. The bootstrap restores the prior corpus once, then runs up to six bounded acquisition sessions sequentially on the same CPU runner. Each session executes Notebook 03 in acquisition-only mode for its enabled text/code sources and Notebook 04 for its enabled media sources; each source receives a resumable 60-second slice inside the 270-second notebook window, with required FineWeb Arabic and Stack v2 corpora sorted ahead of optional sources. When a source slice expires, only that source is marked partial and its next session resumes from its committed cursor; the notebook continues through remaining sources. The runner checks five-family payload coverage after each session, but does not run the full Notebook 02 integrity scan repeatedly. Once coverage passes, Notebook 02 runs once in the final dataset-gate job to validate payloads, train/validation/test isolation and split integrity. The runner packages and uploads one cumulative corpus artifact after the bounded session loop, rather than downloading and re-uploading the full corpus between each session.
- A scan limit or session timeout is reported as `partial`, never as source exhaustion. A required source cannot be reported as complete unless its configured minimum number of usable records has reached the manifest. A record containing only a Stack SWH/blob identifier is not a training example.

### Stack v2 access prerequisites

The Stack v2 dataset is gated. The Hugging Face token in GitHub Actions must have accepted access to `bigcode/the-stack-v2`. Fetching actual file contents also requires the Software Heritage/INRIA-approved AWS credentials. Configure these repository Actions secrets; values are never committed or printed:

- `HF_TOKEN` — an approved Hugging Face read token.
- `STACK_V2_AWS_ACCESS_KEY_ID`
- `STACK_V2_AWS_SECRET_ACCESS_KEY`
- `STACK_V2_AWS_SESSION_TOKEN` — only for temporary credentials.

Until both gates are satisfied, the source is reported as `optional_access_required`: it stays enabled and resumable, but it does not block the initial joint run when public sources independently pass the five-family coverage gate. If access is granted, the crawler fetches real licensed file content; no metadata-only rows are accepted and no Stack code is claimed as ingested before payload verification. The source can later be incorporated through the existing append-only data-lineage path. The connected Hugging Face account currently does not have access to the gated dataset, so Stack v2 is a deferred corpus expansion rather than a current training dependency.


### Starting joint training without mirroring every upstream terabyte

The bootstrap separates **training readiness** from **source exhaustion**. A first joint run starts when the imported corpus has at least 100 usable external records for each of text, tool-use, image, audio and video in train, plus at least 10 in each independent validation and test split. This gate checks decoded payloads, not metadata rows. The sequential runner stops early if coverage passes or all enabled source quotas reach a terminal state; otherwise it saves the best cumulative artifact after up to six sessions and reports the exact run/artifact pair for continuation. If a notebook fails after a durable cursor/manifest commit, the action still attempts to package the last consistent corpus; if artifact upload fails, finalization preserves the previous known-good artifact. It does not claim every configured source's full upstream dataset is mirrored. Any unfinished source offsets, pending rows, pinned revisions and payload hashes remain in the corpus artifact for later continuation. The first run is a real, bounded joint-training segment over a verified streaming sample—not a claim that the complete 20+ TB FineWeb-2 collection or 67+ TB Stack v2 archive has been mirrored.

## Checkpoint integrity and retention

Checkpoint verification checks the internal SHA-256 against `train_result.json`, optimizer step and state, scheduler state, exact parameter count, tokenizer hash, manifest hash, asset hash, and parent checkpoint/run metadata. The initial legacy checkpoint did not record an asset fingerprint; the first continuation established one while preserving the old manifest hash.

Artifacts are retained for 90 days and remain the immediate resume source. Durable GitHub Release upload currently returns `403 Resource not accessible by integration` when using the repository `GITHUB_TOKEN`. The release step is therefore skipped unless the secret `ONECORE_RELEASE_TOKEN` is configured with repository `contents:write` access (or repository/org Actions settings permit release writes). No paid or external training host is involved.

## Promotion

Training completion or a lower loss is not readiness. Promotion requires an independently hashed validation and test bundle from the same checkpoint, full modality coverage, calibrated numeric thresholds for both splits, and no unacceptable regression. Evaluation reports per-codebook usage, perplexity, normalized entropy, dead codes, and max-code concentration for vision/audio/motion on both held-out splits. Collapse thresholds remain uncalibrated.


## Verified multi-step tool curriculum and behaviour evaluation

The final data-gate notebook appends a small, deterministic two-step calculator workflow to the train, validation, and test manifests, after external-source coverage has already been measured. Step two receives the exact result produced by the allowlisted calculator in step one. The reference solver independently reconstructs the expected calls, replays prior actions, checks the exact JSON payload, and verifies that the recorded prompt contains the matching execution trace. Writes are atomic and idempotent; split-specific price ranges and seeds prevent episode overlap. These examples are labelled `synthetic_verified` and cannot satisfy external-source requirements.

Checkpoint evaluation now executes generated tool calls through the safe allowlisted runtime on a deterministic sample of held-out verified records. It reports valid-JSON, allowlisted-dispatch, exact-payload, and correct-execution rates, including separate statistics for steps one and two. The promotion gate requires at least 16 behavioural examples, at least four examples for each workflow step, and separately approved validation/test minima for executed tool success. Numeric thresholds remain deliberately unapproved until measured on a real trained checkpoint.

Tool inference now permits the trained `TOOL_END` and `EOS` markers and stops generation at either marker. Previously, generation was restricted to text-vocabulary IDs and could not emit the end marker used in tool-call training sequences, so output could run to the token cap and append invalid JSON. This is a runtime alignment fix, not a parameter-count or architecture change.


### Fixed-case regression gate for tool training

When a prior full evaluation is preserved as `run-state/evaluation.baseline.json`, promotion compares the candidate and baseline on the exact same deterministic held-out tool examples. The sample-set fingerprint, protocol, sample count, and per-step sample counts must match. Overall execution success and each step's success rate must retain at least 90% of the baseline; otherwise promotion is blocked even when language loss passes. The first from-scratch run can be evaluated without a baseline, but later candidate checkpoints should carry the previous approved evaluation into this path.
