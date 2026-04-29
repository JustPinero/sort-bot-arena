import { Hono } from 'hono';
import type { Client } from '@libsql/client';
import { z } from 'zod';
import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { synthesizeBot } from '../synthesize/bot.js';
import { decryptString } from '../auth/encrypt.js';
import { requireAuth, getUser, type AppContext } from '../auth/middleware.js';
import { isUserOwnerOf, markRetired, recordUserBot } from '../store/user-bots.js';

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
}): Hono<AppContext> {
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

  r.post(
    '/',
    requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }),
    async (c) => {
      const me = getUser(c);
      const body = submitSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: 'bad_field', issues: body.error.issues }, 400);
      }
      const apiKey = decryptString(
        me.sort_bot_api_key_encrypted,
        deps.sessionSecret,
      );
      try {
        const created = await deps.sortBotApi.submitBot(apiKey, {
          display_name: body.data.display_name,
          language: body.data.language,
          source: new Blob([body.data.source], { type: 'text/plain' }),
        });
        await recordUserBot(deps.db, me.id, created.id);
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
    },
  );

  r.patch(
    '/:id',
    requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }),
    async (c) => {
      const me = getUser(c);
      const id = c.req.param('id');
      if (!(await isUserOwnerOf(deps.db, me.id, id))) {
        return c.json({ error: 'not_owner' }, 403);
      }
      const body = patchSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) {
        return c.json({ error: 'bad_field', issues: body.error.issues }, 400);
      }
      const apiKey = decryptString(
        me.sort_bot_api_key_encrypted,
        deps.sessionSecret,
      );
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
    },
  );

  r.delete(
    '/:id',
    requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }),
    async (c) => {
      const me = getUser(c);
      const id = c.req.param('id');
      if (!(await isUserOwnerOf(deps.db, me.id, id))) {
        return c.json({ error: 'not_owner' }, 403);
      }
      const apiKey = decryptString(
        me.sort_bot_api_key_encrypted,
        deps.sessionSecret,
      );
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
    },
  );

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
