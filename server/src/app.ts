import { Hono } from 'hono';
import type { Client } from '@libsql/client';
import { SortBotApiClient } from './clients/sort-bot-api/index.js';
import { authRoutes } from './routes/auth.js';
import type { AppContext } from './auth/middleware.js';

export interface AppDeps {
  db: Client;
  sortBotApi: SortBotApiClient;
  sessionSecret: string;
  cookieSecure: boolean;
}

export function createApp(deps: AppDeps): Hono<AppContext> {
  const app = new Hono<AppContext>();
  app.get('/api/healthz', (c) => c.text('ok'));
  app.route('/api/v1/auth', authRoutes(deps));
  return app;
}

// Default export keeps the old `app.request('/api/healthz')` test path
// working for the bare-bones healthz check that doesn't need deps.
export const app = new Hono<AppContext>();
app.get('/api/healthz', (c) => c.text('ok'));
