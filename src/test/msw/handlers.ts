import { http, HttpResponse } from 'msw';

import {
  allBattles,
  allBotsById,
  championAnalysis,
  championInputs,
  championRuns,
  championSnapshots,
  leaderboardEntries,
  perInputLeaderboard,
  sampleBattle,
  sampleInputs,
} from './fixtures';

const BASE = 'http://api.test';

export const defaultHandlers = [
  http.get(`${BASE}/healthz`, () =>
    HttpResponse.json({ status: 'ok' }, { headers: { 'X-Request-Id': 'req-health-1' } }),
  ),

  http.post(`${BASE}/v1/users`, async ({ request }) => {
    const body = (await request.json()) as { display_name?: string };
    return HttpResponse.json(
      {
        id: 'usr_test_1',
        display_name: body.display_name ?? 'anonymous-test-0000',
        api_key: 'key_test_abc123',
      },
      { headers: { 'X-Request-Id': 'req-users-1' } },
    );
  }),

  http.get(`${BASE}/v1/users/me`, () =>
    HttpResponse.json({ id: 'usr_test_1', display_name: 'anonymous-test-0000' }),
  ),

  http.get(`${BASE}/v1/bots/:botId`, ({ params }) => {
    const botId = params.botId as string;
    const bot = allBotsById[botId];
    if (!bot) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(bot);
  }),

  http.get(`${BASE}/v1/bots/:botId/runs`, ({ params }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ items: championRuns, next_cursor: null });
  }),

  http.get(`${BASE}/v1/bots/:botId/snapshots`, ({ params }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(championSnapshots);
  }),

  http.get(`${BASE}/v1/bots/:botId/inputs`, ({ params }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(championInputs);
  }),

  http.get(`${BASE}/v1/bots/:botId/analysis`, ({ params }) => {
    const botId = params.botId as string;
    const bot = allBotsById[botId];
    if (!bot) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    if (!bot.analysis_url) {
      return HttpResponse.json(
        { error: 'analysis not available', code: 'analysis_unavailable' },
        { status: 503 },
      );
    }
    return HttpResponse.json(championAnalysis);
  }),

  http.get(`${BASE}/v1/leaderboard`, ({ request }) => {
    const url = new URL(request.url);
    const weight = url.searchParams.get('weight') ?? 'all';
    const language = url.searchParams.get('language');

    const filtered = leaderboardEntries.filter((e) => {
      if (e.retired) return false;
      if (language && e.language !== language) return false;
      if (weight === 'all') return true;
      const wMap: Record<string, string[]> = {
        heavyweight: ['binary'],
        cruiserweight: ['go'],
        middleweight: ['node'],
        lightweight: ['python'],
      };
      const langs = wMap[weight];
      return Boolean(langs?.includes(e.language));
    });

    return HttpResponse.json({ items: filtered, next_cursor: null });
  }),

  http.get(`${BASE}/v1/leaderboard/inputs/:inputId`, ({ params }) => {
    const inputId = params.inputId as string;
    const input = sampleInputs.find((i) => i.id === inputId);
    if (!input) {
      return HttpResponse.json({ error: 'input not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ input, items: perInputLeaderboard, next_cursor: null });
  }),

  http.get(`${BASE}/v1/inputs`, () =>
    HttpResponse.json({ items: sampleInputs, next_cursor: null }),
  ),

  http.get(`${BASE}/v1/battles`, () => HttpResponse.json({ items: allBattles, next_cursor: null })),

  http.get(`${BASE}/v1/battles/:battleId`, ({ params }) => {
    const battleId = params.battleId as string;
    if (battleId !== sampleBattle.id) {
      return HttpResponse.json({ error: 'battle not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(sampleBattle);
  }),
];
