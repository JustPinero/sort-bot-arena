// Cross-site cookie behaviour: in production (cookieSecure=true) the
// session cookie must be SameSite=None; Secure so browsers attach it
// on cross-origin fetch from Vercel → Railway. In dev (cookieSecure=
// false) it falls back to SameSite=Lax (Secure isn't allowed on http).
import { describe, expect, it } from 'vitest';

import { buildLogoutCookie, buildSessionCookie } from '../src/auth/sessions.js';

describe('session cookie attributes', () => {
  it('uses SameSite=None; Secure in production (secure: true)', () => {
    const cookie = buildSessionCookie('jwt.tok.en', { secure: true });
    expect(cookie).toMatch(/SameSite=None/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).not.toMatch(/SameSite=Lax/);
  });

  it('uses SameSite=Lax (no Secure) in local dev (secure: false)', () => {
    const cookie = buildSessionCookie('jwt.tok.en', { secure: false });
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/);
    expect(cookie).not.toMatch(/SameSite=None/);
  });

  it('logout cookie mirrors the SameSite policy', () => {
    expect(buildLogoutCookie({ secure: true })).toMatch(/SameSite=None/);
    expect(buildLogoutCookie({ secure: false })).toMatch(/SameSite=Lax/);
  });
});
