# Notebook order and GitHub-only training

The six notebooks can be opened locally, but all actual model training and checkpoint lineage are orchestrated on GitHub Actions. Notebooks 03 and 04 default to a safe preflight and do not start training accidentally. Set `ONECORE_ACQUIRE_ONLY=1` to run their bounded acquisition path, or `ONECORE_EXECUTE_TRAINING=1` to opt into a training segment. Notebook 05 similarly requires `ONECORE_EXECUTE_EVALUATION=1` before it evaluates a checkpoint. The staged workflow sets these flags explicitly.

| Order | Notebook | Purpose |
|---|---|---|
| 00 | `00_project_contract.ipynb` | Scope, isolation, reproducibility, no external model weights |
| 01 | `01_architecture_budget.ipynb` | Instantiate the full unified model and count all trainable parameters |
| 02 | `02_data_gate.ipynb` | Validate train/validation/test manifests, assets, and cross-split leakage |
| 03 | `03_text_pretraining.ipynb` | Text/tool foundation inside the same general model and checkpoint |
| 04 | `04_multimodal_curriculum.ipynb` | Joint image/audio/video/tool curriculum inside the same model/checkpoint |
| 05 | `05_evaluation_and_promotion.ipynb` | Separate validation/test reports, per-codebook collapse metrics, quality thresholds, promotion gate |

## Exact first-stage architecture

The current instantiated configuration has **57,579,201 trainable parameters**. CI checks this exact count, not only a broad size range. The previous approximate and incomplete counts are invalid. The notebook and CI require the exact corrected count; no broad parameter-range assertion is accepted.

## Request and continuation

The repository's staged bootstrap request accepts `acquire`, `train_existing`, `repair_video_existing`, and `evaluate_existing`. The current request uses `evaluate_existing` to re-evaluate the exact saved `onecore-state-train-10` checkpoint at optimizer step 1,500 with zero optimizer updates, reusing `onecore-corpus-final` from its original run and skipping acquisition and the already-passed external data gate. A later `train_existing` continuation reuses that corpus and a compatible checkpoint, then chains ten 150-step sessions. The original clean lineage fitted its tokenizer only on external train records; each joint/multimodal optimizer update samples one external record from each of the five families. It does not restore the disqualified checkpoint whose tokenizer-corpus provenance was missing/mixed. The separate manual training workflow supports `smoke`, `text`, `multimodal`, and `evaluate` with a numeric parent run ID when resuming.

Before training, the workflow verifies the parent checkpoint SHA-256, optimizer state and step, scheduler state, parameter count, and lineage metadata, then runs compile/tests/notebook-integrity CI. It restores from the Actions artifact; a release asset is a fallback only when durable release write permissions are available.

## Dataset and promotion

The historical bootstrap corpus (360 train / 87 validation / 87 test synthetic records) is an engineering curriculum, not broad knowledge, and never satisfies external data quotas. The preserved expanded corpus artifact is reused; its five-family 100/10/10 data gate passed in the originating workflow run. No recrawl or duplicate data-gate pass is required while this immutable artifact remains unchanged. Validation and test are never read by the training iterator; cross-split record IDs, asset paths, and identical asset-content hashes are checked. A missing test manifest is added without rewriting train/validation data.

Only external train records enter tokenizer fitting and optimizer updates. Bootstrap, synthetic, and owner-curated records are retained only for engineering tests and diagnostics. Validation and test remain in independent held-out manifests and never enter tokenizer fitting or gradient updates. Promotion depends on independent evaluation fingerprints, full modality coverage, and measured quality thresholds.

## Implemented versus not yet verified

- Image, audio log-mel, video-frame, and tool-use training share the same model and checkpoint.
- Audio waveform reconstruction is an approximate Griffin–Lim decoder over log-mel features, not a production neural vocoder.
- Notebook 05 measures held-out codebook usage, normalized entropy, perplexity, dead-code count, and max-code concentration for vision/audio/motion on validation and test; approved collapse thresholds remain uncalibrated.
- The current small synthetic bootstrap has not established general-language, scientific, coding, cross-modal, or real-world capability.

## Safe local notebook execution

From either the repository root or `onecore-ai/`, run all six notebooks in order for the contract, architecture, and preflight checks. Notebook root discovery supports both working directories. Notebook 02 is intentionally a hard gate and fails when any external family is below 100 usable train records or 10 usable validation and test records. Do not lower the gate to make it pass. Notebook 03/04 acquisition mode resumes their own persisted cursors; notebook 04 training mode requires a compatible v2 checkpoint. Notebook 05 evaluation mode requires the exact checkpoint, tokenizer, manifests, and approved threshold values before promotion can be considered.
