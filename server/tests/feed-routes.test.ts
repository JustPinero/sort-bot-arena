import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GET /api/v1/feed/snapshot', () => {
  it('returns the HomeSnapshot shape with champion populated from leaderboard', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({
          filter: {},
          total_inputs: 57,
          bots: [
            {
              bot_id: 'bot_champ',
              display_name: 'Champ',
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
    const res = await t.app.request('/api/v1/feed/snapshot');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(Array.isArray(body['ticker'])).toBe(true);

    expect('featured_battle_id' in body).toBe(true);
    expect(body['featured_battle_id']).toBeNull();

    expect('biggest_upset' in body).toBe(true);
    expect(body['biggest_upset']).toBeNull();

    expect('rookie_of_the_day' in body).toBe(true);

    expect(body['champion']).toMatchObject({
      bot_id: 'bot_champ',
      display_name: 'Champ',
      language: 'python',
      record: { wins: 0, losses: 0, draws: 0 },
    });
    const champion = body['champion'] as Record<string, unknown>;
    expect('nickname' in champion).toBe(true);
    expect('portrait_url' in champion).toBe(true);
    expect(champion['nickname']).toBeTruthy();

    // Crucially the old shape must be gone.
    expect('top_3' in body).toBe(false);
    expect('stats' in body).toBe(false);
    expect('recent_events' in body).toBe(false);
  });

  it('returns nulls for champion and rookie when leaderboard is empty', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/leaderboard`, () =>
        HttpResponse.json({ filter: {}, total_inputs: 0, bots: [] }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/feed/snapshot');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['champion']).toBeNull();
    expect(body['rookie_of_the_day']).toBeNull();
    expect(body['ticker']).toEqual([]);
  });
});
