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
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
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
