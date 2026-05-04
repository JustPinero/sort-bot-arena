// Slice C3 (D-10) — periodic background sweep that reconciles
// `recent_battles.status='running'` rows older than the age threshold
// against the upstream sort-bot-api. Exists because, until the global
// SSE listener (D-8) ships, a battle that completes without a viewer
// keeps its `recent_battles` row at status='running' indefinitely —
// which then poisons the cooldown rule's Retry-After computation.
//
// Race-safety note: the timer runs in the same Node process that
// serves traffic. JS is single-threaded, so a sweep tick cannot
// interleave with another tick. We don't need a lock; the WHERE clause
// `status = 'running'` is itself the idempotency guard — once a row
// transitions to 'complete' or 'failed' it falls out of the candidate
// set on the next tick. Two battles completing concurrently mid-sweep
// are not a hazard either: each gets its own UPDATE keyed by
// battle_id PK.

import { SortBotApiError, type SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { log } from '../lib/log.js';
import { listRunningOlderThan, markComplete, markFailed } from '../store/recent-battles.js';

import type { Client } from '@libsql/client';

// Phase 11 victor-conditions — minimum surface the sweep needs from the
// orchestrator. Mirror of `OrchestratorAdvancer` in global-listener.ts;
// duplicating the structural type keeps this module decoupled from the
// listener.
export interface SweepOrchestratorAdvancer {
  advanceForBattle(
    battleId: string,
    winnerBotId: string | null,
    completedAt: string,
  ): Promise<void>;
}

export interface BattleSweeperOptions {
  db: Client;
  sortBotApi: Pick<SortBotApiClient, 'getBattle'>;
  intervalMs?: number;
  ageThresholdMs?: number;
  /** Fire one sweep() immediately on start() so tests don't need to wait. */
  runOnStart?: boolean;
  // Phase 11 — when present, the sweep advances tournament_matches whose
  // battle_id was just resolved. Closes the gap where the listener missed
  // a `battle_complete` event during a reconnect window: without this
  // wiring, the sweep would mark `recent_battles.complete` but leave
  // tournament_matches stuck `in_flight` forever.
  orchestrator?: SweepOrchestratorAdvancer;
}

export class BattleSweeper {
  private readonly db: Client;
  private readonly sortBotApi: Pick<SortBotApiClient, 'getBattle'>;
  private readonly intervalMs: number;
  private readonly ageThresholdMs: number;
  private readonly runOnStart: boolean;
  private readonly orchestrator: SweepOrchestratorAdvancer | undefined;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(opts: BattleSweeperOptions) {
    this.db = opts.db;
    this.sortBotApi = opts.sortBotApi;
    this.intervalMs = opts.intervalMs ?? 60_000;
    this.ageThresholdMs = opts.ageThresholdMs ?? 60_000;
    this.runOnStart = opts.runOnStart ?? false;
    this.orchestrator = opts.orchestrator;
  }

  start(): void {
    if (this.handle) return; // idempotent
    if (this.runOnStart) {
      this.sweep().catch((err: unknown) => {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'battle sweep (initial) failed',
        );
      });
    }
    this.handle = setInterval(() => {
      this.sweep().catch((err: unknown) => {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, 'battle sweep failed');
      });
    }, this.intervalMs);
    // Don't pin the Node process if the sweep timer is the only thing
    // left running. Same pattern as `pruneExpired`'s setInterval in
    // src/index.ts.
    this.handle.unref?.();
  }

  stop(): void {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  async sweep(): Promise<void> {
    const stale = await listRunningOlderThan(this.db, this.ageThresholdMs);
    if (stale.length === 0) return;
    let updated = 0;
    for (const row of stale) {
      try {
        const { battle } = await this.sortBotApi.getBattle(row.battle_id);
        if (battle.status === 'complete') {
          const completedAt = battle.completed_at ?? new Date().toISOString();
          await markComplete(this.db, row.battle_id, battle.winner_bot_id, completedAt);
          updated += 1;
          // Phase 11 victor-conditions — if this battle was a
          // tournament match the listener missed (e.g. event arrived
          // during a reconnect window), advance the bracket now.
          // No-op for non-tournament battles or already-advanced rows.
          if (this.orchestrator) {
            try {
              await this.orchestrator.advanceForBattle(
                row.battle_id,
                battle.winner_bot_id,
                completedAt,
              );
            } catch (err) {
              log.warn(
                {
                  battle_id: row.battle_id,
                  err: err instanceof Error ? err.message : String(err),
                },
                'battle sweep: advanceForBattle failed',
              );
            }
          }
        } else if (battle.status === 'failed') {
          await markFailed(this.db, row.battle_id);
          updated += 1;
        }
        // Upstream still 'pending' / 'running' — leave the row alone;
        // we'll try again next tick.
      } catch (err) {
        const status = err instanceof SortBotApiError ? err.status : undefined;
        log.warn(
          {
            battle_id: row.battle_id,
            upstream_status: status,
            err: err instanceof Error ? err.message : String(err),
          },
          'battle sweep upstream lookup failed',
        );
        // Continue — one bad row must not stop the loop.
      }
    }
    if (updated > 0) {
      log.info({ updated, scanned: stale.length }, 'battle sweep reconciled rows');
    }
  }
}
