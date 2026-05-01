// Slice 4 — POST /api/v1/battles cooldown enforcement.
//
// Covers:
//   - pairKey symmetry (unit)
//   - happy path: row written with status='running' + correct pair_key
//   - Rule 1 (pair_busy): a second concurrent POST for the same pair → 429
//   - different pair while one is busy → 200
//   - Rule 2 (pair_cooldown): 4th completed battle in the rolling hour → 429
//   - 429 envelope shape matches the upstream-error contract the frontend
//     destructures (`{error, detail}` plus a numeric Retry-After header)
//   - race-safety: 5 simultaneous POSTs for the same pair → exactly 1
//     reaches upstream

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { markComplete, pairKey } from '../src/store/recent-battles.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

function upstreamBattleResponse(battleId: string, botA: string, botB: string) {
  return {
    battle_id: battleId,
    bot_a: botA,
    bot_b: botB,
    input_ids: [1, 2, 3],
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
    expect(pairKey('zzz', 'aaa')).toBe('aaa:zzz');
    expect(pairKey('aaa', 'zzz')).toBe('aaa:zzz');
  });
});

describe('POST /api/v1/battles', () => {
  it('401s without a session', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bot_a: 'bot_x', bot_b: 'bot_y', count: 3 }),
    });
    expect(res.status).toBe(401);
  });

  it('happy path: writes recent_battles row with correct pair_key + running status', async () => {
    const { t, cookie } = await signedUpApp();
    let upstreamHits = 0;
    server.use(
      http.post(`${UPSTREAM}/v1/battles`, () => {
        upstreamHits += 1;
        return HttpResponse.json(upstreamBattleResponse('bat_upstream_1', 'bot_a', 'bot_b'));
      }),
    );

    const res = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', count: 3 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['battle_id']).toBe('bat_upstream_1');
    expect(body['bot_a']).toBe('bot_a');
    expect(upstreamHits).toBe(1);

    const row = await t.db.execute({
      sql: 'SELECT pair_key, status, weight_class FROM recent_battles WHERE battle_id = ?',
      args: ['bat_upstream_1'],
    });
    expect(row.rows[0]?.['pair_key']).toBe(pairKey('bot_a', 'bot_b'));
    expect(row.rows[0]?.['status']).toBe('running');
    expect(row.rows[0]?.['weight_class']).toBeNull();
  });

  it('immediate second POST for same pair → 429 pair_busy with Retry-After', async () => {
    const { t, cookie } = await signedUpApp();
    let upstreamHits = 0;
    server.use(
      http.post(`${UPSTREAM}/v1/battles`, () => {
        upstreamHits += 1;
        return HttpResponse.json(upstreamBattleResponse('bat_busy_1', 'bot_a', 'bot_b'));
      }),
    );

    const first = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', count: 3 }),
    });
    expect(first.status).toBe(200);
    // Force the first row back to a non-terminal status so it counts as
    // active for findActive.
    await t.db.execute({
      sql: `UPDATE recent_battles SET status = 'running' WHERE battle_id = ?`,
      args: ['bat_busy_1'],
    });

    const second = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ bot_a: 'bot_b', bot_b: 'bot_a', count: 3 }),
    });
    expect(second.status).toBe(429);
    const body = (await second.json()) as Record<string, unknown>;
    expect(body['error']).toBe('pair_busy');
    expect(typeof body['detail']).toBe('string');
    const retry = Number(second.headers.get('Retry-After'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(upstreamHits).toBe(1); // second never reached upstream
  });

  it('different pair while one is busy → 200', async () => {
    const { t, cookie } = await signedUpApp();
    let upstreamHits = 0;
    server.use(
      http.post(`${UPSTREAM}/v1/battles`, async ({ request }) => {
        upstreamHits += 1;
        const sent = (await request.json()) as { bot_a: string; bot_b: string };
        return HttpResponse.json(
          upstreamBattleResponse(
            `bat_${upstreamHits}_${sent.bot_a}_${sent.bot_b}`,
            sent.bot_a,
            sent.bot_b,
          ),
        );
      }),
    );

    const first = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', count: 3 }),
    });
    expect(first.status).toBe(200);

    // Different pair (a vs c) — should bypass busy rule.
    const second = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_c', count: 3 }),
    });
    expect(second.status).toBe(200);
    expect(upstreamHits).toBe(2);
  });

  it('4th completed battle for a pair within the hour → 429 pair_cooldown', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.post(`${UPSTREAM}/v1/battles`, async ({ request }) => {
        const sent = (await request.json()) as { bot_a: string; bot_b: string };
        const id = 'bat_' + Math.random().toString(36).slice(2, 10);
        return HttpResponse.json(upstreamBattleResponse(id, sent.bot_a, sent.bot_b));
      }),
    );

    const completedIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await t.app.request('/api/v1/battles', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', count: 3 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { battle_id: string };
      completedIds.push(body.battle_id);
      // Mark each one complete so the next POST passes Rule 1 and we can
      // count toward Rule 2.
      await markComplete(t.db, body.battle_id, 'bot_a', new Date().toISOString());
    }
    expect(completedIds).toHaveLength(3);

    const fourth = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', count: 3 }),
    });
    expect(fourth.status).toBe(429);
    const body = (await fourth.json()) as Record<string, unknown>;
    expect(body['error']).toBe('pair_cooldown');
    expect(typeof body['detail']).toBe('string');
    const retry = Number(fourth.headers.get('Retry-After'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(3600);
  });

  it('race-safety: 5 simultaneous POSTs for same pair → exactly 1 reaches upstream', async () => {
    const { t, cookie } = await signedUpApp();
    let upstreamHits = 0;
    server.use(
      http.post(`${UPSTREAM}/v1/battles`, async ({ request }) => {
        upstreamHits += 1;
        // Capture the unique id *before* awaiting request.json — otherwise
        // multiple concurrent handlers can read the same closure value
        // after their await yields and collide on the upstream battle_id.
        const myId = 'bat_race_' + upstreamHits;
        const sent = (await request.json()) as { bot_a: string; bot_b: string };
        return HttpResponse.json(
          upstreamBattleResponse(myId, sent.bot_a, sent.bot_b),
        );
      }),
    );

    const requests = Array.from({ length: 5 }, () =>
      t.app.request('/api/v1/battles', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', count: 3 }),
      }),
    );
    const results = await Promise.all(requests);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);

    // libSQL serializes writes; await Promise.all interleaves the JS handlers
    // but DB writes happen sequentially. The first INSERT lands, every
    // subsequent findActive check sees it and 429s. We assert the practical
    // invariant: exactly 1 success, 4 are 429s, and exactly 1 upstream hit.
    const successes = statuses.filter((s) => s === 200);
    const blocks = statuses.filter((s) => s === 429);
    expect(successes).toHaveLength(1);
    expect(blocks).toHaveLength(4);
    expect(upstreamHits).toBe(1);

    // Each 429 carries the same envelope shape so the frontend can
    // destructure cleanly — verified on one of them.
    const blocked = results.find((r) => r.status === 429)!;
    const body = (await blocked.json()) as Record<string, unknown>;
    expect(body['error']).toBe('pair_busy');
    expect(typeof body['detail']).toBe('string');
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
  });
});
