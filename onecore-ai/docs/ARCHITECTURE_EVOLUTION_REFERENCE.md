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


### V3 tokenizer-fit failure diagnosis and corrective verification — 2026-11-24

This update supersedes the earlier statement that the first tokenizer fit was merely pending. The existing dedicated tokenizer workflow was already present on the V3 branch; no additional workflow was created in this correction.

**Observed failures and preserved successes**
- Tokenizer workflow Run #1 (45336109095) completed its source-run/artifact preflight and successfully range-extracted only data/train.jsonl from V3 corpus artifact 14892594659. It did not download the full 24.43 GB corpus ZIP or any image/audio/video assets. The tokenizer fit stopped before output publication on text row hf-c4_ar-000d12d85c1a305d51f51aa4.
- Root cause: onecore.data.classify_record_data canonically maps external_staged and external_reviewed to external, and the V3 manifest gate uses external_record_is_trainable; however, the tokenizer also required the raw field to equal the literal string external. The row therefore passed the shared external classifier but was rejected by the stricter, inconsistent string comparison.
- The V3 tokenizer now uses the same external_record_is_trainable predicate as the corpus gate. It still requires train split, immutable source revision, unique source-row SHA-256, valid HTTP(S) source URL, non-empty text and the minimum external train-text count. Bootstrap, synthetic and owner-curated records remain rejected.
- Verify Run #614 (45336109032) had 260 passing tests and one failure in test_v3_train_manifest_extractor_refuses_to_overwrite_existing_file: optional range-reader dependencies were checked before the existing-file guard. The guard now runs first, so refusing overwrite is deterministic even when requests/remotezip are absent from the lean Verify environment.
- Regression tests cover acceptance of the canonical external aliases and rejection of owner-curated/bootstrap text. Workflow policy tests require same-commit Verify success, exact source artifact/report digests and sizes, and a passing five-family report before the next fit attempt.

**Pinned evidence and execution**
- Corpus Run #605 (45325008221) remains the source of truth: manifest gate passed, with train 1100/900/591525/14000/100, validation 165/10/22552/400/10, test 148/10/22758/400/10 in audio/image/text/tool/video order.
- Corpus artifact: ID 14892594659, 24,432,975,285 bytes, digest sha256:302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2.
- Report artifact: ID 14893020087, 892,194 bytes, digest sha256:151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba.
- Request revision 2 pins both artifacts and requests a single retry. The existing tokenizer workflow waits for canonical Verify on the exact commit, checks the source run/branch/SHA and both artifact metadata records, downloads only the small report, rechecks exact five-family coverage, and range-extracts only the train manifest.
- No tokenizer artifact has been published yet. Do not claim a fitted 32,000-token tokenizer until the JSON and evidence sidecar are uploaded and independently verified. No optimizer training has started.

**Correction commit:** 93498a57d8d7ae3c33fb55ade2375c2f86864f86. Foundation remains the frozen V2 archive; main remains 0b5ec69e839bfc6086a358511b54649b03c7be9a. No new branch or PR was created.



## 2026-11-24 — Verified V3 tokenizer, dense FLOPs, and canonical CI

This update supersedes earlier statements in this reference and the README that the real tokenizer was still pending or that V3 FLOPs had not yet been recomputed.

**Canonical refs and isolation**
- V3 implementation branch: `research/onecore-v3-implementation`, implementation head `01dedd7ccf05c2826230a8693402087bed2bf94c` before this documentation-only update.
- Frozen Foundation/V2 archive: `research/onecore-foundation` at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; Foundation Verify Run #613 (ID `45335115471`) passed.
- `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No main merge, new PR, or new branch was created. PR #10 remains merged as previously recorded.
- V2 Runs #52 and #55 are no longer active: #52 was cancelled; #55 failed its independent validation/test job. Neither produced optimizer updates. No V2 or V3 optimizer training was started in this execution.

**External corpus and tokenizer**
- V3 corpus Run #605 (ID `45325008221`) remains the authoritative external-only five-family corpus. Artifact 14892594659: 24,432,975,285 bytes, SHA-256 `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`. Report artifact 14893020087: 892,194 bytes, SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`. Manifest gate passed with train audio/image/text/tool/video = 1100/900/591525/14000/100, validation = 165/10/22552/400/10, test = 148/10/22758/400/10. Asset hashes = 20,607; errors = []; deferred = []; synthetic records added = 0. The 1,302 non-external skips and 37 unmatched extra legacy rows remain separately reported and are not counted toward quotas.
- Tokenizer workflow Run #2 (ID `45336933362`) completed successfully on source corpus Run #605. Artifact 14894835517, `onecore-v3-tokenizer-run605-vocab32000`, size 394,036 bytes; ZIP SHA-256 `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- The tokenizer JSON has exactly 32,000 vocabulary entries and SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`. Evidence sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`; summary SHA-256 `2fb6e83e277b8f3d44cffd46a7a6e1c7231bffcb3e4f423ec62ab25e8c05bbb5`. Evidence binds 591,525 external train-text records, train manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`, and external text-row SHA-256 `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`; validation/test usage = 0 and V2 tokenizer import = false. The workflow range-extracted only `data/train.jsonl`, not the full 24.43 GB corpus.

**V3 checkpoint evidence**
- The independent `onecore.v3.checkpoint` format remains version 1 and is separate from V2. It stores V3 weights, optimizer/scheduler/global step, config+fingerprint, serialized tokenizer bytes/hash/vocabulary, validated manifest fingerprint, source/data cursors, Python/NumPy/Torch CPU RNG and parent-checkpoint lineage.
- Canonical Verify Run #618 (ID `45341192551`) passed 267 tests and 20 warnings on commit `1a33bff45348f01575f0ee74b67c5b7d30863735`, including the detached-optimizer/model binding regression.
- The checkpoint suite still uses tiny fixtures. A save/restore test bound to the full real corpus assets, actual tokenizer artifact, and complete production-sized data cursors has not yet been run; do not treat the tiny fixture as the full data-continuity gate.

