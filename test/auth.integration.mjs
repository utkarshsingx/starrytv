/**
 * Auth integration test — the real service against a real Postgres.
 *
 * Not part of `npm run test:e2e` (that suite needs no database). This is run by
 * hand against a throwaway container to prove the SQL, the hashing, the token
 * rotation and the reuse detection actually behave, before pointing anything at
 * the live Supabase project:
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=starry \
 *     -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/starry \
 *   DIRECT_URL=... node scripts/migrate.mjs
 *   DATABASE_URL=... node --test test/auth.integration.mjs
 *
 * It imports the service through a tiny bootstrap that sets the env the modules
 * need, then calls the same functions the route handlers call.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// The service modules validate these on first use; set them before importing.
process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(48);
process.env.ARGON2_PEPPER ??= 'y'.repeat(24);
process.env.GOOGLE_CLIENT_ID ??= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-secret';
process.env.GOOGLE_CALLBACK_URL ??= 'http://localhost:3000/api/v1/auth/google/callback';

const svc = await import('../src/server/auth/service.ts');
const tokens = await import('../src/server/auth/tokens.ts');
const { sql } = await import('../src/server/db/client.ts');

before(async () => {
  // Clean slate each run.
  await sql`truncate users, oauth_identities, refresh_tokens, email_verification_tokens cascade`;
});

after(async () => {
  await sql.end();
});

const email = 'reader@example.com';
const password = 'goodpass123';

test('register creates an unverified account and no session', async () => {
  const { user } = await svc.register({ email, password, displayName: 'A Reader' });
  assert.equal(user.email, email);
  assert.equal(user.emailVerified, false);
  assert.match(user.handle, /^reader/);
});

test('login is refused until the email is verified', async () => {
  await assert.rejects(
    () => svc.login({ email, password, deviceLabel: null }),
    (e) => e.code === 'EMAIL_NOT_VERIFIED',
  );
});

test('a wrong password and an unknown email are both BAD_CREDENTIALS', async () => {
  await assert.rejects(
    () => svc.login({ email, password: 'wrongpass1', deviceLabel: null }),
    (e) => e.code === 'BAD_CREDENTIALS',
  );
  await assert.rejects(
    () => svc.login({ email: 'nobody@example.com', password, deviceLabel: null }),
    (e) => e.code === 'BAD_CREDENTIALS',
  );
});

test('verifying the email establishes a session', async () => {
  // The code is only sent (logged) — pull the row and forge the matching hash by
  // brute-forcing the 6-digit space, which is what proves the stored hash is a
  // sha256 of the plaintext code and single-use consumption works.
  const [u] = await sql`select id from users where email = ${email}`;
  const [row] = await sql`
    select token_hash from email_verification_tokens
    where user_id = ${u.id} and consumed_at is null`;
  let code = null;
  for (let i = 0; i < 1_000_000; i++) {
    const c = String(i).padStart(6, '0');
    if (tokens.sha256(c) === row.token_hash) { code = c; break; }
  }
  assert.ok(code, 'could not recover the verification code from its hash');

  const { user, tokens: session } = await svc.verifyEmail({ email, code, deviceLabel: 'Test' });
  assert.equal(user.emailVerified, true);
  assert.ok(session.access && session.refresh);

  // Single-use: the same code cannot verify again.
  await assert.rejects(
    () => svc.verifyEmail({ email, code, deviceLabel: null }),
    (e) => e.code === 'ALREADY_VERIFIED' || e.code === 'INVALID_CODE',
  );
});

test('login now succeeds and issues a rotating session', async () => {
  const { tokens: session } = await svc.login({ email, password, deviceLabel: 'Laptop' });
  const claims = await tokens.verifyAccess(session.access);
  assert.equal(claims?.role, 'user');

  // Rotation: the refresh yields a NEW token, and the old one is now spent.
  const rotated = await svc.refresh(session.refresh, 'Laptop');
  assert.notEqual(rotated.refresh, session.refresh);

  // Reuse detection: presenting the original (now-rotated, past grace) refresh
  // token again burns the family. Force it past the 30s grace by ageing the row.
  const oldHash = tokens.sha256(session.refresh);
  await sql`update refresh_tokens set rotated_at = now() - interval '1 minute'
            where token_hash = ${oldHash}`;
  await assert.rejects(
    () => svc.refresh(session.refresh, 'Laptop'),
    (e) => e.code === 'SESSION_REVOKED',
  );

  // And the family really is dead — the legitimate successor is revoked too.
  await assert.rejects(
    () => svc.refresh(rotated.refresh, 'Laptop'),
    (e) => e.code === 'SESSION_REVOKED' || e.code === 'NO_SESSION',
  );
});

test('a second login opens an independent family (per-device sessions)', async () => {
  const { tokens: a } = await svc.login({ email, password, deviceLabel: 'Phone' });
  const { tokens: b } = await svc.login({ email, password, deviceLabel: 'Tablet' });
  // Both are usable at once — logging in on one device does not kill the other.
  assert.ok(await svc.refresh(a.refresh, 'Phone'));
  assert.ok(await svc.refresh(b.refresh, 'Tablet'));
});

test('the refresh grace window tolerates a benign replay', async () => {
  const { tokens: s } = await svc.login({ email, password, deviceLabel: 'Grace' });
  const first = await svc.refresh(s.refresh, 'Grace');
  // Immediately replaying the just-rotated token (inside 30s) is the navigation
  // race, not theft: it re-issues rather than revoking.
  const replay = await svc.refresh(s.refresh, 'Grace');
  assert.ok(replay.access, 'grace-window replay should re-issue, not revoke');
  assert.ok(await svc.refresh(first.refresh, 'Grace'), 'the real successor still works');
});
