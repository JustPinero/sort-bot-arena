import { Hono } from 'hono';

import { nicknameFor } from '../persona/nicknames.js';

import type { AppContext } from '../auth/middleware.js';
import type { SortBotApiClient, LeaderboardRow } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { BotPersonaRow } from '../persona/store.js';

interface SnapshotBot {
  bot_id: string;
  nickname: string | null;
  display_name: string;
  language: string;
  portrait_url: string | null;
  record: { wins: number; losses: number; draws: number };
}

function toSnapshotBot(row: LeaderboardRow, persona: BotPersonaRow | null): SnapshotBot {
  return {
    bot_id: row.bot_id,
    nickname: persona?.nickname ?? nicknameFor(row.bot_id),
    display_name: row.display_name,
    language: row.language,
    portrait_url: persona?.portrait_url ?? null,
    record: { wins: 0, losses: 0, draws: 0 },
  };
}

export function feedRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  // HomeSnapshot for the homepage. Slice 7 listener + battle history are
  // deferred, so ticker is empty, biggest_upset / featured_battle_id are
  // null, and records are zeroed. Champion + rookie come from the live
  // top-3 leaderboard plus persona for nickname/portrait.
  r.get('/snapshot', async (c) => {
    const lb = await deps.sortBotApi.getLeaderboard({ limit: 3 }).catch(() => null);
    const top = lb?.bots ?? [];
    const personas = await Promise.all(top.map((b) => deps.persona.get(b.bot_id).catch(() => null)));

    // Backfill personas for any bot we're about to surface. Covers the
    // top-3 ticker bots regardless of whether they end up populating
    // champion or rookie slots.
    for (let i = 0; i < top.length; i++) {
      if (!personas[i]) {
        const b = top[i]!;
        deps.persona.startBackgroundGeneration({
          bot_id: b.bot_id,
          display_name: b.display_name,
          language: b.language,
          algorithm: null,
        });
      }
    }

    const championRow = top[0] ?? null;
    const rookieRow = top[1] ?? top[2] ?? null;

    const champion = championRow ? toSnapshotBot(championRow, personas[0] ?? null) : null;
    const rookie_of_the_day = rookieRow
      ? toSnapshotBot(rookieRow, personas[top.indexOf(rookieRow)] ?? null)
      : null;

    return c.json({
      ticker: [],
      featured_battle_id: null,
      rookie_of_the_day,
      biggest_upset: null,
      champion,
    });
  });

  r.get('/', (c) => c.json({ items: [], next_cursor: null }));

  return r;
}
