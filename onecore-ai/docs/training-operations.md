# OneCore — canonical training operations

## Single operating path

OneCore has one model implementation, one tokenizer, one joint trainer and one checkpoint lineage. Use only these workflows:

- `.github/workflows/onecore-ci.yml`: canonical integrity tests and explicitly selected real-artifact gates.
- `.github/workflows/onecore-v3-tokenizer.yml`: immutable 32K tokenizer adoption and evidence verification; it does not refit.
- `.github/workflows/onecore-v3-training.yml`: the only optimizer-training workflow; it remains fail-closed.

Do not use notebook-based training, a second request file, an alternate trainer or any legacy model directory.

## Active architecture contract

The active model is `onecore-v3-corrected-spec-3`:
- Text vocabulary: **32,000 BPE tokens**.
- Unified vocabulary: **33,048 IDs** (text, vision 512, audio 256, motion 256, special 24).
- Exact trainable parameter count: **86,152,897**.
- Width 1,024; four unique Transformer blocks; three recurrent cycles; eight attention heads; hidden size 2,730; context 512.
- One shared Transformer, tied text embedding/output head and native T-LDM with 16 latent slots; T-LDM adds zero parameters and its text/tool loss weight is 0.15.

Corrected-spec-3 supersedes corrected-spec-2 (4,096 text tokens, 5,144 unified IDs, 57,579,201 parameters). It creates a new configuration fingerprint and checkpoint lineage; old-config checkpoints are not compatible.

## Immutable corpus and tokenizer inputs

The external five-family corpus remains pinned as artifact `14892594659` from run `45325008221`, SHA-256 `302e6eb082ad82ee892b00153ac068f60505cdf5de5d14f3b82a919e576740a2`. Conversion report artifact `14893020087` has SHA-256 `151677083079aee3cfe5a39cbe07fbd47908e9c74560312cef9c137c64fcd1ba`. Do not redownload or reacquire these immutable inputs without proof of loss, expiry or corruption.

The active tokenizer was adopted unchanged from:
- Source run `45336933362`, artifact `14894835517`, name `onecore-v3-tokenizer-45325008221`.
- Source ZIP size 394,036 bytes; SHA-256 `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- Original tokenizer JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.
- Original evidence sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`.
- BPE, NFC and ByteLevel; exact 32,000 vocabulary; 591,525 external TRAIN text records; manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external-row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`; validation/test rows used 0; V2 tokenizer imported false.

Adoption verification is complete. Run **46135570153** succeeded and published re-attested artifact **15258954403**, name `onecore-v3-tokenizer-32000-adopted-45336933362`, size **787,772 bytes**, SHA-256 `0fb1339bded0560673dc794b02e25e72b8c2014d940d02a63940147908e809b0`. The run verified the source run/artifact metadata, ZIP digest, JSON and sidecar hashes, BPE/NFC/ByteLevel contract, exact vocabulary, special IDs and train-only provenance. The JSON bytes were preserved exactly; `tokenizer_bytes_modified=false`, `refit_performed=false`. New tokenizer-contract fingerprint: `57da186c1cd3a7a460ca2772e30908525f6538ce9104ebb1ca745ffbc9bedaed`.

The previous 4K tokenizer artifact `15256164799` remains immutable historical evidence and is not active.

## First authorized training segment

The sole immutable request is `onecore-ai/v3-training-request.json`:

| Setting | Value |
|---|---:|
| Updates per authorized segment | 5 |
| Total schedule | 20,000 |
| Warmup | 200 |
| Learning rate | 0.0003 |
| Weight decay | 0.1 |
| Gradient clipping | 1.0 |
| Checkpoint cadence | Every update |
| AdamW betas | (0.9, 0.95) |
| CPU threads | 4 |
| Seed | 20261124 |
| Native T-LDM weight | 0.15 |

One joint optimizer update accumulates one micro-batch per family in this order: text, tool, image, audio, video; it performs one optimizer step after the five objectives are accumulated.

## Required gates before any optimizer update

1. A real-corpus CPU benchmark must measure process-tree peak RSS, production loader throughput, per-family forward/backward timings and joint objective/AdamW allocation for the exact corrected-spec-3 config, corpus and tokenizer hashes.
2. A real-artifact step-zero checkpoint save/restore audit must pass for the exact corrected-spec-3 configuration and adopted tokenizer fingerprint.
3. The five-family external corpus gate, manifest and media hashes must pass; the tokenizer adoption/evidence now passes.
4. No conflicting workflow or writer session may be active.
5. The owner must explicitly authorize the first bounded segment.

A Verify/push CI run, analytic FLOPs, parameter count, synthetic fixture or prior-config checkpoint is not a resource benchmark or step-zero audit.

## After the first update

Before any longer run, perform a separate non-zero-step continuation audit. It must prove populated AdamW moments, exact parent-checkpoint SHA, advanced five-family/source cursors, scheduler/global step and Python/NumPy/Torch RNG states survive save/restore.

## Current verified state

- Corrected-spec-3 configuration, exact parameter/FLOPs checks and all unit/regression tests pass.
- Push CI run **46135570126** on `33f4ff0546b4a013c97b05f78d320e29a3b5fa1e`: success; **209 tests passed**; single-model, fail-closed training and FineWeb-2 exact cursor-resume checks succeeded.
- PR CI run **46135573821** on the same head: success; **209 tests passed**; same integrity checks succeeded.
- Tokenizer adoption run **46135570153**: success; adopted tokenizer artifact **15258954403** described above.
- Source package run **46135570132**: success; artifact **15259536745**, size 243,121 bytes, SHA-256 `578e0e80e05f937c1cccc283ca92219a91490e28d1cc1aebe39f21ebf3aa1c41`. It is source-only.
- The CPU benchmark, step-zero checkpoint audit, current corpus restoration job and held-out evaluation jobs in CI **were skipped**. They are not passes.
- No optimizer update has been performed. No trained checkpoint, non-zero continuation audit or independent held-out quality evaluation exists.
- Keep the `&& false` guard in `onecore-v3-training.yml` intact until the gates above pass and the owner explicitly authorizes training.

The conversion provenance caveat remains: 37 historical source rows were not found and 1,302 non-external rows were excluded; no synthetic records were added. Do not claim complete restoration of every historical source row.

