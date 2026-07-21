import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { googleAuthUrl } from '@/server/auth/google';
import { env } from '@/server/env';

export const runtime = 'nodejs';

/**
 * Start of the Google redirect flow. Mint a one-time `state`, stash it in a
 * short-lived httpOnly cookie, and send the browser to Google carrying the same
 * value. The callback rejects any response whose `state` does not match the
 * cookie — the standard OAuth CSRF defence.
 *
 * `next` (an optional relative path to return to after sign-in) rides along
 * inside state so a "sign in to continue" link lands the user back where they
 * were.
 */
export function GET(req: NextRequest) {
  const nonce = randomUUID();
  const nextPath = sanitiseNext(req.nextUrl.searchParams.get('next'));
  const state = `${nonce}.${Buffer.from(nextPath).toString('base64url')}`;

  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set('st_oauth', nonce, {
    httpOnly: true,
    secure: env().isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 600,
  });
  return res;
}

/** Only allow returning to a same-site path, never an absolute URL. */
function sanitiseNext(v: string | null): string {
  if (!v || !v.startsWith('/') || v.startsWith('//')) return '/desk';
  return v;
}
