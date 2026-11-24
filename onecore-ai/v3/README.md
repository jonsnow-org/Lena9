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
- `report.py`: exact instantiated parameter count, config fingerprint and storage-only estimates.
- `checkpoint.py`: an independent V3-only atomic checkpoint format binding model/optimizer/scheduler/global step to the exact V3 config, tokenizer JSON/hash/vocabulary, validated manifest hash, JSON cursor state, Python/NumPy/Torch CPU RNG and parent-checkpoint lineage.

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
- The independent V3 checkpoint/resume format and strict round-trip/mismatch tests are now implemented; its first CI verification is pending. The existing corpus conversion gate passed in Run #602, while Run #605 repeats the final publication check after the gate-semantics correction. No V3 multi-session training workflow or production inference API exists yet, and media quality is unmeasured.
- The bounded corpus-restore job uses the optional `corpus-restore` extra. It requires
  CPU PyTorch 2.11 or newer, TorchCodec 0.17, and FFmpeg shared libraries; the job installs
  these explicitly and keeps Hugging Face media decoding disabled so the converter can
  preserve original encoded payloads and perform its own audio/video ingestion.
- The optional GAN discriminators require a separately configured discriminator
  optimizer and stable alternating updates; this is not yet a full adversarial trainer.
- The V3 manifest gate is implemented but has not yet been run against the complete
  recovered external media corpus.

## Next required engineering gates

1. Keep the exact V3 parameter count/config fingerprint frozen; recompute both and FLOPs after every architecture change.
2. Add modality-specific training losses: image perceptual + diffusion/flow or
   adversarial objective; audio multi-resolution STFT + waveform/perceptual/adversarial
   objective; video latent denoising/flow + temporal consistency and sync objectives.
3. Add paired cross-modal alignment and text-conditioned generation objectives.
4. Preserve raw source assets and metadata (native image dimensions, video timestamps,
   frame rate/duration/audio track, audio sample rate/channels/duration); implement an
   explicit canonical-rate normalization policy before mixed-rate training; the current
   policy is polyphase resampling to 24 kHz while preserving the raw source.
5. Run the isolated V3 corpus-restore job against the existing V2 artifact; reuse
   completed text/tool rows, rehydrate raw media by pinned source hashes, and require the
   immutable external-only 100/10/10 per-family gate to pass before publishing any corpus.
6. Benchmark peak activation/optimizer memory, FLOPs, CPU/GPU wall-clock, and scaling
   at multiple image sizes, clip durations, and audio lengths.
7. Add round-trip, variable-length, streaming, long-context, and quality evaluations.
8. Build the V3 multi-session CPU training workflow and inference API only after the corpus gate, the new checkpoint round-trip CI, and measured peak CPU memory/throughput pass. V2 checkpoint weights remain preserved and cannot be loaded as if they were shape-compatible V3 weights.

All output-quality claims require measured evidence tied to checkpoint, tokenizer,
codec, config and dataset-manifest hashes. No quality thresholds are inferred here.
