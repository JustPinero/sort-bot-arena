# API Reconciliation — `sort-bot-arena` ↔ `sort-bot-api`

**Branch:** `api-reconciliation` (frontend + new `server/` package).

## Why this exists

The frontend was built against MSW mocks I authored from the kickoff prompt's narrative (BattleBots × UFC vibe). Those mocks invented a *richer* bot/battle shape than `sort-bot-api` actually exposes. The deployed demo runs on those mocks; this plan reconciles the fiction with reality so the deployed app talks to a real backend.

**Critical correction (locked):** `sort-bot-api` is a **third-party service** we integrate with. We do not modify it. All gaps it can't fill are filled by **our own backend service** at `sort-bot-arena/server/`, deployed independently to Railway. The frontend talks to our service; our service talks to `sort-bot-api`.

## Authoritative reference docs

- [`sort-bot-api-overview.md`](../references/sort-bot-api-overview.md) — the third-party service, architecture summary
- [`sort-bot-api-endpoints.md`](../references/sort-bot-api-endpoints.md) — its routes with actual response shapes
- [`sort-bot-api-schema.md`](../references/sort-bot-api-schema.md) — its DB + the derivability matrix
- [`server-architecture.md`](../references/server-architecture.md) — **our** backend service's design
- [`api-contracts.md`](../references/api-contracts.md) — what our server exposes to the frontend (existing doc; will update once server ships)

Read those before the rest of this plan.

---

## Architecture decisions (locked)

