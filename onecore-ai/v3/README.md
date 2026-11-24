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
- The independent V3 checkpoint/resume format and full-lineage round-trip/mismatch tests are implemented; canonical V3 Verify Run #608 passed. The V3 tokenizer training/verification utility is implemented but has not yet been fitted to the final recovered corpus. The external-only corpus gate passed in Run #602; Run #605 is still completing the final artifact-publication workflow. No V3 multi-session training workflow or production inference API exists yet, and media quality is unmeasured.
- The bounded corpus-restore job is manual-only: use `workflow_dispatch` and explicitly set `restore_v3_corpus=true`. Normal code pushes run Verify only. Restore uses the optional `corpus-restore` extra, CPU PyTorch 2.11 or newer, TorchCodec 0.17, and FFmpeg shared libraries; the job installs these explicitly and keeps Hugging Face media decoding disabled so the converter can preserve original encoded payloads and perform its own audio/video ingestion.
- The optional GAN discriminators require a separately configured discriminator
  optimizer and stable alternating updates; this is not yet a full adversarial trainer.
- The V3 five-family external manifest gate and final artifact publication completed successfully in Run #605. The tokenizer is a separate train-only CPU step and does not start model optimizer updates.

## Next required engineering gates

1. Run #605 completed successfully and published the validated V3 corpus artifact; do not rerun media restoration for this pinned corpus.
2. Pass CI for the independent checkpoint format and its complete model/optimizer/scheduler/RNG/tokenizer/manifest/cursor/lineage round trip plus all negative mismatch tests.
3. Use the dedicated `onecore-v3-tokenizer.yml` workflow to range-extract only `data/train.jsonl`, fit the exact 32,000-token external-only tokenizer, verify its evidence sidecar, and preserve its SHA-256 for the V3 checkpoint. The V3-native trainer is implemented; the actual corpus tokenizer has not yet been fitted. Never reuse the V2 tokenizer.
4. Recompute and freeze exact V3 parameter/FLOPs values, then measure peak CPU RSS and throughput using the validated corpus and real data loader (not storage estimates or synthetic-only smoke batches).
5. Implement the bounded multi-session CPU trainer that restores the same V3 checkpoint lineage and dataset cursors, then expose V3 inference only after checkpoint and resource gates pass.
6. Run independent text/tool/image/audio/video validation and held-out test evaluations bound to checkpoint, tokenizer, config and corpus hashes; no promotion threshold is inferred from training loss.

V2 remains a frozen legacy baseline; its weights/checkpoints/optimizer/tokenizer are not imported into V3.

All output-quality claims require measured evidence tied to checkpoint, tokenizer,
codec, config and dataset-manifest hashes. No quality thresholds are inferred here.


### V3 tokenizer implementation — 2026-11-24

Added the independent `onecore.v3.tokenizer` module and `onecore-v3-tokenizer` package command:
- Reads the V3 train manifest only, selects `task=text`, requires explicit `data_class=external`, HTTP(S) source URL, immutable source revision and unique source-row SHA-256. Rejects bootstrap/synthetic/owner-curated rows, non-train records, duplicate IDs/source rows, short rows and invalid provenance.
- Fits byte-level BPE with NFC normalization and the exact `V3Config.text_vocab_size` (32,000 by default); it does not import V2 tokenizer vocabulary or files.
- Writes tokenizer JSON and a sidecar evidence document containing config/manifest/tokenizer SHA-256, text-row digest, actual vocabulary, special-token IDs and the external train-only contract. Existing artifacts are never overwritten.
- Adds a verifier that reloads the serialized tokenizer and rejects changed bytes, wrong vocabulary, invalid special-token IDs, config mismatch, missing evidence, non-external or non-train evidence, validation/test usage, and manifest mismatch.

Regression tests cover a tiny exact-vocabulary BPE fit, pinned external train-only filtering, invalid revision/row hashes/URLs, bootstrap rejection, special-token evidence and SHA-256 mismatch, output immutability and overwrite refusal. The tokenizer implementation/tests passed V3 Verify Run #608. The actual 32,000-token tokenizer is **not yet fitted**; the dedicated corpus-bound workflow performs the one-time fit after CI. Do not label a tokenizer as fitted until the resulting JSON and evidence sidecar exist and verify successfully.


### V3 tokenizer request and execution — 2026-11-24

The dedicated workflow reads the successful Run #605 corpus artifact by immutable run and artifact IDs. It uses HTTP byte-range access to extract only `data/train.jsonl`; it does not download the 24.43 GB media archive. It fits and verifies the exact 32,000-token V3 byte-level BPE vocabulary with external train text only, then publishes tokenizer JSON and SHA-256 evidence as an Actions artifact. The workflow is idempotent and refuses to overwrite or silently refit an existing tokenizer artifact. This step does not perform model optimizer updates.