**Exact V3 parameter and dense-FLOP report**
- V3 remains `onecore-v3-prototype-2`, 39,906,568 trainable parameters, 123 state-dict tensors, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`. V2 parameter counts and FLOPs are not reused.
- New `onecore.v3.flops` code computes dense arithmetic from instantiated module dimensions. Reference shapes: batch 1 per family; text/tool 128 tokens; image 256×256; audio 24,000 samples, stereo, 24 kHz; video 13 frames at 256×256.
- Exact counted dense forward FLOPs at 2 FLOPs/MAC: text 14,260,633,600; tool 14,260,633,600; image 21,340,618,752; audio 173,752,320,000; video 68,232,426,496; five-family forward sum 291,846,632,448 (0.291846632448 TFLOPs).
- The count excludes bias additions, normalization, activations, softmax/masking, sinusoidal position generation, pooling/interpolation, RVQ distance reductions/argmin, losses, memory movement and backward propagation. It is not a measured training-step FLOP count, runtime throughput, peak RSS, corpus shape distribution, or quality metric. The unconditioned flow-sampler reference is 21,072,708,608 FLOPs/step and 674,326,675,456 for 32 steps, excluding decoder FLOPs.

**CI and correction history**
- FLOP implementation commit: `1d8ce0858fe63b05e0993fc100610167c8269ed5`.
- A focused test initially referenced the previous flow-report nesting and caused Run #619 (ID `45345829625`) to fail with 270 passed/1 failed. The test path was corrected in commit `01dedd7ccf05c2826230a8693402087bed2bf94c`; no model code or checkpoint lineage was changed by that correction.
- Canonical Verify Run #620 (ID `45345949288`) on `01dedd7` completed success: 271 passed, 24 warnings. Compile, exact parameter/FLOP report, V2 corrected-spec contract, architecture notebook, safe notebook preflights, FineWeb-2 exact cursor resume, notebook validation and workflow isolation all passed.
- Earlier tokenizer/CI Run #614 and tokenizer workflow Run #1 failures are historical and superseded by the successful tokenizer Run #2 and Verify #620. Do not rerun the successful corpus restore or tokenizer fit for these exact artifacts.

**Still prohibited**
- No V3 optimizer training until measured peak CPU RSS/throughput on actual corpus samples, modality shape/duration profiling, and a full checkpoint save/restore bound to the real tokenizer/manifest/cursors/RNG/lineage all pass.
- No V3 training orchestrator or production inference API has been implemented yet. No image/audio/video quality evidence exists; professional-quality claims require independent held-out evaluation and human review.
- Keep V3 as the sole active product branch, Foundation as the frozen V2 archive, and main unchanged.

## 2026-11-24 — Bounded CPU profiler: sequence-length coverage and CI correction

**Implementation**
- The bounded real-corpus CPU profiler is in `onecore/v3/resource_benchmark.py`. It reads the existing immutable corpus/report/tokenizer artifacts by HTTP Range and extracts only the three manifests plus selected, hash-verified media samples; it does not download or unpack the 24.43 GB corpus archive in full.
- The profiler now computes actual tokenizer sequence-length distributions for every eligible external train text/tool row using the pinned V3 tokenizer artifact. Encoding is batched (128 rows), only integer lengths are retained, and non-external rows are excluded. A non-train row in the supplied train manifest is a hard error. Output includes count/min/median/p95/max for text and tool sequences alongside existing character and media shape/duration distributions.
- The benchmark remains measurement-only: isolated CPU workers run inference and forward/backward passes, but no optimizer step or AdamW state allocation occurs. Its measured RSS therefore does not establish the complete optimizer-training memory budget.

**Commit and CI evidence**
- Profiler implementation: `2f6178ebae18776628047c69c73df9fc17d04769`.
- Tool-text newline normalization: `46fb9183e564e9b9c7b6f2783791226c7bc9c713`.
- Train-only tokenizer profiling tests: `5dcd96de1f905e6337674686f8034b68ed5daf19`; valid JSONL fixture correction: `de886174b551b47c237d944f522256ae0c851b68`.
- Run #624 (ID `45358993328`) on the profiler implementation passed: 281 tests, 24 warnings; compile, exact V3 parameter/FLOP assertions, V2 specification checks, notebooks, FineWeb-2 cursor resume, and workflow isolation passed.
- Run #627 (ID `45359115282`) exposed one fixture error: the test used task name `tool`, while the canonical V3 manifest task is `tool_use`. The profiler correctly classifies families from `TASK_GROUPS`; the test fixture was corrected in `7e5c0278283145a84dc3f6f67f5cffe31c7de7bf`. No model weights, training state, corpus, or production routing changed.
- Canonical Verify Run #628 (ID `45359517194`) on `7e5c0278283145a84dc3f6f67f5cffe31c7de7bf` passed: **283 passed, 24 warnings**. Compile, exact parameter/FLOP report, V2 contract, architecture notebook, safe notebook preflights, FineWeb-2 cursor resume, notebook validation, and workflow isolation all passed.

**Resource gate remains open**
- Runs #622, #623, and #628 were push-triggered. Their `Measure V3 CPU memory and throughput from existing artifacts` jobs were correctly **skipped** because the job is manual-only. No resource benchmark artifact or measured RSS/throughput exists yet.
- To execute the existing job, dispatch `.github/workflows/onecore-ci.yml` on `research/onecore-v3-implementation` with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. Do not dispatch corpus restore again; the validated corpus and tokenizer artifacts are already pinned.
- No V3 optimizer training or optimizer update was started. The full checkpoint save/restore bound to the real tokenizer, validated manifest fingerprint, production cursors, RNG and parent lineage is still not evidenced. Do not build/start the multi-session trainer or infer production readiness until the resource and full checkpoint gates pass.
- V3 head at this update: `7e5c0278283145a84dc3f6f67f5cffe31c7de7bf`. Frozen Foundation remains `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No new PR, branch, workflow, or merge was created.


## 2026-11-24 — Joint five-family CPU memory preflight

