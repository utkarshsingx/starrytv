# Auth & Authorization Reference — client-lms-zskillup-backend

All paths relative to `/Users/utkarshsingh/Developer/client-lms-zskillup-backend`.

## 1. Token strategy

**Access token.** JWT via `@nestjs/jwt`, configured in `auth.module.ts:43-50`: `secret: JWT_ACCESS_SECRET`, `signOptions.expiresIn: JWT_ACCESS_TTL`. No `algorithm` specified → library default **HS256 (symmetric)**. Default TTL `15m` (`config/validation.ts:160`); secret must be >=32 chars or boot fails (`validation.ts:155-158`).

Claims are exactly four (`common/auth/authenticated-user.ts:16-21`, minted at `services/token.service.ts:42-48`): `sub` (userId), `role`, `collegeId` (nullable tenant boundary), `jti`. `jti` is **not** the JWT's own id — it is the *refresh-token family id*, copied in so the access token names its session family. No email, no capabilities in the token.

**Refresh token.** Opaque, not a JWT: `randomBytes(48).toString('base64url')` (`token.service.ts:53`). Only SHA-256 hex digest persisted (`token.service.ts:55,73-75`). Entity `entities/refresh-token.entity.ts`: `id`, `userId` (indexed :15), `tokenHash` (unique index, varchar 64, :18-20), `jti` (uuid, indexed, family id, :23-25), `deviceFingerprint` (nullable, **always written null** — `refresh-token.repository.ts:26` — dead weight today), `revokedAt`, `expiresAt`, `createdAt`. TTL `REFRESH_TTL_DAYS` default 7, clamped 1-90 (`validation.ts:162-165`; applied `token.service.ts:54`).

**Rotation.** `AuthService.refresh` (`auth.service.ts:325-381`): hash presented token -> `findByHash` -> revoke presented row (:372-374) -> `issueSession(..., record.jti)` mints new token **in same family** (:840-842).

**Reuse detection.** Presenting an already-revoked token revokes the *entire family* and rejects (`auth.service.ts:335-345`). Comment at :341-343 is load-bearing: explicitly does not fall through to issuing a session. Deliberate **30-second grace window** (`ROTATION_GRACE_MS`, :322) inside which a just-rotated token is honoured once more, absorbing same-client refresh races across full page navigations (:313-321).

**Revocation.** Logout revokes whole family (:383-389). `revokeAllSessions` (:396-398) is admin force-logout. `refresh` re-checks liveness: any non-`ACTIVE` status burns all tokens and rejects (:365-368) — the single chokepoint making a mid-session suspend effective within 15 min rather than 7 days.

**Multi-device: there is none.** Login (:246) and Google login (:793) both call `revokeAllForUser` first — strict **single-device**. A second sign-in silently kills the first.

## 2. Transport

JSON body carries `{ accessToken, user }` (`dto/swagger.dto.ts:85-91`); refresh token never in a body — set as cookie by controller (`auth.controller.ts:132,159,175,191`). `/refresh` returns only `{ accessToken }` (:93-96). Access token documented "store in memory only" (:86).

**Cookie flags** (`auth.cookies.ts:21-31`): name `zskillup_refresh` (:18), `httpOnly: true`, `secure: isProd`, `sameSite: isProd ? 'none' : 'lax'`, `path: '/'`, `expires: refreshExpiresAt`. Two documented rationales, both real: `SameSite=None` because prod serves frontend and API on different domains (:26-28), and `path: '/'` — widened from `/api/v1/auth` — because Next.js middleware on `/dashboard`, `/tpo/*` must receive the cookie for session detection (:11-16).

**Guard extraction.** `JwtAuthGuard` (`common/guards/jwt-auth.guard.ts`) reads `Authorization: Bearer <token>` (:76-81), calls `jwt.verifyAsync<AccessTokenClaims>` (:60), maps claims onto `req.user` (:61-66). Signature + expiry only — **never checks DB, never checks user status, never checks the `jti` family is still live.**

**`@Public()`** (`common/decorators/public.decorator.ts:7-8`) sets metadata read via `getAllAndOverride` over handler *and* class (`jwt-auth.guard.ts:27-30`). Subtler than "skip auth": on a public route a valid Bearer token is still decoded and attached best-effort, invalid tokens swallowed, request continues unauthenticated (:38-53).

## 3. Password

