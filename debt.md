# Debt Log

Entries from `/defer`. Resurface via `/activate <id>`.

## D-1 (2026-04-28) — phase-2-fighter-profile / 40a38da

Visual regression Playwright snapshots for Tale of the Tape variants and the full BotProfilePage are out of Phase 2's shipped scope.

The kickoff §4 Phase 2 exit criteria asked for: "Visual regression test snapshots committed for: TotT pre-fight, TotT champion variant, TotT rookie variant, TotT mobile layout, full profile page."

The Playwright config + `tests/e2e/` scaffold are in place from Phase 1 Slice 8. What's missing:

1. A `tests/e2e/tale-of-the-tape.spec.ts` that loads `/dev/design-system` (or a dedicated fixture route) and screenshots each TotT variant at desktop + mobile widths.
2. A `tests/e2e/bot-profile.spec.ts` for the full profile page in the champion + rookie variants.
3. A CI job that runs `pnpm exec playwright test --grep @phase-2` and uploads diffs as artifacts.

Why deferred: shipping the snapshots requires booting the dev server in CI (with MSW enabled), which in turn requires adding a Playwright workflow and tuning the `webServer` config so the CI run isn't flaky. Worth doing, but the visual contract is otherwise enforced by axe-clean smoke tests + the design tokens being consumed via CSS variables (no inline hex). The take-home is shippable without it.

When activated: branch `phase-2-visual-regression` from main, add the two specs, gate them on `VITE_ENABLE_VISUAL_REGRESSION=true`, wire a Playwright job into `.github/workflows/ci.yml` that runs only on PR (not main) so a flaky snapshot doesn't block deploys.
