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

The current first research configuration has width 1024, 4 unique blocks and applies them for 3 cycles. Effective block applications = 12, but only 4 block parameter sets are stored. The complete trainable model is expected to be approximately 57.6M parameters; CI enforces the 50–70M initial budget.

The core uses causal self-attention, RMSNorm, and SwiGLU. Recurrent-cycle embeddings provide a learned signal indicating which pass is being computed.

An optional inference-only adaptive pass estimates when successive next-token distributions have stabilized. This is a compute heuristic, not a learned proof of reasoning or halting.

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
