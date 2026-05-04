import { expect, test } from '@playwright/test';

import { signupViaApi } from './fixtures/accounts.js';
import { clean } from './fixtures/clean.js';

// Slice G4 — third real-server flow.
//
// Pre-seeds a user via the arena server's POST /api/v1/auth/signup,
// then drives the SignUpDialog's login mode to attach a session
// cookie to the *browser* context (signupViaApi's cookie lives on
// the APIRequestContext only). From there:
//
//   1. Assert the TopNav shows the user-display-name once auth
//      hydrates from the dialog's onSuccess handler.
//   2. Click the Sign-out control (TopNav's `data-testid="logout"`
//      button — see src/components/layout/TopNav.tsx).
//   3. Assert the TopNav swaps back to the Sign-up CTA — the
//      `signup-cta` testid reappears (the dialog trigger), and the
//      user-display-name span no longer carries the display name.
//   4. Issue a `page.request.get('/api/v1/auth/me')` — `page.request`
//      shares the storage state (cookies) of the browser context, so
//      this exercises the same cookie posture the SPA would use.
//      Assert the response is 401 (server cleared the cookie).
//   5. Hard-refresh the page and assert the Sign-up CTA still
//      shows — i.e. no leftover cookie / sticky auth-store state.
//
// What this exercises against the real harness (vs MSW intercepts):
//   - the POST /api/v1/auth/logout cookie-clearing round-trip
//   - the TopNav's auth-store subscription flipping the displayName
//     branch back to the SignUpDialog trigger
//   - real cross-origin cookie clearing (Set-Cookie max-age=0 on
//     a SameSite=Lax cookie attached to a different origin)

test.describe('logout → 401 → Sign-up CTA returns', () => {
  test.beforeEach(async ({ request }) => {
    await clean(request);
  });

  test('logged-in user signs out, /me 401s, and a hard refresh stays signed out', async ({
    page,
    request,
  }) => {
    // Each spec run uses a unique email so reruns inside a single
    // server lifetime can't collide on the unique index, even though
    // clean() drops the table between specs.
    const email = `e2e-logout+${Date.now().toString(36)}@example.com`;
    const password = 'testpass1234';

    // ----- pre-seed the user via the arena server -----
    await signupViaApi(request, {
      display_name: 'E2E Logout',
      email,
      password,
    });

    // ----- log in via the dialog so the session cookie attaches to
    // the browser context (signupViaApi's cookie lives on the
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
    await expect(page.getByTestId('user-display-name')).toHaveText('E2E Logout');

    // ----- click Sign out -----
    // TopNav renders the signout control as a <button data-testid="logout">
    // with text "Sign out" (see src/components/layout/TopNav.tsx).
    await page.getByTestId('logout').click();

    // ----- assert the TopNav reverts to the Sign-up CTA -----
    // When user becomes null the displayName branch unmounts and the
    // <SignUpDialog/> trigger (testid `signup-cta`) re-appears.
    await expect(page.getByTestId('signup-cta')).toBeVisible();
    // The user-display-name span still exists in the signed-out
    // branch (it wraps <SignUpDialog/>), but it no longer carries the
    // display name as text — it now reads "Sign up" from the dialog
    // trigger.
    await expect(page.getByTestId('user-display-name')).not.toHaveText('E2E Logout');

    // ----- issue an authed request from the same browser context -----
    // `page.request` shares the storage state (cookies) of the
    // browser context, so this is the closest possible analogue to a
    // SPA fetch. After logout the session cookie should be cleared,
    // so /api/v1/auth/me must 401. (`/api/v1/users/me` is not a
    // route — the canonical "who am I" endpoint is /auth/me.)
    const meRes = await page.request.get('http://localhost:3055/api/v1/auth/me');
    expect(meRes.status()).toBe(401);

    // ----- hard refresh, assert state persists (no leftover cookie) -----
    await page.reload();
    await expect(page.getByTestId('signup-cta')).toBeVisible();
    await expect(page.getByTestId('user-display-name')).not.toHaveText('E2E Logout');
  });
});
