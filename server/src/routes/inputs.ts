import { Hono } from 'hono';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { AppContext } from '../auth/middleware.js';

interface InputSummary {
  id: string;
  name: string;
  size: number;
  description?: string;
}

export function inputsRoutes(deps: { sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/', async (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 100;
    const upstream = await deps.sortBotApi.getInputs({ limit });
    const items: InputSummary[] = upstream.inputs.map((i) => ({
      id: String(i.id),
      name: `${capitalize(i.size_class)} #${i.case_index + 1}`,
      size: i.array_len,
    }));
    return c.json({ items, next_cursor: null });
  });

  return r;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
