# Backend & Auth Decision — launch configuration

Synthesised 2026-07-22 from four research sweeps and a three-lens judge panel.
Supersedes the DigitalOcean BLR1 recommendation in `hosting-decision.md` **for the launch phase**;
that document remains the destination once there is real traffic.

Launch scale: **50–100 users.** At that size capacity is never the binding constraint on any
option — the deciding factors are free-tier failure modes and reversibility.

---

## 1. The answer to "can I just use Supabase and skip the backend?"

Yes, that architecture works. But it is solving a problem you do not have to accept, because
**the $45/month figure was the price of DigitalOcean, not the price of NestJS.**

You can keep NestJS *and* pay nothing:

| Layer | Choice | Cost |
|---|---|---|
| Frontend | Next.js 16 on Vercel | $0 (Hobby) |
| API | **NestJS on Google Cloud Run, `asia-south1` (Mumbai)**, min-instances=0 | $0 |
| Database | **Supabase Postgres, `ap-south-1` (Mumbai)** — as *managed Postgres only* | $0 |
| Media | Cloudflare R2 | $0 (10 GB free, zero egress) |
| Email | Resend | $0 (3,000/mo) |
| Queue | **None at launch** — outbox table + Cloud Scheduler | $0 |

Cloud Run's free tier is **2M requests + 180,000 vCPU-s + 360,000 GiB-s per month, perpetual**
(not a trial). Sizing 1,000 users at ~400k requests × ~120 ms CPU gives ~48,000 vCPU-s and ~24,000
GiB-s — about **25% of the free grant**. At 50–100 users you are nowhere near it. `asia-south1` is a
Tier 1 pricing region, the same rate band as `us-central1`.

**Supabase is used strictly as dumb managed Postgres**: direct connection string, your own TypeORM
migrations, no RLS, no PostgREST, no Supabase Auth. That is the decision that keeps everything
reversible.

## 2. Why not Supabase-native

It was genuinely competitive — one of the three judges preferred it, on the grounds that it has
**zero cold start on the login path**, which is a real advantage (see §4).

It lost on two counts:

**Auth is irreversible, and you already own the thing it replaces.**
`client-lms-zskillup-backend/src/modules/auth/` already implements everything Supabase Auth would
give you: argon2id hashing, opaque refresh tokens hashed at rest, family-based rotation with reuse
detection *and the 30-second grace window*, Google account linking, email verification and reset.
Adopting Supabase Auth discards that and puts your users' identities in a table you do not own.
Data migrates fine — it is just Postgres — but password hashes and OAuth identity linkage do not.

**RLS cannot express your core workflow.** On `UPDATE`, a policy's `USING` clause sees only the OLD
row and `WITH CHECK` only the NEW row, and **no expression sees both** — so *"an author may move
draft → submitted but never → published"* is literally unexpressible in RLS. Worse, RLS is row-level
not column-level: without explicit column `GRANT`s, an author who can update their own review row
can set `status = 'published'` themselves and bypass admin approval entirely. Both are fixable with
`SECURITY DEFINER` RPCs and column grants, but that is a service layer written in PL/pgSQL — which
is exactly what you already have in TypeScript.

Supabase-native remains a sound fallback if the NestJS path stalls. It is not the wrong answer; it
is the second-best one for this specific founder.

## 3. Dealbreakers — read these before writing any code

Every one of these was flagged independently by more than one research pass.

1. **Supabase free has NO BACKUPS.** This — not the 500 MB ceiling, not the pausing — is the real
   end of "free" for a platform whose entire value is user-authored reviews. Silent data loss is
   unrecoverable. **Mitigation ($0): a nightly GitHub Actions `pg_dump` to R2.** Set this up before
   the first real user, not after. Supabase Pro ($25/mo) buys daily backups with 7-day retention and
   is the correct month-3-to-6 step — triggered by *backups*, not by the size limit.
2. **Supabase's built-in SMTP is capped at 2 emails/hour, best-effort.** The second and third
   signups in any hour silently never receive verification, and password reset dies with them. This
   is the single most likely thing to break first. **Wire Resend on day one, on every path.**
3. **The `service_role` key bypasses RLS entirely.** One `NEXT_PUBLIC_` prefix or one accidental
   import into a Client Component ships root database access to every browser. This is the most
   common catastrophic Supabase failure, and AI-generated code produces it frequently.
