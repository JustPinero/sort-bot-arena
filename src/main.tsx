import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ensureSessionLoaded } from '@/api/auth';
import { createQueryClient } from '@/api/queryClient';
import App from '@/App';
import { initSentry } from '@/lib/sentry';
import '@/styles/globals.css';

initSentry();

async function bootstrap() {
  // Phase 11 T2.3 (D-11) — Playwright specs that need to drive outage
  // simulation via `page.route` set `window.__E2E_DISABLE_MSW__ = true`
  // via `addInitScript` BEFORE navigation, so MSW never registers and
  // the route override is the only intercept layer in the request path.
  // Production code path is unaffected (the flag is undefined).
  const e2eDisableMsw =
    typeof window !== 'undefined' &&
    (window as { __E2E_DISABLE_MSW__?: boolean }).__E2E_DISABLE_MSW__ === true;
  if (import.meta.env.VITE_USE_MOCKS === 'true' && !e2eDisableMsw) {
    const { worker } = await import('@/test/msw/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
  }

  await ensureSessionLoaded();

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('root element missing');

  const queryClient = createQueryClient();

  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
