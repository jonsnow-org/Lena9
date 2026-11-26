# OneCore AI — V3 Agent Instructions

These instructions apply to all work below `onecore-ai/`. They take precedence over conflicting repository-root instructions for this subtree. The live status ledger is `docs/EXECUTIVE_HANDOVER.md`; architecture limits and research gates are in `v3/README.md`.

## 1. Repository and branch boundaries

- Repository: `jonsnow-org/Lena9`.
- Active OneCore work branch: `research/onecore-v3-implementation`.
- Active project directory: `onecore-ai/`.
- `research/onecore-foundation` is the frozen V2 archive. Do not develop or train there.
- Do not modify `main`, files outside `onecore-ai/`, `Ttbik`, Sham, or unrelated Literium application files as part of OneCore work.
- Do not follow older instructions that direct OneCore work to `kilo/ivory-engine-kc6`. Verify the live branch HEAD before every write; never assume a previous session's SHA is still current.
- Keep changes narrowly scoped. Prefer a small, testable commit over broad refactors. Do not overwrite user or concurrent-agent changes.

## 2. Canonical architecture and lineage

- The active product architecture is `onecore-v3-prototype-2`: one shared semantic Transformer core with modality-specific image, audio and video encoders/decoders and flow heads, plus text and tool-token paths.
- V2 is historical reference only. Never import V2 weights, checkpoints, optimizer/scheduler state, tokenizer, model manifests, or model-generated teacher data into V3.
- V3 training starts from random initialization. Do not introduce pretrained weights, adapters, LoRA, teacher distillation, or Sham model data.
- Preserve the exact V3 config fingerprint, tokenizer bytes/hash, corpus/manifest hashes, source cursors, RNG states, optimizer/scheduler state, and parent-checkpoint SHA through every checkpoint lineage.
- Do not silently change dimensions, vocabulary, codec parameters, sequence budgets, or other tensor-shape contracts. Any such change requires a new explicit architecture revision, recalculated parameter/FLOP/resource reports, updated tests, and a fresh checkpoint lineage.

## 3. Data integrity rules

- Only verified external records with immutable provenance and usable payloads may contribute to the real tokenizer corpus or optimizer updates.
- Synthetic, bootstrap, owner-curated, validation, and test records are not substitutes for external training data. Synthetic fixtures may be used in deterministic unit tests only; never present them as corpus coverage or model-quality evidence.
- Keep train, validation, and test isolated. Held-out records/assets must never be consumed by the training iterator, tokenizer fit, gradient updates, or training-time tuning.
- Preserve immutable source IDs/revisions, source-row hashes, asset SHA-256, split assignments, original media and normalized derivatives with metadata. Reject duplicate/leaked assets, mutable source revisions, unsafe paths, or provenance mismatches.
- Do not reacquire, redownload, restore, or refit existing pinned corpus/tokenizer artifacts unless live evidence shows that the exact artifact is missing, expired, or corrupt. Read the handover ledger first.
- Validate licensing, consent, privacy and permitted commercial use independently of technical provenance. An external URL or SHA-256 hash is not proof of a training/commercial license.

## 4. Training gates — fail closed

- Never remove, bypass, or weaken the explicit training guard in `.github/workflows/onecore-v3-training.yml` merely to get a green CI run.
- Do not perform optimizer updates until the live handover and workflow evidence confirm all pre-training gates: successful full V3 CPU resource measurement tied to the exact config/manifest/tokenizer hashes; the real-artifact step-zero checkpoint save/restore audit; valid five-family external coverage; verified tokenizer; no conflicting workflow; and explicit authorization for the bounded first segment.
- The CPU resource benchmark must be an isolated measurement with zero optimizer updates and no checkpoint writes. A Verify/push run, parameter count, FLOP estimate, storage estimate, partial profiler report, or step-zero checkpoint audit is not a substitute for measured peak process-tree RSS and throughput.
- The current approved first training request is bounded to five steps per session, with checkpointing every update. Do not increase steps, change hyperparameters, or alter source pins without a reviewed decision and new verification.
- A joint optimizer update consists of exactly one micro-batch from each family in this order: text, tool, image, audio, video; the optimizer steps once after the five family losses are accumulated.
- After the first authorized optimizer update, perform a separate post-update checkpoint continuation audit using the populated optimizer state, advanced five-family/source cursors, parent artifact SHA and RNG states before proceeding to longer training segments.
- Do not claim that step-zero save/restore proves post-update continuation. Do not infer training success from a successful process exit alone: verify optimizer-update counts, global step, checkpoint bytes/hash, lineage, metrics and artifact publication.
- Keep validation/test out of gradient updates and any training-time data selection.

