# sort-bot-api — observed response shapes

Captured against the live deploy at
`https://sort-bot-api-production.up.railway.app` on 2026-04-29 with two
freshly-submitted Python bots and one battle, one tournament, one
head-to-head request.

The point of this doc: be the source of truth our `server/` package's
synthesis layer and zod schemas build against. If a shape here disagrees
with `references/sort-bot-api-endpoints.md` or with our own MSW mocks,
the live response wins. Bot IDs and timestamps are real captures —
treated as fixtures, not secrets.

---

## Quick auth recap

- `POST /v1/users` (public): body `{ display_name, email }`. Returns
  `{ user_id, display_name, api_key }`. The `api_key` is `sk_live_…64-hex`.
- `Authorization: Bearer <api_key>` for all authed endpoints. Public
  endpoints accept calls without it.

## Endpoints with confirmed live shapes

### `GET /healthz`

Plain text body `ok`, status 200.

### `GET /v1/inputs?limit=N`

```json
{
  "inputs": [
    {
      "id": 39,
      "size_class": "large",
      "case_index": 0,
      "array_len": 100000,
      "is_custom": false,
      "uploader_id": null,
      "created_at": "2026-04-29T21:33:27.916357544Z"
    }
  ],
  "total": 57
}
```

- `size_class`: `"small" | "medium" | "large"`.
- `is_custom`: false for the seeded set; true for user-submitted inputs.
- The seeded 57 inputs cover small (≤19), medium (20–38), large (39–57).

### `GET /v1/leaderboard?limit=N`

```json
{
  "filter": {},
  "total_inputs": 57,
  "bots": [
    {
      "bot_id": "e6e2755a82b3829fcfe01cbda8916b70",
      "display_name": "Recon Bot",
      "language": "python",
      "score": 12.177481675104893,
      "inputs_covered": 57,
      "total_inputs": 57,
      "incomplete": false,
      "rank": 1
    }
  ]
}
```

- Empty DB returns `{ filter: {}, total_inputs: 57, bots: [] }`.
- `score` is a float; lower is better (it's the geometric mean of
  per-input median ms, normalized).
- `incomplete: true` when `inputs_covered < total_inputs`.
- No `nickname`, `record`, `ko_percentage`, `weight_class`, `portrait_url`,
  `signature_input`, or `achilles_heel` — all of those are synthesized
  on our side.

### `GET /v1/leaderboard/inputs/{input_id}` (per-input leaderboard)

```json
{
  "input_id": 1,
  "bots": [
    {
      "bot_id": "bceb63b9cc8cdcee130a9eb0bd4cebee",
      "display_name": "Recon Bot 2",
      "language": "python",
      "duration_ms": 7,
      "rank": 1
    }
  ]
}
```

> ⚠️ The plan and earlier notes referenced `/v1/per-input-leaderboard` —
> that path 404s. Real path is `/v1/leaderboard/inputs/{input_id}`.

### `GET /v1/stats`

```json
{
  "fastest_run_ms": 7,
  "language_distribution": { "python": 1 },
  "total_bots": 1,
  "total_runs": 171
}
```

Empty DB returns all zeros and `language_distribution: {}`.

### `POST /v1/users`

Body: `{ "display_name": "...", "email": "..." }`.
Response 200:

```json
{
  "user_id": "cace4931eb3fa88952fa03a282794012",
  "display_name": "Recon Bot Owner",
  "api_key": "sk_live_<64 hex chars>"
}
```

### `GET /v1/users/me` (auth required)

```json
{
  "id": "cace4931eb3fa88952fa03a282794012",
  "display_name": "Recon Bot Owner",
  "created_at": "2026-04-29T22:00:56.66014888Z"
}
```

> Note the field is `id`, not `user_id`, on this endpoint. (Inconsistent
> with `POST /v1/users` which returns `user_id`.) Our server normalizes.

### `POST /v1/bots` (auth, multipart)

Form fields: `display_name`, `language` (`python | node | binary`),
`source` (file upload).