**Implementation**
- The existing manual-only V3 resource benchmark now runs both the per-family inference/forward-backward cases and a separate joint worker.
- The joint worker loads one bounded, hash-verified external train micro-batch for each of text, tool, image, audio and video; text/tool use the real V3 tokenizer, images retain native dimensions, audio uses the canonical 24 kHz training derivative, and video preserves the selected frame timestamps.
- It performs forward/backward passes in the required five-family order while accumulating gradients, then allocates the AdamW exp_avg, exp_avg_sq, and scalar step tensors for every trainable parameter without calling optimizer.step. It reports parameter bytes, gradient bytes, AdamW-state bytes, peak RSS, per-family forward/backward throughput and total joint elapsed time.
- The benchmark explicitly records optimizer_updates=0 and optimizer_step_executed=false; this is resource measurement on one representative real sample per family, not training, a checkpoint, a throughput guarantee for larger batches, or quality evidence.
- Unit tests cover five-family plan completeness, bounded audio/video selection, exact AdamW-state byte accounting, and unchanged model weights/no optimizer step.

**Implementation and verification**
- Code/test commit: 229033bf95fa3a7c1f33578f0764d3bf3000ac78.
- The existing resource benchmark workflow remains manual-only; ordinary push Verify does not execute it. The joint worker has not yet been run against the real artifacts, so no measured RSS/throughput result is claimed.
- Canonical CI for the documentation head must pass before this change is considered verified. The next safe resource action is the existing manual dispatch with benchmark_v3_resources=true and restore_v3_corpus=false; do not restore or refit the corpus/tokenizer.

**Safety**
- No workflow, branch, PR, corpus artifact, tokenizer artifact, model weights, checkpoint lineage, or optimizer training run was created or changed by this implementation.
- V3 remains the only active architecture; Foundation remains the frozen V2 archive; main remains unchanged.


## 2026-11-24 — Joint benchmark metric-label correction

- Corrected joint timing fields to say forward/backward rather than backward-only; the measured interval includes model forward, loss construction and backward.
- No model, data, optimizer, checkpoint or workflow behavior changed.
- Implementation commit: 8de02208624e00a33bee694deb83955ae4ccbe67.
- Canonical Verify Run #631 (ID `45370635712`) passed on documentation head `47c3eb9ab72412f68b4f22acd27e31e3d8b38009`: **286 passed, 24 warnings**; compile, exact V3 parameter/FLOP checks, V2 specification contract, architecture notebook, safe preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation all passed. The manual CPU resource benchmark and corpus restore were skipped as designed; no measured RSS/throughput artifact exists.

## 2026-11-24 — Canonical Verify after joint CPU profiler implementation

- Canonical V3 branch head before this record: `8ffe52201b08d68c118e3742e0dda3036e18632e`. Frozen Foundation remains `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`.
- Verify Run #632 (ID `45370988964`) completed successfully on the canonical V3 head. Its Verify job completed every step successfully, including compile, exact V3 parameter/dense-FLOP assertions, all unit/regression tests (**286 passed, 24 warnings**), Corrected Specification v2 contract, architecture notebook, safe notebook preflights, exact FineWeb-2 cursor resume, notebook validation, and workflow isolation. The warnings include existing PyTorch nested-tensor and notebook/kernel notices; they did not fail the run.
- Run #632's `v3-resource-benchmark` job was **skipped**, as expected for a push event; the corpus-restore job was also skipped. This is not resource evidence. No measured peak RSS, per-family throughput, or joint five-family memory result exists yet.
- The resource benchmark implementation is present in `onecore/v3/resource_benchmark.py` (joint five-family forward/backward plus explicit AdamW state preallocation, without `optimizer.step()`). Its implementation/test commit is `229033bf95fa3a7c1f33578f0764d3bf3000ac78`; metric-label correction is `8de02208624e00a33bee694deb83955ae4ccbe67`; canonical documentation/README head is `8ffe52201b08d68c118e3742e0dda3036e18632e`.
- The only approved execution path is the existing manual dispatch of `.github/workflows/onecore-ci.yml` on `research/onecore-v3-implementation` with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. Do not dispatch corpus restore, refit the tokenizer, create another workflow, or convert the benchmark into an automatic push job. No manual dispatch was initiated in this run; the available session interface did not expose a workflow-dispatch operation.
- The pinned data inputs remain unchanged: corpus artifact `14892594659` from Run #605, report artifact `14893020087`, and verified 32,000-token tokenizer artifact `14894835517` from tokenizer Run #2. Do not download the full corpus archive or repeat conversion/tokenizer fitting.
- No V3 optimizer updates, V2 optimizer training, checkpoint lineage changes, PRs, merges, or main-branch changes occurred. After the measured CPU benchmark, the next gate is a real-artifact V3 checkpoint save/restore audit binding the verified tokenizer, validated manifest/asset fingerprint, production data cursors, RNG, optimizer/scheduler state and parent lineage. Training remains prohibited until that audit passes.

## 2026-11-24 — Canonical Verify Run #633 completed; resource dispatch remains outstanding

