# API Contracts — sort-arena-web

The frontend consumes [sort-bot-api](https://github.com/JustPinero/sort-bot-api). Types live in `src/api/types.ts`, generated from the backend's OpenAPI spec via:

```sh
pnpm generate:api-types
```

which runs `scripts/generate-api-types.sh`. By default it reads from `../sort-bot-api/references/openapi.yaml`; override with `BACKEND_REPO=/path/to/sort-bot-api` to point elsewhere.

This file mirrors the contract surface phase-by-phase so a reader can see what the frontend expects without leaving the repo. Update it whenever the backend ships a new endpoint we consume.

> Status: **stub seeded in Phase 1.** Each phase's "consumes" section gets filled in as the frontend reaches that phase.

---

## Phase 1 (foundation)

Endpoints actually consumed in Phase 1:

- `POST /v1/users` — auto-provision a guest user. Body: `{ display_name }`. Returns `{ id, display_name, api_key }`. Used once on first visit; key persisted in localStorage.
- `GET /healthz` — liveness probe. Used by `usePing()` to verify the wiring.

Phase 1 mocks both via MSW until the backend's auth phase ships. See `src/test/msw/handlers.ts`.

---

## Phase 2 (Tale of the Tape + profile)

Consumed via the typed `apiClient`, with hooks in `src/api/queries.ts`. Until backend Phase 7 ships these endpoints for real, MSW handlers in `src/test/msw/handlers.ts` cover the contract.

- `GET /v1/bots/:id` → `Bot` — full bot record incl. nickname, portrait_url, language, algorithm, rank, record, ko_percentage, signature_input, achilles_heel, recent_form, achievements, trash_talk, analysis_url, retired. Hook: `useBot(botId)`. Skips retry on 4xx.
- `GET /v1/bots/:id/runs?cursor=&limit=` → `CursorPage<BotRun>` — paginated fight history. Hook: `useBotRuns(botId, opts)`.
- `GET /v1/bots/:id/snapshots` → `BotSnapshot[]` — rank-over-time series. Hook: `useBotSnapshots(botId)`.
- `GET /v1/bots/:id/inputs` → `InputPerformance[]` — per-input rank-in-field. Hook: `useBotInputPerformance(botId)`.
- `GET /v1/bots/:id/analysis` → `AnalysisResponse` — AI scouting report. Returns 503 with `code: 'analysis_unavailable'` when `analysis_url` is null. Hook: `useBotAnalysis(botId, { enabled })` — opt-in so the page only fetches when the Scouting tab is active.

All five hooks use stable, resource-mirrored query keys (`['bots', botId]`, `['bots', botId, 'runs', cursor, limit]`, etc.) and 5-minute stale time.

---

## Phase 3 (leaderboard)

Consumed via three hooks. MSW handlers cover the contract.

- `GET /v1/leaderboard?weight=&activity=&sort=&language=&cursor=&limit=` → `CursorPage<LeaderboardEntry>` — paginated rankings. Server-side filtering by weight class (mapped from language), activity window, sort key. Hook: `useLeaderboard(filters)`.
- `GET /v1/leaderboard/inputs/:inputId` → `{ input: InputSummary, items: PerInputLeaderboardEntry[], next_cursor }` — per-input ranking. 404 for unknown input. Hook: `usePerInputLeaderboard(inputId)`, with 4xx-skip retry.
- `GET /v1/inputs` → `CursorPage<InputSummary>` — input list (Phase 5+ picker). Hook: `useInputs()`.

Filter state lives in the URL via `?weight=&activity=&sort=&language=`. Defaults (`all`/`rank`) are stripped on write so shareable links stay clean. The `useLeaderboardFilters()` hook owns parsing + write-back.

---

## Phase 4 (arena)

Consumed via two query hooks + one SSE hook. MSW handlers cover the contract; the real SSE backend ships in sort-bot-api Phase 5.

- `GET /v1/battles` → `CursorPage<Battle>` — index of current/recent/upcoming. Hook: `useBattles()`.
- `GET /v1/battles/:id` → `Battle` — battle detail. Hook: `useBattle(id)` (with 4xx-skip retry).
- `GET /v1/battles/:id/events` → **SSE** stream of `BattleEvent` (8-variant discriminated union: walkout, fight_start, round_start, round_progress, round_end, fighter_downed, commentary, fight_end). Hook: `useBattleEvents(id, opts)`. Every event runs through `battleEventSchema` (zod) before applying state; malformed events are dropped with a warn log.

Until backend ships SSE, frontend uses `playMockBattle()` (in `src/lib/playMockBattle.ts`) to drive a scripted bout in the BattlePage. Same event shape, no network round-trip.

`POST /v1/battles/:id/trash-talk` (server-cached AI taunt) deferred — `bot.trash_talk` from the bot record is read directly in the pre-fight stare-down for now.

---

## Phase 5 (submit + tournaments)

Will consume:

- `POST /v1/bots` — multipart upload of bot source. Returns 202 with `bot_id`; debut evaluation streams via SSE.
- `GET /v1/bots/:id/debut/events` — SSE stream of evaluation progress.
- `GET /v1/users/me/bots` — current user's bots for `/me/fighters`.
- `PATCH /v1/bots/:id` — display_name update, retire flag.
- `GET /v1/tournaments` — list.
- `GET /v1/tournaments/:id` — bracket.
- `GET /v1/tournaments/:id/events` — **SSE** for live round advancement.

---

## Phase 6 (homepage + polish)

Will consume:

- `GET /v1/feed` — broadcast ticker feed (rank changes, submissions, KOs, tournaments).
- `GET /v1/feed/events` — **SSE** for live broadcast feed.
- `GET /v1/halloffame` — retired bots.
- `GET /v1/achievements` — definitions + rarity stats.
- `GET /v1/bots/:id/badge.svg` — embeddable shield.

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
