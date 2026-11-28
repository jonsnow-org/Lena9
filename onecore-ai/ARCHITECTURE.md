# OneCore — canonical architecture

## Active contract: onecore-v3-corrected-spec-3

OneCore is one from-scratch multimodal model. Text, tool, image, audio and video tasks share one semantic Transformer, one embedding space, one parameter set, one checkpoint and one optimizer/scheduler/RNG lineage.

| Property | corrected-spec-3 |
|---|---:|
| Text BPE vocabulary | **32,000** |
| Unified vocabulary | **33,048** |
| Trainable parameters | **86,152,897** |
| Shared width | 1,024 |
| Unique Transformer blocks | 4 |
| Recurrent cycles | 3 |
| Effective block applications | 12 |
| Attention heads | 8 |
| SwiGLU hidden width | 2,730 |
| Maximum context | 512 |
| Native T-LDM latent slots | 16 |
| T-LDM objective weight | 0.15 (text/tool) |

The shared vocabulary ranges are contiguous: text 0–31,999; vision 32,000–32,511; audio 32,512–32,767; motion 32,768–33,023; special tokens 33,024–33,047. The text output projection is tied to the shared embedding, so this matrix is counted once.

Corrected-spec-3 supersedes corrected-spec-2 (4,096 text tokens, 5,144 unified tokens and 57,579,201 parameters). This deliberate change creates a new configuration fingerprint and checkpoint lineage; old step-zero or trained checkpoints must not be treated as compatible. The decision and exact provenance are recorded in [ADR-corrected-spec-3.md](docs/ADR-corrected-spec-3.md).

## Shared model path

Text tokens, tool prompts/actions, image latents, waveform-audio latents and video-frame latents are projected into shared width and processed by the same recurrent semantic core. A modality embedding marks the token family. The text output projection is tied to the text embedding. Image, audio and video retain modality-specific codecs and flow heads, while all tasks use the common semantic core.

A joint optimizer update accumulates one micro-batch from each family in the order text, tool, image, audio, video and performs one optimizer step after the five losses are accumulated.

## Native T-LDM

T-LDM is an operation through the existing OneCore model, not a second model or detached network:
1. Embed text/tool sequence with the existing text and modality embeddings.
2. Mask selected token embeddings so target identities are not exposed.
3. Compress to at most 16 latent slots.
4. Run latent slots through the shared Transformer as the thinker.
5. Concatenate latent context with visible token states and run the shared Transformer as the writer.
6. Predict using the same tied text output projection.
7. During generation, reveal high-confidence masked positions over bounded refinement passes.

It adds zero trainable parameters. The configured T-LDM objective weight is 0.15 for text and tool batches. Image/audio/video retain their modality-specific objectives.

## Tokenizer and checkpoint contract

The 32K byte-level BPE tokenizer is sourced from historical artifact `14894835517` (run `45336933362`). Its JSON SHA-256 is `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`, and its original evidence sidecar SHA-256 is `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`. It was fitted using 591,525 external TRAIN text rows only; the manifest and row fingerprints are pinned in the ADR and training request. Validation/test rows used: zero. Adoption preserves the tokenizer JSON bytes exactly and creates a new evidence sidecar binding the tokenizer contract and corrected-spec-3 configuration separately.

The checkpoint binds model state, optimizer, scheduler, global step, complete configuration fingerprint, tokenizer bytes/hash/vocabulary, manifest and asset hashes, five-family source cursors, Python/NumPy/Torch RNG states and parent-checkpoint SHA. The 4K tokenizer and corrected-spec-2 checkpoints are historical and are not interchangeable with corrected-spec-3.

## FLOPs and storage

FLOPs include QKV, QK, AV, output, SwiGLU and tied output projection, at two FLOPs per multiply-accumulate. For corrected-spec-3:
- Joint five-family training update at T=128: 1,516,166,184,960 dense FLOPs.
- Joint five-family training update at T=512: 6,136,611,471,360 dense FLOPs.
- Five-family forward dense total (paths 512/512/121/244/512): 1,514,126,278,656.
- Corresponding dense training total: 4,542,378,835,968.

These are analytic counts, not measured runtime. Theoretical parameter storage: FP32 344,611,588 bytes; FP16 172,305,794 bytes; AdamW moments 689,223,176 bytes. No RAM/throughput claim follows from those calculations.

## Known limitations and promotion rules

The model is untrained. Image, audio and video generation quality is unmeasured; attention remains quadratic; the audio codec is not a production speech/music system; video uses bounded temporal windows. Do not claim production readiness or certified quality until a trained checkpoint passes independent real-data evaluation and human review.

Training remains blocked until a real CPU benchmark and real-artifact step-zero checkpoint audit pass for the exact corrected-spec-3 config/tokenizer and the owner explicitly authorizes the first five-update segment. Preserve the fail-closed training guard.
