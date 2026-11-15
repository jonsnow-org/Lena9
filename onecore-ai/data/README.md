# Reviewed training data

The repository intentionally ships **no unreviewed training corpus**. Add data only after confirming the actual license and attribution obligations.

## Manifest

Create `data/train.jsonl`, one JSON object per line:

- `id`: stable, unique sample identifier.
- `task`: one of `text`, `image_caption`, `audio_text`, `video_caption`, `tool_use`.
- `license`: exact license identifier or documented terms; values such as `unknown` and `TBD` are rejected.
- `source_url`: source URL or `local://owner-created`.
- `attribution`: required attribution text.
- `split`: must be `train` in this file (use `validation` in `validation.jsonl`).
- `review_status`: `generated` for synthetic project-generated records, or `approved` only after the owner has reviewed third-party source/license/attribution.
- `text`, `caption`, `transcript`, `prompt`, `response`: task-specific text fields.
- `image`: path below `data/assets/` for `image_caption`.
- `audio_features`: path below `data/assets/` to a float32 NumPy array shaped `[frames, 80]` for `audio_text`.
- `frames`: ordered list of image paths below `data/assets/` for `video_caption`.

Example (replace all provenance and paths with real reviewed values):

```json
{"id":"owner-text-0001","task":"text","text":"A sentence written by the project owner.","license":"local-owner-created","source_url":"local://owner-created","attribution":"Created by the project owner","split":"train","review_status":"generated"}
```

The example is a schema illustration only; it is not bundled as training data.

## Data isolation

Keep training, validation, and test manifests separate. Only `train.jsonl` is read by the training iterator. Never upload personal data, passwords, private conversations, or assets whose license is unclear. Public repository contents are public.

For `audio_text`, precompute features from 16-bit PCM WAV files only after reviewing rights. The helper function `save_log_mel_npy` is available from `onecore.audio`; audio support currently operates on 80-bin log-mel frames, not arbitrary compressed audio.
