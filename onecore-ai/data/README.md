# OneCore training data manifests

## Manifest contract

Each record must carry `id`, `task`, `license`, `source_url`, `attribution`, `split`, and `review_status`. The optional `data_class` distinguishes the data's evidentiary level; `verification` is required for verified synthetic records. See `manifest.schema.json`.

Allowed tasks: `text`, `image_caption`, `audio_text`, `video_caption`, and `tool_use`. Task-specific fields include `text`, `caption`, `transcript`, `prompt`, `response`, `image`, `audio_features`, and ordered `frames`. All assets must resolve below `data/assets/`.

## Three isolated splits

- `train.jsonl`: `split=train`; the only manifest read by the training iterator.
- `validation.jsonl`: `split=validation`; used for model selection and regression measurement, never training.
- `test.jsonl`: `split=test`; held out from training and validation decisions, used for independent reporting.

Record IDs, asset paths, and identical asset-content hashes must not overlap across train, validation, and test. The data gate checks this. The deterministic bootstrap generator uses split-specific image markers and mild audio loudness variation to avoid byte-identical assets across held-out splits while preserving the scene/frequency labels. Evaluation separately measures vision/audio/motion codebook usage, normalized entropy, perplexity, dead codes, and maximum assignment concentration on validation and test.

## Data classes and promotion evidence

- `bootstrap`: small deterministic pipeline samples from `local://onecore-bootstrap`; generated and never promotion eligible.
- `synthetic_unverified`: synthetic records without independent reference verification; usable for research training, not promotion.
- `synthetic_verified`: synthetic records with `review_status=verified` and a `verification` object containing nonempty `method` and `reference`; may qualify for promotion if validation/test quality thresholds and coverage pass.
- `external_reviewed`: third-party data with the exact license, source URL, attribution, and `review_status=approved`.
- `owner_curated`: owner-created data with documented provenance and `review_status=approved`.

The word synthetic is not a permanent barrier. Promotion blocks the bootstrap tier and unverified synthetic data, not a sufficiently large and independently verified synthetic curriculum.

## Bootstrap counts and migration

The current deterministic bootstrap generates 360 training, 87 validation, and 87 test records. It is a small engineering curriculum, not broad world knowledge. If an older generated dataset has train and validation manifests but lacks `test.jsonl`, the generator adds the test split while preserving the existing train/validation manifest bytes.

## Licensing, privacy, and audio

Public repository contents are public. Never add personal data, private conversations, passwords, secrets, or assets with unclear redistribution rights. Record exact license and attribution before using external datasets. `review_status=approved` requires owner review; generated samples are tagged explicitly.

Audio preparation currently supports mono/stereo 16-bit PCM WAV input for 80-bin log-mel features. The waveform decoder uses a pseudoinverse mel bank plus Griffin–Lim and is approximate; it is not a learned production vocoder.