1. **Our own backend service lives in `sort-bot-arena/server/`** (monorepo). Node + TypeScript + Hono, Turso for storage, deployed to Railway as a second service in the same project as `sort-bot-api`.
2. **Frontend's `VITE_API_BASE_URL`** points exclusively at our server's Railway URL. The browser never sees `sort-bot-api`.
3. **`sort-bot-api` is read-only to us.** No PRs, no migrations, no new endpoints. Operational config (how it's deployed) is fair game; source code is not.
4. **Persona data (nickname, portrait, trash talk) lives in our DB**, not theirs. Our server generates and caches via Leonardo + Anthropic.
5. **Synthesized fields** (record / KO% / recent_form / signature_input / achilles_heel / achievements) are computed in our server from real `sort-bot-api` data on each request, with caching where it matters.
6. **Battle event translation** is a stateless transformer in our server's SSE proxy. Backend's 4-event vocabulary → frontend's 8-event dramatized version.
7. **Tournament SSE** via 2s polling on our server (sort-bot-api has no tournament event stream).
8. **Always-on listener** subscribes to sort-bot-api's `/v1/events/stream` and populates our `recent_battles`, `recent_tournaments`, `event_log`. Lets us answer list/feed endpoints sort-bot-api doesn't have.
9. **Auth lives entirely on our side.** Users sign up on our server (email + display_name + password), we silently provision a `sk_live_*` key on sort-bot-api and stash it server-side, frontend gets a session token for our server only.
10. **Drop `go` from frontend language enum.** sort-bot-api supports `python | node | binary` only.
11. **Drop guest auto-provision.** Public routes stay open; `/submit` and `/me/fighters` gate behind `<SignUpDialog />`.
12. **Achievements catalog** (5 derived in our server from real stats): First Blood (1+ wins), KO King (10+ KOs — winner ≥80% of input runs), Giant Killer (beat top-3 ranked bot), Perfect Debut (won every input on first eval), Top 10 (best_rank ≤ 10).
13. **Stay on `sort-bot-arena.vercel.app`**. No custom domain.

---

## Implementation slices

### Slice 1 — capture sort-bot-api's actual response shapes

**Status:** ready to run; sort-bot-api is live at `https://sort-bot-api-production.up.railway.app`.

```sh
BASE=https://sort-bot-api-production.up.railway.app
echo "=== /healthz" && curl -s $BASE/healthz; echo
echo "=== /v1/inputs?limit=2" && curl -s "$BASE/v1/inputs?limit=2" | jq .
echo "=== /v1/leaderboard?limit=5" && curl -s "$BASE/v1/leaderboard?limit=5" | jq .
echo "=== /v1/stats" && curl -s "$BASE/v1/stats" | jq .

# create a user, submit a python bot, capture the bot's life cycle
curl -s -X POST "$BASE/v1/users" -H 'Content-Type: application/json' \
  -d '{"display_name":"recon","email":"recon@example.com"}' | tee /tmp/me.json
KEY=$(jq -r .api_key /tmp/me.json)
USER_ID=$(jq -r .user_id /tmp/me.json)
echo "=== /v1/users/me" && curl -s "$BASE/v1/users/me" -H "Authorization: Bearer $KEY" | jq .

# clone sort-bot-api locally to grab a known-good source file
SRC=../sort-bot-api/testdata/bots/python/correct.py
curl -s -X POST "$BASE/v1/bots" \
  -H "Authorization: Bearer $KEY" \
  -F "display_name=Recon Bot" \
  -F "language=python" \
  -F "source=@$SRC" | tee /tmp/bot.json
BOT_ID=$(jq -r .id /tmp/bot.json)

# wait for evaluation, then capture every shape the frontend will need
sleep 60
echo "=== /v1/bots/{id}" && curl -s "$BASE/v1/bots/$BOT_ID" | jq .
echo "=== /v1/bots/{id}/profile" && curl -s "$BASE/v1/bots/$BOT_ID/profile" | jq .
echo "=== /v1/bots/{id}/runs" && curl -s "$BASE/v1/bots/$BOT_ID/runs?limit=10" | jq .
echo "=== /v1/bots/{id}/rank-history" && curl -s "$BASE/v1/bots/$BOT_ID/rank-history" | jq .
echo "=== /v1/bots/{id}/analysis" && curl -s "$BASE/v1/bots/$BOT_ID/analysis" | jq .
```

Capture each response into `requests/sort-bot-api-shapes.md`. Two purposes:
1. Verify the OpenAPI spec matches reality (we already noted drift; this confirms or expands).
2. Give our server's synthesis layer concrete fixtures to build against.

### Slice 2 — scaffold our server (Hono + Turso + Hello World)

```
server/
├── package.json (Hono, libsql, drizzle, vitest, hono/testing, msw, bcrypt, jose)
├── tsconfig.json
├── src/
│   ├── index.ts (Hono app, /api/healthz returns "ok")
│   ├── env.ts (zod validation)
│   ├── db/client.ts (libsql)
│   └── lib/log.ts
├── tests/
└── Dockerfile
```

- **Smoke**: `pnpm --filter server dev`, `curl localhost:8080/api/healthz` → "ok".
- **Turso provisioning**: Turso CLI is fast — `turso db create sort-bot-arena-server`, capture connection URL + auth token. Skip if user already has a preferred storage choice.
- **Vitest** wired up; first test is a `GET /api/healthz` integration via `hono/testing`.

### Slice 3 — auth (sign up, session token, sort-bot-api key provisioning)

- `POST /api/v1/auth/signup` — accepts `{ email, display_name, password }`. zod-validated. bcrypt hashes the password. Calls `POST /v1/users` against sort-bot-api with `{ display_name, email }`, captures the returned `sk_live_*`, stashes in `users` row. Returns a session token.
- Session token: signed JWT (using `jose`) carrying `{ user_id, exp }`, set as `Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Strict`.
- Auth middleware in `auth/middleware.ts` reads the cookie, validates, attaches `c.var.user` to the Hono context.
- Tests: signup happy path, duplicate email → 409, missing fields → 400, sort-bot-api returning 5xx → bubble as 502.

### Slice 4 — sort-bot-api client

- `src/clients/sort-bot-api.ts` — typed wrapper around fetch.
- Methods mirror what we'll need: `getBot`, `getBotProfile`, `getBotRuns`, `getBotRankHistory`, `getBotAnalysis`, `getLeaderboard`, `getPerInputLeaderboard`, `getBattle`, `getBattleEvents` (returns an SSE EventSource-like stream), `getEventsStream`, `getStats`, `getInputs`, `postBot`, `patchBot`, `deleteBot`, `getHeadToHead`, `getTournament`.
- AbortController timeouts (15s default), structured `ApiError` with `status`, `code`, `body`, `request_id`.
- Tests: MSW fixtures for the upstream calls; assert pass-through and error mapping.

### Slice 5 — synthesis helpers (pure)

- `synthesize/record.ts`: `deriveRecord(battles: Battle[], botId): { wins, losses, draws }`, `deriveKoPercentage(battles, botId)`, `deriveRecentForm(battles, botId)`.
- `synthesize/bot.ts`: `synthesizeBot(realBot, profile, persona, ourBattles)` returns the rich frontend shape.
- `synthesize/leaderboard.ts`: per-row augmentation.
- `synthesize/battle-events.ts`: stateless `(backendEvent) => frontendEvent[]` translator.
- 100% unit tests, no I/O.

### Slice 6 — persona generators

- `persona/nickname.ts`: pure deterministic. 100-name pool, hash on `bot.id` modulo pool size.
- `persona/portrait.ts`: orchestrates Leonardo. Idempotent (skip if already in `bot_personas`). Failure non-fatal.
- `persona/trash-talk.ts`: orchestrates Anthropic. Same idempotence. Fallback to language-keyed canned strings if the API is down or the key is missing.
- `persona/achievements.ts`: catalog + per-bot evaluator + global rarity aggregator.

### Slice 7 — global SSE listener

- `listener/global-stream.ts`: connects to `${SORT_BOT_API_URL}/v1/events/stream`, parses event types, writes to `recent_battles` / `recent_tournaments` / `event_log` accordingly.
- Reconnect with exponential backoff on disconnect.
- Started by the Hono app at boot when `RUN_LISTENER=true`.
- Test: feed canned event lines, assert DB writes.

### Slice 8 — read endpoints (mostly proxy + augment)

- `routes/leaderboard.ts`: GET `/api/v1/leaderboard` — calls sort-bot-api, augments each row with persona/synthesized data.
- `routes/bots.ts`:
  - GET `/api/v1/bots/:id` — fans out to sort-bot-api `/bots/:id`, `/profile`, our `bot_personas`, our `recent_battles`. Returns rich shape.
  - GET `/api/v1/bots/:id/snapshots` — passthrough rename to `/rank-history`.
  - GET `/api/v1/bots/:id/inputs` — derived from `/profile`.
  - GET `/api/v1/bots/:id/analysis` — passthrough.
  - PATCH `/api/v1/bots/:id` — auth + ownership; passthrough.
  - DELETE `/api/v1/bots/:id` — auth + ownership; passthrough + insert into `retired_bots`.
- `routes/users.ts`:
  - GET `/api/v1/users/me/bots` — read from `user_bots` joined to fresh sort-bot-api lookups.
- `routes/halloffame.ts`: reads `retired_bots`.
- `routes/achievements.ts`: returns the static catalog with rarity computed from sort-bot-api stats.
- `routes/feed.ts`:
  - GET `/api/v1/feed/snapshot` — composes leaderboard top 3 + stats + recent event_log.
  - GET `/api/v1/feed` — recent event_log.
- `routes/stats.ts`: passthrough to `/v1/stats`.
- `routes/badge.ts`: passthrough proxy to `/v1/bots/:id/badge.svg`, sets `Cache-Control: public, max-age=300`.
- `routes/h2h.ts`: GET `/api/v1/bots/:a/vs/:b` — passthrough.

### Slice 9 — write endpoints (auth + sort-bot-api key proxy)

- POST `/api/v1/bots` — auth required. Calls sort-bot-api `POST /v1/bots` with the user's stashed key. Inserts into `user_bots`. Returns rich shape.
- POST `/api/v1/battles` — auth required. Passthrough.
- POST `/api/v1/tournaments` — auth required. Passthrough.
- POST `/api/v1/inputs` — auth required. Passthrough.
- POST `/api/v1/inputs/adversarial` — auth required. Passthrough.

### Slice 10 — SSE endpoints

- `routes/battles.ts` GET `/api/v1/battles/:id/events`: subscribes to sort-bot-api's `/v1/battles/:id/events`, runs through `synthesize/battle-events.ts`, forwards to client.
- `routes/bots.ts` GET `/api/v1/bots/:id/debut/events`: tails the global stream (already consumed by our listener) and emits eval-progress events filtered by `bot_id`. Implementation: a per-subscriber filter against an in-memory ring buffer that mirrors the listener's input.
- `routes/tournaments.ts` GET `/api/v1/tournaments/:id/events`: 2s polling loop comparing previous tournament state to current; emits derived events.

### Slice 11 — frontend changes

- `src/main.tsx`: drop `ensureGuestUser()` call from bootstrap.
- New `<SignUpDialog />` component (or `/signup` route). Two fields: display_name, email. Password is fine for v1.
- `<TopNav />` user-menu: shows "Sign up to submit" CTA when `useAuthStore.apiKey` is null. Profile menu otherwise.
- `<SubmitPage />`, `<MyFightersPage />`: gate behind sign-up dialog.
- `src/api/client.ts`: no changes (it already uses `VITE_API_BASE_URL` + `Authorization: Bearer`); we'll switch from API-key bearer to session-cookie auth, so `client.ts` needs to send `credentials: 'include'` and stop attaching `Authorization`.
- Remove `go` from `src/lib/weightClass.ts`, `src/components/submit/templates.ts`, fixtures.
- `useAuthStore`: replace `apiKey/userId/displayName` shape with `{ user, sessionLoaded }`. Auth state derived from a `/api/v1/users/me` round-trip on first load (cookie-based).

### Slice 12 — `.env.production` flip + deploy

- `VITE_API_BASE_URL=https://sort-bot-arena-server-production.up.railway.app`
- `VITE_USE_MOCKS=false`
- Push, Vercel rebuilds, full integration smoke on the deployed site.

### Slice 13 — close-out

- One PR on `sort-bot-arena` containing: server scaffold, sign-up flow, frontend env flip, MSW handler updates if any.
- Update `CLAUDE.md` phase table to reflect "API reconciliation" as a shipped milestone.
- Document deployment of our server in `references/deployment-landmines.md`.

---

## Tests

- **Unit (synthesis helpers, persona generators, battle-event translator)**: pure functions, table-driven tests against fixtures captured in Slice 1.
- **Integration (server routes)**: `hono/testing` mounts the app, MSW provides fake `sort-bot-api`. Each route has a happy-path + error-path test.
- **Existing component tests on the frontend**: should pass unchanged because the augmented shape is the same. Auth-related component tests need an update (sign-up dialog instead of auto-provision).
- **End-to-end (Playwright)**: hit `/`, `/leaderboard`, `/bots/<seed>`, `/arena/<seed>`, sign up, submit a bot, watch evaluation, screenshot. Closes out D-1 in `debt.md`.

---

## Risks

- **Cold starts on Railway** can be 1–2s for our server. Acceptable; Vercel-side caching softens it.
- **SSE connection limits**: Railway terminates idle connections. We add a 15s heartbeat in our SSE responses (matches sort-bot-api's pattern).
- **Turso quota**: free tier is 9GB and 1B rows; we'll be in the kilobyte territory. No risk.
- **sort-bot-api rate limits** apply to our server's calls; if we have many users, the `429` cascade hits. At demo scale (1–10 users) it's fine.
- **Listener crashes**: if the always-on listener dies, derived state stops updating. Mitigation: Railway auto-restart; Hono boot loop reconnects to `/v1/events/stream` with exponential backoff.

---

## All decisions confirmed

- ✅ Leonardo + Anthropic API keys provisioned and stored in our backend's environment.
- ✅ sort-bot-api deployed at `https://sort-bot-api-production.up.railway.app`. CORS configured for `https://sort-bot-arena.vercel.app`. Healthz green.
- ✅ Our server in `sort-bot-arena/server/` — Node + TypeScript + Hono, Turso storage, monorepo.
- ✅ Achievements catalog: 5 canned, derived from real stats.
- ✅ Drop guest auto-provision; require sign-up with email + password.
- ✅ Drop `go` language from frontend.
- ✅ Stay on `sort-bot-arena.vercel.app`.

Ready to start Slice 1 on a tight loop.
