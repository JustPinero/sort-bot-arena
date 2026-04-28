import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useThemeStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it('defaults to system mode', async () => {
    const { useThemeStore } = await import('./theme');
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('setMode updates and persists', async () => {
    const first = await import('./theme');
    first.useThemeStore.getState().setMode('dark');
    expect(first.useThemeStore.getState().mode).toBe('dark');
    expect(localStorage.getItem('sort-arena.theme')).toContain('dark');

    vi.resetModules();
    const rebuilt = await import('./theme');
    expect(rebuilt.useThemeStore.getState().mode).toBe('dark');
  });
});
