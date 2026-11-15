# OneCore AI — from-scratch compact general intelligence

**A research project for one unified, multimodal model.** The model is initialized from random weights and trained from scratch. No pretrained model weights, adapters, teacher-model outputs, or model downloads are used.

OneCore is isolated under `onecore-ai/` in the Lena9 repository and developed on the dedicated branch `research/onecore-foundation`. Its GitHub Actions workflows are path-filtered and do not run for Lena9 application changes.

## Research hypothesis

A compact model can spend parameters more efficiently by combining:
- a **single shared recurrent Transformer core** reused over multiple reasoning cycles;
- one shared token embedding/output space for text, image, audio, motion, and tool/action symbols;
- small trainable modality front-ends and decoders whose parameters are counted as part of the same model;
- adaptive compute at inference and strict evaluation gates;
- a low-bit quantization research track reserved for a later measured phase; current training remains full precision.

This is a testable hypothesis, not a claim that a tiny model already matches frontier systems.

## Non-negotiable rules

1. All trainable weights start randomly initialized.
2. No external model checkpoints, pretrained encoders, LoRA adapters, or teacher distillation.
3. A single checkpoint contains the shared core and every trainable modality module.
4. Dataset records must carry source, license, review status, split, and attribution metadata.
5. Validation/test records never enter the training iterator.
6. Training runs only on GitHub Actions hosted runners. No Colab, Kaggle, ModelScope, Render, Vercel, or other training host.
7. A candidate is promoted only after the evaluation gate passes; training success alone is not model quality.

## Project layout

- `src/onecore/model.py`: shared recurrent multimodal architecture and all trainable components.
- `src/onecore/data.py`: manifest contract, license/source validation, dataset loading.
- `src/onecore/train.py`: bounded, resumable CPU trainer.
- `src/onecore/checkpoint.py`: atomic checkpoints, integrity hashes, lineage metadata.
- `src/onecore/evaluate.py`: independent evaluation and promotion metrics.
- `src/onecore/inference.py`: shared-core text, image, audio, video, and allowlisted tool-call inference.
- `src/onecore/bootstrap.py`: deterministic synthetic multimodal curriculum for first-run pipeline validation.
- `src/onecore/tool_runtime.py`: safe allowlisted tool dispatcher; generated text is never executed as code.
- `src/onecore/audio.py`: log-mel preparation and approximate Griffin-Lim waveform decoding (not a production neural vocoder).
- `src/onecore/inference.py`: unified text/image/audio/video and safe tool-call inference through the same model checkpoint.
- `src/onecore/bootstrap.py`: deterministic synthetic bootstrap data for pipeline validation; explicitly not a broad knowledge corpus.
- `notebooks/`: ordered research and training notebooks, executed by GitHub Actions.
- `.github/workflows/onecore-*.yml`: isolated CI and training workflows.

## GitHub-only training constraints

The selected repository is public. GitHub documents standard public Linux runners as free and unlimited, with 4 vCPU, 16 GB RAM, and 14 GB SSD for `ubuntu-24.04`. GitHub-hosted jobs have a maximum duration of 6 hours. The workflow therefore runs **bounded training segments**, saves a resumable checkpoint artifact, and resumes from a prior run ID. It does not pretend a single job can complete foundation-model pretraining.

Every successful training segment is retained as a GitHub Actions artifact and as a versioned GitHub Release asset. Use the run ID to resume from the artifact, or the matching `onecore-run-<RUN_ID>` release asset if the artifact has expired. Checkpoints are never committed into Git history.

## First model budget

The agreed first architecture experiment is 50–70M parameters; the principal research target after validation is 100–150M, with 200M considered only if evidence justifies it:
- width: 1024
- unique recurrent blocks: 4
- recurrent cycles: 3
- 8 attention heads
- 4,096 text-token slots plus learned visual/audio/motion code ranges and special tokens
- 8×8 RGB image patches; 64×64 training images
- 80-bin log-mel audio frames grouped in fours
- approximately 57.6M parameters before runtime counting (all modalities included)

The exact count is computed from the instantiated model and saved into every checkpoint. CI asserts that the first experiment remains between 50M and 70M. The previous 9.8M run was only an undersized pipeline test and is not an approved model-size checkpoint.

## Dataset contract

The first GitHub run generates a deterministic synthetic bootstrap corpus locally on the runner. It exercises all modalities and the tool format but is **not broad world knowledge** and can never pass promotion. To train on reviewed real-world data, add matching `data/train.jsonl` and `data/validation.jsonl` manifests plus assets under `data/assets/`. Every record must include:
`id`, `task`, `license`, `source_url`, `attribution`, `review_status`, and its exact `split`.
Allowed tasks: `text`, `image_caption`, `audio_text`, `video_caption`, `tool_use`.

Do not put private, personally identifying, copyrighted, or unlicensed data in this public repository. For public datasets, record the actual dataset license and required attribution before use. External/owner-curated records must use `review_status="approved"`; synthetic records must use `review_status="generated"`. Any synthetic or unapproved data blocks promotion. The initial bootstrap is an engineering curriculum, not a substitute for a large licensed knowledge corpus.

## Ordered runbook

1. Open `notebooks/00_project_contract.ipynb`.
2. Run the `OneCore — CI and notebook integrity` workflow after pushing changes.
3. The initial push starts a short bootstrap run: create tokenizer, train text/tools, continue the same checkpoint on images/audio/video, then evaluate a held-out synthetic split.
4. Replace or expand the bootstrap curriculum with reviewed, licensed real-world datasets in train and validation manifests.
5. Resume `text` or `multimodal` segments using a previous GitHub run ID; checkpoints include model, optimizer, scheduler, tokenizer hash, manifest hash, and random states.
6. Run `evaluate`; synthetic data, missing modality coverage, or unapproved quality thresholds block promotion.

See `notebooks/README.md` for notebook order and the checkpoint-resume procedure.
