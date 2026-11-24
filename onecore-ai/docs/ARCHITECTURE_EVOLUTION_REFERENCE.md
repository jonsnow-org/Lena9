# OneCore — Architecture Evolution & Engineering Execution Reference

**Status:** Active engineering baseline / living reference  
**Applies to:** `research/onecore-foundation` and every subsequent OneCore engineering session  
**Supersedes:** Any interpretation that treats the current 64×64 image, four-frame video, 512-token context, or Griffin–Lim waveform path as final product requirements.  
**Source baseline:** Corrected Specification v2, source revision `2a6118a`; repository inspection on 2026-11-22.  
**Safety rule:** Do not merge to `main`, start a new full training run, or overwrite existing checkpoint lineage until the gates in this document pass.

---

## 1. Executive decision

The current OneCore implementation is a useful compact multimodal research prototype, not yet a professional image/video/audio generative model. Its existing limitations are implementation choices, not user requirements:

- Images are normalized to a fixed 64×64 tensor and represented by 8×8 patches (64 visual tokens).
- Video records are rejected above `max_video_frames=4`; frame and motion tokens consume a fixed 512-token sequence budget.
- Audio is represented as 80-bin log-mel features grouped four frames at a time. The waveform helper uses a pseudoinverse mel bank plus 24-iteration Griffin–Lim. Its own docstring explicitly describes it as a deterministic research/smoke-test decoder, not a neural vocoder.
- The model has a 512-position embedding and a single 5,144-token vocabulary. Its shared Transformer and T-LDM reuse the same four blocks; the present T-LDM is a masked-token refinement path, not a complete high-quality pixel/video/audio diffusion system.
- Current image/audio/motion codecs are shallow linear projections around vector quantization. They are not perceptual image, neural audio, or temporal video decoders.

**Decision:** Preserve the current implementation and checkpoint lineage as a baseline; evolve OneCore through a new, explicitly versioned architecture with variable-resolution visual tokenization, temporally scalable video, a learned neural audio codec/decoder, longer-context sequence handling, and dedicated modality generation heads/decoders connected to a shared semantic core. Do not disguise a new architecture as a config-only change.

A shared core does not require every modality to use the same low-capacity decoder. The intended design is shared semantic reasoning plus modality-specific encoders/decoders and generation objectives, with explicit cross-modal alignment.

## 2. What the supplied Corrected Specification v2 actually establishes

The PDF is an engineering correction pack, not a statement of the user's desired final capability. It explicitly says scaling is allowed and explains that changing width, depth, vocabulary, image size, or sequence length creates a new architecture requiring full recomputation and retraining.

Verified current values:
- 57,579,201 trainable parameters; width 1,024; four unique blocks reused over three cycles; eight attention heads; vocabulary 5,144; max sequence 512.
- Joint update consists of five micro-batches, one per text/tool/image/audio/video family.
- 20,000 optimizer steps, 200 warmup, AdamW, peak LR 3e-4, cosine schedule with 10% floor; T-LDM coefficient 0.15.
- Image path: 64×64 RGB, patch size 8, 64 visual tokens.
- Audio path: 80-bin log-mel, four frames per audio token; Griffin–Lim approximate waveform reconstruction.
- Video path: at most four frames; the maximum video representation leaves only 52 tokens for its caption at sequence length 512.
- FP16/INT8/4-bit figures in the pack are storage estimates only; the repository does not thereby have tested quantized inference kernels.
- Promotion is separate from scaling. Promotion thresholds remain unapproved and cannot be invented.

**Interpretation:** Do not treat the 20k-step schedule as a quality guarantee. It trains the architecture that exists. It cannot teach capabilities that the architecture and data path cannot represent.

## 3. Repository findings (source-level)

The following are code facts observed on `research/onecore-foundation`:

1. `onecore-ai/src/onecore/acquire.py::_save_image` resizes every ingested image to exactly 64×64.
2. `onecore-ai/src/onecore/train.py::_load_image` again resizes images to `cfg.image_size`; `_record_sequence` encodes one fixed-size image into visual codes.
3. The video branch in `_record_sequence` rejects records with more than `cfg.max_video_frames`; current config sets this to 4. It encodes frames and simple adjacent-frame pixel differences, not a temporal generative model.
4. `onecore-ai/src/onecore/config.py::ModelConfig` fixes image size, patch size, audio group size and max video frames as architecture dimensions. The image codec input width is derived from `patch_size² × 3`; changing patch size changes parameter shapes.
5. `onecore-ai/src/onecore/audio.py::log_mel_to_waveform` is pseudoinverse + Griffin–Lim, and `decode_audio_codes` calls that approximate helper.
6. `onecore-ai/src/onecore/acquire.py::task_coverage` is now corrected on the current branch: it requires `external_record_is_trainable(record)` as well as a usable payload. That correction was not present in the code used by Run #48 (`5489900`) or Run #51 (`4186226`). Run #48's green 100/10/10 gate therefore counted usable bootstrap/synthetic rows and is not evidence of external-only quotas. Run #51's `train.py` did restrict tokenizer and optimizer inputs to `external`, but its `train_existing` path skipped the corrected dataset gate. The optimizer lineage is external-only; the corpus's per-family 100/10/10 eligibility remains unproven until audited with the corrected code.
7. Existing `data.py` already exposes `classify_record_data` and immutable provenance checks; use those shared definitions rather than inventing a second provenance classifier.
8. Current `expected_parameter_count` is shape-derived and strictly checked. Any architecture version that changes dimensions must calculate a new exact parameter count, config hash and checkpoint lineage.

## 4. Target architecture (proposed; not falsely represented as implemented)

### 4.1 Shared semantic core
- Retain a shared autoregressive/sequence reasoning core for text, tool plans, modality descriptions and aligned multimodal latent sequences.
- Add scalable positional treatment suitable for variable sequence lengths (e.g. RoPE with a measured extension strategy, or another explicitly benchmarked method); do not simply enlarge a learned position table and assume extrapolation.
- Add KV caching for inference and measure long-context memory/latency.
- Keep tool execution outside the weights behind the existing explicit runtime allowlist and permission boundary.

### 4.2 Image understanding and generation
- Replace destructive fixed-square ingestion with native-aspect image preservation plus deterministic, configurable multi-scale crops/tiles.
- Use variable-length patch sequences with 2-D positional information; separate global semantic tokens from local detail tokens.
- Use a learned hierarchical image latent codec and a dedicated high-capacity image generator/decoder (e.g. latent diffusion/flow-matching Transformer or a validated pixel-space alternative). The shared core conditions generation; it is not forced to reconstruct high-frequency pixels through the current linear codec.
- Initial engineering evaluation tiers: 512px and 1024px long-side targets, with aspect ratio preserved. These are proposed benchmark tiers, not claims that CPU-only training can achieve them economically. Add higher tiers only after measured memory/quality tests.
- Add tiled/patch refinement with overlap and seam-consistency loss for high-resolution output.

### 4.3 Video understanding and generation
- Store source video as timestamped frame/clip sequences, preserving frame rate, duration, dimensions and audio track metadata. Never truncate the source to four frames during acquisition.
- Use a temporal video tokenizer/latent codec with explicit temporal stride and spatial compression; encode timestamps and variable frame counts.
- Generate autoregressively in temporally coherent chunks, conditioned on prior latent memory/state, with temporal attention and KV/memory caching. Chunking is an implementation strategy, not a four-frame product limit.
- Add explicit duration, FPS, resolution, motion and audio-video synchronization controls.
- Evaluate short clips first, then longer durations; require temporal consistency and identity/object persistence tests. A frame-count increase alone is not evidence of video generation quality.

### 4.4 Audio understanding and generation
- Keep log-mel only as an optional analysis feature, not the final waveform representation.
- Train or integrate into the model's own weights a neural audio codec: convolutional encoder/decoder plus residual vector quantization (RVQ) or a measured equivalent, with multi-resolution spectral, waveform, adversarial/perceptual and codec commitment losses.
- Add a learned neural decoder/vocoder; remove Griffin–Lim from the production generation path. Griffin–Lim may remain only as a diagnostic baseline.
- Support variable-duration audio via chunked latent sequences, streaming decode, explicit sample-rate/channel metadata, and alignment to text/timestamps.
- Separate speech, music and general audio evaluation; do not claim one quality score covers all three.

### 4.5 Multimodal training objectives
- Shared semantic next-token / sequence objective.
- Image: perceptual + reconstruction + adversarial/diffusion/flow objective appropriate to the selected generator; report FID/KID and human preference with prompt adherence.
- Video: latent denoising/flow objective plus temporal consistency, motion and synchronization losses; report FVD or validated video metrics plus human review.
- Audio: codec reconstruction, multi-resolution STFT, waveform/perceptual and adversarial objectives; report objective metrics (e.g. ViSQOL/PESQ where valid) and blinded listening.
- Cross-modal alignment: paired text-image, text-audio, text-video and audio-video examples; retrieval/contrastive or matching objectives and conditional generation evaluations.
- Tool: structured action/payload learning remains separate from execution; test schema validity, workflow success and permission enforcement.

## 5. Research basis and design implications

These references support design directions, not guaranteed results for OneCore:

- **High-resolution image generation:** Hourglass Diffusion Transformer demonstrates a transformer design targeting 1024×1024 pixel-space synthesis with linear scaling in pixel count. Inf-DiT studies memory-aware arbitrary-shape upsampling. Native-Resolution Image Synthesis (NiT) studies variable-resolution/aspect-ratio synthesis using variable-length visual tokens. These support investigating hierarchical, variable-resolution tokenization rather than fixed 64×64 resampling.
- **Long video:** ViD-GPT applies causal temporal attention and KV caching for autoregressive video generation. MALT Diffusion uses recurrent memory over segments for any-length video. LinGen (CVPR 2025) studies linear-complexity temporal/spatial processing for high-resolution minute-length video. These support chunked generation with persistent temporal memory, not a fixed four-frame representation.
- **Neural audio:** SoundStream demonstrates an end-to-end neural codec with convolutional encoder/decoder and residual vector quantization, including variable bitrate. EnCodec provides a high-fidelity neural audio compression implementation and pretrained codec models. These establish that a learned codec/decoder is a materially different approach from Griffin–Lim inversion.
- **Long context:** YaRN (ICLR 2024) presents a RoPE context-extension method. It supports testing a positional extension strategy, but it does not remove the need for long-context training data, memory planning and retrieval/needle-in-haystack evaluation.

