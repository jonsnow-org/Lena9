# OneCore executive handover

Updated: 2026-11-28 (owner-directed corrected-spec-3 recovery)

## Canonical product state

**OneCore is one model, one active implementation, one tokenizer, one joint trainer and one checkpoint lineage.** The only active implementation is `onecore-ai/src/onecore/v3/` on `research/onecore-v3-implementation`.

The repository owner's current architecture decision is **`onecore-v3-corrected-spec-3`**:
- **32,000 text BPE tokens** in a **33,048-token unified vocabulary**.
- **86,152,897 trainable parameters**.
- Width 1,024; four unique Transformer blocks reused across three cycles (12 applications); eight heads; SwiGLU width 2,730; RMSNorm; context 512.
- One shared semantic Transformer, shared embedding and tied text output projection.
- Native T-LDM uses 16 latent slots and the same core/head, adding zero parameters; objective weight 0.15 for text/tool.
- Unified ID ranges: text 0–31,999; vision 32,000–32,511; audio 32,512–32,767; motion 32,768–33,023; special 33,024–33,047.

This supersedes corrected-spec-2 (4,096 text tokens, 5,144 unified IDs and 57,579,201 parameters). The change creates a new full configuration fingerprint and checkpoint lineage. Do not load old-config checkpoints as corrected-spec-3.

## Parameter, storage and FLOPs accounting

The unified embedding/tied output matrix grows by 27,904 rows × 1,024 dimensions = 28,573,696 parameters, from 57,579,201 to **86,152,897**.

Theoretical storage estimates (not measured memory): FP32 parameters 344,611,588 bytes; FP16 parameters 172,305,794 bytes; AdamW FP32 moments 689,223,176 bytes; parameter-plus-moments estimate 1,033,834,764 bytes; full training-state estimate 1,378,446,352 bytes.

Config-aware analytic FLOPs:
- Joint training update at T=128: 1,516,166,184,960.
- Joint training update at T=512: 6,136,611,471,360.
- Five-family forward dense sum for paths text/tool/image/audio/video = 1,514,126,278,656.
- Corresponding dense training sum = 4,542,378,835,968.
These are analytic counts only, not CPU benchmarks.

## Tokenizer provenance and adoption

The active corrected-spec-3 tokenizer is the immutable original 32K byte-level BPE artifact:
- Source workflow run **45336933362** (head `065daaa646a9b8ba1a3908476202bb4acddecd5c`).
- Artifact **14894835517**, name `onecore-v3-tokenizer-45325008221`, size **394,036 bytes**, archive SHA-256 `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- Source file `onecore-v3-tokenizer-run605-vocab32000.json`; JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.
- Source sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`.
- BPE / NFC / ByteLevel; exact vocabulary 32,000; 591,525 external TRAIN text records; manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`; validation/test rows used 0; V2 tokenizer imported false.

The adoption flow verifies run/artifact metadata, ZIP digest and size, exact archive members, tokenizer JSON hash, original evidence hash, vocabulary/special IDs and train-only provenance. It preserves tokenizer JSON bytes exactly and creates a new sidecar carrying both corrected-spec-3 config fingerprint and tokenizer-contract fingerprint. No refit or heldout data is involved. The 4K artifact `15256164799` remains immutable historical evidence only; it is no longer active.

## Data lineage and caveats

- Pinned corpus artifact: `14892594659`, run `45325008221`; do not reacquire without proof of loss/expiry/corruption.
- Conversion report artifact: `14893020087`.
- External train coverage: text 591,525; tool 14,000; image 900; audio 1,100; video 100.
- Validation coverage: text 22,552; tool 400; image 10; audio 165; video 10.
- Test coverage: text 22,758; tool 400; image 10; audio 148; video 10.
- Provenance caveat: 37 historical source rows were not found and 1,302 non-external rows were excluded; no synthetic rows were added. Do not claim complete restoration of every historic source row.

## Implementation and verification status

Implemented on the canonical branch in commits:
- `b5cd6935202e23322a25b260148cc5e92de08d98`: corrected-spec-3 config, parameter accounting and config-aware FLOPs.
- `eb0d43364593a94ee7246fea19c2aabf12058a67`: tokenizer contract fingerprint and byte-preserving adoption helper.
- `364c88f56a9e9f37eb6433132caec6be49170a8c`: pinned 32K requests, adoption workflow and training validation.
- `3fd7ae1d4961279f255b68578b3f18c515644fa3`: refreshed CI expectations, tokenizer-workflow torch dependency and policy-test pins.

The first CI attempts correctly failed because a central Verify assertion still pinned spec-2 values; the tokenizer-adoption job also lacked CPU PyTorch while importing the config/model package. These causes were corrected in the latest changes. The latest new CI runs must still complete before this migration is called verified. Source-package builds passed on the prior implementation heads; this is not a substitute for current CI.

The current canonical configuration reports 86,152,897 parameters and config-aware FLOPs. Full current test suite, corrected-spec-3 tokenizer adoption workflow and both push/PR Verify jobs remain pending final successful run evidence.

## Training and promotion gates

No optimizer update has been performed. There is no corrected-spec-3 CPU resource benchmark, no real-artifact step-zero checkpoint audit for this config/tokenizer fingerprint, no continuation audit and no trained held-out evaluation. Keep `.github/workflows/onecore-v3-training.yml` fail-closed with `&& false`.

Do not authorize an optimizer update until:
1. Real CPU benchmark measures process-tree peak RSS, loader throughput, per-family forward/backward timings and joint optimizer allocation for corrected-spec-3, corpus and tokenizer hashes.
2. Real-artifact step-zero checkpoint save/restore passes for the exact corrected-spec-3 config and adopted 32K tokenizer.
3. Five-family source/manifest gates pass and no conflicting writer or run is active.
4. Owner explicitly authorizes the first five joint optimizer updates, checkpointing every update.

After the first update, run a separate non-zero-step checkpoint continuation audit for AdamW moments, parent checkpoint SHA, global step, five-family cursors and RNG state before any longer segment. CI or analytic FLOPs never substitute for these gates.

## Pull request, branch and active lock

- Repository: `jonsnow-org/Lena9`.
- Active branch: `research/onecore-v3-implementation`.
- PR **#12**: <https://github.com/jonsnow-org/Lena9/pull/12> — open, unmerged, target `main`.
- `main` remains unchanged by this work.
- Preserve the old 4K artifacts and old foundation ref as historical until PR is reviewed/merged. Do not merge until current CI, tokenizer adoption, docs and review are complete.

The stopped recovery session's lock was replaced only after the owner explicitly authorized takeover. The current writer lease is `onecore-32k-owner-takeover-20261128-03`; use compare-and-swap for any renewal/release and record current HEAD and run evidence here. The lock is coordination, not evidence of successful implementation.

## Mandatory multi-client coordination protocol

Every client must read `SESSION_PROTOCOL.md`, `AGENTS.md` and this complete handover before writing. Reconcile current branch HEAD, latest 20 relevant Actions runs, PRs and active tasks; acquire or renew the shared lock using compare-and-swap; write only to the single canonical branch. Record exact commits, test totals, workflow/job IDs, artifacts, failures and skipped gates. Never create another model/trainer/workflow/branch or bypass training gates.
