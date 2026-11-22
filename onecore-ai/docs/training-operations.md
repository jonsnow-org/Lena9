# OneCore GitHub-only training operations

## Single source of truth and isolation

The only working branch is `research/onecore-foundation` in `jonsnow-org/Lena9`. All training, data generation, checkpointing, evaluation, and model-registry work runs on GitHub Actions CPU runners. Do not touch `main`, the Lena9 application, Ttbik, or any Sham model. The bootstrap and manually dispatched training workflows share the `onecore-training-v2` concurrency group with `cancel-in-progress: false`. A new request waits for the active run to release the lock; it must not cancel or overlap a training lineage.

## Request-file bootstrap and checkpointed training

A commit that changes `onecore-ai/training-request.json` triggers `OneCore — bounded acquisition and alternating CPU training` (`.github/workflows/onecore-bootstrap.yml`) on the research branch. The workflow checks out the triggering commit SHA, validates the request and corpus reference, and runs the compile/test/notebook/serialization preflight before any optimizer step. The `train_all` job has an explicit success guard: it starts only when `prepare` succeeded and either the dataset gate succeeded or it was intentionally skipped for `train_existing`.

Request fields:
- `stage`: `acquire`, `train_existing`, `repair_video_existing`, or `evaluate_existing`.
- `base_corpus_run_id` and `base_corpus_artifact_name`: the exact previously validated corpus snapshot.
- `start_fresh_joint_training`: `true` only for the initial random-weight run; set it to `false` when resuming a checkpoint.
- `steps`: optimizer updates per session, from 1 to 250; each session keeps the same checkpoint cadence.
- `jobs` and `total_optimizer_steps`: ten session slots per request. The segment update count must equal the number of sessions that will actually run multiplied by `steps`; interrupted resumes skip completed sessions, while a checkpoint from session 10 starts a fresh ten-session segment.
- `resume_checkpoint_run_id` and `resume_checkpoint_artifact_name`: optional paired values for the last completed session artifact.
- `resume_optimizer_step`: the exact cumulative optimizer step stored in that checkpoint; the first resumed action checks it against the checkpoint payload and report.
- `expected_final_optimizer_step`: the cumulative step expected after this segment; it must equal `resume_optimizer_step + total_optimizer_steps` and cannot exceed 20,000.
- `evaluate_existing`: an evaluation-only request with a paired checkpoint run/artifact, `resume_optimizer_step` set to the checkpoint's exact step, `expected_final_optimizer_step` set to the same value, and `total_optimizer_steps: 0`. It restores the exact corpus and checkpoint, runs the current evaluator on independent validation and test, and uploads evidence without training or promotion.

The bootstrap executes up to ten sequential sessions on one persistent CPU runner. A fresh lineage starts with the joint stage and Notebook 03; sessions 2–10 alternate multimodal Notebook 04 and Notebook 03. An interrupted segment resumes at the next session after its last completed checkpoint. A completed `onecore-state-train-10` checkpoint starts the next segment at session 1 using the multimodal stage and Notebook 03, preserving the same weights, optimizer, scheduler, RNG and tokenizer rather than reinitializing. Every joint/multimodal optimizer update contains one external micro-batch from each family: text, tool, image, audio, and video. `gradient_accumulation=4` applies only to text/smoke and does not replace the five micro-batches in a joint update. After each segment, Notebook 05 evaluates independent validation and held-out test splits from the same checkpoint/corpus; a separate job verifies the cumulative optimizer step, checkpoint SHA-256, five-family counts, external-only optimizer classes, parameter count, and T-LDM update count. Promotion remains blocked unless the independent quality gate passes.

Production validation/test evaluation in Notebook 05 and the `evaluate_existing` stage explicitly selects `data_classes={"external"}`. Bootstrap, synthetic, and owner-curated records may remain in manifests for engineering diagnostics, but they are excluded from model-quality metrics and cannot satisfy the promotion gate. Each training session also uploads a compact `onecore-state-train-NN-evidence` artifact containing `checkpoint-evidence.json`, `train_result.json`, and the acquisition report before parent cleanup. The sidecar makes the checkpoint SHA, optimizer step, lineage, tokenizer/manifest hashes, and five-family/data-class counts inspectable without downloading the large checkpoint archive.

The 20,000-step schedule can be completed without exceeding the 250-step/job ceiling: thirteen 1,500-update segments reach 19,500, then the final segment uses ten 50-step sessions to reach exactly 20,000. Each request declares its resume step and expected cumulative endpoint; the workflow rejects inconsistent arithmetic or a checkpoint whose saved step differs. Every child checkpoint upload is verified through the GitHub artifact record (run ID, non-expired state, non-zero size, and SHA-256 digest) before the parent artifact is removed. Do not reinitialize the lineage or reuse a checkpoint whose tokenizer provenance is missing or non-external.

