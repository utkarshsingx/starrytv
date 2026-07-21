-- 0001 — identity
--
-- The whole of Phase 2 auth in one migration. Hand-written and idempotent, the
-- way the sibling backend does it (BACKEND_STANDARDS): re-running it is a no-op,
-- so a half-applied migration is recoverable by just running it again.
--
-- Conventions carried over from the sibling and the design panel:
--  * text + CHECK, never a Postgres ENUM. ALTER TYPE ADD VALUE cannot run inside
--    a transaction, so every future status value would be a migration headache;
--    a CHECK constraint is edited freely.
--  * email is citext — case-insensitive identity without lower() everywhere.
--  * soft delete via deleted_at, and the email/handle uniqueness is a PARTIAL
--    index excluding deleted rows, so a deleted account does not squat its
--    address forever (a real bug the panel flagged in the sibling).
--  * OAuth identities are their own table, not a google_sub column, so a second
--    provider later is an insert, not a schema change plus a backfill.

create extension if not exists citext;

-- ─── users ───────────────────────────────────────────────────────────────────
create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null,
  -- Null for accounts that only ever sign in with Google. A null hash is what
  -- the login path checks to say "this account has no password, use Google",
  -- rather than storing an empty string that argon2.verify would chew on.
  password_hash  text,
  display_name   text not null,
  handle         citext not null,
  role           text not null default 'user'   check (role in ('user','admin')),
  status         text not null default 'active'  check (status in ('active','suspended')),
  email_verified_at timestamptz,
  avatar_url     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index if not exists uq_users_email
  on users (email) where deleted_at is null;
create unique index if not exists uq_users_handle
  on users (handle) where deleted_at is null;

-- ─── oauth_identities ────────────────────────────────────────────────────────
create table if not exists oauth_identities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  provider     text not null check (provider in ('google')),
  -- The provider's stable subject id. NOT the email — a user can change their
  -- Google email, but `sub` is forever. Uniqueness is per provider.
  provider_sub text not null,
  created_at   timestamptz not null default now(),
  unique (provider, provider_sub)
);
create index if not exists ix_oauth_user on oauth_identities (user_id);

-- ─── refresh_tokens ──────────────────────────────────────────────────────────
-- Opaque tokens, only the sha256 hash stored. A "family" is one login session;
-- rotation issues a successor in the same family, and presenting an already-
-- rotated token (outside a short grace window) is treated as theft and burns
-- the whole family. Sessions are per-device: each login opens a new family, so
-- phone and laptop coexist (a deliberate reversal of the sibling's single-device
-- rule, which is wrong for a reading app).
create table if not exists refresh_tokens (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  token_hash     text not null,
  family_id      uuid not null,
  parent_id      uuid references refresh_tokens(id) on delete set null,
  device_label   text,
  rotated_at     timestamptz,
  revoked_at     timestamptz,
  revoked_reason text check (revoked_reason in ('logout','reuse_detected','rotated','superseded','suspended')),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);
create unique index if not exists uq_refresh_hash on refresh_tokens (token_hash);
create index if not exists ix_refresh_user   on refresh_tokens (user_id);
create index if not exists ix_refresh_family on refresh_tokens (family_id);

-- ─── email_verification_tokens ───────────────────────────────────────────────
-- 6-digit code, sha256-hashed, single-use, short TTL. `consumed_at is null` is
-- the single-use predicate — written explicitly rather than left to an ORM,
-- because the sibling's `usedAt: undefined` silently matched every row.
create table if not exists email_verification_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists ix_evt_user on email_verification_tokens (user_id);
create unique index if not exists uq_evt_hash on email_verification_tokens (token_hash);
