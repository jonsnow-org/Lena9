# OneCore v3 architecture prototype

This package is a versioned architecture experiment. It does not modify or load v2
checkpoints. It is not yet a trained generator and must not be described as having
professional output quality.

## Implemented building blocks

- `vision.py`: variable-height/width patch tokenization; original aspect ratio and
  dimensions are preserved; edge padding is applied to the patch grid and cropped
  back to the exact source dimensions.
- `audio.py`: trainable convolutional waveform encoder/decoder with multi-stage
  residual vector quantization. It accepts mono or stereo waveforms, records the
  original channel count, accepts variable sample lengths, and trims reconstruction
  to the exact source length. Training input is strictly normalized to 24 kHz; raw-media
  ingestion preserves the source and creates a polyphase-resampled 24 kHz WAV derivative
  with source/target metadata. The neural codec rejects other rates rather than silently
  treating them as 24 kHz. The codec is untrained.
- `video.py`: encodes every supplied frame, accepts variable frame counts and
  timestamps, and applies causal temporal attention per spatial patch.
- `core.py`: integrates text, image, waveform audio and video latents with a recurrent
  shared Transformer semantic core (four unique blocks reused over three cycles by
  default), explicit modality embeddings, and independent image/audio/video flow heads;
  includes conditional rectified-flow objectives and variable-shape latent samplers.
- `losses.py`: multi-scale image reconstruction, multi-resolution STFT/waveform,
  video temporal consistency, paired cross-modal alignment, and image/audio GAN losses.
- `training.py`: joint text/tool/image/audio/video objective and an optimizer-step
  helper, plus a separate discriminator update helper.
- `manifest.py`: external-only per-family quotas, immutable provenance, source-row and
  asset SHA-256 split-integrity checks, and required raw-media payload validation.
- `converter.py` and `artifact.py`: selectively reuse V2 text/tool rows and rehydrate raw
  image/audio/video assets only from immutable source revisions and matching row hashes;
  the artifact reader extracts the existing V2 manifests with HTTP byte ranges rather than
  downloading the 15.8 GB artifact in full. `cli.py` exposes this bounded conversion path.
- `report.py` and `flops.py`: exact instantiated parameter count, config fingerprint, shape-aware dense forward FLOPs by modality, and storage-only estimates.
- `tokenizer.py`: V3-only byte-level BPE training from pinned external train-text records; fits the exact configured 32,000-token vocabulary, refuses synthetic/validation/test input, and publishes tokenizer JSON plus a SHA-256 evidence sidecar.
- `checkpoint.py`: an independent V3-only atomic checkpoint format binding model/optimizer/scheduler/global step to the exact V3 config, tokenizer JSON/hash/vocabulary, a freshly validated train/validation/test manifest+asset fingerprint, JSON cursor state, Python/NumPy/Torch CPU RNG and parent-checkpoint lineage.

## Architecture revision 2

The current prototype-2 config uses four unique Transformer blocks repeated for three
cycles, retaining twelve effective block applications while sharing the same four sets
of weights. Image, audio, and video rectified-flow prediction use separate modality
heads. This reduces duplicated backbone parameters and prevents the final velocity
projection from being shared across different latent distributions. It does not reduce
the attention compute of twelve block applications, and it is not a measured quality
or memory improvement until benchmarked.

## Current limits (do not hide these)

- Image quality is unmeasured. Patch decoding is a trainable codec baseline, not a
  production image diffusion/flow generator. High-resolution fidelity needs a
  hierarchical latent generator, perceptual/adversarial objectives, and tiled
  refinement.
- Audio quality is unmeasured. RVQ plus a neural decoder is structurally different
  from Griffin–Lim, but it is not a neural speech/music system until trained on
  licensed high-quality audio with spectral, waveform, perceptual and adversarial
  objectives and listening evaluations.
- Video quality is unmeasured. Variable duration is processed in bounded temporal
  windows with detached latent memory, and generation can yield decoded chunks.
  Cross-window memory is truncated, not full KV-cache attention; long clips still
  need synchronization data, motion objectives, and temporal consistency evaluation.
