import { useAuthStore, type SessionUser } from '@/stores/auth';

import { ApiError, apiClient } from './client';

export interface SignupInput {
  email: string;
  display_name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Signup creates a user on our server, which provisions a sort-bot-api
// key on the user's behalf and returns a session cookie. After this
// call the browser is logged in.
export async function signup(input: SignupInput): Promise<SessionUser> {
  const user = await apiClient.post<SessionUser>('/api/v1/auth/signup', input);
  useAuthStore.getState().setUser(user);
  useAuthStore.getState().setSessionLoaded(true);
  return user;
}

export async function login(input: LoginInput): Promise<SessionUser> {
  const user = await apiClient.post<SessionUser>('/api/v1/auth/login', input);
  useAuthStore.getState().setUser(user);
  useAuthStore.getState().setSessionLoaded(true);
  return user;
}

export async function logout(): Promise<void> {
  await apiClient.post<void>('/api/v1/auth/logout', undefined);
  useAuthStore.getState().clear();
}

export async function getMe(): Promise<SessionUser | null> {
  try {
    const user = await apiClient.get<SessionUser>('/api/v1/auth/me');
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