- V3 head before this documentation record: `de674d487bafea4b9943614c2ba765b48083a4fa`. Foundation remains frozen at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. PR #10 remains merged; no OneCore PR is open.
- Canonical Verify Run #633 (ID `45381577804`) completed successfully on the V3 head. Verify job ID `138401664891` completed every step successfully: package compile, exact V3 parameter/dense-FLOP report, unit/regression suite (**286 passed, 24 warnings**), Corrected Specification v2 contract, architecture notebook, safe notebook preflights, exact FineWeb-2 cursor resume, notebook validation and workflow isolation.
- The exact V3 report remains `onecore-v3-prototype-2`, **39,906,568** trainable parameters, 123 state tensors, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`; counted dense forward FLOPs across the five reference family shapes total `291846632448`. These are structural/theoretical figures, not measured training throughput, peak RSS, or quality evidence.
- Run #633 was push-triggered. Its manual-only `v3-resource-benchmark` job (ID `138402715861`) was **skipped**, and `v3-corpus-restore` was also skipped. Run #633 produced no artifacts. Therefore no real-corpus peak CPU RSS, per-family throughput, or joint five-family memory result has yet been measured.
- The existing resource benchmark implementation and policy test are present. The only approved execution is the existing `.github/workflows/onecore-ci.yml` workflow dispatch on `research/onecore-v3-implementation` with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. Reuse corpus artifact `14892594659`, conversion report `14893020087`, and tokenizer artifact `14894835517`; do not restore corpus or refit tokenizer.
- No V3/V2 optimizer updates, checkpoint mutations, training, branch creation, PR creation, or merge occurred. The next engineering gate remains the measured CPU resource report; only after reviewing that evidence should the full real-artifact checkpoint save/restore audit be advanced.


## 2026-11-24 — Strict V3 checkpoint data-state contract

- Canonical Verify Run #634 (ID `45391440295`) completed successfully on `c97f50d1dd602e794216bd7e54799a8bc1a1b2de`: **286 passed, 24 warnings**. Compile, exact V3 parameter/dense-FLOP checks, V2 corrected-spec contract, notebooks, FineWeb-2 cursor resume and workflow isolation passed. The manual resource benchmark and corpus restore were skipped; Run #634 produced no artifacts.
- Implementation commit: `46d6b5906944b266bd2502fc077b2e4a96dcaae8`.
- V3 checkpoint data state now has its own public `V3_DATA_STATE_FORMAT_VERSION=1` contract. It must bind to the exact checkpoint manifest SHA, identify the train split only, include all five families, and reconcile each family's consumed-row count against source-specific cursors. Every source cursor must carry external-only provenance (source URL, source ID and pinned revision), family/split identity, an offset or serialized state-dict cursor, consumed-row count and a source-row SHA-256 anchor. The joint checkpoint preflight rejects any family whose consumed-row count is below global_step. Save and restore both validate this structure before checkpoint mutation.
- Eight regression cases were added for manifest mismatch, missing family, held-out split leakage, non-external/mutable source revisions, cursor-total mismatch, missing row identity, offset mismatch and joint-family step continuity.
- Canonical Verify Run #635 (ID `45402693690`) completed success on the implementation commit: **294 passed, 32 warnings**. Compile, exact V3 parameter/FLOP report, V2 spec contract, architecture notebook, safe notebook preflights, FineWeb-2 exact cursor resume, notebook validation and workflow isolation all passed. The warnings did not fail the run.
- Run #635 was push-triggered: both `v3-corpus-restore` and the manual-only `v3-resource-benchmark` jobs were skipped; no artifacts were produced. This verifies the schema and tests only, not a real-artifact checkpoint round-trip or CPU resource envelope.
- Current V3 head at this record: `46d6b5906944b266bd2502fc077b2e4a96dcaae8`. Foundation remains frozen at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. PR #10 remains merged; no OneCore PR was opened.
- No V2 or V3 optimizer updates, training runs, checkpoint lineage changes, corpus restore, tokenizer refit, branch creation, workflow creation or merge occurred.
- The next blocker remains execution of the existing manual CPU resource benchmark with `benchmark_v3_resources=true` and `restore_v3_corpus=false`, using the already pinned corpus/report/tokenizer artifacts. The available GitHub connector exposes read and repository-write operations but no workflow-dispatch operation in this session, so the benchmark was not triggered. After its measured report passes review, implement/execute the full real-artifact checkpoint round-trip using the verified tokenizer, manifest fingerprint and actual production cursors. The new cursor schema is a contract, not evidence that a production data loader exists. Training remains prohibited.


## 2026-11-24 — Joint CPU benchmark now follows the real V3 objective

- Review of the previous joint profiler found that it measured text next-token loss plus image/audio/video reconstruction diagnostics, but omitted the production `OneCoreV3Objective` flow-matching heads and its image-pyramid, multi-resolution audio-STFT, and video-temporal losses. That would understate the intended joint training memory/throughput envelope.
- Implementation/test commit: `15fec32680ffebc4e676b523cc1ca48c0e3b224d`. The joint worker now calls `OneCoreV3Objective` once for each real micro-batch in the required text → tool → image → audio → video order, performs one backward per family while retaining accumulated gradients, records the actual objective terms/default weights, then preallocates AdamW moment/step state. It does **not** call `optimizer.step()`; optimizer updates remain zero and model weights remain unchanged.
- The isolated per-family diagnostic cases remain explicitly labelled as reconstruction-only backward measurements. They are not presented as full-objective training throughput. The joint result records whether alignment loss or optional image/audio discriminators were included; the current single-record micro-batches have no paired `condition_ids`, and no optional discriminators are configured.
- Canonical Verify Run #637 (ID `45416677179`) passed on the implementation commit: **296 passed, 32 warnings**. Compile, exact V3 parameter/dense-FLOP checks, V2 specification contract, architecture notebook, safe preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation passed. The manual-only resource benchmark and corpus restore were skipped for this push event.
- Review of the full objective then exposed a separate stereo integration defect: `NeuralAudioCodec` and V3 configuration support mono/stereo, but `audio_multiresolution_stft_loss` rejected any channel count other than one. This would make the actual joint objective fail on stereo training records.
- Stereo-loss implementation/test commit: `1861e879df3c42c0a6b1a8b5c1a3b45d20263e34`. The loss now accepts mono `[B,T]` and mono/stereo `[B,C,T]` with `C∈{1,2}`, computes waveform and STFT losses independently across flattened batch/channel rows, and rejects unsupported channel counts. Added direct stereo-loss gradient coverage and a stereo `OneCoreV3Objective` regression test.
- Canonical Verify Run #638 (ID `45417256809`) passed on that commit: **298 passed, 33 warnings**. Compile, exact V3 parameter/dense-FLOP checks, V2 specification contract, architecture notebook, safe preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation all passed. The manual-only resource benchmark and corpus restore were skipped; Run #638 produced no artifacts.
- Structural V3 figures remain unchanged: `onecore-v3-prototype-2`, **39,906,568** parameters, 123 state tensors, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, counted five-family dense forward FLOPs `291846632448`. These are not measured RSS, throughput or quality evidence.
- Pinned inputs remain corpus artifact `14892594659` (24,432,975,285 bytes), conversion report `14893020087`, and verified 32,000-token tokenizer artifact `14894835517`. They were still non-expired at this inventory; do not redownload the full corpus, repeat conversion, or refit the tokenizer.
- Current V3 head before this reference update: `1861e879df3c42c0a6b1a8b5c1a3b45d20263e34`. Frozen Foundation remains `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No OneCore PR is open; no new branch, workflow or automation was created.
- The real CPU benchmark has still **not** been executed. The only approved path remains the existing manual dispatch of `.github/workflows/onecore-ci.yml` on V3 with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. The available GitHub session interface exposes no workflow-dispatch operation, so no run or resource result is fabricated. After measured RSS/throughput, complete the real-artifact V3 checkpoint save/restore audit with tokenizer, manifest, production cursors, optimizer/scheduler, RNG and parent lineage. No V3 optimizer training is allowed before those gates pass.