The manual `OneCore — staged training` workflow remains available for operator use. It is distinct from the request-file bootstrap and uses the same non-cancelling lock.

## Reusing an existing corpus before acquisition

Set `stage` to `train_existing` in `onecore-ai/training-request.json` to reuse the previously validated `base_corpus_run_id` / `base_corpus_artifact_name` without starting acquisition. For an immutable corpus artifact that already passed the five-family 100/10/10 gate, the workflow skips repeating the full payload/split scan and proceeds directly to the selected training lineage. Run the data gate again only when the corpus artifact, manifests, assets, or source revisions have changed. If the original gate failed, repair only the missing family/split or the source-specific decoder rather than rerunning the entire registry.

For a corpus that is complete except for decoded video payloads, set `stage` to `repair_video_existing`. This restores the referenced snapshot and resumes only the saved `videos4camera_bench` cursor for a bounded 20-minute pass; all other crawlers stay skipped. The gate keeps the 100/10/10 thresholds. If more video work is needed, it uploads `onecore-corpus-video-repair-progress` in the current run; point the next request to that run and artifact to continue from the committed cursor. If diagnostics show video decode/conversion errors rather than low volume, retry from the original base artifact after applying the decoder fix, not from a cursor that may have passed unreadable rows.

## Native OneCore T-LDM objective

The training step computes both the normal causal next-token loss and a native masked-block diffusion loss. The latter is implemented by `OneCore.forward_tldm`: pooled latent context is refined by the same recurrent blocks, then masked positions are predicted with the tied vocabulary head. A contiguous target span is replaced by the reserved mask token before the forward pass. Default objective weight: `0.15`; configure through `training.tldm_diffusion_weight`.

Each joint optimizer update applies the same objective to the sampled text, tool, image, audio and video records. The checkpoint therefore contains one randomly initialized OneCore model and one optimizer lineage; there is no frozen donor or sidecar head. The native path adds zero parameters and preserves the exact architecture parameter count, but performs additional recurrent compute. CPU cost and held-out improvement will be reported by the actual run.

## Initial pipeline baseline

The earlier 10-step and 100-step runs used only synthetic engineering curricula. They remain historical diagnostics. The real-training lineage starts from random initialization and is restricted to external records for both tokenizer fitting and optimizer sampling; synthetic/bootstrap/owner-curated classes are excluded.

## Architecture and expansion

The instantiated architecture is guarded by the exact v2 parameter count; future scaling is allowed only with complete recomputation and retraining. The instantiated `phone-research.yaml` model is **57,579,201 parameters**, including all trainable image/audio/motion encoders and decoders and counting the tied token embedding/output weight once. This is 8,192 below the earlier approximate estimate; CI asserts the exact current count.

100–150M is a later research phase, not a final ceiling. Expansion above 150M remains possible only after quality, data coverage, compute, and checkpoint-lineage evidence justify it. Do not resize or migrate weights silently.

## Dataset stages and isolation

The deterministic engineering bootstrap currently yields 360 training records, 87 validation records, and 87 test records. All are tagged as `bootstrap` data. They exercise the pipeline only and are excluded from real tokenizer fitting and optimizer updates.

Only `train.jsonl` is read by the training iterator. Validation and test manifests are separate, have disjoint record IDs and asset paths, and are checked for identical asset-content hashes across splits. The bootstrap generator adds a missing test manifest without rewriting existing train/validation manifests. Training checkpoint lineage includes both the training-manifest SHA-256 and a fingerprint of the referenced training assets.

Only external records enter tokenizer fitting and optimizer input. Bootstrap, synthetic, and owner-curated classes remain excluded even when their payloads are structurally usable. Validation and test preserve independently held-out records but never enter tokenizer fitting or gradient updates. Production quality evaluation selects only external records from those splits; bootstrap/synthetic/owner-curated rows remain engineering-only.

## Multi-terabyte streaming crawlers and notebook resume

The acquisition path reads upstream datasets incrementally; it does **not** download the FineWeb-2 or The Stack v2 archives in full.

- FineWeb-2 is read through Hugging Face `IterableDataset` streaming from verified language shards. Enabled shards currently include Arabic dialects plus Turkish, German, French, Spanish, Portuguese, Indonesian, Japanese, and Russian. The English `eng_Latn` directory was checked and is not published in this repository, so it remains disabled rather than generating repeatable source failures.
- The Stack v2 source streams its metadata rows from the gated `bigcode/the-stack-v2` repository. License fields reported by the source are retained as provenance metadata and do not act as an acquisition gate. For each selected row, the crawler fetches only that blob from Software Heritage S3, decompresses it in memory, and applies the remaining language, generated/vendor-file, and secret-content filters before writing a text/code record. It never mirrors the complete S3 bucket.
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

