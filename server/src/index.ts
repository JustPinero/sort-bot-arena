import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createClient } from '@libsql/client';

import { createApp } from './app.js';
import { decryptString } from './auth/encrypt.js';
import { SortBotApiClient } from './clients/sort-bot-api/index.js';
import { runMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';
import { CACHE_PRUNE_INTERVAL_MS } from './lib/cache-ttl.js';
import { log } from './lib/log.js';
import { initSentry } from './lib/sentry.js';
import { BattleSweeper } from './listener/battle-sweep.js';
import { GlobalEventListener } from './listener/global-listener.js';
import { TournamentOrchestrator } from './orchestrator/tournament.js';
import { AnthropicClient } from './persona/anthropic.js';
import { LeonardoClient } from './persona/leonardo.js';
import { PersonaService } from './persona/service.js';
import { pruneExpired } from './store/upstream-cache.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    ...(env.SENTRY_RELEASE !== undefined && { release: env.SENTRY_RELEASE }),
  });
  const db = createClient(
    env.DATABASE_AUTH_TOKEN
      ? { url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }
      : { url: env.DATABASE_URL },
  );
  await runMigrations(db);

  const sortBotApi = new SortBotApiClient({ baseUrl: env.SORT_BOT_API_URL });
  const leonardo = env.LEONARDO_API_KEY
    ? new LeonardoClient({ apiKey: env.LEONARDO_API_KEY })
    : undefined;
  const anthropic = env.ANTHROPIC_API_KEY
    ? new AnthropicClient({ apiKey: env.ANTHROPIC_API_KEY })
    : undefined;
  const persona = new PersonaService({ db, leonardo, anthropic });
  log.info(
    {
      leonardo: Boolean(leonardo),
      anthropic: Boolean(anthropic),
    },
    'persona generators wired',
  );
  // Slice D4 — orchestrator core constructed first so the listener and
  // tournaments POST handler can both hold a handle to it. The
  // listener's `advanceMatch` callback closes the loop (battle_complete
  // → mark match complete → schedule next round); the POST handler's
  // fire-and-forget `schedule(...)` kicks off round 1.
  const orchestrator = new TournamentOrchestrator({
    db,
    sortBotApi,
    decryptKey: (blob) => decryptString(blob, env.SESSION_SECRET),
  });

  // Slice C4 (D-8) — reactive `running → complete` transitions via the
  // upstream `/v1/events/stream`. Single-instance per environment (Railway
  // single-replica + RUN_LISTENER set on exactly that replica). The 60s
  // sweep below is the safety net for events lost during reconnect windows.
  // Constructed before `createApp` so its health getters can be passed
  // into `/api/readyz` (slice C5). When RUN_LISTENER=false the instance
  // is still constructed — `start()` is a no-op and `isRunning()` stays
  // false, which is exactly what readyz wants to surface.
  const listener = new GlobalEventListener({
    db,
    sortBotApiUrl: env.SORT_BOT_API_URL,
    runListener: env.RUN_LISTENER,
    orchestrator,
  });

  const app = createApp({
    db,
    sortBotApi,
    sortBotApiUpstreamUrl: env.SORT_BOT_API_URL,
    persona,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure: process.env['NODE_ENV'] === 'production',
    allowedOrigins: env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    listener: env.RUN_LISTENER ? listener : null,
    orchestrator,
    enableTestReset: env.ENABLE_TEST_RESET,
  });

  const pruneHandle = setInterval(() => {
    pruneExpired(db)
      .then((deleted) => {
        if (deleted > 0) log.info({ deleted }, 'pruned expired cache rows');
      })
      .catch((err) => {
        log.warn({ err: (err as Error).message }, 'cache prune failed');
      });
  }, CACHE_PRUNE_INTERVAL_MS);
  pruneHandle.unref();

  // Slice C3 (D-10) — reconcile orphaned recent_battles.status='running'
  // rows whose upstream battle has long since completed. Belt-and-suspenders
  // for the cooldown rule when the listener misses an event.
  new BattleSweeper({ db, sortBotApi }).start();

  listener.start();

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    log.info({ port: info.port }, 'sort-bot-arena server listening');
  });
}

bootstrap().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'bootstrap failed');
  process.exit(1);
});
