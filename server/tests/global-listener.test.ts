// Slice C4 — global SSE listener tests.
//
// Coverage matrix:
//   1. Parser: a multi-line SSE chunk produces the right `{type, data}`.
//   2. Parser: fragmented chunks reassemble across reads.
//   3. Listener: known battle row → marked complete with winner.
//   4. Listener: unknown battle → upstream `/v1/battles/:id` fetched, row
//      inserted with status=complete.
//   5. Listener: replaying the same `battle_complete` is a no-op (the
//      `WHERE status != 'complete'` clause + `INSERT OR IGNORE`).
//   6. Listener: stream closes mid-flight → loop reconnects after backoff.
//   7. Listener: `RUN_LISTENER=false` keeps `isRunning() === false` and
//      skips the fetch entirely.
//
// We bypass MSW for the SSE endpoint itself and inject a fake `fetchImpl`
// directly. Reason: MSW's `HttpResponse(ReadableStream)` doesn't reliably
// deliver chunks across `getReader().read()` until the stream closes
// under undici, which makes streaming-progress tests flaky / hangy. The
// listener's `fetchImpl` constructor option exists precisely so we can
// hand it a hand-built `Response` in tests.

import { describe, expect, it } from 'vitest';

import { GlobalEventListener } from '../src/listener/global-listener.js';
import { SseLineParser } from '../src/listener/sse-parser.js';
import { insertPending, markRunning } from '../src/store/recent-battles.js';
import { recordTournament } from '../src/store/recent-tournaments.js';
import {
  insertInitialMatches,
  markInFlight,
  type TournamentMatchRow,
} from '../src/store/tournament-matches.js';

import { makeTestApp } from './helpers/test-app.js';

// A controllable SSE source: tests push chunks, end the stream, and observe
// when each connection is opened. Delegates byte transport to a
// ReadableStream that the listener reads directly via `Response.body`.
class FakeSseSource {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  // Resolved when the stream is closed/aborted; lets tests await
  // listener-driven cleanup without polling.
  ended = Promise.resolve();
  pushChunk(text: string): void {
    if (!this.controller) throw new Error('no active connection');
    this.controller.enqueue(this.encoder.encode(text));
  }
  close(): void {
    this.controller?.close();
    this.controller = null;
  }
  buildResponse(signal: AbortSignal): Response {
    let endResolve!: () => void;
    this.ended = new Promise<void>((resolve) => {
      endResolve = resolve;
    });
    const setController = (c: ReadableStreamDefaultController<Uint8Array> | null): void => {
      this.controller = c;
    };
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        setController(controller);
        signal.addEventListener('abort', () => {
          try {
            controller.error(new Error('aborted'));
          } catch {
            // already closed
          }
          setController(null);
          endResolve();
        });
      },
      cancel: () => {
        setController(null);
        endResolve();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }
}

interface FakeUpstreamHandlers {
  // Called once per `/v1/events/stream` GET. Returns a source the test
  // can write chunks into. The listener's connection sees this stream.
  onStreamConnect: (signal: AbortSignal) => FakeSseSource;
  // Called for `/v1/battles/:id` lookups during the unknown-battle path.
  onBattleFetch?: (battleId: string) => Response;
}

