import { createClient, type Client } from '@libsql/client';

let cached: Client | undefined;

export function getDb(env: { DATABASE_URL: string; DATABASE_AUTH_TOKEN?: string }): Client {
  if (cached) return cached;
  cached = createClient(
    env.DATABASE_AUTH_TOKEN
      ? { url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }
      : { url: env.DATABASE_URL },
  );
  return cached;
}

export function resetDbCache(): void {
  cached = undefined;
}