4. **Media goes to Cloudflare R2 from day one** — never Supabase Storage, never streamed through
   Cloud Run. Supabase free is 1 GB (roughly ten 5–10 minute videos) at $0.09/GB egress; one popular
   20 MB PDF read 5,000 times is 100 GB = **$9/mo on Supabase, $0 on R2**. Cloud Run egress in
   `asia-south1` is ~$0.12/GB with effectively no free allowance for India — always issue signed
   URLs and let the object store serve the bytes.
5. **Do not copy the sibling's Google verification.** `auth.service.ts:732` calls
   `https://oauth2.googleapis.com/tokeninfo`, which Google explicitly labels "for development and
   debugging" — a network round-trip in the login path, rate-limited, and it checks neither `iss`
   nor `email_verified`. Use `google-auth-library`'s `verifyIdToken` (local JWKS). See §5.
6. **Supabase free projects pause after 7 days of low activity** — a full outage, not a cold start,
   requiring a manual Resume click, with only a **90-day** window before the project is
   unrecoverable. A live indexed site clears the bar easily; the risk is the pre-launch quiet week.
   **Mitigation ($0): daily GitHub Actions cron running a trivial query.**
7. **Free tier is 2 active projects per org** — dev + prod consumes the entire allowance, leaving no
   staging environment.
8. **Vercel Hobby prohibits commercial use.** The moment StarryTV carries ads, affiliate links or a
   paid tier, the frontend needs Pro at $20/mo. That is the real first line item — not the backend.

## 4. The two genuine costs of this choice

**Cold starts.** A NestJS module graph cold-starts in **1.5–4 s** on Cloud Run at min-instances=0.
This never touches anonymous readers — the public hub is ISR-rendered by Next.js and serves without
consulting the API at all — but it does hit the first login of a quiet period. Mitigations: enable
`--cpu-boost` (1 vCPU boosts to 2 during startup and the first 10 s), lazy-connect the database,
avoid eager work in the module graph, set concurrency 80. If the logged-in experience feels bad
later, **min-instances=1 is ~$6–7/mo** — buy it then, not now.

> Lambda SnapStart, which would eliminate this, **does not support Node.js** (Java, Python and .NET
> only, verified against current AWS docs). It is a dead end for NestJS regardless of provider.

**Cloud Run domain mapping is not supported in `asia-south1`,** and Google has said there are no
plans to add it. The obvious fix — a global external ALB — is ~$18–25/mo and destroys the free
story single-handedly.

**Use a Vercel rewrite instead**, and note that this *reverses* a decision in `PLAN.md` §5:

```ts
// next.config.ts
async rewrites() {
  return [{ source: '/api/:path*', destination: `${process.env.BACKEND_ORIGIN}/api/v1/:path*` }];
}
```

The plan originally forbade a proxy, on the reasoning that a shared eTLD+1 made cookies first-party
anyway and that PDF byte-range reads should not go through metered functions. Both objections
dissolve here: PDFs are served from R2 signed URLs and never touch the API, and at 50–100 users the
proxied JSON traffic is trivial. The proxy is actually *better* at this scale — the API becomes
**same-origin**, so there is no CORS preflight, no `SameSite=None`, and no third-party cookie
exposure to Safari ITP at all. Revisit if API traffic ever becomes significant.

## 5. Google OAuth — the complete configuration

### 5.1 Console setup

The old "APIs & Services → OAuth consent screen" page **no longer exists**. Configuration now lives
at **console.cloud.google.com/auth** ("Google Auth Platform") with five tabs: *Branding, Audience,
Clients, Data Access, Verification Center*.

1. Create a Google Cloud project. **No billing account is needed** — OAuth client creation and
   unlimited sign-ins with non-sensitive scopes cost nothing and require no card.
2. **You do not need to enable any API.** "Google+ API" and "People API" are not required for
   `openid`/`email`/`profile` — those claims come from the OIDC userinfo endpoint. Most tutorials
   are wrong about this.
3. Auth Platform → **Overview → GET STARTED**.
4. **Branding**: App name `StarryTV`; user support email; App home page `https://starrytv.app`;
   Privacy policy `https://starrytv.app/privacy`; Terms `https://starrytv.app/terms`; Authorized
   domain `starrytv.app`; developer contact email.
5. **Audience**: choose **External**. (*Internal* requires a Google Workspace organisation — a
   personal Gmail cannot select it.)
