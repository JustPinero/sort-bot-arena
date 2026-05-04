// Slice 7 — recent_tournaments store helpers.
//
// Mirrors the recent_battles pattern: a write-side `recordTournament`
// (stubbed for slice 9 — we don't have a tournament POST handler in our
// server yet, but we register the helper now so the listing path uses
// the same API surface) plus the listing helper that backs GET
// /api/v1/tournaments.

import type { Client } from '@libsql/client';

export interface RecentTournamentRow {
  tournament_id: string;
  initiator_user_id: string | null;
  participant_count: number;
  bracket_size: number;
  input_mode: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  winner_bot_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface RecordTournamentArgs {
  tournament_id: string;
  initiator_user_id: string | null;
  participant_count: number;
  bracket_size: number;
  input_mode: string;
  // Optional initial status. Defaults to 'pending' for callers that
  // don't care; slice 9.5's POST handler passes 'running' once upstream
  // has accepted the create call (mirrors recent_battles.markRunning).
  status?: 'pending' | 'running' | 'complete' | 'failed';
}

// Inserts a freshly-created tournament. Used by slice 9.5's
// POST /api/v1/tournaments handler after upstream creation succeeds.
export async function recordTournament(db: Client, args: RecordTournamentArgs): Promise<string> {
  const createdAt = new Date().toISOString();
  const status = args.status ?? 'pending';
  await db.execute({
    sql: `INSERT INTO recent_tournaments
            (tournament_id, initiator_user_id, participant_count,
             bracket_size, input_mode, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      args.tournament_id,
      args.initiator_user_id,
      args.participant_count,
      args.bracket_size,
      args.input_mode,
      status,
      createdAt,
    ],
  });
  return createdAt;
}

// Slice D3 — terminal-state transitions for the orchestrator. The
// `status NOT IN ('complete', 'failed')` guard makes both calls
// idempotent: replay-driven double-advancement silently no-ops instead
// of clobbering a recorded winner / completion timestamp.
export async function markComplete(
  db: Client,
  tournamentId: string,
  winnerBotId: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE recent_tournaments
             SET status = 'complete',
                 winner_bot_id = ?,
                 completed_at = ?
           WHERE tournament_id = ?
             AND status NOT IN ('complete', 'failed')`,
    args: [winnerBotId, new Date().toISOString(), tournamentId],
  });
}

export async function markFailed(db: Client, tournamentId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE recent_tournaments
             SET status = 'failed',
                 completed_at = ?
           WHERE tournament_id = ?
             AND status NOT IN ('complete', 'failed')`,
    args: [new Date().toISOString(), tournamentId],
  });
}

// Slice D3 — read helper for the orchestrator. Returns null when the
// tournament row was deleted/never inserted; the orchestrator treats
// that as a graceful "do nothing" rather than throwing.
export async function getById(
  db: Client,
  tournamentId: string,
): Promise<RecentTournamentRow | null> {
  const res = await db.execute({
    sql: `SELECT tournament_id, initiator_user_id, participant_count,
                 bracket_size, input_mode, status, winner_bot_id,
                 created_at, completed_at
            FROM recent_tournaments
           WHERE tournament_id = ?
           LIMIT 1`,
    args: [tournamentId],
  });
  const row = res.rows[0];
  if (!row) return null;
  const r = row as unknown as Record<string, unknown>;
  return {
    tournament_id: r['tournament_id'] as string,
    initiator_user_id: (r['initiator_user_id'] as string | null) ?? null,
    participant_count: Number(r['participant_count'] ?? 0),
    bracket_size: Number(r['bracket_size'] ?? 0),
    input_mode: r['input_mode'] as string,
    status: r['status'] as RecentTournamentRow['status'],
    winner_bot_id: (r['winner_bot_id'] as string | null) ?? null,
    created_at: r['created_at'] as string,
    completed_at: (r['completed_at'] as string | null) ?? null,
  };
}

export interface ListRecentTournamentsOpts {
  limit: number;
  before?: string | undefined;
  initiatorUserId?: string | undefined;
}

export async function listRecent(
  db: Client,
  opts: ListRecentTournamentsOpts,
): Promise<RecentTournamentRow[]> {
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
    sql: `SELECT tournament_id, initiator_user_id, participant_count,
                 bracket_size, input_mode, status, winner_bot_id,
                 created_at, completed_at
            FROM recent_tournaments
                 ${whereClause}
        ORDER BY created_at DESC
           LIMIT ?`,
    args,
  });
  return res.rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      tournament_id: r['tournament_id'] as string,
      initiator_user_id: (r['initiator_user_id'] as string | null) ?? null,
      participant_count: Number(r['participant_count'] ?? 0),
      bracket_size: Number(r['bracket_size'] ?? 0),
      input_mode: r['input_mode'] as string,
      status: r['status'] as RecentTournamentRow['status'],
      winner_bot_id: (r['winner_bot_id'] as string | null) ?? null,
      created_at: r['created_at'] as string,
      completed_at: (r['completed_at'] as string | null) ?? null,
    };
  });
}
