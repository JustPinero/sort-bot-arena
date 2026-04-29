# Our backend service — `sort-bot-arena/server/`

The independent backend service that the frontend talks to. **It is the only backend the browser ever sees.** Behind the scenes, it integrates with `sort-bot-api` (a third-party service we deploy on Railway alongside this one) for all sorting evaluation, leaderboard, and battle execution.

Companion docs:
- [`sort-bot-api-overview.md`](./sort-bot-api-overview.md) — the third-party service we consume
- [`sort-bot-api-endpoints.md`](./sort-bot-api-endpoints.md) — its routes
- [`sort-bot-api-schema.md`](./sort-bot-api-schema.md) — its DB + the derivability matrix
- [`api-contracts.md`](./api-contracts.md) — what *our* server exposes to the frontend

## Stack

| Layer | Tech | Why |
|---|---|---|
| HTTP framework | **Hono** (Node) | Fastest TS-native router, edge-compatible if we ever move; minimal magic; SSE built in |
| Language | TypeScript strict | Shares `src/api/types.ts` with the frontend; one type system across the wire |
| Database | **Turso** (libSQL/SQLite hosted) | Free tier 9GB; matches `sort-bot-api`'s SQLite mental model; single-config |
| Runtime | Node 20 | Matches what Vercel uses on the frontend; no surprises |
| Deployment | **Railway** (second service in the same project as `sort-bot-api`) | One dashboard, easy to debug both backends side-by-side |
| Public URL | `https://sort-bot-arena-server-production.up.railway.app` (planned) | Frontend's `VITE_API_BASE_URL` flips to this |
| Migrations | Manual SQL files in `server/migrations/`, applied at boot via `drizzle-kit` or a tiny home-grown runner | Keep it boring |

## Responsibilities

### 1. Auth (sign-up, session, token issuance)
- **Sign-up**: email + display_name + password (bcrypt hash). Optional: switch to magic links later.
- On signup, our server provisions a `sk_live_*` key against `sort-bot-api`'s `POST /v1/users`, stashes it in `users.sort_bot_api_key`, returns a session JWT (or session cookie) to the browser. The `sk_live_*` key never crosses the wire to the browser.
- **Login** (returning user): email + password → session token. *No login UI in the kickoff scope; if we add it, this is where it lives.*
- All subsequent requests carry the session token; our server uses the stashed `sk_live_*` to call `sort-bot-api`.

### 2. `sort-bot-api` client
- Thin wrapper around Hono's `fetch`. Handles bearer auth, retries on 5xx, AbortController timeouts, structured error mapping.
- Lives in `server/src/clients/sort-bot-api.ts`.

### 3. Persona generation
- **Nickname** (deterministic): hash on `bot.id` → pick from a curated 100-name pool (e.g. "The Pivot", "Silver Bullet"). No API call. Same bot → same name. Computed lazily on first read; cached in `bot_personas`.
- **Portrait** (Leonardo.ai): `server/src/clients/leonardo.ts` is a thin client over Leonardo's REST API. Generation kicks off after `sort-bot-api` emits `evaluation_completed` for a bot we own. Result URL stored in `bot_personas.portrait_url`. Failure is non-fatal — frontend's `<PortraitFallback />` covers null URLs.
- **Trash talk** (Anthropic): lazy on first read of a bot's profile. Our server calls Claude with a prompt derived from bot stats, caches the result in `bot_personas.trash_talk`. Same prompt → same output → same string forever. We carry our own `ANTHROPIC_API_KEY` (independent of `sort-bot-api`'s key for analysis).

### 4. Synthesis layer
- Computes the rich frontend `Bot` shape from `sort-bot-api` data:
  - Record (W/L/D) — query our `recent_battles` table or fetch on-demand via `/v1/bots/{a}/vs/{b}` for specific matchups
  - KO percentage — derived from `recent_battles.bot_a_wins/total`
  - Recent form — last 5 battles' outcomes from `recent_battles`
  - Signature input / Achilles heel — pulled from `sort-bot-api`'s `/v1/bots/{id}/profile` (it already returns these)
  - Achievements — computed against the static catalog using real stats

