# Notebook order and GitHub-only training

All six notebooks are executed on GitHub Actions only. The staged request workflow runs the contract, architecture, and data gates before each segment, then the selected training notebook, and finally the evaluation notebook for non-smoke segments.

| Order | Notebook | Purpose |
|---|---|---|
| 00 | `00_project_contract.ipynb` | Scope, isolation, reproducibility, no external model weights |
| 01 | `01_architecture_budget.ipynb` | Instantiate the full unified model and count all trainable parameters |
| 02 | `02_data_gate.ipynb` | Validate train/validation/test provenance, licenses, assets, and cross-split leakage |
| 03 | `03_text_pretraining.ipynb` | Text/tool foundation inside the same general model and checkpoint |
| 04 | `04_multimodal_curriculum.ipynb` | Joint image/audio/video/tool curriculum inside the same model/checkpoint |
| 05 | `05_evaluation_and_promotion.ipynb` | Separate validation/test reports, per-codebook collapse metrics, quality thresholds, promotion gate |

## Exact first-stage architecture

The current instantiated configuration has **57,579,201 trainable parameters**. CI checks this exact count, not only a broad size range. The approximate agreed figure of 57,587,393 differs by 8,192 parameters; the model remains in the 50–70M first-experiment range.

## Request and continuation

Change `onecore-ai/training-request.json` on `research/onecore-foundation` to trigger the staged workflow. Use `stage=text` or `stage=multimodal`, `steps` from 1 to 250, and `resume_run_id` equal to the parent checkpoint's numeric Actions run ID. The workflow pins its checkout to the triggering commit and uses a non-cancelling training lock.

Before training, the workflow verifies the parent checkpoint SHA-256, optimizer state and step, scheduler state, parameter count, and lineage metadata, then runs compile/tests/notebook-integrity CI. It restores from the Actions artifact; a release asset is a fallback only when durable release write permissions are available.

## Dataset and promotion

The current bootstrap is 360 train / 87 validation / 87 test synthetic records. It is an engineering curriculum, not broad knowledge. Validation and test are never read by the training iterator; cross-split record IDs, asset paths, and identical asset-content hashes are checked. A missing test manifest is added without rewriting train/validation data.

Verified synthetic cognitive data is not permanently excluded: it must be tagged `data_class=synthetic_verified`, `review_status=verified`, and carry a nonempty `verification.method` and `verification.reference`. Bootstrap and unverified synthetic data remain promotion-ineligible. Promotion also requires independent validation/test hashes, modality coverage, and approved thresholds for both splits.

## Implemented versus not yet verified

- Image, audio log-mel, video-frame, and tool-use training share the same model and checkpoint.
- Audio waveform reconstruction is an approximate Griffin–Lim decoder over log-mel features, not a production neural vocoder.
- Notebook 05 measures held-out codebook usage, normalized entropy, perplexity, dead-code count, and max-code concentration for vision/audio/motion on validation and test; approved collapse thresholds remain uncalibrated.
- The current small synthetic bootstrap has not established general-language, scientific, coding, cross-modal, or real-world capability.
