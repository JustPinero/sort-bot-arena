// Slice 5 — battle weight-class label.
//
// Covers:
//   - Pure helper: every avg-of-size_classes combination → label or null.
//   - Integration (POST /api/v1/battles + GET /api/v1/battles/:id):
//       * explicit input_ids → server resolves size_classes via getInputs
//         and persists the derived weight_class label on recent_battles.
//       * count mode → weight_class persisted as null (server doesn't
//         pre-pick the inputs, sort-bot-api does).

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { weightClassFor } from '../src/synthesize/battle-class.js';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('weightClassFor', () => {
  it('returns null for empty input', () => {
    expect(weightClassFor([])).toBeNull();
  });

  it('handles single-element arrays', () => {
    expect(weightClassFor(['small'])).toBe('sparring');
    expect(weightClassFor(['medium'])).toBe('exhibition');
    expect(weightClassFor(['large'])).toBe('title_fight');
  });

  it('rounds 5/3 ≈ 1.67 up to exhibition', () => {
    expect(weightClassFor(['small', 'small', 'large'])).toBe('exhibition');
  });

  it('treats mean rank 2 as exhibition', () => {
    expect(weightClassFor(['small', 'large'])).toBe('exhibition');
    expect(weightClassFor(['medium', 'medium'])).toBe('exhibition');
  });

  it('rounds 8/3 ≈ 2.67 up to title_fight', () => {
    expect(weightClassFor(['large', 'large', 'medium'])).toBe('title_fight');
  });

  it('rounds 4/3 ≈ 1.33 down to sparring', () => {
    expect(weightClassFor(['small', 'small', 'medium'])).toBe('sparring');
  });

  it('handles all-large', () => {
    expect(weightClassFor(['large', 'large', 'large'])).toBe('title_fight');
  });
});

// --- Integration ---

async function signedUpApp() {
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
    body: JSON.stringify({
      display_name: 'Recon',
      email: 'recon@example.com',
      password: 'longenough123',
    }),
  });
  expect(signup.status).toBe(201);
  const cookie = signup.headers.get('set-cookie')!.split(';')[0]!;
  return { t, cookie };
}

const botA = {
  id: 'bot_a',
  user_id: 'u1',
  display_name: 'Alpha Bot',
  language: 'python',
  source_size_bytes: 100,
  source_sha256: 'sha_a',
  status: 'evaluated',
  submitted_at: 'T0',
  evaluation_completed_at: 'T1',
};

const botB = {
  id: 'bot_b',
  user_id: 'u2',
  display_name: 'Bravo Bot',
  language: 'node',
  source_size_bytes: 200,
  source_sha256: 'sha_b',
  status: 'evaluated',
  submitted_at: 'T0',
  evaluation_completed_at: 'T1',
};

describe('POST /api/v1/battles weight_class derivation', () => {
  it('persists derived weight_class when input_ids supplied (large+large+medium → title_fight)', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.get(`${UPSTREAM}/v1/inputs`, () =>
        HttpResponse.json({
          inputs: [
            {
              id: 39,
              size_class: 'large',
              case_index: 0,
              array_len: 100000,
              is_custom: false,
              uploader_id: null,
              created_at: 'T',
            },
            {
              id: 40,
              size_class: 'large',
              case_index: 1,
              array_len: 100000,
              is_custom: false,
              uploader_id: null,
              created_at: 'T',
            },
            {
              id: 30,
              size_class: 'medium',
              case_index: 0,
              array_len: 50000,
              is_custom: false,
              uploader_id: null,
              created_at: 'T',
            },
          ],
          total: 3,
        }),
      ),
      http.post(`${UPSTREAM}/v1/battles`, () =>
        HttpResponse.json({
          battle_id: 'bat_wc_title',
          bot_a: 'bot_a',
          bot_b: 'bot_b',
          input_ids: [39, 40, 30],
          status: 'pending',
          created_at: 'T',
        }),
      ),
    );

    const res = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        bot_a: 'bot_a',
        bot_b: 'bot_b',
        input_ids: [39, 40, 30],
      }),
    });
    expect(res.status).toBe(200);

    const row = await t.db.execute({
      sql: 'SELECT weight_class FROM recent_battles WHERE battle_id = ?',
      args: ['bat_wc_title'],
    });
    expect(row.rows[0]?.['weight_class']).toBe('title_fight');
  });

  it('persists exhibition for small+small+large (mean 5/3 ≈ 1.67 → 2)', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.get(`${UPSTREAM}/v1/inputs`, () =>
        HttpResponse.json({
          inputs: [
            { id: 1, size_class: 'small', case_index: 0, array_len: 100, is_custom: false, uploader_id: null, created_at: 'T' },
            { id: 2, size_class: 'small', case_index: 1, array_len: 100, is_custom: false, uploader_id: null, created_at: 'T' },
            { id: 50, size_class: 'large', case_index: 0, array_len: 100000, is_custom: false, uploader_id: null, created_at: 'T' },
          ],
          total: 3,
        }),
      ),
      http.post(`${UPSTREAM}/v1/battles`, () =>
        HttpResponse.json({
          battle_id: 'bat_wc_exhibition',
          bot_a: 'bot_a',
          bot_b: 'bot_b',
          input_ids: [1, 2, 50],
          status: 'pending',
          created_at: 'T',
        }),
      ),
    );

    const res = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        bot_a: 'bot_a',
        bot_b: 'bot_b',
        input_ids: [1, 2, 50],
      }),
    });
    expect(res.status).toBe(200);

    const row = await t.db.execute({
      sql: 'SELECT weight_class FROM recent_battles WHERE battle_id = ?',
      args: ['bat_wc_exhibition'],
    });
    expect(row.rows[0]?.['weight_class']).toBe('exhibition');
  });

  it('persists null when count is used instead of input_ids (server cannot know upstream picks)', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.post(`${UPSTREAM}/v1/battles`, () =>
        HttpResponse.json({
          battle_id: 'bat_wc_null',
          bot_a: 'bot_a',
          bot_b: 'bot_b',
          input_ids: [10, 20, 30],
          status: 'pending',
          created_at: 'T',
        }),
      ),
    );

    const res = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        bot_a: 'bot_a',
        bot_b: 'bot_b',
        count: 3,
      }),
    });
    expect(res.status).toBe(200);

    const row = await t.db.execute({
      sql: 'SELECT weight_class FROM recent_battles WHERE battle_id = ?',
      args: ['bat_wc_null'],
    });
    expect(row.rows[0]?.['weight_class']).toBeNull();
  });
});

