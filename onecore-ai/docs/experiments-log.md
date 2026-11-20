# OneCore experiments log (measured, tiny scale, CPU)

All numbers below were produced by `onecore.experiments`, `onecore.quantization` and
`onecore.android_perf` in this repository on a 2-core host CPU. They describe
**miniature models on a synthetic prefix-sum task** and **an untrained 57.6M model**.
They are engineering evidence only. They do not show general intelligence, and they do
not show OneCore matching or beating any larger model.

## Full model facts (phone-research.yaml)

- Trainable parameters: 57,579,201 (the exact-budget regression test passes).
- Forward pass, 64-token prefill, 2 threads, host CPU: about 225 ms (about 3.5 ms/token).
  This is a desktop/CI measurement, not an Android one, and no KV cache exists yet.
- Simulated weight quantization, measured on **randomly initialised** weights:
  int8 gives 3.98x smaller (55 MB), mean KL 5e-5. int4 gives 7.93x smaller (28 MB), mean KL 0.019.
  Top-1 agreement on an untrained model is not a quality metric. Repeat on a trained checkpoint.

## Recurrent vs non-recurrent (prefix-sum mod 10, held-out, answer positions only)

Width 96, AdamW with warmup and linear decay, disjoint train/eval RNG streams (leakage test = 0).

| Setting | Arm | Params | Block applications | Held-out token acc | Exact acc |
|---|---|---|---|---|---|
| len 8, 500 steps, lr 2e-3, seed 0 | recurrent 2x3 | 370,977 | 6 | 0.474 | 0.002 |
| | equal-compute 6x1 | 813,921 | 6 | 1.000 | 1.000 |
| | equal-params 2x1 | 370,785 | 2 | 1.000 | 1.000 |
| len 8, 500 steps, lr 2e-3, seed 1 | recurrent 2x3 | 370,977 | 6 | 0.226 | 0.000 |
| | equal-compute 6x1 | 813,921 | 6 | 1.000 | 1.000 |
| | equal-params 2x1 | 370,785 | 2 | 1.000 | 1.000 |
| len 16, 1500 steps, lr 2e-3, seed 0 | recurrent 2x3 | 370,977 | 6 | 0.153 | 0.000 |
| | equal-compute 6x1 | 813,921 | 6 | 1.000 | 1.000 |
| | equal-params 2x1 | 370,785 | 2 | 1.000 | 1.000 |

Recurrent 2x3, len 8, seed 0: lr 5e-4 and 1e-3 at 500 steps gave 0.22 and 0.39 token accuracy.
lr 2e-3 for 1500 steps reached 1.000. So it can learn the task, but it optimises much more slowly.

A depth-scaled residual init (std 0.02/sqrt(2*depth)) was tried on the recurrent arm
(2 seeds, 500 steps, lr 1e-3). It scored 0.21 and 0.10 token accuracy against 0.39 and 0.27
for the default init. It was worse, so it was reverted and is not in the repository.

### Conclusion (what is and is not supported)

- Supported: on this task and scale, the weight-shared recurrent core is **harder to optimise**
  than a plain stack with the same parameter count, and it costs more compute per step.
- Not supported: the README hypothesis that recurrence spends parameters more efficiently.
  Caveats: one synthetic task, tiny models, 1-2 seeds, no per-arm hyperparameter tuning.
- Worth running before changing the 57.6M design: a per-arm LR sweep, a second task that
  rewards iterative computation, and 3+ seeds with confidence intervals.

Reproduce: `PYTHONPATH=src python -m onecore.experiments 500 8`