Response 200:

```json
{
  "id": "e6e2755a82b3829fcfe01cbda8916b70",
  "user_id": "cace4931eb3fa88952fa03a282794012",
  "display_name": "Recon Bot",
  "language": "python",
  "source_size_bytes": 154,
  "source_sha256": "68f328f0a0cf1dbe8b5a3637e0d5c6f1e4b3f3faa2b3cce357ae8fc7f4731e94",
  "status": "pending",
  "submitted_at": "2026-04-29T22:01:09.640923165Z"
}
```

### `GET /v1/bots/{id}`

After eval finishes, `status` flips from `"pending"` to `"evaluated"`
(not "completed" — note that). Response gains
`evaluation_completed_at`:

```json
{
  "id": "e6e2755a82b3829fcfe01cbda8916b70",
  "user_id": "cace4931eb3fa88952fa03a282794012",
  "display_name": "Recon Bot",
  "language": "python",
  "source_size_bytes": 154,
  "source_sha256": "68f328f0a0cf1dbe8b5a3637e0d5c6f1e4b3f3faa2b3cce357ae8fc7f4731e94",
  "status": "evaluated",
  "submitted_at": "2026-04-29T22:01:09.640923165Z",
  "evaluation_completed_at": "2026-04-29T22:01:13.642870661Z"
}
```

### `GET /v1/bots/{id}/profile`

```json
{
  "bot": { /* same shape as GET /v1/bots/{id} */ },
  "rank": 1,
  "score": 12.177481675104888,
  "incomplete": false,
  "inputs_covered": 57,
  "total_inputs": 57,
  "best_input": { "input_id": 3, "median_ms": 7 },
  "worst_input": { "input_id": 45, "median_ms": 216 },
  "per_input": [
    { "input_id": 1, "size_class": "small", "median_ms": 7,
      "status_counts": { "success": 3 } }
    /* ...one entry per input the bot covered */
  ],
  "rank_history": [
    { "bot_id": "...", "rank": 1, "score": 12.177...,
      "snapshot_at": "...", "triggering_bot_id": "..." }
  ]
}
```

- `per_input[].status_counts` is a tally over the run attempts; in healthy
  runs you get `{ "success": 3 }`. Failures show as e.g.
  `{ "success": 1, "wrong_answer": 2 }` etc.
- `rank_history` is **embedded** here in addition to having its own
  endpoint — useful for first-paint of the profile page.

### `GET /v1/bots/{id}/runs?limit=N`

```json
{
  "bot_id": "e6e2755a82b3829fcfe01cbda8916b70",
  "runs": [
    {
      "id": 1,
      "bot_id": "e6e2755a82b3829fcfe01cbda8916b70",
      "input_id": 39,
      "run_number": 1,
      "status": "success",
      "duration_ms": { "Int64": 32, "Valid": true },
      "cpu_ms": { "Int64": 0, "Valid": false },
      "error_msg": { "String": "", "Valid": false },
      "started_at": "2026-04-29T22:01:09.662018858Z",
      "completed_at": "2026-04-29T22:01:09.699594413Z"
    }
  ],
  "total": 171
}
```

> ⚠️ `duration_ms`, `cpu_ms`, `error_msg` are exposed as Go's
> `sql.NullInt64`/`sql.NullString` JSON shape (`{Int64,Valid}` /
> `{String,Valid}`). Our server's client unwraps these into plain
> numbers/nullables before passing to the frontend.

### `GET /v1/bots/{id}/rank-history`

```json
{
  "bot_id": "e6e2755a82b3829fcfe01cbda8916b70",
  "count": 1,
  "history": [
    {
      "bot_id": "...",
      "rank": 1,
      "score": 12.177481675104893,
      "snapshot_at": "2026-04-29T22:01:13.642870661Z",
      "triggering_bot_id": "..."
    }
  ]
}
```

### `GET /v1/bots/{id}/analysis`

