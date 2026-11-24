# OneCore AI — from-scratch compact general intelligence

**One unified, multimodal research model initialized randomly from scratch.** No pretrained model weights, adapters, teacher-model outputs, or model downloads are used.

OneCore is isolated under `onecore-ai/` in `jonsnow-org/Lena9` and developed only on `research/onecore-foundation`. Workflows are path-filtered and pinned to their triggering commit. The request-file training workflow uses the shared, non-cancelling `onecore-training-v2` lock; a newer request does not cancel an active training lineage.

## Canonical OneCore architecture policy

OneCore is **one multimodal model**, not separate V2 and V3 products. The active architecture is V3 on `research/onecore-v3-implementation`: one shared semantic Transformer processes text/tool tokens and the aligned image, audio and video latents, with modality-specific codecs and generation heads inside the same model. The Foundation branch records the historical V2 baseline; it is frozen for compatibility and audit, not a parallel active product or optimizer-training line.

V2's exact 57,579,201-parameter contract, 5,144 vocabulary, 1,024 width and associated checkpoint lineage apply only to V2. V3 has its own architecture/config fingerprint and must compute its own parameter/FLOPs/resource contract. Never copy V2 weights, checkpoint state, optimizer/scheduler state, tokenizer, or manifests into V3. The bounded V2-to-V3 corpus converter is a data-only path: it reuses eligible external text/tool rows and rehydrates original media from exact pinned source revisions; it never imports V2 model weights.

The V2 training instructions below are retained for historical traceability only. The canonical V3 branch disables the legacy V2 optimizer workflow. V3 training must use its own 32,000-token tokenizer, independent checkpoint/resume lineage and measured CPU resource envelope after the external-only corpus gate passes.

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

## V2 legacy architecture budget and future expansion

The instantiated architecture is guarded by the exact v2 parameter count; future scaling is allowed only with complete recomputation and retraining. The instantiated `phone-research.yaml` model is **57,579,201 parameters**, including all trainable image/audio/motion modules and counting the tied token embedding/output weight once. This is 8,192 below the earlier approximate estimate; CI asserts the exact current count.

Configuration: width 1024, four unique recurrent blocks, three recurrent cycles (12 block applications), eight attention heads, 4,096 text-token slots plus learned modality code ranges/special tokens, 8×8 RGB image patches, and 80-bin log-mel frames grouped by four.

100–150M is a later research phase, not a final ceiling. Expansion above 150M is possible only when independent quality, data coverage, compute, and lineage evidence justify it. Full precision remains the baseline; quantization follows a measured full-precision baseline.

## V2 legacy latent-diffusion reasoning (OneCore T-LDM)

OneCore now includes a native latent-compression / recurrent-thinking / discrete-diffusion path. It is **not** the Sham 2 head copied into this repository: OneCore has no donor body, frozen external checkpoint, LoRA, teacher model, or imported T-LDM weights.

- The compressor pools OneCore's own learned token, position, and modality states into at most 16 latent slots.
- The latent thinker runs those slots through OneCore's own recurrent Transformer blocks.
- The writer expands the latent context, refines masked shared-vocabulary token blocks over multiple passes, and uses the same tied OneCore LM head.
- Training combines the ordinary causal objective with a masked-block diffusion objective (default weight 0.15) across the shared token stream, including modality codes.

The path adds **zero trainable parameters**. Compressor, thinker, and writer reuse the existing embeddings, recurrent blocks, and tied output head; the exact 57,579,201-parameter baseline remains unchanged. It increases compute during the diffusion path, so CPU latency and quality must be measured rather than assumed. See `docs/native-tldm.md`.

## Dataset stages

The current deterministic bootstrap contains 360 training, 87 validation, and 87 test records. It exercises the pipeline only and is not broad world knowledge. The training iterator reads only `train.jsonl`; validation/test are separately hashed and checked for record-ID, asset-path, and exact asset-content leakage.

Data classes separate `bootstrap`, `synthetic_unverified`, `synthetic_verified`, `external_reviewed`, `external_staged`, and `owner_curated`. Real tokenizer fitting and optimizer updates are restricted to `external` train records only. Bootstrap, synthetic, and owner-curated records remain available for engineering tests and diagnostics but are excluded from the real tokenizer corpus and optimizer inputs. Validation and test stay in independent manifests and never enter gradient updates. Production validation/test quality metrics select external records only; bootstrap, synthetic, and owner-curated records remain engineering-only and are excluded from model-quality evaluation. Reports distinguish source inventory, tokenizer-corpus provenance, and actual optimizer contributions.