## 2026-11-24 — Resumable V3 five-family train loader: CI evidence

- Implementation commit: 016274b3cd0fc0153e4157b641802b215ef0d79a. Float-tolerance test-only correction: 8b7c0aecaf5284b7c64ca081763d98cdf6e6933e.
- Verify run #641 (GitHub Actions run ID 45433940836) completed success on the corrected head. It passed compile, exact V3 parameter/FLOP checks, all notebooks and workflow-isolation checks, and 301 unit/regression tests (33 warnings). The preceding #640 failure was only an exact-float assertion in the new timestamp test; the assertion now uses numeric tolerance and #641 passed.
- Exact instantiated V3 structural report remains 39,906,568 parameters, 123 state tensors, config SHA-256 6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708, FP32 parameter storage 159,626,272 bytes, FP16 79,813,136 bytes, and five-family dense forward FLOPs 291,846,632,448. These storage/FLOP values are not measured peak RSS, training throughput, or quality evidence.
- The production loader tests use small local fixtures with external provenance and valid five-family split quotas. They prove tensor contracts, canonical 24 kHz audio windows, native-resolution images, contiguous timestamped video windows, deterministic source balancing, checkpoint-compatible cursor state, strict source-row anchor restoration, and all-five-family atomic cursor commits. They do not prove that the 24.43 GB production corpus has been streamed through the loader or that a full artifact-backed checkpoint round-trip has occurred.
- Run #641 skipped both manual-only jobs: V3 corpus restore and CPU memory/throughput benchmark. No corpus artifact was downloaded or rebuilt, and no optimizer update/training occurred.
- The next blocking action remains the existing workflow_dispatch with restore_v3_corpus=false and benchmark_v3_resources=true. Push CI must remain Verify-only. The current GitHub connector exposes no workflow-dispatch action, so this session did not fabricate a benchmark run or change the workflow trigger.
- Run #55 (V2 legacy, ID 45017683783) is now completed failure in its evaluation-only job: validation omitted image_reconstruction. All acquisition/training/preservation jobs were skipped; optimizer updates remained zero. Do not rerun it or alter the frozen Foundation archive.
- Canonical refs after this implementation: V3 code/test head 8b7c0aecaf5284b7c64ca081763d98cdf6e6933e; frozen Foundation 6d5dd21982f8f4a835e07b0f004b1621be57ba96; main unchanged 0b5ec69e839bfc6086a358511b54649b03c7be9a.


## 2026-11-24 — Same-record media text conditioning and benchmark parity

