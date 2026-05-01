import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
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

describe('withRetry', () => {
  const sleep = () => Promise.resolve();

  it('retries transient 5xx and eventually succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new SortBotApiError({ status: 503, message: 'down' });
        }
        return 'ok';
      },
      { sleep, baseDelayMs: 1, maxDelayMs: 1, random: () => 0 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry 4xx', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new SortBotApiError({ status: 400, message: 'bad' });
        },
        { sleep, baseDelayMs: 1, maxDelayMs: 1, random: () => 0 },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });

  it('throws after exceeding maxRetries', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new SortBotApiError({ status: 500, message: 'kaboom' });
        },
        { sleep, baseDelayMs: 1, maxDelayMs: 1, random: () => 0, maxRetries: 2 },
      ),
    ).rejects.toMatchObject({ status: 500 });
    expect(calls).toBe(3);
  });
});

describe('CircuitBreaker', () => {
  it('opens after threshold failures within window', async () => {
    const now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 10_000,
      cooldownMs: 30_000,
      now: () => now,
    });

    const fail = () =>
      breaker.run(() => Promise.reject(new SortBotApiError({ status: 503, message: 'down' })));

    await expect(fail()).rejects.toMatchObject({ status: 503 });
    await expect(fail()).rejects.toMatchObject({ status: 503 });
    expect(breaker.state()).toBe('closed');
    await expect(fail()).rejects.toMatchObject({ status: 503 });
    expect(breaker.state()).toBe('open');
    await expect(fail()).rejects.toMatchObject({ code: 'circuit_open' });
  });

  it('moves to half_open after cooldown and closes on success', async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 5_000,
      now: () => now,
    });
    const fail = () =>
      breaker.run(() => Promise.reject(new SortBotApiError({ status: 500, message: 'down' })));
    await expect(fail()).rejects.toBeDefined();
    await expect(fail()).rejects.toBeDefined();
    expect(breaker.state()).toBe('open');
    now = 6_000;
    expect(breaker.state()).toBe('half_open');
    const ok = await breaker.run(() => Promise.resolve('hi'));
    expect(ok).toBe('hi');
    expect(breaker.state()).toBe('closed');
  });

  it('does not count 4xx toward failure budget', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 5_000,
    });
    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.run(() => Promise.reject(new SortBotApiError({ status: 404, message: 'nope' }))),
      ).rejects.toMatchObject({ status: 404 });
    }
    expect(breaker.state()).toBe('closed');
  });
});

describe('SortBotApiClient resilience', () => {
  it('retries idempotent GETs on 503', async () => {
    let calls = 0;
    server.use(
      http.get(`${UPSTREAM}/v1/stats`, () => {
        calls += 1;
        if (calls < 3) {
          return HttpResponse.json({ error: 'down' }, { status: 503 });
        }
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
      retry: { baseDelayMs: 1, maxDelayMs: 1, random: () => 0 },
    });
    const res = await client.getStats();
    expect(res.total_bots).toBe(0);
    expect(calls).toBe(3);
  });

  it('does not retry non-idempotent POSTs', async () => {
    let calls = 0;
    server.use(
      http.post(`${UPSTREAM}/v1/users`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'kaboom' }, { status: 500 });
      }),
    );
    const client = new SortBotApiClient({
      baseUrl: UPSTREAM,
      retry: { baseDelayMs: 1, maxDelayMs: 1, random: () => 0 },
    });
    await expect(
      client.createUser({ display_name: 'Recon', email: 'r@x.com' }),
    ).rejects.toMatchObject({ status: 500 });
    expect(calls).toBe(1);
  });
});

describe('GET /api/v1/leaderboard with stale fallback', () => {
  it('serves cached snapshot on upstream 5xx with X-Stale header', async () => {
    let upstreamUp = true;
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () => {
        if (!upstreamUp) {
          return HttpResponse.json({ error: 'down' }, { status: 503 });
        }
        return HttpResponse.json({
          filter: {},
          total_inputs: 10,
          bots: [
            {
              bot_id: 'bot_cached',
              display_name: 'Cached',
              language: 'python',
              score: 12,
              inputs_covered: 10,
              total_inputs: 10,
              incomplete: false,
              rank: 1,
            },
          ],
        });
      }),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const fresh = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('X-Stale')).toBeNull();

    upstreamUp = false;
    const stale = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(stale.status).toBe(200);
    expect(stale.headers.get('X-Stale')).toBe('true');
    const body = (await stale.json()) as { items: Array<{ bot_id: string }> };
    expect(body.items[0]?.bot_id).toBe('bot_cached');
  }, 15_000);

  it('returns 502 with envelope when no cache exists and upstream is down', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({ error: 'down' }, { status: 503 }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(res.status).toBe(502);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'upstream_failure',
    });
  }, 15_000);
});

describe('GET /api/v1/stats with stale fallback', () => {
  it('serves cached stats when upstream is down', async () => {
    let upstreamUp = true;
    server.use(
      http.get(`${UPSTREAM}/v1/stats`, () => {
        if (!upstreamUp) return HttpResponse.json({ error: 'down' }, { status: 503 });
        return HttpResponse.json({
          fastest_run_ms: 7,
          language_distribution: { python: 1 },
          total_bots: 1,
          total_runs: 100,
        });
      }),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const fresh = await t.app.request('/api/v1/stats');
    expect(fresh.status).toBe(200);

    upstreamUp = false;
    const stale = await t.app.request('/api/v1/stats');
    expect(stale.status).toBe(200);
    expect(stale.headers.get('X-Stale')).toBe('true');
    expect(await stale.json()).toMatchObject({ total_bots: 1 });
  }, 15_000);
});

describe('GET /api/readyz', () => {
  it('returns 200 when upstream healthz is reachable', async () => {
    server.use(http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('ok', { status: 200 })));
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/readyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ready: boolean; upstream: string };
    expect(body.ready).toBe(true);
    expect(body.upstream).toBe('ok');
  });

  it('returns 503 when upstream healthz fails', async () => {
    server.use(http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('', { status: 500 })));
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/readyz');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ready: boolean };
    expect(body.ready).toBe(false);
  });
});
