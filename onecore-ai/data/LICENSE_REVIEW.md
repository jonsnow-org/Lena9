# OneCore external-data license and provenance gate

OneCore training artifacts may be commercialized. A dataset is not approved merely because a repository is public or its wrapper repository has a license tag. The acquisition code enforces an explicit commercial-training allowlist in `src/onecore/data.py`, requires a pinned source revision and a SHA-256 row identity, and records source attribution. Non-commercial, no-derivatives, research-only, unclear, mixed-license-without-row-provenance, and model-generated/teacher-output datasets are blocked from optimizer/tokenizer input.

## Active sources

| Source | License used by OneCore | Evidence / provenance note |
|---|---|---|
| FineWeb2-HQ-Plus | ODC-BY | [dataset card](https://huggingface.co/datasets/epfml/FineWeb2-HQ-Plus); source revision and row hash recorded per sample |
| FineWeb2 | ODC-BY-1.0 | [dataset card](https://huggingface.co/datasets/HuggingFaceFW/fineweb-2); source revision and row hash recorded per sample |
| Wikimedia Wikipedia | CC BY-SA 4.0 | [dataset card](https://huggingface.co/datasets/wikimedia/wikipedia); preserve contributor attribution and share-alike notice |
| C4 Arabic | ODC-BY | [dataset card](https://huggingface.co/datasets/allenai/c4); explicit ODC-BY metadata used |
| Open-Web-Math-Pro | ODC-BY-1.0 | [dataset card](https://huggingface.co/datasets/gair-prox/open-web-math-pro) |
| Stack V2 Edu filtered | Per-document license metadata | [dataset card](https://huggingface.co/datasets/common-pile/stackv2_edu_filtered); only row licenses in the allowlist pass; mixed or unknown licenses are rejected |
| FLEURS Arabic | CC BY 4.0 | [dataset card](https://huggingface.co/datasets/google/fleurs); source revision and attribution preserved |
| Arabic Speech Corpus | CC BY 4.0 | [dataset card](https://huggingface.co/datasets/tunis-ai/arabic_speech_corpus); source revision and attribution preserved |
| GigaSpeechBench | CC BY 4.0, metadata-only | [dataset card](https://huggingface.co/datasets/speechcolab/GigaSpeechBench); metadata-only rows are not media training examples |
| Turkish Mobile Function Calling | Apache-2.0 | [dataset card](https://huggingface.co/datasets/BTX24/turkish-mobile-function-calling-dataset); creator-published Turkish command/function-call pairs |
| Videos4CameraBench | CC BY 4.0 | [dataset card](https://huggingface.co/datasets/syCen/Videos4CameraBench); actual MP4 segments grouped by original video ID before partitioning |

CC BY-SA and ODC-BY require attribution/notice preservation; this file is a provenance record, not legal advice. The allowlist is intentionally conservative and does not approve unknown license expressions.

## Disabled pending license, rights, or provenance review

| Source group | Reason for exclusion |
|---|---|
| OSCAR-2301 | The content's original rights are not established by the repository's metadata license; do not treat a wrapper tag as a content grant. |
| Proof-Pile-2 | Composite corpus with mixed source licenses and no per-record license field in the current adapter. |
| Saxo function calling | The repository says it reformats an upstream Llama-3 function-calling set; its underlying authorship and teacher-output provenance are not verified, so it remains disabled. |
| GigaSpeech 3 Arabic | Research-only/non-commercial terms. |
| GigaSpeech / GigaSpeech 2 | Underlying recording rights and commercial reuse have not been verified at record level. |
| WavCaps audio-language | Mixed source licenses/terms are not mapped to each imported record. |
| Flickr30k | The current adapter lacks verified per-asset rights/attribution for the downloaded image files; the Open Images V7 mirror is registered with its explicit CC-BY-2.0 dataset license. |
| SARD Arabic documents | CC BY-NC-ND 4.0 is non-commercial and no-derivatives. |
| FineVideo | Gated dataset and additional access/removal/redistribution terms require review before staging media assets in public-repository artifacts. |
| LAION BVD video/audio/image | Non-commercial research restrictions or source-asset rights are not approved for commercial training. |
| InternVid | CC BY-NC-SA 4.0 is non-commercial; excluded. |
| Panda-70M | Metadata-only source terms are not verified; metadata does not count as video examples. |
| Conceptual Captions 12M | Underlying source-image rights are not verified per asset by the current adapter. |
| ShareGPT4V | Captions include model-generated GPT-4V/ShareCaptioner outputs and license/provenance is not suitable for this no-teacher training policy. |
| ShareGPT4Video | Model-generated caption provenance and source-video terms are not approved. |
| WebVid / HD-VILA / YouCook2 / MSR-VTT | Source-video rights and dataset-specific terms are not verified for commercial training and public artifact handling. |

Disabled entries remain in `data/sources.yaml` for traceability but are not acquired. A future enablement requires explicit source-level and per-record rights/provenance review, not just a non-empty license string.
