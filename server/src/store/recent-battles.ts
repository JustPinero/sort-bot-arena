// recent_battles store helpers (slice 4: battle cooldown enforcement).
//
// We persist created_at as an explicit ISO-8601 timestamp instead of relying
// on SQLite's CURRENT_TIMESTAMP default ("YYYY-MM-DD HH:MM:SS"). Two reasons:
// 1. Lexicographic comparisons over ISO-8601 match chronological order,
//    so the rolling-hour window query is a plain `created_at >= ?`.
// 2. We can compute Retry-After deltas without juggling timestamp formats.
//
// Race-safety on Rule 1 (no simultaneous battles per pair): we serialize
// the cooldown checks + INSERT through `withPairLock`, an in-process
// async mutex keyed on `pair_key`. We tried libsql write transactions
// (`BEGIN IMMEDIATE`) but the libsql sqlite3 backend hands the original
// connection to the transaction and lazily opens a *new* connection for
// subsequent `db.execute` calls — under `:memory:` that new connection
// is a fresh empty DB, so post-transaction writes hit "no such table".
// The in-process lock is sufficient for the single-Node-instance demo
// deployment (Railway). For horizontal scale we'd need a durable lock
// (Redis/Postgres advisory lock); see debt.md if/when that becomes real.
import type { Client } from '@libsql/client';

export interface RecentBattleRow {
  battle_id: string;
  bot_a_id: string;
  bot_b_id: string;
  pair_key: string;
  initiator_user_id: string | null;
  weight_class: string | null;
  status: 'pending' | 'running' | 'complete' | 'failed';
  winner_bot_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export async function findActive(
  db: Client,
  pair: string,
): Promise<{ battle_id: string; created_at: string } | null> {
  const res = await db.execute({
    sql: `SELECT battle_id, created_at
            FROM recent_battles
           WHERE pair_key = ?
             AND status NOT IN ('complete', 'failed')
        ORDER BY created_at DESC
           LIMIT 1`,
    args: [pair],
  });
  const row = res.rows[0];
  if (!row) return null;
  const r = row as unknown as Record<string, string>;
  return { battle_id: r['battle_id']!, created_at: r['created_at']! };
}

export async function countCompletedSince(
  db: Client,
  pair: string,
  sinceISO: string,
): Promise<{ count: number; oldest_created_at: string | null }> {
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n, MIN(created_at) AS oldest
            FROM recent_battles
           WHERE pair_key = ?
             AND status = 'complete'
             AND created_at >= ?`,
    args: [pair, sinceISO],
  });
  const row = res.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return { count: 0, oldest_created_at: null };
  const n = Number(row['n'] ?? 0);
  const oldest = row['oldest'];
  return {
    count: n,
    oldest_created_at: typeof oldest === 'string' && oldest.length > 0 ? oldest : null,
  };
}

// Per-pair in-process mutex. Each call to withPairLock(pair, fn) chains
// onto a Promise tail keyed by pair, so concurrent claims for the same
// pair execute strictly sequentially. Different pairs run in parallel.
const pairLocks = new Map<string, Promise<unknown>>();
export function withPairLock<T>(pair: string, fn: () => Promise<T>): Promise<T> {
  const prev = pairLocks.get(pair) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  pairLocks.set(
    pair,
    next.finally(() => {
      // Drop the entry once the chain catches up so we don't leak forever.
      if (pairLocks.get(pair) === next) pairLocks.delete(pair);
    }),
  );
  return next;
}

export interface InsertPendingArgs {
  battle_id: string;
  bot_a_id: string;
  bot_b_id: string;
  pair_key: string;
  initiator_user_id: string;
  weight_class: string | null;
}

export async function insertPending(db: Client, args: InsertPendingArgs): Promise<string> {
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO recent_battles
            (battle_id, bot_a_id, bot_b_id, pair_key, initiator_user_id, weight_class, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      args.battle_id,
      args.bot_a_id,
      args.bot_b_id,
      args.pair_key,
      args.initiator_user_id,
      args.weight_class,
      createdAt,
    ],
  });
  return createdAt;
}

export type ClaimPairResult =
  | { kind: 'ok'; created_at: string }
  | { kind: 'busy'; created_at: string }
  | { kind: 'cooldown'; oldest_created_at: string };

// Atomic per-pair claim: under the pair lock, runs both cooldown checks
// and the pending INSERT in sequence. Concurrent callers for the same
// pair serialize on `withPairLock`, so only one observes a clean state
// and inserts; the rest see the freshly-inserted pending row in
// `findActive` and short-circuit with `busy`.
export function claimPair(
  db: Client,
  args: InsertPendingArgs,
  rollingWindowSinceISO: string,
  maxCompletedPerWindow: number,
): Promise<ClaimPairResult> {
  return withPairLock(args.pair_key, async () => {
    const active = await findActive(db, args.pair_key);
    if (active) return { kind: 'busy', created_at: active.created_at };
    const completed = await countCompletedSince(db, args.pair_key, rollingWindowSinceISO);
    if (completed.count >= maxCompletedPerWindow && completed.oldest_created_at) {
      return { kind: 'cooldown', oldest_created_at: completed.oldest_created_at };
    }
    const createdAt = await insertPending(db, args);
    return { kind: 'ok', created_at: createdAt };
  });
}

export async function reassignBattleId(
  db: Client,
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  await db.execute({
    sql: 'UPDATE recent_battles SET battle_id = ? WHERE battle_id = ?',
    args: [newId, oldId],
  });
}

export async function markRunning(db: Client, battleId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE recent_battles SET status = 'running' WHERE battle_id = ?`,
    args: [battleId],
  });
}

