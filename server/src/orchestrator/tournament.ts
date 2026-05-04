// Slice D3 — Tournament orchestrator core (closes debt D-9).
//
// Walks a single-elimination bracket round-by-round. Called twice in
// the lifecycle:
//
//   1. After POST /api/v1/tournaments inserts initial matches (slice
//      D4 wires this), `schedule(tournamentId)` fires every R1 match
//      whose slots are filled. Bye matches advance instantly without
//      hitting upstream.
//   2. When a match's underlying battle completes, the global SSE
//      listener (slice C4) or the 60s sweep (slice C3) calls
//      `advanceMatch(matchRow)`, which marks the match complete,
//      advances the winner into the next round's shell row, and calls
//      `schedule()` again so newly-ready matches fire upstream.
//
// State machines:
//   tournament: pending → running → complete | failed
//   match:      pending → in_flight → complete | failed
//   bye row:    bye      ─────────→ complete (no battle fired)
//
// Concurrency model: per-tournament-id mutex (`withTournamentLock`)
// borrowed from the phase-9 `withPairLock` pattern. Two listener events
// for sibling matches in the same tournament can fire at the same
// instant; without the lock, both would race on `findOrCreateNextMatch`
// and `setSlot` for the next-round row, with the very real risk of
// both reading "neither slot filled yet" and double-firing
// `schedule()` for the next match. The mutex serializes all reads and
// writes within a single tournament — different tournaments still run
// in parallel.
//
// Idempotency:
//   - `markComplete` (matches + tournaments) carries a
//     `status != 'complete'` WHERE filter so a replayed listener event
//     for an already-complete match is a silent no-op.
//   - `setSlot` only writes when the column is NULL, so a redundant
//     advanceMatch call doesn't clobber an existing slot.
//   - `schedule()` selects only `status='pending'` rows that are *not*
//     already in_flight, so re-running it after a partial advance just
//     fires the newly-ready matches.
//
// Failure semantics:
//   - `startBattle` upstream throwing → `markMatchFailed` for the match,
//     `markTournamentFailed` for the parent. Phase 10 doesn't retry;
//     the user re-creates the tournament.
//   - `advanceMatch` on an already-complete row is a no-op via the
//     `status != 'complete'` guard.
//
// Race I mitigated explicitly: when sibling R1 matches finish in quick
// succession, the listener can call advanceMatch() for both before
// either's `schedule()` runs. Without the per-tournament lock, both
// would call `findOrCreateNextMatch(R2, p0)` in parallel — the first
// inserts, the second's SELECT either misses (depending on libsql's
// snapshot semantics) or hits the just-inserted row. Even with libsql
// being effectively serial, two parallel `setSlot` calls could each
// observe "both slots filled" inconsistently. Holding the
// per-tournament mutex across the full advance + schedule chain
// eliminates the window entirely.

import { log } from '../lib/log.js';
import { insertPending, markRunning, pairKey } from '../store/recent-battles.js';
import {
  markFailed as markTournamentFailed,
  markComplete as markTournamentComplete,
  getById as getTournamentById,
} from '../store/recent-tournaments.js';
import {
  findOrCreateNextMatch,
  getMatchById,
  getMaxRound,
  listInFlightForTournament,
  listPendingForTournament,
  listReadyByes,
  markComplete as markMatchComplete,
  markFailed as markMatchFailed,
  markInFlight,
  setSlot,
  type TournamentMatchRow,
} from '../store/tournament-matches.js';
import { getUserById } from '../store/users.js';
import { pickRoundInputs, type TournamentInputMode } from '../synthesize/tournament-inputs.js';

import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { Client } from '@libsql/client';

export interface OrchestratorOpts {
  db: Client;
  sortBotApi: Pick<SortBotApiClient, 'startBattle' | 'getInputs'>;
  // Decrypts the initiator's encrypted sort-bot-api key. Wired to
  // `decryptString(blob, sessionSecret)` in production; tests pass an
  // identity decoder that just utf-8s the buffer.
  decryptKey: (encrypted: Uint8Array) => string;
  // Inputs-per-match for upstream battles. Defaults to 3 to match the
  // route handler's default `count`.
  inputsPerMatch?: number;
}

// Per-tournament-id mutex. Same pattern as `withPairLock` in
// recent-battles.ts — chains async operations on a Promise tail keyed
// by tournament_id. Concurrent listener/sweep callers for the same
// tournament serialize; different tournaments run in parallel.
const tournamentLocks = new Map<string, Promise<unknown>>();

