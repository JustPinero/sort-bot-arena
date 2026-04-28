import { afterEach, describe, expect, it, vi } from 'vitest';

describe('api/config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    vi.resetModules();
  });

  it('throws when VITE_API_BASE_URL is missing', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '');
    await expect(import('./config')).rejects.toThrow(/VITE_API_BASE_URL/);
  });

  it('throws when VITE_API_BASE_URL is not a URL', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', 'not a url');
    await expect(import('./config')).rejects.toThrow(/URL/i);
  });

  it('exposes apiBaseUrl when valid', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    const { config } = await import('./config');
    expect(config.apiBaseUrl).toBe('https://api.example.com');
  });
});
