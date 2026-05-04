import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CursorPageSchema,
  InputSummaryStrictSchema,
  LeaderboardEntryStrictSchema,
  PerInputLeaderboardEntryStrictSchema,
} from '../../src/api/schemas.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FRESH_LEADERBOARD = {
  filter: {},
  total_inputs: 10,
  bots: [
    {
      bot_id: 'bot_alpha',
      display_name: 'Alpha',
      language: 'python',
      score: 12,
      inputs_covered: 10,
      total_inputs: 10,
      incomplete: false,
      rank: 1,
    },
    {
      bot_id: 'bot_beta',
      display_name: 'Beta',
      language: 'rust',
      score: 8,
      inputs_covered: 10,
      total_inputs: 10,
      incomplete: false,
      rank: 2,
    },
  ],
};

const INPUTS_RESPONSE = {
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
    {
      id: 2,
      size_class: 'small',
      case_index: 2,
      array_len: 100,
      is_custom: false,
      uploader_id: null,
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
  total: 2,
};

const PER_INPUT_RESPONSE = {
  input_id: 1,
  bots: [
    {
      bot_id: 'bot_alpha',
      display_name: 'Alpha',
      language: 'python',
      duration_ms: 1500,
      rank: 1,
    },
    {
      bot_id: 'bot_beta',
      display_name: 'Beta',
      language: 'rust',
      duration_ms: 2200,
      rank: 2,
    },
  ],
};

describe('GET /api/v1/leaderboard shape', () => {
  it('returns CursorPage shape with items + next_cursor and no entries/total_inputs', async () => {
    server.use(http.get(`${UPSTREAM}/v1/leaderboard`, () => HttpResponse.json(FRESH_LEADERBOARD)));
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const res = await t.app.request('/api/v1/leaderboard?limit=10');
    expect(res.status).toBe(200);
    const parsed = CursorPageSchema(LeaderboardEntryStrictSchema).parse(await res.json());

    expect(parsed.next_cursor).toBeNull();
    expect(parsed.items[0]?.bot_id).toBe('bot_alpha');
    expect(parsed.items[0]?.rank).toBe(1);
  });

  it('surfaces stale + stale_age_ms on the body and X-Stale header when upstream is down', async () => {
    let upstreamUp = true;
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () => {
        if (!upstreamUp) {
          return HttpResponse.json({ error: 'down' }, { status: 503 });
        }
        return HttpResponse.json(FRESH_LEADERBOARD);
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

    const StalePageSchema = CursorPageSchema(LeaderboardEntryStrictSchema).extend({
      stale: z.boolean(),
      stale_age_ms: z.number(),
    });
    const body = StalePageSchema.parse(await stale.json());
    expect(body.items[0]?.bot_id).toBe('bot_alpha');
    expect(body.next_cursor).toBeNull();
    expect(body.stale).toBe(true);
  }, 15_000);
});

describe('GET /api/v1/leaderboard/inputs/:id shape', () => {
  it('returns {input: InputSummary, items, next_cursor} with PerInputLeaderboardEntry shape', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard/inputs/1`, () => HttpResponse.json(PER_INPUT_RESPONSE)),
      http.get(`${UPSTREAM}/v1/inputs`, () => HttpResponse.json(INPUTS_RESPONSE)),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const res = await t.app.request('/api/v1/leaderboard/inputs/1');
    expect(res.status).toBe(200);
    const PerInputPageSchema = CursorPageSchema(PerInputLeaderboardEntryStrictSchema).extend({
      input: InputSummaryStrictSchema,
    });
    const parsed = PerInputPageSchema.parse(await res.json());

    expect(parsed.input).toEqual({ id: '1', name: 'Large #1', size: 100000 });
    expect(parsed.next_cursor).toBeNull();
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0]?.bot_id).toBe('bot_alpha');
    expect(parsed.items[0]?.rank_in_field).toBe(1);
    expect(parsed.items[0]?.time_seconds).toBe(1.5);
  });
});
