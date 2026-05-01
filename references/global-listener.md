# Global SSE listener (closing D-8)

## Why

sort-bot-api emits a global event stream at `GET /v1/events/stream`. Today the only events it carries are `battle_start`, `run_start`, `run_complete`, `battle_complete` (verified live during phase 7 — see `references/sort-bot-api-shapes.md`). Phase 8 deferred consuming this stream because at demo scale records were 0-0-0 anyway and the listener didn't pay rent.

Phase 10 reactivates it for two reasons:

1. **Records become non-zero.** `recent_battles.status` transitions from `running → complete` happen reactively instead of lazily-on-page-view. `deriveRecord`/`deriveKoPercentage`/`deriveRecentForm` now return real numbers.
2. **Tournament orchestrator depends on it.** The orchestrator (D-9) needs to know the moment a match's underlying battle finishes to advance the bracket. Polling works as a fallback but the listener gives instant transitions.

## Process model

The listener is a singleton inside the Railway container — a long-running async loop that connects to sort-bot-api's SSE endpoint, consumes events, writes to `recent_battles` + dispatches to the tournament orchestrator. **Single instance per environment** (the Railway service is single-replica, so this is naturally enforced; if we ever scale to multiple replicas we'd need a leader election, but not in scope).

```
class GlobalEventListener {
  start()      // boot in src/index.ts after migrations
  stop()       // graceful shutdown for tests
  isHealthy()  // reflected in /api/readyz
}
```

The listener's lifecycle attaches to `RUN_LISTENER=true` env (already documented in `server/.env.example` since phase 7).

## Connection + reconnect

Same pattern as the frontend SSE hook (see `references/sse-reconnect-strategy.md`):

- Initial connect.
- On error/close: exponential backoff, jittered, capped at 30s.
- On `onopen`: reset attempts.
- Persistent — never gives up. There's no fallback to polling at this layer (the 60s sweep handles that).

```
RECONNECT_BACKOFFS_MS = [1000, 2000, 5000, 10000, 30000];
```

## Consuming events

sort-bot-api's events arrive as `event: <type>\ndata: <json>\n\n`. The listener parses, dispatches based on type:

| Type             | Action                                                                                            |
|------------------|---------------------------------------------------------------------------------------------------|
| `battle_start`   | (no-op for now; could insert if we ever start tracking battles initiated outside our app)         |
| `run_start`      | (no-op)                                                                                           |
| `run_complete`   | (no-op)                                                                                           |
| `battle_complete`| Update `recent_battles.status='complete'`, `winner_bot_id`, `completed_at`. Notify orchestrator. |

`battle_complete` payload (per phase 7 shapes doc):
```json
{
  "battle_id": "string",
  "winner_bot_id": "string",
  "bot_a_wins": number,
  "bot_b_wins": number,
  "ties": number
}
```

If `battle_id` doesn't exist in `recent_battles` (battle started outside our app), we **insert** a new row with what we know: `status='complete'`, `winner_bot_id`, `completed_at=now`, `bot_a_id` and `bot_b_id` reconstructed by fetching `/v1/battles/:id` upstream once. This gives us a global recent-battles feed even for battles users didn't initiate via our app — feeds into the homepage ticker.

## Idempotency

A reconnection might replay events sort-bot-api has already sent. The listener's UPDATE statement uses `WHERE status != 'complete'` so re-applying a completion is a no-op. INSERT for an unknown battle uses `INSERT OR IGNORE` to handle the race where two replicas (someday) see the same event.

## Tournament orchestrator hand-off

```
onBattleComplete(payload):
  1. UPDATE recent_battles SET status='complete', ... WHERE battle_id = ?
  2. SELECT match_id, tournament_id FROM tournament_matches WHERE battle_id = ?
  3. if a match row exists:
     - mark match complete with winner
     - call orchestrator.advanceMatch(matchRow)
```

## Health surface

`/api/readyz` already returns breaker state. Add a `listener` field:

```json
{
  "ready": true,
  "upstream": "ok",
  "breakers": { ... },
  "listener": {
    "running": true,
    "last_event_at": "2026-05-01T14:00:00.000Z",
    "events_processed": 1234
  }
}
```

If `RUN_LISTENER=false` or the listener is `running: false`, `ready` is still true (the listener isn't on the critical request path). Consumers of `/readyz` (Railway healthchecks) keep working.

## Test plan

Unit (`server/src/listener/__tests__/listener.test.ts`):
- SSE event parser: handles `event: foo\ndata: {...}\n\n` correctly.
- Reconnect with mocked timers + mocked fetch: cycles through backoffs.

Integration (`server/tests/listener-recent-battles.test.ts`):
- Listener consumes a synthesized `battle_complete` event → assert `recent_battles` row updated.
- Listener consumes an event for an unknown battle → row inserted via upstream fetch.
- Listener processes the same event twice → no double-update.

End-to-end through the orchestrator (covered in `tournament-orchestrator.test.ts`):
- Listener event → match complete → advancement → next round fires.

## Open questions resolved during phase 7 research

- **Why isn't there a `bot_submitted` or `evaluation_complete` event?** sort-bot-api's source has the `streamGlobalEvents` doc-comment listing those, but no code path publishes them. Our listener should be ready for them when sort-bot-api adds them — graceful unknown-event handling (log + skip).

## Out of scope for phase 10

- Replay catch-up on reconnect (could use a `last_event_at` cursor + a separate REST endpoint sort-bot-api doesn't have yet). For now we accept that events lost during a reconnect window are reconciled by the 60s sweep instead.
- Cross-replica coordination. Single replica enforced via `RUN_LISTENER=true` set on exactly one Railway replica.
