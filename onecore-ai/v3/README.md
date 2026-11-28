# OneCore V3 — canonical implementation

This directory is the sole active model implementation. Do not create a second model, trainer, tokenizer path, workflow, or checkpoint lineage.

## Current contract

The only active architecture is `onecore-v3-corrected-spec-3`: 32,000 text tokens; 33,048 unified tokens; 86,152,897 trainable parameters; width 1,024; four unique Transformer blocks reused over three cycles; eight attention heads; context 512; 16 native T-LDM latent slots. The text embedding and output head are tied. T-LDM adds zero parameters and uses weight 0.15 for text/tool objectives.

The previous corrected-spec-2 contract (4,096 text tokens, 5,144 unified tokens and 57,579,201 parameters) is superseded and has a different configuration fingerprint. It is not checkpoint-compatible with this contract.

## Canonical source modules

- `core.py`: one shared multimodal Transformer and native T-LDM.
- `training.py`, `runner.py`: one joint five-family training objective and bounded runner.
- `checkpoint.py`, `checkpoint_audit.py`: strict checkpoint lineage and real-artifact audit.
- `dataset.py`, `manifest.py`, `converter.py`, `source_utils.py`, `artifact.py`: validated five-family data and immutable source restoration.
- `tokenizer.py`: only tokenizer training, adoption and verification path.
- `flops.py`: config-aware analytic FLOPs accounting.
- `resource_benchmark.py`, `resource_evidence.py`: measured CPU resource evidence.
- `inference.py`, `evaluation.py`: canonical inference/evaluation.

## Tokenizer

The active 32K tokenizer is being re-attested from immutable artifact `14894835517` (run `45336933362`). JSON SHA-256: `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`; original sidecar SHA-256: `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`. Evidence: 591,525 external TRAIN text rows, zero validation/test rows, pinned manifest and row fingerprint. Adoption must preserve JSON bytes and independently bind the tokenizer contract to corrected-spec-3. The prior 4K tokenizer artifact remains historical provenance only.

## Execution status

No optimizer update has been performed. No corrected-spec-3 CPU benchmark, step-zero real-artifact checkpoint audit, or held-out evaluation has passed. Keep the training workflow blocked. See `../docs/EXECUTIVE_HANDOVER.md`, `../docs/training-operations.md` and `../docs/ADR-corrected-spec-3.md` for current gates and provenance.
