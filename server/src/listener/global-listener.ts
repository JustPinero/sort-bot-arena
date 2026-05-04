// Persistent server-side consumer of sort-bot-api's `/v1/events/stream`.
//
// Closes debt D-8. Reactively transitions `recent_battles.status` from
// `running → complete` the moment sort-bot-api emits a `battle_complete`,
// instead of waiting for the 60s sweep (slice C3) to catch up.
//
// Lifecycle:
//   - `start()` spawns a background loop that connects, parses the stream,
//     dispatches events, and reconnects with exponential backoff on close
//     or error. Persistent — never gives up; the 60s sweep is the
//     reconciliation safety net for events lost during reconnect windows.
//   - `stop()` aborts any in-flight stream + signals the loop to exit. Used
//     by tests + graceful shutdown.
//
// Idempotency: `battle_complete` writes use `WHERE status != 'complete'`
// so a replay is a no-op. The unknown-battle insert path uses
// `INSERT OR IGNORE` (battle_id is the primary key) for the same reason.

import { log } from '../lib/log.js';
import { insertCompletedFromUpstream } from '../store/recent-battles.js';

import { SseLineParser, type ParsedEvent } from './sse-parser.js';

import type { Client } from '@libsql/client';

// Slice D4 + Phase 11 victor-conditions — listener calls into the
// orchestrator on `battle_complete` when the battle maps to a
// tournament match. The structural type carries the single entry
// point the listener needs (`advanceForBattle`); the orchestrator
// owns lookup + complete/failed semantics. Stubbed in tests.
export interface OrchestratorAdvancer {
  advanceForBattle(
    battleId: string,
    winnerBotId: string | null,
    completedAt: string,
  ): Promise<void>;
}

export const RECONNECT_BACKOFFS_MS = [1000, 2000, 5000, 10000, 30000] as const;
const MAX_BACKOFF_MS = 30_000;

export interface GlobalEventListenerOpts {
  db: Client;
  sortBotApiUrl: string;
  // Injectable for tests; defaults to the global `fetch` so production flows
  // hit the real upstream.
  fetchImpl?: typeof fetch;
  // Gate from env (`RUN_LISTENER`). When false, `start()` is a no-op and
  // `isRunning()` returns false. The /api/readyz handler still surfaces
  // these getters; they just stay zero-valued.
  runListener: boolean;
  // Test seam: invoked once per parsed event (after dispatch). Useful for
  // deterministic synchronization in tests instead of polling.
  onEventCount?: (count: number) => void;
  // Test seam: replace setTimeout-based backoff sleep. Defaults to real
  // `setTimeout`. Tests pass an immediate-resolve so they don't wall-clock
  // the backoff series.
  sleep?: (ms: number) => Promise<void>;
  // Optional jitter source for backoff (0..1). Defaults to Math.random.
  random?: () => number;
  // Slice D4 — when present, `battle_complete` events that map to a
  // tournament_matches row (joined on battle_id) trigger `advanceMatch`
  // after the match's status is flipped to `complete`. Optional so the
  // listener can run without the orchestrator wired (the 60s sweep is
  // the safety net).
  orchestrator?: OrchestratorAdvancer;
}

interface BattleCompletePayload {
  battle_id: string;
  winner_bot_id: string;
  bot_a_wins: number;
  bot_b_wins: number;
  ties: number;
}

export class GlobalEventListener {
  private readonly db: Client;
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly runFlag: boolean;
  private readonly onEventCount: ((count: number) => void) | undefined;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly orchestrator: OrchestratorAdvancer | undefined;

  private running = false;
  private stopped = false;
  private currentAbort: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;
  private events = 0;
  private lastEventISO: string | null = null;

  constructor(opts: GlobalEventListenerOpts) {
    this.db = opts.db;
    this.url = opts.sortBotApiUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.runFlag = opts.runListener;
    this.onEventCount = opts.onEventCount;
    this.sleep =
      opts.sleep ??
      ((ms: number) =>
        new Promise<void>((resolve) => {
          const h = setTimeout(resolve, ms);
          // Don't keep the event loop alive on a backoff sleep — same
          // posture as the cache-prune interval in `src/index.ts`.
          if (typeof (h as { unref?: () => void }).unref === 'function') {
            (h as { unref: () => void }).unref();
          }
        }));
    this.random = opts.random ?? Math.random;
    this.orchestrator = opts.orchestrator;
  }

