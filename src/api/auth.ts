import { useAuthStore, type SessionUser } from '@/stores/auth';

import { ApiError, apiClient } from './client';
import { SessionUserSchema } from './schemas';

export async function logout(): Promise<void> {
  await apiClient.post<void>('/api/v1/auth/logout', undefined);
  useAuthStore.getState().clear();
}

export async function getMe(): Promise<SessionUser | null> {
  try {
    const user = await apiClient.get('/api/v1/auth/me', { schema: SessionUserSchema });
    useAuthStore.getState().setUser(user);
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().setUser(null);
      return null;
    }
    throw err;
  } finally {
    useAuthStore.getState().setSessionLoaded(true);
  }
}

// Called from main.tsx bootstrap. Idempotent: only probes once.
export async function ensureSessionLoaded(): Promise<void> {
  if (useAuthStore.getState().sessionLoaded) return;
  await getMe().catch(() => {
    useAuthStore.getState().setSessionLoaded(true);
  });
}
