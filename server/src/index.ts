import { serve } from '@hono/node-server';
import { app } from './app.js';
import { loadEnv } from './env.js';
import { log } from './lib/log.js';

const env = loadEnv();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log.info({ port: info.port }, 'sort-bot-arena server listening');
});
