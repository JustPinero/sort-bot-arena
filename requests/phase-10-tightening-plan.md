# Phase 10 — Tightening

**Branch:** `phase-10-tightening`. Goal: address all open debt (D-8/9/10), get the QA grade to A, and resolve the FE code review findings. **TDD non-negotiable.** Slices stay small; many can run as parallel agent teams.

## Theme summary

| Theme                                | What it does                                                                                                        | # slices | Parallelism             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------- |
| **A. CI lockdown**                   | Server tests in CI, coverage thresholds, husky                                                                      | 4        | mostly sequential       |
| **B. Contract integrity**            | Zod schemas, apiClient overload, server adoption, MSW fidelity, drift test                                          | 6        | mostly parallel         |
| **C. Reliability + listeners**       | SSE reconnect bug, /readyz listener field, global SSE listener (D-8), 60s sweep (D-10), useStartBattle invalidation | 5        | parallel after C1+C2    |
| **D. Tournament orchestrator (D-9)** | Match-by-match orchestration; closes the escalation caveat                                                          | 5        | sequential within theme |
| **E. Frontend cleanup**              | apiError narrowing, DialogTriggerButton, useMutation auth, useEligibleFighters, polish bundle                       | 5        | parallel                |
| **F. Accessibility + UX**            | axe coverage on modals + pages, react-markdown for analysis                                                         | 3        | parallel                |
| **G. E2E breadth**                   | Real-server harness + 5 flows                                                                                       | 6        | sequential within G     |
| **H. Test cleanup**                  | Consolidate dup tests, tighten flaky pickStyle, dir rename                                                          | 2        | parallel                |

**Total: 36 slices.** (Bigger than phase 9. Justified — A-grade test coverage, all debt closed, all FE issues resolved.)

## Decisions (locked, see chat)

1. **D-9 closure:** ship self-orchestrator (option A from question 1).
2. **D-8 closure:** ship global SSE listener.
3. **E2E breadth:** all 5 real-server flows.
4. **Zod backfill:** all read endpoints (option B).

## Reference docs (read before starting any slice)

- `references/zod-schema-mirror.md` — schemas, overload, server adoption, drift test pattern
- `references/sse-reconnect-strategy.md` — exponential backoff, status taxonomy, test plan
- `references/tournament-orchestrator.md` — match-by-match design, schema, advancement
- `references/global-listener.md` — SSE consumer, idempotency, orchestrator hand-off
- `references/real-server-e2e-harness.md` — Playwright project structure, stub server, flows
- `references/ci-gates.md` — workflow YAML, thresholds, pre-commit, branch protection
- `requests/phase-10-tightening-plan.md` (this doc)
- `src/api/types.ts` — load-bearing for every contract test
- `src/api/queries.ts` — TanStack hooks; check declared response types

## Process invariants for every slice

1. **TDD.** Test first: contract test or component test (RED), then implementation (GREEN).
2. **Contract validation.** No "200 OK = green." Server slices import the appropriate strict schema from `src/api/schemas.ts` and `.parse()` responses. Frontend slices use `apiClient.get(path, { schema })`.
3. **Slice prompts cite line numbers** in `references/*.md` and `src/api/types.ts`.
4. **No untracked drift.** After each slice: `pnpm --filter @sort-bot-arena/server test && pnpm --filter @sort-bot-arena/server typecheck && pnpm test && pnpm typecheck && pnpm build`. All must pass.
5. **Stop and ask** if a slice can't be done without modifying behavior outside its stated scope.

---

## Slices

### Theme A — CI lockdown

**A1. Server tests in CI (foundational).**
Edit `.github/workflows/ci.yml`. Add server typecheck, server test, server build steps. Update `scripts/validate.sh` to match. **No parallel agents** — one PR-shaped change. Verify by triggering CI on the phase 10 branch.

**A2. Coverage thresholds.**
Add `coverage.thresholds` to both `vitest.config.ts` and `server/vitest.config.ts` (lines 80 / branches 75 / functions 80 / statements 80). Run with `--coverage` and confirm we exceed today; ratchet later if needed.

