import { Hono } from 'hono';
import { z } from 'zod';

import { decryptString } from '../auth/encrypt.js';
import { requireAuth, getUser, type AppContext } from '../auth/middleware.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { listCompletedForBot } from '../store/recent-battles.js';
import { isUserOwnerOf, markRetired, recordUserBot } from '../store/user-bots.js';
import { synthesizeBot } from '../synthesize/bot.js';

import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { PersonaService } from '../persona/service.js';
import type { Client } from '@libsql/client';

function formatAnalysis(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const a = raw as Record<string, unknown>;
  const lines: string[] = [];
  const header: string[] = [];
  if (typeof a['algorithm'] === 'string' && a['algorithm']) {
    header.push(`**Algorithm:** ${a['algorithm']}`);
  }
  if (typeof a['time_complexity_estimate'] === 'string' && a['time_complexity_estimate']) {
    header.push(`**Time complexity:** ${a['time_complexity_estimate']}`);
  }
  if (typeof a['space_complexity_estimate'] === 'string' && a['space_complexity_estimate']) {
    header.push(`**Space complexity:** ${a['space_complexity_estimate']}`);
  }
  if (header.length > 0) lines.push(header.join('\n'));

  const sections: Array<[string, string]> = [
    ['Strengths', 'strengths'],
    ['Weaknesses', 'weaknesses'],
    ['Suggested use cases', 'suggested_use_cases'],
    ['Anti-patterns', 'anti_patterns'],
  ];
  for (const [label, key] of sections) {
    const v = a[key];
    if (Array.isArray(v) && v.length > 0) {
      const bullets = v
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .map((x) => `- ${x}`)
        .join('\n');
      if (bullets) lines.push(`**${label}**\n${bullets}`);
    }
  }
  if (typeof a['reasoning'] === 'string' && a['reasoning']) {
    lines.push(a['reasoning']);
  }
  return lines.join('\n\n');
}

const submitSchema = z.object({
  display_name: z.string().min(1).max(80),
  language: z.enum(['python', 'node', 'binary']),
  source: z.string().min(1).max(200_000),
});

const patchSchema = z.object({ display_name: z.string().min(1).max(80) });

