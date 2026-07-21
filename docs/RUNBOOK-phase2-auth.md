# Phase 2 (Auth) — go-live runbook

Everything in this phase is **built and tested**, but it cannot run until two secrets that only
you can provide are in place: the database password and the Google redirect URI. This is the
five-step path from "code written" to "I can sign in".

## What "Phase 2" is and is not

**Is:** create an account (email+password *or* Google), verify email, sign in, sign out, stay
signed in across refreshes, land on a role-appropriate page. Admins reach `/admin`; everyone else
is bounced to `/desk`.

**Is not:** the reading log, the review composer, the admin review queue, genre management. `/desk`
and `/admin` are honest placeholders that prove the gate works. The actual product is Phases 3–5 in
`docs/PLAN.md`.

Verified before you touch anything: the full flow (register → verify → login → rotate → reuse-detect
→ per-device → grace window) passes 7/7 against a real Postgres 16 — see `test/auth.integration.mjs`.

---

## 1. Fill the database connection string

Open Supabase → your project → **Connect**. You want **two** strings:

- **Transaction pooler** (port 6543) → this is `DATABASE_URL`. The app uses it. It is IPv4 and
  serverless-safe.
- **Session pooler** (port 5432, host `aws-0-<region>.pooler.supabase.com`) → this is `DIRECT_URL`.
  Migrations use it.

Both contain `[YOUR-PASSWORD]`. Replace it with your database password (Supabase → Project Settings
→ Database → reset it there if you don't have it). Put both in `.env.local`:

```
DATABASE_URL=postgresql://postgres.xqhcygcqkzoupnpkwseb:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.xqhcygcqkzoupnpkwseb:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

> Do **not** use the `db.xqhcygcqkzoupnpkwseb.supabase.co:5432` direct string I put in as a
> placeholder — it is IPv6-only on the free tier and will refuse to connect from most machines and
> from Vercel. The pooler hosts are IPv4. This is the single most common "it works locally but not
> deployed" trap with Supabase, so it's worth getting right now.

## 2. Create the tables

```bash
npm run db:migrate
```

Expect `applying 0001_identity.sql … ok`. Check it with `npm run db:migrate:status`. This creates
`users`, `oauth_identities`, `refresh_tokens`, `email_verification_tokens`.

## 3. Add the Google redirect URI

Google Cloud Console → **console.cloud.google.com/auth** → Clients → your Web application client →
**Authorized redirect URIs** → add:

```
http://localhost:3000/api/v1/auth/google/callback
```

And under **Authorized JavaScript origins**:

```
http://localhost:3000
```

Save. **Wait a few minutes** — console changes take 5 minutes to a few hours to propagate, and a
`redirect_uri_mismatch` right after saving usually means "not propagated yet", not "typed wrong".

The client ID and secret are already in `.env.local`. When you deploy, add the production URIs too
(`https://starrytv.vercel.app/...`) and set `GOOGLE_CALLBACK_URL` and `APP_ORIGIN` accordingly.

## 4. Run it and sign in

```bash
npm run dev
```

- **Google:** visit `http://localhost:3000`, click **Create account** or **Sign in**, then
  **Continue with Google**. This works immediately — Google accounts are auto-verified, so no email
  is involved. You should land on `/desk`.
- **Email + password:** click **Create account**, fill the form, submit. You'll be sent to the
  verify screen. Because `RESEND_API_KEY` is not set yet, **the 6-digit code is printed in your
  terminal** (look for `[email] Verification code for …`). Paste it in. You land on `/desk`, signed
  in.

That the code prints to the console instead of emailing is deliberate — it means you can test the
whole email flow with zero email setup. Wire Resend (add `RESEND_API_KEY` to `.env.local`) when you
want real emails; nothing else changes.

## 5. Make yourself the admin

Sign up first (step 4), then:

```bash
npm run seed:admin -- your-email@example.com
```

Sign out and back in. The nav now shows **Admin**, and `/admin` lets you in. Sign in as any other
account and `/admin` bounces you to `/desk` — that's the gate working.

---

## When you deploy this to Vercel

The auth needs its env vars in Vercel too (they are not read from `.env.local` in production):

```bash
vercel env add DATABASE_URL production      # the pooler string
vercel env add JWT_ACCESS_SECRET production  # copy from .env.local
vercel env add ARGON2_PEPPER production      # copy from .env.local — NEVER change once live
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add GOOGLE_CALLBACK_URL production   # https://starrytv.vercel.app/api/v1/auth/google/callback
vercel env add APP_ORIGIN production            # https://starrytv.vercel.app
```

Then add the production redirect URI in the Google console, and deploy. `ARGON2_PEPPER` must be the
**same** value in every environment or existing passwords stop verifying — treat it as permanent.

## Two things to set up before real users (both free, both in the backend decision doc)

1. **Nightly `pg_dump` to R2.** Supabase free has no backups. For a platform made of user-written
   reviews this is the real end of "free", not the storage limit. Do it before the first real user.
2. **A daily keepalive query** (GitHub Actions cron) so the free project never pauses from
   inactivity during a quiet week.
