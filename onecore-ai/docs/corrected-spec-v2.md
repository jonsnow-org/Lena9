# OneCore Corrected Specification v2 — implementation record

This repository implements the engineer's replacement pack for source revision `2a6118a`. The attached Corrected Specification v2 is the authority for all dimensions, counts, formulas, and promotion decisions. This record documents how those requirements map to the existing OneCore codebase.

## Exact architecture contract

| Quantity | Required value |
|---|---:|
| Trainable parameters | **57,579,201** |
| Width | 1,024 |
| Unique recurrent blocks | 4 |
| Recurrent cycles | 3 (12 block applications) |
| Attention heads / head dimension | 8 / 128 |
| SwiGLU hidden width | 2,730 |
| Shared vocabulary | 5,144 |
| Maximum sequence length | 512 |
| Image / patch size | 64×64 / 8×8 |
| Audio bins / grouped frames | 80 / 4 |
| Maximum video frames | 4 |
| T-LDM thinker latents | 16 |

The vocabulary ranges are text 0–4095, vision 4096–4607, audio 4608–4863, motion 4864–5119, and special 5120–5143. The tied LM head adds no independent parameters. Codec Linear biases and the halt-head bias are included in the exact count.

## Training contract

- AdamW learning rate: 0.0003; weight decay: 0.1; betas: (0.9, 0.95); maximum gradient norm: 1.0.
- Explicit schedule: 20,000 total steps, 200 warmup steps, cosine decay to a 10% learning-rate floor.
- T-LDM loss weight: 0.15.
- Text/smoke: four micro-batches per optimizer step.
- Joint/multimodal: exactly five micro-batches, one from each of text, tool, image, audio, and video.
- CPU thread count: 4; per-job cap: 250 optimizer steps; checkpoint interval: 25 steps.

The training code rejects checkpoint continuation when the model architecture or optimizer/schedule configuration differs. A changed optimizer contract must start a new compatible lineage rather than silently reusing stale AdamW state. The historical checkpoint at optimizer step 210 (run 43715922010) has the same tensor dimensions and exact 57,579,201 parameter count, but was trained with weight decay 0.01 and PyTorch's default AdamW betas (0.9, 0.999), not v2's 0.1 and (0.9, 0.95). It is retained as a historical experimental artifact and is not resumable under v2. Its reported corpus is synthetic bootstrap data, so its loss metrics are not external-data quality evidence. The active v2 training request deliberately starts a new random-initialized lineage and does not restore that legacy checkpoint.

## One external data gate

Every workflow, notebook, and acquisition helper uses one gate: **100 usable external records per family in train, 10 in validation, and 10 in test**. All five families are required. Bootstrap and synthetic tool episodes do not satisfy these quotas. Coverage counts decoded, usable payloads rather than metadata-only rows.

## FLOPs accounting

`src/onecore/flops.py` is the single formula source. It includes QKV, attention QK and AV, output projection, SwiGLU MLP, tied LM head, T-LDM thinker and writer, and an approximate 3× forward multiplier for training backward cost. Joint steps multiply by five micro-batches; text steps multiply by four.

| Sequence length | Joint optimizer-step compute |
|---:|---:|
| 128 | 1.297 TFLOPs |
| 256 | 2.569 TFLOPs |
| 512 | 5.259 TFLOPs |

The trainer records per-step and total FLOPs using the actual sequence length of each micro-batch. These are operation counts, not measured wall-clock performance.

## Evaluation and promotion

Promotion is checkpoint-specific and remains blocked while `configs/promotion-thresholds.json` is `not-approved`. The v2 pack explicitly requires two regression guards: text loss must remain at or below **1.02×** its baseline on the identical tokenizer, manifest, and selected held-out records; tool execution success must retain at least **0.9×** its baseline on the same verified cases. Tool evidence must contain at least **16 examples overall** and at least **4 examples for each workflow step**. These are regression/evidence requirements, not substitutes for approval of absolute text/tool/image/audio/video losses, codebook usage/entropy, or T-LDM masked-span thresholds. Those absolute quality thresholds remain unapproved and must be measured rather than invented.

The first random-initialization language-loss reference is `ln(5144) = 8.5456` nats. The one-step smoke gate rejects a value more than 1.0 nat from that reference; this is a tokenizer/vocabulary/loss-integrity sanity check, not a model-quality threshold.

## Scaling

Promotion and scaling are independent. Scaling is allowed without first promoting the current checkpoint, but every dimension change requires recalculating vocabulary, hidden width, parameter count, sequence budgets, FLOPs, memory, training totals, Chinchilla reference, video-caption budget, and T-LDM block width. Update the exact parameter assertion and retrain from scratch; do not copy old weights or transfer old-size promotion thresholds.

Scaling above 150M parameters is allowed. Promotion at that size additionally requires measured quality, actual ingested-data coverage, recomputed FLOPs plus measured wall-clock time, and exact checkpoint/tokenizer/manifest/config lineage with evaluation JSON.

## Explicit implementation limitations

- No KV cache: autoregressive generation recomputes the full context for every generated token.
- Audio waveform output uses Griffin–Lim (24 iterations), not a neural vocoder or production-quality speech synthesis.
- Image input/reconstruction is 64×64 only.
- Video is limited to four frames and a 52-token caption budget.
- INT8/4-bit/1.58-bit values are storage estimates only; there is no quantized runtime, dequantization test, or on-device timing.
- No quality, speed, Android, or production-readiness claim follows from a passing smoke test or synthetic bootstrap.
