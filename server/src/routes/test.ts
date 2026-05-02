// Test-only routes — gated behind ENABLE_TEST_RESET (or NODE_ENV=test) so
// they NEVER ship to production. The `mountTestRoutes` helper is called
// from `createApp` only when `deps.enableTestReset === true`.
//
// `/api/test/reset` drops every app-owned table and re-runs the in-memory
// libsql migrations. Used between Playwright real-server specs to
// guarantee a fresh DB without restarting the server process.

import { Hono } from 'hono';

import { runMigrations } from '../db/migrate.js';

import type { AppContext } from '../auth/middleware.js';
import type { Client } from '@libsql/client';

interface Deps {
  db: Client;
}

// Tables created by `server/src/db/schema.ts`. Drop in reverse-dependency
// order so FKs (e.g. tournament_matches → recent_tournaments) don't fight
// us. We also drop `schema_migrations` so `runMigrations` re-applies
// every migration cleanly.
const TABLES_IN_DROP_ORDER = [
  'tournament_matches',
  'recent_tournaments',
  'recent_battles',
  'uploaded_inputs',
  'upstream_cache',
  'bot_personas',
  'user_bots',
  'users',
  'schema_migrations',
];

export function testRoutes(deps: Deps): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.post('/reset', async (c) => {
    for (const table of TABLES_IN_DROP_ORDER) {
      await deps.db.execute(`DROP TABLE IF EXISTS ${table}`);
    }
    await runMigrations(deps.db);
    return c.json({ ok: true });
  });

  return r;
}
