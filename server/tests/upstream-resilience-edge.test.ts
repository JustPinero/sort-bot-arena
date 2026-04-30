import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  breakerKeyFor,
  BreakerRegistry,
  CircuitBreaker,
  SortBotApiClient,
  SortBotApiError,
  withRetry,
} from '../src/clients/sort-bot-api/index.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('breakerKeyFor', () => {
  it('normalizes opaque ID segments', () => {
    expect(breakerKeyFor('GET', '/v1/bots/bot_abc123')).toBe('GET /v1/bots/:id');
    expect(breakerKeyFor('GET', '/v1/bots/bot_abc123/profile')).toBe('GET /v1/bots/:id/profile');
    expect(breakerKeyFor('GET', '/v1/leaderboard/inputs/42')).toBe(
      'GET /v1/leaderboard/inputs/:id',
    );
  });

  it('does not collapse static path segments', () => {
    expect(breakerKeyFor('GET', '/v1/leaderboard')).toBe('GET /v1/leaderboard');
    expect(breakerKeyFor('GET', '/v1/users/me')).toBe('GET /v1/users/me');
  });
});

describe('BreakerRegistry', () => {
  it('isolates breakers per key', async () => {
    const registry = new BreakerRegistry({ failureThreshold: 2, windowMs: 10_000 });
    const a = registry.for('GET /v1/leaderboard');
    const b = registry.for('GET /v1/users/me');

    const fail = (br: CircuitBreaker) =>
      br.run(() => Promise.reject(new SortBotApiError({ status: 503, message: 'down' })));
    await expect(fail(a)).rejects.toBeDefined();
    await expect(fail(a)).rejects.toBeDefined();
    expect(a.state()).toBe('open');
    expect(b.state()).toBe('closed');
  });
});

describe('CircuitBreaker half-open concurrency', () => {
  it('allows only one probe in flight during half_open; others fast-fail', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      windowMs: 10_000,
      cooldownMs: 1_000,
      now: () => now,
    });
    await expect(
      breaker.run(() => Promise.reject(new SortBotApiError({ status: 503, message: 'd' }))),
    ).rejects.toBeDefined();
    expect(breaker.state()).toBe('open');

    now = 1_500;
    expect(breaker.state()).toBe('half_open');

    let release: (v: string) => void = () => {};
    const probePromise = breaker.run(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    await expect(breaker.run(() => Promise.resolve('second'))).rejects.toMatchObject({
      code: 'circuit_open',
    });

    release('probe-ok');
    expect(await probePromise).toBe('probe-ok');
    expect(breaker.state()).toBe('closed');
  });
});

describe('withRetry abort', () => {
  it('cancellation between retries propagates', async () => {
    let calls = 0;
    let aborted = false;
    const ac = new AbortController();
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        ac.signal.addEventListener('abort', () => {
          clearTimeout(t);
          aborted = true;
          reject(new Error('aborted'));
        });
      });

    const promise = withRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new SortBotApiError({ status: 500, message: 'boom' });
        return 'ok';
      },
      { sleep, baseDelayMs: 50, maxDelayMs: 50, random: () => 0 },
    );

    setTimeout(() => ac.abort(), 5);
    await expect(promise).rejects.toThrow(/aborted/);
    expect(aborted).toBe(true);
    expect(calls).toBe(1);
  });
});

describe('SortBotApiClient timeout', () => {
  it('throws status 0 when upstream exceeds defaultTimeoutMs', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/stats`, async () => {
        await delay(200);
        return HttpResponse.json({
          fastest_run_ms: 1,
          language_distribution: {},
          total_bots: 0,
          total_runs: 0,
        });
      }),
    );
    const client = new SortBotApiClient({
      baseUrl: UPSTREAM,
      defaultTimeoutMs: 30,
      retry: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1, random: () => 0 },
      breaker: { failureThreshold: 99 },
    });
    await expect(client.getStats()).rejects.toMatchObject({
      name: 'SortBotApiError',
      status: 0,
    });
  });
});

describe('per-endpoint breaker isolation in client', () => {
  it('does not open /v1/leaderboard breaker due to /v1/bots failures', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_x`, () =>
        HttpResponse.json({ error: 'down' }, { status: 503 }),
      ),
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({ filter: {}, total_inputs: 0, bots: [] }),
      ),
    );
    const client = new SortBotApiClient({
      baseUrl: UPSTREAM,
      retry: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1, random: () => 0 },
      breaker: { failureThreshold: 2 },
    });
    await expect(client.getBot('bot_x')).rejects.toBeDefined();
    await expect(client.getBot('bot_x')).rejects.toBeDefined();
    const states = client.breakers!.states();
    expect(states['GET /v1/bots/:id']).toBe('open');
    expect(states['GET /v1/leaderboard']).toBeUndefined();

    const lb = await client.getLeaderboard();
    expect(lb.bots).toEqual([]);
  });
});

