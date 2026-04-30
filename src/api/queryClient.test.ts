import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from './queryClient';

describe('createQueryClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures retry=1 and exponential delay with jitter', () => {
    const client = createQueryClient();
    const opts = client.getDefaultOptions().queries;
    expect(opts?.retry).toBe(1);
    expect(opts?.refetchOnWindowFocus).toBe(false);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const delay = (opts?.retryDelay as (n: number, e: Error) => number)(2, new Error('x'));
    expect(delay).toBeGreaterThanOrEqual(1000 * 4 * 0.5);
    expect(delay).toBeLessThanOrEqual(1000 * 4);
  });

  it('caps retry delay at 30s with jitter window', () => {
    const client = createQueryClient();
    const opts = client.getDefaultOptions().queries;
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const delay = (opts?.retryDelay as (n: number, e: Error) => number)(20, new Error('x'));
    expect(delay).toBeLessThanOrEqual(30_000);
    expect(delay).toBeGreaterThanOrEqual(30_000 * 0.5);
  });
});
