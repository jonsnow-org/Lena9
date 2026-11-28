# OneCore — canonical model implementation

This directory contains the single adopted OneCore model implementation. It is not a second product or an alternate model. The shared semantic Transformer, text/tool paths, image/audio/video codecs, generation heads, native T-LDM and checkpoint lineage all belong to this one model.

## Core implementation

- `core.py`: shared semantic Transformer, text/tool model path, image/audio/video paths and native T-LDM.
- `training.py`: one five-family joint objective, including causal text/tool loss plus native masked-token T-LDM.
- `config.py` and `report.py`: exact model configuration, fingerprint and parameter report.
- `vision.py`, `audio.py`, `video.py`: trainable modality codecs.
- `losses.py`: image, audio and video reconstruction/flow objectives.
- `dataset.py`, `manifest.py`, `converter.py`, `source_utils.py`, `artifact.py`: data preparation, provenance, pinned media restoration and integrity checks.
- `tokenizer.py`: the sole 4,096-token text tokenizer path under the corrected configuration.
- `checkpoint.py`, `checkpoint_audit.py`: one checkpoint format and integrity/round-trip validation.
- `resource_benchmark.py`, `resource_evidence.py`: measured CPU-resource report and run/artifact binding.
- `runner.py`, `inference.py`, `evaluation.py`: the only training, inference and evaluation paths.

## Exact current architecture

The model has 57,579,201 trainable parameters, width 1,024, 4,096 text tokens (5,144 unified tokens), four unique Transformer blocks reused over three cycles and eight attention heads. T-LDM uses 16 latent slots and reuses the same shared Transformer and tied text head; it contributes no additional trainable parameters. The T-LDM objective weight is 0.15 for text and tool batches.

The parameter count and analytic FLOPs are checked in CI. The historic 32,000-token tokenizer is retained for provenance only. The one active tokenizer is artifact `15256164799` from run `46128204163`, with 4,096 tokens, 591,525 external TRAIN text rows and tokenizer JSON SHA-256 `6e1c5ed9bf3c44f9e520edf04a90caf97c15fa622f9b5df8d651345fef27dacd`; it used zero validation/test rows. The real CPU measurement, full current-config checkpoint round-trip and trained held-out quality evaluation are separate gates.

## Data and training constraints

Only verified external train rows contribute to tokenizer fitting and optimizer updates. Validation and test are isolated. The existing source-corpus artifact is a data snapshot, not model weights or another checkpoint.

The five-family joint trainer accumulates text, tool, image, audio and video micro-batches and performs one optimizer step. The first authorized segment is limited to five updates and checkpoints each update. The trainer remains guarded until real CPU, checkpoint and explicit-authorization gates pass.

## Known limitations

The current model is untrained and quality is not certified. Image/audio/video codecs are trainable prototypes, long video context is bounded, attention is quadratic, and contrastive alignment still requires multi-example paired batches. Read `../ARCHITECTURE.md` and `../docs/EXECUTIVE_HANDOVER.md` before making architecture or training changes.