describe('GET /api/v1/battles/:id surfaces weight_class', () => {
  it('returns the persisted weight_class label on the rich Battle shape', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.get(`${UPSTREAM}/v1/inputs`, () =>
        HttpResponse.json({
          inputs: [
            { id: 39, size_class: 'large', case_index: 0, array_len: 100000, is_custom: false, uploader_id: null, created_at: 'T' },
            { id: 40, size_class: 'large', case_index: 1, array_len: 100000, is_custom: false, uploader_id: null, created_at: 'T' },
            { id: 30, size_class: 'medium', case_index: 0, array_len: 50000, is_custom: false, uploader_id: null, created_at: 'T' },
          ],
          total: 3,
        }),
      ),
      http.post(`${UPSTREAM}/v1/battles`, () =>
        HttpResponse.json({
          battle_id: 'bat_get_wc',
          bot_a: 'bot_a',
          bot_b: 'bot_b',
          input_ids: [39, 40, 30],
          status: 'pending',
          created_at: 'T',
        }),
      ),
      http.get(`${UPSTREAM}/v1/battles/bat_get_wc`, () =>
        HttpResponse.json({
          battle: {
            id: 'bat_get_wc',
            bot_a_id: 'bot_a',
            bot_b_id: 'bot_b',
            initiator_id: 'u1',
            status: 'complete',
            winner_bot_id: { String: 'bot_a', Valid: true },
            bot_a_wins: 2,
            bot_b_wins: 1,
            ties: 0,
            created_at: '2026-04-29T00:00:00Z',
            completed_at: { String: '2026-04-29T00:05:00Z', Valid: true },
          },
          runs: [],
        }),
      ),
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
    );

    // First create the battle so the recent_battles row exists with the
    // computed weight_class.
    const created = await t.app.request('/api/v1/battles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        bot_a: 'bot_a',
        bot_b: 'bot_b',
        input_ids: [39, 40, 30],
      }),
    });
    expect(created.status).toBe(200);

    const res = await t.app.request('/api/v1/battles/bat_get_wc');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['weight_class']).toBe('title_fight');
  });

  it('returns weight_class: null for legacy battles without a recent_battles row', async () => {
    server.use(
      http.get(`${UPSTREAM}/v1/battles/bat_legacy`, () =>
        HttpResponse.json({
          battle: {
            id: 'bat_legacy',
            bot_a_id: 'bot_a',
            bot_b_id: 'bot_b',
            initiator_id: 'u1',
            status: 'complete',
            winner_bot_id: { String: 'bot_a', Valid: true },
            bot_a_wins: 1,
            bot_b_wins: 0,
            ties: 0,
            created_at: 'T',
            completed_at: { String: 'T+1', Valid: true },
          },
          runs: [],
        }),
      ),
      http.get(`${UPSTREAM}/v1/bots/bot_a`, () => HttpResponse.json(botA)),
      http.get(`${UPSTREAM}/v1/bots/bot_b`, () => HttpResponse.json(botB)),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/battles/bat_legacy');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['weight_class']).toBeNull();
  });
});
