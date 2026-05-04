import { Hono } from 'hono';

import { SortBotApiError, type SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { CACHE_TTL_MS } from '../lib/cache-ttl.js';
import { withStaleFallback } from '../lib/upstream-fallback.js';
import { nicknameFor } from '../persona/nicknames.js';
import {
  deriveRecordFromRows,
  listCompletedForBots,
  type RecentBattleRow,
} from '../store/recent-battles.js';

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
          // Phase 11 T2.2 — single batched read of completed battles
          // for every bot on the page; group in memory by bot_id; pass
          // the per-bot slice to `deriveRecordFromRows`. Listener +
          // 60s sweep populate `recent_battles` so this is the closure
          // of the D-8 wiring (the listener landed in phase 10; the
          // consumer was still hardcoded to 0-0-0 until now).
          const botIds = lb.bots.map((b) => b.bot_id);
          const battleRows = await listCompletedForBots(deps.db, botIds);
          const rowsByBot = new Map<string, RecentBattleRow[]>();
          for (const row of battleRows) {
            for (const id of [row.bot_a_id, row.bot_b_id]) {
              const list = rowsByBot.get(id) ?? [];
              list.push(row);
              rowsByBot.set(id, list);
            }
          }
          const items: LeaderboardEntry[] = lb.bots.map((b, i) => {
            const p = personas[i] ?? null;
            const rows = rowsByBot.get(b.bot_id) ?? [];
            const record = deriveRecordFromRows(b.bot_id, rows);
            // Newest first (store helper already sorts that way) — pick
            // the freshest completed battle's timestamp as last_fight_at.
            const lastFightAt = rows[0]?.completed_at ?? null;
            return {
              bot_id: b.bot_id,
              rank: b.rank,
              trend: 'new',
              display_name: b.display_name,
              nickname: p?.nickname ?? nicknameFor(b.bot_id),
              language: b.language,
              portrait_url: p?.portrait_url ?? null,
              record,
              // KO% would need per-run data (sandbox crash/timeout
              // signals); `recent_battles` only stores the verdict, not
              // runs. Stays 0 until we add a runs persistence layer.
              ko_percentage: 0,
              signature_input: null,
              last_fight_at: lastFightAt,
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
