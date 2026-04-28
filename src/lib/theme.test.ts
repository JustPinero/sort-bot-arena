import { describe, expect, it } from 'vitest';

import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('returns forceTheme when provided', () => {
    expect(resolveTheme({ mode: 'system', systemPrefersDark: false, forceTheme: 'dark' })).toBe(
      'dark',
    );
    expect(resolveTheme({ mode: 'dark', systemPrefersDark: true, forceTheme: 'light' })).toBe(
      'light',
    );
  });

  it('returns the explicit user mode when not system', () => {
    expect(resolveTheme({ mode: 'dark', systemPrefersDark: false })).toBe('dark');
    expect(resolveTheme({ mode: 'light', systemPrefersDark: true })).toBe('light');
  });

  it('follows system preference when mode is system', () => {
    expect(resolveTheme({ mode: 'system', systemPrefersDark: true })).toBe('dark');
    expect(resolveTheme({ mode: 'system', systemPrefersDark: false })).toBe('light');
  });
});