- V3 train-loader implementation commit: `eecaba56bbbce5ab2a5548a6f0874013c92759be`. It tokenizes only the caption/transcript stored on the same immutable external media row: `image_caption → caption`, `audio_text → transcript`, and `video_caption → caption`. Those IDs are passed into the modality flow objective as `condition_ids`, so the shared semantic core receives text context for conditional image/audio/video flow training. Reconstruction-only rows remain unconditioned. Caption/transcript tasks with missing paired text now fail the train-index preflight instead of silently degrading to unconditional examples. The loader records the condition field, source-row relationship, text SHA-256 and deterministic bounded token-window metadata; its sampling-policy fingerprint binds this behavior for strict resume.
- The first Verify attempt, Run #643 (ID `45436262164`), failed in two new tests only: one assertion compared a bounded 16-token condition window to the full caption, and the negative-test fixture wrote literal backslash-n separators. The implementation compiled; 300 other tests passed. Test-only correction commit: `a24ec3ce5f471ed62a2a93b8ed6671dcc21644e3`, which asserts the exact deterministic window and writes real line separators.
- Canonical Verify Run #644 (ID `45436650787`) passed on the corrected head: **302 passed, 33 warnings**. Compile, exact V3 parameter/dense-FLOP checks, V2 corrected-spec contract, architecture notebook, safe preflights, FineWeb-2 exact cursor resume, notebook validation and workflow isolation passed. Both manual-only jobs (corpus restore and CPU resource benchmark) were skipped; no artifacts were produced.
- The joint CPU profiler was then brought into parity with the new data path in commit `b3a5c56488c6341d69605b21f13315c88210793d`. It selects caption/transcript text from the exact same external train row, prefers a bounded paired example where available, binds its condition IDs to the row hash and condition-text SHA-256, and passes those IDs to the same `OneCoreV3Objective` used for the five-family joint backward measurement. The report now identifies `conditioned_families` and per-family condition metadata. It does not manufacture pairs. Since each family still has one record per micro-batch, contrastive alignment loss remains excluded; the report states that limitation explicitly.
- Canonical Verify Run #645 (ID `45437602390`) passed on commit `b3a5c56488c6341d69605b21f13315c88210793d`: **303 passed, 33 warnings**. Compile, exact V3 parameter/FLOP checks, V2 specification contract, notebooks, FineWeb-2 cursor resume and workflow isolation passed. The manual CPU benchmark and corpus restore were skipped on this push event; no resource artifact or measurement was produced.
- Exact V3 structural figures remain unchanged: **39,906,568** trainable parameters, 123 state tensors, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, and five-family dense forward FLOPs `291846632448`. These are structural/FLOP figures, not peak RSS, throughput, training, or generation-quality evidence.
- Current V3 head before this documentation update: `b3a5c56488c6341d69605b21f13315c88210793d`. Foundation remains frozen at `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No OneCore PR is open. No branch, workflow, corpus restore, tokenizer refit, optimizer update, training run, or merge was created/performed.
- The highest remaining blocker is still the existing manual-only CPU resource benchmark with `benchmark_v3_resources=true` and `restore_v3_corpus=false`, using the pinned corpus/report/tokenizer artifacts. The current GitHub connector still exposes no workflow-dispatch operation, so this run did not fabricate a benchmark or change the Verify-only push policy. After real RSS/throughput evidence, complete the full artifact-backed V3 checkpoint round-trip with the actual tokenizer, manifest fingerprint, production cursors, optimizer/scheduler, RNG and parent lineage. No V3 optimizer training is permitted before those gates pass.


- Documentation commit `f105a09bd82d4055c632296ef39df189b816956d` (README and this architecture-reference update) was itself verified by canonical Verify Run #646 (ID `45438142701`): success, **303 passed, 33 warnings**. Exact V3 parameters/config/FLOPs, V2 contract, notebook execution/preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation all passed. Both manual-only jobs were skipped and no artifacts were produced. Current V3 head at this evidence append is `f105a09bd82d4055c632296ef39df189b816956d`; Foundation and `main` remain at their frozen SHAs above.



## 2026-11-24 — Resource benchmark RSS accounting hardening

- Implementation/test commit: `a0cecff64992853d75003abb074b4e33b19f7a8b`. The bounded V3 CPU profiler previously reported each worker process's `ru_maxrss` but omitted the resident memory held by the parent process that scans manifests, verifies artifact metadata and launches workers. It now samples Linux `/proc` parent+worker RSS at 20 ms intervals for every per-family and joint worker, records the parent process's kernel peak, preserves each worker's own kernel peak, and reports both the observed process-tree sample and a conservative sum-of-maxima upper bound. The latter may overestimate because separate per-process maxima need not occur simultaneously; the report labels the distinction rather than presenting storage arithmetic as measured peak memory.
- Added a Linux subprocess regression test that allocates and touches 32 MiB in a child while the parent remains resident, and asserts the combined RSS sampler observes the increase.
- Canonical Verify Run #648 (ID `45462811203`) completed success on this implementation commit: **304 passed, 33 warnings**. Compile, exact V3 parameter/dense-FLOP checks, V2 specification contract, architecture notebook, safe notebook preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation all passed. The new RSS regression is included in the 304-test suite.
- Both manual-only jobs (corpus restore and CPU resource benchmark) were skipped on the push event; no resource report/artifact was produced and no optimizer update occurred. This CI result verifies the measurement code, not an actual OneCore CPU memory/throughput result.
- The pinned corpus artifact `14892594659` (24,432,975,285 bytes), conversion report `14893020087` (892,194 bytes), and tokenizer artifact `14894835517` (394,036 bytes) were rechecked and remain non-expired. Corpus/report expire 2026-12-24; tokenizer expires 2027-02-22. Do not redownload or refit them.
- Current implementation head before this documentation evidence append: `a0cecff64992853d75003abb074b4e33b19f7a8b`. Frozen Foundation remains `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No OneCore PR, branch, workflow, corpus restore, tokenizer refit, optimizer update, training run, or merge was created/performed.
- The remaining blocker is still the existing manual `workflow_dispatch` on V3 with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. The connected GitHub tools expose no workflow-dispatch operation, so no benchmark run is fabricated and Verify-only push behavior remains unchanged. After measured CPU evidence, run the full artifact-backed V3 checkpoint save/restore using the actual tokenizer, manifest fingerprint, production loader cursors, optimizer/scheduler, RNG and parent lineage. No V3 optimizer training is permitted before those gates pass.


## 2026-11-24 — Production five-family data-loader benchmark

