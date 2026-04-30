import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const botFixture = {
  id: 'bot_xyz',
  user_id: 'u1',
  display_name: 'Recon',
  language: 'python',
  source_size_bytes: 154,
  source_sha256: 'sha',
  status: 'evaluated',
  submitted_at: 'T0',
  evaluation_completed_at: 'T1',
};

describe('GET /api/v1/leaderboard', () => {
  it('augments rows with deterministic nicknames', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({
          filter: {},
          total_inputs: 57,
          bots: [
            {
              bot_id: 'bot_xyz',
              display_name: 'Recon',
              language: 'python',
              score: 12.0,
              inputs_covered: 57,
              total_inputs: 57,
              incomplete: false,
              rank: 1,
            },
          ],
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: Array<{ bot_id: string; nickname: string }> };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.bot_id).toBe('bot_xyz');
    expect(body.entries[0]?.nickname).toBeTruthy();
    // determinism check: same bot_id always gets the same nickname
    const second = await t.app.request('/api/v1/leaderboard?limit=10');
    const body2 = (await second.json()) as { entries: Array<{ nickname: string }> };
    expect(body2.entries[0]?.nickname).toBe(body.entries[0]?.nickname);
  });
});

describe('GET /api/v1/bots/:id', () => {
  it('returns the synthesized rich shape', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_xyz`, () => HttpResponse.json(botFixture)),
      http.get(`${UPSTREAM}/v1/bots/bot_xyz/profile`, () =>
        HttpResponse.json({
          bot: botFixture,
          rank: 1,
          score: 12.0,
          incomplete: false,
          inputs_covered: 57,
          total_inputs: 57,
          best_input: { input_id: 3, median_ms: 7 },
          worst_input: { input_id: 45, median_ms: 216 },
          per_input: [],
          rank_history: [],
        }),
      ),
      http.get(`${UPSTREAM}/v1/bots/bot_xyz/analysis`, () =>
        HttpResponse.json({ algorithm: 'Timsort' }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_xyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['id']).toBe('bot_xyz');
    expect(body['nickname']).toBeTruthy();
    expect(body['rank']).toBe(1);
    expect(body['algorithm']).toBe('Timsort');
    expect(body['signature_input']).toMatchObject({ input_id: '3', time_seconds: 0.007 });
    expect(body['achilles_heel']).toMatchObject({ input_id: '45', time_seconds: 0.216 });
    expect(body['record']).toEqual({ wins: 0, losses: 0, draws: 0 });
    expect(body['analysis_url']).toBe('/api/v1/bots/bot_xyz/analysis');
    expect(body['retired']).toBe(false);
  });

  it('404s when sort-bot-api 404s', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/missing`, () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/missing');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/stats', () => {
  it('passes through', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/stats`, () =>
        HttpResponse.json({
          fastest_run_ms: 7,
          language_distribution: { python: 1 },
          total_bots: 1,
          total_runs: 100,
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/stats');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total_bots: 1, total_runs: 100 });
  });
});

describe('GET /api/v1/bots/:id/badge.svg', () => {
  it('returns SVG with cache headers', async () => {
    server.use(
      http.get(
        `${UPSTREAM}/v1/bots/bot_xyz/badge.svg`,
        () => new HttpResponse('<svg></svg>', { headers: { 'content-type': 'image/svg+xml' } }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_xyz/badge.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/svg/);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await res.text()).toContain('<svg');
  });
});
