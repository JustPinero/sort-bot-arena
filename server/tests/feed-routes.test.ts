import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HomeSnapshotStrictSchema } from '../../src/api/schemas.js';
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
    const parsed = HomeSnapshotStrictSchema.parse(await res.json());

    expect(parsed.featured_battle_id).toBeNull();
    expect(parsed.biggest_upset).toBeNull();

    expect(parsed.champion).toMatchObject({
      bot_id: 'bot_champ',
      display_name: 'Champ',
      language: 'python',
      record: { wins: 0, losses: 0, draws: 0 },
    });
    expect(parsed.champion?.nickname).toBeTruthy();
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
    const parsed = HomeSnapshotStrictSchema.parse(await res.json());
    expect(parsed.champion).toBeNull();
    expect(parsed.rookie_of_the_day).toBeNull();
    expect(parsed.ticker).toEqual([]);
  });
});
