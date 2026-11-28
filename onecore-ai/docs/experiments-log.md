# OneCore engineering experiment log

Historical note: the baseline values below document the earlier prototype-2 experiment record and are not the current architecture contract. The current corrected-spec-2 model has 57,579,201 trainable parameters, width 1,024 and 4,096 text tokens (5,144 unified tokens). See `ARCHITECTURE.md` and `docs/EXECUTIVE_HANDOVER.md` for the current contract. This log is retained for provenance, not as an active model specification.

## Superseded prototype-2 baseline — historical only

- Implementation: `onecore-ai/src/onecore/v3/`.
- Exact trainable parameter count: **39,906,568**.
- Text vocabulary: 32,000 byte-level BPE, fitted on 591,525 external train-text rows only.
- Shared core: width 512, four unique Transformer blocks, three recurrent cycles, eight attention heads.
- Native T-LDM: 16 latent slots, same shared core and tied text head, zero additional trainable parameters, text/tool objective weight 0.15.

## Corrected-spec canonical model and tokenizer

- Canonical architecture: `onecore-v3-corrected-spec-2`, 57,579,201 trainable parameters, width 1,024, text BPE 4,096 and unified vocabulary 5,144. The prototype-2 39,906,568-parameter/32,000-token figures above are superseded historical measurements, not a second model.
- Tokenizer run #6: `46128204163`, source commit `27e2e2ba5339b6f45f60fa90f88ae28d5fd5d87f`; artifact `15256164799`, name `onecore-corrected-spec-tokenizer-4096-45325008221`, 42,523 bytes, ZIP digest `sha256:ba29243d09e77ca06c9700f9529e9cf313dbd5f9eb208b903fdbb97224699370`.
- Tokenizer JSON SHA-256 `6e1c5ed9bf3c44f9e520edf04a90caf97c15fa622f9b5df8d651345fef27dacd`; 4,096 tokens from 591,525 external TRAIN text records; TRAIN manifest SHA-256 `d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205`; external-row fingerprint `6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720`; validation/test rows used 0; imported V2 tokenizer false. The 32,000-token artifact remains preserved for provenance only.

## Native T-LDM integration

- `c19cda838029c67e81c0dae90d39e7c822b96c3e`: native latent thinker/writer and iterative generation added to the shared core.
- `5880190ca6f8c0042c0418c3d7fa87e78f98c567`: masked diffusion loss added to text/tool objectives, request weight 0.15 and workflow wiring.
- `7e93fb450b7fd646221fb3bd24b2b83b9903247b`: T-LDM FLOPs included in reports; regression tests cover masking, tied weights, parameter invariance, objective and generation.
- Run #765 (`45957914217`) passed all 17 Verify steps: **398 passed, 45 warnings**. No CPU benchmark, checkpoint audit, evaluation or optimizer update ran.

## Single-path consolidation

- `432ac41054536673aa05717ca10da66926794f40` removed 65 parallel legacy model/trainer/workflow/notebook files from the active branch.
- `3822d49814b48a1175eb4ddd6a6b880f963241ed` moved stable row identity, nested-field and pinned-video helpers into `src/onecore/v3/source_utils.py` and generalized corpus conversion API names.
- `d2a0734404aa73187005dd1c4400e0027ed8a725` corrected a duplicated `sourcesource_row_identity` import name in the converter and test.
- Run #769 (`45960222457`) passed compile, exact architecture and FLOPs checks, then reported 208 passed / 1 failed. The remaining failure was a stale expected image-cursor path; commit `1c1b4e59adf929ec27131cad91625b1ac318bb12` changes it to `v3-corpus-restore-image-identity` and removes notebook-specific cursor routing.

## Training status

No optimizer update has been verified for the current T-LDM-enabled configuration. No trained checkpoint or independent held-out model-quality evaluation exists. The prior step-zero checkpoint audit predates the current T-LDM-enabled configuration fingerprint and cannot authorize training.

Next gates: run a successful real-corpus CPU benchmark tied to current config/manifest/tokenizer hashes, repeat the real-artifact step-zero checkpoint audit for this exact fingerprint, and obtain explicit owner authorization before the first five-update segment.
