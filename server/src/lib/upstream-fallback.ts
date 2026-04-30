import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { readCache, writeCache } from '../store/upstream-cache.js';

import { log } from './log.js';
import { breadcrumb, captureUpstreamFailure } from './sentry.js';

import type { Client } from '@libsql/client';

export interface FallbackResult<T> {
  body: T;
  stale: boolean;
  ageMs: number;
}

export interface FallbackOptions<T> {
  db: Client;
  cacheKey: string;
  fetch: () => Promise<T>;
  ttlMs: number;
  maxStaleMs?: number;
  cacheReadTimeoutMs?: number;
}

export async function withStaleFallback<T>(opts: FallbackOptions<T>): Promise<FallbackResult<T>> {
  try {
    const fresh = await opts.fetch();
    await writeCache(opts.db, opts.cacheKey, fresh, { ttlMs: opts.ttlMs }).catch((err) => {
      log.warn({ cache_key: opts.cacheKey, err: (err as Error).message }, 'cache write failed');
    });
    return { body: fresh, stale: false, ageMs: 0 };
  } catch (err) {
    if (!(err instanceof SortBotApiError)) throw err;
    let cached;
    try {
      cached = await readCache<T>(opts.db, opts.cacheKey, {
        ...(opts.cacheReadTimeoutMs !== undefined && { timeoutMs: opts.cacheReadTimeoutMs }),
      });
    } catch (readErr) {
      log.warn(
        { cache_key: opts.cacheKey, err: (readErr as Error).message },
        'cache read failed during fallback',
      );
      throw err;
    }
    if (!cached) throw err;
    if (opts.maxStaleMs !== undefined && cached.ageMs > opts.maxStaleMs) throw err;
    log.warn(
      {
        cache_key: opts.cacheKey,
        upstream_status: err.status,
        age_ms: cached.ageMs,
        expired: cached.expired,
      },
      'serving stale cache after upstream failure',
    );
    breadcrumb('cache.stale', 'serving stale cache', {
      cache_key: opts.cacheKey,
      upstream_status: err.status,
      age_ms: cached.ageMs,
    });
    captureUpstreamFailure(err, {
      cache_key: opts.cacheKey,
      upstream_status: err.status,
      stale_served: true,
    });
    return { body: cached.value, stale: true, ageMs: cached.ageMs };
  }
}
