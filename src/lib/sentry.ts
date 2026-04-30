import * as Sentry from '@sentry/react';

let initialized = false;

const COOKIE_RE = /cookie/i;
const AUTH_RE = /authorization|api[-_]?key/i;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? 'development',
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
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
      if (event.extra) {
        for (const k of Object.keys(event.extra)) {
          if (k.toLowerCase().includes('localstorage') || k.toLowerCase().includes('storage')) {
            event.extra[k] = '[redacted]';
          }
        }
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'console' && crumb.data?.['arguments']) {
        // Avoid leaking arbitrary console args (could contain api keys).
        delete crumb.data['arguments'];
      }
      return crumb;
    },
  });
  initialized = true;
}

export function captureBoundaryError(err: Error, info: { componentStack?: string | null }): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (info.componentStack) scope.setExtra('componentStack', info.componentStack);
    Sentry.captureException(err);
  });
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

export { Sentry };
