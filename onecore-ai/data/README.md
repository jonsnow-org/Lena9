# OneCore training data and source connectors

Notebook 02 reads \`data/sources.yaml\`, streams the registered datasets and appends stable samples and local assets to the three split manifests. Repeated GitHub training segments use the same deterministic shards so the training manifest and checkpoint fingerprint remain stable.

## Source coverage

The registry connects:
- General language: FineWeb-2, FineWeb2-HQ-Plus, Wikimedia Wikipedia, C4 and OSCAR.
- Mathematics, proofs and code: Open-Web-Math-Pro, Proof-Pile-2 and Stack V2 Edu.
- Speech and audio-language: FLEURS, Arabic Speech Corpus, GigaSpeech 3, GigaSpeech, GigaSpeech 2, WavCaps and Common Voice.
- Images and documents: Open Images V7, SARD, Flickr30k, COYO-700M, Conceptual Captions 12M and ShareGPT4V.
- Video and temporal data: MSR-VTT, WebVid-10M, ShareGPT4Video, HD-VILA-100M, YouCook2, FineVideo, LAION BVD-V-55M, BVD-A-10M, BVD-I-300M, InternVid-10M-FLT and Panda-70M.
- Evaluation metadata: GigaSpeechBench.

All usable records enter one shared OneCore checkpoint. Images/video become 64×64 frames; audio becomes 80-bin log-mel features; text, tool actions and all media tokens use the same vocabulary, recurrent core and trainable parameter set.

## Manifest contract

Each record preserves a stable identifier, task, source URL, attribution, split, and review classification. Local paths in \`image\`, \`audio_features\`, and \`frames\` resolve below \`data/assets/\`.

Supported tasks: \`text\`, \`image_caption\`, \`image_reconstruction\`, \`audio_text\`, \`audio_reconstruction\`, \`video_caption\`, \`video_reconstruction\`, and \`tool_use\`.

## Split separation

- \`train.jsonl\`: optimizer input only.
- \`validation.jsonl\`: checkpoint selection and regression measurement.
- \`test.jsonl\`: independent held-out measurement.

When a source provides only a training split, stable record-ID hashing assigns rows to train, validation and test. Published validation and test splits remain held out. The data gate checks record IDs, asset paths and identical asset hashes across splits.

## Acquisition

The same acquisition used by notebook 02 can be run on a GitHub runner:

\`\`\`bash
python -m onecore.acquire --root onecore-ai --profile initial
\`\`\`

The module uses Hugging Face streaming, writes \`data/acquisition-report.json\`, and records metadata-only sources separately under \`data/metadata/\`. Sources that are unavailable in the current run do not stop other sources from being ingested. It does not download model weights.

## Media preparation

Audio features are normalized to mono 16 kHz and 80-bin log-mel arrays. Video ingestion samples up to four ordered frames per clip. A source row is emitted as a training example only when the corresponding media payload can be read; metadata-only rows are preserved separately rather than converted into invented visual content.

The waveform decoder remains approximate (mel pseudoinverse plus Griffin–Lim), not a trained production vocoder.
