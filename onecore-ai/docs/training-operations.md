# OneCore GitHub training operations

## Single source of truth

The source of truth is the `research/onecore-foundation` branch in this repository. Workflows run only on GitHub Actions. OneCore training workflows share the non-cancelling concurrency group `onecore-training`; do not start simultaneous training runs.

## Initial automatic run

The first push of the isolated OneCore branch triggers `OneCore — initial GitHub training`:
1. Generate deterministic synthetic train/validation samples in the runner.
2. Run compile checks and architecture/data tests.
3. Execute contract, model-budget, and dataset-gate notebooks.
4. Train a fresh tokenizer and the random-init core on text/tool examples.
5. Continue the *same* model, optimizer, scheduler and tokenizer on image/audio/video samples.
6. Evaluate on a separate synthetic validation split.
7. Upload the checkpoint and retain a versioned GitHub Release asset.

The initial run is a pipeline proof, not broad-knowledge pretraining and never eligible for promotion.

## Continuing training

Open Actions → OneCore — staged training → Run workflow. Choose `text` or `multimodal`, enter the number of optimizer steps (1–250), and set `resume_run_id` to the previous successful run's numeric ID.

The workflow first downloads the matching Actions artifact. If it has expired, it restores the checkpoint from the GitHub Release tag `onecore-run-<RUN_ID>`.

The checkpoint restores:
- shared model weights;
- optimizer state;
- scheduler state and current step;
- Python, NumPy and PyTorch RNG states;
- model configuration;
- tokenizer SHA-256;
- training manifest SHA-256;
- codebook initialization state and codebook usage report.

The workflow refuses to mix a changed tokenizer or changed training manifest into an existing lineage. Start a deliberate new lineage when the corpus changes substantially; do not overwrite an old run silently.

## GitHub limits and retention

The workflow uses CPU-only PyTorch on a public GitHub-hosted Linux runner, with a per-job time budget below the platform's six-hour ceiling. It performs bounded segments and resumes via GitHub-owned artifacts/releases. Do not commit checkpoints to Git history.

## Data safety and licensing

This repository is public. Never commit private conversations, personal information, secrets, private source code, or materials without redistribution rights. Keep a record of exact dataset source, license and attribution. Synthetic rows must use `review_status=generated`; owner-reviewed and licensed data must use `review_status=approved`. Validation records are stored separately and are never passed to the training iterator.

## Promotion

Training is not release. Evaluation must include text, tool-use, image reconstruction, audio reconstruction, and video-sequence metrics. Quality thresholds are intentionally unset until a measured baseline is produced and reviewed. A candidate cannot be promoted while it contains synthetic/unapproved data, missing modality coverage, or unapproved thresholds.
