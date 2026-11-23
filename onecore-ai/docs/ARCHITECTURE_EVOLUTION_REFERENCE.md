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


### V3 restore checkpoint audit and bounded retry improvement — 2026-11-23

The V3 branch now includes resumable media progress and indexed Dataset Viewer fallback (commits `f074c3a` through `12c6539`). CI Run #599 on `12c65397d452ee7dff29a140fea3309e36752091` passed the full Verify job but correctly failed the external-only V3 corpus gate. Its report artifact is `14836372267` (`onecore-v3-conversion-report-45189488873`, SHA-256 `542a8a2c2eaf1f8b4e9761377dec6efaee1608494edcd58c98e8be8c290e990`).

Evidence from Run #599:
- 655,427 V2 input records; 653,187 converted; 1,302 non-external rows excluded; 37 pinned Arabic Speech Corpus rows were not found in the pinned source stream.
- Resumable progress successfully reused 1,190 previously restored media rows and restored 119 media rows through Dataset Viewer fallback.
- All audio quotas and video train/validation quotas were present. Video test was 9 (one missing row); the remaining video restore error was a transient HTTP 502 from Dataset Viewer rows and filter endpoints for one pinned video.
- OpenImages train still had 900 pending image rows. The first bounded 10,000-row source chunk completed in 146.86 seconds without a match and correctly saved its stateful cursor; validation and test each restored 10 images. The gate therefore correctly reported zero usable OpenImages train assets, despite 900 candidates in the V2 manifest.
- The durable partial restore artifact is `14835553943`, 22,962,354,839 bytes, and includes the JSONL progress, raw assets and source cursors. It is a partial restore snapshot, not a validated V3 corpus.

Targeted follow-up:
- Retry only transient Dataset Viewer HTTP 408/425/429/500/502/503/504 and URL transport failures with bounded exponential backoff; permanent 4xx errors remain fail-fast.
- Add regression tests proving transient 502 responses recover and permanent 404 responses are not retried.
- Increase the per-run OpenImages train scan chunk from 10,000 to 100,000 rows while preserving the uploaded cursor/progress resume mechanism. This avoids repeated tiny chunks while retaining bounded, resumable work.
- The workflow resumes from the latest non-expired progress artifact. It must not reacquire the V2 corpus or replace any missing records with synthetic data.

Run #599 Verify passed; the V3 external-only data gate remains blocked until all five families meet the required split coverage with usable raw assets and hashes. No V3 training, PR or merge is authorized by this evidence. `main` remains `0b5ec69e839bfc6086a358511b54649b03c7be9a`.