  start(): void {
    if (!this.runFlag) {
      log.info({}, 'global listener disabled (RUN_LISTENER=false)');
      return;
    }
    if (this.running || this.loopPromise) return;
    this.running = true;
    this.stopped = false;
    this.loopPromise = this.runLoop().catch((err) => {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        'global listener loop crashed',
      );
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.running = false;
    this.currentAbort?.abort();
    if (this.loopPromise) {
      await this.loopPromise.catch(() => undefined);
      this.loopPromise = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  lastEventAt(): string | null {
    return this.lastEventISO;
  }

  eventsProcessed(): number {
    return this.events;
  }

  private async runLoop(): Promise<void> {
    let attempt = 0;
    while (!this.stopped) {
      try {
        await this.connectOnce();
        // Stream ended cleanly (server closed). Reconnect after a short
        // delay using the same backoff schedule.
      } catch (err) {
        if (this.stopped) return;
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'global listener stream error',
        );
      }
      if (this.stopped) return;
      const base = RECONNECT_BACKOFFS_MS[attempt] ?? MAX_BACKOFF_MS;
      attempt = Math.min(attempt + 1, RECONNECT_BACKOFFS_MS.length);
      const jittered = base * (0.8 + this.random() * 0.4);
      await this.sleep(jittered);
    }
  }

  private async connectOnce(): Promise<void> {
    const abort = new AbortController();
    this.currentAbort = abort;
    const res = await this.fetchImpl(`${this.url}/v1/events/stream`, {
      headers: { accept: 'text/event-stream' },
      signal: abort.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`upstream global SSE ${res.status}`);
    }
    const reader = res.body.getReader();
    const parser = new SseLineParser();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        const events = parser.push(value);
        for (const ev of events) {
          await this.dispatch(ev);
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  }

  private async dispatch(event: ParsedEvent): Promise<void> {
    this.events += 1;
    this.lastEventISO = new Date().toISOString();
    try {
      switch (event.type) {
        case 'battle_complete':
          await this.onBattleComplete(event.data as unknown as BattleCompletePayload);
          break;
        case 'battle_start':
        case 'run_start':
        case 'run_complete':
          // Intentionally no-op for now (see references/global-listener.md).
          break;
        default:
          log.debug({ event_type: event.type }, 'global listener: unknown event type, skipped');
      }
    } catch (err) {
      log.warn(
        {
          event_type: event.type,
          err: err instanceof Error ? err.message : String(err),
        },
        'global listener: dispatch failed',
      );
    } finally {
      this.onEventCount?.(this.events);
    }
  }

  private async onBattleComplete(payload: BattleCompletePayload): Promise<void> {
    const battleId = payload.battle_id;
    const winnerBotId =
      typeof payload.winner_bot_id === 'string' && payload.winner_bot_id.length > 0
        ? payload.winner_bot_id
        : null;
    if (!battleId) return;
    const completedAt = new Date().toISOString();

    // 1) UPDATE first. Idempotent via `status != 'complete'` clause inside
    //    `markComplete` (we filter here too so we can decide whether to
    //    fall through to the unknown-battle insert path).
    const updateRes = await this.db.execute({
      sql: `UPDATE recent_battles
               SET status = 'complete',
                   winner_bot_id = ?,
                   completed_at = ?
             WHERE battle_id = ?
               AND status != 'complete'`,
      args: [winnerBotId, completedAt, battleId],
    });
    if (updateRes.rowsAffected > 0) {
      log.info(
        { battle_id: battleId, winner_bot_id: winnerBotId },
        'global listener: battle marked complete',
      );
      // Slice D4 — if this battle is a tournament match, mark the match
      // complete and hand off to the orchestrator. The
      // `WHERE status != 'complete'` guard on the lookup keeps replays
      // idempotent (a second event for the same battle finds no row,
      // skips the advance).
      await this.maybeAdvanceTournamentMatch(battleId, winnerBotId, completedAt);
      return;
    }

    // 2) Either we already had it as 'complete' (replay) OR we never knew
    //    about it (battle initiated outside our app). Probe to disambiguate.
    const existing = await this.db.execute({
      sql: 'SELECT 1 FROM recent_battles WHERE battle_id = ? LIMIT 1',
      args: [battleId],
    });
    if (existing.rows.length > 0) {
      // Already complete; no-op (idempotency on replay).
      return;
    }

    // 3) Unknown battle — fetch upstream once for bot_a / bot_b and insert.
    try {
      const fetched = await this.fetchUpstreamBattle(battleId);
      if (!fetched) return;
      await insertCompletedFromUpstream(this.db, {
        battle_id: battleId,
        bot_a_id: fetched.bot_a_id,
        bot_b_id: fetched.bot_b_id,
        winner_bot_id: winnerBotId,
        completed_at: completedAt,
      });
      log.info(
        { battle_id: battleId, winner_bot_id: winnerBotId },
        'global listener: inserted external battle',
      );
    } catch (err) {
      log.warn(
        {
          battle_id: battleId,
          err: err instanceof Error ? err.message : String(err),
        },
        'global listener: failed to backfill unknown battle',
      );
    }
  }

  // Phase 11 victor-conditions — delegate the full lookup + advance
  // (including null-winner = tie semantics) to the orchestrator. We
  // used to bail on null winner here, which left tournament_matches
  // stuck `in_flight` forever on tie verdicts.
  private async maybeAdvanceTournamentMatch(
    battleId: string,
    winnerBotId: string | null,
    completedAt: string,
  ): Promise<void> {
    if (!this.orchestrator) return;
    try {
      await this.orchestrator.advanceForBattle(battleId, winnerBotId, completedAt);
    } catch (err) {
      log.warn(
        {
          battle_id: battleId,
          err: err instanceof Error ? err.message : String(err),
        },
        'global listener: advanceForBattle failed',
      );
    }
  }

  private async fetchUpstreamBattle(
    battleId: string,
  ): Promise<{ bot_a_id: string; bot_b_id: string } | null> {
    const res = await this.fetchImpl(`${this.url}/v1/battles/${battleId}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { battle?: { bot_a_id?: unknown; bot_b_id?: unknown } };
    const a = body.battle?.bot_a_id;
    const b = body.battle?.bot_b_id;
    if (typeof a !== 'string' || typeof b !== 'string') return null;
    return { bot_a_id: a, bot_b_id: b };
  }
}
