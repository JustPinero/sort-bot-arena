import { Hono } from 'hono';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import { nicknameFor } from '../persona/nicknames.js';
import type { AppContext } from '../auth/middleware.js';

export function feedRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // The homepage's "tale of the tape" snapshot. Composes top-3
  // leaderboard + stats + an empty events feed (slice 7 listener
  // will populate that later from sort-bot-api's global SSE).
  r.get('/snapshot', async (c) => {
    const [lb, stats] = await Promise.all([
      deps.sortBotApi.getLeaderboard({ limit: 3 }).catch(() => null),
      deps.sortBotApi.getStats().catch(() => null),
    ]);
    const top = lb?.bots ?? [];
    const personas = await Promise.all(top.map((b) => deps.persona.get(b.bot_id)));
    return c.json({
      top_3: top.map((b, i) => {
        const p = personas[i] ?? null;
        return {
          bot_id: b.bot_id,
          rank: b.rank,
          display_name: b.display_name,
          nickname: p?.nickname ?? nicknameFor(b.bot_id),
          language: b.language,
          portrait_url: p?.portrait_url ?? null,
        };
      }),
      stats: stats ?? {
        fastest_run_ms: 0,
        language_distribution: {},
        total_bots: 0,
        total_runs: 0,
      },
      featured_battle: null,
      biggest_upset: null,
      rookie_of_the_day: null,
      recent_events: [],
    });
  });

  r.get('/', (c) => c.json({ items: [], next_cursor: null }));

  return r;
}
