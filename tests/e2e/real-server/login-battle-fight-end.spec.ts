import { expect, test } from '@playwright/test';

import { signupViaApi } from './fixtures/accounts.js';
import { clean } from './fixtures/clean.js';

// Slice G3 — second real-server flow.
//
// Pre-seeds a user via the arena server's POST /api/v1/auth/signup,
// then drives the SignUpDialog's login mode to attach a session cookie
// to the browser context. From there:
//
//   1. Navigate to /arena and open the MatchSetupModal.
//   2. Pick the two stub-pre-seeded fighters (Red Mauler, Blue Crusher)
//      from the BotSlotPicker selects.
//   3. Submit with the default Sparring preset → POST /api/v1/battles
//      → upstream POST /v1/battles → redirect to /arena/<battle_id>.
//   4. Click "Enter Arena" to fire the BattlePage countdown +
//      playMockBattle event chain.
//   5. Assert WALKOUT lines render in the live commentary feed and a
//      decisive PostFightDecision (Knockout / Decision Victory) lands.
//
// What this exercises against the real harness (vs MSW intercepts):
//   - cookie auth survives the dialog mode flip (signup → login)
//   - the leaderboard → BotSlotPicker bridge through useEligibleFighters
//     (filters retired, requires hasEnough(2))
//   - the cross-origin POST /v1/battles round-trip including the
//     arena server's claimPair atomicity + reassignBattleId update
//   - GET /api/v1/battles/:id polishes the upstream battle into the
//     BattlePage shape (fighter_a/fighter_b corners, weight_class)
//
// The stub's GET /v1/battles/:id/events SSE endpoint is wired up too,
// even though the current BattlePage drives events client-side via
// playMockBattle and never subscribes — future SSE-driven viewers
// (and the arena server's polling fallback) will land on a working
// stream instead of a 404.

test.describe('login → start a battle → watch fight_end render', () => {
  test.beforeEach(async ({ request }) => {
    await clean(request);
  });

  test('a returning user fires a sparring match and the BattleViewer renders walkouts + a decisive verdict', async ({
    page,
    request,
  }) => {
    // Each spec run uses a unique email so reruns inside a single
    // server lifetime can't collide on the unique index, even though
    // clean() drops the table between specs.
    const email = `e2e-battle+${Date.now().toString(36)}@example.com`;
    const password = 'testpass1234';

    // ----- pre-seed the user via the arena server -----
    await signupViaApi(request, {
      display_name: 'E2E Battler',
      email,
      password,
    });

    // ----- log in via the dialog so the cookie attaches to the
    // browser context (signupViaApi's cookie lives only on the
    // APIRequestContext, not the page). -----
    await page.goto('/');
    await page.getByTestId('signup-cta').click();
    // The dialog opens in signup mode by default; the toggle button
    // text is "Have an account? Sign in".
    await page.getByRole('button', { name: /have an account\?\s*sign in/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    // The submit button text becomes "Sign in" once mode flips.
    await page.getByRole('button', { name: /^sign in$/i }).click();

    // TopNav swaps the Sign-up CTA for the user display name once the
    // auth store hydrates from the dialog's onSuccess handler.
    await expect(page.getByTestId('user-display-name')).toHaveText('E2E Battler');

    // ----- navigate to Arena and open the match setup modal -----
    await page.getByRole('link', { name: /^arena$/i }).click();
    await expect(page).toHaveURL(/\/arena$/);

    await page.getByTestId('setup-match-cta').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // ----- pick the two stub-pre-seeded fighters -----
    // BotSlotPicker renders a placeholder option at index 0 ("Pick a
    // fighter") plus one option per eligible bot. The stub's
    // /v1/leaderboard hands back two bots, so indices 1 + 2 are valid.
    await page.getByLabel(/red corner/i).selectOption({ index: 1 });
    await page.getByLabel(/blue corner/i).selectOption({ index: 2 });

    // The Preset tab + Sparring preset are the form defaults — we
    // skip touching them so the submit body is the canonical
    // { bot_a, bot_b, count: 3 } shape.

    // ----- fire the battle -----
    await page.getByRole('button', { name: /^start match$/i }).click();

    // The arena server reassigns its placeholder PK to the upstream
    // battle_id (bat_e2e_<token>) before responding, so the redirect
    // lands on whatever the stub minted.
    await expect(page).toHaveURL(/\/arena\/bat_e2e_[a-z0-9_]+/, { timeout: 10_000 });

    // ----- click into the live arena -----
    // PreFightStaredown renders first; the user has to click "Enter
    // Arena" to start playMockBattle (no auto-advance from the visual
    // 5s countdown).
    await page.getByRole('button', { name: /^enter arena$/i }).click();

    // CommentaryFeed prints `WALKOUT — <bot_id>` lines as the first
    // two events. Both should render within a couple of speedMs ticks
    // (600ms each, ~1.5s buffer for the second walkout).
    await expect(page.getByText(/walkout/i).first()).toBeVisible({ timeout: 5_000 });

    // playMockBattle's full chain (2 walkouts + fight_start + 5
    // rounds × ~1.4s + fight_end) lands ~8-9s after Enter Arena. The
    // PostFightDecision heading is "Knockout" / "Decisive Victory" /
    // "Decision Victory" / "Draw" — match any of the verdict words.
    await expect(
      page.getByRole('heading', {
        name: /knockout|decisive victory|decision victory|draw/i,
      }),
    ).toBeVisible({ timeout: 20_000 });

    // The final scorecard panel stamps the winner's nickname. Since
    // playMockBattle picks the winner via Math.random(), we don't
    // assert *which* fighter — only that a winner line rendered (or
    // a draw, in the rare 50/50 split).
    await expect(page.getByText(/winner:|no winner/i)).toBeVisible();
  });
});
