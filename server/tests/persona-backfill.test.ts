// Slice 3 — Persona backfill semaphore + list-endpoint triggers.
//
// Layered tests:
// 1. Pure Semaphore unit tests (no I/O).
// 2. PersonaService integration: idempotency + semaphore concurrency cap.
// 3. Route integration via test-app: each list endpoint that returns bots
//    fires startBackgroundGeneration for any persona-less bot.

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PersonaService } from '../src/persona/service.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// -------------------------------------------------------------------------
// 1. Semaphore unit tests
// -------------------------------------------------------------------------
describe('Semaphore', () => {
  it('grants up to capacity acquires immediately', async () => {
    const { Semaphore } = await import('../src/persona/semaphore.js');
    const sem = new Semaphore(2);
    const a = await sem.acquire();
    const b = await sem.acquire();
    expect(a).toBeTypeOf('function');
    expect(b).toBeTypeOf('function');
    expect(sem.inUseCount()).toBe(2);
    expect(sem.pendingCount()).toBe(0);
  });

  it('queues acquires past capacity and dequeues them on release', async () => {
    const { Semaphore } = await import('../src/persona/semaphore.js');
    const sem = new Semaphore(2);
    const releaseA = (await sem.acquire())!;
    await sem.acquire();
    let thirdGranted = false;
    const thirdPromise = sem.acquire().then((rel) => {
      thirdGranted = true;
      return rel;
    });
    // Microtask flush — the third acquire must still be pending.
    await Promise.resolve();
    expect(thirdGranted).toBe(false);
    expect(sem.pendingCount()).toBe(1);

    releaseA();
    const thirdRelease = await thirdPromise;
    expect(thirdGranted).toBe(true);
    expect(thirdRelease).toBeTypeOf('function');
    expect(sem.pendingCount()).toBe(0);
  });

  it('pendingCount() reflects the live waiter count', async () => {
    const { Semaphore } = await import('../src/persona/semaphore.js');
    const sem = new Semaphore(1);
    const release = (await sem.acquire())!;
    void sem.acquire();
    void sem.acquire();
    void sem.acquire();
    await Promise.resolve();
    expect(sem.pendingCount()).toBe(3);
    release();
    await Promise.resolve();
    expect(sem.pendingCount()).toBe(2);
  });

  it('lets fresh acquires succeed after a full release cycle', async () => {
    const { Semaphore } = await import('../src/persona/semaphore.js');
    const sem = new Semaphore(1);
    const r1 = (await sem.acquire())!;
    r1();
    const r2 = (await sem.acquire())!;
    expect(r2).toBeTypeOf('function');
    r2();
    expect(sem.inUseCount()).toBe(0);
  });

  it('drops with null when waiter queue exceeds maxQueue (default 30)', async () => {
    const { Semaphore } = await import('../src/persona/semaphore.js');
    const sem = new Semaphore(3); // capacity 3, default max queue 30
    // Saturate capacity (3) and queue (30) — that's 33 acquires total that
    // either run or wait. The 34th should be dropped (resolves to null).
    for (let i = 0; i < 33; i++) {
      void sem.acquire();
    }
    await Promise.resolve();
    expect(sem.inUseCount()).toBe(3);
    expect(sem.pendingCount()).toBe(30);

    const dropped = await sem.acquire();
    expect(dropped).toBeNull();
    expect(sem.pendingCount()).toBe(30);
  });

  it('rejects capacity < 1 at construction', async () => {
    const { Semaphore } = await import('../src/persona/semaphore.js');
    expect(() => new Semaphore(0)).toThrow();
  });
});

// -------------------------------------------------------------------------
// 2. PersonaService integration
// -------------------------------------------------------------------------

interface RecordedLeonardo {
  startCalls: number;
  pollCalls: number;
}

function makeFakeLeonardo(): {
  client: {
    startGeneration: (prompt: string) => Promise<{ generation_id: string }>;
    getGeneration: (id: string) => Promise<{
      generation_id: string;
      status: 'PENDING' | 'COMPLETE' | 'FAILED';
      image_url: string | null;
    }>;
  };
  state: RecordedLeonardo;
} {
  const state: RecordedLeonardo = { startCalls: 0, pollCalls: 0 };
  return {
    state,
    client: {
      startGeneration: async (_prompt: string) => {
        state.startCalls++;
        return { generation_id: `gen_${state.startCalls}` };
      },
      getGeneration: async (id: string) => {
        state.pollCalls++;
        return {
          generation_id: id,
          status: 'COMPLETE' as const,
          image_url: `https://leonardo.test/${id}.png`,
        };
      },
    },
  };
}

