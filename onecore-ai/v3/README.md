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
- The independent V3 checkpoint/resume format and full-lineage round-trip/mismatch tests are implemented; their first canonical CI verification is queued. The external-only corpus gate passed in Run #602; Run #605 is still completing the final artifact-publication workflow. No V3 multi-session training workflow or production inference API exists yet, and media quality is unmeasured.
- The bounded corpus-restore job is manual-only: use `workflow_dispatch` and explicitly set `restore_v3_corpus=true`. Normal code pushes run Verify only. Restore uses the optional `corpus-restore` extra, CPU PyTorch 2.11 or newer, TorchCodec 0.17, and FFmpeg shared libraries; the job installs these explicitly and keeps Hugging Face media decoding disabled so the converter can preserve original encoded payloads and perform its own audio/video ingestion.
- The optional GAN discriminators require a separately configured discriminator
  optimizer and stable alternating updates; this is not yet a full adversarial trainer.
- The V3 five-family external manifest gate passed 100 train / 10 validation / 10 test per family in Run #602. Run #605 repeats the final artifact-publication step; only its completed report/artifact confirms publication.

## Next required engineering gates

1. Complete Run #605 and confirm the final external-only V3 corpus report/artifact; if it fails, resume only from the durable progress artifact and exact pinned source cursors.
2. Pass CI for the independent checkpoint format and its complete model/optimizer/scheduler/RNG/tokenizer/manifest/cursor/lineage round trip plus all negative mismatch tests.
3. Build a V3-native tokenizer with exactly 32,000 tokens from external V3 training text only; publish its source manifest and tokenizer SHA-256. Never reuse the V2 tokenizer.
4. Recompute and freeze exact V3 parameter/FLOPs values, then measure peak CPU RSS and throughput using the validated corpus and real data loader (not storage estimates or synthetic-only smoke batches).
5. Implement the bounded multi-session CPU trainer that restores the same V3 checkpoint lineage and dataset cursors, then expose V3 inference only after checkpoint and resource gates pass.
6. Run independent text/tool/image/audio/video validation and held-out test evaluations bound to checkpoint, tokenizer, config and corpus hashes; no promotion threshold is inferred from training loss.

V2 remains a frozen legacy baseline; its weights/checkpoints/optimizer/tokenizer are not imported into V3.

All output-quality claims require measured evidence tied to checkpoint, tokenizer,
codec, config and dataset-manifest hashes. No quality thresholds are inferred here.