**A3. Husky + lint-staged.**
`.husky/pre-commit` runs `pnpm exec lint-staged`. `.husky/pre-push` runs `pnpm typecheck`. Add `lint-staged` config to `package.json`.

**A4. Branch protection docs.**
Add a section to `references/deployment-landmines.md` documenting required checks. (UI step to actually enforce; doc reflects intended state.)

### Theme B — Contract integrity

**B1. Zod schemas mirror types.ts.**
NEW `src/api/schemas.ts` exporting one schema per top-level type per `references/zod-schema-mirror.md`. `src/api/types.ts` becomes a barrel re-exporting `z.infer` types. Existing `battleSchema.ts` folds into the new file. NEW `src/api/schemas.test.ts` — for each type, parse a happy fixture and assert a tampered fixture fails.

**B2. `apiClient.get`/`.post` schema overload.**
Extend `src/api/client.ts` with `{schema}` option per the doc. Add `ApiError({code: 'malformed_response'})` path. Test: malformed response → ApiError with that code, not a render crash.

**B3. Backfill `useQuery` callsites with schemas.**
Every `useBot`, `useBattle`, `useTournament`, `useLeaderboard`, etc. in `src/api/queries.ts` passes its corresponding schema. Mechanical. Update `src/test/msw/handlers.ts` only if a fixture currently fails the strict schema.

**B4. Server tests adopt strict schemas.**
Replace hand-rolled `toHaveProperty` lists in `server/tests/*-shape.test.ts`, `read-routes.test.ts`, `write-routes.test.ts`, `feed-routes.test.ts`, `array-routes-shape.test.ts`, `bots-analysis-runs-shape.test.ts`, `leaderboard-shape.test.ts`, `battles-tournaments-shape.test.ts`, `history-list.test.ts` with `LeaderboardEntryStrictSchema.parse(body.items[0])` etc. Strict schemas catch added/removed/renamed fields.

**B5. MSW drift fixes (3 endpoints).**
Per the QA review:

- `GET /api/healthz` → MSW returns plain text `'ok'` (not JSON).
- `POST /api/v1/inputs` validation error envelope → match `{error:'bad_field', issues:[...]}`.
- `POST /api/v1/bots` validation error envelope → same.

**B6. Contract drift test.**
NEW `server/tests/contract-drift.test.ts`. For each endpoint in `src/api/queries.ts`, `app.request()` it (with happy fixtures via MSW upstream stubs), and assert the response parses against the strict schema. One test per endpoint, ~20 cases. This is the test that would have caught phase 8.

### Theme C — Reliability + listeners

**C1. SSE reconnect bug fix.**
Rewrite the reconnect path in `src/api/sse.ts` per `references/sse-reconnect-strategy.md`. Real `setTimeout(connect, backoff)` instead of dead `setStatus('reconnecting')`. Tests: 1/2/3 errors then recovery, unmount during reconnect, attempts reset on `onopen`.

**C2. `useStartBattle` invalidates `['battles']`.**
Two-line fix in `src/api/queries.ts`. Test: after submit, the `useBattles()` query is marked stale.

**C3. 60s battle status sweep (D-10).**
NEW `server/src/listener/battle-sweep.ts`. Background timer that finds `recent_battles.status='running'` rows older than 60s, fetches upstream, updates accordingly. Started from `src/index.ts` bootstrap. Tests: marked complete when upstream returns complete; marked failed on upstream failure; idempotent re-runs.

**C4. Global SSE listener (D-8).**
NEW `server/src/listener/global-listener.ts` per `references/global-listener.md`. Connect, parse, dispatch. Reconnect with backoff. Boots when `RUN_LISTENER=true`. Tests: parse fixture events, idempotent updates, unknown-battle insert path.

**C5. `/api/readyz` listener field.**
Extend the readyz handler to expose listener health (running/last_event_at/events_processed). Test: with listener disabled, readyz still 200 ready=true; with listener running, the field is populated.

### Theme D — Tournament orchestrator (closes D-9)

**D1. Schema + bracket helpers.**
New migration `0010_tournament_matches`. Pure helpers `server/src/synthesize/bracket.ts:buildInitialBracket(participants, size)`. Tests: 4/6/8/12 layouts, byes correct.

