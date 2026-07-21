import 'server-only';
import { randomBytes, createHash, randomInt } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

/**
 * Two very different tokens.
 *
 * The ACCESS token is a short-lived JWT the server can verify without touching
 * the database — it carries the user id, role and family id, and it expires in
 * 15 minutes so a stale role or a suspension takes effect within that window
 * rather than lasting a whole session.
 *
 * The REFRESH token is the opposite: opaque random bytes, meaningless on their
 * own, checked by looking up their hash in the database. Only the hash is ever
 * stored, so a database read cannot reconstruct a live token.
 *
 * HS256 is deliberate for now — one service signs and verifies, so a symmetric
 * secret is fine. If a second service ever needs to verify these, move to RS256
 * (one line here) before it does, so the signing key stays in one place.
 */

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_DAYS = 30;
export const OTP_TTL_MS = 10 * 60 * 1000;
/** A just-rotated refresh token is honoured once more inside this window, to
 *  absorb the page-navigation race where a refresh fires, the response lands
 *  after teardown, and the reloaded page presents the same token seconds later.
 *  Without it, that benign race reads as token theft and force-logs-out real
 *  users intermittently. */
export const ROTATION_GRACE_MS = 30 * 1000;

export type AccessClaims = { sub: string; role: 'user' | 'admin'; fam: string };

const key = () => new TextEncoder().encode(env().JWT_ACCESS_SECRET);

export async function signAccess(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, fam: claims.fam })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(key());
}

export async function verifyAccess(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || (payload.role !== 'user' && payload.role !== 'admin')) {
      return null;
    }
    return { sub: payload.sub, role: payload.role, fam: String(payload.fam ?? '') };
  } catch {
    return null;
  }
}

/** An opaque refresh token and the hash to store for it. The plaintext is
 *  returned once, set as a cookie, and never persisted. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: sha256(token) };
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Six digits, zero-padded, for email verification. */
export function newOtp(): { code: string; hash: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  return { code, hash: sha256(code) };
}
