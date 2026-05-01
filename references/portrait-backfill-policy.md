# Portrait backfill policy

Phase 8 only generated personas on:

1. `POST /api/v1/bots` — new bot submission
2. `GET /api/v1/bots/:id` — when persona row missing

Phase 9 expands to: **every list endpoint that includes a bot kicks off background generation for any bot in the response that lacks a persona**, with a global concurrency cap so we don't hammer Leonardo when 50 bots load at once.

## Endpoints that trigger backfill

- `GET /api/v1/leaderboard`
- `GET /api/v1/feed/snapshot`
- `GET /api/v1/halloffame`
- `GET /api/v1/users/me/bots`
- `GET /api/v1/leaderboard/inputs/:input_id`
- `GET /api/v1/bots/:id` (already does this — keep)

Routes that do NOT trigger backfill:

- `GET /api/v1/stats` — no bot list.
- `GET /api/v1/bots/:id/runs|snapshots|inputs|analysis|badge.svg` — single bot, already covered by the parent `/bots/:id` visit pattern.
- `POST /api/v1/battles`, `POST /api/v1/tournaments` — generation is fire-and-forget separately for the participants when we synthesize their cards.

## Concurrency cap

`PersonaService` gains a `Semaphore` with capacity 3 (configurable). `startBackgroundGeneration` no longer fires-and-forgets unconditionally — it acquires from the semaphore, runs, releases. If the queue depth grows past 30, drop new requests with a warn log (we shouldn't ever hit this at demo scale, but the safety valve avoids unbounded growth in case Leonardo hangs).

```ts
class Semaphore {
  private inUse = 0;
  private waiters: Array<() => void> = [];
  constructor(private readonly capacity: number) {}
  async acquire(): Promise<() => void> {
    if (this.inUse < this.capacity) {
      this.inUse++;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.inUse++;
        resolve(() => this.release());
      });
    });
  }
  private release(): void {
    this.inUse--;
    const next = this.waiters.shift();
    if (next) next();
  }
  pendingCount(): number { return this.waiters.length; }
}
```

## Idempotency guard

Re-trigger guard already exists in `PersonaService.generatePortrait`:

```ts
const existing = await getPersona(this.cfg.db, bot.bot_id);
if (existing?.portrait_url || existing?.portrait_status === 'in_flight') return;
```

Important: when `startBackgroundGeneration` is called from a list endpoint, it returns immediately (semaphore-aware fire-and-forget). The list response goes back to the user with `portrait_url: null` for that bot — they see the placeholder. Within 10–30s the generation completes, and the next time the user navigates (or the leaderboard re-polls via TanStack Query staleTime) the portrait shows.

## Frontend coordination

To make backfill visible to users without manual refresh, raise TanStack Query staleness on persona-bearing endpoints from 60s → 30s during phase 9. `useLeaderboard`, `useHomeSnapshot`, `useHallOfFame`, `useMyBots`. Risk: more upstream calls. Mitigation: `withStaleFallback` already caches at 5min TTL so most refetches hit our cache, not sort-bot-api.

## Cost model

Worst case: a fresh Turso DB (every Railway redeploy until phase 9 ships, or a Turso restore) means every existing bot has no persona. First user hitting the leaderboard triggers up to N gens (N = leaderboard limit, capped at 50). Each gen ~1 Leonardo credit + ~$0.001 Anthropic. 50 bots × ~$0.005 = $0.25 for a full backfill. Negligible at demo scale.

After phase 9 (Turso persistent), this only happens for genuinely new bots — the cost amortizes to roughly "1 credit per submitted bot."

## Test plan

- `Semaphore.acquire`/`release` — table-driven. Capacity-3 with 5 concurrent acquires → 3 immediate, 2 queued. Release one → 1 dequeues.
- Integration: leaderboard handler calls `startBackgroundGeneration` for each persona-less row; assert via spy that gen is called per bot.
- Drop-on-overflow: queue >30 → warn + no gen.