**D2. Tournament-inputs synthesis.**
`server/src/synthesize/tournament-inputs.ts:pickRoundInputs(inputs, round, mode, count)`. Pure, tested per round and mode.

**D3. Orchestrator core.**
NEW `server/src/orchestrator/tournament.ts:TournamentOrchestrator` class with `schedule(tournamentId)`, `advanceMatch(match)`. Tests: 4-bot bracket walks to completion via mocked match completions.

**D4. Wire orchestrator into POST /api/v1/tournaments.**
Update `server/src/routes/tournaments.ts` POST handler to insert `tournament_matches` rows + invoke `orchestrator.schedule`. Listener (C4) advances. Tests: end-to-end against MSW upstream.

**D5. Frontend tournament shape changes + remove escalation caveat.**
`synthesizeTournament` reads from `tournament_matches`. `TournamentSetupModal` removes the "coming once sort-bot-api supports..." tooltip copy. Tests: bracket page renders matches with bye, advancement, status transitions.

### Theme E — Frontend cleanup

**E1. ApiError narrowing helpers.**
NEW `src/api/error-helpers.ts` exporting `apiErrorStatus(err)` and `retryNon4xx(failureCount, err)`. Replace 8 cast sites in `queries.ts` and pages. Tests for both helpers.

**E2. `<DialogTriggerButton>` primitive.**
Extend `src/components/ui/dialog.tsx` with the new primitive. Refactor `MatchSetupModal`, `TournamentSetupModal`, `SignUpDialog` to use it. Net code drop ~30-50 lines. Tests: tooltip-on-disabled, button variants, focus styles.

**E3. `SignUpDialog` → `useMutation`.**
Replace imperative `signup()`/`login()` with `useSignup()` and `useLogin()` mutations. Tests: error states, loading, success closing modal.

**E4. `useEligibleFighters` hook.**
NEW `src/api/eligible-fighters.ts`. Replace 4 duplicate `useLeaderboard({weight:'all', activity:'all', sort:'rank'})` callers in match/tournament modals. Tests: filters retired, isLoading, hasEnough(n).

**E5. FE polish bundle.**
Smaller nits from the FE review:

- `client.ts:113` — drop `?? envelope.error` from the code fallback.
- `MatchSetupModal.tsx:131-133` — clear `submitError` in setters, not via deps-drifty effect.
- `InputPickerTabs.tsx:117-128` — drop `aria-label` (the visible label wins).
- `Tournament.weight_class_filter` — type as `WeightClassFilter | null`, not `string`.
- `ErrorBoundary.tsx:24` — gate `console.error` on `import.meta.env.DEV`.
- `RecentTournamentsList` — add `data-testid` + `aria-labelledby` for parity.
- `MSW handlers.ts:108` — import `weightClass` mapping from `src/lib/weightClass.ts`.

### Theme F — Accessibility + UX

**F1. axe coverage on modals.**
Add `it('has no a11y violations')` to `MatchSetupModal.test.tsx`, `TournamentSetupModal.test.tsx`, `SignUpDialog.test.tsx`. Use `vitest-axe`'s `toHaveNoViolations` matcher.

**F2. axe coverage on pages.**
Add the same test to every `src/pages/*.test.tsx` (HomePage, LeaderboardPage, BotProfilePage, BattlePage, TournamentBracketPage, ArenaIndexPage, SubmitPage, MyFightersPage, HallOfFamePage, AchievementsPage, EventsFeedPage, NotFoundPage, etc.).

**F3. react-markdown for analysis.**
Render `analysis: string` in `ScoutingReport.tsx` via `react-markdown` + `rehype-sanitize` with a strict element allowlist (no raw HTML, no images, no scripts). Add new dep. Tests: a Markdown analysis fixture renders as `<h2>` / `<ul>` / `<p>` not as `**Algorithm:**` literal text. Snapshot test for security: HTML in input doesn't escape sanitization.

### Theme G — E2E breadth (real-server harness)

**G1. Playwright config + stub server.**
Per `references/real-server-e2e-harness.md`. `playwright.config.ts` gains the second project. NEW `tests/e2e/real-server/fixtures/sort-bot-api-stub.ts`. NEW `/api/test/reset` route on our server (gated by `NODE_ENV=test`). One smoke spec verifying the harness boots.