Primary references:
1. HDiT, arXiv:2401.11605 — https://arxiv.org/abs/2401.11605
2. Inf-DiT, arXiv:2405.04312 — https://arxiv.org/abs/2405.04312
3. Native-Resolution Image Synthesis, arXiv:2506.03131 — https://arxiv.org/abs/2506.03131
4. ViD-GPT, arXiv:2406.10981 — https://arxiv.org/abs/2406.10981
5. MALT Diffusion, arXiv:2502.12632 — https://arxiv.org/abs/2502.12632
6. LinGen, CVPR 2025 — https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_LinGen_Towards_High-Resolution_Minute-Length_Text-to-Video_Generation_with_Linear_Computational_Complexity_CVPR_2025_paper.pdf
7. SoundStream, arXiv:2107.03312 / IEEE TASLP — https://arxiv.org/abs/2107.03312
8. EnCodec, Meta Research — https://github.com/facebookresearch/encodec
9. YaRN, ICLR 2024 — https://proceedings.iclr.cc/paper_files/paper/2024/file/874a4d89f2d04b4bcf9a2c19545cf040-Paper-Conference.pdf

## 6. Architecture versioning and recalculation protocol

Create a new architecture version (for example `onecore-v3`) rather than mutating the v2 checkpoint in place.

Before any v3 training:
1. Write an explicit architecture decision record for width/depth/heads, shared core, modality encoders/decoders, latent dimensions, codebook/RVQ levels, patch/temporal strides, positional scheme, max training context and inference context.
2. Derive every tensor shape and exact parameter count from code; assert exact equality.
3. Calculate token/latent budgets for each modality, attention/FLOPs, optimizer-state bytes, checkpoint bytes, activation memory and CPU/GPU wall-clock at intended batch/sequence settings.
4. Specify how arbitrary aspect ratios, frame rates, durations and sample rates are represented.
5. Add deterministic shape, round-trip, variable-length, streaming and boundary tests before corpus conversion.
6. Version tokenizer, codecs, manifests, config and checkpoint together. Never load v2 weights into incompatible v3 shapes without a separately justified and tested transfer-learning map.
7. Rebuild or transform datasets from preserved source assets; do not reacquire already downloaded sources unless missing payloads or licensing/provenance requires it.
8. Recompute train/validation/test coverage from **external-only usable payloads**, verify immutable source row provenance and cross-split disjointness, then train.
9. Establish evaluation thresholds from baseline measurements and human review; keep promotion blocked until thresholds are explicitly approved.

## 7. Data and quality gates (mandatory)

- External quota is counted only after `classify_record_data(record) == "external"`, immutable provenance validation, split match and successful payload decoding.
- Bootstrap, synthetic, owner-curated and metadata-only records never satisfy external quotas.
- Report both raw manifest counts and usable external counts by family/task/split; include missing/corrupt assets and unique asset hashes.
- Video data must retain variable frame count and timestamps. Audio data must retain waveform source or lossless/appropriate encoded source in addition to derived features, so a better codec can be trained later.
- Keep original image/video assets or a lossless archival representation; never make a 64×64 derivative the only surviving source.
- Independent validation/test must be external, disjoint by immutable source row and asset fingerprint, and large enough to support stable metrics.
- Report metrics separately by resolution, duration, FPS, sample rate, modality and task. No aggregate score may hide a failed modality.

## 8. Execution phases and stop conditions

**Phase A — Correctness gates (immediate):**
- Fix external-only quota counting and add regression tests.
- Audit the existing corpus artifact using that corrected gate; do not repeat full acquisition.
- Produce an explicit report of which modality/split quotas pass and which source rows/assets are missing.
- Keep any training run that depends on the old false-positive gate from being treated as a valid full-corpus run.

**Phase B — V3 architecture specification:**
- Benchmark candidate image/video/audio codecs and memory/compute costs against available infrastructure.
- Freeze tensor shapes, objectives, data schema, sequence budgets and version IDs.
- Build a tiny end-to-end prototype with synthetic smoke fixtures, then real licensed samples.

**Phase C — V3 implementation:**
- Implement variable-resolution image ingest/tokenization/generation.
- Implement variable-duration video ingest/temporal latent generation.
- Implement neural audio codec and decoder.
- Implement long-context positional strategy, KV cache and chunk-memory.
- Add modality-specific training losses and evaluation suites.

**Phase D — Training and promotion:**
- Only start a new long run after architecture tests, real-data gates and resource estimates pass.
- Preserve exact optimizer/checkpoint/corpus/tokenizer lineage.
- Evaluate on independent holdouts; approve thresholds from measured baselines; only then promote.

**Stop conditions:** Any missing external holdout family, lossy-only source preservation, shape mismatch, unbounded memory growth, codec round-trip failure, temporal discontinuity, audio intelligibility failure, cross-split leakage, or unapproved threshold blocks the relevant phase.

## 9. Existing corpus diagnostic (Run #48)

The retained diagnostic for corpus Run #48 and its completed gate logs establish the following:
- 58 registered sources; 18 completed, 8 unavailable, 24 pending; `acquisition_complete=false`.
- The legacy report marked `training_ready=true`, but Run #48 used the pre-fix `task_coverage()` implementation. Its green gate counted any usable payload, including bootstrap/synthetic rows.
- The mixed-class diagnostic reported validation and test image counts of 12 each, exactly matching the bootstrap baseline count. Those values do **not** establish 10 external image holdouts.
- Run #51 resumed from the same corpus. Its training code filtered tokenizer and optimizer inputs to `external`, and all ten 150-step sessions completed; however, the corrected 100/10/10 gate was not run in that `train_existing` path. Do not infer external holdout sufficiency from the successful optimizer sessions.
- The full corpus artifact is approximately 15.8 GB. The 15 KB diagnostic artifact does not contain all manifests/assets, so corrected per-family external counts cannot be derived from it alone.
- As of 2026-11-22 13:45 UTC, Run #52 is performing evaluation-only work on the saved train-10 checkpoint; its workflow intentionally skips the corpus gate. Run #55 is queued with a revised evaluation-only request. Neither run performs optimizer updates, and neither status alone proves the corpus quotas.

**Action:** Do not reacquire the corpus wholesale. Audit the existing full artifact with the corrected external-only coverage/provenance code when the evaluation lock is free. If and only if the audit identifies missing quotas, resume only the relevant saved source/split cursors; do not restart completed sources.

## 10. Immediate implementation log

- [x] Corrected `task_coverage()` to require `external_record_is_trainable(record)` and a usable payload.
- [x] Added regression tests proving bootstrap payloads cannot satisfy any external family quota and bootstrap-only image payloads fail the gate.
- [x] Verified the correction and current architecture/config/FLOPs suite in CI Run #456 on commit `2de04ec` (success).
- [x] Confirmed Run #51 training code enforced external-only tokenizer/optimizer inputs and completed ten 150-step sessions; final checkpoint artifact `onecore-state-train-10` was uploaded before the evaluation step was cancelled.
- [ ] Re-audit the existing 15.8 GB corpus artifact with the corrected external-only gate; Run #52/#55 are evaluation-only and do not establish this quota.
- [ ] Resume only missing external source/split cursors if the corrected audit proves a quota gap; preserve all existing source provenance and artifacts.
- [ ] Begin v3 architecture implementation only after the current checkpoint/corpus evidence is reconciled and resource estimates are measured.

This file is the durable session handoff. Every future OneCore session must read it before modifying architecture, corpus, training workflows or checkpoint lineage, then update the implementation log with commit/test evidence.


## 11. V3 implementation status (2026-11-22)

A clean implementation branch was created from the research foundation without changing `main`:
- Branch: `research/onecore-v3-implementation`
- Current implementation commit at this update: `91f1140469b3f1df41d67377f0d2e31267447128`
- CI Run #470: queued/running on that exact commit; do not claim success until its test job concludes.
- V2 training/checkpoint lineage remains on `research/onecore-foundation`; V3 modules are separate and checkpoint-incompatible.

Implemented V3 prototype components:
1. `src/onecore/v3/vision.py`: variable native image height/width, edge padding to patch grid, exact output crop, 2-D positions, patch codec.
2. `src/onecore/v3/audio.py`: trainable convolutional waveform encoder/decoder and multi-stage residual vector quantization; exact duration restoration.
3. `src/onecore/v3/video.py`: variable frame count, timestamp embeddings and causal temporal attention for each spatial patch; no four-frame truncation in this module.
4. `src/onecore/v3/core.py`: integrated text/image/audio/video forward paths through a shared semantic Transformer with modality embeddings; bounded global image context tokens (default 256) are broadcast back to local patch features.
5. `src/onecore/v3/media_ingest.py`: preserve original image/audio/video sources and metadata; stream all video frames into lossless PNG assets without a fixed frame limit.
6. `src/onecore/v3/config.py` and `configs/onecore-v3-research.yaml`: versioned config fingerprint and parameter report.

Tests added:
- `tests/test_v3_codecs.py`: variable image sizes, arbitrary image edge dimensions, audio durations and exact waveform lengths, video frame count and causal temporal behavior.
- `tests/test_v3_integration.py`: shared-core forward paths and gradient flow for text/image/audio/video.
- `tests/test_v3_media_ingest.py`: native image and audio source preservation.
- `tests/test_v3_config.py`: stable config fingerprint and parameter report.

**Strict current scope:** These are architecture/codecs and forward-path prototypes, not quality-certified generators. No diffusion/flow image generation objective, production audio perceptual/adversarial training, video long-context memory/chunking, cross-modal paired alignment objective, full v3 training loop, inference/checkpoint format, or promotion gates are complete. Current Transformer attention remains quadratic; the 256-token global visual context bounds image global attention, but video temporal attention and full shared sequences still require resource benchmarks and chunked memory design.

The v3 CI workflow was explicitly extended to run on this isolated branch. Its result is pending until Run #470 completes. Do not merge or train V3 until tests pass, exact parameter/resource reports are captured, and the remaining training/evaluation components are implemented.


### V3 implementation update — commit `a0fcd8674d3288a2059686a9852decb37766ade3`

The v3 prototype now also includes:
- Rectified-flow velocity prediction and an MSE flow-matching objective over continuous modality latents.
- Euler latent samplers and untrained generation entry points for variable-size images, variable-duration waveforms, and variable-frame video.
- A configurable cap of 256 global visual-context tokens; local patch features are retained and the global context is broadcast back to them. This bounds global image attention but is not a substitute for full perceptual high-resolution generation training.
- Lossless source ingestion for images/audio/video; the original source file and media metadata are preserved, and all decoded video frames are exported without a fixed four-frame cap.