- The shared core creates dynamic sinusoidal positions and removes the learned
  fixed 512-position table. Attention is still quadratic; this is not proof of
  efficient long-context scaling. Benchmark memory, throughput, and long-context
  retrieval before selecting production sequence lengths.
- The independent V3 checkpoint/resume format, tiny-model full-lineage tests, and hash-pinned inference runtime/CLI are implemented. Runs #706–#710 all passed Verify on the active branch; #707/#708 specifically exercised text generation, image/audio/video output shapes, trusted checkpoint digest validation, untrained-checkpoint refusal, and BOS/EOS prompt handling. The real-artifact step-zero checkpoint audit is now wired into CI, but its corpus/tokenizer-backed job has not yet run; it proves no non-zero optimizer continuation until a later post-update audit. Corpus Run #605 and Tokenizer Run #2 are existing pinned artifacts and must not be regenerated. The early architecture verification reference is Run #620 (271 tests, 24 warnings); it is historical evidence, not the latest CI state. Runs #700 and #681 remain failed historical CPU benchmark attempts; no successful real-corpus CPU RSS/throughput evidence exists yet. The V3 optimizer job remains explicitly guarded; no optimizer training has started. See `../docs/EXECUTIVE_HANDOVER.md` for live branch, run, artifact and blocker state.
- The bounded corpus-restore job is manual-only: use `workflow_dispatch` and explicitly set `restore_v3_corpus=true`. Normal code pushes run Verify only. Restore uses the optional `corpus-restore` extra, CPU PyTorch 2.11 or newer, TorchCodec 0.17, and FFmpeg shared libraries; the job installs these explicitly and keeps Hugging Face media decoding disabled so the converter can preserve original encoded payloads and perform its own audio/video ingestion.
- The optional GAN discriminators require a separately configured discriminator
  optimizer and stable alternating updates; this is not yet a full adversarial trainer.
- The V3 five-family external manifest gate and final artifact publication completed successfully in Run #605. The tokenizer is a separate train-only CPU step and does not start model optimizer updates.

## Next required engineering gates

1. Preserve the successful Run #605 corpus artifact and Run #2 tokenizer artifact; do not repeat acquisition, media restoration, or tokenizer fitting for these exact hashes.
2. Measure peak CPU RSS and throughput on bounded samples from the validated real corpus. Record actual image dimensions, audio duration/rate/channels, video frame counts/timestamps, sequence lengths, CPU thread count and per-family forward/backward latency. Do not treat parameter-storage estimates or the dense-FLOP profile as memory or throughput measurements.
3. Run a full V3 checkpoint save/restore test bound to the real tokenizer JSON, validated manifest fingerprint, source cursors, config, RNG and parent lineage. Verify that a resumed child checkpoint preserves exact state and hashes; do not cross V2/V3 lineage.
4. Design the bounded multi-session CPU trainer only after resource and full checkpoint gates pass. It must preserve optimizer/scheduler/RNG/tokenizer/data-cursor lineage and remain separate from archived V2 workflows.
5. Complete the real-artifact step-zero checkpoint audit using the dedicated `audit_v3_checkpoint=true` CI input (or the one-shot commit marker `[run-v3-checkpoint-audit]`). This validates the real manifest/tokenizer/source-cursor snapshot with zero optimizer updates and zero media downloads. After the first approved optimizer update, add a distinct post-update checkpoint continuation audit with non-empty optimizer state and advanced cursors.
6. The hash-pinned inference runtime/CLI now exists (`onecore-v3-infer`) for text/image/audio/video. It refuses step-zero checkpoints by default. No production inference quality is claimed until the model is trained and independently evaluated.
7. Run independent text/tool/image/audio/video validation and held-out test evaluations bound to checkpoint, tokenizer, config and corpus hashes. No promotion threshold is inferred from training loss, and no professional-quality claim is allowed without human review.

V2 remains a frozen legacy baseline; its weights/checkpoints/optimizer/tokenizer are not imported into V3.

All output-quality claims require measured evidence tied to checkpoint, tokenizer,
codec, config and dataset-manifest hashes. No quality thresholds are inferred here.


### V3 tokenizer implementation — 2026-11-24