export function withTournamentLock<T>(tournamentId: string, fn: () => Promise<T>): Promise<T> {
  const prev = tournamentLocks.get(tournamentId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Store a swallowed-rejection tail copy. The caller still sees the
  // original rejection via the returned `next`; the stored handle just
  // shouldn't surface as an unhandled rejection if the caller chained
  // a `.catch` later than microtask-tick (tests do this routinely).
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  tournamentLocks.set(
    tournamentId,
    tail.finally(() => {
      if (tournamentLocks.get(tournamentId) === tail) {
        tournamentLocks.delete(tournamentId);
      }
    }),
  );
  return next;
}

export class TournamentOrchestrator {
  private readonly db: Client;
  private readonly sortBotApi: Pick<SortBotApiClient, 'startBattle' | 'getInputs'>;
  private readonly decryptKey: (encrypted: Uint8Array) => string;
  private readonly inputsPerMatch: number;

  constructor(opts: OrchestratorOpts) {
    this.db = opts.db;
    this.sortBotApi = opts.sortBotApi;
    this.decryptKey = opts.decryptKey;
    this.inputsPerMatch = opts.inputsPerMatch ?? 3;
  }

  // Public entry point for both lifecycle paths (POST handler and
  // listener/sweep). Idempotent — calling on a fully-resolved
  // tournament is a no-op (no pending matches, terminal-state guard
  // prevents double-marking the tournament).
  async schedule(tournamentId: string): Promise<void> {
    return withTournamentLock(tournamentId, () => this.scheduleLocked(tournamentId));
  }

  // Public entry for the listener/sweep on `battle_complete`. Marks
  // the match complete, walks the winner forward, and re-schedules.
  async advanceMatch(matchRow: TournamentMatchRow): Promise<void> {
    return withTournamentLock(matchRow.tournament_id, () => this.advanceMatchLocked(matchRow));
  }

  // Phase 11 victor-conditions fix — entry point for callers (listener +
  // sweep) that have a battle_id and a resolved winner (possibly null on
  // tie verdicts) but don't want to know about tournament_matches. Looks
  // up the (in-flight or pending) match row by battle_id and delegates to
  // `advanceMatch`. Idempotent against replays via the
  // `status NOT IN ('complete','failed')` filter.
  //
  // Null winner is forwarded — `advanceMatchLocked`'s null-winner branch
  // marks both the match AND the tournament `failed`, which is the right
  // semantic for upstream-emitted ties (we have no tie-breaker today).
  // Without this entry point, the listener used to silently bail on null
  // winner, leaving tournament_matches stuck `in_flight` forever.
  async advanceForBattle(
    battleId: string,
    winnerBotId: string | null,
    completedAt: string,
  ): Promise<void> {
    const res = await this.db.execute({
      sql: `SELECT match_id, tournament_id, round, bracket_position,
                   bot_a_id, bot_b_id, battle_id, status,
                   winner_bot_id, scheduled_at, completed_at
              FROM tournament_matches
             WHERE battle_id = ?
               AND status NOT IN ('complete', 'failed')
             LIMIT 1`,
      args: [battleId],
    });
    const row = res.rows[0];
    if (!row) return;
    const r = row as unknown as Record<string, unknown>;
    const matchRow: TournamentMatchRow = {
      match_id: r['match_id'] as string,
      tournament_id: r['tournament_id'] as string,
      round: Number(r['round']),
      bracket_position: Number(r['bracket_position']),
      bot_a_id: (r['bot_a_id'] as string | null) ?? null,
      bot_b_id: (r['bot_b_id'] as string | null) ?? null,
      battle_id: (r['battle_id'] as string | null) ?? null,
      status: r['status'] as TournamentMatchRow['status'],
      winner_bot_id: winnerBotId,
      scheduled_at: (r['scheduled_at'] as string | null) ?? null,
      completed_at: completedAt,
    };
    await this.advanceMatch(matchRow);
  }

  private async scheduleLocked(tournamentId: string): Promise<void> {
    const tournament = await getTournamentById(this.db, tournamentId);
    if (!tournament) return; // never inserted / cascaded away
    if (tournament.status === 'complete' || tournament.status === 'failed') return;

    // Process bye rows first — they don't fire upstream and they
    // unlock R2 matches to fire alongside R1 winners. Without this
    // first pass, a 6-bracket would fire only the R1 play-ins on the
    // initial schedule call and have to wait for those to finish
    // before the byes auto-advanced.
    await this.advanceByes(tournamentId);

    const pending = await listPendingForTournament(this.db, tournamentId);
    if (pending.length > 0) {
      // Pull the upstream input pool once per schedule tick. We don't
      // cache across ticks — `pickRoundInputs` is fast and the route
      // handler's batch usually only fires 1-4 matches at a time.
      let pool: Awaited<ReturnType<SortBotApiClient['getInputs']>>;
      try {
        pool = await this.sortBotApi.getInputs({ limit: 1000 });
      } catch (err) {
        log.warn(
          { tournament_id: tournamentId, err: err instanceof Error ? err.message : String(err) },
          'orchestrator: failed to fetch input pool',
        );
        await this.failTournament(tournamentId, pending);
        return;
      }

      const apiKey = await this.resolveApiKey(tournamentId);
      if (!apiKey) {
        log.warn({ tournament_id: tournamentId }, 'orchestrator: no api key for initiator');
        await this.failTournament(tournamentId, pending);
        return;
      }

      const mode = (tournament.input_mode as TournamentInputMode) ?? 'flat_random';
      for (const match of pending) {
        await this.fireMatch(match, pool.inputs, mode, apiKey, tournament.initiator_user_id);
      }
    }

    // After firing/byes, check terminal state. If everything is done
    // and we have a final winner, mark the tournament complete.
    await this.maybeCompleteTournament(tournamentId);
  }

  private async advanceMatchLocked(matchRow: TournamentMatchRow): Promise<void> {
    // Re-read the row so we see the freshest state under the lock —
    // a sibling listener event may have already advanced this match
    // between when the caller read it and when we acquired the lock.
    const fresh = await getMatchById(this.db, matchRow.match_id);
    if (!fresh) return;
    if (fresh.status === 'complete' || fresh.status === 'failed') {
      // Idempotency: a replayed listener event lands here.
      return;
    }
    const winner = matchRow.winner_bot_id;
    if (!winner) {
      // No winner means the upstream battle resolved as a tie or with
      // a null winner. Phase 10 treats this as a failure — promotion
      // can't proceed without a winner.
      await markMatchFailed(this.db, fresh.match_id);
      await markTournamentFailed(this.db, fresh.tournament_id);
      return;
    }

    await markMatchComplete(this.db, fresh.match_id, winner, new Date().toISOString());

    const nextRound = fresh.round + 1;
    const nextPosition = Math.floor(fresh.bracket_position / 2);

    // Detect the final match: bracket_size = 2^maxRound. The final's
    // bracket_position is always 0; once we're at maxRound, there is
    // no next round.
    const tournament = await getTournamentById(this.db, fresh.tournament_id);
    const bracketSize = tournament?.bracket_size ?? 0;
    const maxRound = bracketSize > 0 ? Math.ceil(Math.log2(bracketSize)) : 0;

    if (fresh.round >= maxRound) {
      // Final match. Mark the tournament complete and exit.
      await this.maybeCompleteTournament(fresh.tournament_id);
      return;
    }

    const nextMatch = await findOrCreateNextMatch(
      this.db,
      fresh.tournament_id,
      nextRound,
      nextPosition,
    );
    const slot: 'a' | 'b' = fresh.bracket_position % 2 === 0 ? 'a' : 'b';
    await setSlot(this.db, nextMatch.match_id, slot, winner);

    // Re-read to see if both slots are now filled — if so, schedule
    // fires the new match. We re-enter `scheduleLocked` directly
    // since we already hold the per-tournament mutex.
    const refreshed = await getMatchById(this.db, nextMatch.match_id);
    if (refreshed && refreshed.bot_a_id !== null && refreshed.bot_b_id !== null) {
      await this.scheduleLocked(fresh.tournament_id);
    } else {
      // Even if the next match isn't ready, check tournament-level
      // completion (e.g. final winner was just set on a different
      // path).
      await this.maybeCompleteTournament(fresh.tournament_id);
    }
  }

  // Marks any remaining bye rows as complete and slots their seed
  // into the next round. Called at the top of every schedule() so the
  // first tick on a 6-bracket walks byes → R2 alongside firing R1.
  private async advanceByes(tournamentId: string): Promise<void> {
    const byes = await listReadyByes(this.db, tournamentId);
    for (const bye of byes) {
      const winner = bye.winner_bot_id;
      if (!winner) continue;
      await markMatchComplete(this.db, bye.match_id, winner, new Date().toISOString());
      const nextRound = bye.round + 1;
      const nextPosition = Math.floor(bye.bracket_position / 2);
      const next = await findOrCreateNextMatch(this.db, tournamentId, nextRound, nextPosition);
      const slot: 'a' | 'b' = bye.bracket_position % 2 === 0 ? 'a' : 'b';
      await setSlot(this.db, next.match_id, slot, winner);
    }
  }

  private async fireMatch(
    match: TournamentMatchRow,
    inputs: Parameters<typeof pickRoundInputs>[0],
    mode: TournamentInputMode,
    apiKey: string,
    initiatorUserId: string | null,
  ): Promise<void> {
    if (!match.bot_a_id || !match.bot_b_id) return;
    const inputIds = pickRoundInputs(inputs, match.round, mode, this.inputsPerMatch);
    try {
      const upstream = await this.sortBotApi.startBattle(apiKey, {
        bot_a: match.bot_a_id,
        bot_b: match.bot_b_id,
        input_ids: inputIds,
      });
      const scheduledAt = new Date().toISOString();
      // Record in `recent_battles` so the global listener can
      // correlate the eventual `battle_complete` event back to a row,
      // and so the cooldown rule sees in-flight tournament battles
      // for the pair.
      await insertPending(this.db, {
        battle_id: upstream.battle_id,
        bot_a_id: match.bot_a_id,
        bot_b_id: match.bot_b_id,
        pair_key: pairKey(match.bot_a_id, match.bot_b_id),
        initiator_user_id: initiatorUserId ?? '',
        weight_class: null,
      });
      await markRunning(this.db, upstream.battle_id);
      await markInFlight(this.db, match.match_id, upstream.battle_id, scheduledAt);
    } catch (err) {
      log.warn(
        {
          tournament_id: match.tournament_id,
          match_id: match.match_id,
          err: err instanceof Error ? err.message : String(err),
        },
        'orchestrator: startBattle failed; marking match + tournament failed',
      );
      await markMatchFailed(this.db, match.match_id);
      await markTournamentFailed(this.db, match.tournament_id);
      throw err; // rethrow so caller can short-circuit the loop
    }
  }

  private async failTournament(
    tournamentId: string,
    pending: ReadonlyArray<TournamentMatchRow>,
  ): Promise<void> {
    for (const m of pending) {
      await markMatchFailed(this.db, m.match_id);
    }
    await markTournamentFailed(this.db, tournamentId);
  }

  private async maybeCompleteTournament(tournamentId: string): Promise<void> {
    const tournament = await getTournamentById(this.db, tournamentId);
    if (!tournament) return;
    if (tournament.status === 'complete' || tournament.status === 'failed') return;

    const pending = await listPendingForTournament(this.db, tournamentId);
    const inFlight = await listInFlightForTournament(this.db, tournamentId);
    const remainingByes = await listReadyByes(this.db, tournamentId);
    if (pending.length > 0 || inFlight.length > 0 || remainingByes.length > 0) {
      return;
    }

    const maxRound = await getMaxRound(this.db, tournamentId);
    if (maxRound <= 0) return;
    const finalMatch = await this.findFinalMatch(tournamentId, maxRound);
    if (!finalMatch || finalMatch.status !== 'complete' || !finalMatch.winner_bot_id) {
      return;
    }
    await markTournamentComplete(this.db, tournamentId, finalMatch.winner_bot_id);
  }

  private async findFinalMatch(
    tournamentId: string,
    maxRound: number,
  ): Promise<TournamentMatchRow | null> {
    const res = await this.db.execute({
      sql: `SELECT match_id, tournament_id, round, bracket_position,
                   bot_a_id, bot_b_id, battle_id, status,
                   winner_bot_id, scheduled_at, completed_at
              FROM tournament_matches
             WHERE tournament_id = ?
               AND round = ?
               AND bracket_position = 0
             LIMIT 1`,
      args: [tournamentId, maxRound],
    });
    const row = res.rows[0];
    if (!row) return null;
    const r = row as unknown as Record<string, unknown>;
    return {
      match_id: r['match_id'] as string,
      tournament_id: r['tournament_id'] as string,
      round: Number(r['round']),
      bracket_position: Number(r['bracket_position']),
      bot_a_id: (r['bot_a_id'] as string | null) ?? null,
      bot_b_id: (r['bot_b_id'] as string | null) ?? null,
      battle_id: (r['battle_id'] as string | null) ?? null,
      status: r['status'] as TournamentMatchRow['status'],
      winner_bot_id: (r['winner_bot_id'] as string | null) ?? null,
      scheduled_at: (r['scheduled_at'] as string | null) ?? null,
      completed_at: (r['completed_at'] as string | null) ?? null,
    };
  }

  private async resolveApiKey(tournamentId: string): Promise<string | null> {
    const tournament = await getTournamentById(this.db, tournamentId);
    if (!tournament || !tournament.initiator_user_id) return null;
    const user = await getUserById(this.db, tournament.initiator_user_id);
    if (!user) return null;
    try {
      return this.decryptKey(user.sort_bot_api_key_encrypted);
    } catch (err) {
      log.warn(
        {
          tournament_id: tournamentId,
          err: err instanceof Error ? err.message : String(err),
        },
        'orchestrator: failed to decrypt initiator api key',
      );
      return null;
    }
  }
}
