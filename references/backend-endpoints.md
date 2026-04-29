# Backend endpoints — sort-bot-api ground truth

Every route the running service exposes, with the actual response shape from the code (not the OpenAPI spec when they disagree). The frontend's BFF (`api/v1/...` Vercel functions) sits on top of these and either proxies or augments per the [reconciliation plan](../requests/api-reconciliation-plan.md).

Companion: [`backend-overview.md`](./backend-overview.md) for the architecture summary.

## Conventions

- All paths are under `http(s)://<host>:8080`.
- All responses are `application/json` unless noted.
- Auth: **public** (no header), **bearer** (Authorization: `Bearer sk_live_...`), or **owner** (bearer + the bot belongs to the caller).
- Anonymous bot submission attributes to the built-in `system` user, so `POST /v1/bots` works without auth.

---

## Health & introspection

### `GET /healthz`
- Auth: public
- Response: `text/plain "ok"` (200)
- Used by Docker / Railway / Fly liveness checks.

### `GET /readyz`
- Auth: public
- Response: `{ "db": "ok" }` (200) or `{ "error": "..." }` (503)

### `GET /openapi.json`
- Auth: public
- Response: the embedded OpenAPI 3.0.3 spec.

---

## Inputs

### `GET /v1/inputs`
- Auth: public
- Query params:
  - `size` (string): `small | medium | large | custom`
  - `limit` (int, 1..500, default 100)
  - `offset` (int, default 0; clamped to 1_000_000)
- Response (200):
  ```json
  { "inputs": [
      { "id": 1, "size_class": "small", "case_index": 0, "array_len": 50,
        "is_custom": false, "uploader_id": null, "created_at": "2026-04-29T..." }
    ],
    "total": 57 }
  ```

### `POST /v1/inputs`
- Auth: bearer
- Body (JSON): `{ "array": [int], "size_class": "small" | "medium" | "large" }`
- Response (201): `{ "input_id": int, ... }`
- Caps: small ≤ 200, medium ≤ 2000, large ≤ 20_000.

### `POST /v1/inputs/adversarial`
- Auth: bearer
- Body: `{ "target_bot_id": string, "size": "small" | "medium" | "large", "generation_seed": string? }`
- Response (201): `{ "input_id": int, "array": [int], "model": "claude-opus-4-7", "generated_at": ISO, "cached": bool }`
- Status codes: 401, 404 (target not found), 412 (target not evaluated), 429 (rate-limited; `Retry-After` header), 503 (no `ANTHROPIC_API_KEY`).
- Cached by `(target_bot_id, size, seed)` tuple — cache hits don't call the LLM or count against the rate limiter.

---

## Users

### `POST /v1/users`
- Auth: public
- Body: `{ "display_name": string (1..80), "email": string? }`
- Response (201): `{ "user_id": string, "display_name": string, "api_key": "sk_live_<64hex>" }`
- ⚠️ The `api_key` is shown **once**. Server stores SHA-256 hash only.

### `GET /v1/users/me`
- Auth: bearer
- Response (200): `{ "id": string, "display_name": string, "created_at": ISO }`
- 401 on missing or invalid bearer.

