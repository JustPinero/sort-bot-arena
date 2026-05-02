import { createClient, type Client } from '@libsql/client';

import { createApp, type ListenerHealth } from '../../src/app.js';
import { SortBotApiClient } from '../../src/clients/sort-bot-api/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { PersonaService } from '../../src/persona/service.js';

export interface TestApp {
  app: ReturnType<typeof createApp>;
  db: Client;
  sortBotApi: SortBotApiClient;
  persona: PersonaService;
  sessionSecret: string;
}

export async function makeTestApp(opts?: {
  sortBotApiBaseUrl?: string;
  persona?: PersonaService;
  // Optional listener stub for /api/readyz tests. Pass `null` to mirror
  // the production RUN_LISTENER=false posture; pass a stub to assert
  // running-state surface.
  listener?: ListenerHealth | null;
}): Promise<TestApp> {
  const db = createClient({ url: ':memory:' });
  await runMigrations(db);
  const sortBotApi = new SortBotApiClient({
    baseUrl: opts?.sortBotApiBaseUrl ?? 'http://api.test',
  });
  // Default persona service has no leonardo/anthropic clients — generation
  // calls are no-ops, so tests never make external requests unless they
  // pass in their own configured PersonaService.
  const persona = opts?.persona ?? new PersonaService({ db });
  const sessionSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';
  const app = createApp({
    db,
    sortBotApi,
    sortBotApiUpstreamUrl: opts?.sortBotApiBaseUrl ?? 'http://api.test',
    persona,
    sessionSecret,
    cookieSecure: false,
    ...(opts && 'listener' in opts ? { listener: opts.listener } : {}),
  });
  return { app, db, sortBotApi, persona, sessionSecret };
}