function makeFetchImpl(handlers: FakeUpstreamHandlers): typeof fetch {
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const signal = init?.signal ?? new AbortController().signal;
    if (url.endsWith('/v1/events/stream')) {
      const source = handlers.onStreamConnect(signal);
      return source.buildResponse(signal);
    }
    const m = url.match(/\/v1\/battles\/([^/?]+)$/);
    if (m && handlers.onBattleFetch) {
      return handlers.onBattleFetch(m[1]!);
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

async function waitForEvents(
  listener: GlobalEventListener,
  n: number,
  timeoutMs = 2_000,
): Promise<void> {
  const start = Date.now();
  while (listener.eventsProcessed() < n) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${n} events; got ${listener.eventsProcessed()}`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

const UPSTREAM = 'http://api.test';

describe('SseLineParser', () => {
  it('parses a single battle_complete frame from one chunk', () => {
    const p = new SseLineParser();
    const events = p.push(
      'event: battle_complete\ndata: {"battle_id":"b1","winner_bot_id":"bot_a","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n',
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('battle_complete');
    expect(events[0]?.data).toMatchObject({ battle_id: 'b1', winner_bot_id: 'bot_a' });
  });

  it('reassembles a frame split across two reads', () => {
    const p = new SseLineParser();
    const first = p.push('event: battle_complete\ndata: {"battle_id":"b1","winner_bo');
    expect(first).toHaveLength(0);
    const second = p.push('t_id":"bot_a","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n');
    expect(second).toHaveLength(1);
    expect(second[0]?.data).toMatchObject({ battle_id: 'b1', winner_bot_id: 'bot_a' });
  });

  it('handles multiple back-to-back events in one chunk', () => {
    const p = new SseLineParser();
    const events = p.push(
      'event: run_start\ndata: {"battle_id":"b1","input_id":1}\n\n' +
        'event: run_complete\ndata: {"battle_id":"b1","input_id":1}\n\n',
    );
    expect(events.map((e) => e.type)).toEqual(['run_start', 'run_complete']);
  });
});

describe('GlobalEventListener — known battle', () => {
  it('marks an in-flight battle complete from a battle_complete event', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await insertPending(t.db, {
      battle_id: 'bat_known_1',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      pair_key: 'bot_a:bot_b',
      initiator_user_id: 'u1',
      weight_class: null,
    });
    await markRunning(t.db, 'bat_known_1');

    let activeSource: FakeSseSource | null = null;
    const fetchImpl = makeFetchImpl({
      onStreamConnect: () => {
        const s = new FakeSseSource();
        activeSource = s;
        return s;
      },
    });

    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: true,
      fetchImpl,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    listener.start();
    try {
      // Wait for the connection to actually open before pushing a chunk.
      const source = await waitFor(() => activeSource);
      source.pushChunk(
        'event: battle_complete\n' +
          'data: {"battle_id":"bat_known_1","winner_bot_id":"bot_a","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n',
      );
      await waitForEvents(listener, 1);
      const row = await t.db.execute({
        sql: 'SELECT status, winner_bot_id, completed_at FROM recent_battles WHERE battle_id = ?',
        args: ['bat_known_1'],
      });
      expect(row.rows[0]?.['status']).toBe('complete');
      expect(row.rows[0]?.['winner_bot_id']).toBe('bot_a');
      expect(typeof row.rows[0]?.['completed_at']).toBe('string');
    } finally {
      await listener.stop();
    }

    expect(listener.eventsProcessed()).toBeGreaterThanOrEqual(1);
    expect(listener.lastEventAt()).not.toBeNull();
  });
});

describe('GlobalEventListener — unknown battle', () => {
  it('inserts a complete row by fetching /v1/battles/:id when no row existed', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    let battleFetches = 0;
    let activeSource: FakeSseSource | null = null;
    const fetchImpl = makeFetchImpl({
      onStreamConnect: () => {
        const s = new FakeSseSource();
        activeSource = s;
        return s;
      },
      onBattleFetch: (id) => {
        battleFetches += 1;
        return new Response(
          JSON.stringify({
            battle: {
              id,
              bot_a_id: 'bot_x',
              bot_b_id: 'bot_y',
              initiator_id: 'someone_else',
              status: 'complete',
              winner_bot_id: { String: 'bot_x', Valid: true },
              bot_a_wins: 1,
              bot_b_wins: 2,
              ties: 0,
              created_at: '2026-04-29T00:00:00Z',
              completed_at: { String: '2026-04-29T00:00:30Z', Valid: true },
            },
            runs: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: true,
      fetchImpl,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    listener.start();
    try {
      const source = await waitFor(() => activeSource);
      source.pushChunk(
        'event: battle_complete\n' +
          'data: {"battle_id":"bat_external_1","winner_bot_id":"bot_x","bot_a_wins":1,"bot_b_wins":2,"ties":0}\n\n',
      );
      await waitForEvents(listener, 1);
      // The dispatch awaits the upstream backfill before the counter
      // increments, so the row write is committed by the time we check.
      const row = await t.db.execute({
        sql: 'SELECT status, winner_bot_id, bot_a_id, bot_b_id, initiator_user_id FROM recent_battles WHERE battle_id = ?',
        args: ['bat_external_1'],
      });
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0]?.['status']).toBe('complete');
      expect(row.rows[0]?.['winner_bot_id']).toBe('bot_x');
      expect(row.rows[0]?.['bot_a_id']).toBe('bot_x');
      expect(row.rows[0]?.['bot_b_id']).toBe('bot_y');
      expect(row.rows[0]?.['initiator_user_id']).toBeNull();
      expect(battleFetches).toBe(1);
    } finally {
      await listener.stop();
    }
  });
});

describe('GlobalEventListener — idempotency', () => {
  it('replaying the same battle_complete twice is a no-op the second time', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await insertPending(t.db, {
      battle_id: 'bat_replay_1',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      pair_key: 'bot_a:bot_b',
      initiator_user_id: 'u1',
      weight_class: null,
    });
    await markRunning(t.db, 'bat_replay_1');

    let battleFetches = 0;
    let activeSource: FakeSseSource | null = null;
    const fetchImpl = makeFetchImpl({
      onStreamConnect: () => {
        const s = new FakeSseSource();
        activeSource = s;
        return s;
      },
      onBattleFetch: () => {
        battleFetches += 1;
        return new Response('{}', { status: 200 });
      },
    });

    const frame =
      'event: battle_complete\n' +
      'data: {"battle_id":"bat_replay_1","winner_bot_id":"bot_a","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n';

    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: true,
      fetchImpl,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    listener.start();
    try {
      const source = await waitFor(() => activeSource);
      source.pushChunk(frame);
      source.pushChunk(frame);
      await waitForEvents(listener, 2);
      const row = await t.db.execute({
        sql: 'SELECT status, winner_bot_id FROM recent_battles WHERE battle_id = ?',
        args: ['bat_replay_1'],
      });
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0]?.['status']).toBe('complete');
      // Replay path takes the "already complete" branch — no upstream
      // backfill should fire for an existing row.
      expect(battleFetches).toBe(0);
    } finally {
      await listener.stop();
    }
  });
});

describe('GlobalEventListener — reconnect on stream close', () => {
  it('reconnects after the upstream stream ends', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await insertPending(t.db, {
      battle_id: 'bat_reconnect_a',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      pair_key: 'bot_a:bot_b',
      initiator_user_id: 'u1',
      weight_class: null,
    });
    await markRunning(t.db, 'bat_reconnect_a');
    await insertPending(t.db, {
      battle_id: 'bat_reconnect_b',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      pair_key: 'bot_a:bot_b',
      initiator_user_id: 'u1',
      weight_class: null,
    });
    await markRunning(t.db, 'bat_reconnect_b');

    const sources: FakeSseSource[] = [];
    let connectCount = 0;
    const fetchImpl = makeFetchImpl({
      onStreamConnect: () => {
        connectCount += 1;
        const s = new FakeSseSource();
        sources.push(s);
        return s;
      },
    });

    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: true,
      fetchImpl,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    listener.start();
    try {
      // First connection: deliver one event, then close the stream so the
      // listener's reconnect loop fires.
      const first = await waitFor(() => sources[0]);
      first.pushChunk(
        'event: battle_complete\n' +
          'data: {"battle_id":"bat_reconnect_a","winner_bot_id":"bot_a","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n',
      );
      await waitForEvents(listener, 1);
      first.close();

      // Second connection (must be a fresh attempt) — deliver the second
      // event and assert the row is updated.
      const second = await waitFor(() => sources[1]);
      second.pushChunk(
        'event: battle_complete\n' +
          'data: {"battle_id":"bat_reconnect_b","winner_bot_id":"bot_b","bot_a_wins":1,"bot_b_wins":2,"ties":0}\n\n',
      );
      await waitForEvents(listener, 2);

      expect(connectCount).toBeGreaterThanOrEqual(2);
      const aRow = await t.db.execute({
        sql: 'SELECT status FROM recent_battles WHERE battle_id = ?',
        args: ['bat_reconnect_a'],
      });
      const bRow = await t.db.execute({
        sql: 'SELECT status FROM recent_battles WHERE battle_id = ?',
        args: ['bat_reconnect_b'],
      });
      expect(aRow.rows[0]?.['status']).toBe('complete');
      expect(bRow.rows[0]?.['status']).toBe('complete');
    } finally {
      await listener.stop();
    }
  });
});

// Slice D4 — battle_complete on a battle bound to a tournament_matches
// row triggers `orchestrator.advanceMatch` after the match's status is
// flipped to complete. Non-tournament battles still flow through the
// recent_battles update path without touching the orchestrator.
describe('GlobalEventListener — Slice D4 orchestrator advance', () => {
  it('battle_complete mapped to a tournament match calls orchestrator.advanceMatch with the row', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    // Seed a pending tournament + one in_flight match bound to a battle.
    const tournamentId = 'tour_listener_1';
    await recordTournament(t.db, {
      tournament_id: tournamentId,
      initiator_user_id: 'u1',
      participant_count: 4,
      bracket_size: 4,
      input_mode: 'flat_random',
      status: 'running',
    });
    await insertInitialMatches(t.db, tournamentId, [
      {
        match_id: 'm_r1_p0',
        round: 1,
        bracket_position: 0,
        bot_a_id: 'bot_alpha',
        bot_b_id: 'bot_beta',
        status: 'pending',
        winner_bot_id: null,
      },
      {
        match_id: 'm_r1_p1',
        round: 1,
        bracket_position: 1,
        bot_a_id: 'bot_gamma',
        bot_b_id: 'bot_delta',
        status: 'pending',
        winner_bot_id: null,
      },
    ]);
    const matchId = `${tournamentId}_m_r1_p0`;
    const battleId = 'bat_listener_1';

    await insertPending(t.db, {
      battle_id: battleId,
      bot_a_id: 'bot_alpha',
      bot_b_id: 'bot_beta',
      pair_key: 'bot_alpha:bot_beta',
      initiator_user_id: 'u1',
      weight_class: null,
    });
    await markRunning(t.db, battleId);
    await markInFlight(t.db, matchId, battleId, new Date().toISOString());

    const advanceCalls: TournamentMatchRow[] = [];
    const orchestrator = {
      advanceMatch: async (m: TournamentMatchRow): Promise<void> => {
        advanceCalls.push(m);
      },
    };

    let activeSource: FakeSseSource | null = null;
    const fetchImpl = makeFetchImpl({
      onStreamConnect: () => {
        const s = new FakeSseSource();
        activeSource = s;
        return s;
      },
    });

    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: true,
      fetchImpl,
      sleep: () => Promise.resolve(),
      random: () => 0,
      orchestrator,
    });
    listener.start();
    try {
      const source = await waitFor(() => activeSource);
      source.pushChunk(
        'event: battle_complete\n' +
          `data: {"battle_id":"${battleId}","winner_bot_id":"bot_alpha","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n`,
      );
      await waitForEvents(listener, 1);

      // Flush the dispatch handler's awaited db reads.
      await new Promise((r) => setTimeout(r, 10));

      // The match should be marked complete with the right winner.
      const row = await t.db.execute({
        sql: 'SELECT status, winner_bot_id FROM tournament_matches WHERE match_id = ?',
        args: [matchId],
      });
      expect(row.rows[0]?.['status']).toBe('complete');
      expect(row.rows[0]?.['winner_bot_id']).toBe('bot_alpha');

      // The orchestrator was called exactly once with the right row.
      expect(advanceCalls).toHaveLength(1);
      expect(advanceCalls[0]?.match_id).toBe(matchId);
      expect(advanceCalls[0]?.tournament_id).toBe(tournamentId);
      expect(advanceCalls[0]?.winner_bot_id).toBe('bot_alpha');
      expect(advanceCalls[0]?.status).toBe('complete');
    } finally {
      await listener.stop();
    }
  });

  it('battle_complete on a non-tournament battle does NOT call orchestrator.advanceMatch', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    // Insert a plain in-flight battle with no tournament_matches row.
    await insertPending(t.db, {
      battle_id: 'bat_plain_1',
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      pair_key: 'bot_a:bot_b',
      initiator_user_id: 'u1',
      weight_class: null,
    });
    await markRunning(t.db, 'bat_plain_1');

    const advanceCalls: TournamentMatchRow[] = [];
    const orchestrator = {
      advanceMatch: async (m: TournamentMatchRow): Promise<void> => {
        advanceCalls.push(m);
      },
    };

    let activeSource: FakeSseSource | null = null;
    const fetchImpl = makeFetchImpl({
      onStreamConnect: () => {
        const s = new FakeSseSource();
        activeSource = s;
        return s;
      },
    });

    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: true,
      fetchImpl,
      sleep: () => Promise.resolve(),
      random: () => 0,
      orchestrator,
    });
    listener.start();
    try {
      const source = await waitFor(() => activeSource);
      source.pushChunk(
        'event: battle_complete\n' +
          'data: {"battle_id":"bat_plain_1","winner_bot_id":"bot_a","bot_a_wins":2,"bot_b_wins":1,"ties":0}\n\n',
      );
      await waitForEvents(listener, 1);
      await new Promise((r) => setTimeout(r, 10));

      // Plain battle was marked complete.
      const row = await t.db.execute({
        sql: 'SELECT status FROM recent_battles WHERE battle_id = ?',
        args: ['bat_plain_1'],
      });
      expect(row.rows[0]?.['status']).toBe('complete');
      // Orchestrator never called — no tournament_matches row mapped.
      expect(advanceCalls).toHaveLength(0);
    } finally {
      await listener.stop();
    }
  });
});

describe('GlobalEventListener — RUN_LISTENER=false', () => {
  it('start() is a no-op and isRunning() stays false', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    let calls = 0;
    const fetchSpy: typeof fetch = ((..._args: Parameters<typeof fetch>) => {
      calls += 1;
      return Promise.resolve(new Response('', { status: 200 }));
    }) as typeof fetch;
    const listener = new GlobalEventListener({
      db: t.db,
      sortBotApiUrl: UPSTREAM,
      runListener: false,
      fetchImpl: fetchSpy,
      sleep: () => Promise.resolve(),
      random: () => 0,
    });
    listener.start();
    await new Promise((r) => setTimeout(r, 20));
    expect(listener.isRunning()).toBe(false);
    expect(listener.eventsProcessed()).toBe(0);
    expect(listener.lastEventAt()).toBeNull();
    expect(calls).toBe(0);
  });
});

// Poll until the supplier returns a truthy value (or times out). Keeps test
// flow deterministic without leaking microtask ordering details.
async function waitFor<T>(supplier: () => T | null | undefined, timeoutMs = 2_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = supplier();
    if (v) return v;
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: timed out');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}