6. **Data Access**: add exactly `openid`, `email`, `profile`. **Nothing else.**
7. **Click PUBLISH APP** on the Audience tab **before launch**. For non-sensitive scopes this is
   instant and requires no review. Leaving it in Testing is the most common cause of `access_denied`
   at launch.

### 5.2 Verification — you do not need it

`openid`, `email` and `profile` are **non-sensitive scopes**. Google does not require verification
for them, and the 100-test-user cap applies only to apps showing the unverified-app screen. So
StarryTV can serve unlimited readers with zero review. Google documents an explicit carve-out: *"No
warning or expiration applies if requesting only name, email, and profile information through basic
scopes."*

**Requesting exactly these three scopes and nothing more is the single highest-leverage decision in
this guide.** It keeps you out of verification review, out of the 100-user cap, out of the
unverified-app interstitial, and out of the 7-day refresh-token expiry that Testing mode imposes.

*Brand verification is a separate thing.* An External + Published app that displays a **logo or
display name** on the consent screen must pass it — requiring Search Console ownership of
`starrytv.app`, a live privacy policy and a public homepage (~2–3 business days). Without it the
consent screen shows only your domain, which still works. Worth doing: Indian users are
phishing-wary and a consent screen reading "StarryTV" with a logo converts better than a bare domain.

### 5.3 The client

Auth Platform → **Clients → CREATE CLIENT → Web application**.

Because the API is proxied through Vercel (§4), everything is same-origin:

**Authorized JavaScript origins**
```
http://localhost:3000
https://starrytv.app
```

**Authorized redirect URIs**
```
http://localhost:3000/api/v1/auth/google/callback
https://starrytv.app/api/v1/auth/google/callback
```

If you later move the API to its own subdomain instead of proxying, these become
`https://api.starrytv.app/api/v1/auth/google/callback` — and note the path must include the global
prefix, because `main.ts` sets `setGlobalPrefix('api/v1')`. A redirect URI of `/auth/google/callback`
without the prefix is the exact bug that ships fine locally and breaks silently in production.

### 5.4 Which flow

**Redirect code flow. Not GIS One Tap.**

The redirect flow works in every browser and every in-app webview, needs no FedCM, and is what
`passport-google-oauth20` implements natively. Tokens never touch JavaScript, a URL fragment, or a
query parameter.

GIS One Tap depends on FedCM, mandatory since the August 2025 transition completed. It fails
silently in several webviews and under Safari ITP — **it will work perfectly on your laptop and
reach a fraction of your mobile readers.** Skip it. If you add it later, it needs the `g_csrf_token`
double-submit check.

### 5.5 Server-side verification

Use `google-auth-library`'s `verifyIdToken` — local JWKS, no network call in the login path — and
assert explicitly:

- `iss` ∈ `{accounts.google.com, https://accounts.google.com}`
- `aud` === your client ID
- `exp` not passed
- `email_verified === true`

**Key your `users` table on the `sub` claim, never on email.** A user can change their Google
account email; `sub` is stable and unique forever.

### 5.6 Env vars

| Where | Name |
|---|---|
| Backend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| Frontend | `BACKEND_ORIGIN` (server-only — **no** `NEXT_PUBLIC_` prefix) |
| Backend | `DATABASE_URL` (Supabase), `JWT_ACCESS_SECRET` (≥32 chars), `ARGON2_PEPPER` (≥16), `RESEND_API_KEY` |

### 5.7 What will break

- **Redirect URI matching is byte-exact.** A trailing slash makes it a different URI. So does
  http-vs-https and www-vs-apex.
- **Console changes take 5 minutes to a few hours to propagate.** After adding a redirect URI you
  may keep seeing `redirect_uri_mismatch` for a while. **Wait — do not assume you typed it wrong and
  start thrashing the config.** This wastes more founder-hours than any other item here.
- **`localhost` is the only http exception.** `http://192.168.1.x` and `http://api.starrytv.local`
  are rejected. Google also treats `localhost` and `127.0.0.1` as distinct.
- **Scope drift triggers the unverified-app screen.** If the scopes in code differ from the Data
  Access tab, users see the interstitial. Keep the two lists identical.
- **Cookie `SameSite`** is the classic prod-only break — avoided entirely here by the same-origin
  proxy, which is a real argument for it.
- **Google Cloud billing in India** is subject to RBI e-mandate rules; automatic card charges above
  ₹15,000 can be declined. Not relevant while you stay on free tiers.

