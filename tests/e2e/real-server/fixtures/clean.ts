// Drops + re-runs the arena server's libsql migrations between specs.
//
// The corresponding server route is `POST /api/test/reset`, mounted only
// when `ENABLE_TEST_RESET=true` (gated). Specs call `clean()` from a
// `test.beforeEach` to guarantee a fresh DB without restarting the
// process.

import type { APIRequestContext } from '@playwright/test';

const DEFAULT_API = 'http://localhost:3055';

export async function clean(
  request: APIRequestContext,
  apiBaseUrl: string = DEFAULT_API,
): Promise<void> {
  const res = await request.post(`${apiBaseUrl}/api/test/reset`);
  if (!res.ok()) {
    throw new Error(`clean() failed: ${res.status()} ${await res.text()}`);
  }
}
