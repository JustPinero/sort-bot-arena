# Turso migration + phase 9 schema additions

Phase 7-8 ran on an ephemeral SQLite file at `/tmp/sortbot-arena.db` inside the Railway container — wiped on every redeploy. Phase 9 swaps to a persistent libSQL/Turso DB so battles, tournaments, custom inputs, and personas survive across deploys.

## Provisioning (slice 0)

Turso CLI is at `~/.turso/turso` — already authed as `justpinero`. Existing `sortbot` DB belongs to another project; we provision a fresh one for our app:

```sh
~/.turso/turso db create sort-bot-arena-server --group default
~/.turso/turso db show sort-bot-arena-server --url       # → libsql://sort-bot-arena-server-justpinero.<region>.turso.io
~/.turso/turso db tokens create sort-bot-arena-server    # → eyJ… (long-lived; rotate quarterly)
```

Set Railway env on `sort-bot-arena-server` service:

- `DATABASE_URL=libsql://sort-bot-arena-server-justpinero.<region>.turso.io`
- `DATABASE_AUTH_TOKEN=<token from above>`

After redeploy, all 5 existing migrations run idempotently against the empty Turso DB (we already track applied migrations in `schema_migrations`, so re-applies are no-ops on subsequent deploys). New phase 9 migrations append.

**Local dev unchanged.** `server/.env.example` keeps `DATABASE_URL=file:./local.db` for the dev-stack script. The libsql client treats `file:` and `libsql:` URLs interchangeably; only Railway prod points at Turso.

## Free-tier headroom

Free tier is 9 GB storage / 1 B row reads / 25 M row writes per month. At demo scale (low hundreds of bots, low thousands of battles) we're 3-4 orders of magnitude under everything. No throttling concerns.

## Phase 9 schema additions (4 new migrations)

### `0006_bot_personas_style`

Records which random style we used so we can analyze + later filter.

```sql
ALTER TABLE bot_personas ADD COLUMN style TEXT;
```

Nullable: legacy rows from before phase 9 keep `style IS NULL`. New rows get one of 8 strings (see `leonardo-style-prompts.md`).

### `0007_recent_battles`

Backs the same-pair battle cooldown rule (slice 4) **and** the global recent-battles list endpoint (slice 8). One row per battle.

```sql
CREATE TABLE IF NOT EXISTS recent_battles (
  battle_id            TEXT    PRIMARY KEY,
  bot_a_id             TEXT    NOT NULL,
  bot_b_id             TEXT    NOT NULL,
  pair_key             TEXT    NOT NULL,    -- min(a,b) || ':' || max(a,b) — order-independent
  initiator_user_id    TEXT,
  weight_class         TEXT,                -- 'sparring' | 'exhibition' | 'title_fight' | NULL during run
  status               TEXT    NOT NULL,    -- 'pending' | 'running' | 'complete' | 'failed'
  winner_bot_id        TEXT,
  created_at           TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  completed_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_recent_battles_pair_created
  ON recent_battles (pair_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_battles_created
  ON recent_battles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_battles_initiator
  ON recent_battles (initiator_user_id, created_at DESC);
```

`pair_key` lets us answer "any battle for this pair in the last hour?" without an `OR` query.

### `0008_recent_tournaments`

Mirrors recent_battles for tournaments — backs `/api/v1/tournaments` list endpoint.

```sql
CREATE TABLE IF NOT EXISTS recent_tournaments (
  tournament_id        TEXT    PRIMARY KEY,
  initiator_user_id    TEXT,
  participant_count    INTEGER NOT NULL,
  bracket_size         INTEGER NOT NULL,    -- requested size: 4 | 6 | 8 | 12
  input_mode           TEXT    NOT NULL,    -- 'flat_random' | 'escalation'
  status               TEXT    NOT NULL,    -- 'pending' | 'running' | 'complete' | 'failed'
  winner_bot_id        TEXT,
  created_at           TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  completed_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_recent_tournaments_created
  ON recent_tournaments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_tournaments_initiator
  ON recent_tournaments (initiator_user_id, created_at DESC);
```

### `0009_uploaded_inputs`

Locally records inputs uploaded via our server (sort-bot-api stores the actual array; we store the metadata + uploader_id for the global picker UI). Future: could become source of truth, but for now we mirror.

```sql
CREATE TABLE IF NOT EXISTS uploaded_inputs (
  sort_bot_api_input_id INTEGER PRIMARY KEY,
  uploader_user_id      TEXT    NOT NULL,
  display_name          TEXT,                  -- user-supplied name, optional
  size_class            TEXT    NOT NULL,      -- mirrored from upstream
  array_len             INTEGER NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_uploaded_inputs_uploader
  ON uploaded_inputs (uploader_user_id, created_at DESC);
```

## Migration runner — already correct

`server/src/db/migrate.ts` already uses `schema_migrations` tracking (added in phase 8). It runs each unseen migration in order. The 4 new ones append to the array in `server/src/db/schema.ts`.

## Cleanup hooks

- Listener (deferred — debt.md D-8) updates `recent_battles.status` and `completed_at` from sort-bot-api SSE. Until the listener ships, status updates happen lazily when our server proxies a battle GET (no listener, but acceptable for cooldown enforcement — see `battle-cooldown-and-rate-limit.md`).
- `pruneExpired` in `upstream-cache.ts` already prunes the upstream cache table on a 6-hour interval. Same pattern for `recent_battles` if we ever want a TTL — for now, keep them all and use them to populate the history page.

## Local migration verification

```sh
# In repo root, with server running locally against Turso (or file:):
pnpm --filter @sort-bot-arena/server dev
# In another terminal:
~/.turso/turso db shell sort-bot-arena-server "SELECT id, applied_at FROM schema_migrations ORDER BY applied_at;"
# Expect rows for 0001-0009 after a clean boot.
```
