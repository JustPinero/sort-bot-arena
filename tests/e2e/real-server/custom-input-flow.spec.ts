import { expect, test } from '@playwright/test';

import { signupViaApi } from './fixtures/accounts.js';
import { clean } from './fixtures/clean.js';

// Slice G5 — fourth real-server flow.
//
// Pre-seeds a user via the arena server's POST /api/v1/auth/signup,
// logs in via the SignUpDialog so the browser context picks up the
// session cookie, then walks the user through the MatchSetupModal's
// Upload tab:
//
//   1. Open the modal on /arena.
//   2. Switch to the Upload tab inside InputPickerTabs.
//   3. Type a comma-separated integer list + an optional display name.
//   4. Submit the upload — the arena server proxies it as
//      multipart/form-data to the stub's POST /v1/inputs, mints a new
//      InputSummary, and appends it to the in-memory uploadedInputs
//      list backing GET /v1/inputs.
//   5. Flip back to the Manual tab and confirm the new input shows up
//      pre-checked (MatchSetupModal.onInputUploaded auto-selects it).
//   6. Pick the two stub-pre-seeded fighters (Red Mauler, Blue
//      Crusher) and submit the match.
//   7. Listen for the POST /api/v1/battles request and assert the body
//      includes the new input id under `input_ids`, then assert the
//      redirect to /arena/<battle_id> succeeds.
//
// What this exercises against the real harness (vs MSW intercepts):
//   - the multipart/form-data POST /v1/inputs round-trip via the
//     arena server's /api/v1/inputs route (uploadInput → recordUpload)
//   - the FE's TanStack Query invalidation of `['inputs']` on upload
//     success, so the Manual tab refetches and renders the new row
//   - the MatchSetupForm's tab-switch state (preset → manual) +
//     `tabValid` predicate (manual requires at least one selected id)
//   - cookie auth on a non-trivial authenticated POST
//   - the arena server's startBattle path forwarding `input_ids`
//     (instead of `count`) when the user goes manual

test.describe('login → upload custom input → fire match with that input id', () => {
  test.beforeEach(async ({ request }) => {
    await clean(request);
  });

  test('a returning user uploads a comma-separated input and starts a battle keyed on that input id', async ({
    page,
    request,
  }) => {
    const email = `e2e-input+${Date.now().toString(36)}@example.com`;
    const password = 'testpass1234';
    const inputName = `E2E Custom ${Date.now().toString(36)}`;

    // ----- pre-seed the user via the arena server -----
    await signupViaApi(request, {
      display_name: 'E2E Uploader',
      email,
      password,
    });

    // ----- log in via the dialog so the cookie attaches to the
    // browser context. -----
    await page.goto('/');
    await page.getByTestId('signup-cta').click();
    await page.getByRole('button', { name: /have an account\?\s*sign in/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByTestId('user-display-name')).toHaveText('E2E Uploader');

    // ----- navigate to Arena and open the match setup modal -----
    await page.getByRole('link', { name: /^arena$/i }).click();
    await expect(page).toHaveURL(/\/arena$/);

    await page.getByTestId('setup-match-cta').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // ----- switch to Upload tab and submit a comma-separated array -----
    // Tabs are radix UI; the trigger is a role=tab button labeled "Upload".
    await dialog.getByRole('tab', { name: /^upload$/i }).click();

    await dialog.getByLabel(/^values$/i).fill('5, 3, 8, 1, 9');
    await dialog.getByLabel(/^name \(optional\)$/i).fill(inputName);

    // Capture the upload response so we know the freshly-minted input
    // id without relying on a particular stub increment value (the
    // stub persists `uploadedInputs` across specs in a single
    // Playwright lifetime, so a count-based assertion would flake on
    // repeated runs).
    const uploadResponse = page.waitForResponse(
      (resp) => resp.url().endsWith('/api/v1/inputs') && resp.request().method() === 'POST',
    );

    await dialog.getByRole('button', { name: /^add input$/i }).click();

    const uploadedSummary = (await (await uploadResponse).json()) as {
      id: string;
      name: string;
      size: number;
    };
    expect(uploadedSummary.id).toMatch(/^\d+$/);

    // ----- assert the new row appears in the Manual tab -----
    // MatchSetupForm.onInputUploaded merges the InputSummary into the
    // local extraInputs state and auto-selects it. The Upload tab
    // doesn't render the inputs list, so we flip to Manual to verify.
    // The arena server's GET /v1/inputs normalizer overrides the user-
    // supplied display_name with `<Capitalized size_class> #<n>` once
    // the FE invalidates+refetches the inputs query on upload success,
    // so we identify the row structurally rather than by `inputName`.
    await dialog.getByRole('tab', { name: /^manual$/i }).click();
    const newRowCheckbox = dialog.locator(`#input-${uploadedSummary.id}`);
    await expect(newRowCheckbox).toBeVisible({ timeout: 5_000 });
    await expect(newRowCheckbox).toBeChecked();

    // ----- pick the two stub-pre-seeded fighters -----
    await page.getByLabel(/red corner/i).selectOption({ index: 1 });
    await page.getByLabel(/blue corner/i).selectOption({ index: 2 });

    // ----- listen for the start-battle POST so we can inspect the
    // body and confirm `input_ids` carries the freshly-minted id. -----
    const startBattleRequest = page.waitForRequest(
      (req) => req.url().endsWith('/api/v1/battles') && req.method() === 'POST',
    );

    await page.getByRole('button', { name: /^start match$/i }).click();

    const captured = await startBattleRequest;
    const postBody = captured.postDataJSON() as {
      bot_a?: string;
      bot_b?: string;
      input_ids?: string[];
      count?: number;
    };
    expect(postBody.bot_a).toBeTruthy();
    expect(postBody.bot_b).toBeTruthy();
    expect(postBody.bot_a).not.toBe(postBody.bot_b);
    // The Manual tab path sends `input_ids`, not `count`.
    expect(postBody.count).toBeUndefined();
    expect(Array.isArray(postBody.input_ids)).toBe(true);
    expect(postBody.input_ids).toEqual([uploadedSummary.id]);

    // The arena server reassigns its placeholder PK to the upstream
    // battle_id (bat_e2e_<token>) before responding, so the redirect
    // lands on whatever the stub minted.
    await expect(page).toHaveURL(/\/arena\/bat_e2e_[a-z0-9_]+/, { timeout: 10_000 });
  });
});
