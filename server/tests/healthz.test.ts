import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

describe('GET /api/healthz', () => {
  it('returns ok', async () => {
    const res = await app.request('/api/healthz');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});
