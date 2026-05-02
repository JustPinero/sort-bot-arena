import { expect, test } from '@playwright/test';

import { signupViaApi } from './fixtures/accounts.js';
import { clean } from './fixtures/clean.js';

// Slice G6 — fifth and final real-server flow.
//
// Walks an 8-bot escalation tournament from creation through final-round
// crowning. Drives the orchestrator path that closes debt D-9:
//
//   1. signupViaApi pre-seeds a user; dialog flips to login mode so the
//      browser context picks up the cookie.
//   2. /arena → "Setup a tournament" → bracket=8, escalation, Random fill.
//   3. POST /api/v1/tournaments fires. The arena server seeds the
//      tournament_matches table, fire-and-forget invokes
//      orchestrator.schedule, and the orchestrator POSTs four R1 battles
//      to the upstream stub. Browser redirects to /tournaments/<id>.
//   4. Spec polls GET /api/v1/tournaments/<id> until R1 has 4 in_flight
//      matches with battle_ids assigned. For each, hit the test-only
//      `/api/test/advance-match` to simulate the battle_complete event
//      (cheaper + more deterministic than the full SSE plumbing). The
//      orchestrator advances winners into R2, fires those, and so on.
//   5. After R3 (final) resolves, assert the bracket page shows the
//      champion + the tournament status flips to 'completed'.
//
// What this exercises against the real harness (vs MSW intercepts):
//   - the full POST /api/v1/tournaments → orchestrator → upstream loop
//   - tournament_matches lifecycle (pending → in_flight → complete)
//   - GET /api/v1/tournaments/:id reads from our DB (slice D5 path)
//   - bracket-page rendering reflects orchestrator advancement live

const REAL_SERVER = 'http://localhost:3055';

interface TournamentMatchPayload {
  id: string;
  round: number;
  position: number;
  fighter_a_bot_id: string | null;
  fighter_b_bot_id: string | null;
  winner_bot_id: string | null;
  status: 'pending' | 'live' | 'completed' | 'bye';
  battle_id: string | null;
}

interface TournamentPayload {
  id: string;
  status: 'upcoming' | 'active' | 'completed';
  matches: TournamentMatchPayload[];
  rounds_total: number;
  current_round: number;
  champion_bot_id: string | null;
}

