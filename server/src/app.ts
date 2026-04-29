import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Client } from '@libsql/client';
import { SortBotApiClient } from './clients/sort-bot-api/index.js';
import { authRoutes } from './routes/auth.js';
import { botsRoutes } from './routes/bots.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { statsRoutes } from './routes/stats.js';
import { userRoutes } from './routes/users.js';
import { inputsRoutes } from './routes/inputs.js';
import { perInputLeaderboardRoutes } from './routes/per-input-leaderboard.js';
import { hallOfFameRoutes } from './routes/halloffame.js';
import { achievementsRoutes } from './routes/achievements.js';
import { feedRoutes } from './routes/feed.js';
import { h2hRoutes } from './routes/h2h.js';
import type { AppContext } from './auth/middleware.js';
import type { PersonaService } from './persona/service.js';

export interface AppDeps {
  db: Client;
  sortBotApi: SortBotApiClient;
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
    leaderboardRoutes({ sortBotApi: deps.sortBotApi, persona: deps.persona }),
  );
  app.route(
    '/api/v1/leaderboard',
    perInputLeaderboardRoutes({ sortBotApi: deps.sortBotApi, persona: deps.persona }),
  );
  app.route('/api/v1/stats', statsRoutes({ sortBotApi: deps.sortBotApi }));
  app.route('/api/v1/inputs', inputsRoutes({ sortBotApi: deps.sortBotApi }));
  app.route('/api/v1/feed', feedRoutes({ sortBotApi: deps.sortBotApi, persona: deps.persona }));
  app.route(
    '/api/v1/halloffame',
    hallOfFameRoutes({ db: deps.db, sortBotApi: deps.sortBotApi, persona: deps.persona }),
  );
  app.route('/api/v1/achievements', achievementsRoutes({ sortBotApi: deps.sortBotApi }));
  app.route('/api/v1/bots', h2hRoutes({ sortBotApi: deps.sortBotApi }));
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