Added the independent `onecore.v3.tokenizer` module and `onecore-v3-tokenizer` package command:
- Reads the V3 train manifest only, selects `task=text`, uses the canonical external data-classifier (including external_staged/external_reviewed aliases), HTTP(S) source URL, immutable source revision and unique source-row SHA-256. Rejects bootstrap/synthetic/owner-curated rows, non-train records, duplicate IDs/source rows, short rows and invalid provenance.
- Fits byte-level BPE with NFC normalization and the exact `V3Config.text_vocab_size` (32,000 by default); it does not import V2 tokenizer vocabulary or files.
- Writes tokenizer JSON and a sidecar evidence document containing config/manifest/tokenizer SHA-256, text-row digest, actual vocabulary, special-token IDs and the external train-only contract. Existing artifacts are never overwritten.
- Adds a verifier that reloads the serialized tokenizer and rejects changed bytes, wrong vocabulary, invalid special-token IDs, config mismatch, missing evidence, non-external or non-train evidence, validation/test usage, and manifest mismatch.

Regression tests cover a tiny exact-vocabulary BPE fit, pinned external train-only filtering, invalid revision/row hashes/URLs, bootstrap rejection, special-token evidence and SHA-256 mismatch, output immutability and overwrite refusal. The tokenizer implementation/tests passed V3 Verify Run #608. Tokenizer workflow Run #2 (45336933362) subsequently fitted and verified the actual 32,000-token byte-level BPE from 591,525 external train-text rows only. Artifact 14894835517 contains tokenizer JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76` and evidence sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`. Validation/test rows used were zero; no V2 tokenizer was imported.


### V3 tokenizer request and execution — 2026-11-24

The dedicated workflow reads the successful Run #605 corpus artifact by immutable run and artifact IDs. It uses HTTP byte-range access to extract only `data/train.jsonl`; it does not download the 24.43 GB media archive. It fits and verifies the exact 32,000-token V3 byte-level BPE vocabulary with external train text only, then publishes tokenizer JSON and SHA-256 evidence as an Actions artifact. The workflow is idempotent and refuses to overwrite or silently refit an existing tokenizer artifact. This step does not perform model optimizer updates.


### Tokenizer fit diagnosis and corrective work — 2026-11-24

- Tokenizer workflow Run #1 (45336109095) passed source-artifact preflight and range-extracted only data/train.jsonl from artifact 14892594659. It did not download the 24.43 GB media archive and did not publish a tokenizer artifact.
- The fit step stopped on row hf-c4_ar-000d12d85c1a305d51f51aa4 because the tokenizer required the literal data_class string external. The shared data classifier already maps external_staged and external_reviewed to canonical external, and the V3 manifest gate uses that same classifier. The fix is to rely on external_record_is_trainable while retaining immutable source revision, row hash, HTTP(S) source URL and split checks.
- Verify Run #614 failed one test (260 passed): the artifact overwrite guard was checked after optional requests/remotezip dependency availability. The guard now checks an existing output path first, so refusing overwrite is deterministic even in the lean Verify environment.
- The existing tokenizer workflow is hardened to wait for successful Verify on the exact commit, validate the pinned corpus and report artifact digests/sizes, download only the small report, and recheck exact five-family coverage before the next fit attempt. This does not create another workflow or start optimizer training.


### V3 tokenizer fit — verified artifact

- Tokenizer workflow Run #2: `45336933362`, source corpus Run #605: `45325008221`.
- Actions artifact ID: `14894835517`, name `onecore-v3-tokenizer-run605-vocab32000`, size 394,036 bytes.
- ZIP SHA-256: `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- Tokenizer JSON SHA-256: `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`; evidence sidecar SHA-256: `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`.
- Exact vocabulary: 32,000; algorithm: byte-level BPE; normalization: NFC; external train text rows: 591,525; validation/test rows used: 0; V2 tokenizer imported: false.
- Train manifest SHA-256: `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external text-row SHA-256: `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`.
- The workflow range-extracted only `data/train.jsonl`; it did not download the 24.43 GB corpus archive or media assets.

### V3 dense FLOP accounting — CI verified

