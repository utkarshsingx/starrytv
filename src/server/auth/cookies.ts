import 'server-only';
import { cookies } from 'next/headers';
import { env } from '../env';
import { ACCESS_TTL_SEC, REFRESH_TTL_DAYS } from './tokens';

/**
 * The session, as four cookies.
 *
 * Because the pages and the /api routes are served from the same origin (the
 * API runs as Next.js route handlers on this very domain), this is all
 * FIRST-PARTY and same-site — so `SameSite=Lax` is enough to stop cross-site
 * POSTs, and `SameSite=None` (which Safari and Firefox partition or block
 * regardless) never has to appear.
 *
 *  st_at   access JWT      httpOnly, 15 min   — the session the server reads
 *  st_rt   refresh token   httpOnly, 30 days, path=/api/v1/auth — only ever sent
 *          to the refresh and logout routes, never to a page render
 *  st_role role hint       readable, 30 days  — lets middleware route without
 *          decoding the JWT; NEVER a security decision, the server re-checks
 */

export const AT = 'st_at';
export const RT = 'st_rt';
export const ROLE = 'st_role';

const REFRESH_PATH = '/api/v1/auth';

function base(secure: boolean) {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' } as const;
}

export async function setSessionCookies(opts: {
  access: string;
  refresh: string;
  role: 'user' | 'admin';
}) {
  const jar = await cookies();
  const secure = env().isProd;
  jar.set(AT, opts.access, { ...base(secure), maxAge: ACCESS_TTL_SEC });
  jar.set(RT, opts.refresh, {
    ...base(secure),
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_DAYS * 24 * 3600,
  });
  // Not httpOnly on purpose — the middleware and the client read it to decide
  // what to show. It is a hint; every real check happens server-side.
  jar.set(ROLE, opts.role, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  const secure = env().isProd;
  jar.set(AT, '', { ...base(secure), maxAge: 0 });
  jar.set(RT, '', { ...base(secure), path: REFRESH_PATH, maxAge: 0 });
  jar.set(ROLE, '', { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function readAccessCookie(): Promise<string | undefined> {
  return (await cookies()).get(AT)?.value;
}
export async function readRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(RT)?.value;
}
