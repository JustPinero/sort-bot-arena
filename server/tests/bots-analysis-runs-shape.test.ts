import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GET /api/v1/bots/:id/analysis', () => {
  it('formats the upstream analysis object as a markdown-ish string', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_xyz/analysis`, () =>
        HttpResponse.json({
          algorithm: 'Timsort (Python built-in list.sort)',
          time_complexity_estimate: 'O(n log n) average and worst case',
          space_complexity_estimate: 'O(n) auxiliary in the worst case',
          strengths: ['Stable', 'Fast on partially sorted input'],
          weaknesses: ['Higher memory use'],
          suggested_use_cases: ['Mixed real-world data'],
          anti_patterns: ['Tiny embedded targets'],
          reasoning: 'Python defers to Timsort which dominates on real data.',
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_xyz/analysis');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      bot_id: string;
      analysis: string;
      generated_at: string;
    };
    expect(body.bot_id).toBe('bot_xyz');
    expect(typeof body.analysis).toBe('string');
    expect(typeof body.generated_at).toBe('string');
    expect(body.analysis).toContain('Timsort');
    expect(body.analysis).toContain('Python defers to Timsort');
    expect(body.analysis).toContain('**Algorithm:**');
    expect(body.analysis).toContain('**Strengths**');
    expect(body.analysis).toContain('- Stable');
  });

  it('skips missing fields gracefully', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_min/analysis`, () =>
        HttpResponse.json({ algorithm: 'Quicksort' }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_min/analysis');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { analysis: string };
    expect(typeof body.analysis).toBe('string');
    expect(body.analysis).toContain('Quicksort');
    expect(body.analysis).not.toContain('**Strengths**');
  });

  it('404s when sort-bot-api 404s', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/bots/missing/analysis`, () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/missing/analysis');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/bots/:id/runs', () => {
  it('returns an empty CursorPage<BotRun> regardless of upstream', async () => {
    // No upstream handler is registered: the route must not call upstream.
    // (onUnhandledRequest: 'error' would fail the test if it did.)
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_xyz/runs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; next_cursor: null };
    expect(body).toEqual({ items: [], next_cursor: null });
  });
});