**G2. Spec 1: signup → submit → portrait placeholder.**

**G3. Spec 2: login → battle → fight_end.**

**G4. Spec 3: logout → 401 → CTA flips.**

**G5. Spec 4: custom input upload → next match uses it.**

**G6. Spec 5: tournament 8-bracket escalation → bracket renders → advance → champion.**

### Theme H — Test cleanup

**H1. Consolidate + tighten.**
Replace duplicate tooltip tests in `MatchSetupModal.test.tsx` with `it.each`. Stub `Math.random` in `pickStyle` tests instead of running 8000 RNG calls. Drop `array-routes-shape.test.ts` `Array.isArray` assertions in favor of strict schema parse from B4.

**H2. Directory rename.**
`src/components/tournaments/MatchCard.tsx` → `src/components/tournament/MatchCard.tsx`. Update imports.

---

## Dependency graph

```
A1 (CI server tests)  ──┐
A2 (coverage)            ├─→ everything (validates the thing)
A3 (husky)               │
A4 (branch protection)   ┘

B1 (schemas) ─→ B2 (apiClient overload) ─→ B3 (frontend backfill)
                  └─→ B4 (server adoption)
                       └─→ B6 (drift test)
B5 (MSW drift fixes) — independent

C1 (SSE reconnect) — independent
C2 (useStartBattle invalidation) — independent
C3 (battle sweep) — independent (D-10 closes here)
C4 (global listener) — independent (D-8 closes here)
C5 (readyz listener field) ← C4

D1 (schema + bracket helpers) → D2 (input synthesis) → D3 (orchestrator) → D4 (wire POST) → D5 (frontend)
                                                                            └─ depends on C4 (listener) for advancement

E1-E4 — all parallel
E5 (polish bundle) — parallel

F1, F2 — parallel after a11y fixes are otherwise stable
F3 (markdown) — independent

G1 (harness) → G2-G6 (specs, parallel after G1)

H1, H2 — parallel
```

## Wave plan

```
Wave 0 (sequential, me):
  A1 → CI server tests landed first so every later wave is gated.

Wave 1 (parallel, agents):
  B1, C1, C2, E1, F3, H2

Wave 2 (parallel, agents):
  B2, C3, C4, D1, E2, E3

Wave 3 (parallel, agents):
  B3, B4, B5, C5, D2, E4, E5

Wave 4 (parallel, agents):
  B6, D3, F1, F2, G1, H1

Wave 5 (parallel, agents):
  D4, G2, G3

Wave 6 (parallel, agents):
  D5, G4, G5, G6

Wave 7 (sequential, me):
  A2, A3, A4 — gates that lock the new state in.

Wave 8 (sequential, me):
  Slice 13 close-out: docs, debt clear, merge, deploy.
```

Roughly 5–7 days at the cadence we hit in phase 9.

## Exit criteria

- Server tests + Playwright + frontend tests all run in CI on every PR.
- Coverage thresholds enforced: lines 80 / branches 75 / functions 80 / statements 80.
- All 5 real-server E2E flows passing.
- Contract-drift test passes for every read endpoint.
- D-8, D-9, D-10 closed in `debt.md`. Any newly-discovered debt in their place is documented.
- All FE review findings addressed (top 5 + smaller nits).
- QA review re-grade: target **A** across the board.
- Production deploys: server (Railway) + frontend (Vercel) up with the new code, smoke verified end-to-end.

## What this phase does NOT include (tracked separately)

- Visual regression tests (D-1, still deferred; phase 11+ if Playwright is already in place).
- Mutation testing (phase 11+).
- Multi-tab / multi-browser scenarios (phase 11+).
- Replay catch-up on listener reconnect (open question in `global-listener.md`).
- Tournament match retry on transient failure (orchestrator marks failed; future).
- Cross-replica leader election for the listener (single-replica enforced).

---

When you've read this and want to argue with the slicing or scope, drop notes here or in chat. Once approved I'll execute slice A1 first (CI gate) then run the wave plan.
