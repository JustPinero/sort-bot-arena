// Programmatic signup helper for the real-server Playwright project.
//
// Slices G2-G6 will use this to seed users without driving the
// browser through the SignUpDialog. We POST directly to the arena
// server's `/api/v1/auth/signup` endpoint and return the resulting
// session cookie + user payload.

import type { APIRequestContext } from '@playwright/test';

export interface StubUser {
  display_name: string;
  email: string;
  password: string;
}

export interface SignupResult {
  user: { id: string; email: string; display_name: string };
  /** Set-Cookie header from the signup response (sb_session=...). */
  cookieHeader: string | null;
}

export async function signupViaApi(
  request: APIRequestContext,
  user: StubUser,
  apiBaseUrl = 'http://localhost:3055',
): Promise<SignupResult> {
  const res = await request.post(`${apiBaseUrl}/api/v1/auth/signup`, {
    data: user,
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`signupViaApi failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { id: string; email: string; display_name: string };
  return { user: body, cookieHeader: res.headers()['set-cookie'] ?? null };
}

/** Generate a unique-ish email so reruns don't collide on the unique index. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}+${Date.now().toString(36)}@example.com`;
}