describe('cache maxStaleMs', () => {
  it('rejects cache older than maxStaleMs', async () => {
    let calls = 0;
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({
            filter: {},
            total_inputs: 1,
            bots: [
              {
                bot_id: 'bot_old',
                display_name: 'Old',
                language: 'python',
                score: 1,
                inputs_covered: 1,
                total_inputs: 1,
                incomplete: false,
                rank: 1,
              },
            ],
          });
        }
        return HttpResponse.json({ error: 'down' }, { status: 503 });
      }),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const fresh = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(fresh.status).toBe(200);

    // Manually age the row beyond plausible maxStaleMs.
    await t.db.execute({
      sql: "UPDATE upstream_cache SET stored_at = ?, expires_at = ? WHERE cache_key LIKE 'leaderboard:%'",
      args: ['2000-01-01T00:00:00.000Z', '2000-01-01T01:00:00.000Z'],
    });

    const stale = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(stale.status).toBe(200);
    expect(stale.headers.get('X-Stale')).toBe('true');
  });
});

describe('cache prune', () => {
  it('removes only expired rows', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    await t.db.execute({
      sql: 'INSERT INTO upstream_cache (cache_key, body_json, stored_at, expires_at) VALUES (?, ?, ?, ?)',
      args: ['expired', '{}', past, past],
    });
    await t.db.execute({
      sql: 'INSERT INTO upstream_cache (cache_key, body_json, stored_at, expires_at) VALUES (?, ?, ?, ?)',
      args: ['fresh', '{}', past, future],
    });
    const { pruneExpired } = await import('../src/store/upstream-cache.js');
    const deleted = await pruneExpired(t.db);
    expect(deleted).toBe(1);
    const remaining = await t.db.execute('SELECT cache_key FROM upstream_cache');
    expect(remaining.rows.map((r) => r['cache_key'])).toEqual(['fresh']);
  });
});

describe('GET /api/v1/battles/:id/replay', () => {
  it('returns rounds shaped for dramatized replay', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_q`, () =>
        HttpResponse.json({
          battle: {
            id: 'bat_q',
            bot_a_id: 'bot_a',
            bot_b_id: 'bot_b',
            initiator_id: 'u',
            status: 'complete',
            winner_bot_id: { String: 'bot_a', Valid: true },
            bot_a_wins: 2,
            bot_b_wins: 1,
            ties: 0,
            created_at: 'T',
            completed_at: { String: 'T+1', Valid: true },
          },
          runs: [
            {
              id: 1,
              battle_id: 'bat_q',
              input_id: 5,
              bot_a_duration_ms: { Int64: 100, Valid: true },
              bot_b_duration_ms: { Int64: 150, Valid: true },
              bot_a_status: 'success',
              bot_b_status: 'success',
              winner_bot_id: { String: 'bot_a', Valid: true },
              completed_at: 'T',
            },
            {
              id: 2,
              battle_id: 'bat_q',
              input_id: 6,
              bot_a_duration_ms: { Int64: 200, Valid: true },
              bot_b_duration_ms: { Int64: 100, Valid: true },
              bot_a_status: 'success',
              bot_b_status: 'success',
              winner_bot_id: { String: 'bot_b', Valid: true },
              completed_at: 'T',
            },
          ],
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles/bat_q/replay');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      outcome: string;
      rounds: Array<{ round: number; winner_bot_id: string }>;
    };
    expect(body.status).toBe('complete');
    expect(body.outcome).toBe('a_decision');
    expect(body.rounds).toHaveLength(2);
    expect(body.rounds[0]?.winner_bot_id).toBe('bot_a');
    expect(body.rounds[1]?.winner_bot_id).toBe('bot_b');
  });
});