The new `onecore.v3.flops` counter derives operation counts from the instantiated Transformer, convolution, quantizer and projection module shapes. It counts two FLOPs per multiply-accumulate and reports only dense matrix-multiply/convolution arithmetic for the explicit reference workload below. The values are not a measured training-step cost or total instruction count.

| Path | Reference input | Dense forward FLOPs |
|---|---|---:|
| Text | 128 tokens | 14,260,633,600 |
| Tool | 128 tokens; same text path | 14,260,633,600 |
| Image | 256×256 RGB | 21,340,618,752 |
| Audio | 1 second, stereo, 24 kHz | 173,752,320,000 |
| Video | 13 frames, 256×256 RGB | 68,232,426,496 |
| Five-family forward sum | One micro-batch per family | 291,846,632,448 |

The sum is 0.291846632448 TFLOPs under this counting convention. It excludes bias additions, normalization, activations, softmax/masking, position generation, pooling/interpolation, RVQ distance reductions/argmin, losses, memory movement and backward propagation. The unconditioned flow-sampler reference is 21,072,708,608 dense FLOPs per step (674,326,675,456 for 32 steps); it excludes modality decoder FLOPs and is not a conditioned-generation measurement.

The profile is guarded by Verify Run #620 on implementation commit `01dedd7ccf05c2826230a8693402087bed2bf94c`. The same run passed **271 tests, 24 warnings**, compile, exact parameter/FLOP assertions, V2 contract checks, notebooks, FineWeb-2 cursor-resume and workflow isolation. This verifies the accounting implementation, not model quality or runtime performance.

### Remaining V3 gates

The next engineering work is a real-corpus CPU benchmark with measured peak RSS, per-family throughput and media/sequence shape distributions, followed by a full checkpoint save/restore bound to the actual tokenizer, manifest, data cursors and RNG lineage. The checkpoint tests currently use tiny fixtures; the real-corpus continuity gate has not yet been demonstrated. No optimizer training, V3 trainer, or production inference API has started.


### V3 held-out evaluation implementation — 2026-11-26

- Added `V3JointDataLoader.iter_evaluation_micro_batches`: deterministic external-only reservoir sampling from `validation` and `test` manifests; the train split is rejected explicitly. It reuses the same asset hash validation and modality materializers while preserving the training cursor snapshot.
- Added `evaluate_v3_heldout_splits`: reports per-family objective component means, per-split sample counts and record-ID digests, tied to checkpoint/config/manifest/tokenizer hashes. It runs under inference mode and checks RNG, model gradients, and train cursors remain unchanged. The report explicitly sets `optimizer_updates=0` and `quality_certified=false`.
- Evaluation is now bound to a non-zero-step `OneCoreV3Inference` loaded from a SHA-256-pinned checkpoint; it rejects step-zero checkpoints and mismatched loader config fingerprints. It no longer accepts a separate arbitrary model and unrelated checkpoint digest.
- Run #715 passed the initial held-out dataset/evaluator fixtures after aligning the tiny fixture's audio config to its stereo-capable samples. A stricter runtime/checkpoint-binding change is under the current Verify run.
- These are held-out objective diagnostics, not generated-output quality certification. Human/automatic task-specific evaluation and promotion evidence remain future work after training.

- The independent V3 checkpoint/resume format, tiny-model full-lineage tests, and hash-pinned inference runtime/CLI are implemented. Runs #706–#713 passed Verify; #707/#708 specifically exercised text generation, image/audio/video output shapes, trusted checkpoint digest validation, untrained-checkpoint refusal, and BOS/EOS handling. The real-artifact step-zero checkpoint audit passed in Run #713 and produced artifact 15114513841; it is initial-state serialization evidence only, not proof of non-zero optimizer continuation. Corpus Run #605 and Tokenizer Run #2 are the existing pinned artifacts and must not be regenerated. Runs #700 and #681 remain historical failed CPU benchmark attempts; no successful real-corpus CPU RSS/throughput evidence exists yet. The V3 optimizer job remains explicitly guarded; no optimizer training has started. See `../docs/EXECUTIVE_HANDOVER.md` for live branch, run, artifact and blocker state.