Until both gates are satisfied, the source is reported as `optional_access_required`: it stays enabled and resumable, but it does not block the initial joint run when public sources independently pass the five-family coverage gate. If access is granted, the crawler fetches selected external file content regardless of the source-reported license field; no metadata-only rows are accepted and no Stack code is claimed as ingested before payload verification. License and repository attribution fields remain attached to each acquired record for downstream rights review; removing the technical filter does not itself establish permission to use a file for training. The source can later be incorporated through the existing append-only data-lineage path. The connected Hugging Face account currently does not have access to the gated dataset, so Stack v2 is a deferred corpus expansion rather than a current training dependency.


### Starting joint training without mirroring every upstream terabyte

The bootstrap separates **training readiness** from **source exhaustion**. A first joint run starts when the imported corpus has at least 100 usable external records for each of text, tool-use, image, audio and video in train, plus at least 10 in each independent validation and test split. This gate checks decoded payloads, not metadata rows. The sequential runner stops early if coverage passes or all enabled source quotas reach a terminal state; otherwise it saves the best cumulative artifact after up to six sessions and reports the exact run/artifact pair for continuation. If a notebook fails after a durable cursor/manifest commit, the action still attempts to package the last consistent corpus; if artifact upload fails, finalization preserves the previous known-good artifact. It does not claim every configured source's full upstream dataset is mirrored. Any unfinished source offsets, pending rows, pinned revisions and payload hashes remain in the corpus artifact for later continuation. The first run is a real, bounded joint-training segment over a verified streaming sample—not a claim that the complete 20+ TB FineWeb-2 collection or 67+ TB Stack v2 archive has been mirrored.

## Checkpoint integrity and retention

Checkpoint verification checks the internal SHA-256 against `train_result.json`, optimizer step and state, scheduler state, exact parameter count, tokenizer hash and tokenizer-corpus class counts, train-manifest hash, asset-manifest hash, combined training-data fingerprint, and parent checkpoint/run metadata. A legacy checkpoint without external-only tokenizer provenance is not eligible for the clean lineage. A checkpoint missing an asset fingerprint is not resumed unless an append-only importer proves continuity from the exact parent manifest and asset fingerprint.

Artifacts are retained for 90 days and remain the immediate resume source. Durable GitHub Release upload currently returns `403 Resource not accessible by integration` when using the repository `GITHUB_TOKEN`. The release step is therefore skipped unless the secret `ONECORE_RELEASE_TOKEN` is configured with repository `contents:write` access (or repository/org Actions settings permit release writes). No paid or external training host is involved.

## Promotion

Training completion or a lower loss is not readiness. Promotion requires an independently hashed validation and test bundle from the same checkpoint, full modality coverage, calibrated numeric thresholds for both splits, and no unacceptable regression. Evaluation reports per-codebook usage, perplexity, normalized entropy, dead codes, and max-code concentration for vision/audio/motion on both held-out splits. Collapse thresholds remain uncalibrated.


## Verified multi-step tool curriculum and behaviour evaluation

The final data-gate notebook appends a small, deterministic two-step calculator workflow to the train, validation, and test manifests, after external-source coverage has already been measured. Step two receives the exact result produced by the allowlisted calculator in step one. The reference solver independently reconstructs the expected calls, replays prior actions, checks the exact JSON payload, and verifies that the recorded prompt contains the matching execution trace. Writes are atomic and idempotent; split-specific price ranges and seeds prevent episode overlap. These examples are labelled `synthetic_verified`, cannot satisfy external-source requirements, and are excluded from model-quality evaluation and promotion.

Checkpoint evaluation now executes generated tool calls through the safe allowlisted runtime on a deterministic sample of held-out verified records. It reports valid-JSON, allowlisted-dispatch, exact-payload, and correct-execution rates, including separate statistics for steps one and two. The held-out contract supplies 10 tool-family records per split, so the gate requires at least 10 verified tool examples in each split and at least one observed example for each workflow step. The only approved regression floor is 0.90; absolute tool-success, loss, codebook, and T-LDM limits remain unapproved until measured on a real trained checkpoint. Synthetic tool episodes remain engineering-only and are excluded from external-only quality evaluation.

Tool inference now permits the trained `TOOL_END` and `EOS` markers and stops generation at either marker. Previously, generation was restricted to text-vocabulary IDs and could not emit the end marker used in tool-call training sequences, so output could run to the token cap and append invalid JSON. This is a runtime alignment fix, not a parameter-count or architecture change.


### Fixed-case regression gate for tool training

When a prior full evaluation is preserved as `run-state/evaluation.baseline.json`, promotion compares the candidate and baseline on the exact same deterministic held-out tool examples. The sample-set fingerprint, protocol, sample count, and per-step sample counts must match. Overall execution success and each step's success rate must retain at least 90% of the baseline; otherwise promotion is blocked even when language loss passes. The first from-scratch run can be evaluated without a baseline, but later candidate checkpoints should carry the previous approved evaluation into this path.
