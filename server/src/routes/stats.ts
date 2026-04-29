import { Hono } from 'hono';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { AppContext } from '../auth/middleware.js';

export function statsRoutes(deps: { sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();
  r.get('/', async (c) => {
    const stats = await deps.sortBotApi.getStats();
    return c.json(stats);
  });
  return r;
}