CI Run #470 exposed two audio integration defects (waveform rank and Conv1d channel ordering). Both were corrected in subsequent commits. Run #475 on the corrected branch has passed package compilation, the complete unit/regression test suite, and v2 architecture/FLOPs checks; notebook preflight and remaining CI steps were still running at the time of this update.

Do not claim generation quality from these untrained flow samplers. The v3 trainer, dataset conversion, perceptual/adversarial audio/image losses, temporal synchronization objectives, long-video chunked attention, checkpointing, inference serving, and evaluation/promotion thresholds remain outstanding.


### V3 loss and media-ingest extension — commit `6823c8c34671d85e22a5baae14cbae787af74c04`

Added `src/onecore/v3/losses.py` with:
- multi-scale image reconstruction and spatial-gradient loss;
- multi-resolution STFT + waveform loss for audio;
- temporal-difference consistency loss for video;
- symmetric paired-embedding contrastive alignment loss;
- patch-image and multi-scale waveform discriminators with hinge objectives.

Added tests for all these loss paths and a seven-frame GIF ingestion test proving the video source adapter saves all seven frames and does not apply a four-frame cap. CI Run #477 is executing against this commit; results are pending.


### Bounded long-video and generation context update — commit `991980d8964e762fa8ed6e437f208f2d50329c4b`

The V3 temporal path now processes video in causal windows (default 32 frames) while carrying a compact detached memory (default 4 frames) between windows. Shared global video context and flow-attention context each have explicit 256-token budgets. Video generation exposes `generate_video_chunks()` to yield decoded chunks with timestamp conditioning and compact latent history; `generate_video()` is a convenience wrapper that concatenates those chunks in memory.

Run #480 has passed compilation, the full unit/regression suite, and the v2 architecture/FLOPs checks; the remaining notebook and streaming checks are still running. The preceding #477 CI run passed all 173 tests and all workflow/notebook checks.

This is bounded-window temporal processing, not full-context KV caching. The detached memory intentionally truncates backpropagation across windows; quality and long-range temporal consistency remain unmeasured.


### V3 joint training objective — commit `095b1a7a8eebe05e27104edebe2ea7d61a2398e9`

Added `src/onecore/v3/training.py`:
- Joint objective for causal text/tool prediction, image flow + reconstruction, audio flow + multi-resolution STFT/waveform + RVQ commitment, and video flow + reconstruction + temporal consistency.
- Paired text-to-modality contrastive alignment where paired condition IDs are supplied.
- `train_v3_step()` with optimizer zeroing, backpropagation, gradient clipping and parameter update.
- A separate discriminator-step helper for optional image/audio hinge discriminators.

This is a single-step training prototype, not yet a durable multi-session training workflow. V3 checkpoint save/restore, optimizer/scheduler resume, dataset conversion, alternating discriminator orchestration, quality benchmarks and promotion gates remain incomplete. The current v3 CI run is pending.


### V3 training-step verification — commit `095b1a7a8eebe05e27104edebe2ea7d61a2398e9`

CI Run #483 completed successfully:
- 175 tests passed (12 warnings) in 5.29 seconds.
- Package compilation passed.
- Corrected Specification v2 parameter/FLOP verification passed.
- Architecture notebook, safe notebook preflights, text one-step smoke, random-init smoke gate, FineWeb-2 cursor-resume smoke, notebook validation, and workflow-isolation checks all passed.

This verifies the prototype code paths and regression suite, not model quality or production training. V3 has not been trained on a real corpus; no generated sample has been evaluated for human quality.


### V3 raw payload ingestion — commit `8a9f42be9a44e750eabeb7d1a343207fb78f4a2b`

The V3 media ingestion adapter now accepts source values in common dataset forms: original file paths, HTTP(S) URLs, encoded bytes, decoded PIL images/NumPy image arrays, audio arrays with sample-rate metadata, and complete frame lists with optional timestamps. It preserves the original encoded source where supplied, enforces configurable download-size ceilings, and writes every supplied video frame without a fixed frame-count cap. Tests cover byte/array image and audio payloads and a nine-frame video sequence. CI Run #486 is pending.


### V2 corpus reusability finding — media source preservation

A direct source inspection of `src/onecore/acquire.py` confirms:
- `_save_image()` resizes every source image to 64×64 before saving.
- `_save_audio_features()` converts the waveform to 16 kHz mono log-mel features and saves only the feature tensor.
- `_video_frames()` and `_write_frames()` default to and enforce a four-frame sample.

Therefore the V2 acquired media assets are lossy derivatives for V3 purposes; they are not sufficient source masters for native-resolution image, waveform codec, or variable-duration video training. Do not silently treat the V2 media corpus as V3 raw data. Reuse its text/tool records and immutable source registry/cursors where valid, but selectively re-read only the media rows needed to preserve raw source assets at the same pinned immutable revisions. This is a targeted media-source recovery, not a full corpus rediscovery or text/tool reacquisition.


### V3 raw-data gate and provenance validation — commit `a2093329d2424553098f4f956526e7588ad449e5`

Added `src/onecore/v3/manifest.py` to require immutable external provenance, pinned source revisions, preserved raw media assets, asset SHA-256 verification, source-row and asset split-disjointness, and per-family train/validation/test quotas. Bootstrap/synthetic records are explicitly excluded from external counts. Tests cover successful external coverage, bootstrap exclusion, cross-split asset leakage, and missing raw media. CI Run #490 is pending.


### V3 external-manifest gate verification — commit `a30e215d35c4b1537713ce7acefffaf31be5ba02`

CI Run #493 completed successfully with 182 tests passed (12 warnings) and all compile, v2 architecture/FLOP, notebook, smoke-training and workflow-isolation checks passing. The V3 manifest tests verify that bootstrap images do not count, raw assets must exist, immutable provenance is required, and assets cannot leak between splits. The image payload adapter's decoded-array branch was also fixed and covered by regression tests.

The V3 manifest gate is code-tested only on fixtures. It has not yet audited the full 15.8 GB Run #48 corpus or a recovered V3 raw-media corpus.


### V3 exact parameter budget — commit `16f475f2ef5c7d514cea1f0f4c190c8c0cc33c38`

The default `onecore-v3-prototype-1` config was instantiated in CI and reported:
- **51,986,695 trainable parameters**
- Config SHA-256: `355e281c3a049a745f0f5a0c593faffab0d28fc917b5e2492dba5357d68a2617`
- FP32 parameter storage: 207,946,780 bytes (~198.2 MiB)
- FP16 parameter storage: 103,973,390 bytes (~99.1 MiB)
- AdamW FP32 moment storage estimate: 415,893,560 bytes (~396.5 MiB), excluding weights, gradients, activations, runtime buffers and allocator overhead.
- Image/video/flow global context budgets: 256 tokens each; temporal windows 32 frames with 4-frame detached memory; video generation chunk default 8 frames.

CI Run #494 passed all 182 tests (12 warnings), the exact V3 parameter report, V2 architecture/FLOP checks, all notebook and smoke checks, and workflow isolation. This is an exact parameter/storage report, not a peak-memory benchmark or quality result.


### V3 streamed video input and duplicate-sample protection — commit `e79c5e4b0d297fefd5ef79556a8fbb89cff900c8`

The video codec now exposes `iter_encode()`, which encodes frames in bounded chunks and carries a detached temporal memory between chunks; `OneCoreV3.forward_video_chunks()` yields decoded input-video chunks without requiring a full latent tensor. The convenience `forward_video()` reuses the streamed encodings rather than encoding the source twice.

The V3 manifest gate was tightened to reject duplicate source rows even within one split and duplicate asset hashes reused by different records within a split; repeated identical frames within the same video record remain allowed. CI verification is pending.


### Latest verification — V3 streaming and manifest hardening

At V3 commit `e79c5e4b0d297fefd5ef79556a8fbb89cff900c8`, CI Run #498 has passed compile, exact parameter report, the complete unit/regression test suite, v2 architecture/FLOP verification, exact notebook and safe preflights, and one-step smoke training. The FineWeb-2 cursor-resume smoke and final notebook/workflow-isolation checks were still in progress at the time of this update. Do not mark Run #498 fully successful until the run concludes.




### V3 recurrent-core and modality-head revision — 2026-11-22

The next architecture improvement has been implemented on the isolated V3 branch (not merged):
- Branch: `research/onecore-v3-implementation`
- Latest implementation commit: `6dabdf34cb14358ada1d54bf694a2b04ecd56a19`
- Architecture version: `onecore-v3-prototype-2`
- Four unique shared Transformer blocks are reused over three cycles (12 effective block applications). The blocks are actual shared parameters, not cloned copies.
- The rectified-flow output projection is now separated into three heads: image, audio and video. The shared semantic backbone remains common.
- V3 config, YAML, README and regression tests were updated. Tests explicitly check recurrent depth/unique-block count and prove only the selected modality head receives gradients for a modality-specific flow loss.
- File commits: core `c17b8a5226cde1749d8274599dd9cc0aa72e72f6`; config `f2b1eb53c0e4a32c95edcaab5ef520fe4c5826f2`; integration tests `43d266d71f252ffed06054bfdf5e67a9521aac97`; config tests `09e9951ed99415df3caa18b863aa8519bb5e1970`; research YAML `8532d1340499b055165cd2d8f7a30f2acb54533d`; V3 README `6dabdf34cb14358ada1d54bf694a2b04ecd56a19`.

**Verification state:** The CI workflow explicitly triggers on pushes to `research/onecore-v3-implementation` and includes compile, exact V3 parameter report, full tests, V2 architecture/FLOP checks, notebook checks and smoke paths. The latest commit's combined status currently returns no status records; do not infer CI success. The previously recorded Run #498 was associated with the prior V3 commit `e79c5e4b0d297fefd5ef79556a8fbb89cff900c8`; its final completion was not established in this inspection. Recheck the latest workflow run for the new commit before opening a PR. The old prototype-1 parameter/storage figures and config fingerprint are invalid for prototype-2 and must be regenerated by CI.

**Important limitation:** Recurrent sharing reduces unique backbone parameter storage but still executes twelve Transformer block applications; it does not reduce attention FLOPs per effective layer. The three output heads add parameters. No exact new parameter count, peak memory, throughput, quality or training capability is claimed until measured.

### V2 checkpoint evaluation status — 2026-11-22

