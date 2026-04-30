# Backend overview — sort-bot-api ground truth

This is what `sort-bot-api` actually is, derived from the running Go code (not just the OpenAPI spec). Use it as the primary reference when designing BFF behavior. Companion: [`backend-endpoints.md`](./backend-endpoints.md) catalogs every route, [`backend-schema.md`](./backend-schema.md) catalogs every table.

The frontend's `references/api-contracts.md` documents what *we consume* — but that doc was originally written against fictional MSW shapes. When in doubt, this doc + `backend-endpoints.md` win.

## What it is

A Go service that accepts user-submitted sorting algorithms (Python, Node.js, or compiled binaries), evaluates each against 57 built-in input arrays in a sandbox, computes a rank, and exposes the leaderboard + per-bot analytics + head-to-head battles + tournament brackets. Storage is SQLite (Postgres-portable). Optional LLM integration (Anthropic) for Big-O analysis and adversarial input generation.

Running app: `docker compose up` (or `cmd/sort-bot-api/main.go` direct). Listens on `:8080` by default.

## Key shapes

### Bot
```
{ id, user_id, display_name, language, source_path,
  source_size_bytes, source_sha256, status, submitted_at,
  evaluation_completed_at, deleted_at }
```
- `language` is one of `python | node | binary` (no `go` or `golang` — frontend has invented `go`).
- `status` is `pending | evaluating | evaluated | failed`. The OpenAPI spec misses `failed`; the code emits it on crash recovery + sandbox failures.
- Bots are **immutable**. Only `display_name` is mutable via PATCH. New code = new bot.
- `deleted_at` flag for soft-delete; preserved for historical leaderboard consistency.

The frontend's `Bot` type adds nickname, portrait, record (W/L/D), KO%, signature_input, achilles_heel, recent_form, achievements, trash_talk, retired. **None of these exist on the bot record.** They're either derivable (from runs / battles) or invented (achievements). See `backend-schema.md` for the derivability matrix.

### LeaderboardRow
```
{ bot_id, display_name, language, score, rank,
  inputs_covered, total_inputs, incomplete }
```
- `score` = geometric mean of per-input medians, in milliseconds. **Lower = faster.**
- The frontend treats W/L/D as the ranking primitive. The backend ranks by `score`.

### BattleResult
```
{ battle: { id, bot_a_id, bot_b_id, status,
            winner_bot_id, bot_a_wins, bot_b_wins, ties,
            created_at, completed_at },
  runs: [BattleRun] }
```
- A backend "battle" is a **head-to-head over a chosen input set**. No rounds, no health bars, no walkouts.
- Each input contributes one `BattleRun` row with `bot_a_duration_ms`, `bot_b_duration_ms`, `winner_bot_id`.
- The frontend's "battle" is a 5-round MMA-style fight with hype meter and KOs. See `api-reconciliation-plan.md` for the BFF translation strategy.

### SSE events

Two streams: `/v1/battles/{id}/events` (per-battle) and `/v1/events/stream` (global).

**Per-battle topic `battle:{id}`:**
- `battle_start` — `{ battle_id, bot_a, bot_b, inputs: [int] }`
- `run_start` — `{ battle_id, input_id }`
- `run_complete` — `{ battle_id, input_id, bot_a_status, bot_b_status, bot_a_duration_ms?, bot_b_duration_ms?, winner_bot_id? }`
- `battle_complete` — `{ battle_id, status, bot_a_wins, bot_b_wins, ties, winner_bot_id? }`

**Global topic `global`:**
- `bot_submitted` — `{ bot_id, user_id, display_name, language }`
- `evaluation_completed` — `{ bot_id, status, duration_ms? }`
- `rank_change` — `{ bot_id, old_rank, new_rank, score }`
- (battle terminal events are also re-published here)

Every event also has `topic, type, data, at: ISO-8601`.

The bus is in-memory (`internal/events/memBus`), 64-event per-subscriber buffer, drop-on-backpressure (logged), 15s heartbeat per SSE connection. Survives a single-process deployment; would need Redis or NATS in a multi-instance world.

## Auth model

- **Account creation**: `POST /v1/users` is public. Returns `{ user_id, display_name, api_key }`. The `api_key` is `sk_live_<64 hex>` and is shown **once** — backend stores SHA-256 hash only.
- **Bearer tokens**: `Authorization: Bearer sk_live_...` on mutation endpoints.
- **Anonymous bot submission**: `POST /v1/bots` works without auth and attributes to a built-in `system` user. Useful for the demo's "guest auto-provision" flow but means the frontend's "claim a guest" UX has nothing to claim against on the backend.
- **Ownership**: PATCH/DELETE/REPLAY on a bot require the caller to own that bot, else 403.
- **Public reads**: leaderboard, per-bot data, battles, tournaments, badge.svg are all public.

## Sandbox

