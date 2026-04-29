import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SortBotApiClient, SortBotApiError } from '../src/clients/sort-bot-api/index.js';

const BASE = 'http://api.test';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = new SortBotApiClient({ baseUrl: BASE });

describe('SortBotApiClient', () => {
  it('createUser POSTs JSON to /v1/users and returns the canonical shape', async () => {
    let captured: { method: string; body: unknown; contentType: string | null } | null = null;
    server.use(
      http.post(`${BASE}/v1/users`, async ({ request }) => {
        captured = {
          method: request.method,
          contentType: request.headers.get('content-type'),
          body: await request.json(),
        };
        return HttpResponse.json({
          user_id: 'u_abc',
          display_name: 'Recon',
          api_key: 'sk_live_test',
        });
      }),
    );

    const res = await client.createUser({ display_name: 'Recon', email: 'r@x.com' });
    expect(res).toEqual({ user_id: 'u_abc', display_name: 'Recon', api_key: 'sk_live_test' });
    expect(captured!.method).toBe('POST');
    expect(captured!.contentType).toMatch(/application\/json/);
    expect(captured!.body).toEqual({ display_name: 'Recon', email: 'r@x.com' });
  });

  it('attaches Authorization: Bearer for authed calls', async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/v1/users/me`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ id: 'u_abc', display_name: 'Recon' });
      }),
    );
    const res = await client.getMe('sk_live_xyz');
    expect(res.id).toBe('u_abc');
    expect(auth).toBe('Bearer sk_live_xyz');
  });

  it('unwraps {Int64,Valid}/{String,Valid} on /v1/bots/:id/runs', async () => {
    server.use(
      http.get(`${BASE}/v1/bots/bot_1/runs`, () =>
        HttpResponse.json({
          bot_id: 'bot_1',
          total: 2,
          runs: [
            {
              id: 1,
              bot_id: 'bot_1',
              input_id: 39,
              run_number: 1,
              status: 'success',
              duration_ms: { Int64: 32, Valid: true },
              cpu_ms: { Int64: 0, Valid: false },
              error_msg: { String: '', Valid: false },
              started_at: '2026-04-29T00:00:00Z',
              completed_at: '2026-04-29T00:00:00.040Z',
            },
            {
              id: 2,
              bot_id: 'bot_1',
              input_id: 40,
              run_number: 1,
              status: 'wrong_answer',
              duration_ms: { Int64: 0, Valid: false },
              cpu_ms: { Int64: 0, Valid: false },
              error_msg: { String: 'mismatch', Valid: true },
              started_at: '2026-04-29T00:01:00Z',
              completed_at: '2026-04-29T00:01:00.020Z',
            },
          ],
        }),
      ),
    );

    const res = await client.getBotRuns('bot_1');
    expect(res.runs[0]!.duration_ms).toBe(32);
    expect(res.runs[0]!.cpu_ms).toBeNull();
    expect(res.runs[0]!.error_msg).toBeNull();
    expect(res.runs[1]!.duration_ms).toBeNull();
    expect(res.runs[1]!.error_msg).toBe('mismatch');
  });

  it('unwraps battle.winner_bot_id and run.bot_a_duration_ms in /v1/battles/:id', async () => {
    server.use(
      http.get(`${BASE}/v1/battles/bat_1`, () =>
        HttpResponse.json({
          battle: {
            id: 'bat_1',
            bot_a_id: 'a',
            bot_b_id: 'b',
            initiator_id: 'u',
            status: 'complete',
            winner_bot_id: { String: 'a', Valid: true },
            bot_a_wins: 1,
            bot_b_wins: 0,
            ties: 0,
            created_at: 'T',
            completed_at: { String: 'T+1', Valid: true },
          },
          runs: [
            {
              id: 1,
              battle_id: 'bat_1',
              input_id: 39,
              bot_a_duration_ms: { Int64: 27, Valid: true },
              bot_b_duration_ms: { Int64: 28, Valid: true },
              bot_a_status: 'success',
              bot_b_status: 'success',
              winner_bot_id: { String: 'a', Valid: true },
              completed_at: 'T+1',
            },
          ],
        }),
      ),
    );

    const res = await client.getBattle('bat_1');
    expect(res.battle.winner_bot_id).toBe('a');
    expect(res.battle.completed_at).toBe('T+1');
    expect(res.runs[0]!.bot_a_duration_ms).toBe(27);
    expect(res.runs[0]!.winner_bot_id).toBe('a');
  });

  it('throws SortBotApiError with status + code for 4xx', async () => {
    server.use(
      http.post(`${BASE}/v1/battles`, () =>
        HttpResponse.json(
          { code: 'bad_field', error: 'bot_a and bot_b are required and must be distinct' },
          { status: 400 },
        ),
      ),
    );

    await expect(
      client.startBattle('sk_live_x', { bot_a: 'a', bot_b: 'a', count: 1 }),
    ).rejects.toMatchObject({
      name: 'SortBotApiError',
      status: 400,
      code: 'bad_field',
      message: expect.stringContaining('distinct'),
    });
  });

  it('throws SortBotApiError with status 0 on network failure', async () => {
    server.use(http.get(`${BASE}/v1/stats`, () => HttpResponse.error()));
    await expect(client.getStats()).rejects.toMatchObject({
      name: 'SortBotApiError',
      status: 0,
    });
  });
});
