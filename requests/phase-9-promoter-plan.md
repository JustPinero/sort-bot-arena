# Phase 9 — Promoter

**Branch:** `phase-9-promoter`. Slices target small, focused subagent prompts (per Justin's guidance: small slices, lots of them, limit per-prompt context).

## Theme

User-driven matchmaking. Two new product surfaces — match setup (battles) and tournament setup (bracket creation) — backed by persistent Turso storage, plus a portrait-variety pass on the persona generator.

## Decisions (locked, see Q&A in chat)

| #   | Decision            | Detail                                                                                                                                                                                                                      |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Battle weight class | Server-derived label from average `size_class` of the inputs picked: `sparring` (avg small) / `exhibition` (avg medium) / `title_fight` (avg large)                                                                         |
| 2   | Battle cooldown     | **Rule A:** no simultaneous battles per pair AND max 3 completed per pair per rolling hour. 429 + `Retry-After`                                                                                                             |
| 3   | Tournament inputs   | User-toggle in modal: `flat_random` (any 3 from 57) vs `escalation` (round-thematic). Caveat: sort-bot-api today only supports uniform `count` — escalation persisted as analytics until upstream supports per-match inputs |
| 4   | Portrait re-roll    | **No.** First gen is final. Lazy backfill only                                                                                                                                                                              |
| 5   | Custom input        | Max 50,000 elements; integers only; negatives allowed; format dropdown (comma default / space / newline)                                                                                                                    |
| 6   | Bracket sizes       | Locked: 4 / 6 / 8 / 12. Byes for non-power-of-2                                                                                                                                                                             |
| 7   | Bot tile picker     | All evaluated, non-retired. Search by name. Single grid, paginate >50                                                                                                                                                       |
| 8   | 8 portrait styles   | steampunk, cyberpunk, cartoony, anime, classic-battlebot, kaiju, medieval, retro-arcade. Uniform RNG per generation                                                                                                         |
| 9   | Persistence         | Turso live in production via slice 0                                                                                                                                                                                        |
| 10  | Quick fight         | Arena page button: 2 random bots + 3 random inputs, fire-and-redirect                                                                                                                                                       |
| 11  | Custom inputs       | Globally shared (any user can use any uploaded input)                                                                                                                                                                       |
| 12  | History pages       | In-scope. `GET /api/v1/battles` + `/api/v1/tournaments` backed by Turso                                                                                                                                                     |

## Reference docs (read before starting any slice)

- `references/leonardo-style-prompts.md` — 8 style prompts + selection logic
- `references/turso-migration-and-schema.md` — provisioning steps + 4 new migrations
- `references/battle-cooldown-and-rate-limit.md` — pair_key + 429 enforcement
- `references/bracket-math-and-tournament-flow.md` — bracket sizes, picker, input policy caveat
- `references/portrait-backfill-policy.md` — Semaphore + which routes trigger
- `references/sort-bot-api-shapes.md` — upstream contract (existing)
- `src/api/types.ts` — frontend type contract — load-bearing for every contract test
- `src/api/queries.ts` — TanStack Query hooks; check declared response types

## Process invariants for every slice

1. **TDD.** Test first: contract test (parse the response against `src/api/types.ts`), then RED component/route test, then GREEN.
2. **Contract validation.** No "200 OK = green." Every server route slice asserts the response body keys match the corresponding frontend type. Every frontend slice asserts the rendered DOM with `screen.getBy*` — not just a smoke render.
3. **Slice prompts cite line numbers** in `references/*.md` and `src/api/types.ts` so the subagent can't invent shapes.
4. **No untracked drift.** After each slice, run `pnpm --filter @sort-bot-arena/server test && pnpm --filter @sort-bot-arena/server typecheck && pnpm test && pnpm typecheck && pnpm build`. If any fail, do not move on.
5. **Stop and ask** if a slice can't be done without modifying behavior outside its stated scope.

---

## Slices

### Slice 0 — Turso provisioning

**Owner:** Justin (or me, opt-in). One-shot operational step, no subagent.

**Steps:**

- `~/.turso/turso db create sort-bot-arena-server --group default`
- Capture URL + token, set on Railway env (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`)
- Trigger Railway redeploy. Verify `schema_migrations` table populated with all 5 existing migrations
- Update `references/server-architecture.md` to note Turso prod / file:local dev

**Exit:** Production server boots clean against Turso, all existing tests pass, `/api/healthz` green.

### Slice 1 — Schema migrations

**Goal:** Append migrations 0006-0009 to `server/src/db/schema.ts`. No behavior changes yet — just the table shapes.

**Files:**

- `server/src/db/schema.ts` (append 4 migrations)
- `server/tests/migration-shape.test.ts` (NEW — assert each new table exists with the expected columns after `runMigrations()`)

**Read first:** `references/turso-migration-and-schema.md`.

**Exit:** New test asserts all 4 tables/columns present after migrations run on `:memory:`. All 87 existing server tests still pass.

### Slice 2 — Portrait styles + variety RNG

**Goal:** Replace single `buildPortraitPrompt` with the 8-style pool, RNG selection. Persist selected style on `bot_personas.style`.

**Files:**

- `server/src/persona/leonardo.ts` (refactor `buildPortraitPrompt` to return `{prompt, style}`; add `STYLES`, `PROMPTS`, `pickStyle`)
- `server/src/persona/store.ts` (extend `setLeonardoGenerationId` to also write `style`)
- `server/src/persona/service.ts` (thread style through generatePortrait)
- `server/tests/persona-styles.test.ts` (NEW — `pickStyle` distribution; prompt-shape snapshot per style)

**Read first:** `references/leonardo-style-prompts.md`.

**Exit:** Generating a portrait writes a row with one of 8 known style strings. Existing persona tests still pass. Snapshot tests fail loudly if a prompt fragment drifts.

### Slice 3 — Persona backfill semaphore + list-endpoint triggers

**Goal:** Add concurrency-capped backfill, fire from every list endpoint that returns bots.

**Files:**

- `server/src/persona/semaphore.ts` (NEW — generic Semaphore class)
- `server/src/persona/service.ts` (use semaphore in `startBackgroundGeneration`)
- `server/src/routes/leaderboard.ts`, `feed.ts`, `halloffame.ts`, `users.ts`, `per-input-leaderboard.ts` (each adds `startBackgroundGeneration` for any persona-less bot in its response)
- `server/tests/persona-backfill.test.ts` (NEW — semaphore unit + integration: leaderboard with 5 bots, all persona-less, fires 5 generations)

**Read first:** `references/portrait-backfill-policy.md`.

**Exit:** Leaderboard, feed/snapshot, halloffame, users/me/bots, per-input-leaderboard all trigger backfill. Semaphore caps at 3 concurrent. Tests prove the wiring. No breaking changes to response shapes.

### Slice 4 — Battle cooldown enforcement

**Goal:** New `POST /api/v1/battles` route with cooldown rules + `recent_battles` writes. Replaces today's pure pass-through.

**Files:**

- `server/src/store/recent-battles.ts` (NEW — `pairKey`, `findActive`, `countCompletedSince`, `insertPending`, `markRunning`, `markComplete`, `markFailed`)
- `server/src/routes/battles.ts` (rewrite POST handler; existing GET handlers stay the same)
- `server/tests/battle-cooldown.test.ts` (NEW — pairKey symmetry; simultaneous→429 pair_busy; 4th in hour→429 pair_cooldown; race-safe under 50 simultaneous)

**Read first:** `references/battle-cooldown-and-rate-limit.md`.

**Exit:** Cooldown enforced server-side. 429 envelope + Retry-After matches the design doc. Existing battle GET routes unchanged.

### Slice 5 — Battle weight-class label

**Goal:** Server derives `weight_class` from input size_classes when a battle is created. Persisted on `recent_battles.weight_class`. Surface on the rich Battle shape.

**Files:**

- `server/src/synthesize/battle-class.ts` (NEW — pure: `weightClassFor(inputSizeClasses[]) → 'sparring'|'exhibition'|'title_fight'`)
- `server/src/routes/battles.ts` (compute label at create time; populate on recent_battles row; expose on `Battle` response)
- `src/api/types.ts` (extend `Battle` with `weight_class: 'sparring'|'exhibition'|'title_fight'|null`)
- `server/tests/battle-class.test.ts` (NEW — table-driven for every avg combo)
- Frontend slice in slice 8 picks this up.

**Read first:** decisions table row 1 above.

**Exit:** Pure helper, server route writes label, frontend type updated. Server `/battles/:id` response includes weight_class. No frontend rendering yet — that's slice 8.

### Slice 6 — Custom input upload (server)

**Goal:** `POST /api/v1/inputs` accepts JSON `{values: number[], format: 'comma'|'space'|'newline', display_name?: string}`, validates, proxies to sort-bot-api, mirrors metadata into `uploaded_inputs`, returns the canonical `InputSummary`.

**Files:**

- `server/src/routes/inputs.ts` (existing — extend with POST `/`)
- `server/src/store/uploaded-inputs.ts` (NEW)
- `server/tests/inputs-upload.test.ts` (NEW — validates 50k cap, integer-only, negatives ok, mirroring; sort-bot-api proxied with the right multipart body)

**Read first:** decisions row 5; `references/sort-bot-api-shapes.md` for upstream input format.

**Exit:** Authed users can upload an input via JSON. Stored upstream + mirrored in our DB. Validation tested thoroughly.

### Slice 7 — History endpoints (battles + tournaments lists)

**Goal:** `GET /api/v1/battles` and `GET /api/v1/tournaments` return real cursor pages from `recent_battles` and `recent_tournaments`.

**Files:**

- `server/src/routes/battles.ts` (extend GET / to query Turso)
- `server/src/routes/tournaments.ts` (same)
- `server/src/store/recent-battles.ts` (add `listRecent({limit, before, initiatorUserId?})`)
- `server/src/store/recent-tournaments.ts` (NEW — same shape)
- `server/tests/history-list.test.ts` (NEW)

**Read first:** `references/turso-migration-and-schema.md` for table shapes; `src/api/types.ts:149-162, 210-223, 50-53` for `Battle`, `Tournament`, `CursorPage`.

**Exit:** Lists return real data, paginated. Empty when no rows. Shape matches frontend types exactly (parse against types in tests).

### Slice 8 — `<MatchSetupModal />` (frontend, battles)

**Goal:** Modal triggered by "Setup a match" CTA on Arena page. Two-bot picker + input picker (preset / manual / upload tabs). Submits to `/api/v1/battles`, redirects to BattlePage.

**Files:**

- `src/components/match/MatchSetupModal.tsx` (NEW)
- `src/components/match/InputPickerTabs.tsx` (NEW — preset / manual / upload sub-components)
- `src/components/match/BotSlotPicker.tsx` (NEW — two slots, search-by-name)
- `src/components/match/MatchSetupModal.test.tsx` (NEW)
- `src/pages/ArenaIndexPage.tsx` (add CTA + Quick fight button)
- `src/api/queries.ts` (extend with `useStartBattle`, `useUploadInput`)

**Read first:** decisions rows 2,5,10; `references/battle-cooldown-and-rate-limit.md` (frontend handling section); `src/api/types.ts:50-53,149-162` for `CursorPage`, `Battle`.

**Exit:** Modal renders, validates, submits, handles 429. Quick fight wired. Existing arena tests pass.

### Slice 9 — `<TournamentSetupModal />` (frontend, tournaments)

**Goal:** Modal triggered by "Setup a tournament" CTA on Arena page. Bracket size dropdown + Random fill + manual `<BotTilePicker />` + input mode toggle + Cancel/Start buttons.

**Files:**

- `src/components/tournament/TournamentSetupModal.tsx` (NEW)
- `src/components/tournament/BotTilePicker.tsx` (NEW)
- `src/components/tournament/TournamentSetupModal.test.tsx` (NEW)
- `src/pages/ArenaIndexPage.tsx` (add tournament CTA next to match CTA)
- `src/api/queries.ts` (`useStartTournament`)

**Read first:** decisions rows 3,6; `references/bracket-math-and-tournament-flow.md`; `src/api/types.ts:200-223`.

**Exit:** Modal handles random + manual + cancel + start. Submits with chosen bracket_size + input_mode. Redirects to TournamentBracketPage.

### Slice 10 — Frontend weight-class chip + recent battles tab

**Goal:** Surface battle weight class on BattlePage (TitleFight / Exhibition / Sparring chip near the title) and on the Arena's recent-battles list.

**Files:**

- `src/components/battle/WeightClassChip.tsx` (NEW)
- `src/pages/BattlePage.tsx` (render chip)
- `src/pages/ArenaIndexPage.tsx` (recent battles section using `useBattles`)
- `src/components/battle/WeightClassChip.test.tsx` (NEW)

**Read first:** decisions row 1; slice 5 server changes.

**Exit:** Visual chip shows correct color/label per weight_class. Recent battles list renders from `useBattles`.

### Slice 11 — Tournament bracket reuse + setup polish

**Goal:** Wire the existing `<TournamentBracketPage />` to consume the new `useTournament` (already exists, server backed by slice 7). Add tournament card on the recent tournaments list.

**Files:**

- `src/pages/TournamentBracketPage.tsx` (verify shape match, polish UX for byes)
- `src/pages/ArenaIndexPage.tsx` or `src/pages/TournamentsListPage.tsx` (recent tournaments section)
- Component tests as needed

**Exit:** End-to-end: setup tournament → land on bracket page → bracket renders correctly with byes for 6/12.

### Slice 12 — Visual polish + UI tooltips

**Goal:** Tooltips on all new modal fields per Justin's spec. `<LoadingGear />` consistency on long-running flows. Empty states tightened.

**Files:**

- `src/components/ui/Tooltip.tsx` (extend if needed)
- Modals from 8 + 9 (add tooltip props)
- `src/pages/ArenaIndexPage.tsx` (empty-state polish)

**Exit:** Every input/select in the new modals has a tooltip. Quick-fight + setup-match + setup-tournament all visible on Arena page with clear visual hierarchy.

### Slice 13 — Close-out

**Goal:** Update CLAUDE.md, debt.md, deployment-landmines.md. Live smoke against deployed env. Merge PR.

**Files:**

- `CLAUDE.md` — phase 9 row in phase table
- `debt.md` — D-9 if any deferred items (e.g. real escalation pending sort-bot-api per-match input)
- `references/deployment-landmines.md` — Turso section
- `requests/phase-9-promoter-plan.md` — mark slices shipped at top

**Exit:** PR merged to main. Vercel rebuilds. Smoke test the deployed flows: signup → upload an input → setup a match → watch it → setup a tournament → bracket renders.

---

## Open risks / assumptions

1. **Tournament input escalation is mock-only** until sort-bot-api supports per-match inputs. Slice 9 modal copy must say so in the tooltip. If we want real escalation in this phase we'd need to drop sort-bot-api's tournament endpoint and orchestrate match-by-match via `POST /v1/battles` ourselves — that's another phase.
2. **Quick fight under cooldown.** If the random pair is rate-limited, the quick-fight button's redirect 429s. Acceptable: surface a toast + re-roll on the same click. Implementation lives in `useStartBattle`.
3. **Turso migration on first deploy.** Slice 0 redeploys against an empty Turso DB. All migrations run fresh including the legacy 0001-0005. Verify `schema_migrations` table comes back populated correctly.
4. **No Sentry DSN yet** — backfill failures and 429 spikes will only show in our `pino` logs, not Sentry. Set DSN any time post-merge.
5. **Persona regenerations across redeploys.** With Turso, personas survive redeploys. New bot submissions still get gens. Re-roll is intentionally absent.

## Tests target

After this phase ships:

- Server tests: 87 → ~120+ (each slice adds 3-8 cases)
- Frontend tests: 260 → ~290+ (modals, weight class chip, picker)
- All gated on contract validation against `src/api/types.ts`

---

When you've read this and want to argue with the slicing, drop notes in this doc or just say so in chat. Once approved I'll start with slice 1 (schema migrations) so slice 0 (Turso provisioning) can land in parallel without blocking.