## 6. Video: YouTube links, not hosted uploads

**Decided 2026-07-22.** Users upload their review video to YouTube themselves and submit the link;
StarryTV renders it. Mux is dropped from the plan.

This is the right call, and not only on cost. It removes the largest and most failure-prone phase in
the roadmap: no resumable upload, no transcoding pipeline, no HLS packaging, no webhook state
machine with out-of-order delivery, no signed playback URLs, no storage bill, no egress bill, no
per-video moderation of raw media. YouTube also does adaptive bitrate, mobile playback, captions and
global CDN better than we would. **Phase 8 shrinks from ~12 focused days to ~2.**

It also removes a liability: we are no longer hosting user-uploaded media at all.

### What it costs

**The television cannot show these videos.** A YouTube embed is an `<iframe>`, not a `<video>`
element — it cannot be drawn to a canvas, so it can never be pushed through the CRT shader. Even a
raw cross-origin video file would taint the canvas and break the WebGL texture upload; an iframe is
strictly further away. Review videos will live on review pages, not on channel 14. If a video
channel matters later, it needs files we host — which is the Mux plan, deferred rather than deleted.

Also true, and worth accepting deliberately:

- **We do not own the content.** A creator can delete or privatise their video and the embed breaks.
  Plan for link rot rather than assuming permanence.
- **The player is not ours.** YouTube branding, and end-screen recommendations pointing away from
  StarryTV. Set `rel=0` to keep suggestions within the same channel where possible.
- **Embeds are heavy** — the standard iframe pulls hundreds of KB of JavaScript per video.
- **It requires a YouTube account**, which is real signup friction for some contributors.

### How to implement it

**Store the video ID and the provider, not the URL.** `video_provider` (`'youtube'`) plus
`video_id`. Canonicalise on input — accept `youtu.be/ID`, `/watch?v=ID`, `/shorts/ID`,
`/embed/ID`, and URLs carrying `?t=`, `&list=` or tracking parameters. Storing a raw pasted URL
guarantees a normalisation migration later, and the provider column is what lets Vimeo or
self-hosted files be added without touching existing rows.

**Validate at submission.**
- `https://www.youtube.com/oembed?url=<url>&format=json` — free, no API key, confirms the video
  exists and is embeddable, and returns title, author and thumbnail. A non-200 means the link is
  dead, private, or embedding is disabled — reject it at submission rather than discovering it on
  the hub.
- YouTube Data API v3 `videos.list` (`part=contentDetails`) returns ISO-8601 duration if you want to
  enforce the 5–10 minute rule mechanically. Needs an API key; 10,000 free quota units/day is far
  beyond our needs. Optional — the oEmbed check is the one that matters.

**Render with a facade, not a raw iframe.** Show the YouTube thumbnail as a static image with a play
control; swap in the real iframe only on click (the `lite-youtube-embed` pattern). Roughly 100× less
JavaScript on page load, and it means a review page with a video still loads like a text page. This
also fits the site's aesthetic far better — a still frame with StarryTV's own typography over it,
rather than a YouTube chrome block dropped into the middle of a monospace page.

**Embed from `youtube-nocookie.com`.** The standard domain sets tracking cookies on load, which
matters for the DPDP notice obligations in `hosting-decision.md` §5.

**Re-check periodically.** A cheap scheduled oEmbed ping over published videos catches link rot;
flag broken ones for the admin queue rather than showing a dead player to readers.

## 7. Ordered checklist

1. Deploy the ported frontend to Vercel. Closes Phase 1 criterion 10. **Independent of all of the
   above** — it contains no auth.
2. Buy `starrytv.app`, point it at Vercel.
3. Create the Supabase project in **`ap-south-1` (Mumbai)**. Save the connection string.
4. Add the daily keepalive cron and the nightly `pg_dump`-to-R2 cron in GitHub Actions. Before any
   real data exists.
5. Google Cloud Console per §5.1–5.3. Publish the app.
6. Resend account + verified sending domain.
7. Scaffold the NestJS backend against the sibling's conventions, with the fixes in
   `zskillup-auth.md` §9 applied — including the Google verification rewrite.
8. Deploy to Cloud Run `asia-south1` with `--cpu-boost`, min-instances=0, concurrency 80.
9. Add the Vercel `/api/*` rewrite.
10. Set a GCP billing budget alert at $5 and $20. The free tier has no hard cap.