function makeFakeAnthropic(): {
  client: {
    generateTrashTalk: (opts: {
      display_name: string;
      nickname: string;
      language: string;
      algorithm: string | null;
    }) => Promise<string>;
  };
  state: { calls: number };
} {
  const state = { calls: 0 };
  return {
    state,
    client: {
      generateTrashTalk: async () => {
        state.calls++;
        return 'taunt';
      },
    },
  };
}

async function waitFor(pred: () => boolean, timeoutMs = 1500): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: condition not met within timeout');
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('PersonaService.startBackgroundGeneration', () => {
  it('is idempotent: second call for the same bot does not re-fire generators', async () => {
    const { createClient } = await import('@libsql/client');
    const { runMigrations } = await import('../src/db/migrate.js');
    const db = createClient({ url: ':memory:' });
    await runMigrations(db);

    const leo = makeFakeLeonardo();
    const ant = makeFakeAnthropic();
    const persona = new PersonaService({
      db,
      leonardo: leo.client as never,
      anthropic: ant.client as never,
      pollIntervalMs: 1,
      pollMaxAttempts: 4,
    });

    persona.startBackgroundGeneration({
      bot_id: 'bot_1',
      display_name: 'One',
      language: 'python',
    });
    await waitFor(() => leo.state.startCalls >= 1 && ant.state.calls >= 1);

    // Second submit for the same bot — guard inside generatePortrait /
    // generateTrashTalk should make this a no-op.
    persona.startBackgroundGeneration({
      bot_id: 'bot_1',
      display_name: 'One',
      language: 'python',
    });
    // Give the second submit a chance to run through the semaphore.
    await new Promise((r) => setTimeout(r, 50));

    expect(leo.state.startCalls).toBe(1);
    expect(ant.state.calls).toBe(1);
  });

  it('caps simultaneous generations at backfillConcurrency', async () => {
    const { createClient } = await import('@libsql/client');
    const { runMigrations } = await import('../src/db/migrate.js');
    const db = createClient({ url: ':memory:' });
    await runMigrations(db);

    let inFlight = 0;
    let maxInFlight = 0;
    const leoClient = {
      startGeneration: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 30));
        return { generation_id: `gen_${Math.random()}` };
      },
      getGeneration: async (id: string) => {
        const result = {
          generation_id: id,
          status: 'COMPLETE' as const,
          image_url: 'https://leonardo.test/x.png',
        };
        inFlight--;
        return result;
      },
    };

    const persona = new PersonaService({
      db,
      leonardo: leoClient as never,
      pollIntervalMs: 1,
      pollMaxAttempts: 2,
      backfillConcurrency: 1,
    });

    for (let i = 0; i < 5; i++) {
      persona.startBackgroundGeneration({
        bot_id: `bot_${i}`,
        display_name: `Bot ${i}`,
        language: 'python',
      });
    }

    await waitFor(() => inFlight === 0 && maxInFlight === 1, 3000);
    expect(maxInFlight).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 3. Route integration: each list endpoint fires backfill for persona-less bots
// -------------------------------------------------------------------------

const FIVE_BOTS = Array.from({ length: 5 }, (_, i) => ({
  bot_id: `bot_${i}`,
  display_name: `Bot ${i}`,
  language: 'python',
  score: 12 - i,
  inputs_covered: 10,
  total_inputs: 10,
  incomplete: false,
  rank: i + 1,
}));

const FIVE_PER_INPUT = Array.from({ length: 5 }, (_, i) => ({
  bot_id: `bot_${i}`,
  display_name: `Bot ${i}`,
  language: 'python',
  duration_ms: 1000 + i * 100,
  rank: i + 1,
}));

const FIVE_BOT_OBJECTS = Array.from({ length: 5 }, (_, i) => ({
  id: `bot_${i}`,
  user_id: 'u1',
  display_name: `Bot ${i}`,
  language: 'python',
  source_size_bytes: 100,
  source_sha256: 'sha',
  status: 'evaluated',
  submitted_at: 'T0',
}));

describe('list-endpoint backfill triggers', () => {
  it('GET /api/v1/leaderboard fires startBackgroundGeneration for each persona-less row', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({ filter: {}, total_inputs: 10, bots: FIVE_BOTS }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const spy = vi.spyOn(t.persona, 'startBackgroundGeneration');

    const res = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(5);
    const ids = spy.mock.calls.map((c) => (c[0] as { bot_id: string }).bot_id).sort();
    expect(ids).toEqual(['bot_0', 'bot_1', 'bot_2', 'bot_3', 'bot_4']);
  });

  it('GET /api/v1/feed/snapshot fires backfill for every top-N bot without a persona', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({
          filter: {},
          total_inputs: 10,
          bots: FIVE_BOTS.slice(0, 3),
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const spy = vi.spyOn(t.persona, 'startBackgroundGeneration');

    const res = await t.app.request('/api/v1/feed/snapshot');
    expect(res.status).toBe(200);
    // Top-3 returned, all persona-less → 3 backfill triggers.
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('GET /api/v1/halloffame fires backfill for each retired bot lacking a persona', async () => {
    // Seed user_bots with 5 retired rows.
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    for (let i = 0; i < 5; i++) {
      await t.db.execute({
        sql: `INSERT INTO user_bots
                (user_id, sort_bot_api_bot_id, retired_at)
              VALUES (?, ?, ?)`,
        args: ['u1', `bot_${i}`, `2025-01-0${i + 1}T00:00:00Z`],
      });
    }
    server.use(
      ...FIVE_BOT_OBJECTS.map((b) =>
        http.get(`${UPSTREAM}/v1/bots/${b.id}`, () => HttpResponse.json(b)),
      ),
      ...FIVE_BOT_OBJECTS.map((b) =>
        http.get(`${UPSTREAM}/v1/bots/${b.id}/profile`, () =>
          HttpResponse.json({
            bot: b,
            rank: 5,
            score: 12,
            incomplete: false,
            inputs_covered: 10,
            total_inputs: 10,
            best_input: { input_id: 1, median_ms: 7 },
            worst_input: { input_id: 10, median_ms: 200 },
            per_input: [],
            rank_history: [],
          }),
        ),
      ),
    );
    const spy = vi.spyOn(t.persona, 'startBackgroundGeneration');
    const res = await t.app.request('/api/v1/halloffame');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('GET /api/v1/users/me/bots fires backfill for each owned bot lacking a persona', async () => {
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
    // Look up the user_id from the DB and seed 5 owned bots.
    const meRow = await t.db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: ['recon@example.com'],
    });
    const userId = (meRow.rows[0] as unknown as Record<string, string>)['id']!;
    for (let i = 0; i < 5; i++) {
      await t.db.execute({
        sql: `INSERT INTO user_bots (user_id, sort_bot_api_bot_id) VALUES (?, ?)`,
        args: [userId, `bot_${i}`],
      });
    }
    server.use(
      ...FIVE_BOT_OBJECTS.map((b) =>
        http.get(`${UPSTREAM}/v1/bots/${b.id}`, () => HttpResponse.json(b)),
      ),
      ...FIVE_BOT_OBJECTS.map((b) =>
        http.get(`${UPSTREAM}/v1/bots/${b.id}/profile`, () =>
          HttpResponse.json({
            bot: b,
            rank: 5,
            score: 12,
            incomplete: false,
            inputs_covered: 10,
            total_inputs: 10,
            best_input: { input_id: 1, median_ms: 7 },
            worst_input: { input_id: 10, median_ms: 200 },
            per_input: [],
            rank_history: [],
          }),
        ),
      ),
    );
    const spy = vi.spyOn(t.persona, 'startBackgroundGeneration');

    const res = await t.app.request('/api/v1/users/me/bots', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('GET /api/v1/leaderboard/inputs/:id fires backfill for each per-input row', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard/inputs/1`, () =>
        HttpResponse.json({ input_id: 1, bots: FIVE_PER_INPUT }),
      ),
      http.get(`${UPSTREAM}/v1/inputs`, () =>
        HttpResponse.json({
          inputs: [
            {
              id: 1,
              size_class: 'large',
              case_index: 0,
              array_len: 100000,
              is_custom: false,
              uploader_id: null,
              created_at: '2025-01-01T00:00:00Z',
            },
          ],
          total: 1,
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const spy = vi.spyOn(t.persona, 'startBackgroundGeneration');
    const res = await t.app.request('/api/v1/leaderboard/inputs/1');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('does NOT fire backfill for bots that already have a persona row', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({ filter: {}, total_inputs: 10, bots: FIVE_BOTS }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    // Seed personas for bot_0, bot_1, bot_2 — only bot_3 + bot_4 should
    // trigger backfill.
    for (const id of ['bot_0', 'bot_1', 'bot_2']) {
      await t.db.execute({
        sql: `INSERT INTO bot_personas (bot_id, portrait_status, trash_talk_status)
              VALUES (?, 'complete', 'complete')`,
        args: [id],
      });
    }
    const spy = vi.spyOn(t.persona, 'startBackgroundGeneration');
    const res = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    const ids = spy.mock.calls.map((c) => (c[0] as { bot_id: string }).bot_id).sort();
    expect(ids).toEqual(['bot_3', 'bot_4']);
  });
});
