import 'server-only';
import { randomUUID } from 'node:crypto';
import * as repo from './repo';
import { hashPassword, verifyPassword, decoyHash } from './password';
import {
  newRefreshToken,
  signAccess,
  sha256,
  newOtp,
  OTP_TTL_MS,
  REFRESH_TTL_DAYS,
  ROTATION_GRACE_MS,
} from './tokens';
import { exchangeGoogleCode, type GoogleProfile } from './google';
import { badRequest, conflict, unauthorized, forbidden } from './errors';
import { sendVerificationEmail } from './email';

/**
 * The auth logic, framework-free.
 *
 * Everything the routes need lives here as plain async functions taking plain
 * data and returning plain data — no Request, no Response, no cookies. That is
 * the whole point of the split: a Next.js route handler and a future NestJS
 * controller are both thin shells over these exact calls, so the move to a real
 * backend rewrites the shells and touches none of the decisions below.
 */

export type SessionTokens = { access: string; refresh: string; role: 'user' | 'admin' };
export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  role: 'user' | 'admin';
  avatarUrl: string | null;
  emailVerified: boolean;
};

export const toPublic = (u: repo.UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  displayName: u.display_name,
  handle: u.handle,
  role: u.role,
  avatarUrl: u.avatar_url,
  emailVerified: u.email_verified_at !== null,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) throw badRequest('INVALID_EMAIL', 'That does not look like an email address.');
  return e;
}

function checkPassword(pw: string): void {
  if (pw.length < 8 || pw.length > 128) {
    throw badRequest('WEAK_PASSWORD', 'Use between 8 and 128 characters.');
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw badRequest('WEAK_PASSWORD', 'Include at least one letter and one number.');
  }
}

/** A URL-safe handle from a name or email, made unique by suffixing if taken. */
async function deriveHandle(seed: string): Promise<string> {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'reader';
  if (!(await repo.handleTaken(base))) return base;
  for (let i = 0; i < 50; i++) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await repo.handleTaken(candidate))) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

// ─── a session, minted once and reused by every entry point ─────────────────

async function issueSession(
  user: repo.UserRow,
  familyId: string,
  parentId: string | null,
  deviceLabel: string | null,
): Promise<SessionTokens> {
  const { token, hash } = newRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);
  await repo.insertRefresh({
    userId: user.id,
    tokenHash: hash,
    familyId,
    parentId,
    deviceLabel,
    expiresAt,
  });
  const access = await signAccess({ sub: user.id, role: user.role, fam: familyId });
  return { access, refresh: token, role: user.role };
}

// ─── register ───────────────────────────────────────────────────────────────

export async function register(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: PublicUser }> {
  const email = normaliseEmail(input.email);
  checkPassword(input.password);
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 80) {
    throw badRequest('INVALID_NAME', 'A display name of 1–80 characters is required.');
  }

  const existing = await repo.findUserByEmail(email);
  if (existing) {
    // Anti-enumeration: if the address exists but is unverified, quietly re-send
    // the code and return the same shape as a fresh signup. A verified account
    // is the one case worth a distinct, honest message.
    if (existing.email_verified_at) {
      throw conflict('EMAIL_IN_USE', 'An account with that email already exists.');
    }
    await sendOtp(existing.id, email);
    return { user: toPublic(existing) };
  }

  const passwordHash = await hashPassword(input.password);
  const handle = await deriveHandle(email.split('@')[0]);
  const user = await repo.insertUser({
    email,
    passwordHash,
    displayName,
    handle,
    emailVerified: false,
  });
  await sendOtp(user.id, email);
  return { user: toPublic(user) };
}

async function sendOtp(userId: string, email: string): Promise<void> {
  const { code, hash } = newOtp();
  await repo.insertEmailToken(userId, hash, new Date(Date.now() + OTP_TTL_MS));
  await sendVerificationEmail(email, code);
}

export async function resendOtp(email: string): Promise<void> {
  const e = normaliseEmail(email);
  const user = await repo.findUserByEmail(e);
  // Silent whether or not the account exists / is already verified.
  if (user && !user.email_verified_at) await sendOtp(user.id, e);
}

// ─── verify email ─────────────────────────────────────────────────────────

export async function verifyEmail(input: {
  email: string;
  code: string;
  deviceLabel: string | null;
}): Promise<{ user: PublicUser; tokens: SessionTokens }> {
  const email = normaliseEmail(input.email);
  const user = await repo.findUserByEmail(email);
  if (!user) throw badRequest('INVALID_CODE', 'That code is not valid.');
  if (user.email_verified_at) {
    // Already verified — do not re-establish a session here; send them to log in.
    throw badRequest('ALREADY_VERIFIED', 'This email is already verified. Please sign in.');
  }
  const okCode = await repo.consumeEmailToken(user.id, sha256(input.code.trim()));
  if (!okCode) throw badRequest('INVALID_CODE', 'That code is wrong or has expired.');

  await repo.markEmailVerified(user.id);
  const fresh = (await repo.findUserById(user.id))!;
  const tokens = await issueSession(fresh, randomUUID(), null, input.deviceLabel);
  return { user: toPublic(fresh), tokens };
}

// ─── login ──────────────────────────────────────────────────────────────────