Run #52 (`45015944155`) is still active in this inspection. It successfully restored the exact corpus and completed checkpoint, verified optimizer/tokenizer/lineage, and is currently executing independent validation and held-out test. It performs no optimizer updates. Its evaluation evidence upload and summary steps are pending. Run #55 (`45017683783`) remains queued with no jobs/artifacts visible; do not launch a competing training or evaluation request. Do not treat this evaluation as proof of the corrected external-only 100/10/10 corpus gate.

### Next engineering sequence

1. Obtain the terminal result and artifacts from Run #52; do not rerun evaluation unless evidence is missing/corrupt.
2. Obtain CI result for V3 prototype-2 commit `6dabdf34...`; fix any regression from the logs before advancing.
3. Record the new exact parameter report and config SHA; discard prototype-1 parameter/storage estimates for prototype-2.
4. Add an integration regression that streams more than one temporal window through `OneCoreV3.forward_video_chunks()` and verifies exact total frame count and order; existing codec chunk tests alone do not prove the full model path.
5. Assess stereo/channel-aware audio and explicit sample-rate conditioning/resampling; preserve raw audio and never represent mono-only behavior as universal.
6. Implement a V3 corpus converter that selectively recovers only raw media rows from pinned original sources, reuses existing valid text/tool records and provenance, and validates external-only 100/10/10 quotas with the V3 manifest gate. Do not repeat full corpus acquisition.
7. Benchmark peak CPU memory, throughput and sequence scaling before creating a V3 multi-session training workflow. No V3 training, PR merge or promotion until CI, raw-media data gate, resource budget and checkpoint/resume design pass.

The V3 branch remains isolated. `main` was last observed at `0b5ec69e839bfc6086a358511b54649b03c7be9a`; do not modify or merge it.




### V3 full-model multi-window video regression — 2026-11-22

Added an integration regression on `research/onecore-v3-implementation` at commit `136e1eca8eca25f19e85746492a9a7343e602034`. It sends 13 timestamped frames through `OneCoreV3.forward_video_chunks()` with a five-frame chunk size and asserts chunk lengths `[5, 5, 3]`, exact reconstructed frame count/order shape, and finite output values. This exercises the integrated shared-core/video-codec path across multiple temporal windows, not only the standalone codec. The test is committed but has not yet been executed by a confirmed CI run; retain that distinction.

The next unstarted media-codec investigation is stereo/channel-aware audio plus explicit sample-rate handling. Do not silently assume 16 kHz or label the current mono-only codec as universal. Any channel/sample-rate change requires a versioned config, round-trip tests, and an updated exact parameter report before training.


### V3 stereo audio codec extension — 2026-11-22

Implemented on `research/onecore-v3-implementation` as a sequence of file commits, with the last code/test commit currently `fbf1bf114dbd65fdaa004fe1b426cade6a2f6de1`:
- `NeuralAudioCodec` now has an explicit channel count (prototype-2 default: stereo/2 channels), accepts mono input by channel expansion and downmixes reconstruction back to mono when the source was mono.
- Audio encodings preserve original channel count and optional sample-rate metadata; `OneCoreV3.forward_audio(..., sample_rate=...)` carries the metadata through the shared semantic path.
- V3Config and research YAML now fingerprint `audio_channels=2`; integration generation expects stereo output.
- Added codec tests for stereo shape preservation, mono compatibility, sample-rate metadata and invalid channel/sample-rate rejection.
- The codec does **not** resample waveforms or condition its neural weights on sample rate. The metadata is provenance/contract information only. A deliberate resampling or sample-rate-conditioning design is still required before mixing arbitrary rates in training. Do not imply that 44.1/48 kHz inputs are normalized merely because their metadata is stored.

**Verification:** No confirmed CI result is yet available for the final code/test commit. The README documents the exact limitation. Prototype-1 parameter counts and prototype-2 counts from before this channel change are not valid for the current config; rerun the exact parameter report and record the new config fingerprint after CI.

**Next:** verify final CI and inspect any failure logs; then add an explicit audio sample-rate normalization policy and raw-media converter without reacquiring completed text/tool sources. Keep V3 isolated and do not train/merge until data gate, resource budget, checkpoint/resume and full CI pass.


**Stereo codec follow-up — validation hardening:** The codec and V3Config now explicitly restrict configured channel counts to mono (1) or stereo (2); unsupported multichannel configurations fail fast. Regression coverage includes the invalid three-channel constructor. Latest V3 code/test commit: `fbf1bf114dbd65fdaa004fe1b426cade6a2f6de1`. CI remains unverified for this exact commit until a run/check is surfaced. Sample-rate metadata remains informational only: no resampling or learned sample-rate conditioning is implemented.


### V3 canonical audio-rate normalization — 2026-11-22

Implemented on `research/onecore-v3-implementation`; latest commit in this slice: `3ba175fe2ae2bd2ee2260eeb50dc8f49d5045cb0`.

- The V3 audio training contract is now explicit: mono/stereo input only, normalized to **24,000 Hz** before entering the neural codec. `NeuralAudioCodec.encode/forward` and `OneCoreV3.forward_audio` require a sample-rate argument and reject any rate other than the configured canonical rate; they no longer silently accept 44.1/48 kHz data as if it were 24 kHz.
- `preserve_audio_payload` no longer invents 16 kHz for arrays that omit sample-rate metadata; it raises and requires the original rate.
- `resample_audio_source` preserves the original file in `raw/audio` and creates a separate 24 kHz WAV training derivative using `scipy.signal.resample_poly`. It records original/target rates, channels, sample counts, duration and rational resampling ratio. Already-canonical audio uses the source file without a needless rewrite.
- Added SciPy as an explicit dependency, added sample-rate enforcement to the model config fingerprint, and required explicit normalized sample-rate metadata in joint audio training batches.
- The V3 manifest now hashes both `source_asset` and `training_asset`, so processed training derivatives are covered by missing-file, duplicate-asset and cross-split leakage checks. Regression tests cover omitted source rates, 44.1 kHz stereo → 24 kHz stereo resampling, canonical-rate identity, and processed-asset hashing.

**Verification:** GitHub Actions Run #538 (ID `45037417319`) is running on the exact latest commit `3ba175fe...`. At last inspection, CPU PyTorch installation succeeded and project/test dependency installation was in progress; compile, exact parameter report and tests had not started. Run #537 (ID `45037398886`) was cancelled when the next commit superseded it; do not count it as a pass. No new parameter count or config fingerprint is claimed until Run #538 completes and its report is inspected.

**V2 evaluation:** Run #52 (ID `45015944155`) remains active in independent validation/test with no optimizer updates. Its corpus/checkpoint restoration and lineage verification succeeded. Do not launch a competing run. Run #55 remains queued with no jobs visible.

**Remaining gates:** inspect Run #538 through completion and repair any failing step; record exact V3 parameter count/config fingerprint; build a selective V3 corpus converter that reuses validated text/tool records and only restores missing original media; run the full external-only 100/10/10 manifest gate; benchmark CPU peak memory/throughput; implement durable V3 checkpoint/resume before any V3 training. No PR merge or promotion yet. `main` remains at `0b5ec69e839bfc6086a358511b54649b03c7be9a`.


### V3 audio normalization CI evidence and regression correction — 2026-11-22

Run #538 (ID `45037417319`) on V3 commit `3ba175fe2ae2bd2ee2260eeb50dc8f49d5045cb0` completed with **failure** in the unit/regression step: **191 passed, 1 failed**. Compile and exact-parameter report both passed. The only failure was a stale assertion in `test_v3_audio_codec_preserves_stereo_channels_and_sample_rate_metadata` that still expected `encoding.sample_rate is None`; the implementation correctly returned the configured canonical rate 24,000 Hz. Corrected that assertion on the V3 branch in commit `bfa2950a8ab874e4bd55893fe372323900109339`. This is a test expectation correction, not an implementation rollback. A new CI run for the correction must pass before the audio policy is accepted.

The exact parameter report produced by Run #538 (before tests stopped the job):
- Architecture: `onecore-v3-prototype-2`
- Trainable parameters: **39,906,568**
- Config SHA-256: `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`
- State-dict tensors: 123
- FP32 parameter storage: 159,626,272 bytes
- FP16 parameter storage: 79,813,136 bytes
- AdamW FP32 moments estimate: 319,252,544 bytes (moments only; not peak memory)
- Context budgets: image/video/flow 256 tokens; temporal window 32 frames, detached memory 4 frames; generated video chunks 8 frames.
These values are now the current prototype-2 baseline for the config fingerprint above, but rerun/record them again after any further architecture/config change. They are not a peak RAM or quality measurement.

The audio rate policy is now canonical 24 kHz with source-preserving polyphase conversion. The V3 codec strictly rejects non-24 kHz input; preprocessing preserves the original file and hashes the separate normalized training derivative in the manifest. The V3 branch remains isolated and unmerged.


### V3 canonical audio CI passed — Run #540

Run #540 (ID `45037557167`) passed on commit `bfa2950a8ab874e4bd55893fe372323900109339`:
- Compile passed.
- Exact parameter report passed.
- **192 tests passed, 9 warnings**.
- Corrected Specification v2 architecture/FLOP check passed.
- Exact architecture notebook and safe notebook preflights passed.
- Text-training notebook one-step smoke and random-init smoke passed.
- FineWeb-2 streaming/cursor-resume smoke passed.
- All notebooks validated.
- Workflow isolation and single training lock passed.

Exact report repeated in this run: **39,906,568 trainable parameters**, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, 123 state-dict tensors, FP32 parameters 159,626,272 bytes, FP16 parameters 79,813,136 bytes, AdamW FP32 moments estimate 319,252,544 bytes. These are parameter/storage figures, not peak RAM, inference speed or quality evidence.

### V3 selective V2 corpus converter — implementation and pending CI

Implemented on `research/onecore-v3-implementation`; latest branch commit at this checkpoint: `e5cd116164e6b67ffe397e10af9b9251b9e5ff85`.
- New `converter.py` reuses immutable external text/tool records without reacquisition.
- For media records, it groups by source ID and pinned revision, streams only the registry-declared source splits, matches the exact V2 `source_row_id_sha256` using the same row-identity function, and restores only the matching media rows.
- Image assets are preserved at native dimensions; audio preserves the source and creates a canonical 24 kHz polyphase derivative; video keeps every frame/timestamp and requires `frame_limit_applied=false`.
- Disabled sources, revision gaps, source-row misses, adapter mismatches, duplicate source-row hashes and restore errors are reported/blocked. No synthetic rows are added.
- Atomic split-manifest writer and orchestration call the external-only V3 gate (100 train / 10 validation / 10 test per family by default).
- Added fixture tests for image rehydration, 44.1 kHz stereo audio conversion, all-frame video restore, disabled-source behavior, atomic split writes and full converter/gate orchestration.
- V2 64x64 images, old audio features and four-frame video derivatives are explicitly removed from converted records; they are never mislabelled as raw media.

