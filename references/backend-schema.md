# Backend schema + derivability matrix

Every table in `sort-bot-api`'s SQLite schema, what's there, and **how the BFF derives the frontend's enriched fields from it**. Use this as the lookup when the frontend needs a field that the bot record doesn't expose directly.

The actual schema source-of-truth: `sort-bot-api/migrations/0001_init.sql`. This doc summarizes; consult that file for column types and constraints.

## Tables

### `users`
```sql
id           TEXT PRIMARY KEY    -- ulid (e.g. "01H8K...")
display_name TEXT NOT NULL
email        TEXT                -- nullable, not verified
key_hash     TEXT NOT NULL       -- SHA-256 hex of api_key
created_at   TEXT NOT NULL
deleted_at   TEXT                -- nullable
```

### `bots`
```sql
id                       TEXT PRIMARY KEY
user_id                  TEXT NOT NULL REFERENCES users(id)
display_name             TEXT NOT NULL
language                 TEXT NOT NULL CHECK (language IN ('python','node','binary'))
source_path              TEXT NOT NULL          -- server-generated, never user-controlled
source_size_bytes        INTEGER NOT NULL
source_sha256            TEXT NOT NULL
status                   TEXT NOT NULL CHECK (status IN ('pending','evaluating','evaluated','failed'))
submitted_at             TEXT NOT NULL
evaluation_completed_at  TEXT                   -- nullable
deleted_at               TEXT                   -- nullable
```

**Phase 7 additions (planned, not yet shipped):**
```sql
nickname                 TEXT                   -- nullable; deterministic name like "The Pivot"
portrait_url             TEXT                   -- nullable; cdn.leonardo.ai URL
portrait_generated_at    INTEGER                -- unix seconds
trash_talk               TEXT                   -- nullable; LLM-generated taunt
trash_talk_generated_at  INTEGER
```

### `inputs`
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
size_class  TEXT NOT NULL                    -- 'small' | 'medium' | 'large' | 'custom'
case_index  INTEGER                           -- 0..18 for built-ins; null for custom
array_json  TEXT NOT NULL                    -- JSON-encoded int array
array_len   INTEGER NOT NULL
is_custom   INTEGER NOT NULL DEFAULT 0
uploader_id TEXT REFERENCES users(id)        -- null for built-ins
created_at  TEXT NOT NULL
```

⚠️ Note: `inputs.id` is **integer**. The frontend uses string slugs (e.g., `in_killer_quicksort`). The BFF must map between them — see "BFF concerns" below.

### `runs`
One row per individual bot run on an input. Backend evaluates each (bot, input) pair `RunsPerInput` times (default 3) for a median.
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
bot_id        TEXT NOT NULL REFERENCES bots(id)
input_id      INTEGER NOT NULL REFERENCES inputs(id)
run_number    INTEGER NOT NULL                -- 1..N
status        TEXT NOT NULL                   -- 'success' | 'wrong_answer' | 'invalid_output' |
                                              --  'timeout' | 'cpu_exceeded' | 'oom' | 'crashed' |
                                              --  'output_too_large'
duration_ms   INTEGER                         -- wall-clock; null on non-success
cpu_ms        INTEGER                         -- cpu time; null on non-success
error_msg     TEXT                            -- diagnostic on failure
started_at    TEXT NOT NULL
completed_at  TEXT NOT NULL
```

### `leaderboard_snapshots`
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
bot_id      TEXT NOT NULL REFERENCES bots(id)
rank        INTEGER NOT NULL
score       REAL NOT NULL                    -- geometric mean of medians
snapshot_at TEXT NOT NULL
triggering_bot_id TEXT NOT NULL               -- the bot whose evaluation completion fired this snapshot
```
- One row per bot per snapshot event. A snapshot fires every time a bot finishes evaluating, capturing the entire ranked list at that moment.
- `/v1/bots/{id}/rank-history` orders by `snapshot_at` for the given bot.

### `bot_analyses`
```sql
bot_id                    TEXT PRIMARY KEY REFERENCES bots(id)
algorithm                 TEXT NOT NULL
time_complexity_estimate  TEXT NOT NULL
space_complexity_estimate TEXT NOT NULL
strengths_json            TEXT NOT NULL
weaknesses_json           TEXT NOT NULL
suggested_use_cases_json  TEXT NOT NULL
anti_patterns_json        TEXT NOT NULL
reasoning                 TEXT NOT NULL
model                     TEXT NOT NULL
generated_at              TEXT NOT NULL
```
- Cache for `/v1/bots/{id}/analysis`. One row per bot, populated on first viewer.

### `battles`
```sql
id            TEXT PRIMARY KEY
bot_a_id      TEXT NOT NULL REFERENCES bots(id)
bot_b_id      TEXT NOT NULL REFERENCES bots(id)
initiator_id  TEXT NOT NULL REFERENCES users(id)
status        TEXT NOT NULL                  -- 'pending' | 'running' | 'complete' | 'failed'
winner_bot_id TEXT REFERENCES bots(id)
bot_a_wins    INTEGER NOT NULL DEFAULT 0
bot_b_wins    INTEGER NOT NULL DEFAULT 0
ties          INTEGER NOT NULL DEFAULT 0
created_at    TEXT NOT NULL
completed_at  TEXT
```

### `battle_runs`
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
battle_id       TEXT NOT NULL REFERENCES battles(id)
input_id        INTEGER NOT NULL REFERENCES inputs(id)
bot_a_duration_ms INTEGER
bot_b_duration_ms INTEGER
bot_a_status   TEXT NOT NULL
bot_b_status   TEXT NOT NULL
winner_bot_id  TEXT REFERENCES bots(id)      -- null on tie
completed_at   TEXT NOT NULL
```

