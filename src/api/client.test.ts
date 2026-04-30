import { http, HttpResponse, delay } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

import { ApiError, apiClient } from './client';

const BASE = 'http://api.test';

describe('apiClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cookie auth', () => {
    it('does not attach an Authorization header (cookie session model)', async () => {
      let received: string | null = 'unset';
      server.use(
        http.get(`${BASE}/api/api/v1/echo`, ({ request }) => {
          received = request.headers.get('Authorization');
          return HttpResponse.json({ ok: true });
        }),
      );

      await apiClient.get('/api/api/v1/echo');
      expect(received).toBeNull();
    });
  });

  describe('timeout', () => {
    it('aborts and throws timeout ApiError after the configured ms', async () => {
      server.use(
        http.get(`${BASE}/api/v1/slow`, async () => {
          await delay(2000);
          return HttpResponse.json({ ok: true });
        }),
      );

      await expect(apiClient.get('/api/v1/slow', { timeoutMs: 50 })).rejects.toMatchObject({
        name: 'ApiError',
        code: 'timeout',
        retryable: true,
      });
    });
  });

  describe('error normalization', () => {
    it('4xx → ApiError with code, message, request_id, fields', async () => {
      server.use(
        http.post(`${BASE}/api/v1/bots`, () =>
          HttpResponse.json(
            {
              error: 'invalid input',
              code: 'validation_failed',
              request_id: 'req-xyz',
              fields: [{ path: 'display_name', message: 'must be ≥ 1 char' }],
            },
            { status: 400 },
          ),
        ),
      );

      const promise = apiClient.post('/api/v1/bots', { display_name: '' });
      await expect(promise).rejects.toBeInstanceOf(ApiError);
      try {
        await promise;
      } catch (err) {
        expect(err).toMatchObject({
          status: 400,
          code: 'validation_failed',
          message: 'invalid input',
          requestId: 'req-xyz',
          fields: [{ path: 'display_name', message: 'must be ≥ 1 char' }],
          retryable: false,
        });
      }
    });

    it('5xx → ApiError flagged retryable', async () => {
      server.use(
        http.get(`${BASE}/api/v1/leaderboard`, () =>
          HttpResponse.json(
            { error: 'oops', code: 'internal' },
            { status: 503, headers: { 'X-Request-Id': 'req-503' } },
          ),
        ),
      );

      const promise = apiClient.get('/api/v1/leaderboard');
      await expect(promise).rejects.toMatchObject({
        status: 503,
        retryable: true,
      });
    });
  });

  describe('happy path', () => {
    it('returns the parsed JSON body on 2xx', async () => {
      const body = await apiClient.get<{ status: string }>('/api/healthz');
      expect(body.status).toBe('ok');
    });

    it('serializes JSON request bodies and sets Content-Type', async () => {
      let received: { display_name?: string } | null = null;
      let contentType: string | null = null;
      server.use(
        http.post(`${BASE}/api/v1/echo`, async ({ request }) => {
          contentType = request.headers.get('Content-Type');
          received = (await request.json()) as { display_name?: string };
          return HttpResponse.json({ ok: true });
        }),
      );

      await apiClient.post('/api/v1/echo', { display_name: 'test' });
      expect(contentType).toContain('application/json');
      expect(received).toEqual({ display_name: 'test' });
    });
  });
});
