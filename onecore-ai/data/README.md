# OneCore training data manifests and source connectors

The training-data factory is connected to the ordered research notebooks. Notebook 02 reads \`data/sources.yaml\`, streams the registered datasets and adds stable samples and local assets to the three split manifests. The same fixed source shards are regenerated on each GitHub training segment, preserving manifest and checkpoint fingerprints.

## Source coverage

The registry includes:
- General language and Arabic: FineWeb-2, FineWeb2-HQ-Plus, Wikimedia Wikipedia, C4 and OSCAR.
- Mathematics, proofs and code: Open-Web-Math-Pro, Proof-Pile-2 and Stack V2 Edu.
- Audio/speech: FLEURS, Arabic Speech Corpus, GigaSpeech 3, GigaSpeech, GigaSpeech 2, WavCaps and Common Voice.
- Images/documents: Open Images V7, SARD and Flickr30k.
- Video/audio-video: FineVideo, LAION BVD-V-55M, BVD-A-10M, InternVid-10M-FLT and Panda-70M.

Every task still trains the same OneCore model and writes into the same shared checkpoint. Text sources contribute language/code/math records; image and video sources are converted to 64×64 frames; audio is converted to 80-bin log-mel features; the encoders, decoders, shared token space and recurrent core are all counted as one model.

## Manifest contract

Each record includes \`id\`, \`task\`, \`license\`, \`source_url\`, \`attribution\`, \`split\`, and \`review_status\`. Source records also carry \`data_class\`. The local paths in \`image\`, \`audio_features\`, and \`frames\` must resolve below \`data/assets/\`.

Allowed tasks: \`text\`, \`image_caption\`, \`image_reconstruction\`, \`audio_text\`, \`audio_reconstruction\`, \`video_caption\`, \`video_reconstruction\`, and \`tool_use\`.

## Split separation

- \`train.jsonl\`: training only.
- \`validation.jsonl\`: checkpoint selection/regression measurements.
- \`test.jsonl\`: independent held-out measurement.

Where a dataset does not publish all three splits, stable ID hashing assigns each record to exactly one split. The data gate checks record IDs, asset paths, and identical asset hashes across all splits.

## Running the source acquisition

The acquisition module can also be run directly on a GitHub runner:

\`\`\`bash
python -m onecore.acquire --root onecore-ai --profile initial
\`\`\`

It uses Hugging Face streaming, writes a source-level report to \`data/acquisition-report.json\`, records unavailable sources without aborting the remaining sources, and does not download model weights. The optional \`HF_TOKEN\` environment variable is used for sources that require an authenticated account.

## Modalities

Audio features are mono 16 kHz 80-bin log-mel arrays. Video ingestion samples up to four ordered frames per clip. Sources containing only URLs or descriptive metadata are retained in the registry; the importer only emits a training record when it can obtain the actual media payload, so it never fabricates image/video content.

The audio waveform decoder remains approximate (mel pseudoinverse plus Griffin–Lim); it is not a trained production vocoder.
