import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Client } from '@libsql/client';
import { SortBotApiClient } from './clients/sort-bot-api/index.js';
import { authRoutes } from './routes/auth.js';
import { botsRoutes } from './routes/bots.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { statsRoutes } from './routes/stats.js';
import type { AppContext } from './auth/middleware.js';

export interface AppDeps {
  db: Client;
  sortBotApi: SortBotApiClient;
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
  app.route('/api/v1/bots', botsRoutes({ sortBotApi: deps.sortBotApi }));
  app.route('/api/v1/leaderboard', leaderboardRoutes({ sortBotApi: deps.sortBotApi }));
  app.route('/api/v1/stats', statsRoutes({ sortBotApi: deps.sortBotApi }));
  return app;
}

// Default export keeps the old `app.request('/api/healthz')` test path
// working for the bare-bones healthz check that doesn't need deps.
export const app = new Hono<AppContext>();
app.get('/api/healthz', (c) => c.text('ok'));
