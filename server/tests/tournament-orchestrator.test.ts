// Slice D3 — TournamentOrchestrator core tests.
//
// Coverage matrix:
//   1. schedule() on a fresh tournament fires every R1 match upstream,
//      transitions matches to in_flight, populates recent_battles.
//   2. advanceMatch() on a non-final match sets winner, slots the next
//      round, and re-schedules when both slots are filled.
//   3. advanceMatch() on the final match marks the tournament complete.
//   4. End-to-end walk of a 4-bracket: schedule R1 → advance both R1
//      matches → schedule R2 → advance final → tournament complete with
//      the right champion.
//   5. End-to-end walk of a 6-bracket with byes: top-2 seeds carry
//      pre-set winners; schedule should advance them into R2 alongside
//      R1 winners, and the bracket walks to completion.
//   6. Failure: startBattle throws → match marked failed, tournament
//      marked failed.
//   7. Idempotency: calling advanceMatch on an already-complete match
//      is a no-op (no double-advance into the next round).

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TournamentOrchestrator } from '../src/orchestrator/tournament.js';
import { recordTournament } from '../src/store/recent-tournaments.js';
import {
  insertInitialMatches,
  listAllForTournament,
  getMatchById,
} from '../src/store/tournament-matches.js';
import { buildInitialBracket, type BracketSize } from '../src/synthesize/bracket.js';

import { makeTestApp } from './helpers/test-app.js';

import type { CreateBattleResponse, ApiInput } from '../src/clients/sort-bot-api/index.js';
import type { TournamentMatchRow } from '../src/store/tournament-matches.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeInputs(): ApiInput[] {
  // 6 inputs across all three size classes — covers escalation rounds
  // 1 (small), 2 (medium), and 3 (large).
  return [
    {
      id: 1,
      size_class: 'small',
      case_index: 0,
      array_len: 100,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      size_class: 'small',
      case_index: 1,
      array_len: 100,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 3,
      size_class: 'small',
      case_index: 2,
      array_len: 100,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 4,
      size_class: 'medium',
      case_index: 0,
      array_len: 1000,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 5,
      size_class: 'medium',
      case_index: 1,
      array_len: 1000,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 6,
      size_class: 'large',
      case_index: 0,
      array_len: 10000,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];
}

function mockUpstream(handlers: {
  battles?: (
    body: { bot_a: string; bot_b: string; input_ids?: number[] },
    battleId: string,
  ) => CreateBattleResponse;
}) {
  let battleCounter = 0;
  const captures: Array<{ bot_a: string; bot_b: string; input_ids: number[] }> = [];
  server.use(
    http.get(`${UPSTREAM}/v1/inputs`, () => HttpResponse.json({ inputs: makeInputs(), total: 6 })),
    http.post(`${UPSTREAM}/v1/battles`, async ({ request }) => {
      const body = (await request.json()) as { bot_a: string; bot_b: string; input_ids?: number[] };
      captures.push({
        bot_a: body.bot_a,
        bot_b: body.bot_b,
        input_ids: body.input_ids ?? [],
      });
      battleCounter += 1;
      const battleId = `bat_${battleCounter}`;
      const fn =
        handlers.battles ??
        ((b, id) => ({
          battle_id: id,
          bot_a: b.bot_a,
          bot_b: b.bot_b,
          input_ids: b.input_ids ?? [],
          status: 'running',
          created_at: new Date().toISOString(),
        }));
      return HttpResponse.json(fn(body, battleId));
    }),
  );
  return {
    battlesFired: () => battleCounter,
    captures: () => captures,
  };
}

