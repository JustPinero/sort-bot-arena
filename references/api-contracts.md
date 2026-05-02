# API Contracts — sort-arena-web

The frontend consumes [sort-bot-api](https://github.com/JustPinero/sort-bot-api). Types live in `src/api/types.ts`, generated from the backend's OpenAPI spec via:

```sh
pnpm generate:api-types
```

which runs `scripts/generate-api-types.sh`. By default it reads from `../sort-bot-api/references/openapi.yaml`; override with `BACKEND_REPO=/path/to/sort-bot-api` to point elsewhere.

This file mirrors the contract surface phase-by-phase so a reader can see what the frontend expects without leaving the repo. Update it whenever the backend ships a new endpoint we consume.

> Status: **stub seeded in Phase 1.** Each phase's "consumes" section gets filled in as the frontend reaches that phase.

Each endpoint below is annotated:

- **[live]** — exists in sort-bot-api OpenAPI; frontend hits it for real when `VITE_USE_MOCKS=false`.
- **[mock-only]** — no backend counterpart yet; MSW serves a fixture in dev/test.
- **[deferred]** — backend will ship this; frontend currently scripts the equivalent locally.

---

## Phase 1 (foundation)

Endpoints actually consumed in Phase 1:

- `POST /v1/users` — auto-provision a guest user. Body: `{ display_name }`. Returns `{ id, display_name, api_key }`. Used once on first visit; key persisted in localStorage.
- `GET /healthz` — liveness probe. Used by `usePing()` to verify the wiring.

Phase 1 mocks both via MSW until the backend's auth phase ships. See `src/test/msw/handlers.ts`.

---

## Phase 2 (Tale of the Tape + profile)

Consumed via the typed `apiClient`, with hooks in `src/api/queries.ts`. Until backend Phase 7 ships these endpoints for real, MSW handlers in `src/test/msw/handlers.ts` cover the contract.

- **[live]** `GET /v1/bots/:id` → `Bot` — full bot record incl. nickname, portrait_url, language, algorithm, rank, record, ko_percentage, signature_input, achilles_heel, recent_form, achievements, trash_talk, analysis_url, retired. Hook: `useBot(botId)`. Skips retry on 4xx.
- **[live]** `GET /v1/bots/:id/runs?cursor=&limit=` → `CursorPage<BotRun>` — paginated fight history. Hook: `useBotRuns(botId, opts)`.
- **[live]** `GET /v1/bots/:id/rank-history` → `BotSnapshot[]` — rank-over-time series. Hook: `useBotSnapshots(botId)`. (Renamed from `/snapshots` to match backend OpenAPI.)
- **[mock-only]** `GET /v1/bots/:id/inputs` → `InputPerformance[]` — per-input rank-in-field. Hook: `useBotInputPerformance(botId)`. Backend exposes the same data via the composed `GET /v1/bots/{id}/profile` endpoint; frontend will reshape to consume `/profile` once a typed adapter lands.
- **[live]** `GET /v1/bots/:id/analysis` → `AnalysisResponse` — AI scouting report. Returns 503 with `code: 'analysis_unavailable'` when `analysis_url` is null. Hook: `useBotAnalysis(botId, { enabled })` — opt-in so the page only fetches when the Scouting tab is active.

All five hooks use stable, resource-mirrored query keys (`['bots', botId]`, `['bots', botId, 'runs', cursor, limit]`, etc.) and 5-minute stale time.

---

## Phase 3 (leaderboard)

Consumed via three hooks. MSW handlers cover the contract.

- **[live]** `GET /v1/leaderboard?weight=&activity=&sort=&language=&cursor=&limit=` → `CursorPage<LeaderboardEntry>` — paginated rankings. Server-side filtering by weight class (mapped from language), activity window, sort key. Hook: `useLeaderboard(filters)`.
- **[live]** `GET /v1/leaderboard/inputs/:inputId` → `{ input: InputSummary, items: PerInputLeaderboardEntry[], next_cursor }` — per-input ranking. 404 for unknown input. Hook: `usePerInputLeaderboard(inputId)`, with 4xx-skip retry.
- **[live]** `GET /v1/inputs` → `CursorPage<InputSummary>` — input list (Phase 5+ picker). Hook: `useInputs()`.

Filter state lives in the URL via `?weight=&activity=&sort=&language=`. Defaults (`all`/`rank`) are stripped on write so shareable links stay clean. The `useLeaderboardFilters()` hook owns parsing + write-back.

---

## Phase 4 (arena)

Consumed via two query hooks + one SSE hook. MSW handlers cover the contract; the real SSE backend ships in sort-bot-api Phase 5.

- **[live]** `GET /v1/battles` → `CursorPage<Battle>` — index of current/recent/upcoming. Hook: `useBattles()`.
- **[live]** `GET /v1/battles/:id` → `Battle` — battle detail. Hook: `useBattle(id)` (with 4xx-skip retry).
- **[live]** `GET /v1/battles/:id/events` → **SSE** stream of `BattleEvent` (8-variant discriminated union: walkout, fight_start, round_start, round_progress, round_end, fighter_downed, commentary, fight_end). Hook: `useBattleEvents(id, opts)`. Every event runs through `battleEventSchema` (zod) before applying state; malformed events are dropped with a warn log.

Until backend ships SSE, frontend uses `playMockBattle()` (in `src/lib/playMockBattle.ts`) to drive a scripted bout in the BattlePage. Same event shape, no network round-trip.

`POST /v1/battles/:id/trash-talk` (server-cached AI taunt) deferred — `bot.trash_talk` from the bot record is read directly in the pre-fight stare-down for now.

---

## Phase 5 (submit + tournaments)

Consumed via mutations + queries. MSW handlers cover the contract; backend Phase 5+ ships the wire-format-final endpoints.

- **[live]** `POST /v1/bots` → 202 `{ bot_id }` — bot submission. Frontend currently sends JSON `{ display_name, language, source, filename }`; backend accepts JSON. Hook: `useSubmitBot()` (mutation, invalidates leaderboard + my-bots on success).
- **[deferred]** `GET /v1/bots/:id/debut/events` → SSE — evaluation progress. Until backend ships per-bot debut events, frontend uses `playMockEvaluation()` (in `src/lib/playMockEvaluation.ts`) to script the sequence client-side. Backend's `GET /v1/events/stream` is the global event firehose; could be filtered by `bot_id` as a near-term substitute.
- **[mock-only]** `GET /v1/users/me/bots` → `Bot[]` — current user's bots. Hook: `useMyBots()`. Backend has `GET /v1/users/me` (identity only) but no per-user bot listing endpoint; frontend reshape pending.
- **[live]** `PATCH /v1/bots/:id` → `Bot` — display_name update + retire flag. Hook: `useRetireBot()` (mutation, sets `retired: true`).
- **[live]** `GET /v1/tournaments` → `CursorPage<Tournament>` — fight nights. Hook: `useTournaments()`.
- **[live]** `GET /v1/tournaments/:id` → `Tournament` — bracket detail. Hook: `useTournament(id)` (with 4xx-skip retry).
- **[deferred]** `GET /v1/tournaments/:id/events` (SSE) — live round advancement. Same pattern as debut events; backend's global `/v1/events/stream` covers the cross-tournament firehose today.

---

## Phase 6 (homepage + polish)

Consumed via three queries + one SVG fetch. MSW handlers cover the contract.

- **[mock-only]** `GET /v1/feed/snapshot` → `HomeSnapshot` — homepage payload (ticker, featured battle, rookie of the day, biggest upset, champion). Hook: `useHomeSnapshot()`. Composed view; backend has no equivalent. Backend's `GET /v1/stats` covers the platform-wide counters but not the curated featured items.
- **[mock-only]** `GET /v1/feed` → `CursorPage<FeedItem>` — paginated tail of recent events (used by `<EventsFeedPage />`; the homepage reads the same items from the snapshot's ticker for cache reuse). Backend's `GET /v1/events/stream` is the SSE firehose — a paginated REST tail would be a backend addition.
- **[mock-only]** `GET /v1/halloffame` → `Bot[]` — retired bots. Hook: `useHallOfFame()`. Could be served by `GET /v1/bots?retired=true` once the API supports filter params.
- **[mock-only]** `GET /v1/achievements` → `AchievementDefinition[]` — definitions with rarity stats. Hook: `useAchievementsCatalog()`. Backend models achievements as embedded fields on `Bot`; a definitions catalog endpoint is a backend addition.
- **[live]** `GET /v1/bots/:id/badge.svg` → SVG shield (image/svg+xml). Embedded directly via `<img src>` in `<BotBadge />`; the imageHost allow-list is checked before render.

The homepage uses `useHomeSnapshot()` against MSW for the curated demo experience. Switching to a real backend would require either composing client-side from `/v1/stats` + `/v1/leaderboard` + `/v1/battles`, or adding a `/v1/feed/snapshot` endpoint to the API.

---

## Error envelope

All errors follow:

```json
{
  "error": "human-readable message",
  "code": "machine_code",
  "request_id": "uuid",
  "fields": [{ "path": "display_name", "message": "must be ≥ 1 char" }]
}
```

`fields` only present for 400 validation errors. Frontend `ApiError` class surfaces all four members.

## Pagination

Cursor-based for high-cardinality lists (leaderboard, fight history): `?cursor=…&limit=…`, response `{ items, next_cursor }`. Page-based for small fixed sets (achievements, inputs): `?page=…&page_size=…`, response `{ items, total, page, page_size }`. Both shapes have typed helpers in `src/api/queries.ts`.
