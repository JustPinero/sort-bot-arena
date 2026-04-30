import { breadcrumb } from '../../lib/sentry.js';

import { isTransient, SortBotApiError } from './error.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY, ...opts };
  const sleep = cfg.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = cfg.random ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const transient =
        err instanceof SortBotApiError ? isTransient(err) || err.status === 0 : false;
      if (!transient || attempt === cfg.maxRetries) throw err;
      const exp = Math.min(cfg.baseDelayMs * 2 ** attempt, cfg.maxDelayMs);
      const jittered = exp * (0.5 + random() * 0.5);
      breadcrumb('upstream.retry', 'retrying transient failure', {
        attempt: attempt + 1,
        delay_ms: Math.round(jittered),
        status: err instanceof SortBotApiError ? err.status : undefined,
      });
      await sleep(jittered);
    }
  }
  throw lastErr;
}
