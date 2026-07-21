import 'server-only';
import { getSessionClaims } from './session';
import { unauthorized } from './errors';

/**
 * The line every protected route handler starts with.
 *
 * Returns the caller's verified user id, or throws a 401 that the `route()`
 * wrapper turns into a clean response. Identity comes from the signed access
 * cookie only — never from anything in the request body — so a handler cannot be
 * tricked into acting as another user by a forged `userId` field.
 */
export async function requireUserId(): Promise<string> {
  const claims = await getSessionClaims();
  if (!claims) throw unauthorized('UNAUTHENTICATED', 'Sign in to continue.');
  return claims.sub;
}