## 5. Known V3 limitations that must remain visible

- The model is not trained and has no certified text, tool, image, audio or video output quality.
- The current joint data loader supplies one record per family per optimizer step. The existing symmetric contrastive alignment loss requires multiple paired examples and therefore is not meaningfully active with batch size one. Do not claim completed cross-modal contrastive alignment or substitute unpaired/synthetic pairs. Design and resource-test a provenance-preserving multi-example pairing strategy before activating it.
- Image/audio discriminators exist, but a complete alternating discriminator optimizer/schedule is not yet implemented.
- Shared attention remains quadratic. The text generation path does not yet provide a KV cache; video memory is bounded/truncated rather than unlimited full-context attention.
- Image/audio/video codecs and flow heads are trainable prototypes, not production-quality generators. Independent held-out tests and human review are mandatory before quality claims or promotion.
- V3 inference code and CLI do not establish Android readiness. Device memory, latency, battery, quantization correctness and output quality must be measured separately.

## 6. Required verification

For code changes, use the canonical GitHub Actions workflow on the active V3 branch. The expected core checks include:

```bash
python -m compileall -q onecore-ai/src
pytest -q onecore-ai/tests
python -m onecore.v3.report
```

Also inspect the workflow's executed notebook checks, FineWeb-2 cursor-resume smoke test, exact parameter/FLOP assertions, workflow-isolation checks and all job logs. Do not report a test as passed if its job was skipped, queued, cancelled, or failed.

For data, tokenizer, checkpoint, benchmark or evaluation changes, add targeted tests for tampering, mismatch, split leakage, partial artifacts, interrupted execution and incorrect lineage. Record the precise run ID, commit SHA, artifact ID/digest, test totals and remaining blockers in `docs/EXECUTIVE_HANDOVER.md`.

## 7. Development-session protocol

1. Read this file, `docs/EXECUTIVE_HANDOVER.md`, `v3/README.md`, the relevant source/tests and workflow before acting.
2. Fetch the live branch HEAD and latest OneCore Actions runs, jobs, artifacts, PRs and issues. Treat tool results as live evidence, not historical assumptions.
3. Pick one highest-impact safe unfinished task. Avoid repeating completed corpus, tokenizer, checkpoint, or failed benchmark operations unchanged.
4. Make the smallest justified change within `onecore-ai/`; add regression tests where behavior changes.
5. Run and inspect the canonical CI result. Review logs and artifacts, not just the top-level run conclusion.
6. Update `docs/EXECUTIVE_HANDOVER.md` with exact evidence and the next actionable task. Distinguish completed, failed, skipped, pending and blocked work.
7. Do not claim asynchronous/background continuation. Each session must finish with a concrete change, verified result, or an explicit capability blocker and safe next step.

## 8. Release and promotion policy

- No production, commercial-readiness, frontier-capability, or quality claim without independent, checkpoint-bound held-out evidence per modality and documented human review where appropriate.
- Establish promotion thresholds from measured baselines; never invent them or infer them from training loss.
- Keep inference checkpoint loading hash-pinned and do not execute model-generated tool calls as code. Tool execution must remain behind explicit schemas, allowlists and permission checks.
- Quantization and Android deployment come after a measured full-precision baseline and must pass output-equivalence, latency, memory and safety regression tests.
