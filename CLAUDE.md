# sort-arena-web — agent brain

## What this repo is

Frontend for the sort-bot-api take-home: a BattleBots × UFC broadcast experience for sorting algorithms. SPA built on Vite + React 18 + TS strict. Pure presentation layer — every server-side concern lives in [`sort-bot-api`](https://github.com/JustPinero/sort-bot-api).

**Phases:** 1 foundation → 2 Tale of the Tape + profile → 3 leaderboard → 4 arena → 5 submit + tournaments → 6 polish + homepage. Full scope in [`sort-bot-arena-kickoff.md`](./sort-bot-arena-kickoff.md).

## Where to look first

- [`sort-bot-arena-kickoff.md`](./sort-bot-arena-kickoff.md) — project kickoff prompt; phase scopes and exit criteria.
- [`references/architecture.md`](references/architecture.md) — load-bearing senior doc; explains every major design choice.
- [`references/design-system.md`](references/design-system.md) — colors, type, spacing, motion, components. Source of truth for `src/styles/tokens.css` + `tailwind.config.ts`.
- [`references/routing.md`](references/routing.md) — route table with theme + auth policy per route.
- [`references/state-management.md`](references/state-management.md) — TanStack Query + Zustand + SSE patterns.
- [`references/api-contracts.md`](references/api-contracts.md) — backend endpoints we consume; mirrored from sort-bot-api OpenAPI.
- [`references/security-landmines.md`](references/security-landmines.md) — XSS, CSP, localStorage, SSE validation.
- [`references/deployment-landmines.md`](references/deployment-landmines.md) — Vercel + Vite + SPA + SSE.
- [`references/env-vars.md`](references/env-vars.md) — env var reference.
- [`references/component-catalog.md`](references/component-catalog.md) — reusable component spec; grows phase by phase.

## Action loop

Prime → Plan → RED → GREEN → Validate.

- **Prime:** read the request, the relevant references, and any prior session handoff.
- **Plan:** write a plan in `requests/phase-N-plan.md` before touching code. Cross-reference architecture.md.
- **RED:** write the failing test first. Escape hatch: pure presentational components with zero business logic (design-system primitives, static page layouts) ship without a RED test. State-bearing components (forms, editors, battle viewer, SSE consumers) MUST go through RED.
- **GREEN:** make it pass with the simplest change.
- **Validate:** `pnpm validate` (lint + typecheck + unit + build). Local-CI parity is non-negotiable.

## Phase boundaries

| Phase | Branch                       | Status      |
| ----- | ---------------------------- | ----------- |
| 1     | `phase-1-foundation`         | in progress |
| 2     | `phase-2-fighter-profile`    | pending     |
| 3     | `phase-3-leaderboard`        | pending     |
| 4     | `phase-4-arena`              | pending     |
| 5     | `phase-5-submit-tournaments` | pending     |
| 6     | `phase-6-polish`             | pending     |

Phases merge to `main` only after `/phase-complete` passes.

## Invariants (do not violate)

- **`VITE_API_BASE_URL` is required.** `src/api/client.ts` throws at module load if unset.
- **All fetches go through `src/api/client.ts`.** Direct `fetch()` outside that module is an eslint error.
- **State boundaries:** server state via TanStack Query, client state via Zustand, component state via `useState`. Never the wrong tool for the wrong category.
- **No `dangerouslySetInnerHTML`** on anything, including AI-generated trash talk and analysis.
- **No frontend secrets.** Anthropic + Leonardo keys live exclusively on the backend.
- **API key never logged.** Sentry/error-tracker integrations must filter localStorage values.
- **SSE events validated before state changes** via zod schemas.
- **No commented-out code, debug `console.log`, or orphan TODOs in committed code.**
- **CI parity:** if `pnpm validate` passes locally, CI must pass. If it doesn't, fix `validate.sh` first.

## Agent guidance

- Default to writing no comments; explain WHY only when non-obvious.
- Don't add features beyond what the request asks. Bug fixes don't need surrounding cleanup.
- For UI changes, exercise the feature in a browser before reporting done. Type checking and tests verify code correctness, not feature correctness.
- Use `/defer <id>` to record debt; `/activate <id>` to resurface.
- Page weight budgets: layout shell + home <200KB gzip; profile <250KB; arena <400KB.
