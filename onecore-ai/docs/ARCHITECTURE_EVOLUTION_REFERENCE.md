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
