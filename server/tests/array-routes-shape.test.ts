import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const upstreamCreatedBot = {
  id: 'sba_bot_1',
  user_id: 'sba_user_1',
  display_name: 'Recon Bot',
  language: 'python',
  source_size_bytes: 100,
  source_sha256: 'sha',
  status: 'pending',
  submitted_at: 'T0',
};

async function signedUpApp() {
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
  const cookie = signup.headers.get('set-cookie')!.split(';')[0]!;
  return { t, cookie };
}

describe('array-shape contract routes', () => {
  it('GET /api/v1/halloffame returns a bare array (not envelope)', async () => {
    const { t } = await signedUpApp();
    const res = await t.app.request('/api/v1/halloffame');
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    expect((body as { bots?: unknown }).bots).toBeUndefined();
  });

  it('GET /api/v1/achievements returns a bare array of 5 fully-shaped items', async () => {
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
    const res = await t.app.request('/api/v1/achievements');
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    const arr = body as Array<Record<string, unknown>>;
    expect(arr).toHaveLength(5);
    for (const item of arr) {
      expect(item).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          icon: expect.any(String),
          description: expect.any(String),
          unlocked_at: expect.any(String),
          rarity_pct: expect.any(Number),
          unlocked_pct: expect.any(Number),
        }),
      );
    }
  });

  it('GET /api/v1/users/me/bots returns a bare array with the submitted bot', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(http.post(`${UPSTREAM}/v1/bots`, () => HttpResponse.json(upstreamCreatedBot)));
    const submit = await t.app.request('/api/v1/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        display_name: 'Recon Bot',
        language: 'python',
        source: 'print(1)',
      }),
    });
    expect(submit.status).toBe(201);

    server.use(
      http.get(`${UPSTREAM}/v1/bots/sba_bot_1`, () => HttpResponse.json(upstreamCreatedBot)),
      http.get(`${UPSTREAM}/v1/bots/sba_bot_1/profile`, () =>
        HttpResponse.json({
          bot: upstreamCreatedBot,
          rank: 5,
          score: 12.0,
          incomplete: false,
          inputs_covered: 57,
          total_inputs: 57,
          best_input: { input_id: 1, median_ms: 7 },
          worst_input: { input_id: 45, median_ms: 216 },
          per_input: [],
          rank_history: [],
        }),
      ),
    );

    const res = await t.app.request('/api/v1/users/me/bots', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    const arr = body as Array<{ id: string }>;
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr[0]?.id).toBe('sba_bot_1');
    expect((body as { bots?: unknown }).bots).toBeUndefined();
  });
});
