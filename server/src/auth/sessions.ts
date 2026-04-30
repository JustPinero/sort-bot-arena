import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'sort-bot-arena-server';
const AUDIENCE = 'sort-bot-arena-web';
const TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export const SESSION_COOKIE = 'session';

export interface SessionPayload {
  user_id: string;
}

function secretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ user_id: payload.user_id })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretBytes(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secretBytes(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload['user_id'] !== 'string') {
    throw new Error('session missing user_id');
  }
  return { user_id: payload['user_id'] as string };
}

export function buildSessionCookie(token: string, opts: { secure: boolean }): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TTL_SECONDS}`,
  ];
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildLogoutCookie(opts: { secure: boolean }): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === SESSION_COOKIE && v) return v;
  }
  return null;
}
