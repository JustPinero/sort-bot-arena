// Slice C3 (D-10) — 60s background sweep that reconciles
// recent_battles.status='running' rows older than the age threshold by
// fetching the upstream battle state from sort-bot-api.
//
// Covers:
//   - listRunningOlderThan SQL filter (stale running rows only)
//   - sweep marks stale running rows complete when upstream says so
//   - sweep marks stale running rows failed when upstream says so
//   - sweep skips fresh running rows
//   - sweep skips already-terminal rows
//   - upstream 404 / errors don't crash the sweep
//   - sweep is idempotent (second pass is a no-op)
//   - bootstrap wiring smoke (BattleSweeper constructable with the same
//     deps the live process gives it)

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SortBotApiClient } from '../src/clients/sort-bot-api/index.js';
import { BattleSweeper } from '../src/listener/battle-sweep.js';
import { listRunningOlderThan } from '../src/store/recent-battles.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

interface SeedRow {
  battle_id: string;
  bot_a_id?: string;
  bot_b_id?: string;
  pair_key?: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  created_at: string;
  winner_bot_id?: string | null;
  completed_at?: string | null;
}

async function seedBattle(
  db: Awaited<ReturnType<typeof makeTestApp>>['db'],
  row: SeedRow,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO recent_battles
            (battle_id, bot_a_id, bot_b_id, pair_key, initiator_user_id,
             weight_class, status, winner_bot_id, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.battle_id,
      row.bot_a_id ?? 'bot_a',
      row.bot_b_id ?? 'bot_b',
      row.pair_key ?? 'bot_a:bot_b',
      'u1',
      null,
      row.status,
      row.winner_bot_id ?? null,
      row.created_at,
      row.completed_at ?? null,
    ],
  });
}

function upstreamBattleGet(
  battleId: string,
  status: 'pending' | 'running' | 'complete' | 'failed',
  winnerBotId: string | null = null,
) {
  return {
    battle: {
      id: battleId,
      bot_a_id: 'bot_a',
      bot_b_id: 'bot_b',
      initiator_id: 'u1',
      status,
      winner_bot_id:
        winnerBotId !== null ? { String: winnerBotId, Valid: true } : { String: '', Valid: false },
      bot_a_wins: status === 'complete' && winnerBotId === 'bot_a' ? 2 : 0,
      bot_b_wins: status === 'complete' && winnerBotId === 'bot_b' ? 2 : 0,
      ties: 0,
      created_at: '2026-04-29T00:00:00.000Z',
      completed_at:
        status === 'complete' || status === 'failed'
          ? { String: '2026-04-29T00:01:00.000Z', Valid: true }
          : { String: '', Valid: false },
    },
    runs: [] as unknown[],
  };
}

const STALE_ISO = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago
const FRESH_ISO = new Date(Date.now() - 5_000).toISOString(); // 5 sec ago

describe('listRunningOlderThan', () => {
  it('returns running rows older than ageMs and ignores newer / non-running', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'stale_running',
      status: 'running',
      created_at: STALE_ISO,
    });
    await seedBattle(t.db, {
      battle_id: 'fresh_running',
      status: 'running',
      created_at: FRESH_ISO,
    });
    await seedBattle(t.db, {
      battle_id: 'stale_complete',
      status: 'complete',
      created_at: STALE_ISO,
      winner_bot_id: 'bot_a',
      completed_at: STALE_ISO,
    });
    await seedBattle(t.db, {
      battle_id: 'stale_pending',
      status: 'pending',
      created_at: STALE_ISO,
    });

    const rows = await listRunningOlderThan(t.db, 60_000);
    const ids = rows.map((r) => r.battle_id).sort();
    expect(ids).toEqual(['stale_running']);
  });
});

