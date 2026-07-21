import 'server-only';
import { hash, verify } from '@node-rs/argon2';
import { env } from '../env';

/**
 * Passwords.
 *
 * Argon2id, with a server-side pepper appended before hashing. The pepper lives
 * in env, not the database, so a stolen database dump alone cannot be brute-
 * forced offline — the attacker also needs the running server's secret. The
 * per-hash salt argon2 adds itself; the pepper is the extra, shared factor.
 */

const pepper = () => env().ARGON2_PEPPER;

// OWASP's argon2id floor, comfortably. Deliberately explicit rather than library
// defaults, so a dependency bump can never quietly weaken every password.
const PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain + pepper(), PARAMS);
}

export function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain + pepper());
}

/**
 * A hash to verify against when no user was found, so the login path spends the
 * same ~work on a missing account as on a wrong password. Without it, "no such
 * email" returns in microseconds while "wrong password" takes a full argon2
 * verify — a timing oracle that enumerates registered addresses regardless of
 * the identical error message. Computed once, lazily; recomputing per request
 * would itself be a timing signal.
 */
let decoy: Promise<string> | null = null;
export function decoyHash(): Promise<string> {
  if (!decoy) decoy = hash('decoy-password-never-matches' + pepper(), PARAMS);
  return decoy;
}
