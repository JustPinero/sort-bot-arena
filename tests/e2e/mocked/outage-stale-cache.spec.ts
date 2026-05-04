import { expect, test } from '@playwright/test';

const STALE_RESPONSE = {
  items: [
    {
      bot_id: 'bot_cached_1',
      rank: 1,
      trend: 'steady',
      display_name: 'Cached Champion',
      nickname: 'Old Iron',
      language: 'python',
      portrait_url: null,
      record: { wins: 9, losses: 1, draws: 0 },
      ko_percentage: 80,
      signature_input: null,
      last_fight_at: null,
      retired: false,
    },
  ],
  next_cursor: null,
  stale: true,
  stale_age_ms: 7 * 60_000,
};

test.describe('leaderboard during upstream outage', () => {
  // Phase 11 T2.3 — closes D-11. The mocked project boots Vite with
  // `VITE_USE_MOCKS=true`, so MSW normally intercepts the leaderboard
  // fetch before `page.route` can. We `addInitScript` a window flag
  // before navigation; `src/main.tsx` honors it and skips registering
  // the MSW worker. Route overrides become the only intercept layer.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __E2E_DISABLE_MSW__: boolean }).__E2E_DISABLE_MSW__ = true;
    });
  });

  test('shows stale indicator and renders cached rankings', async ({ page }) => {
    await page.route('**/api/v1/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Stale': 'true', 'X-Stale-Age-Ms': String(STALE_RESPONSE.stale_age_ms) },
        body: JSON.stringify(STALE_RESPONSE),
      });
    });

    await page.goto('/leaderboard');

    const stale = page.getByTestId('stale-indicator');
    await expect(stale).toBeVisible();
    await expect(stale).toContainText(/cached/i);

    await expect(page.getByText('Cached Champion')).toBeVisible();
  });

  test('shows generic error when arena server returns 502 with no cache', async ({ page }) => {
    await page.route('**/api/v1/leaderboard**', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'upstream_failure', upstream_status: 503 }),
      });
    });

    await page.goto('/leaderboard');
    await expect(page.getByText(/could not load the leaderboard/i)).toBeVisible();
  });
});