**CI:** Run #553 (ID `45038253364`) is queued for current converter commit and must finish before the converter code is accepted. Intermediate runs #549–#552 were cancelled as later commits superseded them; do not count them as failures or passes. Run #540 is the confirmed passing baseline before converter changes.

**Data status:** The converter is implemented and fixture-tested only when Run #553 passes. It has not been run on the full 15.8 GB corpus. Do not claim external-only 100/10/10 coverage or start training. The next data task is to execute the converter against the exact saved corpus artifact and pinned sources, preserve the report, and resolve missing/disabled/gated media sources without repeating text/tool acquisition.


### Current converter verification checkpoint — Run #554

Run #554 (ID `45038258359`) is the active CI run for V3 branch head `e5cd116164e6b67ffe397e10af9b9251b9e5ff85`. Confirmed successful steps so far: dependency installation, compile, exact parameter report, complete unit/regression suite (including the new converter fixtures), V2 architecture/FLOP contract, exact architecture notebook, safe notebook preflights, text-training one-step smoke, and random-init smoke gate. FineWeb-2 streaming/cursor-resume is currently in progress; notebook validation and workflow-isolation checks remain pending. Do not mark Run #554 passed until all remaining steps complete. No additional V3 commits should be pushed while this run is active, to avoid cancelling it.


### V3 selective corpus converter CI fully passed — Run #554

Run #554 (ID `45038258359`) completed with **success** on V3 branch head `e5cd116164e6b67ffe397e10af9b9251b9e5ff85`.
- Compile passed.
- Exact parameter report passed.
- **198 tests passed, 9 warnings** (including all converter fixture tests).
- Corrected Specification v2 values/FLOPs passed.
- Exact architecture notebook, safe notebook preflights, text one-step smoke, random-init smoke, FineWeb-2 streaming/cursor resume, notebook validation, and workflow isolation/single-lock checks all passed.
- Exact V3 report repeated: 39,906,568 parameters; config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`; 123 state tensors; FP32 159,626,272 bytes; FP16 79,813,136 bytes; AdamW moments estimate 319,252,544 bytes. No quality certification and no peak-memory benchmark.

**Converter state:** implementation and fixture CI are complete, but no conversion of the real 15.8 GB corpus has run. The converter is designed to re-use V2 text/tool rows, rehydrate only media rows from pinned revisions by exact source-row hashes, preserve full media, and enforce external-only 100/10/10. The next blocker is safe access to the existing corpus artifact and a controlled execution path. Do not re-crawl text/tool or claim the quotas pass before the actual converter/gate report exists.

**V2 checkpoint:** Run #52 (ID `45015944155`) remains in progress at independent validation/held-out test with no optimizer updates; restored checkpoint/corpus/lineage steps are successful. Do not start a competing run.

**Branch protection check:** `main` remains at `0b5ec69e839bfc6086a358511b54649b03c7be9a`. V3 remains isolated at `e5cd116164e6b67ffe397e10af9b9251b9e5ff85`; no PR or merge was created. Foundation reference branch head before this update: `14124f7e1dc43ae1955c93c460d7059d196dd692`.


### Existing corpus artifact audit and exact image holdout gap — 2026-11-22

Downloaded and inspected the small diagnostic artifact `onecore-data-gate-diagnostic-44925751665` (artifact ID `14716542436`) from V2 Run #48 (`44925751665`). The full corpus artifact `onecore-corpus-final` (ID `14715699177`) is still available, 15,803,310,342 bytes, SHA-256 `5761e5008e8b6a8dec861e803a66e590b822c3a7cf1dc95311faa96b4017f46a`, expiration 2027-02-19. It must not be downloaded/extracted in full on a normal runner; the V3 artifact helper now uses HTTP Range ZIP reads to extract only the three JSONL manifests and acquisition report.

The diagnostic report exposes the previous data-gate false positive:
- `acquisition_complete=false`, but the legacy report nevertheless said `training_ready=true`; do not trust that field.
- External assets: train image 900, validation image **0**, test image **0**; audio 1100/165/185; video 100/10/10. Text/tool coverage exceeds quotas.
- The generic `task_coverage` showed 12 image validation and 12 image test rows, but `external_media_assets` shows no external image files in either holdout split. These were not valid external raw-image holdouts and must not count.
- `openimages_finedet_v1` is enabled and pinned at revision `d492ad4d6c43af64c27bad62a1cdd6a39c6efaa7`; prior acquisition had 900 train images and zero validation/test images. The V2 registry snapshot at artifact source commit `5489900c3662082ad39efbfac5b6a2c7d22a7c4c` declares native train/validation/test splits.
- The V3 converter now has a targeted missing-media quota pass: it can fetch only the 10 missing image rows from each native validation/test split at that exact pinned revision, then restore matching existing V2 media rows. It does not reacquire text/tool records or fabricate examples.

**Current execution:** Run #566 (ID `45039655675`) is executing the optional one-time V3 corpus-restore job, triggered by commit `f76e9972b7f588567f3dc86ca4cd3ce6af05ef70`. The job uses the verified artifact ID, range extraction, the exact V2 source-registry snapshot, pinned revisions from the artifact report, and only uploads the converted corpus if the external-only gate passes. Do not start V3 training while this is running or before the gate report is inspected.


### V3 nested-tar range restore investigation — 2026-11-22

The real V2 artifact layout was inspected from the existing acquisition workflow before changing the converter. The artifact is uploaded as a single `onecore-corpus.tar` file with `compression-level: 0`; the outer GitHub Actions artifact is therefore a ZIP wrapper containing a stored TAR member, not a ZIP containing `data/train.jsonl` directly. The TAR itself writes the four required files first (`train.jsonl`, `validation.jsonl`, `test.jsonl`, `acquisition-report.json`), followed by assets/metadata. This ordering permits bounded streaming of only the manifests and report without fetching the 15.8 GB asset payload.

**Failure evidence and corrections:**
- Run #566 (ID `45039655675`) failed in the converter because `RemoteZip`'s default suffix range request was not supported by the signed artifact storage URL (`RangeNotSupported`). The Verify job passed; no conversion report/corpus artifact was produced.
- Run #568 (ID `45039853193`) repeated the same range failure after resolving the signed URL directly. This proved that redirect handling alone was not the cause.
- V3 commit `f26654e3512b6afdf5f70ec10cbf88e683ccb90c` changed `RemoteZip` to use `support_suffix_range=False`, which uses HEAD plus an explicit start/end byte range. Run #569 (ID `45045556387`) passed the Verify job and advanced beyond the range error, then failed because the converter assumed flat JSONL members instead of the actual nested TAR layout.
- V3 commit `174c4650e1fd65799c53c89d68b6e49aeb9c2737` now detects the single `onecore-corpus.tar` member, requires it to be `ZIP_STORED`, and streams only the four required TAR files into temporary files before atomic replacement. It does not download or expand the full corpus. A regression fixture builds the same stored-ZIP/TAR shape and verifies extraction plus the explicit-range option.

**Current verification state:** Run #570 (ID `45045979340`) is active on V3 commit `174c4650e1fd65799c53c89d68b6e49aeb9c2737`. The Verify job has passed compile, exact parameter report and unit/regression tests; the V2 FLOP check is in progress. The corpus-restore job has reached the real converter step. Do not claim converter success, external-only coverage, or a V3 corpus artifact until the job publishes its manifest-gate report and artifact list. Do not push another V3 commit while #570 is active.

The confirmed V3 prototype-2 parameter/config report remains **39,906,568 trainable parameters** and config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708` from Run #540; the current converter commits do not alter the model config. These are not peak-memory or quality measurements. CPU peak memory/throughput, V3 checkpoint save/restore lineage, and multi-session V3 training remain unimplemented/unverified; no V3 training may start before the corpus gate, benchmarks, and checkpoint design pass.

**V2 evaluation continuity:** Run #52 (ID `45015944155`) was cancelled during independent validation/test; its evaluation evidence artifact was not uploaded. Run #55 (ID `45017683783`) is now in progress in the evaluation-only job, currently restoring the exact corpus; it has no optimizer-update job active and no artifacts visible at this inspection. Do not start a competing V2 training/evaluation run or infer evaluation completion. The V2 checkpoint remains the previously verified train-10 lineage at optimizer step 1,500; no new step is claimed.

V3 remains isolated at `174c4650e1fd65799c53c89d68b6e49aeb9c2737`. Foundation is being updated only with this continuity record; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No PR or merge was created.


### V3 first real-corpus conversion audit — Run #570 (2026-11-22)

Run #570 (ID `45045979340`) completed successfully as a workflow, and both jobs concluded successfully; however, the converter deliberately **blocked corpus promotion** because the final external-media manifest gate failed. Its report artifact is `onecore-v3-conversion-report-45045979340` (artifact ID `14764196247`, SHA-256 `52fadc66cc8d88670aa790cc78989827b3ece10abd181dd9ef6e1a1c1144756e`).

Report facts:
- 655,427 input rows; 652,555 converted rows; zero synthetic rows.
- Text/tool/image counts present: train 591,525 text / 14,000 tool / 900 image; validation 22,552 text / 400 tool / 10 image; test 22,758 text / 400 tool / 10 image.
- Final manifest gate: image, text and tool pass the required counts; **audio and video are zero usable rows in all three splits**, so the final gate correctly fails.
- Ten source streams failed before row hydration because Hugging Face attempted automatic TorchCodec decode: Fleurs Arabic and Arabic speech audio; four WavCaps configurations; Videos4CameraBench video. The error was missing `torchcodec`.
- The targeted acquisition diagnostic showed enough candidate row counts for audio/video (audio 1100/165/185 and video 100/10/10), but these were only source-row counts. They are not proof of preserved media payloads. The final gate correctly rejected the conversion.
- The missing-media fill added 10 validation and 10 test images from the existing pinned OpenImages source; no audio/video candidates were added because their manifest row counts already met their minimums. No re-crawl of text/tool was performed.

### V3 media source decoding fix — commit `9da80f5ac9320ebc2967b29bb4686e7d2929d051`

Root cause: `_default_source_loader` streamed Hugging Face datasets with their default feature decoding enabled. For audio/video columns this invokes TorchCodec decoders, although the converter needs encoded source paths/bytes and performs its own loss-preserving ingestion.

