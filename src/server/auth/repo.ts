import 'server-only';
import { sql } from '../db/client';

/**
 * Every database read and write auth performs, in one file of hand-written SQL.
 *
 * This is the layer the eventual NestJS move replaces — a set of narrow, typed
 * functions with no framework in them. The service above calls these; nothing
 * calls the `sql` client directly except this file, so when TypeORM takes over
 * there is exactly one place to change.
 *
 * The `deleted_at is null` guard is repeated on every user read on purpose. A
 * soft-deleted account must be invisible to login, lookup and uniqueness alike,
 * and leaving it to a base clause somewhere is how one query forgets it.
 */

export type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  handle: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  email_verified_at: Date | null;
  avatar_url: string | null;
  created_at: Date;
};

// The user column list is written inline in each query rather than hoisted to a
// module-scope `sql\`...\`` fragment. A tagged-template fragment executes when
// the module is imported, which would build the database client (and read env)
// at build time — exactly the eager evaluation the lazy client exists to avoid.

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [u] = await sql<UserRow[]>`
    select id, email, password_hash, display_name, handle, role, status,
           email_verified_at, avatar_url, created_at
    from users where email = ${email} and deleted_at is null limit 1`;
  return u ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [u] = await sql<UserRow[]>`
    select id, email, password_hash, display_name, handle, role, status,
           email_verified_at, avatar_url, created_at
    from users where id = ${id} and deleted_at is null limit 1`;
  return u ?? null;
}

export async function findUserByGoogleSub(sub: string): Promise<UserRow | null> {
  const [u] = await sql<UserRow[]>`
    select u.id, u.email, u.password_hash, u.display_name, u.handle, u.role,
           u.status, u.email_verified_at, u.avatar_url, u.created_at
    from users u
    join oauth_identities o on o.user_id = u.id
    where o.provider = 'google' and o.provider_sub = ${sub} and u.deleted_at is null
    limit 1`;
  return u ?? null;
}

export async function handleTaken(handle: string): Promise<boolean> {
  const [row] = await sql`
    select 1 from users where handle = ${handle} and deleted_at is null limit 1`;
  return Boolean(row);
}

export async function insertUser(u: {
  email: string;
  passwordHash: string | null;
  displayName: string;
  handle: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
}): Promise<UserRow> {
  const [row] = await sql<UserRow[]>`
    insert into users (email, password_hash, display_name, handle, email_verified_at, avatar_url)
    values (${u.email}, ${u.passwordHash}, ${u.displayName}, ${u.handle},
            ${u.emailVerified ? sql`now()` : null}, ${u.avatarUrl ?? null})
    returning id, email, password_hash, display_name, handle, role, status,
              email_verified_at, avatar_url, created_at`;
  return row;
}

export async function linkGoogle(userId: string, sub: string): Promise<void> {
  // Idempotent: a returning user signing in again must not error on the unique
  // (provider, provider_sub) constraint.
  await sql`
    insert into oauth_identities (user_id, provider, provider_sub)
    values (${userId}, 'google', ${sub})
    on conflict (provider, provider_sub) do nothing`;
}

export async function markEmailVerified(userId: string): Promise<void> {
  await sql`
    update users set email_verified_at = now(), updated_at = now()
    where id = ${userId} and email_verified_at is null`;
}

export async function setAvatarIfEmpty(userId: string, url: string): Promise<void> {
  await sql`update users set avatar_url = ${url}, updated_at = now()
            where id = ${userId} and avatar_url is null`;
}

// ─── refresh tokens ────────────────────────────────────────────────────────

export type RefreshRow = {
  id: string;
  user_id: string;
  family_id: string;
  rotated_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
};

export async function insertRefresh(r: {
  userId: string;
  tokenHash: string;
  familyId: string;
  parentId: string | null;
  deviceLabel: string | null;
  expiresAt: Date;
}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into refresh_tokens (user_id, token_hash, family_id, parent_id, device_label, expires_at)
    values (${r.userId}, ${r.tokenHash}, ${r.familyId}, ${r.parentId}, ${r.deviceLabel}, ${r.expiresAt})
    returning id`;
  return row.id;
}

export async function findRefreshByHash(hash: string): Promise<RefreshRow | null> {
  const [row] = await sql<RefreshRow[]>`
    select id, user_id, family_id, rotated_at, revoked_at, expires_at
    from refresh_tokens where token_hash = ${hash} limit 1`;
  return row ?? null;
}

export async function markRotated(id: string): Promise<void> {
  await sql`update refresh_tokens
            set rotated_at = now(), revoked_at = now(), revoked_reason = 'rotated', last_used_at = now()
            where id = ${id}`;
}

export async function revokeFamily(
  familyId: string,
  reason: 'logout' | 'reuse_detected' | 'suspended',
): Promise<void> {
  await sql`update refresh_tokens
            set revoked_at = now(), revoked_reason = ${reason}
            where family_id = ${familyId} and revoked_at is null`;
}

export async function revokeAllForUser(userId: string, reason: 'suspended' | 'logout'): Promise<void> {
  await sql`update refresh_tokens set revoked_at = now(), revoked_reason = ${reason}
            where user_id = ${userId} and revoked_at is null`;
}

// ─── email verification ────────────────────────────────────────────────────

export async function insertEmailToken(userId: string, hash: string, expiresAt: Date): Promise<void> {
  // Only one live code at a time: supersede any earlier unconsumed ones so a
  // resend does not leave several valid codes floating around.
  await sql`update email_verification_tokens set consumed_at = now()
            where user_id = ${userId} and consumed_at is null`;
  await sql`insert into email_verification_tokens (user_id, token_hash, expires_at)
            values (${userId}, ${hash}, ${expiresAt})`;
}

export async function consumeEmailToken(userId: string, hash: string): Promise<boolean> {
  // `consumed_at is null` written explicitly — this is the single-use guarantee,
  // and it is exactly what the sibling got wrong by passing `undefined`.
  const rows = await sql`
    update email_verification_tokens set consumed_at = now()
    where user_id = ${userId} and token_hash = ${hash}
      and consumed_at is null and expires_at > now()
    returning id`;
  return rows.length > 0;
}
