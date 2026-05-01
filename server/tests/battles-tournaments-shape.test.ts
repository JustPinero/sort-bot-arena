import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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
    const body = await res.json();
    expect(body).toEqual({ items: [], next_cursor: null });
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
    const body = (await res.json()) as Record<string, unknown>;

    expect(body['id']).toBe('bat_1');
    expect(body['status']).toBe('completed');
    expect(body['rounds_total']).toBe(3);
    expect(body['current_round']).toBe(3);
    expect(body['winner_bot_id']).toBe('bot_a');
    expect(body['outcome']).toBe('decision');
    expect(body['scheduled_at']).toBe('2026-04-29T00:00:00Z');
    expect(body['completed_at']).toBe('2026-04-29T00:05:00Z');

    const fa = body['fighter_a'] as Record<string, unknown>;
    const fb = body['fighter_b'] as Record<string, unknown>;
    expect(fa['bot_id']).toBe('bot_a');
    expect(fa['corner']).toBe('red');
    expect(fa['display_name']).toBe('Alpha Bot');
    expect(fa['nickname']).toBeTruthy();
    expect(fb['bot_id']).toBe('bot_b');
    expect(fb['corner']).toBe('blue');
    expect(fb['display_name']).toBe('Bravo Bot');
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
    expect(await res.json()).toEqual({ items: [], next_cursor: null });
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
    const body = (await res.json()) as Record<string, unknown>;

    expect(body['id']).toBe('tour_357ebddb20442ac59c297d7ea421da97');
    expect(body['status']).toBe('active');
    expect(body['name']).toBe('Tournament tour_357');
    expect(body['rounds_total']).toBe(2);
    expect(body['current_round']).toBe(1);
    expect(body['scheduled_at']).toBe('2026-04-29T00:00:00Z');
    expect(body['weight_class_filter']).toBeNull();
    expect(body['prize_description']).toBeNull();
    expect(body['champion_bot_id']).toBeNull();

    const participants = body['participants'] as Array<Record<string, unknown>>;
    expect(participants).toHaveLength(2);
    const participantIds = participants.map((p) => p['bot_id']).sort();
    expect(participantIds).toEqual(['bot_a', 'bot_b']);
    for (const p of participants) {
      expect(p['nickname']).toBeTruthy();
      expect(p['display_name']).toBeTruthy();
    }

    const matches = body['matches'] as Array<Record<string, unknown>>;
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      id: '1',
      round: 1,
      position: 0,
      fighter_a_bot_id: 'bot_a',
      fighter_b_bot_id: 'bot_b',
      winner_bot_id: 'bot_a',
      status: 'completed',
      battle_id: 'bat_1',
    });
    expect(matches[1]).toMatchObject({
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