Change:
- The pinned streaming loader now requires `IterableDataset.decode(False)` and fails closed if the stream cannot disable automatic media decoding.
- This returns source path/byte payloads instead of constructing AudioDecoder/VideoDecoder objects. Existing ingestion functions then preserve source assets and use the explicit 24 kHz resampling and imageio/FFmpeg frame extraction path.
- Added regression tests asserting that the loader calls `decode(False)` and refuses a stream without that capability.
- Existing resolver `_resolve_video_asset` already supports the path/bytes values returned by Video(decode=False), including pinned `hf://datasets/{repo}@{revision}/...` references.

**Verification:** CI Run #572 (ID `45057049451`) is in progress on this exact commit; the latest observed job reached the exact V3 parameter report step after installing CPU PyTorch and project dependencies. Do not claim the tests passed until this run completes.

**Next required sequence:** once #572 passes, trigger the existing conditional `v3-corpus-restore` job using the required commit-message marker `[onecore-v3-corpus-restore]`. Inspect its new report artifact. Only if all five family gates pass and raw media hashes/provenance are sound may the V3 corpus artifact be uploaded. Do not start V3 training before that. Run #55 (ID `45017683783`) remains evaluation-only and active; no optimizer-update job is running. `main` remains at `0b5ec69e839bfc6086a358511b54649b03c7be9a`.


### V3 media decoder fix — verification passed; real corpus restore running

CI Run #574 (ID `45057213347`) passed its entire `verify` job on V3 commit `8d0c84407ae8cb66be9c5e55fc39b9eeef2392b9`:
- compile passed;
- exact V3 parameter report passed;
- **202 tests passed, 9 warnings**;
- Corrected Specification v2 parameter/FLOPs checks passed;
- architecture notebook, safe notebook preflights, one-step text smoke, random-init smoke, FineWeb-2 cursor resume, all notebook validation, and workflow-isolation checks passed.
- The only observed warning cluster is the known PyTorch nested-tensor optimization warning in temporal video Transformer; it did not fail tests.

The exact V3 report remains unchanged because this commit only changes source loading and a stale test expectation: **39,906,568 trainable parameters**, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, 123 state tensors, FP32 159,626,272 bytes, FP16 79,813,136 bytes, AdamW moments estimate 319,252,544 bytes. These are parameter/storage quantities, not peak RAM or quality measurements.

The conditional `v3-corpus-restore` job in the same Run #574 is now **in progress** and depends on the passing verify job. It is reusing the existing V2 corpus artifact and exact pinned source registry. Its report artifact and final manifest gate have not yet been produced. Do not claim audio/video conversion or external 100/10/10 success until that job completes and its report is inspected.

Latest V3 commit: `8d0c84407ae8cb66be9c5e55fc39b9eeef2392b9`. Latest foundation reference commit before this note: `d43db600549781a969f9f48d37de7e7841d7430f`. `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. Run #55 remains evaluation-only in independent validation/test, with no optimizer update.


### V3 artifact restore CLI recovery and optional-dependency correction — 2026-11-22

**Run #574 (ID `45057213347`) verification passed** (202 tests; 9 warnings), but its restore job could not start conversion because the workflow invoked `python -m onecore.v3.cli` while `cli.py` and the range extraction module had disappeared from the V3 tree. No conversion report or corpus artifact was created in #574.

The missing modules and corresponding tests were restored in commit `9f6b6eb92d966c87223eb094239363f7c406c8c0`:
- `onecore/v3/cli.py` invokes the V2-to-V3 converter and reads pinned source revisions from the acquired report.
- `onecore/v3/artifact.py` performs authenticated GitHub Actions artifact redirect resolution and HTTP byte-range reads. It extracts only the first four required members from the stored outer TAR (or the supported legacy flat ZIP layout); it does not download the 15.8 GB corpus ZIP or expand its media assets.
- `test_v3_artifact.py` restores the range, stored-TAR, and required-member fixture coverage.
- `pyproject.toml` registers `onecore-v3-convert` and a separate `corpus-restore` optional dependency group.

Run #576 (ID `45057592878`) then failed during standard CI test collection because `artifact.py` imported `remotezip` at module import time, while the Verify job intentionally installs only `[dev]`. The range extraction code itself had not run. Fix on commit `e83b624a6c195d697275bc4d2dcb43448a812f37`:
- `requests` and `RemoteZip` are now imported optionally; helper/fixture tests remain usable without the range-download extra.
- Calling real range extraction without `[corpus-restore]` fails immediately with an actionable installation error.
- Added regression tests for standard-dev import and fail-fast behavior without RemoteZip.

The V3 restore workflow has a separate optional install `onecore-ai[dev,corpus-restore]`; it also verifies the CPU-only TorchCodec/FFmpeg decode runtime before opening the pinned media streams. The converter's default streaming loader still requests `decode(False)` so raw encoded paths/bytes, rather than implicit decoded objects, flow into OneCore's source-preserving ingestion. This makes missing decoder support explicit and keeps the media ingest path deterministic.

**Current CI:** Run #577 (ID `45057766456`) is running on commit `e83b624a6c195d697275bc4d2dcb43448a812f37`. Latest observed status was Python setup in progress; compile, tests, exact parameter report, and corpus restore are not yet proven. Do not push another V3 commit while #577 is running.

**Next:** wait for #577 Verify. If it passes, follow the conditional restore job through optional dependency install, CPU TorchCodec/FFmpeg preflight, range extraction, and converter. Inspect uploaded JSON conversion report even if workflow succeeds. Do not promote the corpus unless all five families pass external 100/10/10, assets exist, provenance is immutable, and split leakage checks pass.

V3 branch latest commit at this note: `e83b624a6c195d697275bc4d2dcb43448a812f37`. V3 model parameters/config remain 39,906,568 / `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`. `main` remained `0b5ec69e839bfc6086a358511b54649b03c7be9a` at latest verification. V2 Run #55 continues evaluation-only; no optimizer updates are running.


### V3 TorchCodec CPU wheel correction — 2026-11-22

Run #577 (ID `45057766456`) passed the full Verify job (205 tests; V2 contract/FLOPs, exact architecture notebook, notebook preflights, training smoke, random-init smoke, FineWeb-2 cursor resume, notebook validation, and workflow-isolation checks). The restore job progressed through FFmpeg, CPU PyTorch and optional dependency installs, but its TorchCodec preflight **failed** before fetching manifests.

Root cause from the exact job log: TorchCodec 0.17 was installed from the default PyPI index and its native library attempted to load `libnvrtc.so.13`. That is a CUDA-linked build, incompatible with our CPU-only runner. No V2 artifact was downloaded and no audio/video media was converted in #577.

Fix committed on V3 as `26d00bf3bc37007e424c0f338635b8f3ca07d04e`:
- Removed TorchCodec from the `corpus-restore` PyPI optional dependency list; it now contains only requests and RemoteZip.
- Added a distinct `Install CPU-only TorchCodec wheels` step using the official PyTorch CPU wheel index (`https://download.pytorch.org/whl/cpu`).
- Kept a runtime preflight that asserts CUDA is absent, Datasets reports TorchCodec availability, and both AudioDecoder and VideoDecoder import successfully.
- This prevents a CUDA-linked PyPI package from silently entering the CPU-only workflow.

GitHub Actions Run #579 (ID `45058144645`) is in progress on that exact commit. At last observation the Verify job was installing CPU-only PyTorch; no new test, report, or restore conclusion yet.

**Next:** obtain #579 Verify result; after it passes, ensure the separate CPU-index TorchCodec installation and import preflight succeed. Only then proceed to the pinned artifact range extraction and V3 media converter. Inspect the final report for source-row rehydration, raw files, 24 kHz audio derivatives, frame counts, and actual external-only 100/10/10 coverage. A green job without a full manifest gate is not a corpus pass.

The CPU wheel requirement is also documented by TorchCodec's upstream installation guidance; the generic PyPI build in this run demonstrably loaded CUDA's `libnvrtc` and was rejected. Do not install CUDA packages or add CUDA libraries just to satisfy a CPU pipeline.


### Run #579 CPU-only decoder preflight passed; V3 real-corpus conversion active

Follow-up to the previous note: Run #579 (ID `45058144645`) is now progressing on V3 commit `26d00bf3bc37007e424c0f338635b8f3ca07d04e`.

**Verify job completed successfully** with all expected stages: compile, exact V3 parameter report, full regression tests, V2 specification/FLOPs checks, architecture notebook, safe notebook preflights, one-step text smoke, random-init smoke, FineWeb-2 exact cursor resume, notebook validation and workflow isolation. V3 remains at **39,906,568 parameters** and config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`.

**Restore job progress:**
- FFmpeg system libraries: success.
- CPU-only PyTorch: success.
- OneCore + corpus-restore dependencies: success.
- TorchCodec CPU wheels from the PyTorch CPU index: success.
- Runtime preflight: success — `torch.version.cuda is None`, Datasets reports TorchCodec available, and `AudioDecoder` plus `VideoDecoder` import successfully.
- Exact V2 source registry snapshot restored: success.
- `Convert the existing corpus with HTTP range reads`: currently in progress.
- No conversion report or V3 corpus artifact exists yet.

This is the first run in which the decoder preflight is successful and the pinned V2 media converter has actually started. Keep the V3 branch frozen until Run #579 concludes. Inspect the JSON report and independently confirm all five family/split quotas, raw media paths, 24 kHz derivatives, SHA256 integrity, and split disjointness before acknowledging corpus promotion. If any family fails, use the report's exact source errors to fix only the affected media adapter; do not reacquire completed text/tool data.

Run #55 (ID `45017683783`) continues its independent validation/test evaluation-only job, with no optimizer updates. `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`.


### Run #579 exact verification evidence — 2026-11-22

The completed Verify job in Run #579 (ID `45058144645`, V3 head `26d00bf3bc37007e424c0f338635b8f3ca07d04e`) produced the following explicit evidence:
- **208 tests passed, 9 warnings**.
- V3 report: 39,906,568 trainable parameters; config SHA256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`; FP32 parameter bytes 159,626,272; FP16 bytes 79,813,136; AdamW FP32 moments estimate 319,252,544 bytes. This is not measured peak RAM.
- V2 specification/FLOPs: exact 57,579,201 parameters, vocab 5,144, hidden 2,730. Random-init reference cross-entropy `ln(5144)=8.545586...`; one-step smoke observed 8.37449 nats. Joint FLOPs checks: T=128 1.296720 TF; T=512 5.258828 TF; text T=128 1.037376 TF.
- FineWeb-2 Arabic `arb_Arab` exact cursor resume returned `resume_exact=True` at pinned revision `af9c13333eb981300149d5ca60a8e9d659b276b9`.
- Compile, 6 notebooks checks/preflights, smoke training, workflow isolation all passed.

