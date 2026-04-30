import { Hono } from 'hono';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { nicknameFor } from '../persona/nicknames.js';
import type { PersonaService } from '../persona/service.js';
import type { AppContext } from '../auth/middleware.js';

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

export function leaderboardRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/', async (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam))) : 50;
    const language = c.req.query('language');

    const lb = await deps.sortBotApi.getLeaderboard({
      limit,
      ...(language && { language }),
    });

    const personas = await Promise.all(lb.bots.map((b) => deps.persona.get(b.bot_id)));
    const entries: LeaderboardEntry[] = lb.bots.map((b, i) => {
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

    return c.json({ entries, total_inputs: lb.total_inputs });
  });

  return r;
}