test.describe('tournament 8-bracket → orchestrator advances → champion', () => {
  test.beforeEach(async ({ request }) => {
    await clean(request);
  });

  test('orchestrator walks an 8-bracket through three rounds and crowns a champion', async ({
    page,
    request,
  }) => {
    const email = `e2e-tournament+${Date.now().toString(36)}@example.com`;
    const password = 'testpass1234';

    await signupViaApi(request, {
      display_name: 'E2E Promoter',
      email,
      password,
    });

    await page.goto('/');
    await page.getByTestId('signup-cta').click();
    await page.getByRole('button', { name: /have an account\?\s*sign in/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByTestId('user-display-name')).toHaveText('E2E Promoter');

    await page.getByRole('link', { name: /^arena$/i }).click();
    await expect(page).toHaveURL(/\/arena$/);

    await page.getByTestId('setup-tournament-cta').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Bracket size 8 is the modal default; flip the input mode toggle to
    // escalation so the orchestrator drives round-thematic input picks.
    await page.getByRole('radio', { name: /escalation/i }).click();

    // Random fill auto-picks 8 of the 8 stub-pre-seeded fighters.
    const randomBtn = page.getByRole('button', { name: /random fill/i });
    await expect(randomBtn).toBeEnabled({ timeout: 10_000 });
    await randomBtn.click();

    // Capture the POST response so we can read tournament_id directly
    // even before the FE navigates. The redirect happens inside the
    // useStartTournament onSuccess + the modal's onSubmit handler.
    const postPromise = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/v1/tournaments') &&
        r.request().method() === 'POST',
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /^start tournament$/i }).click();
    const postRes = await postPromise;
    const postBody = await postRes.json();
    expect(postRes.status(), `POST body: ${JSON.stringify(postBody)}`).toBe(200);
    const tournamentId = (postBody as { tournament_id?: string }).tournament_id;
    expect(tournamentId).toBeTruthy();

    // Redirect lands on /tournaments/<id>.
    await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}`), {
      timeout: 10_000,
    });

    // Helper: poll GET /api/v1/tournaments/:id until predicate holds.
    const waitForTournament = async (
      predicate: (t: TournamentPayload) => boolean,
      label: string,
      timeoutMs = 15_000,
    ): Promise<TournamentPayload> => {
      const start = Date.now();
      let last: TournamentPayload | null = null;
      while (Date.now() - start < timeoutMs) {
        const res = await page.request.get(`${REAL_SERVER}/api/v1/tournaments/${tournamentId}`);
        if (res.ok()) {
          const body = (await res.json()) as TournamentPayload;
          last = body;
          if (predicate(body)) return body;
        }
        await page.waitForTimeout(150);
      }
      throw new Error(
        `tournament predicate "${label}" not satisfied within ${timeoutMs}ms; last state: ${JSON.stringify(last)}`,
      );
    };

    // Drive each in_flight match's underlying battle to completion via
    // the test-only advance-match endpoint. We pick fighter_a as the
    // winner deterministically — the orchestrator only cares that some
    // winner is set; the bracket walk is identical regardless of which
    // corner wins.
    const advanceMatch = async (m: TournamentMatchPayload): Promise<void> => {
      if (!m.battle_id) throw new Error(`match ${m.id} has no battle_id`);
      const winner = m.fighter_a_bot_id ?? m.fighter_b_bot_id;
      if (!winner) throw new Error(`match ${m.id} has no fighters`);
      const res = await page.request.post(`${REAL_SERVER}/api/test/advance-match`, {
        data: {
          tournament_id: tournamentId,
          battle_id: m.battle_id,
          winner_bot_id: winner,
        },
      });
      expect(res.status(), `advance-match for ${m.battle_id}`).toBe(200);
    };

    // ----- Round 1: 4 matches in_flight -----
    const r1 = await waitForTournament(
      (t) => t.matches.filter((m) => m.round === 1 && m.status === 'live').length === 4,
      'r1 has 4 live matches',
    );
    const r1Live = r1.matches.filter((m) => m.round === 1 && m.status === 'live');
    for (const m of r1Live) await advanceMatch(m);

    // ----- Round 2: 2 matches in_flight after R1 winners advance -----
    const r2 = await waitForTournament(
      (t) => t.matches.filter((m) => m.round === 2 && m.status === 'live').length === 2,
      'r2 has 2 live matches',
    );
    const r2Live = r2.matches.filter((m) => m.round === 2 && m.status === 'live');
    for (const m of r2Live) await advanceMatch(m);

    // ----- Round 3 (final): 1 match in_flight -----
    const r3 = await waitForTournament(
      (t) => t.matches.filter((m) => m.round === 3 && m.status === 'live').length === 1,
      'r3 has 1 live final',
      20_000,
    );
    const final = r3.matches.find((m) => m.round === 3 && m.status === 'live')!;
    await advanceMatch(final);

    // ----- Tournament complete: status flips, champion populated -----
    const done = await waitForTournament(
      (t) => t.status === 'completed' && t.champion_bot_id !== null,
      'tournament completed with champion',
      20_000,
    );
    expect(done.champion_bot_id).toBeTruthy();
    expect(done.rounds_total).toBe(3);
    expect(done.matches.filter((m) => m.status === 'completed')).toHaveLength(7);

    // ----- Bracket page reflects the final state -----
    // Reload to ensure the FE re-pulls the now-completed tournament
    // shape rather than relying on whatever partial state TanStack
    // Query may have cached during the polling loop.
    await page.reload();
    await expect(page.getByText(/champion|completed|finished/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
