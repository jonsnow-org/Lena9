# OneCore AI — from-scratch compact general intelligence

**One unified, multimodal research model initialized randomly from scratch.** No pretrained model weights, adapters, teacher-model outputs, or model downloads are used.

OneCore is isolated under `onecore-ai/` in `jonsnow-org/Lena9` and actively developed only on `research/onecore-v3-implementation`. The `research/onecore-foundation` branch is a frozen V2 legacy/reference archive. V3 corpus restoration and tokenizer fitting are bounded data-preparation operations; no optimizer training starts before tokenizer, checkpoint and measured CPU-resource gates pass.

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

- The active and only OneCore product architecture is `onecore-v3-prototype-2`: one shared semantic core with image/audio/video codecs and modality-specific flow heads. V2 is a frozen legacy/reference archive; no V2 weights, checkpoints, optimizer state, tokenizer, or model manifests are imported into V3.
- Exact V3 budget: **39,906,568 trainable parameters**, 123 state-dict tensors; config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`. Parameter and optimizer-storage arithmetic are not peak CPU memory.
- The V3 external-only corpus gate passed in Run #605. Corpus artifact 14892594659 is 24,432,975,285 bytes (SHA-256 `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`); report artifact 14893020087 is 892,194 bytes (SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`). Coverage is audio/image/text/tool/video = 1100/900/591525/14000/100 train, 165/10/22552/400/10 validation, and 148/10/22758/400/10 test. The 1,302 non-external rows and 37 unmatched extra legacy rows remain explicit audit counts; errors and synthetic additions were zero.
- The V3 tokenizer is now actually fitted and independently verified. Tokenizer workflow Run #2 (45336933362) published artifact 14894835517 (394,036 bytes; ZIP SHA-256 `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`). It contains a 32,000-entry byte-level BPE vocabulary: tokenizer JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`; evidence sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`. Evidence binds 591,525 external train-text rows, train manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`, and external text-row SHA-256 `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`; validation/test rows used = 0 and V2 tokenizer import = false. The 24.43 GB corpus ZIP was not downloaded for fitting; only the train manifest was range-extracted.
- Exact V3 dense forward FLOPs are now computed from instantiated module shapes and guarded by CI. Reference workload: batch 1 per micro-batch; text/tool 128 tokens each; image 256×256; stereo audio 24,000 samples at 24 kHz; video 13 frames at 256×256. Results: text 14,260,633,600; tool 14,260,633,600; image 21,340,618,752; audio 173,752,320,000; video 68,232,426,496; five-family forward sum 291,846,632,448 FLOPs (0.291846632448 TFLOPs). This is the exact counted dense matrix-multiply/convolution arithmetic for those reference shapes, at 2 FLOPs per multiply-accumulate. It excludes bias additions, normalization, activations, softmax, position generation, pooling/interpolation, RVQ reductions/argmin, losses, memory movement and backward propagation. It is not a measured training-step FLOP count, corpus shape distribution, throughput result, or quality result.
- V3 checkpoint format version 1 is independent from V2 and stores model/optimizer/scheduler/global step, config+fingerprint, tokenizer bytes/hash/vocabulary, validated manifest fingerprint, data cursors, Python/NumPy/Torch CPU RNG and parent lineage. Tiny-model round-trip and mismatch tests passed in canonical Verify; a full checkpoint run bound to the actual 24.43 GB corpus and all raw assets is not yet evidenced.
- Canonical Verify Run #620 (45345949288) passed on implementation head `01dedd7ccf05c2826230a8693402087bed2bf94c`: **271 passed, 24 warnings**. Compile, exact V3 parameter/FLOP assertions, V2 specification contract, architecture notebook, safe notebook preflights, FineWeb-2 cursor resume, all notebooks and workflow-isolation checks passed. Run #619's single failure was a test referencing the pre-nesting flow-report shape; the test was corrected in `01dedd7` and Run #620 passed.
- The Foundation archive remains at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; its Verify Run #613 passed. `main` remains unchanged at `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No V3 training, optimizer update, PR, or merge to main has occurred.
- The existing manual CPU profiler now also runs a bounded joint five-family backward pass (one real external train micro-batch per family) and preallocates AdamW moment tensors for every trainable parameter without calling optimizer.step or changing weights. It reports the joint peak RSS and optimizer-state footprint; no resource artifact exists until the manual benchmark is dispatched.
- **Still blocked:** peak CPU RSS and real-data throughput have not been measured; real image/audio/video dimension-duration distributions have not been profiled; complete checkpoint save/restore against the actual validated corpus and tokenizer has not been run; no bounded V3 multi-session trainer or production inference API exists. Do not start optimizer training until these gates are evidenced. Image/audio/video quality remains unmeasured and requires independent held-out evaluation and human review.
