import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';

import { usePing } from './queries';
import { createQueryClient } from './queryClient';

import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePing', () => {
  it('round-trips /healthz through the API client', async () => {
    const { result } = renderHook(() => usePing(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('ok');
  });

  it('surfaces ApiError on backend failure', async () => {
    server.use(
      http.get('http://api.test/healthz', () =>
        HttpResponse.json({ error: 'down', code: 'unavailable' }, { status: 503 }),
      ),
    );

    const { result } = renderHook(() => usePing(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toMatchObject({ name: 'ApiError', status: 503 });
  });
});