export async function login(input: {
  email: string;
  password: string;
  deviceLabel: string | null;
}): Promise<{ user: PublicUser; tokens: SessionTokens }> {
  const email = normaliseEmail(input.email);
  const user = await repo.findUserByEmail(email);

  // Constant-ish time: on a miss, still pay an argon2 verify against a decoy so
  // "no such account" and "wrong password" cost the same and cannot be told
  // apart by timing.
  if (!user || !user.password_hash) {
    await verifyPassword(await decoyHash(), input.password);
    if (user && !user.password_hash) {
      throw unauthorized('USE_GOOGLE', 'This account signs in with Google.');
    }
    throw unauthorized('BAD_CREDENTIALS', 'Email or password is incorrect.');
  }

  const good = await verifyPassword(user.password_hash, input.password);
  if (!good) throw unauthorized('BAD_CREDENTIALS', 'Email or password is incorrect.');
  if (user.status === 'suspended') throw forbidden('SUSPENDED', 'This account has been suspended.');
  if (!user.email_verified_at) {
    throw forbidden('EMAIL_NOT_VERIFIED', 'Verify your email before signing in.');
  }

  const tokens = await issueSession(user, randomUUID(), null, input.deviceLabel);
  return { user: toPublic(user), tokens };
}

// ─── google ───────────────────────────────────────────────────────────────

export async function googleLogin(
  code: string,
  deviceLabel: string | null,
): Promise<{ user: PublicUser; tokens: SessionTokens }> {
  const profile: GoogleProfile = await exchangeGoogleCode(code);

  let user = await repo.findUserByGoogleSub(profile.sub);
  if (!user) {
    const byEmail = await repo.findUserByEmail(profile.email.toLowerCase());
    if (byEmail) {
      // Suspension is checked BEFORE any mutation — the sibling linked and
      // backfilled first and rejected afterwards, which quietly attached the
      // Google identity to a banned account.
      if (byEmail.status === 'suspended') throw forbidden('SUSPENDED', 'This account has been suspended.');
      await repo.linkGoogle(byEmail.id, profile.sub);
      if (!byEmail.email_verified_at) await repo.markEmailVerified(byEmail.id);
      if (profile.picture) await repo.setAvatarIfEmpty(byEmail.id, profile.picture);
      user = (await repo.findUserById(byEmail.id))!;
    } else {
      const handle = await deriveHandle(profile.name || profile.email.split('@')[0]);
      const created = await repo.insertUser({
        email: profile.email.toLowerCase(),
        passwordHash: null, // Google-only account: no password to verify against.
        displayName: profile.name,
        handle,
        emailVerified: true, // Google owns the address; it is verified by definition.
        avatarUrl: profile.picture ?? null,
      });
      await repo.linkGoogle(created.id, profile.sub);
      user = created;
    }
  } else if (user.status === 'suspended') {
    throw forbidden('SUSPENDED', 'This account has been suspended.');
  }

  const tokens = await issueSession(user, randomUUID(), null, deviceLabel);
  return { user: toPublic(user), tokens };
}

// ─── refresh (rotation + reuse detection + grace) ───────────────────────────

export async function refresh(
  presented: string,
  deviceLabel: string | null,
): Promise<SessionTokens> {
  const hash = sha256(presented);
  const row = await repo.findRefreshByHash(hash);

  if (!row || row.expires_at.getTime() < Date.now()) {
    throw unauthorized('NO_SESSION', 'Your session has expired.');
  }

  if (row.rotated_at) {
    const age = Date.now() - row.rotated_at.getTime();
    if (age <= ROTATION_GRACE_MS) {
      // Benign navigation race: this token was rotated moments ago and its
      // successor already exists. Re-issue for the same user/family without
      // minting a second successor.
      const user = await repo.findUserById(row.user_id);
      if (!user) throw unauthorized('NO_SESSION', 'Your session has expired.');
      const access = await signAccess({ sub: user.id, role: user.role, fam: row.family_id });
      return { access, refresh: presented, role: user.role };
    }
    // Genuine reuse of a spent token — treat the whole family as compromised.
    await repo.revokeFamily(row.family_id, 'reuse_detected');
    throw unauthorized('SESSION_REVOKED', 'Your session was ended for security reasons.');
  }

  if (row.revoked_at) throw unauthorized('SESSION_REVOKED', 'Your session has ended.');

  const user = await repo.findUserById(row.user_id);
  if (!user) throw unauthorized('NO_SESSION', 'Your session has expired.');
  // A suspension mid-session takes effect at the next refresh: burn everything.
  if (user.status === 'suspended') {
    await repo.revokeAllForUser(user.id, 'suspended');
    throw forbidden('SUSPENDED', 'This account has been suspended.');
  }

  await repo.markRotated(row.id);
  return issueSession(user, row.family_id, row.id, deviceLabel);
}

export async function logout(presented: string | undefined): Promise<void> {
  if (!presented) return;
  const row = await repo.findRefreshByHash(sha256(presented));
  if (row) await repo.revokeFamily(row.family_id, 'logout');
}

export async function me(userId: string): Promise<PublicUser | null> {
  const u = await repo.findUserById(userId);
  return u ? toPublic(u) : null;
}