`services/password.service.ts` is the entire surface. `argon2.hash(plain + this.pepper, { type: argon2.argon2id })` (:20), `argon2.verify(hash, plain + pepper)` (:23). **Argon2id**, per-hash salt from library, plus server-side pepper from `ARGON2_PEPPER` (>=16 chars, `validation.ts:167-170`). No `memoryCost`/`timeCost`/`parallelism` overrides — runs on `argon2@^0.41.1` defaults.

**Timing attacks partly handled.** Good: `forgotPassword` does not await SMTP send so response time cannot distinguish a registered email (:425-428). Gap: `login` returns immediately when user not found (:225-227) *without* a dummy argon2 verify. Comment at :223-224 acknowledges and waves it off. Missing account returns in microseconds while wrong password costs a full Argon2id hash — usable email-enumeration oracle despite identical error string.

**Policy** (`shared/dto/auth.dto.ts:43-48`, mirrored :98-103, :123-128): 8-128 chars, must contain a letter, must contain a number. No symbol requirement, no breach-list check. Email normalized (trim+lowercase) before validation (:22-23,39-41). Global `ValidationPipe` runs `whitelist` + `forbidNonWhitelisted` (:15-16).

## 4. Google OAuth (`auth.service.ts:724-805`)

Frontend sends `{ idToken }` to `POST /auth/google` (`auth.controller.ts:40-44,163-177`) — a GIS-issued ID token, nothing else.

1. If `OAUTH_CLIENT_ID` unset -> 401 "not configured" (:725-727).
2. **Verification is a network call to Google's tokeninfo endpoint** (`https://oauth2.googleapis.com/tokeninfo?id_token=...`) with 10s `AbortSignal.timeout` (:732-733) — *not* local JWKS verification. Non-OK or throw -> 401 (:734-739).
3. **`aud` check**: `payload.aud !== this.googleClientId` -> 401 audience-mismatch (:742-744). Token-substitution defense.
4. **Claim requirements**: only `email` and `sub` required (:745-747). `iss` **never checked**, `email_verified` **never checked** despite both declared on the payload interface (:48,52) — relying on tokeninfo's own validation.
5. **Find-by-google-id first** (:750), then **find-by-email** (:752). On email match, `linkGoogleId` (:755) and if unverified `markEmailVerified` (:756-758) — existing password account silently linked and auto-verified.
6. **New user**: `createOAuthUser` (:761-767) with `passwordHash: ''` and `isEmailVerified: true` (`users.repository.ts:140,146`). Empty hash blocks password login for OAuth-only accounts.
7. **Welcome email on this branch only** — `EMAIL_EVENTS.userActivated` (:775-779); comment :772-774 explains link-existing and find-by-googleId are returning users. Listener dedupes on `welcome:${userId}` (`email.listener.ts:39-50`).
8. Avatar backfill via `setAvatarIfEmpty` (:785-787).
9. **Suspended account**: 401 (:789-791) — but runs *after* creation, linking, and avatar backfill, so a suspended user's Google ID still gets linked before rejection.
10. Revoke all sessions, issue, `recordLogin(..., 'google', ctx)` (:793-797).

## 5. Email verification + password reset

**Verification.** `entities/email-verification-token.entity.ts`: `userId`, `tokenHash` (varchar 64), `expiresAt`, `usedAt`. Code is 6-digit `randomInt(0, 1_000_000)` zero-padded (`token.service.ts:59-62`), stored SHA-256-hashed. TTL **10 minutes** (`OTP_TTL_MS`, :39). `verifyEmail` (:171-218) marks used (:191), sets `isEmailVerified`, promotes `INVITED -> ACTIVE` (:195-197), emits `userActivated`, and **mints a full session** — deliberately only on the fresh-verify path; already-verified email bounced to sign-in to avoid auth bypass (:176-179).

> **BUG.** `EmailVerificationTokenRepository.findLatestUnused` (`repositories/email-verification-token.repository.ts:24-29`) filters with `usedAt: undefined`. TypeORM **drops `undefined` keys from the where clause**, so single-use is not enforced at query level — should be `IsNull()`. Masked by the `user.isEmailVerified` early return at :176, but a latent hole.

**Reset — two parallel mechanisms sharing one table.** `entities/password-reset-token.entity.ts`: `tokenHash` varchar 80, deliberately **non-unique** (:17-20) because 6-digit OTP hashes can collide across users; `consumedAt` single-use (:26); `attempts` counter (:29-31).