- Linux-only execution; `cgroups v2` for resource limits, `setpgid` + `Killpg` for process group cleanup.
- macOS dev runs sandbox tests via Docker (`make sandbox-test`).
- Per-language config: Python 3 / Node.js 18 / pre-compiled binary. Adding a language is a config-map entry.
- Hard timeouts: 5s wall-clock per run, RLIMIT_CPU + RLIMIT_AS + RLIMIT_NPROC + RLIMIT_CORE.
- Static analysis pre-check (5s timeout) — Python AST scan, Node regex scan, ELF inspection. Rejected uploads return 400 with a clear error code.
- See `sort-bot-api/references/sandbox-design.md` for the full threat model.

## Async pipeline

```
POST /v1/bots
  → CreateBot (writes source to disk, inserts row status=pending)
  → EnqueueBot(bot_id) → queue.Pool
  → worker.EvaluateBot:
      ├─ SetBotStatus(evaluating)
      ├─ For each of 57 inputs:
      │   ├─ Sandbox.Run(bot)
      │   ├─ Verify(input, output)
      │   └─ CreateRun
      ├─ SetBotStatus(evaluated)
      └─ WriteSnapshot → publishes rank_change events
```

The `queue.Pool` is bounded with backpressure; if it's full, `EnqueueBot` blocks. If `EnqueueBot` is `nil` (Phase 1–3 testing mode), bots stay `pending` forever — the integration depends on the worker pool being wired in `main.go`.

**Crash recovery**: at boot, `MarkEvaluatingBotsAsFailed` flips any stuck `evaluating` bots to `failed` with `evaluation_completed_at` set. Same pattern for battles.

## LLM integration (Anthropic)

The pattern matters because we'll mirror it for Leonardo.

`internal/ai/`:
- `client.go` — `LLMClient` interface + `AnthropicClient` HTTP impl. Direct `net/http` to the Messages API; no SDK. Configurable `baseURL` for tests via `httptest.NewServer`.
- `analysis.go` — `Analyzer.Analyze(ctx, AnalysisRequest) → *Analysis`. Builds prompt from bot source + per-input timings. Validates response against a JSON schema (max array sizes, max string lengths, required fields). Retries once on malformed JSON.
- `adversarial.go` — `AdversarialGenerator.Generate(...) → *Input`. Builds prompt from target bot + timings. Returns a JSON int array (clamped to size class).

Activation: `ANTHROPIC_API_KEY` env var. If unset, `Analyzer` and `AdversarialGenerator` are nil; endpoints that need them return 503 (graceful degradation). The frontend already handles 503 on the analysis tab.

Caching: deterministic — analysis cached forever per bot (immutable bots = immutable analysis); adversarial inputs cached by `(target_bot_id, size, seed)`. Cache reads bypass the LLM and the rate limiter.

Rate limiting: shared `Limiter` (Redis-backed when `REDIS_URL` set, in-memory otherwise). Per-user when authenticated, per-IP for unauthenticated viewers. Configured via `RateLimitAnalysisPerHour` env var. 429 + `Retry-After` on hit.

## What's NOT there

For your sanity, here's what the backend explicitly **does not have** (and what we need to fake / synthesize via the BFF):

- ❌ Bot nickname (only `display_name`)
- ❌ Portrait URL
- ❌ Trash talk text
- ❌ Bot W/L/D record column
- ❌ KO percentage
- ❌ Recent form
- ❌ Signature input / Achilles heel as direct fields (derivable from `/v1/bots/{id}/profile`)
- ❌ Achievements (no table, no concept)
- ❌ Battle "rounds" / hype meter / KO graphic — backend battles are timing comparisons over input sets
- ❌ Tournament SSE event stream (only per-battle and global)
- ❌ Debut evaluation SSE stream — eval progress events go to `global`, not a dedicated `bot:{id}` topic
- ❌ Feed snapshot endpoint
- ❌ Hall of fame endpoint
- ❌ `GET /v1/users/me/bots`
- ❌ `GET /v1/battles` (list)
- ❌ `GET /v1/tournaments` (list)
- ❌ `go` / `golang` language support

**These gaps are filled by our own backend service (`sort-bot-arena/server/`)**, not by changes to `sort-bot-api`. See [`server-architecture.md`](./server-architecture.md) for our backend's design.

## Implementation drift vs spec

OpenAPI lives at `sort-bot-api/references/openapi.yaml` but a few details lag the code. Trust the code:

- `Bot.status` includes `failed` (spec lists 3 of 4 statuses).
- `Battle.status` includes `failed` (same).
- `GET /v1/bots/{id}/analysis` returns 412 (bot not evaluated yet) and 503 (no API key); spec doesn't list those.
- `POST /v1/inputs/adversarial` same status code drift.
- 429 responses set `Retry-After` header; not in spec.
- `offset` query param is clamped to 1,000,000 in code; spec is unbounded.

When we ship the BFF, regenerate types from the spec; we'll need to manually augment for these drifts.

## How we use this service

**`sort-bot-api` is third-party** — we deploy it (Railway) and consume it as an HTTP/SSE dependency. We do not modify its source. All gaps it can't fill are filled by our own backend service in `sort-bot-arena/server/`. See [`server-architecture.md`](./server-architecture.md) for the divisions of responsibility.

The reconciliation plan in `requests/api-reconciliation-plan.md` lays out the integration order.
