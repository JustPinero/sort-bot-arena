// Slice B6 — contract drift detector.
//
// One test per endpoint exposed by `src/api/queries.ts`. Each spins up the
// real Hono app via `makeTestApp`, MSWs happy-path upstream responses for
// every sort-bot-api call the route fans out to, then asserts the body
// parses against the strict schema the frontend uses. We do NOT assert
// specific field values — `.strict()` plus the schema's required-field
// list catches the kind of contract drift that snuck past phase 8.

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AchievementDefinitionStrictSchema,
  AnalysisResponseStrictSchema,
  BattleStrictSchema,
  BotRunStrictSchema,
  BotSnapshotStrictSchema,
  BotStrictSchema,
  CreateTournamentResponseStrictSchema,
  CursorPageSchema,
  HomeSnapshotStrictSchema,
  InputPerformanceStrictSchema,
  InputSummaryStrictSchema,
  LeaderboardEntryStrictSchema,
  PerInputLeaderboardEntryStrictSchema,
  SessionUserStrictSchema,
  TournamentStrictSchema,
} from '../../src/api/schemas.js';

import { makeTestApp } from './helpers/test-app.js';

import type { TestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Upstream fixtures (mirroring server/tests/*-shape.test.ts)
// ---------------------------------------------------------------------------

const apiBot = {
  id: 'bot_xyz',
  user_id: 'u1',
  display_name: 'Recon',
  language: 'python',
  source_size_bytes: 154,
  source_sha256: 'sha',
  status: 'evaluated',
  submitted_at: '2026-04-29T00:00:00Z',
  evaluation_completed_at: '2026-04-29T00:01:00Z',
};

const apiBotA = {
  ...apiBot,
  id: 'bot_a',
  display_name: 'Alpha Bot',
};

const apiBotB = {
  ...apiBot,
  id: 'bot_b',
  display_name: 'Bravo Bot',
  language: 'node',
};

const apiBotProfile = {
  bot: apiBot,
  rank: 1,
  score: 12.0,
  incomplete: false,
  inputs_covered: 57,
  total_inputs: 57,
  best_input: { input_id: 3, median_ms: 7 },
  worst_input: { input_id: 45, median_ms: 216 },
  per_input: [
    {
      input_id: 1,
      size_class: 'small',
      median_ms: 12,
      status_counts: { success: 3 },
    },
  ],
  rank_history: [],
};

const apiLeaderboardOne = {
  filter: {},
  total_inputs: 57,
  bots: [
    {
      bot_id: 'bot_xyz',
      display_name: 'Recon',
      language: 'python',
      score: 12.0,
      inputs_covered: 57,
      total_inputs: 57,
      incomplete: false,
      rank: 1,
    },
  ],
};

const apiInputsOne = {
  inputs: [
    {
      id: 1,
      size_class: 'small',
      case_index: 0,
      array_len: 100,
      is_custom: false,
      uploader_id: null,
      created_at: '2026-04-29T00:00:00Z',
    },
  ],
  total: 1,
};

const apiPerInputOne = {
  input_id: 1,
  bots: [
    {
      bot_id: 'bot_xyz',
      display_name: 'Recon',
      language: 'python',
      duration_ms: 1500,
      rank: 1,
    },
  ],
};

const apiBattle = {
  battle: {
    id: 'bat_1',
    bot_a_id: 'bot_a',
    bot_b_id: 'bot_b',
    initiator_id: 'u1',
    status: 'complete',
    winner_bot_id: { String: 'bot_a', Valid: true },
    bot_a_wins: 1,
    bot_b_wins: 0,
    ties: 0,
    created_at: '2026-04-29T00:00:00Z',
    completed_at: { String: '2026-04-29T00:05:00Z', Valid: true },
  },
  runs: [
    {
      id: 1,
      battle_id: 'bat_1',
      input_id: 1,
      bot_a_duration_ms: { Int64: 100, Valid: true },
      bot_b_duration_ms: { Int64: 150, Valid: true },
      bot_a_status: 'success',
      bot_b_status: 'success',
      winner_bot_id: { String: 'bot_a', Valid: true },
      completed_at: '2026-04-29T00:01:00Z',
    },
  ],
};

const apiTournament = {
  tournament: {
    id: 'tour_abc',
    initiator_id: 'u1',
    status: 'running',
    participant_count: 2,
    winner_bot_id: { String: '', Valid: false },
    created_at: '2026-04-29T00:00:00Z',
    completed_at: { String: '', Valid: false },
  },
  matches: [
    {
      id: 1,
      tournament_id: 'tour_abc',
      round: 1,
      bracket_position: 0,
      bot_a_id: { String: 'bot_a', Valid: true },
      bot_b_id: { String: 'bot_b', Valid: true },
      winner_bot_id: { String: 'bot_a', Valid: true },
      battle_id: { String: 'bat_1', Valid: true },
      completed_at: { String: '2026-04-29T00:05:00Z', Valid: true },
    },
  ],
};

const apiStats = {
  fastest_run_ms: 7,
  language_distribution: { python: 1 },
  total_bots: 1,
  total_runs: 100,
};

// ---------------------------------------------------------------------------
// Schemas not exported from src/api/schemas.ts but used by queries.ts.
// ---------------------------------------------------------------------------

// `useStartBattle` (POST /api/v1/battles) — matches the inline schema in
// queries.ts (StartBattleResponseSchema).
const StartBattleResponseStrictSchema = z.object({ battle_id: z.string() }).passthrough();

// `usePerInputLeaderboard` (GET /api/v1/leaderboard/inputs/:id) — matches
// the inline schema in queries.ts (PerInputLeaderboardResponseSchema).
const PerInputLeaderboardResponseStrictSchema = z
  .object({
    input: InputSummaryStrictSchema,
    items: z.array(PerInputLeaderboardEntryStrictSchema),
    next_cursor: z.string().nullable(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNUP_BODY = JSON.stringify({
  display_name: 'Recon',
  email: 'recon@example.com',
  password: 'longenough123',
});

async function signedUpApp(): Promise<{ t: TestApp; cookie: string }> {
  server.use(
    http.post(`${UPSTREAM}/v1/users`, () =>
      HttpResponse.json({
        user_id: 'sba_user_1',
        display_name: 'Recon',
        api_key: 'sk_live_secret',
      }),
    ),
  );
  const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
  const signup = await t.app.request('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: SIGNUP_BODY,
  });
  expect(signup.status).toBe(201);
  const cookie = signup.headers.get('set-cookie')!.split(';')[0]!;
  return { t, cookie };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contract drift — every endpoint matches src/api/schemas.ts', () => {
  describe('public read endpoints', () => {
    it('GET /api/healthz returns text/plain "ok"', async () => {
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/healthz');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    });

    it('GET /api/v1/bots/:id matches BotStrictSchema', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/bots/bot_xyz`, () => HttpResponse.json(apiBot)),
        http.get(`${UPSTREAM}/v1/bots/bot_xyz/profile`, () => HttpResponse.json(apiBotProfile)),
        http.get(`${UPSTREAM}/v1/bots/bot_xyz/analysis`, () =>
          HttpResponse.json({ algorithm: 'Timsort' }),
        ),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/bots/bot_xyz');
      expect(res.status).toBe(200);
      BotStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/bots/:id/runs matches CursorPage(BotRunStrictSchema)', async () => {
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/bots/bot_xyz/runs');
      expect(res.status).toBe(200);
      CursorPageSchema(BotRunStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/bots/:id/snapshots matches z.array(BotSnapshotStrictSchema)', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/bots/bot_xyz/rank-history`, () =>
          HttpResponse.json({
            bot_id: 'bot_xyz',
            count: 1,
            history: [
              {
                bot_id: 'bot_xyz',
                rank: 1,
                score: 12,
                snapshot_at: '2026-04-29T00:00:00Z',
                triggering_bot_id: 'bot_xyz',
              },
            ],
          }),
        ),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/bots/bot_xyz/snapshots');
      expect(res.status).toBe(200);
      z.array(BotSnapshotStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/bots/:id/inputs matches z.array(InputPerformanceStrictSchema)', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/bots/bot_xyz/profile`, () => HttpResponse.json(apiBotProfile)),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/bots/bot_xyz/inputs');
      expect(res.status).toBe(200);
      z.array(InputPerformanceStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/bots/:id/analysis matches AnalysisResponseStrictSchema', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/bots/bot_xyz/analysis`, () =>
          HttpResponse.json({
            algorithm: 'Timsort',
            time_complexity_estimate: 'O(n log n)',
            space_complexity_estimate: 'O(n)',
            strengths: ['Stable'],
            weaknesses: ['Higher memory use'],
            suggested_use_cases: ['Mixed real-world data'],
            anti_patterns: ['Tiny embedded targets'],
            reasoning: 'Python defers to Timsort.',
          }),
        ),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/bots/bot_xyz/analysis');
      expect(res.status).toBe(200);
      AnalysisResponseStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/leaderboard matches CursorPage(LeaderboardEntryStrictSchema)', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/leaderboard`, () => HttpResponse.json(apiLeaderboardOne)),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/leaderboard?limit=10');
      expect(res.status).toBe(200);
      CursorPageSchema(LeaderboardEntryStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/leaderboard/inputs/:id matches PerInputLeaderboardResponseStrictSchema', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/leaderboard/inputs/1`, () => HttpResponse.json(apiPerInputOne)),
        http.get(`${UPSTREAM}/v1/inputs`, () => HttpResponse.json(apiInputsOne)),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/leaderboard/inputs/1');
      expect(res.status).toBe(200);
      PerInputLeaderboardResponseStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/inputs matches CursorPage(InputSummaryStrictSchema)', async () => {
      server.use(http.get(`${UPSTREAM}/v1/inputs`, () => HttpResponse.json(apiInputsOne)));
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/inputs');
      expect(res.status).toBe(200);
      CursorPageSchema(InputSummaryStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/battles matches CursorPage(BattleStrictSchema)', async () => {
      // The history list is backed by recent_battles (empty by default); the
      // route returns an empty cursor page without calling upstream.
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/battles');
      expect(res.status).toBe(200);
      CursorPageSchema(BattleStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/battles/:id matches BattleStrictSchema', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/battles/bat_1`, () => HttpResponse.json(apiBattle)),
        http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(apiBotA)),
        http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(apiBotB)),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/battles/bat_1');
      expect(res.status).toBe(200);
      BattleStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/tournaments matches CursorPage(TournamentStrictSchema)', async () => {
      // Backed by recent_tournaments (empty by default).
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/tournaments');
      expect(res.status).toBe(200);
      CursorPageSchema(TournamentStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/tournaments/:id matches TournamentStrictSchema', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/tournaments/tour_abc`, () => HttpResponse.json(apiTournament)),
        http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(apiBotA)),
        http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(apiBotB)),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/tournaments/tour_abc');
      expect(res.status).toBe(200);
      TournamentStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/feed/snapshot matches HomeSnapshotStrictSchema', async () => {
      server.use(
        http.get(`${UPSTREAM}/v1/leaderboard`, () => HttpResponse.json(apiLeaderboardOne)),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/feed/snapshot');
      expect(res.status).toBe(200);
      HomeSnapshotStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/halloffame matches z.array(BotStrictSchema)', async () => {
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/halloffame');
      expect(res.status).toBe(200);
      z.array(BotStrictSchema).parse(await res.json());
    });

    it('GET /api/v1/achievements matches z.array(AchievementDefinitionStrictSchema)', async () => {
      server.use(http.get(`${UPSTREAM}/v1/stats`, () => HttpResponse.json(apiStats)));
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/achievements');
      expect(res.status).toBe(200);
      z.array(AchievementDefinitionStrictSchema).parse(await res.json());
    });
  });

  describe('authed read endpoints', () => {
    it('GET /api/v1/auth/me matches SessionUserStrictSchema', async () => {
      const { t, cookie } = await signedUpApp();
      const res = await t.app.request('/api/v1/auth/me', { headers: { cookie } });
      expect(res.status).toBe(200);
      SessionUserStrictSchema.parse(await res.json());
    });

    it('GET /api/v1/users/me/bots matches z.array(BotStrictSchema)', async () => {
      const { t, cookie } = await signedUpApp();
      // Submit one bot so the synth list has an item to validate.
      server.use(
        http.post(`${UPSTREAM}/v1/bots`, () =>
          HttpResponse.json({
            id: 'sba_bot_1',
            user_id: 'sba_user_1',
            display_name: 'Recon Bot',
            language: 'python',
            source_size_bytes: 100,
            source_sha256: 'sha',
            status: 'pending',
            submitted_at: '2026-04-29T00:00:00Z',
          }),
        ),
      );
      const submit = await t.app.request('/api/v1/bots', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          display_name: 'Recon Bot',
          language: 'python',
          source: 'print(1)',
        }),
      });
      expect(submit.status).toBe(201);

      server.use(
        http.get(`${UPSTREAM}/v1/bots/sba_bot_1`, () =>
          HttpResponse.json({
            id: 'sba_bot_1',
            user_id: 'sba_user_1',
            display_name: 'Recon Bot',
            language: 'python',
            source_size_bytes: 100,
            source_sha256: 'sha',
            status: 'evaluated',
            submitted_at: '2026-04-29T00:00:00Z',
            evaluation_completed_at: '2026-04-29T00:01:00Z',
          }),
        ),
        http.get(`${UPSTREAM}/v1/bots/sba_bot_1/profile`, () => HttpResponse.json(apiBotProfile)),
      );

      const res = await t.app.request('/api/v1/users/me/bots', { headers: { cookie } });
      expect(res.status).toBe(200);
      z.array(BotStrictSchema).parse(await res.json());
    });
  });

  describe('write endpoints (mutations)', () => {
    it('POST /api/v1/auth/signup matches SessionUserStrictSchema', async () => {
      server.use(
        http.post(`${UPSTREAM}/v1/users`, () =>
          HttpResponse.json({
            user_id: 'sba_user_1',
            display_name: 'Recon',
            api_key: 'sk_live_secret',
          }),
        ),
      );
      const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
      const res = await t.app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: SIGNUP_BODY,
      });
      expect(res.status).toBe(201);
      SessionUserStrictSchema.parse(await res.json());
    });

    it('POST /api/v1/auth/login matches SessionUserStrictSchema', async () => {
      const { t } = await signedUpApp();
      const res = await t.app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'recon@example.com', password: 'longenough123' }),
      });
      expect(res.status).toBe(200);
      SessionUserStrictSchema.parse(await res.json());
    });

    it('POST /api/v1/bots matches BotStrictSchema (synthesized rich shape)', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/bots`, () =>
          HttpResponse.json({
            id: 'sba_bot_1',
            user_id: 'sba_user_1',
            display_name: 'Recon Bot',
            language: 'python',
            source_size_bytes: 100,
            source_sha256: 'sha',
            status: 'pending',
            submitted_at: '2026-04-29T00:00:00Z',
          }),
        ),
      );
      const res = await t.app.request('/api/v1/bots', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          display_name: 'Recon Bot',
          language: 'python',
          source: 'print(1)',
        }),
      });
      expect(res.status).toBe(201);
      BotStrictSchema.parse(await res.json());
    });

    it('POST /api/v1/inputs matches InputSummaryStrictSchema', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, () =>
          HttpResponse.json({
            id: 99,
            size_class: 'small',
            case_index: 0,
            array_len: 5,
            is_custom: true,
            uploader_id: 'sba_user_1',
            created_at: '2026-04-29T00:00:00Z',
          }),
        ),
      );
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1, 2, 3, 4, 5], format: 'comma' }),
      });
      expect(res.status).toBe(201);
      InputSummaryStrictSchema.parse(await res.json());
    });

    it('POST /api/v1/battles matches StartBattleResponseStrictSchema', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.get(`${UPSTREAM}/v1/inputs`, () => HttpResponse.json(apiInputsOne)),
        http.post(`${UPSTREAM}/v1/battles`, () =>
          HttpResponse.json({
            battle_id: 'bat_upstream_1',
            bot_a: 'bot_a',
            bot_b: 'bot_b',
            input_ids: [1],
            status: 'running',
            created_at: '2026-04-29T00:00:00Z',
          }),
        ),
      );
      const res = await t.app.request('/api/v1/battles', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ bot_a: 'bot_a', bot_b: 'bot_b', input_ids: [1] }),
      });
      expect(res.status).toBe(200);
      StartBattleResponseStrictSchema.parse(await res.json());
    });

    it('POST /api/v1/tournaments matches CreateTournamentResponseStrictSchema (B6 drift resolved by D4)', async () => {
      // Slice D4 — server now returns the clean `{tournament_id, status}`
      // envelope (CreateTournamentResponseSchema) and the frontend's
      // `useStartTournament` parses against the matching schema. This
      // closes the B6 drift the test originally flagged.
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () =>
          HttpResponse.json({
            tournament_id: 'tour_upstream_1',
            participant_count: 4,
            status: 'pending',
            created_at: '2026-04-29T00:00:00Z',
            bracket: {},
          }),
        ),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ['bot_1', 'bot_2', 'bot_3', 'bot_4'],
          count: 3,
          bracket_size: 4,
          input_mode: 'flat_random',
        }),
      });
      expect([200, 201]).toContain(res.status);
      CreateTournamentResponseStrictSchema.parse(await res.json());
    });
  });
});
