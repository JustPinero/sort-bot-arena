import { Hono } from 'hono';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { synthesizeBot } from '../synthesize/bot.js';
import type { AppContext } from '../auth/middleware.js';

export function botsRoutes(deps: { sortBotApi: SortBotApiClient }): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const [bot, profile, analysis] = await Promise.all([
        deps.sortBotApi.getBot(id),
        deps.sortBotApi.getBotProfile(id).catch(() => undefined),
        deps.sortBotApi
          .getBotAnalysis(id)
          .catch(() => null)
          .then((a) => (a && typeof a === 'object' ? (a as { algorithm?: string }).algorithm ?? null : null)),
      ]);
      const synth = synthesizeBot({ bot, profile, algorithm: analysis });
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
        analysis,
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
      }
      throw err;
    }
  });

  r.get('/:id/runs', async (c) => {
    const id = c.req.param('id');
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 50;
    try {
      const runs = await deps.sortBotApi.getBotRuns(id, { limit });
      return c.json(runs);
    } catch (err) {
      if (err instanceof SortBotApiError && err.status === 404) {
        return c.json({ error: 'not_found' }, 404);
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
