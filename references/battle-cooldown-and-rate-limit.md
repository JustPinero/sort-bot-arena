# Battle cooldown + rate-limit design

Phase 9 spec: any signed-in user can start a battle, with two cooldown rules enforced server-side per user pair (A,B):

1. **No simultaneous battles** for the same A-vs-B pair (treat order-independent).
2. **Max 3 completed battles per pair per rolling hour.**

Violations return `429 Too Many Requests` with a `Retry-After` header in seconds + a JSON envelope. Frontend shows a friendly error in the match-setup modal.

## Why these rules (and not B/C from the question set)

- "B — 1 per 5 min, period" was strictest. Turns out battles in sort-bot-api complete in ~200ms, so 5min throttling makes the demo feel laggy. A is more permissive while still preventing the runaway loop case.
- "C — only block simultaneous" was loosest. Misses the abuse case where someone scripts 100 battles for the same pair to drain Anthropic credits via downstream events. 3/hr is a soft ceiling.
- A scales: per-pair, not per-user, so two different users picking the same matchup share one bucket.

## Pair key

Order-independent, deterministic:

```ts
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
```

Stored as `recent_battles.pair_key`. Index `idx_recent_battles_pair_created` makes the cooldown check a single ranged scan.

## Enforcement (server-side, in `routes/battles.ts` POST handler)

```ts
const pair = pairKey(body.bot_a, body.bot_b);
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

// Rule 1: any active (status not in complete/failed) battle for this pair?
const active = await db.execute({
  sql: `SELECT battle_id, created_at FROM recent_battles
         WHERE pair_key = ? AND status NOT IN ('complete', 'failed')
         ORDER BY created_at DESC LIMIT 1`,
  args: [pair],
});
if (active.rows[0]) {
  // Compute when the active one is expected to complete: in practice
  // sort-bot-api battles finish in <1s, but use a generous 60s window.
  const created = parseSqliteTimestamp(active.rows[0]['created_at']);
  const retryAfter = Math.max(1, 60 - Math.floor((now - created) / 1000));
  return c.json(
    { error: 'pair_busy', detail: 'A battle for this pair is already running' },
    429,
    { 'Retry-After': String(retryAfter) },
  );
}

// Rule 2: 3 completed in last hour?
const completed = await db.execute({
  sql: `SELECT COUNT(*) AS n FROM recent_battles
         WHERE pair_key = ?
           AND status = 'complete'
           AND created_at >= ?`,
  args: [pair, oneHourAgo.toISOString()],
});
if ((completed.rows[0]?.n ?? 0) >= 3) {
  // Find oldest of the 3 → retry-after = (oldest + 1hr) - now
  const oldest = await db.execute({
    sql: `SELECT created_at FROM recent_battles
           WHERE pair_key = ? AND status = 'complete'
             AND created_at >= ?
           ORDER BY created_at ASC LIMIT 1`,
    args: [pair, oneHourAgo.toISOString()],
  });
  const oldestT = parseSqliteTimestamp(oldest.rows[0]['created_at']);
  const retryAfter = Math.max(1, 3600 - Math.floor((now - oldestT) / 1000));
  return c.json(
    { error: 'pair_cooldown', detail: '3 battles per hour per matchup limit reached' },
    429,
    { 'Retry-After': String(retryAfter) },
  );
}

// Insert before forwarding to upstream so simultaneous requests both see the row
const battleId = makeBattleId();
await db.execute({
  sql: `INSERT INTO recent_battles
          (battle_id, bot_a_id, bot_b_id, pair_key, initiator_user_id, weight_class, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
  args: [battleId, body.bot_a, body.bot_b, pair, me.id, weightClass, 'pending'],
});
// Then call sort-bot-api POST /v1/battles with our battleId? sort-bot-api
// generates its own id, so we'd update once we get the response.
```

> **Important nuance:** sort-bot-api generates its own battle_id, so we either (a) reconcile the IDs after upstream responds, or (b) don't insert until we have it. Option **b** simpler but races on simultaneous requests. Option **a** preferred — INSERT with our `pair_key` placeholder + null `battle_id`, UPDATE to the real id on upstream response. Detailed sequence in the cooldown slice prompt.

## Status transitions

`recent_battles.status` lifecycle:

- `pending` — we've inserted the row, calling sort-bot-api now.
- `running` — sort-bot-api accepted the battle, it's executing.
- `complete` — sort-bot-api reported terminal success.
- `failed` — sort-bot-api 5xx'd or the battle failed.

Until the global SSE listener (debt D-8) ships, transitions happen on:

1. POST `/api/v1/battles` (us → sort-bot-api): sets `pending` → `running` (or `failed` on upstream error).
2. GET `/api/v1/battles/:id` cache-touch: if upstream says `complete`, we backfill `complete` + `winner_bot_id` + `completed_at` here. The arena page already fetches this on render, so completion gets reflected within a single user click.
3. Background sweep every 60s (cheap): for any `running` row older than 60s, fetch upstream battle, update status. Belt-and-suspenders for the cooldown rule.

## Frontend handling

`apiClient.post` already throws `ApiError` with `status` + `body`. The match-setup modal catches and renders a friendly message:

```ts
if (err.status === 429) {
  if (err.body?.error === 'pair_busy')
    showError('That matchup is already running. Try again in a few seconds.');
  else if (err.body?.error === 'pair_cooldown')
    showError(`That matchup hit the per-hour limit. Try again in ${formatRetry(err.headers.get('Retry-After'))}.`);
}
```

## Test plan

- Unit: `pairKey` symmetric on `(a,b)` and `(b,a)`.
- Integration:
  - Two consecutive POSTs for the same pair → second returns 429 `pair_busy`.
  - Sequential POSTs over time, 4th in an hour returns 429 `pair_cooldown` with sensible `Retry-After`.
  - Different pair after one is busy → 200.
- Load: 50 simultaneous POSTs for the same pair — exactly 1 wins, 49 get 429. (Race-safety on the INSERT.)
