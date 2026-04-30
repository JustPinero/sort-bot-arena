import { Hono } from 'hono';

import { nicknameFor } from '../persona/nicknames.js';

import type { AppContext } from '../auth/middleware.js';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';

export function perInputLeaderboardRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/inputs/:input_id', async (c) => {
    const inputId = Number(c.req.param('input_id'));
    if (!Number.isInteger(inputId) || inputId <= 0) {
      return c.json({ error: 'bad_field' }, 400);
    }
    const upstream = await deps.sortBotApi.getPerInputLeaderboard(inputId);
    const personas = await Promise.all(upstream.bots.map((b) => deps.persona.get(b.bot_id)));
    return c.json({
      input_id: inputId,
      entries: upstream.bots.map((b, i) => {
        const p = personas[i] ?? null;
        return {
          bot_id: b.bot_id,
          rank_in_field: b.rank,
          display_name: b.display_name,
          nickname: p?.nickname ?? nicknameFor(b.bot_id),
          language: b.language,
          portrait_url: p?.portrait_url ?? null,
          time_seconds: b.duration_ms / 1000,
          achieved_at: new Date().toISOString(),
        };
      }),
    });
  });

  return r;
}
