# OneCore executive handover

Updated: 2026-11-28 (owner-directed corrected-spec-3 recovery; tokenizer adoption and current CI verified)

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

## Tokenizer provenance and adoption — verified

The active corrected-spec-3 tokenizer is the immutable original 32K byte-level BPE artifact:
- Source workflow run **45336933362** (head `065daaa646a9b8ba1a3908476202bb4acddecd5c`).
- Artifact **14894835517**, name `onecore-v3-tokenizer-45325008221`, size **394,036 bytes**, archive SHA-256 `47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6`.
- Source file `onecore-v3-tokenizer-run605-vocab32000.json`; JSON SHA-256 `569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76`.
- Source sidecar SHA-256 `b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16`.
- BPE / NFC / ByteLevel; exact vocabulary 32,000; 591,525 external TRAIN text records; manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`; validation/test rows used 0; V2 tokenizer imported false.

Adoption run **46135570153** succeeded on code head `33f4ff0546b4a013c97b05f78d320e29a3b5fa1e`. It verified source run/artifact metadata, ZIP digest/size, exact member list, original JSON and sidecar hashes, vocabulary/special IDs and train-only evidence. It preserved the tokenizer JSON bytes exactly, with no refit and no validation/test data. It published artifact **15258954403**, name `onecore-v3-tokenizer-32000-adopted-45336933362`, size **787,772 bytes**, SHA-256 `0fb1339bded0560673dc794b02e25e72b8c2014d940d02a63940147908e809b0`. The new tokenizer-contract fingerprint is `57da186c1cd3a7a460ca2772e30908525f6538ce9104ebb1ca745ffbc9bedaed`.

The 4K artifact `15256164799` remains immutable historical evidence only; it is not active.

## Data lineage and caveats

- Pinned corpus artifact: `14892594659`, run `45325008221`; do not reacquire without proof of loss/expiry/corruption.
- Conversion report artifact: `14893020087`.
- External train coverage: text 591,525; tool 14,000; image 900; audio 1,100; video 100.
- Validation coverage: text 22,552; tool 400; image 10; audio 165; video 10.
- Test coverage: text 22,758; tool 400; image 10; audio 148; video 10.
- Provenance caveat: 37 historical source rows were not found and 1,302 non-external rows were excluded; no synthetic rows were added. Do not claim complete restoration of every historic source row.

## Implementation and verification status — current code head passed

The current implementation includes:
- corrected-spec-3 config, new configuration fingerprint, exact 86,152,897 parameter accounting and config-aware FLOPs;
- tokenizer-contract fingerprint independent of the full model tensor configuration, plus a byte-preserving adoption routine;
- canonical requests, CI assertions, tokenizer adoption workflow, training-workflow input verification, documentation, regression tests and source package;
- lazy public exports in `onecore-ai/src/onecore/v3/__init__.py` so tokenizer/config tooling does not load all training/data/evaluation dependencies unnecessarily;
- a corrected artifact-download redirect handler that does not forward GitHub bearer credentials to external signed storage URLs.

Current validated code head: **`33f4ff0546b4a013c97b05f78d320e29a3b5fa1e`**.

Verification on the corrected-spec-3 code/documentation head `efc02442d3803df686880a30c14d60ce3d4dc81f` and subsequent lock-only commits:
- CI push run **46135823139** and PR run **46135827011**: both success; **209 tests passed** in each.
- After the formal session-03 lease release, CI push run **46136004203** and PR run **46136007608** on lock-only head `f64bbd83cc747a1d8c11f1d1c1878643ea077d05`: both success; **209 tests passed** in each.
- Tokenizer adoption run **46135570153**: success; artifact **15258954403**; JSON bytes preserved, vocabulary exactly 32,000, 591,525 TRAIN records, zero validation/test use.
- Source package run **46135823169**: success; source-only artifact **15259149323**, size **245,146 bytes**, SHA-256 `3b1c9d406e4327ae765ec724b354c443e1ac4bf33b6465ebc649d6392ec2d881`.
- The lock-only source package after session-03 release also succeeded: run **46136004250**, artifact **15259956970**, size **245,206 bytes**, SHA-256 `5b3ac7c814589e1b456b3666de3bb80c624f0abfbfe70e867be165f44b29ae69`.

In all these Verify runs, the following optional jobs were **skipped**, not passed: real CPU resource measurement, real-artifact step-zero checkpoint save/restore, current corpus restoration and held-out evaluation. The post-release code tree is unchanged; the later commits only update handover/lock state.

## Training and promotion gates

No optimizer update has been performed. There is no corrected-spec-3 CPU resource benchmark, no real-artifact step-zero checkpoint audit for this config/tokenizer fingerprint, no continuation audit and no trained held-out evaluation. Keep `.github/workflows/onecore-v3-training.yml` fail-closed with `&& false`.

Do not authorize an optimizer update until:
1. Real CPU benchmark measures process-tree peak RSS, loader throughput, per-family forward/backward timings and joint optimizer allocation for corrected-spec-3, corpus and tokenizer hashes.
2. Real-artifact step-zero checkpoint save/restore passes for the exact corrected-spec-3 config and adopted 32K tokenizer.
3. Five-family source/manifest gates pass and no conflicting run or writer is active.
4. Owner explicitly authorizes the first five joint optimizer updates, checkpointing every update.

After the first update, run a separate non-zero-step checkpoint continuation audit for AdamW moments, parent checkpoint SHA, global step, five-family cursors and RNG state before any longer segment. CI or analytic FLOPs never substitute for these gates.

## Pull request, branch and active lock

- Repository: `jonsnow-org/Lena9`.
- Active branch: `research/onecore-v3-implementation`.
- PR **#12**: <https://github.com/jonsnow-org/Lena9/pull/12> — open, unmerged, target `main`.
- `main` remains unchanged by this work.
- Preserve the old `research/onecore-foundation` ref and historical 4K artifacts until PR #12 is reviewed/merged; do not retarget or delete historical refs before merge.

The abandoned recovery session was taken over only after the owner explicitly authorized it. Its lease `onecore-32k-owner-takeover-20261128-03` was formally released at `2026-11-28T10:36:24Z` in commit `f64bbd83cc747a1d8c11f1d1c1878643ea077d05`, recording the validated parent head `efc02442d3803df686880a30c14d60ce3d4dc81f`. A brief documentation-only lease `onecore-handover-lock-correction-20261128-04` was opened to align this handover wording with that release; it is released in the final handover/lock commit. After that commit, `SESSION_LOCK.json` is `released` with holder/session/expiry cleared. The repository is left without an active writer lease. The lock is coordination, not evidence of a successful model gate.

## Mandatory multi-client coordination protocol

Every client must read `SESSION_PROTOCOL.md`, `AGENTS.md` and this complete handover before writing. Reconcile current branch HEAD, latest 20 relevant Actions runs, PRs and active tasks; acquire or renew the shared lock using compare-and-swap; write only to the single canonical branch. Record exact commits, test totals, workflow/job IDs, artifacts, failures and skipped gates. Never create another model/trainer/workflow/branch or bypass training gates.