- *OTP path* (self-service): `forgotPassword` (:406-435) revokes all prior live codes first so at most one is valid (:418), inserts hashed 6-digit code, TTL **10 min** (`PASSWORD_RESET_OTP_TTL_MS`, :41). `resetPasswordOtp` (:444-468) looks up **scoped by user** (:451, repo :36-48), counts wrong guesses, locks code at **5 attempts** (`MAX_RESET_OTP_ATTEMPTS`, :42; repo `registerFailedAttempt` :59-75) — stated reason: per-IP throttling alone is bypassable by IP rotation.
- *Link path*: `generateResetToken` — 48 random bytes base64url (`token.service.ts:68-71`). TTL **1 hour** for admin-initiated resets (`PASSWORD_RESET_TTL_MS`, :40; used :295-311), **7 days** for onboarding/invite set-password links (`ONBOARDING_TOKEN_TTL_MS`, :43; used :578,653). `resetPassword` (:489-523) consumes, revokes all other reset tokens, revokes all refresh tokens, verifies+activates `INVITED`, but never reactivates `SUSPENDED` (:508).

**Re-request behaviour.** Register on an unverified email silently re-issues an OTP and returns identical "Verification email sent" (:117-140) — anti-enumeration and stuck-signup recovery in one. `resendOtp` (:813-819) returns generic message. `forgotPassword` always returns same string (:432-434).

**Delivery.** `EmailService` (`modules/notifications/email.service.ts`) builds Nodemailer transport at `onModuleInit` from `SMTP_*` (:48-59), three-tier fallback: SMTP -> Ethereal test account (dev only, :75-76,86-109) -> log-only. `send` never throws. Dev-only in-memory `otpStore` (:37) backs `GET /auth/_dev/last-otp`, 404s in production (`auth.controller.ts:90-105`). Templates in `notifications/email/email-templates.ts`.

## 6. User entity + authorization model

**Roles** (`shared/enums.ts:15-20`): `STUDENT`, `COLLEGE_ADMIN`, `ADMIN`, `SUPER_ADMIN`. **Status** (:23-27): `INVITED`, `ACTIVE`, `SUSPENDED`.

**User entity** (`modules/users/user.entity.ts`): `email` is `citext` + unique (case-insensitive identity, :28-30), soft-delete via `@DeleteDateColumn` (:97-98), `collegeId` tenant boundary — required for COLLEGE_ADMIN/STUDENT, NULL for ADMIN/SUPER_ADMIN (:20). Four capability booleans, all default false (:73-83): `canDeleteStudents`, `canManageSubscriptions`, `canBroadcast`, `canViewFinancials`.

**RolesGuard vs CapabilitiesGuard.** `RolesGuard` (`common/guards/roles.guard.ts`) is pure metadata-vs-token: reads `@Roles()`, compares `req.user.role`, **zero DB access** (:22-35); no `@Roles()` means any authenticated user passes (:27). `CapabilitiesGuard` (`common/guards/capabilities.guard.ts`) is the opposite: on `@RequireCapability()` routes it **re-reads the account from the DB** (:53) so suspension, demotion, or capability revoke takes effect immediately rather than at token expiry; rejects non-ACTIVE (:54), treats SUPER_ADMIN as implicit superuser (:57), re-checks an ADMIN-minted token still belongs to an ADMIN (:59), resolves flags through shared `effectiveCapabilities` (:65) — same function `GET /me` uses, so UI and server cannot disagree (`shared/admin-capabilities.ts:109-121`). `canBroadcast` is baseline for all ADMINs; other three are per-account grants (:96).

**Guard chain order** (`app.module.ts:110-116`, comment "Guard order matters and follows the order listed here"): `ThrottlerGuard` -> `JwtAuthGuard` -> `RolesGuard` -> `CapabilitiesGuard`. Ordering is right: rate-limit before crypto work; authenticate before reading `req.user`; cheap in-memory role check before DB-hitting capability check.

**`@CurrentUser()`** (`common/decorators/current-user.decorator.ts`) returns `AuthenticatedUser` = `{ id, role, collegeId, jti }`, throws if `req.user` missing (:13-15).

## 7. Rate limiting

Global baseline 100 req/60s (`app.module.ts:66`). Per-route overrides in `auth.controller.ts`, all `ttl: 60_000`:

