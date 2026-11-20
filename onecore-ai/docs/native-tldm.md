# Native OneCore T-LDM design

## Decision

Implement the T-LDM principle inside the OneCore foundation model, not as a Sham 2 service, external head, donor adapter, or second model. The conceptual sequence is preserved — compression, latent reasoning, iterative block writing — but its operations are native OneCore operations.

The previous Sham 2 recipe uses a frozen donor body with a separately trained Compressor + Latent Thinker + Diffusion Writer head. OneCore cannot inherit that dependency: OneCore starts from random initialization and owns its entire parameter path.

## Native data path

`token IDs -> OneCore shared embeddings -> latent compression -> shared recurrent latent thinker -> latent-context expansion -> shared recurrent diffusion writer -> tied OneCore LM head`

- **Compressor:** `compress_to_latents` uses adaptive average pooling on OneCore's already learned token/position/modality representations. The number of latent slots is bounded (default 16). It introduces no new projection matrix.
- **Latent Thinker:** `think_in_latents` processes the compressed sequence with the exact same `RecurrentBlock` objects and cycle embeddings already used by the main core.
- **Diffusion Writer:** `forward_tldm` places the expanded latent context beside the visible and masked tokens, then reuses those same recurrent blocks in bidirectional mode. The existing tied `lm_head` predicts the shared vocabulary. `generate_tldm` reveals the most confident masked positions over a bounded number of passes.
- **Modality ownership:** text, tool, image, audio and video codes are represented in OneCore's unified vocabulary. The writer may be constrained to a modality range at inference; no external tokenizer or model is called.

## Training contract

For every training micro-batch, the trainer keeps the causal next-token loss and adds a second objective:

1. Select one contiguous target span from the current sequence.
2. Replace that span with the reserved `MASK` special token.
3. Run `forward_tldm` on the corrupted sequence. The original target tokens are not present in the input.
4. Compute cross-entropy only at the masked positions.
5. Add `training.tldm_diffusion_weight * diffusion_loss` to the causal loss and existing modality auxiliary loss.

The initial configured weight is 0.15. The joint sampler supplies one sample from each of the five modality families per optimizer update, so the same native path is trained across the unified stream. The held-out validation and test sets remain excluded from gradient updates.

## Parameter and dependency guarantees

- No additional trainable parameter tensors are introduced by the native T-LDM path.
- The Compressor is parameter-free pooling over learned OneCore states.
- The Thinker and Writer reuse OneCore's shared blocks, cycle embeddings, final norm, and tied embedding/LM head.
- No import, weight, tokenizer, adapter, serving endpoint, or runtime dependency is taken from Sham, Nova, a donor model, or an external LLM.
- The instantiated architecture remains at 57,579,201 parameters; CI and architecture tests enforce this.
- The added path does increase inference/training FLOPs. Any claim of faster generation, lower memory, or better quality is blocked until measured.

## Interfaces and limits

`OneCore.forward_tldm(ids)` provides logits for a corrupted shared-vocabulary sequence. `OneCore.generate_tldm(context_ids, block_size, diffusion_steps)` returns a completed block. This is a model-internal capability; tool execution remains governed by OneCore's existing allowlisted tool runtime and is never inferred from raw generated source code.

This is the initial architecture integration. It does not claim that a fully capable agent loop or verified self-evolution has already been proven. Those require separate held-out task success measurements and ingestion gates for verified outcomes.
