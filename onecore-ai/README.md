# OneCore AI

**One model. One architecture. One training lineage.**

OneCore is a from-scratch, unified multimodal model. The only model implementation is under `onecore-ai/src/onecore/v3/`; the directory name identifies the adopted implementation path, not a second product. There is no parallel legacy model, trainer, notebook workflow, or alternate optimizer lineage.

Before any engineering change, read `AGENTS.md`, `SESSION_PROTOCOL.md`, and the complete `docs/EXECUTIVE_HANDOVER.md`. Inspect the live branch and Actions runs; never rely only on chat history.

## Canonical model

The current adopted architecture is `onecore-v3-corrected-spec-2`:

- **57,579,201 trainable parameters**, checked exactly in CI.
- **4,096 text BPE tokens within a 5,144-token unified vocabulary**.
- Shared semantic Transformer, width 1,024, four unique blocks reused over three cycles, eight attention heads, SwiGLU hidden width 2,730 and maximum context 512.
- One shared text embedding and tied text output projection.
- Text and tool tasks use the causal objective plus native masked-token T-LDM.
- Image, waveform-audio and video paths use their modality codecs, shared semantic core and independent flow heads.
- T-LDM uses 16 latent slots, the same shared Transformer and the tied text head. It adds no trainable parameters. Its initial configured loss weight is 0.15 for text and tool batches.

All tasks contribute to one model checkpoint and one optimizer lineage. No pretrained model, external model weights, adapters, LoRA, or teacher outputs are imported.

## Source layout

- `src/onecore/v3/core.py`: one shared multimodal model and native T-LDM.
- `src/onecore/v3/training.py`: joint text/tool/image/audio/video objective and optimizer step.
- `src/onecore/v3/runner.py`: bounded, checkpointed CPU training entry point.
- `src/onecore/v3/checkpoint.py`: checkpoint integrity, configuration, tokenizer, data cursors, RNG and parent lineage.
- `src/onecore/v3/dataset.py`, `manifest.py`, `converter.py`, `source_utils.py`: five-family data preparation, pinned source restoration and integrity validation.
- `src/onecore/v3/tokenizer.py`: the single tokenizer fitting and verification path.
- `src/onecore/v3/resource_benchmark.py`, `resource_evidence.py`: real CPU measurement and run-bound evidence.
- `src/onecore/v3/inference.py`: the canonical inference CLI.
- `data.py`, `crawlers.py`: shared provenance and resumable-stream utilities; they are not separate models or trainers.

## Data and lineage

The already validated external corpus is an immutable input. Preserve its artifact ID and hashes; do not reacquire it. The historical 32,000-token tokenizer artifact is retained for provenance only and is not compatible with the corrected specification. The one canonical tokenizer fit is 4,096 text BPE tokens, trained from the pinned external TRAIN split only; validation and test are never tokenizer inputs.

- Corpus artifact: `14892594659`, created by run `45325008221`; 24,432,975,285 bytes; SHA-256 `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`.
- Conversion report artifact: `14893020087`, run `45325008221`; SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`.
- Historical tokenizer artifact: `14894835517`, created by run `45336933362`; it records 32,000 tokens and SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`. It is preserved as provenance only and is not used by the corrected model. The canonical replacement request is `onecore-ai/v3-tokenizer-request.json`: 4,096 text BPE tokens from the same pinned external TRAIN manifest, with no validation/test leakage. The replacement artifact is not usable until its new run ID, artifact digest, tokenizer SHA and evidence are verified and pinned in the training request.

The source corpus archive is data only: it contains manifests and source-media payloads, not another model, weights, optimizer state or checkpoint. All training eligibility and split-integrity checks remain enforced. Only verified external train records may enter tokenizer fitting or optimizer updates; validation and test remain held out.

## Workflows

There is one active implementation branch: `research/onecore-v3-implementation`.

- `.github/workflows/onecore-ci.yml`: canonical integrity checks plus explicitly selected corpus, CPU benchmark, checkpoint-audit and held-out jobs.
- `.github/workflows/onecore-v3-tokenizer.yml`: the sole tokenizer workflow; it fits the corrected 4,096-token BPE from the immutable external TRAIN split and publishes a new content-addressed artifact. The old 32,000-token artifact is not used.
- `.github/workflows/onecore-v3-training.yml`: the only optimizer workflow. Its training job remains fail-closed until all runtime gates pass and training is explicitly authorized.
- `.github/workflows/onecore-source-package.yml`: builds a source-only archive with no weights, datasets, checkpoints, secrets or runtime state.

The current request is bounded to five optimizer updates per authorized segment, checkpointing every update, with T-LDM weight 0.15. No optimizer update has yet been verified for this current architecture fingerprint.

## Readiness and limitations

The model is **not trained** and its output quality is **not certified**. CI success verifies software behavior; it does not prove generation quality, CPU capacity or production readiness.

Training must remain blocked until:
1. A successful real-corpus CPU benchmark measures process-tree peak RSS, loader throughput and per-family compute on the current configuration.
2. A full real-artifact step-zero checkpoint save/restore audit passes for the current configuration fingerprint.
3. The pinned corpus, manifest and five-family gates must remain valid, and the replacement tokenizer must have exactly 4,096 tokens with verified TRAIN-only provenance, manifest SHA and content SHA.
4. The owner explicitly authorizes the first bounded segment.

After the first authorized optimizer update, a separate continuation audit must verify populated AdamW moments, advanced five-family cursors, parent checkpoint SHA and RNG state before any longer run.

See `ARCHITECTURE.md`, `v3/README.md`, `docs/native-tldm.md`, `docs/training-operations.md`, and `docs/EXECUTIVE_HANDOVER.md` for technical details and the live continuation point.