The same Run #579 restore job has successfully passed FFmpeg install, CPU-only PyTorch install, optional dependency install, TorchCodec CPU-wheel installation, decoder preflight (`torch.cuda` absent; both decoder classes importable), and pinned source-registry restore. The real V2-to-V3 corpus conversion is still in progress at step 10. No report artifact or V3 corpus artifact is yet available; no external 100/10/10 media-gate success is claimed.


### V3 pinned-media hydration correction — commit `8c20497e905f6b9381d7e3d3916986a694f5ba71` (2026-11-23)

Run #579 (ID `45058144645`) completed with a failed corpus gate. The Verify job itself passed (208 tests; 9 warnings), but the real conversion report artifact `onecore-v3-conversion-report-45058144645` (artifact ID `14775377606`, SHA-256 `52fadc66cc8d88670aa790cc78989827b3ece10abd181dd9ef6e1a1c1144756e`) proves that raw media was not restored:

- 655,427 input records; 651,635 converted; 1,302 non-external rows excluded; 2,490 pinned source-row matches remained unresolved.
- 1,433 media failures were `FileNotFoundError` from local paths embedded in streamed rows: 700 FLEURS Arabic, 413 Arabic Speech Corpus, 300 WavCaps, and 20 OpenImages rows.
- 120 Videos4CameraBench rows reached FFmpeg/ImageIO with extensionless `.bin` copies; extension-based plugin selection could not open them.
- The manifest report contains no media asset hashes and zero usable image/audio/video coverage in every split. The converter correctly blocked the corpus. No V3 corpus artifact was promoted.

The acquisition report confirms the exact immutable source revisions used by those rows: FLEURS `70bb2e84b976b7e960aa89f1c648e09c59f894dd`; Arabic Speech Corpus `30aa0f8d6ab14c52a360fa2b6e6e319d258fcf69`; WavCaps `f10da99095b2d1b1d956e9057917410189ede0c1`; OpenImages `d492ad4d6c43af64c27bad62a1cdd6a39c6efaa7`; Videos4CameraBench `1ec8d55f8c380abbb6ea7087e64778f0ca76a68f`.

**Correction committed on V3 as `8c20497e905f6b9381d7e3d3916986a694f5ba71`:**
- Added a bounded (100-row page) Hugging Face Dataset Viewer fallback for missing local media paths. It uses the already-matched streaming row index and source split, caches pages per repository/config/split, checks stable row identity where available, requires HTTPS on a Hugging Face host, and rejects any media URL whose path does not contain the exact pinned source revision.
- Added `source_hf_row_index` and a reproducible `source_media_locator` to records restored through that fallback; the signed URL itself is not persisted because it expires.
- Kept text/tool records unchanged and reused the existing V2 manifests and acquisition report; no corpus acquisition or synthetic rows were added.
- Forced ImageIO to use the FFmpeg plugin for video metadata/frame iteration, allowing the decoder to inspect extensionless temporary `.bin` source paths by content.
- Added regression tests for pinned viewer media fallback, rejection of a different revision, and explicit FFmpeg selection for extensionless video.

**Verification state:** Run #584 (ID `45080540084`) was queued on this commit at the last check. Its CI and corpus-restore job have not yet been verified; do not claim the converter fix or any media quota passed until its report is inspected. The exact V3 parameter/config report has not been rerun after this converter-only change; the prior report was 39,906,568 parameters and config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, which remains the last measured value, not a new measurement.

**V2 evaluation note:** Run #52 (ID `45015944155`) ended cancelled without an evaluation artifact. Run #55 (ID `45017683783`) failed during its independent validation/test job because the external validation result omitted `image_reconstruction`. This is consistent with the already-proven absence of usable external image holdout assets in the old corpus; it is not a reason to weaken the modality requirement or claim V2 evaluation success. No optimizer updates occurred in #52 or #55.

V3 training remains blocked pending a successful external-only media gate, measured CPU peak memory/throughput, and checkpoint save/restore continuity. `main` remains at `0b5ec69e839bfc6086a358511b54649b03c7be9a`; no PR or merge was created.


### Run #584 regression result and targeted V3 correction — 2026-11-23

Run #584 (ID 45080540084) on V3 commit 8c20497e905f6b9381d7e3d3916986a694f5ba71 compiled successfully and produced a fresh exact prototype-2 report, but its unit/regression test step failed before the corpus-restore job could run.

Exact architecture report from step 7:
- onecore-v3-prototype-2
- **39,906,568 trainable parameters**
- config SHA-256 6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708
- 123 state tensors; FP32 parameter storage 159,626,272 bytes; FP16 79,813,136 bytes; AdamW moments estimate 319,252,544 bytes. These remain storage estimates, not peak memory.

The test log identified three regressions introduced by the first media-fallback patch:
1. _needs_dataset_viewer_fallback treated an in-memory video frames payload as missing because it only recognized bytes/arrays/URLs. The seven-frame converter fixture therefore fell through to the remote viewer and returned no converted record.
2. The nonstandard-split test still expected source_hf_split="*", while the converter now correctly records the actual matched split catalog-b and row index 0. The assertion was stale.
3. Forcing FFmpeg for every video extension broke the existing GIF round-trip fixture; GIF is an image-sequence format and should retain ImageIO's native plugin.

Targeted fix committed on V3: 1cc8571c278b4b163e457a8440efe2b6b91ce63b.
- Treat non-empty frames payloads as already available.
- Select FFmpeg only for extensionless/.bin and recognized video-container suffixes; retain ImageIO's default plugin for GIF and other image-sequence formats.
- Update the source-split regression assertion to require the actual catalog-b split and row index 0.

Run #586 (ID 45080869616) is now running on 1cc8571c278b4b163e457a8440efe2b6b91ce63b. Its latest status must be inspected before claiming test success. The restore job is gated behind Verify, so no new real-corpus conversion has started yet. The known FLEURS Arabic train split has a Dataset Viewer scan-size failure for row-group ranges 0–1999 (the viewer returns 500/502); offset 2000 succeeds. If #586 reaches conversion and that source blocks the audio gate, add a pinned FLEURS tar-stream fallback for only the matched WAV basenames rather than downloading/reacquiring the full corpus.

No V3 training has started. The data gate, CPU peak-memory/throughput benchmark, and checkpoint save/restore continuity remain incomplete. main remains 0b5ec69e839bfc6086a358511b54649b03c7be9a; no V3 PR or merge was created.


### Run #586 V3 verification passed; pinned-media restore is active — 2026-11-23

Run #586 (ID 45080869616) on V3 commit 1cc8571c278b4b163e457a8440efe2b6b91ce63b has completed its entire Verify job successfully:
- 211 tests passed, 9 warnings.
- Compile, exact parameter report, Corrected Specification v2/FLOPs checks, architecture notebook, safe preflights, one-step text smoke, random-init smoke, FineWeb-2 cursor-resume, notebook validation, and workflow isolation all passed.
- The exact architecture report remains onecore-v3-prototype-2 with 39,906,568 trainable parameters and config SHA-256 6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708; 123 state tensors; FP32 159,626,272 bytes; FP16 79,813,136 bytes; AdamW moments estimate 319,252,544 bytes. These are storage estimates only.
- The text smoke completed one optimizer step (loss 8.374492645263672); this is a smoke test, not V3 training or quality evidence.

The separate corpus-restore job in the same Run #586 is now active. FFmpeg installation is in progress; CPU PyTorch, CPU TorchCodec, registry restore, HTTP-range manifest extraction and the real converter have not yet been verified in this run. No conversion report or V3 corpus artifact is available yet. Do not repeat acquisition or start V3 training. Inspect the converter report after it completes; specifically verify that image/audio/video raw assets, hashes, canonical 24 kHz audio derivatives, provenance and external-only 100/10/10 coverage pass. The FLEURS Arabic train Dataset Viewer row endpoint has a known scan-size failure for early row groups; if the real conversion confirms this blocks audio, use the pinned train.tar.gz streaming fallback only for the matched WAV basenames.

V3 head: 1cc8571c278b4b163e457a8440efe2b6b91ce63b. Foundation reference head before this note: 95447e2f2f6eaebf50f73b9a62410f4419d0b22b. main remains 0b5ec69e839bfc6086a358511b54649b03c7be9a. No V3 training, PR or merge.

### V3 real-corpus restore audit and stale-path correction — 2026-11-23

Run #586 (ID `45080869616`) completed on V3 commit `1cc8571c278b4b163e457a8440efe2b6b91ce63b`.