| Route | Limit | Line |
|---|---|---|
| `POST /auth/register` | 5 | :109 |
| `POST /auth/verify-email` | 10 | :120 |
| `POST /auth/resend-otp` | 5 | :138 |
| `POST /auth/login` | 10 | :148 |
| `POST /auth/google` | 10 | :165 |
| `POST /auth/refresh` | 15 | :181 |
| `POST /auth/logout` | 15 | :197 |
| `POST /auth/forgot-password` | 5 | :207 |
| `POST /auth/reset-password` | 10 | :219 |
| `POST /auth/reset-password-otp` | 10 | :229 |
| `POST /admin/impersonate` | 20 | `impersonation.controller.ts:29` |

`GET /auth/_dev/last-otp` has no `@Throttle` (falls back to global 100/min).

## 8. Impersonation

`impersonation.controller.ts` exposes `POST /admin/impersonate`, class-level `@Roles(UserRole.SUPER_ADMIN)` (:23). `ImpersonationService.previewAsStudent` (`services/impersonation.service.ts:36-80`) resolves a target (explicit `studentId`, else richest active+onboarded student by practice-attempt count, else most recent active — :88-93), hard-refuses any non-STUDENT target as privilege-escalation guard (:43-46), mints an access token **only**: no refresh token, no `Set-Cookie`, no `revokeAllForUser`, so neither party's real session is disturbed (:18-23). Uses fresh `randomUUID()` as `jti` (:53) — a family id corresponding to no stored refresh row, which is why the token cannot be refreshed and dies at the 15-min access TTL.

Auditing is two-layer: `logger.warn` (:56-59) plus an **awaited** `auditService.record({ action: 'impersonation.start', entity: 'user', entityId: student.id, metadata: { previewedRole } })` (:63-69) — awaited deliberately, "the audit trail is part of the operation, not best-effort". Actor recorded but *reason* is not, and there is no `impersonation.end` event (ending is client-side token disposal).

Logins separately audited via `recordLogin` -> `auth.login` audit rows with IP + user-agent (`auth.service.ts:266-285`), captured from `x-forwarded-for` with fallbacks (`auth.controller.ts:47-56`). That one *is* best-effort and swallows failures (:282-284).

## 9. Copy verbatim vs. reconsider

**Copy verbatim.**
- The `TokenService` / `PasswordService` split and the opaque-refresh + hashed-at-rest pattern.
- Rotation-family reuse detection **including the 30s grace window** (`auth.service.ts:313-348`). Hard-won production fix; a naive implementation force-logs-out real users on page-navigation races.
- The `refresh`-time status re-check (:365-368). This is what makes suspension actually work with short access tokens.
- `auth.cookies.ts` in its entirety, including both comments — `path: '/'` and `SameSite=None` were each reverse-engineered from a real breakage.
- `effectiveCapabilities` as single source of truth shared by guard and `GET /me`.
- Guard ordering with its comment (`app.module.ts:110-116`).
- Anti-enumeration triad: uniform messages, non-awaited SMTP send, single-live-reset-code invalidation.
- Fail-fast env validation with length floors on secrets (`validation.ts:155-170`).

**Reconsider (fix in the new project).**
1. **Fix `findLatestUnused`** — `usedAt: undefined` should be `IsNull()`. Real single-use bug.
2. **Add a dummy argon2 verify on user-not-found** in `login` to close the timing oracle.
3. **Verify Google tokens locally against JWKS** (`google-auth-library` `verifyIdToken`) instead of a network round-trip to tokeninfo. Current design puts a 10s external dependency in the login path, is rate-limited by Google, and skips `iss` and `email_verified`. At minimum assert `iss` in {accounts.google.com, https://accounts.google.com} and `email_verified === true`.
4. **Move the suspended check before account mutation** in `googleLogin`.
5. **Single-device is a product decision, not a security default.** `revokeAllForUser` on every login means phone-and-laptop users get logged out constantly. `deviceFingerprint` column already exists but is never populated.
6. **`POST /auth/logout` is `@Public()`** — bearer-less logout by cookie is defensible but means a stolen cookie can burn a family.
7. **Password policy is weak** (letter + digit, 8 chars). Add breach-list check (zxcvbn or HIBP k-anonymity).
8. **HS256 with a shared secret** means every service verifying tokens can also mint them. If more than one service, move to RS256/EdDSA now — one-line change today, a migration later.
9. **Explicit `algorithms: ['HS256']` on verify** — pin it against algorithm-confusion.
10. **Reset tokens: one table, three TTLs (10min/1hr/7day), no `purpose` column.** Add a discriminator.
11. `AuthUserDto` Swagger role enum omits `ADMIN` — generated frontend types will be wrong.
