# OneCore data and source registry

The source registry supplies one unified corpus for the single OneCore model. It is acquisition configuration and provenance; it does not define a separate model, tokenizer or training line.

## Five training families

External data is organized as text, tool-use, images, waveform audio and video. These families share one semantic Transformer and a 5,144-token unified vocabulary: 4,096 text tokens plus modality-code and special-token ranges. The historical 32,000-token tokenizer artifact is provenance only; the sole active tokenizer pipeline fits 4,096 BPE tokens from external train text in the pinned `train.jsonl`. Image/audio/video codecs and flow heads are modules inside the same OneCore checkpoint.

## Manifest contract

The canonical manifests are `train.jsonl`, `validation.jsonl` and `test.jsonl`. Each record preserves a stable ID, task, split, source ID, pinned immutable source revision, source-row SHA-256 and any media asset references. Assets resolve below `data/assets/`.

Supported task labels include `text`, `tool_use`, `image_caption`, `image_reconstruction`, `audio_text`, `audio_reconstruction`, `video_caption` and `video_reconstruction`.

## Split isolation and eligibility

- `train.jsonl` is the only input to tokenizer fitting and optimizer updates.
- `validation.jsonl` is used for diagnostics.
- `test.jsonl` remains independent held-out evaluation data.

Only verified external train records contribute to real tokenizer fitting and optimizer updates. Synthetic fixtures are restricted to software tests. Manifest gates validate record identity, source provenance, payload availability, split isolation and asset hashes.

## Pinned corpus data

The five-family corpus is already stored in the pinned GitHub Actions artifact `14892594659` from run `45325008221`. The conversion report and exact source-registry snapshot are retained with it. The snapshot contains manifests, source metadata and media payloads only: it is not model weights, an optimizer state, a checkpoint or another model.

`corpus-source-snapshot-45325008221.yaml` is the immutable data-source registry used for the already-created corpus artifact. It is used only by the explicit corpus-restore operation; it is not an alternate active source-selection policy. `sources.yaml` is the current active registry. Dataset identifiers containing words such as `stack_v2` identify upstream datasets, not another OneCore model.

Do not reacquire the pinned corpus. The historical 32,000-token tokenizer remains preserved only as provenance. The corrected single tokenizer is published as artifact `15256164799` from run `46128204163`, with 4,096 tokens and JSON SHA-256 `6e1c5ed9bf3c44f9e520edf04a90caf97c15fa622f9b5df8d651345fef27dacd`. It was fitted once from all 591,525 external TRAIN text rows in `data/train.jsonl`; validation/test rows used: 0. Preserve this exact artifact, file, sidecar and provenance.

## Streaming cursor

`src/onecore/crawlers.py` provides a generic resumable-stream cursor keyed by pipeline, source, configuration, split and immutable revision. It is shared by data preparation and the canonical corpus converter. Existing cursor snapshots using the former JSON key remain readable for compatibility.
