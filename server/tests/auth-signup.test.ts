import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('POST /api/v1/auth/signup', () => {
  it('signs up, sets a session cookie, and stashes the upstream key', async () => {
    let upstreamReq: { display_name: string; email: string } | null = null;
    server.use(
      http.post(`${UPSTREAM}/v1/users`, async ({ request }) => {
        upstreamReq = (await request.json()) as { display_name: string; email: string };
        return HttpResponse.json({
          user_id: 'sba_user_1',
          display_name: 'Recon',
          api_key: 'sk_live_secret123',
        });
      }),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const res = await t.app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Recon',
        email: 'recon@example.com',
        password: 'longenough123',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; email: string };
    expect(body.email).toBe('recon@example.com');
    expect(body.id).toMatch(/^usr_/);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^session=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    expect(upstreamReq).toEqual({ display_name: 'Recon', email: 'recon@example.com' });

    // Persisted with the upstream user id and a non-plaintext encrypted key.
    const row = await t.db.execute({
      sql: 'SELECT sort_bot_api_user_id, sort_bot_api_key_encrypted FROM users WHERE email=?',
      args: ['recon@example.com'],
    });
    expect(row.rows[0]?.['sort_bot_api_user_id']).toBe('sba_user_1');
    const raw = row.rows[0]?.['sort_bot_api_key_encrypted'] as Uint8Array | ArrayBuffer;
    const keyBlob = raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(new Uint8Array(raw));
    // ciphertext layout: 12-byte IV + 16-byte tag + ciphertext, never the
    // plaintext key
    expect(keyBlob.byteLength).toBeGreaterThan(28);
    expect(keyBlob.toString('utf8')).not.toContain('sk_live_secret123');
  });

  it('rejects duplicate emails with 409', async () => {
    server.use(
      http.post(`${UPSTREAM}/v1/users`, () =>
        HttpResponse.json({
          user_id: 'sba_dup',
          display_name: 'Recon',
          api_key: 'sk_live_dup',
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const payload = {
      display_name: 'Recon',
      email: 'dup@example.com',
      password: 'longenough123',
    };
    const first = await t.app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    const second = await t.app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(409);
    expect((await second.json()) as { error: string }).toEqual({ error: 'email_taken' });
  });

  it('400s a too-short password without calling sort-bot-api', async () => {
    let upstreamCalled = false;
    server.use(
      http.post(`${UPSTREAM}/v1/users`, () => {
        upstreamCalled = true;
        return HttpResponse.json({});
      }),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const res = await t.app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Recon',
        email: 'r@example.com',
        password: 'short',
      }),
    });
    expect(res.status).toBe(400);
    expect(upstreamCalled).toBe(false);
  });

  it('502s when sort-bot-api fails', async () => {
    server.use(
      http.post(`${UPSTREAM}/v1/users`, () =>
        HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });

    const res = await t.app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Recon',
        email: 'kaboom@example.com',
        password: 'longenough123',
      }),
    });
    expect(res.status).toBe(502);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'upstream_failure',
    });
  });
});

describe('login + me + logout', () => {
  async function setupSignedUp() {
    server.use(
      http.post(`${UPSTREAM}/v1/users`, () =>
        HttpResponse.json({
          user_id: 'sba_x',
          display_name: 'Recon',
          api_key: 'sk_live_x',
        }),
      ),
    );
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const signup = await t.app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Recon',
        email: 'login@example.com',
        password: 'longenough123',
      }),
    });
    expect(signup.status).toBe(201);
    return t;
  }

  it('GET /me 401s without a cookie', async () => {
    const t = await setupSignedUp();
    const res = await t.app.request('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /me returns the user when a fresh cookie is presented', async () => {
    const t = await setupSignedUp();
    const login = await t.app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'longenough123' }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const me = await t.app.request('/api/v1/auth/me', { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()) as { email: string }).toMatchObject({
      email: 'login@example.com',
    });
  });

  it('POST /login with bad password returns 401', async () => {
    const t = await setupSignedUp();
    const res = await t.app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'wrong-pass' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /logout clears the cookie (Max-Age=0)', async () => {
    const t = await setupSignedUp();
    const res = await t.app.request('/api/v1/auth/logout', { method: 'POST' });
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/);
  });
});
