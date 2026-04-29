import { Hono } from 'hono';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import type { AppContext } from '../auth/middleware.js';

export function h2hRoutes(deps: { sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/:a/vs/:b', async (c) => {
    const a = c.req.param('a');
    const b = c.req.param('b');
    try {
      const res = await deps.sortBotApi.getHeadToHead(a, b);
      return c.json(res);
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });
  return r;
}
