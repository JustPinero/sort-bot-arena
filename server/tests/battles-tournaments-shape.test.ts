import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  BattleStrictSchema,
  CursorPageSchema,
  TournamentStrictSchema,
} from '../../src/api/schemas.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const botA = {
  id: 'bot_a',
  user_id: 'u1',
  display_name: 'Alpha Bot',
  language: 'python',
  source_size_bytes: 100,
  source_sha256: 'sha_a',
  status: 'evaluated',
  submitted_at: 'T0',
  evaluation_completed_at: 'T1',
};

const botB = {
  id: 'bot_b',
  user_id: 'u2',
  display_name: 'Bravo Bot',
  language: 'node',
  source_size_bytes: 200,
  source_sha256: 'sha_b',
  status: 'evaluated',
  submitted_at: 'T0',
  evaluation_completed_at: 'T1',
};

const battleFixture = {
  battle: {
    id: 'bat_1',
    bot_a_id: 'bot_a',
    bot_b_id: 'bot_b',
    initiator_id: 'u1',
    status: 'complete',
    winner_bot_id: { String: 'bot_a', Valid: true },
    bot_a_wins: 2,
    bot_b_wins: 1,
    ties: 0,
    created_at: '2026-04-29T00:00:00Z',
    completed_at: { String: '2026-04-29T00:05:00Z', Valid: true },
  },
  runs: [
    {
      id: 1,
      battle_id: 'bat_1',
      input_id: 5,
      bot_a_duration_ms: { Int64: 100, Valid: true },
      bot_b_duration_ms: { Int64: 150, Valid: true },
      bot_a_status: 'success',
      bot_b_status: 'success',
      winner_bot_id: { String: 'bot_a', Valid: true },
      completed_at: '2026-04-29T00:01:00Z',
    },
    {
      id: 2,
      battle_id: 'bat_1',
      input_id: 6,
      bot_a_duration_ms: { Int64: 200, Valid: true },
      bot_b_duration_ms: { Int64: 100, Valid: true },
      bot_a_status: 'success',
      bot_b_status: 'success',
      winner_bot_id: { String: 'bot_b', Valid: true },
      completed_at: '2026-04-29T00:02:00Z',
    },
    {
      id: 3,
      battle_id: 'bat_1',
      input_id: 7,
      bot_a_duration_ms: { Int64: 80, Valid: true },
      bot_b_duration_ms: { Int64: 90, Valid: true },
      bot_a_status: 'success',
      bot_b_status: 'success',
      winner_bot_id: { String: 'bot_a', Valid: true },
      completed_at: '2026-04-29T00:03:00Z',
    },
  ],
};

describe('GET /api/v1/battles', () => {
  it('returns an empty cursor page', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles');
    expect(res.status).toBe(200);
    const parsed = CursorPageSchema(BattleStrictSchema).parse(await res.json());
    expect(parsed.items).toEqual([]);
    expect(parsed.next_cursor).toBeNull();
  });
});