### `tournaments`
```sql
id            TEXT PRIMARY KEY
initiator_id  TEXT NOT NULL REFERENCES users(id)
status        TEXT NOT NULL                  -- 'pending' | 'running' | 'complete' | 'failed'
participant_count INTEGER NOT NULL
winner_bot_id TEXT REFERENCES bots(id)
created_at    TEXT NOT NULL
completed_at  TEXT
```

### `tournament_matches`
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
tournament_id   TEXT NOT NULL REFERENCES tournaments(id)
round           INTEGER NOT NULL
bracket_position INTEGER NOT NULL
bot_a_id        TEXT REFERENCES bots(id)     -- null = bye
bot_b_id        TEXT REFERENCES bots(id)
winner_bot_id   TEXT REFERENCES bots(id)
battle_id       TEXT REFERENCES battles(id)
completed_at    TEXT
UNIQUE(tournament_id, round, bracket_position)
```

### `adversarial_inputs`
```sql
id               INTEGER PRIMARY KEY AUTOINCREMENT
target_bot_id    TEXT NOT NULL REFERENCES bots(id)
size_class       TEXT NOT NULL
generation_seed  TEXT NOT NULL
input_id         INTEGER NOT NULL REFERENCES inputs(id)
model            TEXT NOT NULL
generated_at     TEXT NOT NULL
UNIQUE(target_bot_id, size_class, generation_seed)
```

---

## Derivability matrix

For every field the frontend's `Bot` type expects, this is where the BFF gets it. **Every "derive" entry** means the BFF computes that value from the listed source — no backend changes required.

| Frontend `Bot` field | Source | Backend endpoint / table |
|---|---|---|
| `id` | passthrough | `/v1/bots/{id}` |
| `display_name` | passthrough | same |
| `language` | passthrough | same |
| `algorithm` | passthrough (when present) | `/v1/bots/{id}/analysis` → `algorithm` |
| `nickname` | **from new column** | `bots.nickname` (Phase 7 addition) |
| `portrait_url` | **from new column** | `bots.portrait_url` (Phase 7 addition) |
| `trash_talk` | **from new column** | `bots.trash_talk` (Phase 7 addition) |
| `analysis_url` | derive | `/v1/bots/{id}/analysis` URL itself |
| `retired` | derive | `bots.deleted_at IS NOT NULL` |
| `rank` | derive | `/v1/leaderboard` → find row by `bot_id` (or `/v1/bots/{id}/profile` if it returns rank) |
| `record.wins` | derive | count(distinct battles) WHERE `winner_bot_id = X` |
| `record.losses` | derive | count(distinct battles) WHERE bot was a participant AND `winner_bot_id != X` AND status=`complete` |
| `record.draws` | derive | count(battles) WHERE `winner_bot_id IS NULL` AND status=`complete` AND bot was participant |
| `ko_percentage` | derive | of bot's wins, what fraction had `bot_X_wins / total_runs ≥ 0.8`? |
| `signature_input` | derive | best (lowest median) input — pull from `/v1/bots/{id}/profile` |
| `achilles_heel` | derive | worst input — same source |
| `recent_form` | derive | last 5 battles' outcomes ordered by `created_at DESC` |
| `achievements` | **synthesized** | BFF computes from real stats against curated catalog (no backend table) |

For `LeaderboardEntry`, the same patterns apply per-row. The BFF augments rows individually; the in-memory cache means rich rows for repeat callers don't re-fan-out.

---

## BFF concerns derived from the schema

### Input ID translation

Frontend uses string slugs, backend uses integer IDs. The BFF needs a slug→id map. Build it once at startup by calling `/v1/inputs` and constructing:

```ts
const slugFor = (input) =>
  input.is_custom
    ? `custom_${input.id}`
    : `in_${input.size_class}_${input.case_index}`;

