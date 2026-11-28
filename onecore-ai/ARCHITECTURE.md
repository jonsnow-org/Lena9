# OneCore — canonical architecture

## Model contract

OneCore is a single from-scratch multimodal model. The only instantiated architecture is `onecore-v3-corrected-spec-2` in `src/onecore/v3/`. All modalities share one semantic Transformer core, one embedding space, one parameter set, one checkpoint and one optimizer/scheduler/RNG lineage.

| Property | Current value |
|---|---:|
| Trainable parameters | **57,579,201** |
| Text vocabulary | 4,096 (5,144 unified tokens including modality/special ranges) |
| Shared width | 1,024 |
| Unique Transformer blocks | 4 |
| Recurrent cycles | 3 |
| Effective block applications | 12 |
| Attention heads | 8 |
| Native T-LDM latent slots | 16 |
| T-LDM objective weight | 0.15 (text and tool) |

CI asserts the exact parameter count and configuration/FLOPs fingerprint. T-LDM reuses existing components and contributes **zero additional trainable parameters**.

## Shared model path

Text tokens, tool prompts/actions, image latents, waveform-audio latents and video-frame latents are projected into the shared width and processed by the same recurrent semantic core. A modality embedding marks the token family. The text output projection is tied to the text embedding. Image, audio and video have independent flow heads so their different latent distributions do not share one final projection.

A joint optimizer update accumulates one micro-batch from each family in the order text, tool, image, audio, video and performs one optimizer step after the five losses are accumulated.

## Native T-LDM

T-LDM is not a second model or a detached head. It is an additional operation through the existing OneCore model:

1. Embed the text/tool token sequence with the existing text embedding and modality embedding.
2. Zero the embeddings at selected masked positions so their target identities are not visible.
3. Compress the sequence into at most 16 latent slots with adaptive average pooling.
4. Run those slots through the existing shared Transformer as the latent thinker.
5. Concatenate the latent context with the visible token states and run the same shared Transformer as the diffusion writer.
6. Use the existing tied text output projection to predict the shared vocabulary.
7. During generation, reveal high-confidence masked positions over a bounded number of refinement passes.

The training objective keeps the causal loss and adds masked-token cross-entropy only at selected valid positions. The current T-LDM weight is 0.15 for text and tool batches. The image/audio/video families retain their modality-specific objectives.

## Modality paths

- **Image:** variable-height/width patch encoding; original dimensions and aspect ratio are preserved and decoded output is cropped to the requested dimensions.
- **Audio:** mono/stereo waveform codec with residual vector quantization; training waveform inputs are normalized to 24 kHz, and source metadata is retained.
- **Video:** frame-wise image encoding, timestamp-aware temporal processing and bounded temporal windows. Long-range video memory is not a full KV cache.
- **Tool use:** tool prompts and structured action/response tokens share the same text vocabulary. Generated text is not executed as code.

## Checkpoint and data lineage

The checkpoint binds model state, optimizer, scheduler, global step, configuration fingerprint, tokenizer bytes/hash/vocabulary, manifest and asset hashes, five-family source cursors, Python/NumPy/Torch RNG states and parent-checkpoint SHA. Train, validation and test are isolated. Synthetic fixtures are for software tests only and do not count as real corpus coverage or model-quality evidence. The historical 32,000-token tokenizer is excluded from this model. Its replacement is fitted from the pinned external TRAIN text only to exactly 4,096 tokens; validation and test are excluded. The new artifact must be content-hash verified and pinned before checkpoint audits or training.

## Known limits

The model is untrained. Image, audio and video generation quality is unmeasured. The image codec is a trainable patch baseline, the audio codec is not yet a production speech/music system, and the video path uses bounded temporal windows. Attention remains quadratic. GAN discriminators do not yet have a complete alternating optimizer schedule, and current one-record-per-family micro-batches do not meaningfully activate multi-example contrastive alignment.

Do not describe OneCore as production-ready or claim human-level, professional or certified output quality until trained checkpoints have passed independent real-data evaluation and human review.
