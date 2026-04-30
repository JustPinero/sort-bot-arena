import { Hono } from 'hono';
import type { Client } from '@libsql/client';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import { synthesizeBot } from '../synthesize/bot.js';
import type { AppContext } from '../auth/middleware.js';

export function hallOfFameRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // Hall of Fame = bots whose user_bots row has retired_at set. We
  // refetch each from sort-bot-api so the frontend gets fresh stats
  // alongside the persona/career data.
  r.get('/', async (c) => {
    const res = await deps.db.execute({
      sql: `SELECT sort_bot_api_bot_id, retired_at
              FROM user_bots
             WHERE retired_at IS NOT NULL
          ORDER BY retired_at DESC
             LIMIT 100`,
      args: [],
    });
    const ids = res.rows.map(
      (r) => (r as unknown as Record<string, string>)['sort_bot_api_bot_id']!,
    );
    const bots = await Promise.all(
      ids.map(async (id) => {
        const [bot, profile, persona] = await Promise.all([
          deps.sortBotApi.getBot(id).catch(() => null),
          deps.sortBotApi.getBotProfile(id).catch(() => undefined),
          deps.persona.get(id),
        ]);
        if (!bot) return null;
        return synthesizeBot({ bot, profile, persona, retired: true });
      }),
    );
    return c.json({ bots: bots.filter((b) => b !== null) });
  });

  return r;
}
