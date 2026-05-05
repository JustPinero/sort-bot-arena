import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  AnalysisResponseStrictSchema,
  BotRunStrictSchema,
  CursorPageSchema,
} from '../../src/api/schemas.js';

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
    const parsed = AnalysisResponseStrictSchema.parse(await res.json());
    expect(parsed.bot_id).toBe('bot_xyz');
    expect(parsed.analysis).toContain('Timsort');
    expect(parsed.analysis).toContain('Python defers to Timsort');
    expect(parsed.analysis).toContain('**Algorithm:**');
    expect(parsed.analysis).toContain('**Strengths**');
    expect(parsed.analysis).toContain('- Stable');
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
    const parsed = AnalysisResponseStrictSchema.parse(await res.json());
    expect(parsed.analysis).toContain('Quicksort');
    expect(parsed.analysis).not.toContain('**Strengths**');
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

  it('returns 200 with empty analysis when sort-bot-api 412s with code=bot_not_evaluated (regression)', async () => {
    // Upstream emits 412 while a bot is in `evaluating` status. The
    // dedicated analysis tab calls this endpoint independently of the
    // rich bot GET (which already swallows the same error). Without the
    // 412 branch, the tab 500s and the FE swaps in ErrorBoundary.
    server.use(
      http.get(`${UPSTREAM}/v1/bots/bot_evaluating/analysis`, () =>
        HttpResponse.json(
          {
            code: 'bot_not_evaluated',
            error: 'bot is evaluating; analysis is available only after status=evaluated',
          },
          { status: 412 },
        ),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_evaluating/analysis');
    expect(res.status).toBe(200);
    const parsed = AnalysisResponseStrictSchema.parse(await res.json());
    expect(parsed.bot_id).toBe('bot_evaluating');
    expect(parsed.analysis).toBe('');
  });
});

describe('GET /api/v1/bots/:id/runs', () => {
  it('returns an empty CursorPage<BotRun> regardless of upstream', async () => {
    // No upstream handler is registered: the route must not call upstream.
    // (onUnhandledRequest: 'error' would fail the test if it did.)
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots/bot_xyz/runs');
    expect(res.status).toBe(200);
    const parsed = CursorPageSchema(BotRunStrictSchema).parse(await res.json());
    expect(parsed.items).toEqual([]);
    expect(parsed.next_cursor).toBeNull();
  });
});
