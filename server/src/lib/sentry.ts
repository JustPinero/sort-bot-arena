import * as Sentry from '@sentry/node';

import { log } from './log.js';

let initialized = false;

const COOKIE_RE = /cookie/i;
const AUTH_RE = /authorization|api[-_]?key/i;

export function initSentry(opts: {
  dsn: string | undefined;
  environment: string;
  release?: string;
}): void {
  if (initialized) return;
  if (!opts.dsn) {
    log.info('sentry disabled (no SENTRY_DSN)');
    return;
  }
  Sentry.init({
    dsn: opts.dsn,
    environment: opts.environment,
    ...(opts.release !== undefined && { release: opts.release }),
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        for (const k of Object.keys(event.request.headers)) {
          if (COOKIE_RE.test(k) || AUTH_RE.test(k)) {
            event.request.headers[k] = '[redacted]';
          }
        }
      }
      return event;
    },
  });
  initialized = true;
  log.info({ environment: opts.environment }, 'sentry initialized');
}

export function breadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    ...(data && { data }),
  });
}

export function captureUpstreamFailure(err: unknown, ctx: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTags(filterTags(ctx));
    Sentry.captureException(err);
  });
}

function filterTags(ctx: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v);
    }
  }
  return out;
}

export { Sentry };
