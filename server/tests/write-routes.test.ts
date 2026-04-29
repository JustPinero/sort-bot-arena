import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const upstreamCreatedBot = {
  id: 'sba_bot_1',
  user_id: 'sba_user_1',
  display_name: 'Recon Bot',
  language: 'python',
  source_size_bytes: 100,
  source_sha256: 'sha',
  status: 'pending',
  submitted_at: 'T0',
};

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

describe('POST /api/v1/bots', () => {
  it('401s without a session', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: 'B', language: 'python', source: 'x' }),
    });
    expect(res.status).toBe(401);
  });

  it('forwards multipart to sort-bot-api with the user key, records ownership', async () => {
    const { t, cookie } = await signedUpApp();
    let captured: { auth: string | null; displayName: string | null; lang: string | null; sourceText: string } | null = null;
    server.use(
      http.post(`${UPSTREAM}/v1/bots`, async ({ request }) => {
        const fd = await request.formData();
        const sourceFile = fd.get('source') as Blob | null;
        captured = {
          auth: request.headers.get('authorization'),
          displayName: fd.get('display_name') as string | null,
          lang: fd.get('language') as string | null,
          sourceText: sourceFile ? await sourceFile.text() : '',
        };
        return HttpResponse.json(upstreamCreatedBot);
      }),
    );

    const res = await t.app.request('/api/v1/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        display_name: 'Recon Bot',
        language: 'python',
        source: 'print(1)\n',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['id']).toBe('sba_bot_1');
    expect(body['nickname']).toBeTruthy();

    expect(captured!.auth).toBe('Bearer sk_live_secret');
    expect(captured!.displayName).toBe('Recon Bot');
    expect(captured!.lang).toBe('python');
    expect(captured!.sourceText).toBe('print(1)\n');

    // Ownership row exists
    const row = await t.db.execute({
      sql: 'SELECT user_id FROM user_bots WHERE sort_bot_api_bot_id = ?',
      args: ['sba_bot_1'],
    });
    expect(row.rows[0]?.['user_id']).toMatch(/^usr_/);
  });

  it('GET /me/bots returns the synthesized list of the authed user bots', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.post(`${UPSTREAM}/v1/bots`, () => HttpResponse.json(upstreamCreatedBot)),
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
      http.get(`${UPSTREAM}/v1/bots/sba_bot_1`, () => HttpResponse.json(upstreamCreatedBot)),
      http.get(`${UPSTREAM}/v1/bots/sba_bot_1/profile`, () =>
        HttpResponse.json({
          bot: upstreamCreatedBot,
          rank: 5,
          score: 12.0,
          incomplete: false,
          inputs_covered: 57,
          total_inputs: 57,
          best_input: { input_id: 1, median_ms: 7 },
          worst_input: { input_id: 45, median_ms: 216 },
          per_input: [],
          rank_history: [],
        }),
      ),
    );
    const res = await t.app.request('/api/v1/users/me/bots', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bots: Array<{ id: string; rank: number | null }> };
    expect(body.bots).toHaveLength(1);
    expect(body.bots[0]?.id).toBe('sba_bot_1');
    expect(body.bots[0]?.rank).toBe(5);
  });

  it('upstream 5xx → 502', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.post(`${UPSTREAM}/v1/bots`, () =>
        HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
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
    expect(res.status).toBe(502);
  });
});

describe('PATCH/DELETE /api/v1/bots/:id', () => {
  it('PATCH 403s when caller is not owner', async () => {
    const { t, cookie } = await signedUpApp();
    const res = await t.app.request('/api/v1/bots/somebody_elses_bot', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ display_name: 'newname' }),
    });
    expect(res.status).toBe(403);
  });

  it('DELETE marks user_bots.retired_at', async () => {
    const { t, cookie } = await signedUpApp();
    server.use(
      http.post(`${UPSTREAM}/v1/bots`, () => HttpResponse.json(upstreamCreatedBot)),
    );
    await t.app.request('/api/v1/bots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        display_name: 'Recon Bot',
        language: 'python',
        source: 'print(1)',
      }),
    });

    server.use(
      http.delete(`${UPSTREAM}/v1/bots/sba_bot_1`, () => new HttpResponse(null, { status: 204 })),
    );
    const res = await t.app.request('/api/v1/bots/sba_bot_1', {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(res.status).toBe(204);
    const row = await t.db.execute({
      sql: 'SELECT retired_at FROM user_bots WHERE sort_bot_api_bot_id=?',
      args: ['sba_bot_1'],
    });
    expect(row.rows[0]?.['retired_at']).toBeTruthy();
  });
});
