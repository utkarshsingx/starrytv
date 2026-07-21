import 'server-only';
import { cache } from 'react';
import { verifyAccess } from './tokens';
import { readAccessCookie } from './cookies';
import { me, type PublicUser } from './service';

/**
 * Who is signed in, as seen by a server component or a route handler.
 *
 * The access cookie is verified by signature and expiry only — no database hit
 * on the common path — which is the whole reason the token is short-lived: a
 * stale role or a fresh suspension is at most 15 minutes behind. `getCurrentUser`
 * loads the full profile and is `cache()`-wrapped so several components on one
 * page render share a single lookup.
 *
 * When the access cookie has expired but the refresh cookie is still good, this
 * returns null rather than silently refreshing — refresh is a mutation (it
 * rotates a token and sets cookies) and must not happen during a render. The
 * client's API layer performs the refresh on its next call; a server render just
 * sees "not signed in" for the ~15-minute gap, which is correct and safe.
 */

export async function getSessionClaims() {
  const token = await readAccessCookie();
  if (!token) return null;
  return verifyAccess(token);
}

export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const claims = await getSessionClaims();
  if (!claims) return null;
  return me(claims.sub);
});

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
