import type { Client } from '@libsql/client';

export interface CacheEntry<T> {
  value: T;
  storedAt: Date;
  expiresAt: Date | null;
  ageMs: number;
  expired: boolean;
}

export interface ReadCacheOptions {
  timeoutMs?: number;
}

const DEFAULT_READ_TIMEOUT_MS = 500;

export async function readCache<T>(
  db: Client,
  key: string,
  opts: ReadCacheOptions = {},
): Promise<CacheEntry<T> | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
  const query = db.execute({
    sql: 'SELECT body_json, stored_at, expires_at FROM upstream_cache WHERE cache_key = ? LIMIT 1',
    args: [key],
  });
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('cache read timeout')), timeoutMs);
    timeoutHandle.unref?.();
  });
  let res;
  try {
    res = await Promise.race([query, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  const row = res.rows[0];
  if (!row) return null;
  const json = row['body_json'] as string;
  const storedAt = parseSqliteTimestamp(row['stored_at'] as string);
  const expiresRaw = row['expires_at'];
  const expiresAt = expiresRaw ? parseSqliteTimestamp(expiresRaw as string) : null;
  const now = Date.now();
  const expired = expiresAt ? expiresAt.getTime() < now : true;
  return {
    value: JSON.parse(json) as T,
    storedAt,
    expiresAt,
    ageMs: now - storedAt.getTime(),
    expired,
  };
}

export interface WriteCacheOptions {
  ttlMs: number;
}

export async function writeCache<T>(
  db: Client,
  key: string,
  value: T,
  opts: WriteCacheOptions,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + opts.ttlMs);
  await db.execute({
    sql: `
      INSERT INTO upstream_cache (cache_key, body_json, stored_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        body_json = excluded.body_json,
        stored_at = excluded.stored_at,
        expires_at = excluded.expires_at
    `,
    args: [key, JSON.stringify(value), now.toISOString(), expiresAt.toISOString()],
  });
}

export async function pruneExpired(db: Client): Promise<number> {
  const res = await db.execute({
    sql: 'DELETE FROM upstream_cache WHERE expires_at IS NOT NULL AND expires_at < ?',
    args: [new Date().toISOString()],
  });
  return res.rowsAffected;
}

function parseSqliteTimestamp(s: string): Date {
  // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" (UTC, no tz).
  // ISO 8601 inputs ("2026-04-30T12:34:56.000Z") parse natively.
  if (s.includes('T')) return new Date(s);
  return new Date(`${s}Z`.replace(' ', 'T'));
}
