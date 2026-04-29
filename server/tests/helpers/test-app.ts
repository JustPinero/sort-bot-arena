import { createClient, type Client } from '@libsql/client';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { SortBotApiClient } from '../../src/clients/sort-bot-api/index.js';

export interface TestApp {
  app: ReturnType<typeof createApp>;
  db: Client;
  sortBotApi: SortBotApiClient;
  sessionSecret: string;
}

export async function makeTestApp(opts?: {
  sortBotApiBaseUrl?: string;
}): Promise<TestApp> {
  const db = createClient({ url: ':memory:' });
  await runMigrations(db);
  const sortBotApi = new SortBotApiClient({
    baseUrl: opts?.sortBotApiBaseUrl ?? 'http://api.test',
  });
  const sessionSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';
  const app = createApp({ db, sortBotApi, sessionSecret, cookieSecure: false });
  return { app, db, sortBotApi, sessionSecret };
}
