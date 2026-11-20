# OneCore Model Architecture Analysis

## Scope

Analysis of the `onecore-ai/` subsystem on branch `origin/research/onecore-foundation`. Focus: the OneCore unified foundation model structure. The main app (Literium web + Android) is out of scope.

## Identity

OneCore is a single foundation model trained from random initialization. Not an ensemble, router, adapter stack, or collection of modality-specific models. One checkpoint, one shared parameter path.

## Shared Parameter Path

1. Task-specific input codec converts raw values into vectors/code IDs.
2. Text, visual, audio, motion, action symbols share one vocabulary ID space and one embedding matrix.
3. One recurrent Transformer core reused for every reasoning cycle.
4. One tied LM head predicts the next shared symbol.
5. Small decoder maps generated modality codes back to pixels/log-mel/motion deltas.

Embedding matrix and LM head are tied by parameter identity (`lm_head.weight = token_embedding.weight`). Encoders/decoders are part of the parameter count and not loaded from another model.

## Recurrent Core (First Research Config)

- Width 1024, 4 unique blocks, 3 recurrent cycles → 12 effective block applications, 4 stored block parameter sets.
- ~57.6M params expected; CI enforces 50–70M initial budget.
- Causal self-attention, RMSNorm, SwiGLU. Recurrent-cycle embeddings signal which pass.
- Optional inference-only adaptive pass (`forward_hidden_adaptive`) stops when next-token distributions stabilize; heuristic, not learned halting.

## Native Latent-Diffusion (T-LDM) Path

Internal execution mode, not a second network:
1. Compressor: adaptive (parameter-free) pooling of embedded sequence to bounded latent sequence.
2. Latent Thinker: same recurrent blocks process latents for configured cycles.
3. Diffusion Writer: latent context expanded into masked sequence; same blocks + tied LM head iteratively recover hidden tokens from shared vocab.
4. Training: contiguous span masked and reconstructed with bidirectional attention; causal next-token objective stays active; only masked positions contribute to diffusion loss.

Mask is an existing reserved special-token slot (MASK=18). No new params, donor weights, adapters, external tokenizer, or external inference service. Bidirectional path sees only visible context + explicit mask tokens.

## Modality Vocabulary Layout

Single vocabulary partitioned by config properties:
- Text: byte-level BPE, first range (text_vocab_size=4096).
- Vision: 8×8 RGB patches at 64×64; linear codec quantizes to shared embedding rows (vision_codebook_size=512). Range [4096, 4608).
- Audio: mono → 80-bin log-mel; grouped frames (audio_group_frames=4) → audio_token_dim=320; codebook 256. Range [4608, 4864).
- Motion: frame-difference patches; codebook 256. Range [4864, 5120).
- Special: 24 slots. Range [5120, 5144). Total vocab_size=5144.

Special token offsets (0..23): BOS=0, EOS=1, PAD=2, IMAGE_START/END=3/4, AUDIO_START/END=5/6, VIDEO_START/FRAME/END=7/8/9, TOOL_START/END=10/11, TURN_START/END=12/13, TEXT_START=14, ANSWER_START=15, NO_ANSWER=16, MOTION_START=17, MASK=18.

## Components (`src/onecore/model.py`)

- `RMSNorm`, `SharedAttention` (MHA via scaled_dot_product_attention), `SwiGLU`, `RecurrentBlock` (pre-norm residual).
- `VectorQuantizer`: straight-through nearest-neighbour against a slice of shared token embeddings; commitment + 0.25 codebook loss. Deliberately not nn.Module (avoids cycle).
- `OneCore`: embeddings (token/position/modality/cycle), blocks, final_norm, tied lm_head, image/audio/motion encoders+decoders, halt_head, quantizers.
- Methods: `forward_hidden`, `forward` (causal), `forward_tldm_hidden`/`forward_tldm` (bidirectional diffusion), `generate`/`generate_text`/`generate_tool_payload`/`generate_image`/`generate_audio`/`generate_video`, `generate_tldm` (iterative masked refinement), `forward_hidden_adaptive`, `encode_*`/`decode_*`, `initialize_codebook`, `codebook_usage`, `adaptive_thought_steps`, `parameter_report`.

## Config (`src/onecore/config.py`)

- `ModelConfig` (frozen dataclass) with validation; `TrainConfig`; `load_config` reads YAML with `model` + optional `training`.
- Derived: vision_start, audio_start, motion_start, special_start, vocab_size, image_tokens_per_frame (64), audio_token_dim (320).

## Training/Ops

- Total steps 20000, LR 3e-4, weight decay 0.01, grad accum 4, max grad norm 1.0, checkpoint every 25, max 250 steps/job, warmup 200, cpu_threads 4, tldm_diffusion_weight 0.15.
- GitHub Actions: onecore-bootstrap, onecore-ci, onecore-training, onecore-acquire/train actions.

## Current Boundaries

First executable research baseline, not mature multimodal product. Synthetic curriculum: simple visual patterns, synthetic tones, basic motion, arithmetic, tool-call format. No broad world knowledge, robust speech, photo-realistic images, natural speech, high-quality video. Next gates: codebook usage/collapse + reconstruction quality; large diverse paired corpus; text/tool and cross-modal generalization; recurrent vs equal-compute non-recurrent baseline; quantization only after stable full-precision; Android CPU/RAM/battery benchmark.

## Key Invariants / Risks

- T-LDM adds 0 trainable parameters (reuses shared blocks/embeddings/head).
- Codebook collapse risk; activation-based seeding mitigates scale mismatch.
- Griffin-Lim baseline vocoder (not neural).
- Tools: strict allowlisted runtime, no shell/Python execution.
- Never describe smoke/bootstrap checkpoint as trained general intelligence.

## Validation

- Tests under `onecore-ai/tests/` (architecture, config, tokenizer corpus, acquisition, bootstrap splits, curriculum, promotion gate, tool eval/episodes/tools, artifacts).
- CI enforces param budget 50–70M.