async function setupTournament(opts: {
  bracketSize: BracketSize;
  inputMode?: 'flat_random' | 'escalation';
  participants?: string[];
}) {
  // Sign up via /api/v1/auth/signup so we have a real user row + an
  // encrypted api_key to decrypt back into 'sk_live_*'.
  server.use(
    http.post(`${UPSTREAM}/v1/users`, () =>
      HttpResponse.json({
        user_id: 'sba_user_1',
        display_name: 'Recon',
        api_key: 'sk_live_secret',
      }),
    ),
  );
  const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
  const signup = await t.app.request('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      display_name: 'Recon',
      email: 'recon@example.com',
      password: 'longenough123',
    }),
  });
  expect(signup.status).toBe(201);
  // Pull the user id we just created.
  const userRow = await t.db.execute('SELECT id FROM users LIMIT 1');
  const userId = (userRow.rows[0] as unknown as Record<string, unknown>)['id'] as string;

  const participants =
    opts.participants ?? Array.from({ length: opts.bracketSize }, (_, i) => `bot_${i + 1}`);
  const tournamentId = `tour_${opts.bracketSize}_${Date.now()}`;
  await recordTournament(t.db, {
    tournament_id: tournamentId,
    initiator_user_id: userId,
    participant_count: opts.bracketSize,
    bracket_size: opts.bracketSize,
    input_mode: opts.inputMode ?? 'flat_random',
    status: 'running',
  });
  const initial = buildInitialBracket(participants, opts.bracketSize);
  await insertInitialMatches(t.db, tournamentId, initial);

  // Use the real decryptString via sessionSecret. Production wires it
  // identically; tests exercise the full path so a regression in
  // encryption surfaces here.
  const { decryptString } = await import('../src/auth/encrypt.js');
  const orchestrator = new TournamentOrchestrator({
    db: t.db,
    sortBotApi: t.sortBotApi,
    decryptKey: (blob) => decryptString(blob, t.sessionSecret),
  });

  return { t, tournamentId, participants, orchestrator, userId };
}

async function getMatch(
  t: Awaited<ReturnType<typeof makeTestApp>>,
  tournamentId: string,
  round: number,
  position: number,
): Promise<TournamentMatchRow> {
  const all = await listAllForTournament(t.db, tournamentId);
  const m = all.find((row) => row.round === round && row.bracket_position === position);
  if (!m) throw new Error(`no match at round=${round} position=${position}`);
  return m;
}

describe('TournamentOrchestrator.schedule — fresh 4-bracket', () => {
  it('fires every R1 match upstream, transitions matches to in_flight, populates recent_battles', async () => {
    const upstream = mockUpstream({});
    const { t, tournamentId, orchestrator } = await setupTournament({ bracketSize: 4 });

    await orchestrator.schedule(tournamentId);

    expect(upstream.battlesFired()).toBe(2);

    const matches = await listAllForTournament(t.db, tournamentId);
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(2);
    for (const m of r1) {
      expect(m.status).toBe('in_flight');
      expect(m.battle_id).toMatch(/^bat_/);
      expect(m.scheduled_at).not.toBeNull();
    }

    const battles = await t.db.execute('SELECT battle_id, status FROM recent_battles');
    expect(battles.rows).toHaveLength(2);
    for (const row of battles.rows) {
      expect((row as unknown as Record<string, unknown>)['status']).toBe('running');
    }
  });

  it('escalation mode passes only small-class input ids to round 1 battles', async () => {
    const upstream = mockUpstream({});
    const { tournamentId, orchestrator } = await setupTournament({
      bracketSize: 4,
      inputMode: 'escalation',
    });
    await orchestrator.schedule(tournamentId);
    const captures = upstream.captures();
    expect(captures).toHaveLength(2);
    for (const c of captures) {
      expect(c.input_ids).toHaveLength(3);
      // Round 1 escalation → small-class only (ids 1-3).
      for (const id of c.input_ids) {
        expect([1, 2, 3]).toContain(id);
      }
    }
  });
});

describe('TournamentOrchestrator.advanceMatch — non-final match', () => {
  it('marks the match complete, slots winner into next round; schedules when both slots filled', async () => {
    const upstream = mockUpstream({});
    const { t, tournamentId, orchestrator } = await setupTournament({ bracketSize: 4 });

    await orchestrator.schedule(tournamentId);

    const r1m0 = await getMatch(t, tournamentId, 1, 0);
    const r1m1 = await getMatch(t, tournamentId, 1, 1);

    // Advance R1 match 0: winner = bot_a_id of that match.
    await orchestrator.advanceMatch({ ...r1m0, winner_bot_id: r1m0.bot_a_id });

    const r1m0After = await getMatchById(t.db, r1m0.match_id);
    expect(r1m0After?.status).toBe('complete');
    expect(r1m0After?.winner_bot_id).toBe(r1m0.bot_a_id);

    // R2 row exists with winner in slot a (bracket_position 0 → slot a).
    let r2 = await getMatch(t, tournamentId, 2, 0);
    expect(r2.bot_a_id).toBe(r1m0.bot_a_id);
    expect(r2.bot_b_id).toBeNull();
    expect(r2.status).toBe('pending');
    // Battles fired count is still 2 (R2 not ready yet).
    expect(upstream.battlesFired()).toBe(2);

    // Advance R1 match 1: winner = bot_a_id. R2 should now be in_flight.
    await orchestrator.advanceMatch({ ...r1m1, winner_bot_id: r1m1.bot_a_id });
    r2 = await getMatch(t, tournamentId, 2, 0);
    expect(r2.bot_a_id).toBe(r1m0.bot_a_id);
    expect(r2.bot_b_id).toBe(r1m1.bot_a_id);
    expect(r2.status).toBe('in_flight');
    expect(upstream.battlesFired()).toBe(3);
  });
});

