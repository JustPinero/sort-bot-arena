import { Hono } from 'hono';
import { z } from 'zod';

import { decryptString } from '../auth/encrypt.js';
import { requireAuth, getUser, type AppContext } from '../auth/middleware.js';
import { SortBotApiError, type SortBotApiClient } from '../clients/sort-bot-api/index.js';
import { CACHE_TTL_MS } from '../lib/cache-ttl.js';
import { withStaleFallback } from '../lib/upstream-fallback.js';
import { recordUpload } from '../store/uploaded-inputs.js';

import type { Client } from '@libsql/client';

interface InputSummary {
  id: string;
  name: string;
  size: number;
  description?: string;
}

interface InputsPayload {
  items: InputSummary[];
  next_cursor: null;
}

const uploadSchema = z.object({
  values: z
    .array(z.number().int())
    .min(1)
    .max(50_000),
  format: z.enum(['comma', 'space', 'newline']).optional().default('comma'),
  display_name: z.string().min(1).max(80).optional(),
});

type UploadFormat = 'comma' | 'space' | 'newline';

export function serializeValues(values: number[], format: UploadFormat): string {
  const sep = format === 'comma' ? ',' : format === 'space' ? ' ' : '\n';
  return values.join(sep);
}

export function inputsRoutes(deps: {
  db: Client;
  sortBotApi: SortBotApiClient;
  sessionSecret: string;
}): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.get('/', async (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 100;
    const cacheKey = `inputs:${limit}`;

    try {
      const result = await withStaleFallback<InputsPayload>({
        db: deps.db,
        cacheKey,
        ttlMs: CACHE_TTL_MS.inputs,
        fetch: async () => {
          const upstream = await deps.sortBotApi.getInputs({ limit });
          const items: InputSummary[] = upstream.inputs.map((i) => ({
            id: String(i.id),
            name: `${capitalize(i.size_class)} #${i.case_index + 1}`,
            size: i.array_len,
          }));
          return { items, next_cursor: null };
        },
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

  r.post('/', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), async (c) => {
    const me = getUser(c);
    const parsed = uploadSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'bad_field', issues: parsed.error.issues }, 400);
    }
    const { values, format, display_name } = parsed.data;

    const serialized = serializeValues(values, format);
    const apiKey = decryptString(me.sort_bot_api_key_encrypted, deps.sessionSecret);

    try {
      const upstream = await deps.sortBotApi.uploadInput(apiKey, {
        file: new Blob([serialized], { type: 'text/plain' }),
        ...(display_name !== undefined && { name: display_name }),
      });

      await recordUpload(deps.db, {
        sort_bot_api_input_id: upstream.id,
        uploader_user_id: me.id,
        display_name: display_name ?? null,
        size_class: upstream.size_class,
        array_len: upstream.array_len,
      });

      const summary: InputSummary = {
        id: String(upstream.id),
        name: display_name ?? `${capitalize(upstream.size_class)} custom`,
        size: upstream.array_len,
      };
      return c.json(summary, 201);
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

  return r;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
