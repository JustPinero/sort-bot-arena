import { Hono } from 'hono';

import { SortBotApiError, type SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { CACHE_TTL_MS } from '../lib/cache-ttl.js';
import { withStaleFallback } from '../lib/upstream-fallback.js';
import { nicknameFor } from '../persona/nicknames.js';

import type { AppContext } from '../auth/middleware.js';
import type { PersonaService } from '../persona/service.js';
import type { Client } from '@libsql/client';

export interface LeaderboardEntry {
  bot_id: string;
  rank: number;
  trend: 'up' | 'down' | 'steady' | 'new' | 'returning';
  display_name: string;
  nickname: string | null;
  language: string;
  portrait_url: string | null;
  record: { wins: number; losses: number; draws: number };
  ko_percentage: number;
  signature_input: null;
  last_fight_at: string | null;
  retired: boolean;
}

interface LeaderboardPayload {
  items: LeaderboardEntry[];
  next_cursor: string | null;
}

export function leaderboardRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/', async (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam))) : 50;
    const language = c.req.query('language');
    const cacheKey = `leaderboard:${limit}:${language ?? 'all'}`;

    try {
      const result = await withStaleFallback<LeaderboardPayload>({
        db: deps.db,
        cacheKey,
        ttlMs: CACHE_TTL_MS.leaderboard,
        fetch: async () => {
          const lb = await deps.sortBotApi.getLeaderboard({
            limit,
            ...(language && { language }),
          });
          const personas = await Promise.all(lb.bots.map((b) => deps.persona.get(b.bot_id)));
          // Backfill personas for any bot in the response that lacks one.
          // Fire-and-forget; the semaphore in PersonaService caps fan-out.
          // Algorithm metadata is omitted (would require an analysis fetch
          // per row, which is too expensive for the leaderboard hot path).
          for (let i = 0; i < lb.bots.length; i++) {
            if (!personas[i]) {
              const b = lb.bots[i]!;
              deps.persona.startBackgroundGeneration({
                bot_id: b.bot_id,
                display_name: b.display_name,
                language: b.language,
                algorithm: null,
              });
            }
          }
          const items: LeaderboardEntry[] = lb.bots.map((b, i) => {
            const p = personas[i] ?? null;
            return {
              bot_id: b.bot_id,
              rank: b.rank,
              trend: 'new',
              display_name: b.display_name,
              nickname: p?.nickname ?? nicknameFor(b.bot_id),
              language: b.language,
              portrait_url: p?.portrait_url ?? null,
              record: { wins: 0, losses: 0, draws: 0 },
              ko_percentage: 0,
              signature_input: null,
              last_fight_at: null,
              retired: false,
            };
          });
          return { items, next_cursor: null };
        },
      });

      if (result.stale) {
        c.header('X-Stale', 'true');
        c.header('X-Stale-Age-Ms', String(result.ageMs));
        return c.json({ ...result.body, stale: true, stale_age_ms: result.ageMs });
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
