import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { refresh } from '@/server/auth/service';
import { setSessionCookies, readRefreshCookie, clearSessionCookies } from '@/server/auth/cookies';
import { deviceLabel } from '@/server/auth/request';
import { AuthError } from '@/server/auth/errors';

export const runtime = 'nodejs';

export const POST = route(async (req: NextRequest) => {
  const presented = await readRefreshCookie();
  if (!presented) throw new AuthError(401, 'NO_SESSION', 'Not signed in.');
  try {
    const tokens = await refresh(presented, deviceLabel(req));
    await setSessionCookies(tokens);
    return ok({ ok: true, role: tokens.role });
  } catch (err) {
    // A dead or revoked session must leave no cookies behind, or the client
    // loops trying to refresh a token the server keeps rejecting.
    await clearSessionCookies();
    throw err;
  }
});