const slugToId = Object.fromEntries(inputs.map(i => [slugFor(i), i.id]));
```

Cache for the BFF function lifetime (cold start invalidates, which is fine — built-in inputs don't change).

### Battles list

Backend has no `GET /v1/battles`. Two options:
1. **Backend addition**: a `GET /v1/battles` handler that lists recent battles ordered by `created_at DESC`. Cheap; ~10 lines.
2. **BFF self-tracks**: subscribe to global SSE, store recent battles in memory. Adds state to the BFF that doesn't survive restarts.

Recommended: option 1. Same patch as the persona columns.

### Tournaments list

Same problem. Same recommendation.

### Hall of Fame

The frontend's `useHallOfFame()` expects an array of retired bots. Backend exposes individual bots but no filtered-list endpoint. Add `GET /v1/halloffame` to backend (or `GET /v1/bots?retired=true`) that selects `bots WHERE deleted_at IS NOT NULL`. ~5 lines.

### Achievements

Frontend's `useAchievementsCatalog()` returns achievement definitions with rarity stats. Backend has no concept. The BFF returns a hardcoded catalog and computes rarity from real data:

```ts
const ACHIEVEMENTS = [
  { id: 'first_blood',   name: 'First Blood',   icon: 'sword',
    predicate: (stats) => stats.wins >= 1 },
  { id: 'ko_king',       name: 'KO King',       icon: 'crown',
    predicate: (stats) => stats.kos >= 10 },
  { id: 'giant_killer',  name: 'Giant Killer',  icon: 'mountain',
    predicate: (stats) => stats.beat_top3_count >= 1 },
  { id: 'perfect_debut', name: 'Perfect Debut', icon: 'star',
    predicate: (stats) => stats.first_eval_wins == stats.first_eval_runs },
  { id: 'top_10',        name: 'Top 10',        icon: 'award',
    predicate: (stats) => stats.best_rank <= 10 },
];
```

Rarity is `count(bots-where-predicate-holds) / count(all-bots)`.

The BFF derives a per-bot achievement list at `/api/v1/bots/{id}` time from real backend stats.

### Tournament events

No backend tournament SSE. Two options:
1. **Backend addition**: `GET /v1/tournaments/{id}/events` SSE that emits `match_start | match_complete | tournament_complete` when battle terminal events on member battles fire.
2. **BFF polling**: poll `/v1/tournaments/{id}` every 2s on subscription, diff state.

Option 1 is the right model long-term but option 2 is cheap and sufficient for the take-home. Defer the backend addition to a later phase.

### Battle event translation

Backend events:
- `battle_start` → emit frontend events `walkout(bot_a)`, `walkout(bot_b)`, `fight_start`
- `run_start` → `round_start`
- `run_complete` →
  - if `bot_X_status` is in `{timeout, cpu_exceeded, oom, crashed}` → `fighter_downed(bot_X, reason=mapped)`
  - then `round_end` regardless
- `battle_complete` → `fight_end`

The translator is a stateless function in the BFF SSE proxy.

---

## Phase 7 backend additions (consolidated)

Pulling together everything the BFF needs from the backend that requires actual code changes there:

```sql
-- migrations/0002_phase_7.sql
ALTER TABLE bots ADD COLUMN nickname TEXT;
ALTER TABLE bots ADD COLUMN portrait_url TEXT;
ALTER TABLE bots ADD COLUMN portrait_generated_at INTEGER;
ALTER TABLE bots ADD COLUMN trash_talk TEXT;
ALTER TABLE bots ADD COLUMN trash_talk_generated_at INTEGER;
CREATE INDEX idx_bots_deleted_at ON bots (deleted_at) WHERE deleted_at IS NOT NULL;
```

New endpoints:
- `GET /v1/users/me/bots` — list bearer's bots
- `GET /v1/battles` — list recent battles
- `GET /v1/tournaments` — list recent tournaments
- `GET /v1/halloffame` — bots WHERE deleted_at IS NOT NULL
- `POST /v1/bots/{id}/trash-talk` — LLM-generates and caches

New packages:
- `internal/leonardo/` — Leonardo client (mirrors `internal/ai/`)
- `internal/persona/` — nickname (deterministic) + trash-talk (LLM-cached) generators

Worker hook: at end of `EvaluateBot` after `SetBotStatus(evaluated)`:
- Compute and persist nickname (cheap, sync)
- Spawn goroutine for portrait generation (Leonardo)
- (Trash talk generation is lazy on first GET via the new endpoint, not eagerly post-eval)

Config: `LEONARDO_API_KEY` env var. Empty disables.

These additions consolidate the open Phase 7 plan with the BFF support requirements. See [api-reconciliation-plan.md](../requests/api-reconciliation-plan.md) for the full execution order.
