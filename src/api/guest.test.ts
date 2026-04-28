import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth';
import { server } from '@/test/msw/server';

import { ensureGuestUser, generateGuestName } from './guest';

const BASE = 'http://api.test';

describe('generateGuestName', () => {
  it('produces a prefix-animal-NNNN string', () => {
    const name = generateGuestName({ prefix: 'anonymous-' });
    expect(name).toMatch(/^anonymous-[a-z]+-\d{4}$/);
  });

  it('respects a custom prefix', () => {
    const name = generateGuestName({ prefix: 'guest-' });
    expect(name.startsWith('guest-')).toBe(true);
  });
});

describe('ensureGuestUser', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('provisions a guest when no key is in the store and persists the result', async () => {
    let receivedBody: { display_name?: string } | null = null;
    server.use(
      http.post(`${BASE}/v1/users`, async ({ request }) => {
        receivedBody = (await request.json()) as { display_name?: string };
        return HttpResponse.json({
          id: 'usr_provisioned',
          display_name: receivedBody?.display_name ?? '',
          api_key: 'key_provisioned',
        });
      }),
    );

    await ensureGuestUser();

    const auth = useAuthStore.getState();
    expect(auth.apiKey).toBe('key_provisioned');
    expect(auth.userId).toBe('usr_provisioned');
    expect(auth.guestProvisioned).toBe(true);
    expect(auth.displayName).toMatch(/^anonymous-/);
    expect(receivedBody).not.toBeNull();
    expect(receivedBody!.display_name).toMatch(/^anonymous-/);
  });

  it('does not re-provision when a key already exists', async () => {
    useAuthStore.getState().setKey('key_existing', 'usr_existing', 'persistent-fox-1234');

    const calls = vi.fn();
    server.use(
      http.post(`${BASE}/v1/users`, () => {
        calls();
        return HttpResponse.json({ id: 'x', display_name: 'x', api_key: 'x' });
      }),
    );

    await ensureGuestUser();

    expect(calls).not.toHaveBeenCalled();
    expect(useAuthStore.getState().apiKey).toBe('key_existing');
  });

  it('throws when /v1/users returns an error', async () => {
    server.use(
      http.post(`${BASE}/v1/users`, () =>
        HttpResponse.json({ error: 'rate limited', code: 'rate_limited' }, { status: 429 }),
      ),
    );

    await expect(ensureGuestUser()).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'rate_limited',
    });
  });
});
