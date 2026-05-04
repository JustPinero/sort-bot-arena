import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';

import { makeTestApp } from './helpers/test-app.js';

import type { ListenerHealth } from '../src/app.js';

describe('GET /api/healthz', () => {
  it('returns ok', async () => {
    const res = await app.request('/api/healthz');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

const UPSTREAM = 'http://api.test';
const server = setupServer(
  http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('ok', { status: 200 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

interface ReadyzBody {
  ready: boolean;
  upstream: string;
  breakers: Record<string, string>;
  listener: {
    running: boolean;
    last_event_at: string | null;
    events_processed: number;
  };
}

function stubListener(state: {
  running: boolean;
  lastEventAt: string | null;
  eventsProcessed: number;
}): ListenerHealth {
  return {
    isRunning: () => state.running,
    lastEventAt: () => state.lastEventAt,
    eventsProcessed: () => state.eventsProcessed,
  };
}

describe('GET /api/readyz listener field', () => {
  it('reports listener as off when no listener dep is provided (RUN_LISTENER=false case)', async () => {
    server.use(http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('ok', { status: 200 })));
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/readyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReadyzBody;
    expect(body.ready).toBe(true);
    expect(body.upstream).toBe('ok');
    expect(body.breakers).toBeDefined();
    expect(body.listener).toEqual({
      running: false,
      last_event_at: null,
      events_processed: 0,
    });
  });

  it('reports listener as off when listener is explicitly null', async () => {
    server.use(http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('ok', { status: 200 })));
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM, listener: null });
    const res = await t.app.request('/api/readyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReadyzBody;
    // ready stays true — listener is observational, not on the critical path.
    expect(body.ready).toBe(true);
    expect(body.listener).toEqual({
      running: false,
      last_event_at: null,
      events_processed: 0,
    });
  });

  it("surfaces a running listener's getters verbatim", async () => {
    server.use(http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('ok', { status: 200 })));
    const listener = stubListener({
      running: true,
      lastEventAt: '2026-05-01T14:00:00.000Z',
      eventsProcessed: 5,
    });
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM, listener });
    const res = await t.app.request('/api/readyz');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReadyzBody;
    expect(body.ready).toBe(true);
    expect(body.listener).toEqual({
      running: true,
      last_event_at: '2026-05-01T14:00:00.000Z',
      events_processed: 5,
    });
  });

  it('preserves the existing readyz contract (ready / upstream / breakers keys)', async () => {
    server.use(http.get(`${UPSTREAM}/healthz`, () => new HttpResponse('ok', { status: 200 })));
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/readyz');
    const body = (await res.json()) as ReadyzBody;
    expect(body).toHaveProperty('ready');
    expect(body).toHaveProperty('upstream');
    expect(body).toHaveProperty('breakers');
    expect(body).toHaveProperty('listener');
  });
});
