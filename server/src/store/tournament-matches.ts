// Slice D3 — store helpers for `tournament_matches`.
//
// Backs the orchestrator core: pulls pending/in-flight matches for a
// tournament, transitions them through the match state machine, and
// finds-or-creates the next-round shell row when a winner advances.
//
// Match state machine:
//
//   pending  → in_flight → complete | failed
//   bye  ───────────────→ complete
//
// The `bye` status is a synonym for "pre-completed by the bracket
// builder" — the orchestrator treats a bye row as already-complete (it
// has a `winner_bot_id` from `buildInitialBracket`) and uses it solely
// to advance the seed into the next round. `markComplete` is the join
// point: it transitions either `pending` (after we get the upstream
// battle result) or `bye` rows to `complete` with the same shape.
//
// Idempotency notes:
//   - `markComplete` no-ops if status is already 'complete' (the WHERE
//     filter excludes it) so listener replays don't re-advance brackets.
//   - `markInFlight` no-ops if the row is no longer 'pending' (a sweep
//     and listener can race on the same match — the late writer sees
//     the row already in-flight and the UPDATE affects 0 rows).
//   - `findOrCreateNextMatch` uses `INSERT OR IGNORE` semantics via a
//     SELECT-then-INSERT so two concurrent advanceMatch calls for
//     siblings race-safe within the per-tournament mutex. We rely on
//     the orchestrator's mutex for the cross-row consistency anyway.

import { randomBytes } from 'node:crypto';

import type { Client } from '@libsql/client';

export type TournamentMatchStatus = 'pending' | 'in_flight' | 'complete' | 'failed' | 'bye';

export interface TournamentMatchRow {
  match_id: string;
  tournament_id: string;
  round: number;
  bracket_position: number;
  bot_a_id: string | null;
  bot_b_id: string | null;
  battle_id: string | null;
  status: TournamentMatchStatus;
  winner_bot_id: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
}

function rowToMatch(row: Record<string, unknown>): TournamentMatchRow {
  return {
    match_id: row['match_id'] as string,
    tournament_id: row['tournament_id'] as string,
    round: Number(row['round']),
    bracket_position: Number(row['bracket_position']),
    bot_a_id: (row['bot_a_id'] as string | null) ?? null,
    bot_b_id: (row['bot_b_id'] as string | null) ?? null,
    battle_id: (row['battle_id'] as string | null) ?? null,
    status: row['status'] as TournamentMatchStatus,
    winner_bot_id: (row['winner_bot_id'] as string | null) ?? null,
    scheduled_at: (row['scheduled_at'] as string | null) ?? null,
    completed_at: (row['completed_at'] as string | null) ?? null,
  };
}

const SELECT_COLUMNS = `match_id, tournament_id, round, bracket_position,
                        bot_a_id, bot_b_id, battle_id, status,
                        winner_bot_id, scheduled_at, completed_at`;

export async function insertInitialMatches(
  db: Client,
  tournamentId: string,
  matches: ReadonlyArray<{
    match_id: string;
    round: number;
    bracket_position: number;
    bot_a_id: string | null;
    bot_b_id: string | null;
    status: 'pending' | 'bye';
    winner_bot_id: string | null;
  }>,
): Promise<void> {
  // Bye rows carry a winner from the seeding step; their `completed_at`
  // is left null until `advanceMatch` walks them — keeps the time
  // bookkeeping uniform (every complete row has a completed_at).
  for (const m of matches) {
    await db.execute({
      sql: `INSERT INTO tournament_matches
              (match_id, tournament_id, round, bracket_position,
               bot_a_id, bot_b_id, status, winner_bot_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `${tournamentId}_${m.match_id}`,
        tournamentId,
        m.round,
        m.bracket_position,
        m.bot_a_id,
        m.bot_b_id,
        m.status,
        m.winner_bot_id,
      ],
    });
  }
}

export async function getMatchById(
  db: Client,
  matchId: string,
): Promise<TournamentMatchRow | null> {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLUMNS} FROM tournament_matches WHERE match_id = ? LIMIT 1`,
    args: [matchId],
  });
  const row = res.rows[0];
  return row ? rowToMatch(row as unknown as Record<string, unknown>) : null;
}

export async function listAllForTournament(
  db: Client,
  tournamentId: string,
): Promise<TournamentMatchRow[]> {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLUMNS}
            FROM tournament_matches
           WHERE tournament_id = ?
        ORDER BY round ASC, bracket_position ASC`,
    args: [tournamentId],
  });
  return res.rows.map((r) => rowToMatch(r as unknown as Record<string, unknown>));
}

// Pending matches with both slots filled — the candidates the
// orchestrator can fire upstream. Bye rows are excluded (they don't
// fire battles); they're handled separately via `listReadyByes`.
export async function listPendingForTournament(
  db: Client,
  tournamentId: string,
): Promise<TournamentMatchRow[]> {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLUMNS}
            FROM tournament_matches
           WHERE tournament_id = ?
             AND status = 'pending'
             AND bot_a_id IS NOT NULL
             AND bot_b_id IS NOT NULL
        ORDER BY round ASC, bracket_position ASC`,
    args: [tournamentId],
  });
  return res.rows.map((r) => rowToMatch(r as unknown as Record<string, unknown>));
}

