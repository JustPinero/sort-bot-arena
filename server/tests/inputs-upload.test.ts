import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { makeTestApp } from './helpers/test-app.js';

const UPSTREAM = 'http://api.test';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const upstreamUploadedInput = {
  id: 99,
  size_class: 'small',
  case_index: 0,
  array_len: 5,
  is_custom: true,
  uploader_id: 'sba_user_1',
  created_at: '2026-04-29T22:01:09.640923165Z',
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

describe('POST /api/v1/inputs', () => {
  it('401s without a session', async () => {
    const t = await makeTestApp({ sortBotApiBaseUrl: UPSTREAM });
    const res = await t.app.request('/api/v1/inputs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values: [1, 2, 3] }),
    });
    expect(res.status).toBe(401);
  });

  describe('validation', () => {
    it('rejects empty values array with 400 bad_field', async () => {
      const { t, cookie } = await signedUpApp();
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [] }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
    });

    it('rejects > 50,000 elements with 400', async () => {
      const { t, cookie } = await signedUpApp();
      const big = new Array(50_001).fill(0);
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: big }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
    });

    it('rejects floats with 400', async () => {
      const { t, cookie } = await signedUpApp();
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1.5, 2] }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
    });

    it('rejects non-numeric values with 400', async () => {
      const { t, cookie } = await signedUpApp();
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: ['1', '2'] }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['error']).toBe('bad_field');
    });

    it('rejects display_name longer than 80 chars', async () => {
      const { t, cookie } = await signedUpApp();
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1, 2, 3], display_name: 'a'.repeat(81) }),
      });
      expect(res.status).toBe(400);
    });

    it('does not call upstream when validation fails', async () => {
      const { t, cookie } = await signedUpApp();
      let calledUpstream = false;
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, () => {
          calledUpstream = true;
          return HttpResponse.json(upstreamUploadedInput);
        }),
      );
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1.5] }),
      });
      expect(res.status).toBe(400);
      expect(calledUpstream).toBe(false);
    });

    it('accepts negative integers', async () => {
      const { t, cookie } = await signedUpApp();
      let captured: { sourceText: string } | null = null;
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, async ({ request }) => {
          const fd = await request.formData();
          const file = fd.get('file') as Blob | null;
          captured = { sourceText: file ? await file.text() : '' };
          return HttpResponse.json({
            ...upstreamUploadedInput,
            array_len: 2,
          });
        }),
      );
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [-5, 5] }),
      });
      expect(res.status).toBe(201);
      expect(captured!.sourceText).toBe('-5,5');
    });
  });

  describe('format serialization', () => {
    async function captureUpstreamFor(values: number[], format?: string) {
      const { t, cookie } = await signedUpApp();
      let captured: { sourceText: string; auth: string | null } | null = null;
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, async ({ request }) => {
          const fd = await request.formData();
          const file = fd.get('file') as Blob | null;
          captured = {
            sourceText: file ? await file.text() : '',
            auth: request.headers.get('authorization'),
          };
          return HttpResponse.json({
            ...upstreamUploadedInput,
            array_len: values.length,
          });
        }),
      );
      const body: Record<string, unknown> = { values };
      if (format !== undefined) body['format'] = format;
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
      return captured!;
    }

    it('serializes comma-separated by default', async () => {
      const captured = await captureUpstreamFor([1, 2, 3]);
      expect(captured.sourceText).toBe('1,2,3');
    });

    it('serializes comma format explicitly', async () => {
      const captured = await captureUpstreamFor([1, 2, 3], 'comma');
      expect(captured.sourceText).toBe('1,2,3');
    });

    it('serializes space format', async () => {
      const captured = await captureUpstreamFor([1, 2, 3], 'space');
      expect(captured.sourceText).toBe('1 2 3');
    });

    it('serializes newline format', async () => {
      const captured = await captureUpstreamFor([1, 2, 3], 'newline');
      expect(captured.sourceText).toBe('1\n2\n3');
    });

    it('rejects unknown format', async () => {
      const { t, cookie } = await signedUpApp();
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1, 2], format: 'tab' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('upstream proxy + DB mirror', () => {
    it('forwards multipart with bearer key, mirrors row, returns InputSummary', async () => {
      const { t, cookie } = await signedUpApp();
      let captured: {
        auth: string | null;
        sourceText: string;
        contentType: string | null;
      } | null = null;
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, async ({ request }) => {
          const fd = await request.formData();
          const file = fd.get('file') as Blob | null;
          captured = {
            auth: request.headers.get('authorization'),
            sourceText: file ? await file.text() : '',
            contentType: file ? file.type : null,
          };
          return HttpResponse.json(upstreamUploadedInput);
        }),
      );

      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1, 2, 3, 4, 5], format: 'comma' }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['id']).toBe('99');
      expect(body['size']).toBe(5);
      expect(typeof body['name']).toBe('string');
      expect(body['name']).toBe('Small custom');

      expect(captured!.auth).toBe('Bearer sk_live_secret');
      expect(captured!.sourceText).toBe('1,2,3,4,5');
      expect(captured!.contentType).toBe('text/plain');

      const row = await t.db.execute({
        sql: 'SELECT uploader_user_id, sort_bot_api_input_id, size_class, array_len, display_name FROM uploaded_inputs WHERE sort_bot_api_input_id = ?',
        args: [99],
      });
      expect(row.rows).toHaveLength(1);
      const r = row.rows[0] as unknown as Record<string, unknown>;
      expect(r['uploader_user_id']).toMatch(/^usr_/);
      expect(r['sort_bot_api_input_id']).toBe(99);
      expect(r['size_class']).toBe('small');
      expect(r['array_len']).toBe(5);
      expect(r['display_name']).toBeNull();
    });

    it('uses display_name as InputSummary.name and persists it', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, () => HttpResponse.json(upstreamUploadedInput)),
      );
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1, 2, 3], display_name: 'My Killer Input' }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['name']).toBe('My Killer Input');

      const row = await t.db.execute({
        sql: 'SELECT display_name FROM uploaded_inputs WHERE sort_bot_api_input_id = ?',
        args: [99],
      });
      expect(row.rows[0]?.['display_name']).toBe('My Killer Input');
    });

    it('returns 502 on upstream 5xx', async () => {
      const { t, cookie } = await signedUpApp();
      server.use(
        http.post(`${UPSTREAM}/v1/inputs`, () =>
          HttpResponse.json({ error: 'kaboom' }, { status: 500 }),
        ),
      );
      const res = await t.app.request('/api/v1/inputs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ values: [1, 2, 3] }),
      });
      expect(res.status).toBe(502);
    });
  });
});
