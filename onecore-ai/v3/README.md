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
- `report.py`: exact instantiated parameter count, config fingerprint and storage-only estimates.

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
- A joint v3 objective and one-step optimizer helper now exist, but there is no
  multi-session training workflow, dataset converter, checkpoint/resume format,
  production inference API, quality benchmark suite, or promotion threshold yet.
- The optional GAN discriminators require a separately configured discriminator
  optimizer and stable alternating updates; this is not yet a full adversarial trainer.
- The V3 manifest gate is implemented but has not yet been run against the complete
  recovered external media corpus.

## Next required engineering gates

1. Derive exact v3 parameter counts and configuration fingerprints from instantiated
   modules; freeze a versioned YAML config.
2. Add modality-specific training losses: image perceptual + diffusion/flow or
   adversarial objective; audio multi-resolution STFT + waveform/perceptual/adversarial
   objective; video latent denoising/flow + temporal consistency and sync objectives.
3. Add paired cross-modal alignment and text-conditioned generation objectives.
4. Preserve raw source assets and metadata (native image dimensions, video timestamps,
   frame rate/duration/audio track, audio sample rate/channels/duration); implement an
   explicit canonical-rate normalization policy before mixed-rate training; the current
   policy is polyphase resampling to 24 kHz while preserving the raw source.
5. Convert existing corpora without reacquiring completed sources; validate immutable
   external provenance and 100/10/10 per-family quotas after corrected gate.
6. Benchmark peak activation/optimizer memory, FLOPs, CPU/GPU wall-clock, and scaling
   at multiple image sizes, clip durations, and audio lengths.
7. Add round-trip, variable-length, streaming, long-context, and quality evaluations.
8. Only then create the v3 training workflow and begin training. V2 checkpoint weights
   remain preserved and cannot be loaded as if they were shape-compatible v3 weights.

All output-quality claims require measured evidence tied to checkpoint, tokenizer,
codec, config and dataset-manifest hashes. No quality thresholds are inferred here.
