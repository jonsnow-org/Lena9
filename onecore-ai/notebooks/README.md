# Notebook order and GitHub-only training

Run the notebooks through the GitHub Actions workflow **OneCore — staged training**. Do not run long training jobs on a laptop, Colab, Kaggle, ModelScope, or another host.

| Order | Notebook | Purpose | Promotion status |
|---|---|---|---|
| 00 | project contract | Scope, isolation, reproducibility rules | No training |
| 01 | architecture budget | Instantiate exact model and count all parameters | Architecture validation only |
| 02 | data gate | Check licensing, provenance, paths, and split isolation | Blocks invalid data |
| 03 | text pretraining | Random-init smoke test or text/tool pretraining | Never promotes automatically |
| 04 | multimodal curriculum | Joint image/audio/video/tool training in one checkpoint | Never promotes automatically |
| 05 | evaluation and promotion | Review metrics and run the promotion gate | Promotion only on full pass |

## Checkpoint continuation

A successful training run uploads an artifact named `onecore-state-<RUN_ID>`. Copy the numeric run ID from its GitHub Actions run page. On the next `workflow_dispatch`, enter that number as `resume_run_id`. The workflow restores both the model and optimizer state from that artifact. The tokenizer is included in the same artifact.

Do not start a second training workflow while another is running. The workflow uses a non-cancelling concurrency lock.

## The first run

Run stage `smoke` with 1–2 steps. This uses generated toy samples strictly to test the pipeline; it is not useful model training and can never pass promotion.

Real `text` training requires reviewed `data/train.jsonl` text/tool records. `multimodal` training requires reviewed paired assets for images, audio features, and video frames. No training run downloads model weights.

## Checkpoint size and continuity

Checkpoints remain GitHub Actions artifacts, not Git objects. Public Actions artifacts have limited retention/storage; preserve successful run IDs. If an artifact expires or is deleted, the model/optimizer state cannot be reconstructed from logs. Keep an exported copy only through an approved GitHub-native storage path if long-term archival becomes necessary.