AI-generated, free-form. Same instance returns identical output (cached
in sort-bot-api's DB).

```json
{
  "algorithm": "Timsort (Python built-in list.sort)",
  "time_complexity_estimate": "O(n log n) average and worst case",
  "space_complexity_estimate": "O(n) auxiliary in the worst case",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "suggested_use_cases": ["...", "..."],
  "anti_patterns": ["...", "..."],
  "reasoning": "..."
}
```

### `GET /v1/bots/{id}/badge.svg`

Returns an SVG document (Shields-style 20px-tall badge). 405 on HEAD.
Example body:

```svg
<svg xmlns="..." width="129" height="20" role="img" aria-label="sort-bot: #1 of 1">
  ... <text x="34" y="14">sort-bot</text> <text x="98" y="14">#1 of 1</text>
</svg>
```

### `GET /v1/bots/{a}/vs/{b}` (head-to-head)

```json
{
  "bot_a": "<id>",
  "bot_b": "<id>",
  "a_wins": 9,
  "b_wins": 14,
  "ties": 34,
  "per_input": [
    { "input_id": 16, "size_class": "small", "a_median_ms": 7, "b_median_ms": 7, "winner": "tie" }
  ]
}
```

`winner` is one of `"a" | "b" | "tie"`.

### `POST /v1/battles` (auth)

> ⚠️ Body field names are `bot_a` / `bot_b` (not `bot_a_id` / `bot_b_id`
> — that mismatch was the source of `bad_field` errors in early curls).
> Either `input_ids: number[]` or `count: number` is required.

Request:

```json
{ "bot_a": "<id>", "bot_b": "<id>", "count": 3 }
```

Response 200:

```json
{
  "battle_id": "5e08ffd466447d2cfc1980a58a4ab1a9",
  "bot_a": "...",
  "bot_b": "...",
  "input_ids": [39, 38, 49],
  "status": "pending",
  "created_at": "..."
}
```

### `GET /v1/battles/{id}`

```json
{
  "battle": {
    "id": "...",
    "bot_a_id": "...",
    "bot_b_id": "...",
    "initiator_id": "...",
    "status": "complete",
    "winner_bot_id": { "String": "...", "Valid": true },
    "bot_a_wins": 1,
    "bot_b_wins": 0,
    "ties": 2,
    "created_at": "...",
    "completed_at": { "String": "...", "Valid": true }
  },
  "runs": [
    {
      "id": 1,
      "battle_id": "...",
      "input_id": 39,
      "bot_a_duration_ms": { "Int64": 27, "Valid": true },
      "bot_b_duration_ms": { "Int64": 28, "Valid": true },
      "bot_a_status": "success",
      "bot_b_status": "success",
      "winner_bot_id": { "String": "...", "Valid": true },
      "completed_at": "..."
    }
  ]
}
```

> Same `{Int64,Valid}` / `{String,Valid}` wrappers. Status values
> observed: `"pending"`, `"running"`, `"complete"`, `"failed"`.

### `GET /v1/battles/{id}/events` (SSE)

Backed by an in-memory bus that subscribes to the `battle:<id>` topic.
**The stream replays nothing on connect** — if the battle has already
completed, you'll get an empty stream (verified live: connecting after
`complete` produces zero events). Our server must therefore subscribe
before submitting the battle, or fall back to the materialized
`/v1/battles/{id}` shape when the SSE returns empty.

Event types published by `internal/battle/runner.go`:

| event type        | data fields                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `battle_start`    | `battle_id`, `bot_a`, `bot_b`, `inputs[]`                                                                          |
| `run_start`       | `battle_id`, `input_id`                                                                                            |
| `run_complete`    | `battle_id`, `input_id`, `bot_a_status`, `bot_b_status`, `bot_a_duration_ms`, `bot_b_duration_ms`, `winner_bot_id` |
| `battle_complete` | `battle_id`, `winner_bot_id`, `bot_a_wins`, `bot_b_wins`, `ties`                                                   |

Wire format (standard SSE):

```
event: <type>
data: {"battle_id":"...","input_id":39}

```

