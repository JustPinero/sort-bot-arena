import { Hono } from 'hono';

import { SortBotApiError, type SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { CACHE_TTL_MS } from '../lib/cache-ttl.js';
import { withStaleFallback } from '../lib/upstream-fallback.js';

import type { AppContext } from '../auth/middleware.js';
import type { Client } from '@libsql/client';

interface InputSummary {
  id: string;
  name: string;
  size: number;
  description?: string;
}

interface InputsPayload {
  items: InputSummary[];
  next_cursor: null;
}

export function inputsRoutes(deps: { db: Client; sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/', async (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 100;
    const cacheKey = `inputs:${limit}`;

    try {
      const result = await withStaleFallback<InputsPayload>({
        db: deps.db,
        cacheKey,
        ttlMs: CACHE_TTL_MS.inputs,
        fetch: async () => {
          const upstream = await deps.sortBotApi.getInputs({ limit });
          const items: InputSummary[] = upstream.inputs.map((i) => ({
            id: String(i.id),
            name: `${capitalize(i.size_class)} #${i.case_index + 1}`,
            size: i.array_len,
          }));
          return { items, next_cursor: null };
        },
      });
      if (result.stale) {
        c.header('X-Stale', 'true');
        c.header('X-Stale-Age-Ms', String(result.ageMs));
      }
      return c.json(result.body);
    } catch (err) {
      if (err instanceof SortBotApiError) {
        return c.json({ error: 'upstream_failure', upstream_status: err.status }, 502);
      }
      throw err;
    }
  });

  return r;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
