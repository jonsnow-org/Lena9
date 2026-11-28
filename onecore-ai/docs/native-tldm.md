# Native T-LDM inside the single OneCore model

## Decision

T-LDM is part of the canonical OneCore model, not a second model, external head or detached service. It reuses the existing shared Transformer, text embedding and tied text output projection. It adds no trainable parameters and no external model dependency.

## Forward path

`token IDs → shared text embedding + text modality embedding → zero masked token states → compression to 16 latent slots → shared-core latent thinker → concatenate latent context with visible token states → shared-core diffusion writer → tied text output head`

Implemented in:

- `src/onecore/v3/core.py::OneCoreV3.forward_tldm`
- `src/onecore/v3/core.py::OneCoreV3.generate_tldm`
- `src/onecore/v3/training.py`
- `src/onecore/v3/config.py`

The selected target positions are zeroed before compression and writing. Their original token identities are therefore not visible to the diffusion path. The latent thinker and writer are recurrent uses of the same four Transformer blocks; they do not create another stack of parameters. Generation starts with a masked block and iteratively reveals the highest-confidence token positions over a bounded number of passes.

## Training objective

For text and tool micro-batches:

1. Preserve the ordinary causal next-token loss.
2. Select a contiguous span from valid target positions.
3. Mark those positions in a Boolean mask and zero their input embeddings.
4. Run the same model through `forward_tldm`.
5. Compute cross-entropy only at the masked positions.
6. Add `0.15 × masked-token loss` to the existing family objective.

The five-family joint update still has one micro-batch each for text, tool, image, audio and video. Image, audio and video retain their own modality-specific flow objectives; they do not use text-token T-LDM loss.

## Parameter and compute accounting

The exact corrected-spec-3 model parameter count is **86,152,897** with 32,000 text tokens and 33,048 unified tokens. This replaces the historical 4K/57,579,201 contract. CI checks this exact count and the tied text embedding/head relationship. T-LDM adds zero trainable parameters.

For corrected-spec-3, the joint five-family training update at 128 tokens is 1,516,166,184,960 analytic dense FLOPs (the five-family 512/512/121/244/512 train profile totals 4,542,378,835,968). These are analytic counts, not runtime benchmarks. The native T-LDM path is:

- Latent thinker shared core: 1,214,251,008 FLOPs.
- Diffusion writer shared core: 11,381,243,904 FLOPs.
- Tied text output projection: 4,194,304,000 FLOPs.
- Total T-LDM path: 16,789,798,912 FLOPs.

The text and tool paths report 31,050,432,512 dense forward FLOPs each; the five-family joint forward report is 325,426,230,272 FLOPs for the configured profile. These are analytical FLOPs estimates, not measured latency, RAM or model quality. The real CPU benchmark is still required.

## Verification and limits

Regression tests verify that changing the original IDs at masked positions does not change T-LDM logits, that the tied head remains tied, that parameter count does not increase, that text/tool objectives include a finite T-LDM loss, and that generation returns valid shared-vocabulary IDs.

The model is not trained. No claim of improved quality or faster generation is made until a trained checkpoint passes independent real-data and human evaluation.
