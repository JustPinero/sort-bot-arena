// Slice 9.5 — POST /api/v1/tournaments
//
// Closes the server-side gap left by slice 9: the frontend modal now
// sends `bracket_size` + `input_mode` to /api/v1/tournaments but our
// server didn't have a POST handler. This route validates the body,
// proxies the upstream-supported subset (`participant_bot_ids`, `count`)
// to sort-bot-api's `POST /v1/tournaments`, then mirrors a row into
// `recent_tournaments` so the slice 7 history list and the new
// `bracket_size` / `input_mode` columns get populated.

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function upstreamCreateTournamentResponse(tournamentId: string, participantCount: number) {
  return {
    tournament_id: tournamentId,
    participant_count: participantCount,
    status: 'pending',
    created_at: '2026-04-29T00:00:00.000Z',
    bracket: {},
  };
}

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

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `bot_${i + 1}`);
}

describe('POST /api/v1/tournaments', () => {
  it('401s without a session cookie', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/tournaments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        participant_bot_ids: ids(8),
        count: 3,
        bracket_size: 8,
        input_mode: 'flat_random',
      }),
    });
    expect(res.status).toBe(401);
  });

  describe('validation', () => {
    it('rejects bracket_size/participant_bot_ids length mismatch with 400 bad_field, no upstream call', async () => {
      const { t, cookie } = await signedUpApp();
      let calledUpstream = false;
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () => {
          calledUpstream = true;
          return HttpResponse.json(upstreamCreateTournamentResponse('tour_1', 6));
        }),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ids(6), // length 6 but bracket_size: 8
          count: 3,
          bracket_size: 8,
          input_mode: 'flat_random',
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
      expect(calledUpstream).toBe(false);
    });

    it('rejects duplicate bot ids with 400 bad_field, no upstream call', async () => {
      const { t, cookie } = await signedUpApp();
      let calledUpstream = false;
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () => {
          calledUpstream = true;
          return HttpResponse.json(upstreamCreateTournamentResponse('tour_1', 4));
        }),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ['bot_1', 'bot_2', 'bot_2', 'bot_4'],
          count: 3,
          bracket_size: 4,
          input_mode: 'flat_random',
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
      expect(calledUpstream).toBe(false);
    });

    it.each([5, 16, 0, 7, 100])(
      'rejects invalid bracket_size=%i with 400 bad_field, no upstream call',
      async (size) => {
        const { t, cookie } = await signedUpApp();
        let calledUpstream = false;
        server.use(
          http.post(`${UPSTREAM}/v1/tournaments`, () => {
            calledUpstream = true;
            return HttpResponse.json(upstreamCreateTournamentResponse('tour_1', size));
          }),
        );
        const res = await t.app.request('/api/v1/tournaments', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            participant_bot_ids: ids(Math.max(1, size)),
            count: 3,
            bracket_size: size,
            input_mode: 'flat_random',
          }),
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body['error']).toBe('bad_field');
        expect(calledUpstream).toBe(false);
      },
    );

    it('rejects invalid input_mode with 400 bad_field, no upstream call', async () => {
      const { t, cookie } = await signedUpApp();
      let calledUpstream = false;
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () => {
          calledUpstream = true;
          return HttpResponse.json(upstreamCreateTournamentResponse('tour_1', 4));
        }),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ids(4),
          count: 3,
          bracket_size: 4,
          input_mode: 'random',
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
      expect(calledUpstream).toBe(false);
    });
  });

  describe('happy path', () => {
    it('proxies to upstream with only participant_bot_ids+count, mirrors bracket_size/input_mode/status=running on recent_tournaments, returns CreateTournamentResponse', async () => {
      const { t, cookie } = await signedUpApp();
      let captured: {
        auth: string | null;
        body: Record<string, unknown> | null;
      } | null = null;
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, async ({ request }) => {
          captured = {
            auth: request.headers.get('authorization'),
            body: (await request.json()) as Record<string, unknown>,
          };
          return HttpResponse.json(upstreamCreateTournamentResponse('tour_upstream_1', 8));
        }),
      );

      const participantBotIds = ids(8);
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: participantBotIds,
          count: 3,
          bracket_size: 8,
          input_mode: 'escalation',
        }),
      });

      expect([200, 201]).toContain(res.status);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['tournament_id']).toBe('tour_upstream_1');

      // Upstream got only the supported subset.
      expect(captured!.auth).toBe('Bearer sk_live_secret');
      expect(captured!.body).toEqual({
        participant_bot_ids: participantBotIds,
        count: 3,
      });
      expect(captured!.body).not.toHaveProperty('bracket_size');
      expect(captured!.body).not.toHaveProperty('input_mode');

      // Mirror row recorded with the slice 9.5 columns populated.
      const row = await t.db.execute({
        sql: `SELECT tournament_id, initiator_user_id, participant_count,
                     bracket_size, input_mode, status
                FROM recent_tournaments
               WHERE tournament_id = ?`,
        args: ['tour_upstream_1'],
      });
      expect(row.rows).toHaveLength(1);
      const r = row.rows[0] as unknown as Record<string, unknown>;
      expect(r['tournament_id']).toBe('tour_upstream_1');
      expect(r['initiator_user_id']).toMatch(/^usr_/);
      expect(Number(r['participant_count'])).toBe(8);
      expect(Number(r['bracket_size'])).toBe(8);
      expect(r['input_mode']).toBe('escalation');
      expect(r['status']).toBe('running');
    });

    it.each([4, 6, 8, 12])('accepts bracket_size=%i with matching participants', async (size) => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () =>
          HttpResponse.json(upstreamCreateTournamentResponse(`tour_${size}`, size)),
        ),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ids(size),
          count: 3,
          bracket_size: size,
          input_mode: 'flat_random',
        }),
      });
      expect([200, 201]).toContain(res.status);
      const row = await t.db.execute({
        sql: 'SELECT bracket_size, participant_count FROM recent_tournaments WHERE tournament_id = ?',
        args: [`tour_${size}`],
      });
      expect(row.rows).toHaveLength(1);
      const r = row.rows[0] as unknown as Record<string, unknown>;
      expect(Number(r['bracket_size'])).toBe(size);
      expect(Number(r['participant_count'])).toBe(size);
    });
  });

  describe('upstream error envelopes', () => {
    it('returns 502 upstream_failure on upstream 5xx, no row inserted', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () =>
          HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
        ),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ids(4),
          count: 3,
          bracket_size: 4,
          input_mode: 'flat_random',
        }),
      });
      expect(res.status).toBe(502);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('upstream_failure');
      expect(body['upstream_status']).toBe(500);

      const row = await t.db.execute({
        sql: 'SELECT COUNT(*) AS n FROM recent_tournaments',
        args: [],
      });
      expect(Number((row.rows[0] as unknown as Record<string, unknown>)['n'])).toBe(0);
    });

    it('propagates upstream 4xx with upstream_failure envelope', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/tournaments`, () =>
          HttpResponse.json({ error: 'bot not found', code: 'bot_not_found' }, { status: 404 }),
        ),
      );
      const res = await t.app.request('/api/v1/tournaments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          participant_bot_ids: ids(4),
          count: 3,
          bracket_size: 4,
          input_mode: 'flat_random',
        }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('upstream_failure');
      expect(body['upstream_status']).toBe(404);
    });
  });
});