describe('GET /api/v1/battles/:id', () => {
  it('returns the rich Battle shape with both fighters resolved', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_1`, () => HttpResponse.json(battleFixture)),
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles/bat_1');
    expect(res.status).toBe(200);
    const parsed = BattleStrictSchema.parse(await res.json());

    expect(parsed.id).toBe('bat_1');
    expect(parsed.status).toBe('completed');
    expect(parsed.rounds_total).toBe(3);
    expect(parsed.current_round).toBe(3);
    expect(parsed.winner_bot_id).toBe('bot_a');
    expect(parsed.outcome).toBe('decision');
    expect(parsed.scheduled_at).toBe('2026-04-29T00:00:00Z');
    expect(parsed.completed_at).toBe('2026-04-29T00:05:00Z');

    expect(parsed.fighter_a.bot_id).toBe('bot_a');
    expect(parsed.fighter_a.corner).toBe('red');
    expect(parsed.fighter_a.display_name).toBe('Alpha Bot');
    expect(parsed.fighter_a.nickname).toBeTruthy();
    expect(parsed.fighter_b.bot_id).toBe('bot_b');
    expect(parsed.fighter_b.corner).toBe('blue');
    expect(parsed.fighter_b.display_name).toBe('Bravo Bot');
  });

  it('404s when upstream 404s', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/battles/missing`, () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles/missing');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/battles/:id/events (mounting order sanity)', () => {
  it('still routes to the SSE handler after the new battles routes are mounted', async () => {
    // Don't actually consume the stream — just verify the route resolves.
    // The SSE handler will try to fetch upstream; we stub an empty stream.
    server.use(
      http.get(
        `${UPSTREAM}/v1/battles/bat_sse/events`,
        () => new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } }),
      ),
      http.get(`${UPSTREAM}/v1/battles/bat_sse`, () =>
        HttpResponse.json({
          battle: {
            id: 'bat_sse',
            bot_a_id: 'bot_a',
            bot_b_id: 'bot_b',
            initiator_id: 'u1',
            status: 'complete',
            winner_bot_id: { String: 'bot_a', Valid: true },
            bot_a_wins: 1,
            bot_b_wins: 0,
            ties: 0,
            created_at: 'T',
            completed_at: { String: 'T+1', Valid: true },
          },
          runs: [],
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles/bat_sse/events');
    expect(res.status).not.toBe(404);
    expect(res.status).toBeLessThan(500);
  });
});

describe('GET /api/v1/tournaments', () => {
  it('returns an empty cursor page', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/tournaments');
    expect(res.status).toBe(200);
    const parsed = CursorPageSchema(TournamentStrictSchema).parse(await res.json());
    expect(parsed.items).toEqual([]);
    expect(parsed.next_cursor).toBeNull();
  });
});

describe('GET /api/v1/tournaments/:id', () => {
  it('returns the rich Tournament shape with participants and matches mapped', async () => {
    const tournamentFixture = {
      tournament: {
        id: 'tour_357ebddb20442ac59c297d7ea421da97',
        initiator_id: 'u1',
        status: 'running',
        participant_count: 2,
        winner_bot_id: { String: '', Valid: false },
        created_at: '2026-04-29T00:00:00Z',
        completed_at: { String: '', Valid: false },
      },
      matches: [
        {
          id: 1,
          tournament_id: 'tour_357ebddb20442ac59c297d7ea421da97',
          round: 1,
          bracket_position: 0,
          bot_a_id: { String: 'bot_a', Valid: true },
          bot_b_id: { String: 'bot_b', Valid: true },
          winner_bot_id: { String: 'bot_a', Valid: true },
          battle_id: { String: 'bat_1', Valid: true },
          completed_at: { String: '2026-04-29T00:05:00Z', Valid: true },
        },
        {
          id: 2,
          tournament_id: 'tour_357ebddb20442ac59c297d7ea421da97',
          round: 2,
          bracket_position: 0,
          bot_a_id: { String: 'bot_a', Valid: true },
          bot_b_id: { String: '', Valid: false },
          winner_bot_id: { String: '', Valid: false },
          battle_id: { String: '', Valid: false },
          completed_at: { String: '', Valid: false },
        },
      ],
    };

    server.use(
      http.get(`${UPSTREAM}/v1/tournaments/tour_357ebddb20442ac59c297d7ea421da97`, () =>
        HttpResponse.json(tournamentFixture),
      ),
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
    );

    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/tournaments/tour_357ebddb20442ac59c297d7ea421da97');
    expect(res.status).toBe(200);
    const parsed = TournamentStrictSchema.parse(await res.json());

    expect(parsed.id).toBe('tour_357ebddb20442ac59c297d7ea421da97');
    expect(parsed.status).toBe('active');
    expect(parsed.name).toBe('Tournament tour_357');
    expect(parsed.rounds_total).toBe(2);
    expect(parsed.current_round).toBe(1);
    expect(parsed.scheduled_at).toBe('2026-04-29T00:00:00Z');
    expect(parsed.weight_class_filter).toBeNull();
    expect(parsed.prize_description).toBeNull();
    expect(parsed.champion_bot_id).toBeNull();

    expect(parsed.participants).toHaveLength(2);
    const participantIds = parsed.participants.map((p) => p.bot_id).sort();
    expect(participantIds).toEqual(['bot_a', 'bot_b']);
    for (const p of parsed.participants) {
      expect(p.nickname).toBeTruthy();
      expect(p.display_name).toBeTruthy();
    }

    expect(parsed.matches).toHaveLength(2);
    expect(parsed.matches[0]).toMatchObject({
      id: '1',
      round: 1,
      position: 0,
      fighter_a_bot_id: 'bot_a',
      fighter_b_bot_id: 'bot_b',
      winner_bot_id: 'bot_a',
      status: 'completed',
      battle_id: 'bat_1',
    });
    expect(parsed.matches[1]).toMatchObject({
      id: '2',
      round: 2,
      position: 0,
      fighter_a_bot_id: 'bot_a',
      fighter_b_bot_id: null,
      winner_bot_id: null,
      status: 'bye',
      battle_id: null,
    });
  });
});

// Slice D5 — when a row exists in `recent_tournaments` (i.e. the
// tournament was created via our POST handler post-D4), the GET handler
// reads from our DB instead of upstream. This tests the new path:
// match status mapping, current_round computation, rounds_total derived
// from bracket_size, and bye row rendering.
describe('GET /api/v1/tournaments/:id — Slice D5 our-DB-driven path', () => {
  it('reads from recent_tournaments + tournament_matches and maps match status correctly', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    // Seed our DB directly. recordTournament + insertInitialMatches
    // mirror what the POST handler does; we skip the HTTP path so the
    // test is focused on the GET path's read shape.
    const { recordTournament } = await import('../src/store/recent-tournaments.js');
    const { insertInitialMatches, markInFlight, markComplete } =
      await import('../src/store/tournament-matches.js');

    const tid = 'tour_d5_test_001';
    await recordTournament(t.db, {
      tournament_id: tid,
      initiator_user_id: 'u1',
      participant_count: 4,
      bracket_size: 4,
      input_mode: 'flat_random',
      status: 'running',
    });
    await insertInitialMatches(t.db, tid, [
      {
        match_id: 'r1p0',
        round: 1,
        bracket_position: 0,
        bot_a_id: 'bot_a',
        bot_b_id: 'bot_b',
        status: 'pending',
        winner_bot_id: null,
      },
      {
        match_id: 'r1p1',
        round: 1,
        bracket_position: 1,
        bot_a_id: 'bot_c',
        bot_b_id: 'bot_d',
        status: 'pending',
        winner_bot_id: null,
      },
    ]);
    // Walk match 0 to in_flight, match 1 to complete.
    await markInFlight(t.db, `${tid}_r1p0`, 'bat_x', '2026-05-01T00:00:00Z');
    await markComplete(t.db, `${tid}_r1p1`, 'bot_c', '2026-05-01T00:01:00Z');

    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
      http.get(`${UPSTREAM}/v1/bots/bot_c`, () =>
        HttpResponse.json({ ...botA, id: 'bot_c', display_name: 'Charlie Bot' }),
      ),
      http.get(`${UPSTREAM}/v1/bots/bot_d`, () =>
        HttpResponse.json({ ...botB, id: 'bot_d', display_name: 'Delta Bot' }),
      ),
    );

    const res = await t.app.request(`/api/v1/tournaments/${tid}`);
    expect(res.status).toBe(200);
    const parsed = TournamentStrictSchema.parse(await res.json());

    expect(parsed.id).toBe(tid);
    expect(parsed.status).toBe('active');
    expect(parsed.participant_count).toBe(4);
    expect(parsed.rounds_total).toBe(2); // log2(4) = 2 rounds
    expect(parsed.current_round).toBe(1); // R1 has non-pending rows
    expect(parsed.champion_bot_id).toBeNull();

    expect(parsed.participants).toHaveLength(4);
    expect(parsed.participants.map((p) => p.bot_id).sort()).toEqual([
      'bot_a',
      'bot_b',
      'bot_c',
      'bot_d',
    ]);

    expect(parsed.matches).toHaveLength(2);
    const inFlight = parsed.matches.find((m) => m.fighter_a_bot_id === 'bot_a');
    const complete = parsed.matches.find((m) => m.fighter_a_bot_id === 'bot_c');
    expect(inFlight?.status).toBe('live'); // in_flight → live
    expect(inFlight?.battle_id).toBe('bat_x');
    expect(complete?.status).toBe('completed'); // complete → completed
    expect(complete?.winner_bot_id).toBe('bot_c');
  });

  it('maps a bye row to status=bye and a 6-bracket to rounds_total=3', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const { recordTournament } = await import('../src/store/recent-tournaments.js');
    const { insertInitialMatches } = await import('../src/store/tournament-matches.js');

    const tid = 'tour_d5_test_bye';
    await recordTournament(t.db, {
      tournament_id: tid,
      initiator_user_id: 'u1',
      participant_count: 6,
      bracket_size: 6,
      input_mode: 'escalation',
      status: 'pending',
    });
    // 6-bracket: 2 R1 matches + 2 byes (top seeds advance free)
    await insertInitialMatches(t.db, tid, [
      {
        match_id: 'r1bye0',
        round: 1,
        bracket_position: 0,
        bot_a_id: 'bot_a',
        bot_b_id: null,
        status: 'bye',
        winner_bot_id: 'bot_a',
      },
      {
        match_id: 'r1p1',
        round: 1,
        bracket_position: 1,
        bot_a_id: 'bot_b',
        bot_b_id: 'bot_c',
        status: 'pending',
        winner_bot_id: null,
      },
    ]);

    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
      http.get(`${UPSTREAM}/v1/bots/bot_c`, () =>
        HttpResponse.json({ ...botA, id: 'bot_c', display_name: 'Charlie Bot' }),
      ),
    );

    const res = await t.app.request(`/api/v1/tournaments/${tid}`);
    expect(res.status).toBe(200);
    const parsed = TournamentStrictSchema.parse(await res.json());

    expect(parsed.status).toBe('upcoming');
    expect(parsed.rounds_total).toBe(3); // log2(6) ceil = 3 rounds
    expect(parsed.current_round).toBe(1); // bye row counts as a non-pending R1 cell

    const byeMatch = parsed.matches.find((m) => m.fighter_b_bot_id === null);
    expect(byeMatch?.status).toBe('bye');
    expect(byeMatch?.winner_bot_id).toBe('bot_a');
  });

  it('reports champion_bot_id once the recent_tournaments row is marked complete', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const { recordTournament, markComplete: markTournamentComplete } =
      await import('../src/store/recent-tournaments.js');
    const { insertInitialMatches, markComplete: markMatchComplete } =
      await import('../src/store/tournament-matches.js');

    const tid = 'tour_d5_test_champ';
    await recordTournament(t.db, {
      tournament_id: tid,
      initiator_user_id: 'u1',
      participant_count: 4,
      bracket_size: 4,
      input_mode: 'flat_random',
      status: 'running',
    });
    await insertInitialMatches(t.db, tid, [
      {
        match_id: 'r1p0',
        round: 1,
        bracket_position: 0,
        bot_a_id: 'bot_a',
        bot_b_id: 'bot_b',
        status: 'pending',
        winner_bot_id: null,
      },
    ]);
    await markMatchComplete(t.db, `${tid}_r1p0`, 'bot_a', '2026-05-01T00:01:00Z');
    await markTournamentComplete(t.db, tid, 'bot_a');

    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
    );

    const res = await t.app.request(`/api/v1/tournaments/${tid}`);
    expect(res.status).toBe(200);
    const parsed = TournamentStrictSchema.parse(await res.json());

    expect(parsed.status).toBe('completed');
    expect(parsed.champion_bot_id).toBe('bot_a');
  });
});