- Implementation commits: `d90d0c65389253ce564f1365c64a186f770b5d66` added a production-loader benchmark view and worker; `fb969ee30eb41e5ee90ff648898feb7e9e3a1bd7` corrected a test's expected tokenizer error wording; `be8d72988cf9a69b532ab9c62ac082bb0e28643a` added loader RSS accounting, source-bundle binding, bounded-video regression coverage, and truthful asset-file-size labels.
- The manual CPU profiler now constructs temporary, deterministic external-only loader manifests with exactly 100 train / 10 validation / 10 test rows per family. It samples only immutable pinned external rows, verifies every selected raw/training asset against the existing conversion report's SHA-256 map, and records the full source manifest-bundle SHA-256 plus the original full tokenizer train-manifest SHA-256. It does not re-acquire or download the 24.43 GB corpus ZIP in full; it range-extracts only the selected sample assets and the three manifests.
- The benchmark-only `V3JointDataLoader` view is explicit and non-checkpointable. Normal training still requires the tokenizer evidence to match the exact full train manifest; the override is accepted only for a benchmark view, and `state_dict`/`load_state_dict` reject that view. Temporary video manifests preserve the source-row hash and timestamps while clipping the selected frame list to the configured bounded window (16 frames by default); original corpus manifests/assets are not modified.
- The loader worker reports initialization time, measured joint steps/second, five-family micro-batches/second, per-family records and task-native units/second (text/tool tokens, image megapixels, audio seconds, video frames), referenced asset-file-size footprint, and worker RSS. Referenced file sizes are explicitly not represented as exact storage bytes read. The parent process-tree RSS sampler now includes the loader worker as well as per-family and joint workers; the report retains both observed process-tree samples and the conservative sum-of-maxima upper bound.
- The benchmark remains resource-only: two warm-up plus twenty measured joint loader steps by default, no model forward/backward in the loader worker, no optimizer updates, no checkpoint writes, and no quality claim. It runs only through the existing manual `workflow_dispatch` input `benchmark_v3_resources=true` with `restore_v3_corpus=false`; ordinary push Verify remains unchanged.
- Verify Run #650 (ID `45475424094`) on implementation commit `d90d0c6` exposed one test-only failure: the code raised the intended tokenizer training-manifest fingerprint mismatch, but the regression test matched the shorter phrase `train manifest`. The assertion was corrected in `fb969ee`. Verify Run #651 (ID `45475730477`) then completed success: **307 passed, 33 warnings**. Verify Run #652 (ID `45476259707`) on `be8d729` completed success: **308 passed, 33 warnings**. Compile, exact V3 parameter/FLOP budget, V2 contract, architecture notebook, safe notebook preflights, FineWeb-2 cursor resume, notebook validation, and workflow isolation all passed.
- Both manual-only jobs were skipped on push Verify; no resource report/artifact was produced and no CPU RSS/throughput value was measured. The new tests exercise the real loader on local fixtures, deterministic external-only sampling, bounded video-prefix provenance, and inclusion of the loader worker in RSS accounting; they do not substitute for the manual benchmark on the pinned corpus.
- Corpus artifact `14892594659` remains non-expired (24,432,975,285 bytes; digest `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`), conversion report `14893020087` remains non-expired (892,194 bytes; digest `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`), and tokenizer artifact `14894835517` remains non-expired (394,036 bytes; digest `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`). They were inspected by metadata only; none was redownloaded or refitted.
- Run #605 (ID `45325008221`) is now confirmed completed success, including conversion, external-only gate, and corpus upload. Run #608 (ID `45331649466`) completed Verify success; its manual restore job was skipped. The corpus gate remains the previously proven 100/10/10 minimum for all five families, with zero conversion errors and zero synthetic additions.
- Frozen Foundation Verify Run #611 (ID `45334531358`) failed one legacy test because it still expected the pre-archive V2 bootstrap workflow expression; 168 other tests passed. Foundation remains frozen by owner decision and was not modified. V2 Run #52 (ID `45015944155`) was cancelled during evaluation; Run #55 (ID `45017683783`) failed during evaluation; both acquisition/training jobs were skipped, and no V2 optimizer training was started.
- Current V3 implementation head before this documentation update: `be8d72988cf9a69b532ab9c62ac082bb0e28643a`. Frozen Foundation remains `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No OneCore PR is open. No branch, workflow, corpus restore, tokenizer refit, optimizer update, training run, or merge was created/performed in this work.
- The remaining blocker is the actual manual CPU resource run. The connected GitHub tools expose no workflow-dispatch operation, so this run did not fabricate a measurement or weaken the Verify-only push policy. After genuine RSS/throughput evidence, perform the full artifact-backed V3 checkpoint save/restore using the actual tokenizer, validated full manifest, production data cursors, optimizer/scheduler, RNG, and parent lineage. No V3 optimizer training is permitted before those gates pass.


## 2026-11-25 — Premature V3 training trigger blocked; active run quarantined

- A newly added .github/workflows/onecore-v3-training.yml had a push trigger on onecore-ai/v3-training-request.json. Commit 23b39d7de1be3b8c75e5e6da1b68d87889e5c7e2 therefore started GitHub Actions training Run #1 (ID 45483538417) before the required real CPU resource benchmark and full artifact-backed V3 checkpoint round-trip had passed.
- Run #1's Verify job succeeded, but its training job is still in_progress at the step named Run the first real five-family optimizer update. The last artifact inventory returned no artifacts. The in-progress job log endpoint returned 404/BlobNotFound, so the number of optimizer updates, whether a checkpoint has been written locally, and the final outcome cannot yet be verified. Do not treat this run as approved training evidence or resume from any checkpoint it may publish until it is quarantined and independently audited.
- The preceding canonical Verify Run #663 (ID 45483538322) passed, but its manual-only CPU benchmark was skipped. It therefore did not satisfy the missing resource gate or authorize training.
- Safety correction committed on V3 as c91fae4686a4de1d7d37d35ef63be7222d569df7: removed the training workflow's push trigger and set the train job to if: false. The existing workflow remains staged for later engineering; it now runs Verify only and cannot start another optimizer job from a request-file push. Added a regression test to test_v3_workflow_policy.py that asserts the absence of the push trigger and the disabled train job.
- Canonical Verify Run #664 (ID 45488400996) completed success on c91fae4686a4de1d7d37d35ef63be7222d569df7: compile, exact V3 report, 313 passed / 35 warnings, V2 contract/FLOPs, architecture notebook, safe preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation all passed. Exact V3 structural figures remain 39,906,568 parameters, config SHA-256 6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708, and five-family dense forward FLOPs 291846632448; none is a measured resource envelope.
- The active Run #1 cannot be cancelled through the connected GitHub actions available in this session (they expose run/job reads and reruns, but no cancel operation). The guard commit does not retroactively stop that already-running job. It must be cancelled through GitHub Actions by an authorized repository user; if it completes first, preserve its artifact for forensic review only and do not use it as the approved training lineage.
- The CPU benchmark remains unexecuted; the real-artifact checkpoint save/restore audit remains unexecuted. V3 optimizer training remains blocked. No corpus restore, tokenizer refit, PR creation, branch creation, merge or main change was made in this safety correction.
- Refs at this record: V3 guard commit c91fae4686a4de1d7d37d35ef63be7222d569df7; frozen Foundation 6d5dd21982f8f4a835e07b0f004b1621be57ba96; main 0b5ec69e839bfc6086a358511b54649b03c7be9a.


## 2026-11-25 — Forensic closure of premature training Run #1

- Run #1 (GitHub Actions ID `45483538417`, attempt 1) is now **terminal**: workflow status `completed`, conclusion `failure`; the training job `138763583986` completed with conclusion `failure` at `2026-11-24T21:31:47Z`. Its preflight/verification job completed successfully. This supersedes the earlier note that Run #1 was still active and needed manual cancellation.
- The job API remains internally inconsistent: the step `Run the first real five-family optimizer update` still reports `in_progress` with no completion timestamp, while the job itself is terminal failure; the later checkpoint-upload and summary steps remain pending. The workflow-run artifact inventory is empty. The job-log endpoint returns HTTP 404 `BlobNotFound`. Therefore the number of optimizer updates, whether any local checkpoint was written before runner termination, and the precise failure cause cannot be established from retained evidence. No checkpoint artifact exists to audit or quarantine. **Do not resume this run or accept any output from it as approved V3 lineage.**
- The safety guard remains in force at V3 head `334001f0b16f0ed0d0ec38ddbd0616bfd73a9f90`: `.github/workflows/onecore-v3-training.yml` has only a manual `workflow_dispatch` trigger and its `train` job is explicitly `if: false`. The regression test covers both conditions. Canonical Verify Run #665 (ID `45488829927`) completed success on this head: **313 passed, 35 warnings**; compile, exact V3 parameter/FLOP checks, V2 contract checks, notebooks, FineWeb-2 cursor-resume and workflow-isolation checks passed.
- Run #665 is verification evidence only. Its manual CPU resource benchmark and corpus-restore jobs were skipped. The real CPU peak-RSS/throughput benchmark has still not run, and the full artifact-backed V3 checkpoint save/restore audit (actual tokenizer, validated full manifest, production cursors, optimizer/scheduler, RNG and parent lineage) has still not run. No optimizer training is authorized.
- The connected GitHub interface in this session exposes neither workflow dispatch nor run cancellation. No benchmark run was fabricated, no trigger was weakened, and no training was resumed. The next permitted operation remains the existing manual `onecore-ci.yml` dispatch with `benchmark_v3_resources=true` and `restore_v3_corpus=false`, followed by the real-artifact checkpoint round-trip only after reviewing the benchmark.
- Refs remain: V3 `334001f0b16f0ed0d0ec38ddbd0616bfd73a9f90`; frozen Foundation `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No OneCore PR is open; no corpus restore, tokenizer refit, checkpoint mutation, optimizer update, branch creation or merge occurred.


