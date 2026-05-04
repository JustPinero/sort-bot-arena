import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth';
import { server } from '@/test/msw/server';

import { getMe } from './auth';
import { ApiError } from './client';

const BASE = 'http://api.test';

describe('getMe', () => {
  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('parses /api/v1/auth/me through SessionUserSchema and stores the user', async () => {
    const user = await getMe();
    expect(user).toMatchObject({
      id: 'usr_test_1',
      display_name: 'Test User',
      email: 'test@example.com',
    });
    expect(useAuthStore.getState().user).toMatchObject({ id: 'usr_test_1' });
    expect(useAuthStore.getState().sessionLoaded).toBe(true);
  });

  it('returns null on 401 without throwing', async () => {
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, () =>
        HttpResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 }),
      ),
    );
    const user = await getMe();
    expect(user).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().sessionLoaded).toBe(true);
  });

  it('throws ApiError({code: "malformed_response"}) when /me returns a shape SessionUserSchema rejects', async () => {
    server.use(
      http.get(`${BASE}/api/v1/auth/me`, () =>
        // Missing `email` and `display_name` — schema requires both.
        HttpResponse.json({ id: 'usr_test_1' }),
      ),
    );

    await expect(getMe()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'malformed_response',
      status: 0,
      retryable: false,
    });
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
    // sessionLoaded still flips true (the `finally` runs even on throw).
    expect(useAuthStore.getState().sessionLoaded).toBe(true);
  });
});