### `POST /v1/tournaments` (auth)

> ⚠️ Body field name is `participant_bot_ids` (not `bot_ids`). Either it
> or `top_n >= 2` must be set.

Request:

```json
{ "participant_bot_ids": ["<id_a>", "<id_b>"], "count": 2 }
```

Response:

```json
{
  "tournament_id": "357ebddb20442ac59c297d7ea421da97",
  "participant_count": 2,
  "status": "pending",
  "created_at": "...",
  "bracket": [[{ "Round": 1, "BracketPosition": 0, "BotA": "...", "BotB": "..." }]]
}
```

> ⚠️ The `bracket` entries use Go struct field names (`Round`, `BotA`,
> `BotB`) instead of `snake_case`. Our server will normalize.

### `GET /v1/tournaments/{id}`

```json
{
  "tournament": {
    "id": "357ebddb20442ac59c297d7ea421da97",
    "initiator_id": "...",
    "status": "pending",
    "participant_count": 2,
    "winner_bot_id": { "String": "", "Valid": false },
    "created_at": "...",
    "completed_at": { "String": "", "Valid": false }
  },
  "matches": [
    {
      "id": 1,
      "tournament_id": "...",
      "round": 1,
      "bracket_position": 0,
      "bot_a_id": { "String": "...", "Valid": true },
      "bot_b_id": { "String": "...", "Valid": true },
      "winner_bot_id": { "String": "", "Valid": false },
      "battle_id": { "String": "", "Valid": false },
      "completed_at": { "String": "", "Valid": false }
    }
  ]
}
```

### `GET /v1/events/stream` (SSE — global)

Subscribed to the `global` topic. **In the current build, only the
battle runner publishes to it**, so the only events the global stream
emits are the same `battle_start`/`run_start`/`run_complete`/
`battle_complete` shapes above (broadcast for every battle, not just one).
The `streamGlobalEvents` doc-comment in source says it covers
`bot_submitted`, `evaluation_completed`, and `rank_change` too, but
**no code path currently publishes those** — verified by grepping every
`Bus.Publish` call site.

Implication for our server: we cannot reliably observe submission /
eval / rank events from the SSE; we have to derive them by polling
`/v1/leaderboard` and `/v1/stats` on a cadence (or by subscribing to
each new bot's profile via TanStack Query refetch on the frontend).

---

## Endpoints I tried but did NOT confirm live

These paths exist in `references/openapi.yaml` but I didn't capture
their full happy-path response in this pass:

- `POST /v1/inputs` (auth) — uploading a custom input.
- `POST /v1/inputs/adversarial` (auth) — generating an adversarial input
  for a given bot.
- `POST /v1/bots/{id}/replay` (auth) — re-run a bot. Returns 405 on GET;
  full POST shape unverified.
- `PATCH /v1/bots/{id}` (auth) — rename. Trivial.
- `DELETE /v1/bots/{id}` (auth) — retire. Trivial.

We pick these up when the corresponding `server/` route is wired in
Slice 8/9.

---

## Drift summary (vs. our prior reference docs)

Findings here that differ from `references/sort-bot-api-endpoints.md`:

| Was documented as                             | Reality                                          |
| --------------------------------------------- | ------------------------------------------------ |
| `/v1/per-input-leaderboard?input_id=N`        | `/v1/leaderboard/inputs/{input_id}`              |
| `/v1/inputs/{id}`                             | 404 (no such route)                              |
| Battle status `"completed"`                   | `"evaluated"` for bots, `"complete"` for battles |
| `POST /v1/battles` body `bot_a_id`/`bot_b_id` | `bot_a` / `bot_b`                                |
| `POST /v1/tournaments` body `bot_ids`         | `participant_bot_ids`                            |
| Global SSE emits 4 event families             | Only emits the 4 battle event types              |
| `GET /v1/users/me` returns `user_id`          | Returns `id` (POST returns `user_id`)            |

Reference doc updates land alongside this commit so the next read of
`references/sort-bot-api-endpoints.md` matches reality.
