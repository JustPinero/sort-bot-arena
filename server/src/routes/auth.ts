import { Hono } from 'hono';
import { z } from 'zod';

import { encryptString } from '../auth/encrypt.js';
import { requireAuth, type AppContext, getUser } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { buildLogoutCookie, buildSessionCookie, signSession } from '../auth/sessions.js';
import { SortBotApiError } from '../clients/sort-bot-api/index.js';
import { createUser, getUserByEmail } from '../store/users.js';

import type { SortBotApiClient } from '../clients/sort-bot-api/index.js';
import type { Client } from '@libsql/client';

interface Deps {
  db: Client;
  sortBotApi: SortBotApiClient;
  sessionSecret: string;
  cookieSecure: boolean;
}

const signupSchema = z.object({
  display_name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export function authRoutes(deps: Deps): Hono<AppContext> {
  const r = new Hono<AppContext>();

  r.post('/signup', async (c) => {
    const body = signupSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'bad_field', issues: body.error.issues }, 400);
    }

    const existing = await getUserByEmail(deps.db, body.data.email);
    if (existing) return c.json({ error: 'email_taken' }, 409);

    let upstream: { user_id: string; api_key: string };
    try {
      const created = await deps.sortBotApi.createUser({
        display_name: body.data.display_name,
        email: body.data.email,
      });
      upstream = { user_id: created.user_id, api_key: created.api_key };
    } catch (err) {
      if (err instanceof SortBotApiError) {
        return c.json({ error: 'upstream_failure', upstream_status: err.status }, 502);
      }
      throw err;
    }

    const password_hash = await hashPassword(body.data.password);
    const user = await createUser(deps.db, {
      email: body.data.email,
      display_name: body.data.display_name,
      password_hash,
      sort_bot_api_user_id: upstream.user_id,
      sort_bot_api_key_encrypted: encryptString(upstream.api_key, deps.sessionSecret),
    });

    const token = await signSession({ user_id: user.id }, deps.sessionSecret);
    c.header('Set-Cookie', buildSessionCookie(token, { secure: deps.cookieSecure }));
    return c.json({ id: user.id, display_name: user.display_name, email: user.email }, 201);
  });

  r.post('/login', async (c) => {
    const body = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'bad_field', issues: body.error.issues }, 400);
    }

    const user = await getUserByEmail(deps.db, body.data.email);
    if (!user) return c.json({ error: 'invalid_credentials' }, 401);
    const ok = await verifyPassword(body.data.password, user.password_hash);
    if (!ok) return c.json({ error: 'invalid_credentials' }, 401);

    const token = await signSession({ user_id: user.id }, deps.sessionSecret);
    c.header('Set-Cookie', buildSessionCookie(token, { secure: deps.cookieSecure }));
    return c.json({ id: user.id, display_name: user.display_name, email: user.email });
  });

  r.post('/logout', (c) => {
    c.header('Set-Cookie', buildLogoutCookie({ secure: deps.cookieSecure }));
    return c.body(null, 204);
  });

  r.get('/me', requireAuth({ db: deps.db, sessionSecret: deps.sessionSecret }), (c) => {
    const u = getUser(c);
    return c.json({ id: u.id, display_name: u.display_name, email: u.email });
  });

  return r;
}
