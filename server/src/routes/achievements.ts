import { Hono } from 'hono';

import type { AppContext } from '../auth/middleware.js';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';

interface AchievementDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlocked_pct: number;
}

const CATALOG: ReadonlyArray<Omit<AchievementDefinition, 'unlocked_pct'>> = [
  {
    id: 'first_blood',
    name: 'First Blood',
    icon: 'sword',
    description: 'Win your first battle.',
  },
  {
    id: 'ko_king',
    name: 'KO King',
    icon: 'crown',
    description: 'Decisively dominate 10 inputs in a single battle.',
  },
  {
    id: 'giant_killer',
    name: 'Giant Killer',
    icon: 'mountain',
    description: 'Beat a top-3 ranked bot in a battle.',
  },
  {
    id: 'perfect_debut',
    name: 'Perfect Debut',
    icon: 'star',
    description: 'Win on every input on your very first evaluation.',
  },
  {
    id: 'top_10',
    name: 'Top 10',
    icon: 'medal',
    description: 'Reach the top 10 leaderboard at any point.',
  },
];

export function achievementsRoutes(deps: { sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/', async (c) => {
    // Rarity is a stat-derived guess: total_bots is the denominator,
    // we can't actually compute true rarity without battle history,
    // so we publish honest-but-approximate placeholder percentages
    // that the frontend can render. (Slice 7 / listener fills in real
    // rarity once we have battle data flowing.)
    const stats = await deps.sortBotApi.getStats().catch(() => null);
    const totalBots = stats?.total_bots ?? 0;
    const items: AchievementDefinition[] = CATALOG.map((a) => ({
      ...a,
      unlocked_pct:
        totalBots > 0 ? Math.min(100, Math.round((1 / Math.max(totalBots, 5)) * 100)) : 0,
    }));
    return c.json({ items });
  });

  return r;
}
