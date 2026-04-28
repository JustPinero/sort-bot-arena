import { http, HttpResponse } from 'msw';

const BASE = 'http://api.test';

export const defaultHandlers = [
  http.get(`${BASE}/healthz`, () =>
    HttpResponse.json({ status: 'ok' }, { headers: { 'X-Request-Id': 'req-health-1' } }),
  ),

  http.post(`${BASE}/v1/users`, async ({ request }) => {
    const body = (await request.json()) as { display_name?: string };
    return HttpResponse.json(
      {
        id: 'usr_test_1',
        display_name: body.display_name ?? 'anonymous-test-0000',
        api_key: 'key_test_abc123',
      },
      { headers: { 'X-Request-Id': 'req-users-1' } },
    );
  }),

  http.get(`${BASE}/v1/users/me`, () =>
    HttpResponse.json({ id: 'usr_test_1', display_name: 'anonymous-test-0000' }),
  ),
];
