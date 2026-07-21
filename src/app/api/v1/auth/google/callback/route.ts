import { type NextRequest, NextResponse } from 'next/server';
import { googleLogin } from '@/server/auth/service';
import { setSessionCookies } from '@/server/auth/cookies';
import { deviceLabel } from '@/server/auth/request';
import { env } from '@/server/env';
import { AuthError } from '@/server/auth/errors';

export const runtime = 'nodejs';

/**
 * Where Google sends the browser back. This is a full-page redirect, not a JSON
 * call, so failures redirect to the login page carrying an error code the page
 * can render — never a raw 500 or a blank screen.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const origin = env().APP_ORIGIN;
  const params = url.searchParams;

  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}`, origin));

  // The user declined at Google's consent screen, or Google returned an error.
  if (params.get('error')) return fail('google_cancelled');

  const code = params.get('code');
  const state = params.get('state') ?? '';
  const nonce = req.cookies.get('st_oauth')?.value;
  const [stateNonce, nextB64] = state.split('.');

  // state must match the cookie set when the flow began — the CSRF check.
  if (!code || !nonce || !stateNonce || nonce !== stateNonce) {
    return fail('google_state');
  }

  let nextPath = '/desk';
  try {
    const decoded = Buffer.from(nextB64 ?? '', 'base64url').toString('utf8');
    if (decoded.startsWith('/') && !decoded.startsWith('//')) nextPath = decoded;
  } catch {
    /* keep the default */
  }

  try {
    const { tokens } = await googleLogin(code, deviceLabel(req));
    await setSessionCookies(tokens);
    const res = NextResponse.redirect(new URL(nextPath, origin));
    res.cookies.set('st_oauth', '', { path: '/api/v1/auth', maxAge: 0 });
    return res;
  } catch (err) {
    const code = err instanceof AuthError ? err.code.toLowerCase() : 'google_failed';
    return fail(code);
  }
}