## Historical V2 training and checkpoint retention (reference only)

The request-file workflow is triggered only by a commit changing `onecore-ai/training-request.json` on `research/onecore-foundation`. It checks out that exact commit and uses the non-cancelling `onecore-training-v2` lock; a newer request does not interrupt an active lineage. The prepare job runs `compileall`, the full pytest suite, six-notebook integrity validation, and workflow isolation/serialization checks before any optimizer step. Training requests contain ten sequential bounded sessions (1–250 optimizer steps per session; normally 150) on one persistent CPU runner. `total_optimizer_steps` describes the updates actually remaining after the resume point. With `stage: train_existing`, the workflow reuses the already-validated corpus and skips acquisition and the already-passed data gate. With `stage: evaluate_existing`, it restores the exact checkpoint and corpus, requires zero optimizer updates, and runs independent validation/test plus evidence upload without candidate promotion. A clean lineage starts from random weights and fits its tokenizer from external train records only. An interrupted checkpoint from session 1–9 resumes at the next session; a completed `onecore-state-train-10` checkpoint starts the next segment at session 1 using the multimodal stage and Notebook 03, preserving model, optimizer, scheduler, RNG, and tokenizer state. Each session verifies the parent checkpoint hash, exact optimizer-step delta, and provenance. The child artifact is checked for the current run ID, non-expired state, non-zero size, and SHA-256 digest before its parent artifact is removed. A compact companion evidence artifact publishes `checkpoint-evidence.json`, `train_result.json`, and the acquisition report for inspection without downloading the large checkpoint archive. The final evaluation verifies the cumulative optimizer step, checkpoint SHA-256, five-family counts, external-only optimizer counts, parameter count, and T-LDM updates. The full 20,000-step schedule is thirteen 1,500-update segments plus a final 500-update segment (ten 50-step sessions). The manual staged workflow retains the 250-step per-job ceiling. Checkpoints are Actions artifacts, not Git objects.

Artifacts are retained for 90 days. Durable GitHub Release upload currently receives `403 Resource not accessible by integration` from the repository `GITHUB_TOKEN`; a release is skipped unless `ONECORE_RELEASE_TOKEN` is configured with `contents:write` access or repository/org Actions settings permit release writes. Training itself remains GitHub Actions-only and does not use paid/external hosts.

## Historical V2 research status

The earlier 10-step engineering run and 100-step synthetic-curriculum experiment are historical pipeline diagnostics only. The clean real-training path is required to use a fresh random initialization and an external-only tokenizer corpus plus external-only optimizer samples. Any checkpoint whose tokenizer-corpus provenance is missing or includes bootstrap/synthetic/owner-curated records is not eligible for continuation in the clean lineage. Evaluation measures held-out codebook usage, entropy, perplexity, dead codes, and max-code concentration; promotion remains blocked until independent modality coverage and approved quality thresholds are in place.

See `docs/corrected-spec-v2.md` for the exact engineering contract; `docs/training-operations.md`, `data/README.md`, and `notebooks/README.md` contain operational details.


## Active OneCore V3 engineering status

- The active architecture is `onecore-v3-prototype-2`, with one shared semantic core (four unique Transformer blocks reused over three cycles) and image/audio/video modality codecs/flow heads.
- The current exact instantiated budget is 39,906,568 trainable parameters with config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`. Storage estimates are not peak memory and are not a resource benchmark.
- The V3 external-only corpus manifest gate passed the five-family 100/10/10 minimums in Run #602; the current Run #605 is repeating publication after the gate-semantics correction. No V3 model checkpoint or V3 training run has been approved.
- Remaining requirements: publish the final corpus artifact; run CI on the V3 checkpoint and tokenizer regression suites; then fit and verify the V3-native 32,000-token tokenizer from external train text; measure peak CPU RSS/throughput on the validated corpus; recompute exact V3 FLOPs; then build a bounded multi-session CPU trainer and V3 inference API. The tokenizer fit/verify utility is implemented but has not yet been run on the final corpus.
- V3 codecs remain untrained and quality is unmeasured. Do not call the model production-ready or claim professional media generation until independent, checkpoint-bound evaluation establishes it.