describe('TournamentOrchestrator.advanceMatch — final match', () => {
  it('marks the tournament complete with the champion', async () => {
    mockUpstream({});
    const { t, tournamentId, orchestrator } = await setupTournament({ bracketSize: 4 });

    await orchestrator.schedule(tournamentId);
    const r1m0 = await getMatch(t, tournamentId, 1, 0);
    const r1m1 = await getMatch(t, tournamentId, 1, 1);
    await orchestrator.advanceMatch({ ...r1m0, winner_bot_id: r1m0.bot_a_id });
    await orchestrator.advanceMatch({ ...r1m1, winner_bot_id: r1m1.bot_a_id });
    const r2 = await getMatch(t, tournamentId, 2, 0);
    expect(r2.status).toBe('in_flight');

    // Final match → r1m0's bot_a wins it.
    const champion = r1m0.bot_a_id!;
    await orchestrator.advanceMatch({ ...r2, winner_bot_id: champion });

    const tour = await t.db.execute({
      sql: 'SELECT status, winner_bot_id, completed_at FROM recent_tournaments WHERE tournament_id = ?',
      args: [tournamentId],
    });
    const row = tour.rows[0] as unknown as Record<string, unknown>;
    expect(row['status']).toBe('complete');
    expect(row['winner_bot_id']).toBe(champion);
    expect(typeof row['completed_at']).toBe('string');
  });
});

describe('TournamentOrchestrator — 4-bracket walk to completion', () => {
  it('schedule → advance R1s → schedule R2 → advance final → champion persisted', async () => {
    mockUpstream({});
    const { t, tournamentId, orchestrator } = await setupTournament({ bracketSize: 4 });

    await orchestrator.schedule(tournamentId);
    // Pick the bot_a side for every match — deterministic.
    const r1m0 = await getMatch(t, tournamentId, 1, 0);
    const r1m1 = await getMatch(t, tournamentId, 1, 1);
    await orchestrator.advanceMatch({ ...r1m0, winner_bot_id: r1m0.bot_a_id });
    await orchestrator.advanceMatch({ ...r1m1, winner_bot_id: r1m1.bot_a_id });
    const r2 = await getMatch(t, tournamentId, 2, 0);
    const champion = r1m0.bot_a_id!;
    await orchestrator.advanceMatch({ ...r2, winner_bot_id: champion });

    const tour = await t.db.execute({
      sql: 'SELECT status, winner_bot_id FROM recent_tournaments WHERE tournament_id = ?',
      args: [tournamentId],
    });
    expect((tour.rows[0] as unknown as Record<string, unknown>)['status']).toBe('complete');
    expect((tour.rows[0] as unknown as Record<string, unknown>)['winner_bot_id']).toBe(champion);

    // Every match row should be terminal (complete).
    const all = await listAllForTournament(t.db, tournamentId);
    for (const m of all) {
      expect(m.status).toBe('complete');
    }
  });
});

