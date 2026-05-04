// Test-only routes — gated behind ENABLE_TEST_RESET (or NODE_ENV=test) so
// they NEVER ship to production. The `mountTestRoutes` helper is called
// from `createApp` only when `deps.enableTestReset === true`.
//
// `/api/test/reset` drops every app-owned table and re-runs the in-memory
// libsql migrations. Used between Playwright real-server specs to
// guarantee a fresh DB without restarting the server process.
//
// `/api/test/advance-match` simulates what the global SSE listener does
// on a `battle_complete` event: looks up the tournament_matches row by
// battle_id, sets the winner on it, and calls `orchestrator.advanceMatch`.
// The G6 tournament spec drives the bracket forward through this endpoint
// so we don't need a real SSE stream + listener in the E2E harness.

import { Hono } from 'hono';

import { runMigrations } from '../db/migrate.js';
import { listAllForTournament } from '../store/tournament-matches.js';

import type { OrchestratorHandle } from './tournaments.js';
import type { AppContext } from '../auth/middleware.js';
import type { Client } from '@libsql/client';

interface Deps {
  db: Client;
  orchestrator?: OrchestratorHandle;
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

  // POST /api/test/advance-match { tournament_id, battle_id, winner_bot_id }
  // Looks up the in_flight match by battle_id, attaches the winner to a
  // copy of the row, and feeds it to `orchestrator.advanceMatch` — the
  // same call shape the global listener uses. Returns 404 when no
  // in_flight match maps to the given battle_id (e.g. when the spec is
  // racing the orchestrator's own startBattle and called too early).
  r.post('/advance-match', async (c) => {
    if (!deps.orchestrator) {
      return c.json({ error: 'orchestrator_not_wired' }, 503);
    }
    const body = (await c.req.json().catch(() => null)) as {
      tournament_id?: string;
      battle_id?: string;
      winner_bot_id?: string;
    } | null;
    if (!body?.tournament_id || !body?.battle_id || !body?.winner_bot_id) {
      return c.json(
        { error: 'bad_request', expected: ['tournament_id', 'battle_id', 'winner_bot_id'] },
        400,
      );
    }
    const matches = await listAllForTournament(deps.db, body.tournament_id);
    const target = matches.find((m) => m.battle_id === body.battle_id);
    if (!target) return c.json({ error: 'not_found', battle_id: body.battle_id }, 404);
    await deps.orchestrator.advanceMatch({ ...target, winner_bot_id: body.winner_bot_id });
    return c.json({ ok: true, match_id: target.match_id });
  });

  return r;
}