### 5. SSE listener (always-on worker)
- A long-running listener on `sort-bot-api`'s `/v1/events/stream` populates our derived state.
- Events handled:
  - `bot_submitted` — record in our `event_log`; if owned by a user we know about, link via `user_bots`
  - `evaluation_completed` — kick off Leonardo portrait generation for our users' bots
  - `rank_change` — append to `event_log`
  - `battle_complete` (re-published from per-battle topic) — insert into `recent_battles`
- Reconnects with exponential backoff on disconnect.
- Implementation: a separate Node process, OR a singleton goroutine-equivalent inside the same Hono app, leveraging Node's event loop. For simplicity we do the latter, gated by `RUN_LISTENER=true` env var so we can run multiple Railway replicas without duplicating event consumption.

### 6. Frontend-facing routes
- Mirror `sort-bot-api`'s public surface where it suffices, augment where the frontend's shape demands more, and synthesize where `sort-bot-api` has no answer. See [`api-contracts.md`](./api-contracts.md) for the route catalog (will be updated once the server ships).

### 7. Battle SSE event translation
- For every active battle, we open a per-bot SSE proxy at `GET /api/v1/battles/{id}/events`.
- Internally we subscribe to `sort-bot-api`'s `/v1/battles/{id}/events`, translate each `battle_start | run_start | run_complete | battle_complete` into the dramatized 8-event vocabulary the frontend expects (`walkout`, `fight_start`, `round_start`, `round_progress`, `round_end`, `fighter_downed`, `commentary`, `fight_end`), and forward.
- Stateless transformation; one client connection per active battle subscription.

### 8. Tournament event polling
- `sort-bot-api` has no tournament SSE. Our server's `GET /api/v1/tournaments/{id}/events` polls `/v1/tournaments/{id}` every 2s, diffs state, emits derived events to the subscriber. Cheap; closes when no subscribers.

## File layout

```
server/
├── src/
│   ├── index.ts                     # Hono app + route registration
│   ├── env.ts                       # zod-validated env loader
│   ├── clients/
│   │   ├── sort-bot-api.ts          # third-party API client
│   │   ├── leonardo.ts              # Leonardo.ai REST client
│   │   └── anthropic.ts             # Anthropic Messages API client
│   ├── auth/
│   │   ├── signup.ts                # POST /api/v1/auth/signup
│   │   ├── session.ts               # cookie / JWT helpers
│   │   └── middleware.ts            # bearer validation
│   ├── routes/
│   │   ├── bots.ts                  # GET/PATCH/DELETE /api/v1/bots/:id, sub-routes
│   │   ├── leaderboard.ts           # GET /api/v1/leaderboard, /:input_id
│   │   ├── battles.ts               # GET list + detail + SSE proxy
│   │   ├── tournaments.ts           # GET list + detail + SSE polling
│   │   ├── feed.ts                  # /api/v1/feed/snapshot + /api/v1/feed
│   │   ├── halloffame.ts
│   │   ├── achievements.ts
│   │   ├── stats.ts                 # passthrough to /v1/stats
│   │   └── badge.ts                 # passthrough to /v1/bots/:id/badge.svg
│   ├── persona/
│   │   ├── nickname.ts              # deterministic; pure
│   │   ├── portrait.ts              # Leonardo orchestration
│   │   ├── trash-talk.ts            # Anthropic orchestration
│   │   └── achievements.ts          # catalog + predicate evaluators
│   ├── synthesize/
│   │   ├── bot.ts                   # rich Bot shape from sort-bot-api
│   │   ├── leaderboard.ts           # rich row shape
│   │   ├── record.ts                # W/L/D / KO% / recent_form derivation
│   │   └── battle-events.ts         # 4 → 8 event vocabulary translator
│   ├── listener/
│   │   └── global-stream.ts         # always-on /v1/events/stream subscriber
│   ├── db/
│   │   ├── client.ts                # libsql client
│   │   ├── schema.ts                # type-safe table definitions
│   │   └── migrations/              # 0001_init.sql, etc.
│   └── lib/
│       ├── http.ts                  # fetch wrapper
│       ├── log.ts                   # structured logger
│       └── errors.ts
├── tests/
│   └── ...                          # Vitest, MSW for sort-bot-api fixtures
├── package.json
├── tsconfig.json
└── drizzle.config.ts                # if we go drizzle; else home-rolled
```

## Database (Turso)

