import { http, HttpResponse } from 'msw';

import {
  achievementsCatalog,
  allBattles,
  allBotsById,
  championAnalysis,
  championInputs,
  championRuns,
  championSnapshots,
  hallOfFame,
  homeSnapshot,
  leaderboardEntries,
  liveFeedTail,
  myBots,
  perInputLeaderboard,
  sampleBattle,
  sampleInputs,
  sampleTournaments,
} from './fixtures';

const BASE = 'http://api.test';

export const defaultHandlers = [
  http.get(`${BASE}/api/healthz`, () =>
    HttpResponse.json({ status: 'ok' }, { headers: { 'X-Request-Id': 'req-health-1' } }),
  ),

  http.post(`${BASE}/api/v1/auth/signup`, async ({ request }) => {
    const body = (await request.json()) as { display_name?: string; email?: string };
    return HttpResponse.json(
      {
        id: 'usr_test_1',
        display_name: body.display_name ?? 'Test User',
        email: body.email ?? 'test@example.com',
      },
      { status: 201, headers: { 'Set-Cookie': 'session=test-jwt; HttpOnly; Path=/' } },
    );
  }),

  http.post(`${BASE}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    return HttpResponse.json(
      { id: 'usr_test_1', display_name: 'Test User', email: body.email ?? 'test@example.com' },
      { headers: { 'Set-Cookie': 'session=test-jwt; HttpOnly; Path=/' } },
    );
  }),

  http.post(`${BASE}/api/v1/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/api/v1/auth/me`, () =>
    HttpResponse.json({ id: 'usr_test_1', display_name: 'Test User', email: 'test@example.com' }),
  ),

  http.get(`${BASE}/api/v1/bots/:botId`, ({ params }) => {
    const botId = params.botId as string;
    const bot = allBotsById[botId];
    if (!bot) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(bot);
  }),

  http.get(`${BASE}/api/v1/bots/:botId/runs`, ({ params }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ items: championRuns, next_cursor: null });
  }),

  http.get(`${BASE}/api/v1/bots/:botId/snapshots`, ({ params }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(championSnapshots);
  }),

  http.get(`${BASE}/api/v1/bots/:botId/inputs`, ({ params }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'bot not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(championInputs);
  }),

  http.get(`${BASE}/api/v1/bots/:botId/analysis`, ({ params }) => {
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

  http.get(`${BASE}/api/v1/leaderboard`, ({ request }) => {
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

  http.get(`${BASE}/api/v1/leaderboard/inputs/:inputId`, ({ params }) => {
    const inputId = params.inputId as string;
    const input = sampleInputs.find((i) => i.id === inputId);
    if (!input) {
      return HttpResponse.json({ error: 'input not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ input, items: perInputLeaderboard, next_cursor: null });
  }),

  http.get(`${BASE}/api/v1/inputs`, () =>
    HttpResponse.json({ items: sampleInputs, next_cursor: null }),
  ),

  http.get(`${BASE}/api/v1/battles`, () => HttpResponse.json({ items: allBattles, next_cursor: null })),

  http.get(`${BASE}/api/v1/battles/:battleId`, ({ params }) => {
    const battleId = params.battleId as string;
    if (battleId !== sampleBattle.id) {
      return HttpResponse.json({ error: 'battle not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(sampleBattle);
  }),

  http.post(`${BASE}/api/v1/bots`, async ({ request }) => {
    const body = (await request.json()) as { display_name?: string; source?: string };
    if (!body.display_name) {
      return HttpResponse.json(
        {
          error: 'invalid input',
          code: 'validation_failed',
          fields: [{ path: 'display_name', message: 'must be ≥ 1 char' }],
        },
        { status: 400 },
      );
    }
    if (!body.source || body.source.length < 10) {
      return HttpResponse.json(
        {
          error: 'invalid source',
          code: 'validation_failed',
          fields: [{ path: 'source', message: 'must be at least 10 characters' }],
        },
        { status: 400 },
      );
    }
    return HttpResponse.json({ bot_id: 'bot_new_debut' }, { status: 202 });
  }),

  http.get(`${BASE}/api/v1/users/me/bots`, () => HttpResponse.json(myBots)),

  http.patch(`${BASE}/api/v1/bots/:botId`, async ({ params, request }) => {
    const botId = params.botId as string;
    if (!allBotsById[botId]) {
      return HttpResponse.json({ error: 'not found', code: 'not_found' }, { status: 404 });
    }
    const body = (await request.json()) as { display_name?: string; retired?: boolean };
    return HttpResponse.json({ ...allBotsById[botId], ...body });
  }),

  http.get(`${BASE}/api/v1/tournaments`, () =>
    HttpResponse.json({ items: sampleTournaments, next_cursor: null }),
  ),

  http.get(`${BASE}/api/v1/tournaments/:id`, ({ params }) => {
    const id = params.id as string;
    const t = sampleTournaments.find((x) => x.id === id);
    if (!t) {
      return HttpResponse.json({ error: 'not found', code: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(t);
  }),

  http.get(`${BASE}/api/v1/feed/snapshot`, () => HttpResponse.json(homeSnapshot)),

  http.get(`${BASE}/api/v1/feed`, () => HttpResponse.json({ items: liveFeedTail, next_cursor: null })),

  http.get(`${BASE}/api/v1/halloffame`, () => HttpResponse.json(hallOfFame)),

  http.get(`${BASE}/api/v1/achievements`, () => HttpResponse.json(achievementsCatalog)),

  http.get(`${BASE}/api/v1/bots/:botId/badge.svg`, ({ params }) => {
    const botId = params.botId as string;
    const bot = allBotsById[botId];
    if (!bot) {
      return new HttpResponse('not found', { status: 404 });
    }
    const headline = bot.nickname ?? bot.display_name;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="40" role="img" aria-label="${headline}: ${bot.record.wins}-${bot.record.losses}-${bot.record.draws}">
  <rect width="220" height="40" fill="#0a0a0a"/>
  <rect x="0" y="0" width="220" height="6" fill="#facc15"/>
  <text x="14" y="22" font-family="JetBrains Mono, monospace" font-size="11" fill="#a3a3a3">SORT-ARENA</text>
  <text x="14" y="34" font-family="Bebas Neue, sans-serif" font-size="14" fill="#fafaf9">${headline} · ${bot.record.wins}-${bot.record.losses}-${bot.record.draws}</text>
</svg>`;
    return new HttpResponse(svg, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  }),
];
