# Real-server E2E harness (Playwright)

## Why

Today's `playwright.config.ts` boots Vite with `VITE_USE_MOCKS=true` — Playwright drives a browser, but every API call is intercepted by MSW. Result: zero coverage of cookie auth across origins, CORS preflight, real Hono server behavior, real libsql round-trips.

The phase 8 SameSite=Lax bug landed because there was no E2E test that exercised cross-origin cookie attachment. Phase 10 fixes the gap with a second Playwright project that runs against a **real** Hono server.

## Two-project structure

```
playwright.config.ts:
  projects: [
    { name: 'mocked',      testDir: './tests/e2e/mocked',      use: { ... }, webServer: { mocks=true ... } },
    { name: 'real-server', testDir: './tests/e2e/real-server', use: { ... }, webServer: [server, frontend] },
  ]
```

`mocked` is the existing project (one outage spec stays there).
`real-server` is new — boots both halves of the stack.

## Real-server stack

For the `real-server` project, Playwright boots:

1. **The arena server** on port 3055 (or whatever's free).
   - `DATABASE_URL=file::memory:` (in-memory libsql, fresh per run)
   - `SORT_BOT_API_URL=http://127.0.0.1:8081` (a stubbed sort-bot-api MSW process)
   - `SESSION_SECRET=test_only_session_secret_at_least_32_chars`
   - `ALLOWED_ORIGINS=http://localhost:5173`
   - `LEONARDO_API_KEY` and `ANTHROPIC_API_KEY` unset (persona service degrades to nicknames-only, fine for E2E)
   - `RUN_LISTENER=false`
2. **A stubbed sort-bot-api** on port 8081 — small Express or Hono server that mimics sort-bot-api's relevant endpoints. Lives at `tests/e2e/real-server/fixtures/sort-bot-api-stub.ts`. Returns canned responses matching the live shapes (anchored to `references/sort-bot-api-shapes.md`).
3. **Vite** on port 5173 with `VITE_USE_MOCKS=false`, `VITE_API_BASE_URL=http://localhost:3055`.

`webServer` in Playwright config supports an array of commands. Order: stub → server → vite. Each has its own readiness probe.

## Why a stub instead of the real sort-bot-api?

- **Determinism.** sort-bot-api's evaluator runs bots in subprocesses. We don't want flaky CI from subprocess timing.
- **Speed.** Real sort-bot-api evaluates a bot against 57 inputs over a few seconds. The stub returns instantly.
- **Isolation.** The stub is bound to localhost; CI doesn't depend on the deployed Railway service being up.

The stub's contract correctness is verified by the contract-drift test (separate from E2E). E2E asserts our app's behavior against the *contract*, not against sort-bot-api's actual implementation.

## Test fixtures

`tests/e2e/real-server/fixtures/`:
- `sort-bot-api-stub.ts` — the stub server.
- `accounts.ts` — helpers to register a fresh user via `POST /api/v1/auth/signup` programmatically.
- `bots.ts` — helpers to submit a bot.
- `clean.ts` — flushes the in-memory libsql between tests via a server-side `/api/test/reset` route (only available when `NODE_ENV=test`).

`/api/test/reset` is gated by env so we don't accidentally expose it in production.

## The 5 flows

Each flow is one `*.spec.ts` file in `tests/e2e/real-server/`:

### 1. `signup-submit-portrait.spec.ts`
- Visit `/`, click Sign up, fill form, submit.
- Assert top-nav shows display name + Sign out.
- Navigate to `/submit`, paste source, choose language, submit.
- Assert redirect to bot profile.
- Assert nickname appears (deterministic).
- Persona generation skipped (no Leonardo/Anthropic in E2E env), so portrait is null — assert placeholder element renders without crashing.

### 2. `login-battle-fight-end.spec.ts`
- Pre-seeded user via signup helper.
- Login, navigate to Arena, click Setup a match.
- Pick two pre-seeded bots, choose Sparring preset.
- Submit. Stub immediately returns CreateBattleResponse.
- Stub's SSE endpoint emits `battle_start`, `run_start`, `run_complete`, `battle_complete`.
- Assert BattleViewer renders walkout → fight_start → round events → fight_end with the right winner name.

### 3. `logout-401-cta.spec.ts`
- Logged-in user.
- Click Sign out.
- Assert /me returns 401 (or the auth store flips to user=null).
- Assert top-nav swaps to Sign up CTA.
- Hard refresh, assert state persists (no leftover cookie).

### 4. `custom-input-flow.spec.ts`
- Logged-in user.
- Open Setup a match, switch to Upload tab.
- Paste comma-separated ints, submit.
- Assert input appears in Manual tab pre-checked.
- Submit match, assert request body includes the new input id.

### 5. `tournament-escalation.spec.ts`
- Pre-seeded with 8 bots, all with completed evaluations (stub returns ranked).
- Open Setup a tournament, pick bracket size 8, choose Escalation, fill via Random.
- Submit. Stub fires `battle_complete` events for round-1 matches.
- Assert bracket renders, round 1 advances, round 2 fires (stub responds).
- Walk to final, assert champion crowned.

## Running

```sh
pnpm exec playwright test --project=real-server
```

Single run takes ~30s for all 5 specs (fast because stub returns instantly). Each spec gets its own `clean()` to reset libsql state.

## CI integration

`.github/workflows/ci.yml` gains a step:

```yaml
- name: e2e (real server)
  run: pnpm exec playwright test --project=real-server
```

Browser binaries cached via `~/.cache/ms-playwright` keyed on `pnpm-lock.yaml`.

Failures upload trace + screenshot artifacts.

## Compatibility with `mocked` project

The existing outage-stale-cache spec stays in the `mocked` project. New flows go to `real-server`. `webServer` arrays per-project means Playwright boots only what each project needs.

## What this does NOT cover

- Real sort-bot-api integration. That happens at the dev-stack level, not E2E.
- Visual regression. Out of scope for phase 10.
- Multi-tab / multi-browser scenarios.
- Mobile viewports. Add to `mocked` project later if needed.

## Cleanup story

When phase 10 ships, the `mocked` project keeps the outage spec (stale cache scenario can't easily be reproduced against the real server without intentionally killing it mid-test). Anything else moves to `real-server`.
