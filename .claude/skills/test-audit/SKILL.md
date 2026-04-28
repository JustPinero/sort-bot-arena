---
name: test-audit
description: Audit the test suite for coverage gaps, missing RED tests, flaky tests, and a11y blind spots. Run via /run-audits or /test-audit.
---

# Test Audit

Sweep the suite for the failure modes that bite later.

## What to check

1. **State-bearing components without tests.** Every component that owns state, calls the API client, subscribes to a store, or mounts an effect must have a `.test.tsx`. Pure presentational primitives can ship with smoke tests.
2. **RED-first violations.** Look for components added in the last phase that landed without a failing-first test in `git log`. These are debt.
3. **Coverage gaps.** Run `pnpm test:coverage`. Any file under `src/api/`, `src/stores/`, `src/lib/`, or `src/components/{layout,fighter,arena,leaderboard,tournaments,submit}/` below 80% line coverage is flagged.
4. **a11y blind spots.** Components missing the smoke-test `axe` check. Components with interactive children but no keyboard test (`userEvent.tab`, `userEvent.keyboard`).
5. **Flaky markers.** Any `.skip`, `.only`, `.todo`, `vi.spyOn(console, …)` left in committed code.
6. **Mock layer hygiene.** MSW handlers should mirror the OpenAPI types. Drift means a frontend test passes against a contract the backend doesn't actually enforce.
7. **Visual regression coverage** (Phase 2+). TotT, KO graphic, podium top-3, decision graphic should all have Playwright snapshots.

## How to run

`/run-audits` triggers all audits including this one via the `audit-runner` agent. `/test-audit` runs this audit alone.

## Output

`audits/test-audit-<timestamp>.md` with sections per finding category, priority, and a punch list of fixes.
