---
description: Update CI workflow to match a change in scripts/validate.sh. Maintains local-CI parity.
---

`scripts/validate.sh` is the source of truth for what "passing" means. CI must mirror it.

Process:

1. Diff `scripts/validate.sh` vs the current `.github/workflows/ci.yml`.
2. For each new step in `validate.sh`, add the equivalent CI step. For each removed step, remove the CI step.
3. Pin tool versions in CI to whatever `validate.sh` assumes (Node 20.x, pnpm 9.x).
4. Verify CI is still green on the current branch after the update.
5. If the validate script grew a step that needs a CI service (e.g., a database container), add the service block.

Don't introduce CI-only checks that aren't in `validate.sh`. If a check matters for CI, it matters for local development too.
