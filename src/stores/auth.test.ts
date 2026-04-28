import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useAuthStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    const { useAuthStore } = await import('./auth');
    useAuthStore.getState().clear();
  });

  it('starts with empty state', async () => {
    const { useAuthStore } = await import('./auth');
    const s = useAuthStore.getState();
    expect(s.apiKey).toBeNull();
    expect(s.userId).toBeNull();
    expect(s.displayName).toBeNull();
    expect(s.guestProvisioned).toBe(false);
    expect(s.claimed).toBe(false);
  });

  it('setKey writes the auth fields and marks guest provisioned', async () => {
    const { useAuthStore } = await import('./auth');
    useAuthStore.getState().setKey('key_abc', 'usr_1', 'anonymous-otter-4729');
    const s = useAuthStore.getState();
    expect(s.apiKey).toBe('key_abc');
    expect(s.userId).toBe('usr_1');
    expect(s.displayName).toBe('anonymous-otter-4729');
    expect(s.guestProvisioned).toBe(true);
    expect(s.claimed).toBe(false);
  });

  it('markClaimed updates display name and flips claimed', async () => {
    const { useAuthStore } = await import('./auth');
    useAuthStore.getState().setKey('key_abc', 'usr_1', 'anonymous-otter-4729');
    useAuthStore.getState().markClaimed('Alice');
    const s = useAuthStore.getState();
    expect(s.displayName).toBe('Alice');
    expect(s.claimed).toBe(true);
  });

  it('clear resets everything', async () => {
    const { useAuthStore } = await import('./auth');
    useAuthStore.getState().setKey('key_abc', 'usr_1', 'Alice');
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.apiKey).toBeNull();
    expect(s.guestProvisioned).toBe(false);
  });

  it('persists state to localStorage and rehydrates on store rebuild', async () => {
    const first = await import('./auth');
    first.useAuthStore.getState().setKey('key_persist', 'usr_2', 'persistent-fox-1234');

    const stored = localStorage.getItem('sort-arena.auth');
    expect(stored).toBeTruthy();
    expect(stored).toContain('key_persist');

    vi.resetModules();
    const rebuilt = await import('./auth');
    expect(rebuilt.useAuthStore.getState().apiKey).toBe('key_persist');
    expect(rebuilt.useAuthStore.getState().displayName).toBe('persistent-fox-1234');
  });
});
