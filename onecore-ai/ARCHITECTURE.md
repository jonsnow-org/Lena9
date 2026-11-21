# OneCore unified architecture contract

## Identity

OneCore is a single foundation model trained from random initialization. It is not an ensemble, a router among independent experts, a pretrained base with adapters, or a collection of modality-specific models.

## Shared parameter path

All tasks use one trainable checkpoint:

1. A task-specific *input codec* converts raw values into vectors or code IDs.
2. Text, visual, audio, motion, and action symbols use one vocabulary ID space and one embedding matrix.
3. One recurrent Transformer core is reused for every reasoning cycle.
4. One tied language-model head predicts the next shared symbol.
5. A small decoder maps generated modality codes back to pixels, log-mel features, or motion deltas.

The embedding matrix and LM output head are tied by parameter identity. The modality encoders/decoders are included in the parameter count. They are not loaded from another model.

## Recurrent core

The current first research configuration has width 1024, 4 unique blocks and applies them for 3 cycles. Effective block applications = 12, but only 4 block parameter sets are stored. The complete trainable model has exactly **57,579,201 trainable parameters**, including all six codec Linear biases and the halt-head bias. Configuration validation, the architecture notebook, and CI enforce this exact count; any dimension change requires full recomputation and retraining.

The core uses causal self-attention, RMSNorm, and SwiGLU. Recurrent-cycle embeddings provide a learned signal indicating which pass is being computed.

An optional inference-only adaptive pass estimates when successive next-token distributions have stabilized. This is a compute heuristic, not a learned proof of reasoning or halting.

## Native latent-diffusion path

This path is an internal execution mode of `OneCore`, not a second network:

1. **Compressor:** adaptive pooling maps the current embedded sequence to a bounded latent sequence. Its inputs are the model's own learned shared embeddings.
2. **Latent Thinker:** the same recurrent blocks process the latent sequence for the configured recurrent cycles.
3. **Diffusion Writer:** latent context is expanded into the masked sequence; the same recurrent blocks and tied LM head iteratively recover hidden tokens from the shared vocabulary.
4. **Training:** a contiguous span is masked and reconstructed with bidirectional attention, while the causal next-token objective remains active. Only the masked positions contribute to the diffusion loss.

The mask is an existing reserved special-token slot. No new parameter tensor, donor weights, adapters, external tokenizer, or external inference service is introduced. The bidirectional path receives only visible context and explicit mask tokens, so target tokens are not present in its input.

## Modalities in the one vocabulary

- Text: freshly trained byte-level BPE tokenizer; text token IDs occupy the first range.
- Images: 8×8 RGB patches at 64×64 input size; a trainable linear codec quantizes patch features to shared embedding rows and decodes them to pixels.
- Audio: mono waveform to 80-bin log-mel features; grouped frames are encoded into shared audio code IDs. The current audio waveform decoder uses Griffin-Lim as a baseline, not a neural vocoder.
- Video: ordered image frames plus learned motion-delta codes between adjacent frames. The shared sequence interleaves frame and transition symbols.
- Tools/actions: text-encoded structured calls; a strict allowlisted runtime validates calls and does not execute generated shell/Python source.

## Current boundaries

This is the first executable research baseline, not a mature multimodal product. The initial synthetic curriculum teaches simple visual patterns, synthetic tones, basic motion, arithmetic and tool-call format. It does not supply broad world knowledge, robust speech understanding, photo-realistic image synthesis, natural speech synthesis, or high-quality video generation.

The next scientific gates are:
- test codebook usage/collapse and modality reconstruction quality;
- train on a large, diverse, paired multimodal corpus;
- measure text/tool and cross-modal generalization on held-out data;
- compare recurrent cycles against an equal-compute non-recurrent baseline;
- test quantization/low-bit inference only after a stable full-precision baseline exists;
- benchmark the exported model on Android CPU/RAM/battery.

Never describe a smoke/bootstrap checkpoint as a trained general intelligence.
