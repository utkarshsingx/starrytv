import 'server-only';
import { getSessionClaims } from './session';
import { unauthorized, AuthError } from './errors';

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

/**
 * An admin-only route. The role comes from the verified access token, and the
 * staleness window is one access-token lifetime (15 min) — for the two
 * operations where that is too long (suspend, demote) the service also revokes
 * the user's sessions, so a demoted admin is locked out at the next refresh
 * rather than lasting a whole session.
 */
export async function requireAdmin(): Promise<string> {
  const claims = await getSessionClaims();
  if (!claims) throw unauthorized('UNAUTHENTICATED', 'Sign in to continue.');
  if (claims.role !== 'admin') throw new AuthError(403, 'NOT_ADMIN', 'Editors only.');
  return claims.sub;
}