export function botsRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  sessionSecret: string;
  persona: PersonaService;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const [bot, profile, analysis, persona, battleRows] = await Promise.all([
        deps.sortBotApi.getBot(id),
        deps.sortBotApi.getBotProfile(id).catch(() => undefined),
        deps.sortBotApi
          .getBotAnalysis(id)
          .catch(() => null)
          .then((a) =>
            a && typeof a === 'object' ? ((a as { algorithm?: string }).algorithm ?? null) : null,
          ),
        deps.persona.get(id),
        // Phase 11 T2.2 — pull completed battles for this bot from the
        // listener-populated `recent_battles` table. Synthesis derives
        // W/L/D + recent_form. Failure-soft: any DB error → empty
        // history → 0-0-0 record (no worse than the prior hardcoded
        // value). Avoids any new chance of 500 on the hot profile path.
        listCompletedForBot(deps.db, id).catch(() => []),
      ]);
      // Re-kick persona generation lazily if it never ran (e.g. bot was
      // submitted before the personas table existed).
      if (!persona) {
        deps.persona.startBackgroundGeneration({
          bot_id: bot.id,
          display_name: bot.display_name,
          language: bot.language,
          algorithm: analysis,
        });
      }
      // Map `recent_battles` rows to the `BattleForBot` shape that
      // `synthesizeBot` expects. We only have the verdict (winner +
      // completed_at), not per-input runs — so `is_ko: false` for every
      // entry. KO% therefore stays 0 until a runs persistence layer
      // ships. W/L/D and recent_form are correct.
      const history = battleRows.map((row) => {
        const bot_was: 'a' | 'b' = row.bot_a_id === id ? 'a' : 'b';
        const won = row.winner_bot_id === id;
        const drawn = row.winner_bot_id === null;
        return {
          battle_id: row.battle_id,
          bot_was,
          outcome: drawn ? ('draw' as const) : won ? ('win' as const) : ('loss' as const),
          is_ko: false,
          completed_at: row.completed_at ?? row.created_at,
        };
      });
      const synth = synthesizeBot({ bot, profile, algorithm: analysis, persona, history });
      return c.json(synth);
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });

  r.get('/:id/profile', async (c) => {
    const id = c.req.param('id');
    try {
      const profile = await deps.sortBotApi.getBotProfile(id);
      return c.json(profile);
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });

  r.get('/:id/analysis', async (c) => {
    const id = c.req.param('id');
    try {
      const analysis = await deps.sortBotApi.getBotAnalysis(id);
      return c.json({
        bot_id: id,
        analysis: formatAnalysis(analysis),
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      // Upstream returns 412 with code `bot_not_evaluated` while a bot
      // is still in `evaluating` status (sandbox running or re-queued).
      // The Scouting Report tab calls this endpoint independently of
      // the rich bot GET (which already swallows the same error at
      // `routes/bots.ts:74`); without this branch the tab 500s and the
      // FE renders ErrorBoundary fallback. Return an empty analysis so
      // the tab degrades to an empty state.
      if (err instanceof SortBotApiError && err.status === 412) {
        return c.json({
          bot_id: id,
          analysis: '',
          generated_at: new Date().toISOString(),
        });
      }
      throw err;
    }
  });

  r.get('/:id/snapshots', async (c) => {
    const id = c.req.param('id');
    try {
      const rh = await deps.sortBotApi.getBotRankHistory(id);
      return c.json(rh.history.map((s) => ({ date: s.snapshot_at, rank: s.rank })));
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });

  r.get('/:id/inputs', async (c) => {
    const id = c.req.param('id');
    try {
      const profile = await deps.sortBotApi.getBotProfile(id);
      return c.json(
        profile.per_input.map((p) => ({
          input_id: String(p.input_id),
          input_name: `Input #${p.input_id}`,
          size: 0,
          time_seconds: p.median_ms / 1000,
          rank_in_field: 0,
          total_in_field: 0,
        })),
      );
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });

  r.get('/:id/runs', async (c) => {
    // Battle history listener (slice 7) is deferred — see debt.md D-8.
    // Until we record battles locally, we return an empty CursorPage<BotRun>
    // rather than the upstream's per-input runs, which have a different shape.
    return c.json({ items: [], next_cursor: null });
  });

  r.post('/', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const body = submitSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'bad_field', issues: body.error.issues }, 400);
    }
    const apiKey = decryptString(me.sort_bot_api_key_encrypted, deps.sessionSecret);
    try {
      const created = await deps.sortBotApi.submitBot(apiKey, {
        display_name: body.data.display_name,
        language: body.data.language,
        source: new Blob([body.data.source], { type: 'text/plain' }),
      });
      await recordUserBot(deps.db, me.id, created.id);
      deps.persona.startBackgroundGeneration({
        bot_id: created.id,
        display_name: created.display_name,
        language: created.language,
      });
      const synth = synthesizeBot({ bot: created });
      return c.json(synth, 201);
    } catch (err) {
      if (err instanceof SortBotApiError) {
        const status = err.status >= 500 ? 502 : err.status;
        return c.json(
          { error: 'upstream_failure', upstream_status: err.status, code: err.code },
          status as 502 | 400,
        );
      }
      throw err;
    }
  });

  r.patch('/:id', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const id = c.req.param('id');
    if (!(await isUserOwnerOf(deps.db, me.id, id))) {
      return c.json({ error: 'not_owner' }, 403);
    }
    const body = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'bad_field', issues: body.error.issues }, 400);
    }
    const apiKey = decryptString(me.sort_bot_api_key_encrypted, deps.sessionSecret);
    try {
      const updated = await deps.sortBotApi.patchBot(apiKey, id, {
        display_name: body.data.display_name,
      });
      return c.json(synthesizeBot({ bot: updated }));
    } catch (err) {
      if (err instanceof SortBotApiError) {
        return c.json({ error: 'upstream_failure', upstream_status: err.status }, 502);
      }
      throw err;
    }
  });

  r.delete('/:id', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const id = c.req.param('id');
    if (!(await isUserOwnerOf(deps.db, me.id, id))) {
      return c.json({ error: 'not_owner' }, 403);
    }
    const apiKey = decryptString(me.sort_bot_api_key_encrypted, deps.sessionSecret);
    try {
      await deps.sortBotApi.deleteBot(apiKey, id);
      await markRetired(deps.db, me.id, id);
      return c.body(null, 204);
    } catch (err) {
      if (err instanceof SortBotApiError) {
        return c.json({ error: 'upstream_failure', upstream_status: err.status }, 502);
      }
      throw err;
    }
  });

  r.get('/:id/badge.svg', async (c) => {
    const id = c.req.param('id');
    try {
      const svg = await deps.sortBotApi.getBotBadgeSvg(id);
      c.header('Content-Type', 'image/svg+xml');
      c.header('Cache-Control', 'public, max-age=300');
      return c.body(svg);
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });

  return r;
}