describe('TournamentOrchestrator — 6-bracket with byes', () => {
  it('top-2 seeds auto-advance via byes; bracket geometry pairs them in R2 m0; bracket walks to completion', async () => {
    const upstream = mockUpstream({});
    const { t, tournamentId, orchestrator, participants } = await setupTournament({
      bracketSize: 6,
    });

    await orchestrator.schedule(tournamentId);

    // R1 byes auto-complete on schedule().
    const r1Byes = (await listAllForTournament(t.db, tournamentId)).filter(
      (m) => m.round === 1 && m.bracket_position < 2,
    );
    expect(r1Byes).toHaveLength(2);
    for (const b of r1Byes) {
      expect(b.status).toBe('complete');
      expect(b.winner_bot_id).toBe(b.bot_a_id);
    }

    // Bracket geometry: R1 positions 0+1 fold into R2 position 0
    // (slot a + slot b), so the top-2 seeds end up paired. R2 m0 is
    // therefore ready immediately and fires alongside the 2 R1
    // play-ins → 3 upstream battles after the first schedule().
    expect(upstream.battlesFired()).toBe(3);
    const r2m0 = await getMatch(t, tournamentId, 2, 0);
    expect(r2m0.bot_a_id).toBe(participants[0]); // top seed
    expect(r2m0.bot_b_id).toBe(participants[1]); // second seed
    expect(r2m0.status).toBe('in_flight');

    // R2 m1 is created lazily when its first parent advances; before
    // any R1 play-in resolves it does not exist yet.
    const allBefore = await listAllForTournament(t.db, tournamentId);
    expect(allBefore.find((m) => m.round === 2 && m.bracket_position === 1)).toBeUndefined();

    // Advance R2 m0 (top seed wins).
    const topSeed = participants[0]!;
    await orchestrator.advanceMatch({ ...r2m0, winner_bot_id: topSeed });

    // Advance both R1 play-ins.
    const r1m2 = await getMatch(t, tournamentId, 1, 2);
    const r1m3 = await getMatch(t, tournamentId, 1, 3);
    await orchestrator.advanceMatch({ ...r1m2, winner_bot_id: r1m2.bot_a_id });
    await orchestrator.advanceMatch({ ...r1m3, winner_bot_id: r1m3.bot_a_id });

    // R2 m1 now ready and fired.
    expect(upstream.battlesFired()).toBe(4);
    const r2m1After = await getMatch(t, tournamentId, 2, 1);
    expect(r2m1After.status).toBe('in_flight');

    // Advance R2 m1.
    await orchestrator.advanceMatch({
      ...r2m1After,
      winner_bot_id: r2m1After.bot_a_id,
    });

    // R3 (final) fires.
    expect(upstream.battlesFired()).toBe(5);
    const r3 = await getMatch(t, tournamentId, 3, 0);
    await orchestrator.advanceMatch({ ...r3, winner_bot_id: topSeed });

    const tour = await t.db.execute({
      sql: 'SELECT status, winner_bot_id FROM recent_tournaments WHERE tournament_id = ?',
      args: [tournamentId],
    });
    expect((tour.rows[0] as unknown as Record<string, unknown>)['status']).toBe('complete');
    expect((tour.rows[0] as unknown as Record<string, unknown>)['winner_bot_id']).toBe(topSeed);
  });
});

describe('TournamentOrchestrator — failure mode', () => {
  it('startBattle throws → match marked failed → tournament marked failed', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/inputs`, () =>
        HttpResponse.json({ inputs: makeInputs(), total: 6 }),
      ),
      http.post(`${UPSTREAM}/v1/battles`, () =>
        HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
      ),
    );
    const { t, tournamentId, orchestrator } = await setupTournament({ bracketSize: 4 });
    // schedule() rethrows the upstream error after marking the
    // tournament failed; tests catch it so we can assert state.
    await orchestrator.schedule(tournamentId).catch(() => undefined);

    const tour = await t.db.execute({
      sql: 'SELECT status FROM recent_tournaments WHERE tournament_id = ?',
      args: [tournamentId],
    });
    expect((tour.rows[0] as unknown as Record<string, unknown>)['status']).toBe('failed');

    // At least one match should be marked failed.
    const all = await listAllForTournament(t.db, tournamentId);
    const failed = all.filter((m) => m.status === 'failed');
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });
});

describe('TournamentOrchestrator — idempotency', () => {
  it('advanceMatch on an already-complete match is a no-op (no double advance)', async () => {
    mockUpstream({});
    const { t, tournamentId, orchestrator } = await setupTournament({ bracketSize: 4 });
    await orchestrator.schedule(tournamentId);

    const r1m0 = await getMatch(t, tournamentId, 1, 0);
    const winner = r1m0.bot_a_id!;
    await orchestrator.advanceMatch({ ...r1m0, winner_bot_id: winner });

    // Snapshot R2's slot a.
    const r2Before = await getMatch(t, tournamentId, 2, 0);
    expect(r2Before.bot_a_id).toBe(winner);

    // Replay the same advanceMatch with a different (bogus) winner —
    // since the match is already complete, the call must short-circuit
    // and NOT alter R2.
    await orchestrator.advanceMatch({ ...r1m0, winner_bot_id: 'bot_imposter' });

    const r2After = await getMatch(t, tournamentId, 2, 0);
    expect(r2After.bot_a_id).toBe(winner);
    expect(r2After.bot_b_id).toBeNull();

    // Verify only one R2 row exists (no duplicate creation).
    const r2Rows = (await listAllForTournament(t.db, tournamentId)).filter(
      (m) => m.round === 2 && m.bracket_position === 0,
    );
    expect(r2Rows).toHaveLength(1);
  });
});