```sql
-- 0001_init.sql

CREATE TABLE users (
    id              TEXT PRIMARY KEY,           -- our ulid
    email           TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    password_hash   TEXT NOT NULL,              -- bcrypt
    sort_bot_api_user_id  TEXT NOT NULL,        -- the user_id that sort-bot-api issued
    sort_bot_api_key      TEXT NOT NULL,        -- the sk_live_* token (encrypted at rest if we add KMS later)
    created_at      INTEGER NOT NULL            -- unix seconds
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,             -- random opaque token
    user_id       TEXT NOT NULL REFERENCES users(id),
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL
);

CREATE TABLE user_bots (
    user_id       TEXT NOT NULL REFERENCES users(id),
    bot_id        TEXT NOT NULL,                -- sort-bot-api bot id (no FK; theirs)
    PRIMARY KEY (user_id, bot_id)
);

CREATE TABLE bot_personas (
    bot_id                  TEXT PRIMARY KEY,   -- sort-bot-api bot id
    nickname                TEXT NOT NULL,
    portrait_url            TEXT,
    portrait_generated_at   INTEGER,
    trash_talk              TEXT,
    trash_talk_generated_at INTEGER
);

CREATE TABLE retired_bots (
    bot_id        TEXT PRIMARY KEY,
    retired_at    INTEGER NOT NULL,
    user_id       TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE recent_battles (
    id            TEXT PRIMARY KEY,             -- sort-bot-api battle id
    bot_a_id      TEXT NOT NULL,
    bot_b_id      TEXT NOT NULL,
    winner_bot_id TEXT,
    bot_a_wins    INTEGER,
    bot_b_wins    INTEGER,
    ties          INTEGER,
    completed_at  INTEGER NOT NULL
);
CREATE INDEX idx_recent_battles_bot_a ON recent_battles(bot_a_id);
CREATE INDEX idx_recent_battles_bot_b ON recent_battles(bot_b_id);
CREATE INDEX idx_recent_battles_completed ON recent_battles(completed_at);

CREATE TABLE recent_tournaments (
    id              TEXT PRIMARY KEY,
    status          TEXT NOT NULL,              -- 'pending' | 'running' | 'complete' | 'failed'
    winner_bot_id   TEXT,
    completed_at    INTEGER,
    created_at      INTEGER NOT NULL
);

CREATE TABLE event_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    kind          TEXT NOT NULL,                -- 'rank_change' | 'submission' | 'ko' | 'tournament' | 'achievement'
    payload_json  TEXT NOT NULL,
    bot_id        TEXT,
    href          TEXT,
    occurred_at   INTEGER NOT NULL
);
CREATE INDEX idx_event_log_occurred ON event_log(occurred_at DESC);
```

## Environment variables

```
# our server
PORT=8080
DATABASE_URL=libsql://...   # Turso connection string
DATABASE_AUTH_TOKEN=...     # Turso auth token
SESSION_SECRET=...          # for signing session cookies
LEONARDO_API_KEY=...        # our key (independent of sort-bot-api's)
ANTHROPIC_API_KEY=...       # our key for trash-talk generation
SORT_BOT_API_URL=https://sort-bot-api-production.up.railway.app
RUN_LISTENER=true           # gate for the SSE worker (one replica should set this)
LOG_LEVEL=info
ALLOWED_ORIGINS=https://sort-bot-arena.vercel.app,http://localhost:5173
```

## Frontend integration

The frontend's existing `src/api/client.ts` already supports a configurable `apiBaseUrl`. Flip:

```env
# .env.production
VITE_API_BASE_URL=https://sort-bot-arena-server-production.up.railway.app
VITE_USE_MOCKS=false
```

Dev mode keeps `VITE_USE_MOCKS=true` as a fallback when our server is offline (MSW handlers are still live in tests).

The frontend's MSW handlers stay valid — they were written against the augmented (our-server) shape, so what our server returns matches what tests expect.

## What we're NOT building

- Email verification / magic-link recovery (sort-bot-api doesn't expose a way to update user email; punt).
- Password reset flow (out of scope for v1).
- Multi-tenant API key rotation (one key per user, never rotated).
- An admin / dashboard surface for our own users.
- Webhooks for sort-bot-api back to us (we use SSE).
- Rate limiting on our server (sort-bot-api already rate-limits; no double layer for v1).
