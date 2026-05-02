import { expect, test } from '@playwright/test';

import { clean } from './fixtures/clean.js';

// Slice G2 — first real-server flow.
//
// Walks a brand-new user through the dialog signup, then through the
// submit form, and asserts the bot profile renders with:
//   - the user's chosen display_name (`E2E Bot`)
//   - a deterministic nickname (server falls back to `nicknameFor(bot.id)`
//     because Leonardo + Anthropic keys are unset in E2E)
//   - the portrait fallback (no Leonardo call — `portrait_url` is null,
//     so `<PortraitFallback>` renders the language-shaped silhouette).
//
// What this exercises against the real harness (vs MSW intercepts):
//   - cookie auth across origins (vite 5174 ↔ server 3055)
//   - the multipart/form-data POST /v1/bots flow through the arena
//     server's submit route
//   - the post-submit `playMockEvaluation` redirect to /bots/:id
//   - bot synthesis (`synthesizeBot`) joining ApiBot + BotProfileResponse
//     + null persona into the rich frontend shape

test.describe('signup → submit → bot profile', () => {
  test.beforeEach(async ({ request }) => {
    await clean(request);
  });

  test('new user submits a Python bot and lands on the profile with a nickname + persona placeholder', async ({
    page,
  }) => {
    await page.goto('/');

    // ----- signup via the dialog -----
    await page.getByTestId('signup-cta').click();
    // Each spec run uses a unique email; the unique index on `users.email`
    // would otherwise reject reruns inside a single Vite/server lifetime
    // (the libsql `clean()` reset addresses cross-spec collisions, but
    // a Date-derived suffix is cheap insurance).
    const email = `e2e-signup+${Date.now().toString(36)}@example.com`;
    await page.getByLabel(/display name/i).fill('E2E User');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('testpass1234');
    await page.getByRole('button', { name: /^sign up$/i }).click();

    // The TopNav swaps the Sign-up CTA for the user-display-name span
    // once the auth store hydrates from the dialog's onSuccess handler.
    await expect(page.getByTestId('user-display-name')).toHaveText('E2E User');

    // ----- navigate to /submit -----
    await page.getByRole('link', { name: /^submit$/i }).click();
    await expect(page).toHaveURL(/\/submit$/);

    // ----- fill and submit the Python template -----
    // SubmitPage's label text is "Fighter Name" (id="display_name"),
    // distinct from the dialog's "Fighter / display name" — the regex
    // intentionally targets the unique substring.
    await page.getByLabel(/fighter name/i).fill('E2E Bot');
    // The Python template is the default selection, but clicking the
    // button is idempotent and asserts the keyboard-accessible chooser
    // is wired up.
    await page.getByRole('button', { name: /lightweight \(python\)/i }).click();
    // Source is pre-filled from LANGUAGE_TEMPLATES.python.

    await page.getByRole('button', { name: /test sparring/i }).click();

    // playMockEvaluation runs 7 inputs at 350ms each (~2.5s), then waits
    // 3s before navigating. Give it generous headroom.
    await expect(page).toHaveURL(/\/bots\/[^/]+/, { timeout: 15_000 });

    // ----- bot profile assertions -----
    // FighterCard renders the heading as `bot.nickname ?? bot.display_name`.
    // With persona null, server falls back to the deterministic
    // `nicknameFor(bot.id)`. So the heading is the nickname (always set,
    // never empty).
    const heading = page.getByRole('heading', { name: /.+/ }).first();
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveText('');

    // The chosen display_name appears as a sub-line under the nickname.
    await expect(page.getByText('E2E Bot').first()).toBeVisible();

    // No Leonardo in E2E → portrait_url is null → PortraitFallback
    // renders an aria-labelled "<language> fighter silhouette".
    await expect(page.getByRole('img', { name: /fighter silhouette/i })).toBeVisible();
  });
});