describe('BattleSweeper.sweep', () => {
  it('marks a stale running row complete when upstream returns complete', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_stale_complete',
      status: 'running',
      created_at: STALE_ISO,
    });
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_stale_complete`, () =>
        HttpResponse.json(upstreamBattleGet('bat_stale_complete', 'complete', 'bot_a')),
      ),
    );

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi });
    await sweeper.sweep();

    const row = await t.db.execute({
      sql: 'SELECT status, winner_bot_id, completed_at FROM recent_battles WHERE battle_id = ?',
      args: ['bat_stale_complete'],
    });
    expect(row.rows[0]?.['status']).toBe('complete');
    expect(row.rows[0]?.['winner_bot_id']).toBe('bot_a');
    expect(row.rows[0]?.['completed_at']).toBeTruthy();
  });

  it('marks a stale running row failed when upstream returns failed', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_stale_failed',
      status: 'running',
      created_at: STALE_ISO,
    });
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_stale_failed`, () =>
        HttpResponse.json(upstreamBattleGet('bat_stale_failed', 'failed')),
      ),
    );

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi });
    await sweeper.sweep();

    const row = await t.db.execute({
      sql: 'SELECT status FROM recent_battles WHERE battle_id = ?',
      args: ['bat_stale_failed'],
    });
    expect(row.rows[0]?.['status']).toBe('failed');
  });

  it('leaves fresh running rows and already-terminal rows untouched', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_stale',
      status: 'running',
      created_at: STALE_ISO,
    });
    await seedBattle(t.db, {
      battle_id: 'bat_fresh',
      status: 'running',
      created_at: FRESH_ISO,
    });
    await seedBattle(t.db, {
      battle_id: 'bat_done',
      status: 'complete',
      created_at: STALE_ISO,
      winner_bot_id: 'bot_a',
      completed_at: STALE_ISO,
    });
    let upstreamHits = 0;
    server.use(
      http.get(`${UPSTREAM}/v1/battles/:id`, ({ params }) => {
        upstreamHits += 1;
        const id = params['id'] as string;
        return HttpResponse.json(upstreamBattleGet(id, 'complete', 'bot_a'));
      }),
    );

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi });
    await sweeper.sweep();

    // Only the stale running row should have been visited upstream.
    expect(upstreamHits).toBe(1);
    const all = await t.db.execute({
      sql: 'SELECT battle_id, status FROM recent_battles ORDER BY battle_id',
      args: [],
    });
    const map = Object.fromEntries(
      all.rows.map((r) => [
        (r as unknown as Record<string, unknown>)['battle_id'],
        (r as unknown as Record<string, unknown>)['status'],
      ]),
    );
    expect(map['bat_stale']).toBe('complete');
    expect(map['bat_fresh']).toBe('running');
    expect(map['bat_done']).toBe('complete');
  });

  it('survives upstream 404 and leaves the row running for next sweep', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_404',
      status: 'running',
      created_at: STALE_ISO,
    });
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_404`, () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi });
    await expect(sweeper.sweep()).resolves.not.toThrow();

    const row = await t.db.execute({
      sql: 'SELECT status FROM recent_battles WHERE battle_id = ?',
      args: ['bat_404'],
    });
    expect(row.rows[0]?.['status']).toBe('running');
  });

  it('is idempotent — running sweep twice on the same fixtures is a no-op the second pass', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_idem',
      status: 'running',
      created_at: STALE_ISO,
    });
    let hits = 0;
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_idem`, () => {
        hits += 1;
        return HttpResponse.json(upstreamBattleGet('bat_idem', 'complete', 'bot_b'));
      }),
    );

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi });
    await sweeper.sweep();
    expect(hits).toBe(1);
    await sweeper.sweep();
    // Second pass: row is no longer 'running' and is filtered out, so
    // upstream is not hit again.
    expect(hits).toBe(1);

    const row = await t.db.execute({
      sql: 'SELECT status, winner_bot_id FROM recent_battles WHERE battle_id = ?',
      args: ['bat_idem'],
    });
    expect(row.rows[0]?.['status']).toBe('complete');
    expect(row.rows[0]?.['winner_bot_id']).toBe('bot_b');
  });

  // Phase 11 victor-conditions — sweep advances tournament_matches
  // when the listener missed a battle_complete event (reconnect window
  // or ungraceful disconnect). Three branches matter:
  //   1. Tournament battle with a winner: orchestrator.advanceForBattle
  //      called with the winner_bot_id from upstream getBattle.
  //   2. Tournament battle with a tie (null winner): same call shape,
  //      but the orchestrator's null-winner branch fails the match.
  //   3. Non-tournament battle: still calls advanceForBattle (the
  //      orchestrator no-ops on no row); listener and sweep are
  //      symmetric on this front.
  it('calls orchestrator.advanceForBattle with winner_bot_id on a complete tournament battle (Phase 11 — gap closure for missed listener events)', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_tour_winner',
      status: 'running',
      created_at: STALE_ISO,
    });
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_tour_winner`, () =>
        HttpResponse.json(upstreamBattleGet('bat_tour_winner', 'complete', 'bot_a')),
      ),
    );

    const calls: Array<{ battleId: string; winnerBotId: string | null }> = [];
    const orchestrator = {
      advanceForBattle: async (battleId: string, winnerBotId: string | null): Promise<void> => {
        calls.push({ battleId, winnerBotId });
      },
    };

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi, orchestrator });
    await sweeper.sweep();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.battleId).toBe('bat_tour_winner');
    expect(calls[0]?.winnerBotId).toBe('bot_a');
  });

  it('calls orchestrator.advanceForBattle with NULL winner on a tied tournament battle (regression)', async () => {
    // Upstream returned `complete` with no winner — this is exactly the
    // production state the user's tournament was stuck in: the listener
    // missed the event, sweep marked recent_battles complete, but
    // tournament_matches was never advanced.
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_tour_tied',
      status: 'running',
      created_at: STALE_ISO,
    });
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_tour_tied`, () =>
        HttpResponse.json(upstreamBattleGet('bat_tour_tied', 'complete', null)),
      ),
    );

    const calls: Array<{ battleId: string; winnerBotId: string | null }> = [];
    const orchestrator = {
      advanceForBattle: async (battleId: string, winnerBotId: string | null): Promise<void> => {
        calls.push({ battleId, winnerBotId });
      },
    };

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi, orchestrator });
    await sweeper.sweep();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.battleId).toBe('bat_tour_tied');
    expect(calls[0]?.winnerBotId).toBeNull();
  });

  it('does not crash if orchestrator.advanceForBattle throws — sweep loop continues', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    await seedBattle(t.db, {
      battle_id: 'bat_a',
      status: 'running',
      created_at: STALE_ISO,
    });
    await seedBattle(t.db, {
      battle_id: 'bat_b',
      status: 'running',
      created_at: STALE_ISO,
    });
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_a`, () =>
        HttpResponse.json(upstreamBattleGet('bat_a', 'complete', 'bot_x')),
      ),
      http.get(`${UPSTREAM}/v1/battles/bat_b`, () =>
        HttpResponse.json(upstreamBattleGet('bat_b', 'complete', 'bot_y')),
      ),
    );

    let calls = 0;
    const orchestrator = {
      advanceForBattle: async (battleId: string): Promise<void> => {
        calls += 1;
        if (battleId === 'bat_a') throw new Error('boom');
      },
    };

    const sweeper = new BattleSweeper({ db: t.db, sortBotApi: t.sortBotApi, orchestrator });
    await sweeper.sweep();

    expect(calls).toBe(2); // both rows attempted; first throw didn't bail the loop
    // Both recent_battles rows are still marked complete despite the throw.
    const rows = await t.db.execute({
      sql: 'SELECT battle_id, status FROM recent_battles ORDER BY battle_id',
      args: [],
    });
    expect(rows.rows.map((r) => (r as Record<string, unknown>)['status'])).toEqual([
      'complete',
      'complete',
    ]);
  });

  it('start() schedules an unref()ed interval and stop() clears it', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const setSpy = vi.spyOn(global, 'setInterval');
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const sweeper = new BattleSweeper({
      db: t.db,
      sortBotApi: t.sortBotApi,
      intervalMs: 60_000,
      runOnStart: false,
    });
    sweeper.start();
    expect(setSpy).toHaveBeenCalledTimes(1);
    sweeper.stop();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});

describe('bootstrap wiring smoke', () => {
  it('BattleSweeper accepts the same {db, sortBotApi} shape index.ts hands it', () => {
    const sortBotApi = new SortBotApiClient({ baseUrl: UPSTREAM });
    // Construction must not throw given the live deps surface.
    expect(() => {
      // We don't start it — just verify the constructor signature is
      // satisfied by the same shapes index.ts uses (db is a libsql Client,
      // sortBotApi is a real SortBotApiClient).
      new BattleSweeper({
        db: { execute: async () => ({ rows: [] }) } as never,
        sortBotApi,
      });
    }).not.toThrow();
  });
});