There is **no** `GET /v1/users/me/bots`. The BFF synthesizes that by calling `/v1/users/me`, then querying bots filtered by user_id (which would need a filter param on the bots-list endpoint that doesn't exist either) — easier path: the BFF maintains its own user→bots mapping via `bot_submitted` SSE events, OR backend adds `GET /v1/users/me/bots` (1-handler addition).

---

## Bots

### `POST /v1/bots`
- Auth: bearer (or anonymous → `system` user)
- Body: **multipart/form-data** with fields:
  - `display_name` (string)
  - `language` (string: `python | node | binary`)
  - `source` (file)
- Response (202): `botResponse` (see GET /v1/bots/{id})
- Status codes: 400 (validation: missing field, unsupported language, static analysis rejection, source too large), 401, 429.
- Behavior: static analyzer runs (5s timeout); bot inserted with `status=pending`; async worker enqueued via `queue.Pool` if wired.

### `GET /v1/bots/{id}`
- Auth: public
- Response (200) — the canonical `botResponse` shape:
  ```json
  { "id": "bot_xxx",
    "user_id": "usr_xxx",
    "display_name": "The Algorithm",
    "language": "python",
    "source_size_bytes": 1247,
    "source_sha256": "abc123...",
    "status": "evaluated",
    "submitted_at": "2026-04-29T18:00:00Z",
    "evaluation_completed_at": "2026-04-29T18:00:30Z" }
  ```
- 404 if not found or soft-deleted.
- ⚠️ `status` can be `pending | evaluating | evaluated | failed`. Spec only documents 3.

### `PATCH /v1/bots/{id}`
- Auth: owner
- Body: `{ "display_name": string (1..120) }` — only mutable field.
- Response (200): updated `botResponse`.
- 400 (no changes / empty / too long), 401, 403, 404.

### `DELETE /v1/bots/{id}`
- Auth: owner
- Response: 204 (soft-delete; `deleted_at` set).
- 401, 403, 404.

### `POST /v1/bots/{id}/replay`
- Auth: owner
- Response (202): `{ "bot_id": string, "status": "pending", "replay": true }`
- 409 if bot is already `pending` or `evaluating`.
- Re-enqueues for full evaluation.

### `GET /v1/bots/{id}/runs`
- Auth: public
- Query: `input_id?`, `status?`, `limit?` (default 100), `offset?`
- Response (200): array of:
  ```json
  { "id": int, "bot_id": string, "input_id": int, "run_number": int,
    "status": "success" | "wrong_answer" | "invalid_output" | "timeout" |
              "cpu_exceeded" | "oom" | "crashed" | "output_too_large",
    "duration_ms": int?, "cpu_ms": int?, "error_msg": string?,
    "started_at": ISO, "completed_at": ISO }
  ```
- 404 if bot not found.

### `GET /v1/bots/{id}/profile`
- Auth: public
- Response (200): composed profile — score, rank, best/worst inputs, per-input timings (good for the frontend's heatmap + signature_input/achilles_heel derivation).
- 404 if not found.
- **Use this** as the primary upstream for the BotProfilePage, instead of fanning out to multiple endpoints.

### `GET /v1/bots/{id}/rank-history`
- Auth: public
- Query: `limit?` (default 200)
- Response: array of `{ rank, score, snapshot_at, triggering_bot_id }` ordered by time.
- ⚠️ Frontend calls this `/snapshots`. The BFF maps the path.

### `GET /v1/bots/{id}/analysis`
- Auth: public (rate-limited per-user/IP)
- Response (200): cached LLM analysis:
  ```json
  { "algorithm": "introsort",
    "time_complexity_estimate": "O(n log n)",
    "space_complexity_estimate": "O(log n)",
    "strengths": [...], "weaknesses": [...],
    "suggested_use_cases": [...], "anti_patterns": [...],
    "reasoning": "...",
    "model": "claude-opus-4-7",
    "generated_at": ISO,
    "cached": bool }
  ```
- 404 (not found), 412 (not yet evaluated), 429, 503 (no API key).
- Cached forever per bot.

### `GET /v1/bots/{a}/vs/{b}`
- Auth: public
- Response (200): head-to-head record:
  ```json
  { "bot_a": "bot_xxx", "bot_b": "bot_yyy",
    "a_wins": 12, "b_wins": 7, "ties": 2,
    "per_input": [{...}] }
  ```
- 400 (same bot), 404.
- Frontend's `<HeadToHeadPage />` uses this directly.

### `GET /v1/bots/{id}/badge.svg`
- Auth: public
- Response (200): `image/svg+xml`, cached `public, max-age=300`.
- 404.
- Frontend's `<BotBadge />` already targets this path.

---

## Leaderboard

### `GET /v1/leaderboard`
- Auth: public
- Query: `language?`, `size?`, `limit?` (default 50, max 500), `offset?`
- Response (200):
  ```json
  { "filter": { "language": "python", "size_class": "medium" },
    "total_inputs": 19,
    "bots": [ LeaderboardRow ] }
  ```
- `LeaderboardRow`:
  ```json
  { "bot_id": string, "display_name": string, "language": string,
    "score": float (geomean of medians, ms),
    "rank": int, "inputs_covered": int, "total_inputs": int,
    "incomplete": bool }
  ```

### `GET /v1/leaderboard/inputs/{input_id}`
- Auth: public
- Path param: integer (not string).
- Response (200): leaderboard ranked by median duration on that single input.
- 404.

⚠️ Frontend's `usePerInputLeaderboard` passes a string (e.g. `in_killer_quicksort`). The BFF must convert the string slug to the backend's integer ID — needs a slug→id map, which the BFF can build by calling `/v1/inputs` once and caching.

---

## Battles

### `POST /v1/battles`
- Auth: bearer
- Body: `{ "bot_a": string, "bot_b": string, "input_ids": [int]?, "count": int (1..50)? }`
- Response (202): `{ "battle_id": string, "bot_a": string, "bot_b": string, "input_ids": [int], "status": "pending", "created_at": ISO }`
- 400, 401, 404 (bot not found).
- Either `input_ids` or `count` must be set; `count` samples from built-ins.
- Returns 202 before the battle finishes; subscribe to `/v1/battles/{id}/events` for progress.

### `GET /v1/battles/{id}`
- Auth: public
- Response: `{ "battle": Battle, "runs": [BattleRun] }`
- `Battle`: `{ id, bot_a_id, bot_b_id, status, winner_bot_id?, bot_a_wins, bot_b_wins, ties, created_at, completed_at? }`
- `BattleRun`: `{ id, battle_id, input_id, bot_a_duration_ms?, bot_b_duration_ms?, bot_a_status, bot_b_status, winner_bot_id?, completed_at }`
- 404.
- ⚠️ Backend has **no `GET /v1/battles` list endpoint**. The BFF needs to either: (a) maintain its own list by listening to `bot_submitted`-equivalent events, (b) ask the backend team to add a list endpoint, or (c) drop the arena index page.

### `GET /v1/battles/{id}/events` (SSE)
- Auth: public
- Stream: `event: battle_start | run_start | run_complete | battle_complete`, `data: {...}` per the SSE event vocabulary in `backend-overview.md`.
- 15s heartbeat.

---

## Tournaments

### `POST /v1/tournaments`
- Auth: bearer
- Body: `{ "bot_ids": [string] }` (or `{ "top_n": int }` per spec — verify)
- Response (202).
- 400, 401, 404 (some bot not found).
- Bracket built synchronously, byes pre-resolved.
- ⚠️ **Battles are NOT auto-run** — caller schedules them via `/v1/battles` and inspects progress via `/v1/tournaments/{id}`. The frontend assumes auto-run.

### `GET /v1/tournaments/{id}`
- Auth: public
- Response: tournament metadata + `tournament_matches` array.
- 404.
- ⚠️ Backend has **no `/v1/tournaments/{id}/events` SSE**. The BFF either polls every 2s, OR filters the global stream by tournament-related bot IDs (less reliable).

There is **no `GET /v1/tournaments` list endpoint** either. Same gap as battles.

---

## Global feed & stats

### `GET /v1/events/stream` (SSE)
- Auth: public
- Topic: `global`
- Events:
  - `bot_submitted` — `{ bot_id, user_id, display_name, language }`
  - `evaluation_completed` — `{ bot_id, status, duration_ms? }`
  - `rank_change` — `{ bot_id, old_rank, new_rank, score }`
  - Battle terminal events (re-published from `battle:{id}`).
- 15s heartbeat.
- The BFF transforms these into the frontend's homepage ticker shape.

### `GET /v1/stats`
- Auth: public
- Response (200): `{ total_bots, total_runs, fastest_run_ms, language_distribution }` (exact field set from the code; verify against actual response).
- The frontend's homepage payload (`/api/v1/feed/snapshot`) composes this with leaderboard top-3 and recent feed events.

---

## Endpoints frontend wants that don't exist

The BFF synthesizes these. See [the reconciliation plan](../requests/api-reconciliation-plan.md) for the strategy per route.

| Frontend path | Backend reality | BFF strategy |
|---|---|---|
| `GET /v1/bots/{id}/snapshots` | rename of `/rank-history` | trivial proxy with path rewrite |
| `GET /v1/bots/{id}/inputs` (per-input perf) | `/v1/bots/{id}/profile` (composed) or `/runs` aggregated | use `/profile` |
| `GET /v1/users/me/bots` | none | call `/users/me` then... see note below |
| `GET /v1/bots/{id}/debut/events` (SSE) | none (eval events go to `global`) | filter `/v1/events/stream` by `bot_id` |
| `GET /v1/feed/snapshot` | invented | compose `/leaderboard` (top 3) + `/stats` + last N items from `/v1/events/stream` |
| `GET /v1/feed` | invented | recent items from `/v1/events/stream` |
| `GET /v1/halloffame` | invented | query bots WHERE `deleted_at IS NOT NULL` — but backend has no list endpoint with filter; needs a small backend addition |
| `GET /v1/achievements` | none | BFF returns the curated catalog (no backend table) |
| `GET /v1/tournaments/{id}/events` (SSE) | none | poll `/tournaments/{id}` every 2s |
| `GET /v1/battles` (list) | none | needs a backend addition |
| `GET /v1/tournaments` (list) | none | needs a backend addition |

The "needs a backend addition" lines mean: a few small Go handlers and store methods on `sort-bot-api`. Cheap; folded into the same backend PR as the persona columns.

The `me/bots` case: easiest is to add `GET /v1/users/me/bots` to the backend; otherwise the BFF would need to subscribe to `bot_submitted` events and maintain an in-memory user→bot index, which adds operational complexity for no payoff.
