# OneCore data and source registry

The source registry supplies one unified corpus for the single OneCore model. It is acquisition configuration and provenance; it does not define a separate model, tokenizer or training line.

## Five training families

External data is organized as text, tool-use, images, waveform audio and video. These families share one semantic Transformer and a 5,144-token unified vocabulary: 4,096 text tokens plus modality-code and special-token ranges. The preserved 32,000-token tokenizer artifact is incompatible with the current 4,096-token text vocabulary. Image/audio/video codecs and flow heads are modules inside the same OneCore checkpoint.

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

Do not reacquire or refit the pinned corpus/tokenizer artifacts unless live evidence establishes that an exact artifact is missing, expired or corrupt.

## Streaming cursor

`src/onecore/crawlers.py` provides a generic resumable-stream cursor keyed by pipeline, source, configuration, split and immutable revision. It is shared by data preparation and the canonical corpus converter. Existing cursor snapshots using the former JSON key remain readable for compatibility.