## 2026-11-25 — Immutable V3 resource-benchmark artifact identity pinning

- Resource-benchmark hardening implementation commit: `bd0b89fa3e76490eddfb759ef1e65bd8f21b6670`. Before any Range reads, the benchmark now pins and verifies the exact GitHub artifact ID, producing run ID, artifact name, byte size, and GitHub SHA-256 digest for all three immutable inputs:
  - Corpus: artifact `14892594659`, Run `45325008221`, `onecore-v3-corpus-45325008221`, **24,432,975,285 bytes**, digest `sha256:302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`.
  - Conversion report: artifact `14893020087`, Run `45325008221`, `onecore-v3-conversion-report-45325008221`, **892,194 bytes**, digest `sha256:151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`.
  - V3 tokenizer: artifact `14894835517`, Run `45336933362`, `onecore-v3-tokenizer-45325008221`, **394,036 bytes**, digest `sha256:47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- The benchmark rejects altered CLI artifact/run IDs and any API metadata drift (ID, run, name, size or digest) before opening the ZIP archives. It still verifies the conversion report's manifest gate, tokenizer evidence, manifest fingerprints, and selected raw/training asset hashes. The implementation performs no corpus download, restore, tokenizer refit, optimizer update, or checkpoint write.
- The first Verify Run #667 (ID `45561029220`) on implementation commit `bd0b89fa3e76490eddfb759ef1e65bd8f21b6670` failed only in five new test cases: the Verify job installs `onecore-ai[dev]`, while `requests` and `remotezip` are intentionally optional `corpus-restore` dependencies. The tests incorrectly dereferenced the absent optional `requests` module; **314 tests passed and 5 failed**, with compile and exact V3 parameter/FLOP checks successful.
- Test-only correction commit: `3c8e5cd6b4607b626ceac6d9383fa89c636da85b`. The metadata tests now mock both optional module globals and remain independent of the corpus-restore extra.
- Canonical Verify Run #668 (ID `45561167836`) completed success on `3c8e5cd6b4607b626ceac6d9383fa89c636da85b`: **319 passed, 35 warnings**. Compile, exact V3 parameter/config/FLOP report, V2 contract, architecture notebook, safe preflights, FineWeb-2 cursor resume, notebook validation and workflow isolation all passed.
- Exact V3 structural report remains **39,906,568** trainable parameters, 123 state tensors, config SHA-256 `6c879331c75da434c58680050f94035dc15626e7af4847db1b36e055c47d7708`, and five-family dense forward FLOPs `291846632448`. These are structural figures, not measured CPU RSS, throughput, or model-quality evidence.
- Run #668 was push-triggered; the manual-only CPU benchmark and corpus restore jobs were skipped and no artifacts were produced. The three pinned inputs were rechecked through GitHub artifact metadata and remained non-expired. **The real CPU resource benchmark remains unexecuted.**
- The next permitted step remains the existing manual dispatch of `.github/workflows/onecore-ci.yml` on V3 with `benchmark_v3_resources=true` and `restore_v3_corpus=false`. The connected GitHub interface still exposes no workflow-dispatch action; do not weaken the manual-only policy or substitute an unmeasured local run. After measured CPU evidence, perform the full artifact-backed checkpoint save/restore audit before any optimizer training.
- Refs before this documentation append: V3 `3c8e5cd6b4607b626ceac6d9383fa89c636da85b`; frozen Foundation `6d5dd21982f8f4a835e07b0f004b1621be57ba96`; `main` `0b5ec69e839bfc6086a358511b54649b03c7be9a`. No OneCore PR is open. No V2/V3 optimizer update, training, corpus restore, tokenizer refit, checkpoint mutation, branch creation, workflow creation, PR, or merge occurred.
