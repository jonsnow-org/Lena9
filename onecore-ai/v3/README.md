# OneCore v3 architecture prototype

This package is a versioned architecture experiment. It does not modify or load v2
checkpoints. It is not yet a trained generator and must not be described as having
professional output quality.

## Implemented building blocks

- `vision.py`: variable-height/width patch tokenization; original aspect ratio and
  dimensions are preserved. Inputs must be divisible by the patch size; padding or
  cropping must be explicit and recorded by the data pipeline.
- `audio.py`: trainable convolutional waveform encoder/decoder with multi-stage
  residual vector quantization. The codec accepts variable sample lengths and trims
  reconstruction to the exact source length. The code is untrained.
- `video.py`: encodes every supplied frame, accepts variable frame counts and
  timestamps, and applies causal temporal attention per spatial patch.
- `core.py`: integrates text, image, waveform audio and video latents with one
  shared Transformer semantic core and explicit modality embeddings.

## Current limits (do not hide these)

- Image quality is unmeasured. Patch decoding is a trainable codec baseline, not a
  production image diffusion/flow generator. High-resolution fidelity needs a
  hierarchical latent generator, perceptual/adversarial objectives, and tiled
  refinement.
- Audio quality is unmeasured. RVQ plus a neural decoder is structurally different
  from Griffin–Lim, but it is not a neural speech/music system until trained on
  licensed high-quality audio with spectral, waveform, perceptual and adversarial
  objectives and listening evaluations.
- Video quality is unmeasured. Variable duration is represented without truncating
  frames in this module, but the temporal attention is quadratic in frame count per
  spatial location. Long clips need chunked temporal memory/KV caching, motion
  objectives, synchronization data, and temporal consistency evaluation.
- The shared core creates dynamic sinusoidal positions and removes the learned
  fixed 512-position table. Attention is still quadratic; this is not proof of
  efficient long-context scaling. Benchmark memory, throughput, and long-context
  retrieval before selecting production sequence lengths.
- There is no v3 training loop, dataset converter, inference API, checkpoint format,
  quality benchmark suite, or promotion threshold yet.

## Next required engineering gates

1. Derive exact v3 parameter counts and configuration fingerprints from instantiated
   modules; freeze a versioned YAML config.
2. Add modality-specific training losses: image perceptual + diffusion/flow or
   adversarial objective; audio multi-resolution STFT + waveform/perceptual/adversarial
   objective; video latent denoising/flow + temporal consistency and sync objectives.
3. Add paired cross-modal alignment and text-conditioned generation objectives.
4. Preserve raw source assets and metadata (native image dimensions, video timestamps,
   frame rate/duration/audio track, audio sample rate/channels/duration).
5. Convert existing corpora without reacquiring completed sources; validate immutable
   external provenance and 100/10/10 per-family quotas after corrected gate.
6. Benchmark peak activation/optimizer memory, FLOPs, CPU/GPU wall-clock, and scaling
   at multiple image sizes, clip durations, and audio lengths.
7. Add round-trip, variable-length, streaming, long-context, and quality evaluations.
8. Only then create the v3 training workflow and begin training. V2 checkpoint weights
   remain preserved and cannot be loaded as if they were shape-compatible v3 weights.

All output-quality claims require measured evidence tied to checkpoint, tokenizer,
codec, config and dataset-manifest hashes. No quality thresholds are inferred here.
