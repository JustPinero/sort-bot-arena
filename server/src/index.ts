import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createClient } from '@libsql/client';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';
import { log } from './lib/log.js';
import { SortBotApiClient } from './clients/sort-bot-api/index.js';
import { AnthropicClient } from './persona/anthropic.js';
import { LeonardoClient } from './persona/leonardo.js';
import { PersonaService } from './persona/service.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
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
  const app = createApp({
    db,
    sortBotApi,
    sortBotApiUpstreamUrl: env.SORT_BOT_API_URL,
    persona,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure: process.env['NODE_ENV'] === 'production',
    allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  });

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    log.info({ port: info.port }, 'sort-bot-arena server listening');
  });
}

bootstrap().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'bootstrap failed');
  process.exit(1);
});
