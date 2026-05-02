import { expect, test } from '@playwright/test';

import { clean } from './fixtures/clean.js';

// G1 harness smoke spec. Verifies:
//   - Vite (real-server mode, port 5174, VITE_USE_MOCKS=false)
//   - Hono server (port 3055, in-memory libsql, ENABLE_TEST_RESET=true)
//   - sort-bot-api stub (port 8081)
// all boot together and the homepage renders against a fresh DB.
//
// Slices G2-G6 add the five real flows on top of this harness.

test.describe('real-server harness smoke', () => {
  test.beforeEach(async ({ request }) => {
    await clean(request);
  });

  test('harness boots — home page renders against the real server', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/sort-arena/i);
    // Home heading is always rendered regardless of leaderboard state.
    await expect(page.getByRole('heading', { name: /sort arena/i })).toBeVisible();
  });

  test('test-reset endpoint is reachable', async ({ request }) => {
    const res = await request.post('http://localhost:3055/api/test/reset');
    expect(res.ok()).toBe(true);
  });
});
