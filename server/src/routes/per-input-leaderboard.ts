import { Hono } from 'hono';

import { nicknameFor } from '../persona/nicknames.js';

import type { AppContext } from '../auth/middleware.js';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';

interface InputSummary {
  id: string;
  name: string;
  size: number;
}

export function perInputLeaderboardRoutes(deps: {
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/inputs/:input_id', async (c) => {
    const inputId = Number(c.req.param('input_id'));
    if (!Number.isInteger(inputId) || inputId <= 0) {
      return c.json({ error: 'bad_field' }, 400);
    }
    const [upstream, inputsResp] = await Promise.all([
      deps.sortBotApi.getPerInputLeaderboard(inputId),
      deps.sortBotApi.getInputs(),
    ]);
    const match = inputsResp.inputs.find((i) => i.id === inputId);
    if (!match) {
      return c.json({ error: 'not_found' }, 404);
    }
    const input: InputSummary = {
      id: String(match.id),
      name: `${capitalize(match.size_class)} #${match.case_index + 1}`,
      size: match.array_len,
    };
    const personas = await Promise.all(upstream.bots.map((b) => deps.persona.get(b.bot_id)));
    // Backfill personas for any per-input leaderboard row that lacks one.
    for (let i = 0; i < upstream.bots.length; i++) {
      if (!personas[i]) {
        const b = upstream.bots[i]!;
        deps.persona.startBackgroundGeneration({
          bot_id: b.bot_id,
          display_name: b.display_name,
          language: b.language,
          algorithm: null,
        });
      }
    }
    return c.json({
      input,
      items: upstream.bots.map((b, i) => {
        const p = personas[i] ?? null;
        return {
          bot_id: b.bot_id,
          rank_in_field: b.rank,
          display_name: b.display_name,
          nickname: p?.nickname ?? nicknameFor(b.bot_id),
          language: b.language,
          portrait_url: p?.portrait_url ?? null,
          time_seconds: b.duration_ms / 1000,
          achieved_at: new Date().toISOString(),
        };
      }),
      next_cursor: null,
    });
  });

  return r;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
