import { createClient, type Client } from '@libsql/client';

import { createApp, type ListenerHealth } from '../../src/app.js';
import { SortBotApiClient } from '../../src/clients/sort-bot-api/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { PersonaService } from '../../src/persona/service.js';

import type { OrchestratorHandle } from '../../src/routes/tournaments.js';

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
  // Slice D4 — optional orchestrator stub for tournaments POST tests.
  // When present, the route's fire-and-forget `schedule(...)` is wired
  // to the supplied handle so tests can spy on invocations without
  // standing up the real orchestrator.
  orchestrator?: OrchestratorHandle;
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
    ...(opts?.orchestrator ? { orchestrator: opts.orchestrator } : {}),
  });
  return { app, db, sortBotApi, persona, sessionSecret };
}
