import type { Context, MiddlewareHandler } from 'hono';
import type { Client } from '@libsql/client';
import { getUserById, type UserRow } from '../store/users.js';
import { readSessionCookie, verifySession } from './sessions.js';

export interface AuthVariables {
  user: UserRow;
}

export interface AppContext {
  Variables: AuthVariables;
}

export function requireAuth(opts: {
  db: Client;
  sessionSecret: string;
}): MiddlewareHandler {
  return async (c, next) => {
    const token = readSessionCookie(c.req.header('cookie'));
    if (!token) return c.json({ error: 'unauthenticated' }, 401);

    try {
      const session = await verifySession(token, opts.sessionSecret);
      const user = await getUserById(opts.db, session.user_id);
      if (!user) return c.json({ error: 'unauthenticated' }, 401);
      c.set('user', user);
    } catch {
      return c.json({ error: 'unauthenticated' }, 401);
    }
    await next();
  };
}

export function getUser(c: Context<AppContext>): UserRow {
  const u = c.get('user');
  if (!u) throw new Error('getUser called outside of authed route');
  return u;
}