**Verify job:** passed in full: 211 tests, 9 warnings; compile, exact prototype-2 parameter report, Corrected Specification v2/FLOPs, notebook checks, text one-step smoke, random-init smoke, FineWeb-2 cursor resume and workflow isolation all passed. Exact report: 39,906,568 trainable parameters; config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`; 123 state tensors; FP32 parameter storage 159,626,272 bytes; FP16 79,813,136 bytes; AdamW moments estimate 319,252,544 bytes. These are storage estimates, not peak memory. The one-step smoke is not a V3 training run or quality result.

**Real converter:** the restore job ran to completion but correctly blocked promotion. Report artifact:
- Name: `onecore-v3-conversion-report-45080869616`
- Artifact ID: `14786937256`
- ZIP SHA-256: `7c222dd2a9d3801dcdc95d3435d4766c3fd761169fcb64625f5a123528f9caec`
- 655,427 input records; 651,635 converted records; 1,302 non-external rows skipped; 2,490 pinned source-row matches unresolved; 1,553 media restore errors.
- Error groups: FLEURS Arabic 700; Arabic Speech Corpus 413; WavCaps 300; Videos4CameraBench 120; OpenImages 20.
- Dataset Viewer media fallback restored 0 records. The final manifest had zero usable image/audio/video records in every split and zero asset hashes; text/tool counts were present, but the external-only media gate failed. No V3 corpus artifact was uploaded.
- The targeted OpenImages fill attempted 10 validation and 10 test rows, but those rows also failed media restoration; candidate row counts are not valid media coverage.

**Root-cause correction:** inspection of `converter.py` and `media_ingest.py` showed that the fallback predicate treated any non-None `bytes` field as usable before checking whether the accompanying local `path` existed. The preservation helpers prefer `path` over `bytes`, so a stale local path could still cause FileNotFoundError even when the row carried another payload. Empty bytes also incorrectly suppressed fallback.

V3 commit `1799460ec04f5ea5b16fc6e3a65428ec7d1762f0` now:
- checks that inline bytes/arrays/frames are non-empty;
- removes an unavailable local path when a valid alternate payload is present, allowing the existing preservation helper to use the payload;
- sends missing paths with no usable alternate payload through the pinned Dataset Viewer fallback;
- adds regression coverage for empty-byte fallback and non-empty encoded-byte priority.

**Current verification:** Run #589 (ID `45116254698`) is active on exact V3 commit `1799460ec04f5ea5b16fc6e3a65428ec7d1762f0`. Do not claim this fix or the converter gate passed until Verify and the real restore report finish. Do not push another V3 commit while #589 is active.

**V2 evaluation reconciliation:** Run #52 (ID `45015944155`) is cancelled without an evaluation artifact. Run #55 (ID `45017683783`) failed during independent validation/test because `image_reconstruction` was missing; no optimizer updates occurred. Neither is a successful independent evaluation. No active V2 training/evaluation job is evidenced by those runs.

V3 training remains prohibited until the real external-only 100/10/10 gate passes for all five families, CPU peak-memory/throughput and modality sequence measurements are recorded, and durable checkpoint save/restore continuity (optimizer, scheduler, RNG, tokenizer and step lineage) is implemented and tested. No V3 PR/merge was created. `main` remains at `0b5ec69e839bfc6086a358511b54649b03c7be9a`.



### Corrected Specification v2 runtime enforcement and verification — 2026-11-23

Foundation branch commits:
- `78e4f43de42915e6f7a6c8c828330826fd0abd52`: enforce the Corrected Specification v2 exact parameter/vocabulary/hidden-size anchors, move `seed: 20261115` under `training:`, and make the seed an explicit training config field. Resume compatibility compares optimizer/schedule fields while restoring the historical seed and RNG state from checkpoint metadata.
- `68c2ce7e1a03366458f137724a0cc2b4ebd86164`: keep the official V2 hard anchors strict by default (`validate_spec_v2=True`) while making an explicit opt-out available only for deliberately small engineering/smoke/inference fixtures. This preserves tiny architecture tests without weakening the production V2 configuration gate.

The first CI attempt, Run #591 (ID `45120377335`), exposed that tiny model fixtures in training and inference tests were unintentionally being subjected to the fixed V2 production parameter budget. Those test paths were updated to request the explicit non-V2 fixture mode; production callers retain strict defaults. This was a useful regression finding, not a reason to relax the V2 contract.

Run #592 (ID `45121112021`) completed successfully on `68c2ce7e1a03366458f137724a0cc2b4ebd86164`:
- 165 unit/regression tests passed.
- Corrected Specification v2 configuration and FLOPs checks passed, including exact 57,579,201 parameters, vocabulary 5,144, hidden size 2,730, and the expected training schedule/seed placement.
- Exact architecture notebook, safe notebook preflights, one-step text-training notebook, one-step random-initialization smoke and FineWeb-2 streaming/exact cursor-resume checks passed.
- The training smoke recorded first-language loss 8.3744935989 against the random-initialization reference 8.5456, within the engineering smoke interval. This is smoke evidence only, not a quality result or full training run.

No full optimizer training was launched by Run #592. The 20,000-step training requirement remains a future training target, and V2 quality promotion remains blocked because independent validation/test evidence is incomplete and `promotion-thresholds.json` is not approved. Run #55 (ID `45017683783`) still failed independent evaluation because the external validation split omitted `image_reconstruction`; no optimizer updates occurred in that evaluation job.

The V3 corpus conversion remains a separate active run (#589, ID `45116254698`) on V3 head `1799460ec04f5ea5b16fc6e3a65428ec7d1762f0`; do not push to that branch or interrupt its conversion until its report is available. V3 data-gate status is therefore still unverified. V2 source changes are confined to `research/onecore-foundation`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a` and no merge was made.


### V3 restore checkpoint audit and bounded retry improvement — 2026-11-23

Run #599 (ID `45189488873`) passed the full Verify job but correctly failed the external-only V3 corpus gate. Its report artifact `14836372267` contained:
- 655,427 V2 input rows; 653,187 converted; 1,302 non-external rows skipped; 37 additional pinned source-row identities were not found.
- 1,190 prior media records reused from resumable progress and 119 media rows restored by the indexed Dataset Viewer fallback.
- Audio quotas and video train/validation quotas were met; video test had 9 usable records, leaving one required slot missing.
- OpenImages train had 900 candidate rows but zero usable raw media at that point. A bounded 10,000-row scan saved its stateful cursor after 146.86 seconds; validation and test each had 10 usable images.
- Durable partial progress artifact `14835553943` was 22,962,354,839 bytes. It contains progress/assets/cursors only and is not a validated V3 corpus.

The targeted correction retried only transient Dataset Viewer HTTP 408/425/429/500/502/503/504 and URL transport failures with bounded backoff, retained fail-fast behavior for permanent 4xx responses, and expanded the per-run bounded OpenImages scan to 100,000 rows while preserving the stateful cursor. Run #600 then reused that progress snapshot; subsequent Run #602 restored the final image/video coverage and passed the final manifest minima, with 37 unmatched extra legacy rows still explicitly counted rather than silently discarded.

## 2026-11-24 — V3 external-gate semantics after Run #602

Run #600 (ID `45224997715`) failed the V3 external corpus gate after the retry and bounded-scan correction. The follow-up V3 commit `a1e693bc38d8badb7b3ec61cbadf100189358097` restored V2-compatible image-row identity by decoding only the Hugging Face Image feature while leaving audio/video under explicit decode-disabled ingestion, and preserved the crawler cursor namespace/artifacts. Run #602 (ID `45234080438`) then passed Verify with 222 tests and 9 warnings.

Run #602 restored usable native media and its final manifest gate passed all five external families at the Corrected Specification v2 minima:

| Split | Audio | Image | Text | Tool | Video |
|---|---:|---:|---:|---:|---:|
| Train | 1,100 | 900 | 591,525 | 14,000 | 100 |
| Validation | 165 | 10 | 22,552 | 400 | 10 |
| Test | 148 | 10 | 22,758 | 400 | 10 |

The report contained no media-restore errors and no deferred source splits; 37 additional legacy V2 rows remained unmatched at their pinned source revisions (and 1,302 non-external rows were skipped as expected). Those extra rows remain explicitly counted in `skipped`; they are not replacements for required examples. The final `manifest_gate.passed` was true, but the workflow still failed because converter-level `blocked` inherited restore-completeness warnings and the workflow required both that legacy flag and the actual manifest gate to pass.

The V3 correction separates `restoration_incomplete` and `acquisition_incomplete` telemetry from corpus eligibility. The top-level `blocked` value now means only that the final V3 manifest gate failed. The workflow's corpus-publish decision follows `manifest_gate.passed` and logs both incompleteness fields. A regression test covers a passing final gate with 37 unmatched legacy rows and a genuinely failing manifest gate.

This does not authorize V3 training: CPU peak-memory/throughput and full checkpoint save/restore continuity remain outstanding. No V2/V3 assets were merged, no training was started, and `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`.


### V3 checkpoint format implementation — 2026-11-24

An independent `onecore.v3.checkpoint` format has been implemented in the canonical V3 integration tree. Format version 1 atomically stores and strictly validates:
- V3 model, optimizer and scheduler states plus the global optimizer step;
- exact `V3Config` values and fingerprint;
- serialized tokenizer JSON, SHA-256 and actual vocabulary size (must exactly match `text_vocab_size`);
- validated V3 manifest SHA-256 and JSON-serializable source/data cursor state;
- Python, NumPy and Torch CPU RNG states;
- run/session lineage and parent-checkpoint SHA-256.

Regression tests cover a complete tiny-model training-state round trip and rejection of configuration, tokenizer, manifest, parent-lineage and vocabulary mismatches. The implementation is not yet CI-verified; no V3 training run has started. The checkpoint gate remains closed until the new tests pass in the canonical V3 branch.


### V3 corpus-restore dispatch policy — 2026-11-24

The expensive V3 corpus restore is now a manual-only GitHub Actions operation. The V3 CI workflow exposes `workflow_dispatch` input `restore_v3_corpus`, defaulting to `false`; the restore job runs only when an operator explicitly sets it to `true` on `research/onecore-v3-implementation`. Ordinary code pushes and pull-request verification do not download or restore the multi-gigabyte media-progress artifact. The CI concurrency lock uses `cancel-in-progress: false` so a running restore is preserved while later verification is queued.

This dispatch-policy change does not interrupt an already-running Run #605. Run #605 remains the current restore attempt. Older queued Verify Run #606 was replaced/cancelled when newer Run #607 was created; Run #607 is the current pending Verify-only run for head `3545e2633122b0a6e57b51d529773ce9cba9bcd0`.


### V3 tokenizer implementation — 2026-11-24

Added the independent `onecore.v3.tokenizer` module and `onecore-v3-tokenizer` package command:
- Reads the V3 train manifest only, selects `task=text`, requires explicit `data_class=external`, HTTP(S) source URL, immutable source revision and unique source-row SHA-256. Rejects bootstrap/synthetic/owner-curated rows, non-train records, duplicate IDs/source rows, short rows and invalid provenance.
- Fits byte-level BPE with NFC normalization and the exact `V3Config.text_vocab_size` (32,000 by default); it does not import V2 tokenizer vocabulary or files.
- Writes tokenizer JSON and a sidecar evidence document containing config/manifest/tokenizer SHA-256, text-row digest, actual vocabulary, special-token IDs and the external train-only contract. Existing artifacts are never overwritten.
- Adds a verifier that reloads the serialized tokenizer and rejects changed bytes, wrong vocabulary, invalid special-token IDs, config mismatch, missing evidence, non-external or non-train evidence, validation/test usage, and manifest mismatch.

Regression tests cover a tiny exact-vocabulary BPE fit, pinned external train-only filtering, invalid revision/row hashes/URLs, bootstrap rejection, special-token evidence and SHA-256 mismatch, output immutability and overwrite refusal. The implementation and tests are committed with CI pending; the actual 32,000-token tokenizer has **not** been trained yet because the final V3 corpus artifact is still awaiting Run #605 completion. Do not label a tokenizer as fitted until the resulting JSON and evidence sidecar exist and verify successfully.