// Bye rows that haven't been advanced yet. `winner_bot_id` is set by
// the seeding step but `completed_at` is null until the orchestrator
// processes them on the first schedule() call.
export async function listReadyByes(
  db: Client,
  tournamentId: string,
): Promise<TournamentMatchRow[]> {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLUMNS}
            FROM tournament_matches
           WHERE tournament_id = ?
             AND status = 'bye'
             AND completed_at IS NULL
             AND winner_bot_id IS NOT NULL
        ORDER BY round ASC, bracket_position ASC`,
    args: [tournamentId],
  });
  return res.rows.map((r) => rowToMatch(r as unknown as Record<string, unknown>));
}

export async function listInFlightForTournament(
  db: Client,
  tournamentId: string,
): Promise<TournamentMatchRow[]> {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLUMNS}
            FROM tournament_matches
           WHERE tournament_id = ?
             AND status = 'in_flight'`,
    args: [tournamentId],
  });
  return res.rows.map((r) => rowToMatch(r as unknown as Record<string, unknown>));
}

export async function markInFlight(
  db: Client,
  matchId: string,
  battleId: string,
  scheduledAtISO: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE tournament_matches
             SET status = 'in_flight',
                 battle_id = ?,
                 scheduled_at = ?
           WHERE match_id = ?
             AND status = 'pending'`,
    args: [battleId, scheduledAtISO, matchId],
  });
}

export async function markComplete(
  db: Client,
  matchId: string,
  winnerBotId: string,
  completedAtISO: string,
): Promise<void> {
  // The `status != 'complete'` guard makes this idempotent against
  // listener replays + sweep races. A finalized match silently no-ops.
  await db.execute({
    sql: `UPDATE tournament_matches
             SET status = 'complete',
                 winner_bot_id = ?,
                 completed_at = ?
           WHERE match_id = ?
             AND status != 'complete'`,
    args: [winnerBotId, completedAtISO, matchId],
  });
}

export async function markFailed(db: Client, matchId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE tournament_matches
             SET status = 'failed',
                 completed_at = ?
           WHERE match_id = ?
             AND status NOT IN ('complete', 'failed')`,
    args: [new Date().toISOString(), matchId],
  });
}

// Look up the next-round match cell, creating it lazily as a `pending`
// shell row if it doesn't exist yet. The bracket builder only seeds R1;
// later rounds materialize on demand as winners walk up.
export async function findOrCreateNextMatch(
  db: Client,
  tournamentId: string,
  round: number,
  bracketPosition: number,
): Promise<TournamentMatchRow> {
  const existing = await db.execute({
    sql: `SELECT ${SELECT_COLUMNS}
            FROM tournament_matches
           WHERE tournament_id = ?
             AND round = ?
             AND bracket_position = ?
           LIMIT 1`,
    args: [tournamentId, round, bracketPosition],
  });
  const row = existing.rows[0];
  if (row) return rowToMatch(row as unknown as Record<string, unknown>);

  const matchId = `${tournamentId}_m_r${round}_p${bracketPosition}_${randomBytes(4).toString('hex')}`;
  await db.execute({
    sql: `INSERT INTO tournament_matches
            (match_id, tournament_id, round, bracket_position, status)
          VALUES (?, ?, ?, ?, 'pending')`,
    args: [matchId, tournamentId, round, bracketPosition],
  });
  const fresh = await getMatchById(db, matchId);
  if (!fresh) throw new Error('findOrCreateNextMatch: insert succeeded but row not found');
  return fresh;
}

export async function setSlot(
  db: Client,
  matchId: string,
  slot: 'a' | 'b',
  botId: string,
): Promise<void> {
  // Only fill an empty slot; an already-filled slot is a no-op so a
  // double advanceMatch call (listener + sweep race) doesn't clobber.
  const col = slot === 'a' ? 'bot_a_id' : 'bot_b_id';
  await db.execute({
    sql: `UPDATE tournament_matches
             SET ${col} = ?
           WHERE match_id = ?
             AND ${col} IS NULL`,
    args: [botId, matchId],
  });
}

// Highest-round match in the tournament. The orchestrator uses this to
// detect "the tournament's final" — we don't store rounds_total
// anywhere; instead we compute it from `bracket_size = 2^maxRound`.
export async function getMaxRound(db: Client, tournamentId: string): Promise<number> {
  const res = await db.execute({
    sql: `SELECT MAX(round) AS r FROM tournament_matches WHERE tournament_id = ?`,
    args: [tournamentId],
  });
  const row = res.rows[0] as unknown as Record<string, unknown> | undefined;
  return row ? Number(row['r'] ?? 0) : 0;
}
