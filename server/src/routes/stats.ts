import { Hono } from 'hono';

import {
  SortBotApiError,
  type SortBotApiClient,
  type StatsResponse,
} from '../clients/sort-bot-api/index.js';
import { CACHE_TTL_MS } from '../lib/cache-ttl.js';
import { withStaleFallback } from '../lib/upstream-fallback.js';

import type { AppContext } from '../auth/middleware.js';
import type { Client } from '@libsql/client';

export function statsRoutes(deps: { db: Client; sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();
  r.get('/', async (c) => {
    try {
      const result = await withStaleFallback<StatsResponse>({
        db: deps.db,
        cacheKey: 'stats',
        ttlMs: CACHE_TTL_MS.stats,
        fetch: () => deps.sortBotApi.getStats(),
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