export async function markComplete(
  db: Client,
  battleId: string,
  winnerBotId: string | null,
  completedAtISO: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE recent_battles
             SET status = 'complete',
                 winner_bot_id = ?,
                 completed_at = ?
           WHERE battle_id = ?`,
    args: [winnerBotId, completedAtISO, battleId],
  });
}

export async function markFailed(db: Client, battleId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE recent_battles SET status = 'failed' WHERE battle_id = ?`,
    args: [battleId],
  });
}

// Slice 5: surface the persisted weight_class label on the rich Battle
// shape returned by GET /api/v1/battles/:id. Returns null for legacy
// battles that pre-date our recent_battles mirror.
export async function getWeightClassByBattleId(
  db: Client,
  battleId: string,
): Promise<string | null> {
  const res = await db.execute({
    sql: 'SELECT weight_class FROM recent_battles WHERE battle_id = ? LIMIT 1',
    args: [battleId],
  });
  const row = res.rows[0];
  if (!row) return null;
  const wc = (row as unknown as Record<string, unknown>)['weight_class'];
  return typeof wc === 'string' ? wc : null;
}

export interface ListRecentOpts {
  limit: number;
  before?: string | undefined;
  initiatorUserId?: string | undefined;
}

// Slice 7 — paginated listing for GET /api/v1/battles. Cursor is the
// `created_at` ISO of the last item the caller saw (stateless, plain
// text — no encoding). Order is strictly created_at DESC and the index
// `idx_recent_battles_created` covers the unfiltered case;
// `idx_recent_battles_initiator` covers the initiator-filtered case.
export async function listRecent(
  db: Client,
  opts: ListRecentOpts,
): Promise<RecentBattleRow[]> {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (opts.before !== undefined) {
    where.push('created_at < ?');
    args.push(opts.before);
  }
  if (opts.initiatorUserId !== undefined) {
    where.push('initiator_user_id = ?');
    args.push(opts.initiatorUserId);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  args.push(opts.limit);
  const res = await db.execute({
    sql: `SELECT battle_id, bot_a_id, bot_b_id, pair_key, initiator_user_id,
                 weight_class, status, winner_bot_id, created_at, completed_at
            FROM recent_battles
                 ${whereClause}
        ORDER BY created_at DESC
           LIMIT ?`,
    args,
  });
  return res.rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      battle_id: r['battle_id'] as string,
      bot_a_id: r['bot_a_id'] as string,
      bot_b_id: r['bot_b_id'] as string,
      pair_key: r['pair_key'] as string,
      initiator_user_id: (r['initiator_user_id'] as string | null) ?? null,
      weight_class: (r['weight_class'] as string | null) ?? null,
      status: r['status'] as RecentBattleRow['status'],
      winner_bot_id: (r['winner_bot_id'] as string | null) ?? null,
      created_at: r['created_at'] as string,
      completed_at: (r['completed_at'] as string | null) ?? null,
    };
  });
}
