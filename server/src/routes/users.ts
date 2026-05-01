import { Hono } from 'hono';

import { requireAuth, getUser, type AppContext } from '../auth/middleware.js';
import { listUserBotIds } from '../store/user-bots.js';
import { synthesizeBot } from '../synthesize/bot.js';

import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { Client } from '@libsql/client';

export function userRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  sessionSecret: string;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/me/bots', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const ids = await listUserBotIds(deps.db, me.id);
    const bots = await Promise.all(
      ids.map(async (id) => {
        const [bot, profile, persona] = await Promise.all([
          deps.sortBotApi.getBot(id).catch(() => null),
          deps.sortBotApi.getBotProfile(id).catch(() => undefined),
          deps.persona.get(id),
        ]);
        if (!bot) return null;
        return synthesizeBot({ bot, profile, persona });
      }),
    );
    return c.json(bots.filter((b) => b !== null));
  });

  return r;
}
