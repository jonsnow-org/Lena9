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

All five task families share one OneCore checkpoint. Images/video become 64×64 frames; audio becomes 80-bin log-mel features; text, tool actions and all media tokens use the same vocabulary, recurrent core and trainable parameter set. Only externally imported records are eligible for real tokenizer fitting and optimizer updates.

## Manifest contract

Each record preserves a stable identifier, task, source URL, source metadata, split, and data-class grouping. Local paths in \`image\`, \`audio_features\`, and \`frames\` resolve below \`data/assets/\`.

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

## Real-training eligibility

Only records classified as `external` are used to fit the tokenizer or enter optimizer updates. This applies to text, tool, image, audio, and video families. The tokenizer corpus is built from the same external-only training records as the optimizer sampler, and its class counts are recorded in checkpoint metadata and training reports.

Bootstrap, synthetic, and owner-curated records may remain in the repository for engineering smoke tests and diagnostics, but they are excluded from the real tokenizer corpus and optimizer inputs. Image, audio, and video training records still require readable media payloads; metadata-only catalogue rows remain outside the training manifests until their real payload is available. Validation and test stay held out and are never used for tokenizer fitting or gradient updates.



## Immutable external provenance

Every externally imported manifest row must retain a non-empty `source_id`, a pinned immutable `source_revision` (40–64 hexadecimal characters), and a 64-character `source_row_id_sha256`. Manifest validation rejects missing or malformed provenance, and split-integrity validation rejects the same source row appearing in more than one of train, validation, or test. These checks do not introduce a license filter and do not rewrite attribution or source-rights metadata.

## Dataset licensing and commercial-use review

Technical provenance and SHA-256 integrity do not establish permission to train or commercially deploy a model. Every source used by a release needs a source-specific human-reviewed entry in \`data/license-review.yaml\` that pins authoritative terms by HTTPS URL, retains the reviewed terms under `data/evidence/` with a matching SHA-256, and records model-training permission, commercial-deployment permission, weight-redistribution permission, attribution obligations and share-alike/copyleft obligations.

Unknown or missing reviews are treated as **not commercially cleared**. The audit never infers permission from a dataset repository name.

Run the audit over all enabled sources in the source registry:

\`\`\`bash
onecore-license-audit --require-commercial-clearance
\`\`\`

To restrict the audit to sources present in manifests, pass \`--manifest train.jsonl --manifest validation.jsonl --manifest test.jsonl\`. The audit verifies that the retained evidence file exists and its SHA-256 matches the review record. It remains an evidence-completeness gate, not legal advice or an automated license-text interpreter. The review file intentionally starts empty; no source is pre-cleared.
