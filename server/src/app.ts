import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { achievementsRoutes } from './routes/achievements.js';
import { authRoutes } from './routes/auth.js';
import { battlesReplayRoutes } from './routes/battles-replay.js';
import { battlesSseRoutes } from './routes/battles-sse.js';
import { battlesRoutes } from './routes/battles.js';
import { botsRoutes } from './routes/bots.js';
import { feedRoutes } from './routes/feed.js';
import { h2hRoutes } from './routes/h2h.js';
import { hallOfFameRoutes } from './routes/halloffame.js';
import { inputsRoutes } from './routes/inputs.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { perInputLeaderboardRoutes } from './routes/per-input-leaderboard.js';
import { statsRoutes } from './routes/stats.js';
import { tournamentsRoutes } from './routes/tournaments.js';
import { userRoutes } from './routes/users.js';

import type { AppContext } from './auth/middleware.js';
import type { SortBotApiClient } from './clients/sort-bot-api/index.js';
import type { PersonaService } from './persona/service.js';
import type { Client } from '@libsql/client';

export interface AppDeps {
  db: Client;
  sortBotApi: SortBotApiClient;
  sortBotApiUpstreamUrl: string;
  persona: PersonaService;
  sessionSecret: string;
  cookieSecure: boolean;
  allowedOrigins?: string[];
}

export function createApp(deps: AppDeps): Hono<AppContext> {
  const app = new Hono<AppContext>();

  if (deps.allowedOrigins && deps.allowedOrigins.length > 0) {
    app.use(
      '/api/*',
      cors({
        origin: deps.allowedOrigins,
        credentials: true,
        allowHeaders: ['Content-Type'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    );
  }

  app.get('/api/healthz', (c) => c.text('ok'));
  app.get('/api/readyz', async (c) => {
    const breakers = deps.sortBotApi.breakers?.states() ?? {};
    const anyBreakerOpen = deps.sortBotApi.breakers?.anyOpen() ?? false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try {
      const res = await fetch(`${deps.sortBotApiUpstreamUrl}/healthz`, {
        signal: controller.signal,
      });
      const upstreamOk = res.ok;
      const ready = upstreamOk && !anyBreakerOpen;
      return c.json(
        {
          ready,
          upstream: upstreamOk ? 'ok' : `http_${res.status}`,
          breakers,
        },
        ready ? 200 : 503,
      );
    } catch (err) {
      return c.json(
        {
          ready: false,
          upstream: 'unreachable',
          breakers,
          error: (err as Error).message,
        },
        503,
      );
    } finally {
      clearTimeout(timeout);
    }
  });
  app.route('/api/v1/auth', authRoutes(deps));
  app.route(
    '/api/v1/bots',
    botsRoutes({
      db: deps.db,
      sortBotApi: deps.sortBotApi,
      sessionSecret: deps.sessionSecret,
      persona: deps.persona,
    }),
  );
  app.route(
    '/api/v1/leaderboard',
    leaderboardRoutes({ db: deps.db, sortBotApi: deps.sortBotApi, persona: deps.persona }),
  );
  app.route(
    '/api/v1/leaderboard',
    perInputLeaderboardRoutes({ sortBotApi: deps.sortBotApi, persona: deps.persona }),
  );
  app.route('/api/v1/stats', statsRoutes({ db: deps.db, sortBotApi: deps.sortBotApi }));
  app.route(
    '/api/v1/inputs',
    inputsRoutes({
      db: deps.db,
      sortBotApi: deps.sortBotApi,
      sessionSecret: deps.sessionSecret,
    }),
  );
  app.route('/api/v1/feed', feedRoutes({ sortBotApi: deps.sortBotApi, persona: deps.persona }));
  app.route(
    '/api/v1/halloffame',
    hallOfFameRoutes({ db: deps.db, sortBotApi: deps.sortBotApi, persona: deps.persona }),
  );
  app.route('/api/v1/achievements', achievementsRoutes({ sortBotApi: deps.sortBotApi }));
  app.route('/api/v1/bots', h2hRoutes({ sortBotApi: deps.sortBotApi }));
  // SSE + replay are mounted before the rich battles routes so their
  // sub-paths (/:id/events, /:id/replay) resolve before /:id catches.
  app.route(
    '/api/v1/battles',
    battlesSseRoutes({
      sortBotApi: deps.sortBotApi,
      upstreamBaseUrl: deps.sortBotApiUpstreamUrl,
    }),
  );
  app.route('/api/v1/battles', battlesReplayRoutes({ sortBotApi: deps.sortBotApi }));
  app.route(
    '/api/v1/battles',
    battlesRoutes({
      db: deps.db,
      sortBotApi: deps.sortBotApi,
      persona: deps.persona,
      sessionSecret: deps.sessionSecret,
    }),
  );
  app.route(
    '/api/v1/tournaments',
    tournamentsRoutes({
      db: deps.db,
      sortBotApi: deps.sortBotApi,
      persona: deps.persona,
      sessionSecret: deps.sessionSecret,
    }),
  );
  app.route(
    '/api/v1/users',
    userRoutes({
      db: deps.db,
      sortBotApi: deps.sortBotApi,
      sessionSecret: deps.sessionSecret,
      persona: deps.persona,
    }),
  );
  return app;
}

// Default export keeps the old `app.request('/api/healthz')` test path
// working for the bare-bones healthz check that doesn't need deps.
export const app = new Hono<AppContext>();
app.get('/api/healthz', (c) => c.text('ok'));
