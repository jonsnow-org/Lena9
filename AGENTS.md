# OnCore Project

## Structure
- onecore-ai/: unified foundation model implementation (Python/PyTorch).
- src/, server/, android-native/: Literium app.

## Development Rules
- Work on branch kilo/ivory-engine-kc6.
- Commit and push after each phase.
- No Python locally; rely on CI (ci-verify.yml) for tests.

## Verification
- GitHub Actions runs pytest on push/PR.

## Autonomous Operation
- Use synthetic data in tests; do not block on missing external data.