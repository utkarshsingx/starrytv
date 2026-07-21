# StarryTV — Phase 2+ Architecture & Delivery Plan
**Final, definitive. Written to be executed.**
Prepared 2026-07-22 · Lead architect's recommendation · Supersedes all prior proposals

---

## 0. What this document decides

Three competing plans were evaluated. This is not their average. The spine is **P3's product thesis** — *StarryTV is a station, and the constraint is the product* — because it is the only thesis that explains why this project should exist rather than being a reading tracker with unusual CSS. Onto that spine are grafted **P1's phase discipline** (small, deployed, individually-shippable phases with a stated stopping point) and **P2's technical rigour** (server-owned schedule contract, database-level rights gate, an authz matrix that actually catches IDOR).

Every fatal flaw the panel identified is fixed and the fix is named at the point it applies. The most consequential corrections:

| Flaw | Fix |
|---|---|
| All three plans specified *both* first-party cookies on `api.starrytv.app` **and** a Next `rewrites()` proxy — mutually exclusive | **Direct cross-origin, no proxy.** `next.config.ts` has no `rewrites()`. §5 |
| `uq_reviews_author_book` forbids reviewing a re-read, in plans that boast about re-reads | Uniqueness scoped to `read_entry_id`, plus a partial unique on *in-flight* reviews only. §4 |
| P3 shipped the admin console at phase 7 of 8 | Console is **Phase 5**, immediately after the hub goes live. §6 |
| P1 left the TV reading static data for four phases after the hub went dynamic | The schedule-manifest cut lands in **Phase 1**. Verified blast radius: 7 files, zero of them in `src/tv/engine/`. §3 |
| P2 broke broadcast determinism with `revalidateTag('tv-feed')` | Versioned manifest revisions with an hourly `effective_at` boundary. §3, §4 |
| Rights lane enforced only in service code | `CHECK` constraint + service guard + one test for each. §4 |
| Legal counsel budgeted as a Phase 6 checkbox | **Phase 0** paid consult, with a named fallback that shrinks Phase 6 by 60%. §6 |
| Mux HLS → WebGL canvas tainting never examined | **Phase 0** 4-hour spike with a specified fallback. §6 |
| Hard 45–70 word cap = unilateral rewrite of "write a REVIEW and hit publish" | Two-format model: broadcast cut (format-enforced, earns the hub slot) + optional unbounded long body. §4, §6 |
| P3's abort path (separate Vite SPA on `tv.` subdomain) destroys the never-unmount invariant | P1's abort: ship with `ssr:false`, same origin, day-12 hard stop. §3 |

---

## 1. The decision

Migrate `starrytv` in place to **Next.js 16 App Router** and stand up a sibling **NestJS 11 + PostgreSQL 16 + Redis/BullMQ** backend, structurally cloned from `client-lms-zskillup-backend` with its five known defects fixed at scaffold time. Frontend on **Vercel** at `starrytv.app`, backend and database on **Railway (Singapore)** at `api.starrytv.app` — same eTLD+1, so auth cookies are **first-party** and `SameSite=None` (which Safari ITP and Firefox TCP block or partition regardless of attribute) never enters the design. Objects go to **Cloudflare R2** because a PDF reader is an egress machine and R2 charges $0 for egress; video goes to **Mux** on quality tier `basic` because encoding is free and the first 100,000 delivery minutes/month are free and persist after adding a card. Book metadata comes from **Open Library** (cacheable in perpetuity — IA asserts no proprietary rights) with **Google Books** as a gap-filler only (its ToS restricts persistent storage). The television keeps its own hand-written CSS and its own untouched WebGL engine; the new surfaces are hand-built plain-CSS primitives, because a site with two font stacks and six colour custom properties does not need Tailwind and would be visibly worse for having it. Run cost at launch is **≈ $95/month**, rising to **≈ $115/month** once video is live.

| Choice | Decision | One-line justification |
|---|---|---|
| Frontend framework | Next.js 16 App Router, React 19.2 | User-written reviews are the growth surface; a Vite SPA renders an empty div to every crawler and unfurler |
| Frontend hosting | Vercel Pro, $20/mo | Already there; ISR + cache tags + `ImageResponse` are the entire reason to migrate |
| Backend framework | NestJS 11, Node 22, TS strict | Mirrors the sibling the user asked to match; guard chain and envelope are proven code |
| Backend + DB hosting | Railway, Singapore region | Deploy-on-push, one bill, no DBA hours. **Not** AWS ECS — that pipeline has no rollback, manual migrations and a plain-HTTP ALB |
| Database | PostgreSQL 16, TypeORM 0.3, migrations only | `synchronize:false`, hand-written idempotent raw SQL, per the sibling |
| Queue | Redis 7 + BullMQ 5 on **Railway Redis** | BullMQ polls Redis when idle; Upstash pay-as-you-go bills per command and their own docs warn against it |
| Object storage | Cloudflare R2 | $0.015/GB-mo, **$0 egress**. 5 TB/mo of PDF reading = $0 vs ~$450 on S3/Supabase |
| Images | R2 custom domain + CF Image Transformations | 5,000 unique transformations/mo free; presigned `*.r2.cloudflarestorage.com` URLs bypass edge cache, so public assets use the custom domain |
| Video | Mux, tier `basic` | $0 encoding, 100k free delivery min/mo. Cloudflare Stream is ~5×; AWS MediaConvert bills per rendition (~$34/mo just to transcode) |
| PDF viewer | `react-pdf` on `pdfjs-dist` + `react-window` | Only option with page-tracking hooks and a text layer. Apryse is ~$1,500 for a toolbar we don't want |
| Auth | NestJS-owned JWT + Google, httpOnly cookies | The backend already owns users and roles; Clerk/Supabase add a permanent identity-sync problem. Auth.js v5 is in maintenance mode since 2025-09-26 |
| Password hashing | argon2id | Memory-hard; bcrypt's 72-byte truncation is a footgun |
| OAuth | `passport-google-oauth20` redirect code flow | Tokens never touch JS, a URL fragment, or a query param |
| Validation | class-validator DTOs in a duplicated `src/shared/` | ADR-011 pattern from the sibling; frontend imports `import type` so decorators never run client-side |
| Forms | react-hook-form, **no** resolver, **no** zod | Constraints live once in `src/shared/`; zod would be a third copy |
| Styling | Plain CSS + a ~12-component primitives kit. **No Tailwind, no shadcn** | Two font stacks, six colour tokens, zero radius, zero shadow. shadcn's slate/new-york defaults would fight `boring.css` on every screen |
| Metadata API | Open Library primary, Google Books fallback, persisted to our DB | OL is free, keyless, permanently cacheable. Fetch covers by `cover_i`, **never** by ISBN (100 req/IP/5min throttle) |
| Moderation | OpenAI `omni-moderation-latest` (free) as queue-sort weight only | Never auto-reject: AI-text detectors run ~11% false positives with documented bias against non-native English writers — hostile to a library full of translations |
| Email | Resend **Pro $20/mo** | Free tier's binding limit is 100/day, not 3,000/mo; verification + approval mail breaches it on any decent signup day |
| Observability | Sentry Developer + Axiom Personal (both free) | 5k errors and 500 GB/mo ingest is far past this scale |
| Linter | oxlint (kept) + one custom restricted-import rule | `next build` does not need ESLint; the one rule that matters is enforceable in oxlint config |
| Repos | Two, no monorepo | Two packages, one consumer each. `openapi-typescript` in CI gives full type safety this week; workspaces later cost 1–2 days |

---

## 2. Repo & folder structure

Two repos, mirroring the zskillup pair.

### `starrytv-backend` (new)

```
starrytv-backend/
├── .env.example                      # every key mirrored in the Env type, incl. DB_SSL & SKIP_DB
├── .nvmrc                            # 22
├── .prettierrc                       # singleQuote, trailingComma all, printWidth 100
├── eslint.config.mjs                 # no-console: error, no-explicit-any: warn
├── nest-cli.json                     # swagger CLI plugin on
├── tsconfig.json                     # strict + noUnusedLocals/Parameters/ImplicitReturns, @/* -> ./src/*
├── tsconfig.build.json
├── Dockerfile                        # npm ci, NOT npm install
├── docker-compose.dev.yml            # postgres:16-alpine + redis:7-alpine, healthchecks
├── CLAUDE.md                         # COMMITTED. Not gitignored like the sibling's.
├── docs/adr/
│   ├── 0001-two-repos-no-monorepo.md
│   ├── 0002-migrations-gate-the-deploy.md
│   ├── 0003-no-relation-decorators.md
│   ├── 0004-varchar-not-pg-enum.md
│   ├── 0005-first-party-cookies-no-proxy.md
│   ├── 0006-pdf-rights-lanes.md
│   ├── 0007-broadcast-determinism.md
│   └── 0008-review-format-vs-taste.md
├── scripts/
│   ├── ensure-npm.cjs                # preinstall guard, copied from sibling
│   └── seed-house-library.ts         # imports the 100 books from the frontend repo
└── src/
    ├── main.ts
    ├── app.module.ts                 # flat explicit module list, no barrels, no globbing
    ├── config/
    │   └── validation.ts             # hand-written Env type + asString/asEnum/asInt/asBool/asCsv
    ├── common/
    │   ├── auth/authenticated-user.ts
    │   ├── cache/query-cache.ts
    │   ├── decorators/
    │   │   ├── public.decorator.ts
    │   │   ├── roles.decorator.ts
    │   │   └── current-user.decorator.ts
    │   ├── errors/domain-error.ts    # USED EVERYWHERE, not dead code
    │   ├── filters/all-exceptions.filter.ts
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts
    │   │   ├── roles.guard.ts
    │   │   └── csrf.guard.ts         # double-submit, non-GET only
    │   ├── interceptors/transform.interceptor.ts
    │   ├── middleware/request-id.middleware.ts   # FIX: sibling never sets req.id
    │   ├── pagination/
    │   │   ├── page-query.dto.ts
    │   │   └── paginated.ts          # FIX: sibling's PaginationMeta is declared and unused
    │   ├── repository/scoped.ts      # scopedToUser(qb, userId) — the IDOR guard
    │   └── time/clock.ts
    ├── database/
    │   ├── database.module.ts
    │   ├── data-source.ts
    │   ├── schemas.ts                # 7 schemas, ALL created by migration 000
    │   └── migrations/
    │       ├── 1000000000000-CreateSchemas.ts
    │       ├── 1800000000001-CreateIdentity.ts
    │       └── ...
    ├── shared/                       # ── DUPLICATED BYTE-FOR-BYTE INTO THE FRONTEND ──
    │   ├── api.ts
    │   ├── enums.ts
    │   ├── dto/
    │   │   ├── auth.dto.ts
    │   │   ├── shelf.dto.ts
    │   │   ├── review.dto.ts
    │   │   └── ...
    │   └── style/                    # runs identically in browser and in Nest
    │       ├── count-words.ts
    │       ├── is-single-sentence.ts
    │       └── house-style.ts        # the linter. Advisory. Never blocks.
    ├── modules/
    │   ├── auth/
    │   │   ├── auth.module.ts
    │   │   ├── auth.controller.ts
    │   │   ├── auth.service.ts
    │   │   ├── google.strategy.ts
    │   │   ├── tokens.service.ts     # rotation + family revoke, in a transaction
    │   │   ├── cookies.ts            # the ONE place Set-Cookie is built
    │   │   └── dto/swagger.dto.ts
    │   ├── users/
    │   │   ├── user.entity.ts
    │   │   ├── entities/oauth-identity.entity.ts
    │   │   ├── users.repository.ts
    │   │   ├── users.service.ts
    │   │   ├── users.controller.ts
    │   │   └── admin-users.controller.ts       # @Controller('admin/users')
    │   ├── genres/            {genre.entity, genres.*, admin-genres.controller}
    │   ├── books/             {book.entity, entities/book-genre.entity, books.*,
    │   │                       metadata/{open-library.client, google-books.client,
    │   │                       book-lookup.service}, admin-books.controller}
    │   ├── shelf/             {entities/{shelf-entry,read-entry,reading-progress,
    │   │                       reading-session,read-mood,shelf-tag}.entity,
    │   │                       repositories/, services/, shelf.controller,
    │   │                       imports/{goodreads-csv,kindle-clippings}.service}
    │   ├── quotes/
    │   ├── reviews/           {entities/{review,review-revision,review-action,
    │   │                       review-quote,review-image,author-trust}.entity,
    │   │                       review-transition.service.ts  ← ONLY writer of status,
    │   │                       reviews.controller, admin-reviews.controller,
    │   │                       hub.controller, reviews.events.ts}
    │   ├── moderation/        {moderation-signal.entity, openai-moderation.client,
    │   │                       jobs/screen-revision.job.ts}
    │   ├── uploads/           {upload-object.entity, r2.client, uploads.controller}
    │   ├── pdfs/              {entities/{book-file,pdf-reading-progress}.entity,
    │   │                       pdfs.controller, watermark.service}
    │   ├── videos/            {entities/{video-asset,video-webhook-event}.entity,
    │   │                       mux.client, videos.controller,
    │   │                       videos-webhook.controller, jobs/reconcile.job.ts}
    │   ├── broadcast/         {entities/{channel,programme,schedule-revision}.entity,
    │   │                       manifest-builder.service, broadcast.controller,
    │   │                       admin-broadcast.controller, jobs/publish-schedule.job.ts}
    │   ├── reports/           {entities/{report,takedown-notice,
    │   │                       infringement-strike}.entity, reports.controller,
    │   │                       admin-reports.controller}
    │   ├── settings/          {setting.entity, settings.service, settings.controller,
    │   │                       admin-settings.controller}
    │   ├── audit/             {audit-log.entity, audit.service}
    │   ├── mail/              {email-delivery.entity, resend.client, templates/}
    │   ├── queue/             {queue.module, queue.service}
    │   ├── admin-console/     # cross-module ONLY: platform stats, audit browser
    │   └── health/            {health.controller, readiness.service}
    └── test/
        ├── authz-matrix.ts             # route × {anon, owner, other, admin}
        └── authz.e2e-spec.ts           # fails if a Swagger route is missing from the table
```

**Conventions inherited from the sibling, verbatim:** flat explicit module list in `app.module.ts`; cross-cutting concerns only as `APP_*` providers in order `ThrottlerGuard → JwtAuthGuard → CsrfGuard → RolesGuard → TransformInterceptor → AllExceptionsFilter`; `@Public()` as the only opt-out from deny-by-default; entity files singular, module/service/controller files plural; admin surface as `admin-<x>.controller.ts` **inside the feature module** (the majority form — not the two-module `<x>-admin.controller.ts` inversion); `admin-console` reserved for cross-module ops only; `@Injectable()` repository classes wrapping `@InjectRepository`; module registers `TypeOrmModule.forFeature`, exports only the service.

**The do-not-copy checklist**, verified at scaffold time in Phase 2:

| Sibling defect | Location | What we do instead |
|---|---|---|
| `requestId` is always `''` | `transform.interceptor.ts:25`, `all-exceptions.filter.ts:27` read `req.id`; nothing sets it | `RequestIdMiddleware` sets `req.id` before anything else |
| `CORS_ORIGIN` validated then ignored | `config/validation.ts:135-138` vs `main.ts:39-42` `origin:true, credentials:true` | Explicit allowlist from the validated CSV |
| `DB_SSL`/`SKIP_DB` read raw from `process.env` | `database.module.ts:19,37`, `data-source.ts:14-19` | Declared in `Env` and `.env.example` |
| `npm install` in Dockerfile | `Dockerfile:9,23` | `npm ci` |
| `DomainError` is dead code | Imported by `auth.service.ts` only; `NotFoundException` in 45 files | `DomainError` subclasses everywhere; stable `code` is what the frontend branches on |
| `PaginationMeta` declared, never used | `shared/api.ts:12-16` | Real `PageQueryDto` + `paginated()` helper |
| Per-keystroke admin search | `admin/users/page.tsx:117-120` | `<DebouncedSearchInput>` at 300 ms |
| `window.confirm` in 29 places | despite `ui/Modal.tsx` existing | One `<ConfirmDialog>` |
| Pagination copy-pasted between pages | `users:234-256` ≡ `students:136-158` | One `<Pagination>` |
| `pem/global-bundle.pem` readFileSync | boot-crashes with ENOENT if the asset is missing | Not copied — Railway Postgres needs no RDS CA bundle |
| Migration filenames hand-incremented from `17816000000NN`, two stray `-Migration.ts` | | Fresh series from `1800000000001` |

### `starrytv` (existing, migrated in place)

```
starrytv/
├── next.config.ts                    # NO rewrites(). See ADR-0005.
├── tsconfig.json                     # experimentalDecorators + emitDecoratorMetadata
├── .oxlintrc.json                    # restricted-import rule on src/tv/**
├── package.json
├── public/
│   ├── favicon.svg
│   └── schedule/
│       ├── current.json              # Phase 1 build artifact; Phase 4 → API
│       └── minimal.json              # tier-3 fallback: 11 written channels, no library
└── src/
    ├── proxy.ts                      # NOT middleware.ts. UX gating only.
    ├── app/
    │   ├── layout.tsx                # imports index.css + boring.css + tv.css; <Toaster/>
    │   ├── sitemap.ts
    │   ├── robots.ts
    │   ├── (broadcast)/
    │   │   ├── layout.tsx            # Server Component: fetches hub, renders <StationShell>
    │   │   ├── page.tsx              # "/"    → null (shell renders)
    │   │   ├── tv/page.tsx           # "/tv"  → null (shell renders)
    │   │   ├── genre/[slug]/page.tsx
    │   │   ├── review/[slug]/page.tsx
    │   │   ├── review/[slug]/opengraph-image.tsx
    │   │   ├── by/[handle]/page.tsx
    │   │   ├── guide/page.tsx        # the printed schedule, crawlable
    │   │   └── rejected/page.tsx     # "Rejected, and why" — anonymised reason counts
    │   ├── (account)/
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   ├── verify/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── reset-password/page.tsx
    │   ├── (desk)/
    │   │   ├── layout.tsx            # DeskShell
    │   │   └── desk/
    │   │       ├── page.tsx          # currently reading + stats strip
    │   │       ├── shelf/page.tsx
    │   │       ├── book/[entryId]/page.tsx
    │   │       ├── quotes/page.tsx
    │   │       ├── compose/[reviewId]/page.tsx
    │   │       ├── import/page.tsx
    │   │       └── settings/page.tsx
    │   ├── (control)/
    │   │   ├── layout.tsx            # ControlShell
    │   │   └── control/
    │   │       ├── queue/page.tsx    # single-item focus view
    │   │       ├── reviews/page.tsx
    │   │       ├── users/[[...id]]/page.tsx
    │   │       ├── books/page.tsx
    │   │       ├── genres/page.tsx
    │   │       ├── channels/page.tsx
    │   │       ├── reports/page.tsx
    │   │       ├── audit/page.tsx
    │   │       └── settings/page.tsx
    │   └── read/[bookSlug]/page.tsx  # the PDF reader, own chrome
    ├── boring/                       # UNCHANGED except props
    │   ├── BoringEdition.tsx
    │   └── boring.css
    ├── tv/                           # 'use client' added; engine/ byte-identical
    │   ├── StationShell.tsx          # ← replaces App.tsx
    │   ├── TvSet.tsx                 # the ONE dynamic(ssr:false) boundary
    │   ├── TvMode.tsx  Guide.tsx  CrtScreen.tsx  BootSequence.tsx  Remote.tsx
    │   ├── useRemoteControl.ts  store.ts  tv.css
    │   ├── schedule-manifest.ts      # fetch + 3-tier fallback
    │   └── engine/                   # ZERO DIFF except 'use client'
    │       ├── compositor.ts crt.ts power.ts schedule.ts video.ts
    │       └── audio/{index,synth,bed}.ts
    ├── content/
    │   ├── books.data.ts             # server-only after Phase 1
    │   ├── programmes.data.ts        # server-only after Phase 1
    │   ├── beds.data.ts
    │   ├── library.ts
    │   └── build-manifest.ts         # pure: (library, CHANNEL_DATA) -> Manifest
    ├── components/
    │   ├── ui/                       # the 12-piece primitives kit
    │   │   ├── Button.tsx  FormField.tsx  DataTable.tsx  Pagination.tsx
    │   │   ├── ConfirmDialog.tsx  Drawer.tsx  DebouncedSearchInput.tsx
    │   │   ├── EmptyState.tsx  StatusMark.tsx  PageRule.tsx  Toaster.tsx
    │   │   └── SpoilerBar.tsx
    │   ├── compose/{Composer,WordMeter,HouseStyleHints,Attestations}.tsx
    │   ├── reader/{PdfReader,PageTracker}.tsx
    │   ├── video/VideoPlayer.tsx     # thin wrapper; swap Mux→Bunny touches one file
    │   └── SoundToggle.tsx           # KEEP the getServerSnapshot third argument
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts             # cookie-based. See §5 for what is deleted.
    │   │   ├── schema.d.ts           # openapi-typescript output, committed by CI
    │   │   ├── errors.ts  types.ts
    │   │   └── {auth,books,shelf,quotes,reviews,hub,admin,uploads,pdfs,videos}.ts
    │   ├── session.ts                # verifySession() wrapped in React cache()
    │   ├── links.ts  env.ts
    └── shared/                       # byte-identical copy of backend src/shared/
```

**Cross-repo contract, enforced not trusted.** `src/shared/` is duplicated byte-for-byte per ADR-011. A CI job runs `diff -r` between the two trees and **fails the build on drift** — the sibling relies on discipline alone. Separately, `openapi-typescript` runs against the `@nestjs/swagger` spec on every backend merge and commits `schema.d.ts` into the frontend, covering response shapes that `src/shared/` does not.

**Deploy.** Backend: GitHub Actions → build → tag image `${{ github.sha }}` (never a mutable `main` tag, which is why the sibling cannot roll back) → `npm run migration:run` as a **gated job before the service update** → deploy. Migrations are expand-only (add column → backfill → switch reads → drop in a later deploy) so old and new instances coexist during rollout. Frontend: Vercel git integration, one deploy config, no `amplify.yml`/`netlify.toml`.

---

## 3. Frontend strategy

### Decided: migrate to Next.js 16 App Router, in place, on a `next-port` branch

Staying on Vite is defensible only while the site is a two-mode brochure. The next phases add ~25 routes, server-side session verification, and — decisively — **SEO on user-written reviews, which are the entire growth surface**. A Vite SPA ships one `<meta>` block for every URL and swaps `document.title` imperatively after hydration (`App.tsx:44-49`), which no crawler or unfurler waits for. There is also no router to unwind: `App.tsx:11-15` sniffs `window.location.pathname` and `enterTv`/`exitTv` call `history.pushState` directly. Bolting react-router on is the same work with none of the payoff, and diverges from the sibling structure the user asked to match.

The codebase is unusually well-prepared for this. Verified: only **3 runtime dependencies** (react, react-dom, zustand); every browser API touch already sits inside a `useEffect` or an event handler; `env.ts:4,10` guard `typeof window`; `store.ts:57` guards `window.location.search`; `audio/index.ts:45` guards `localStorage`; and `SoundToggle.tsx:18` already passes a `getServerSnapshot` third argument to `useSyncExternalStore`.

### The quarantine rule

> **Every file under `src/tv/engine/` gains `'use client'` at line 1 and is otherwise byte-identical.**
> Phase 1 exit is gated on `git diff --numstat <pre-migration-sha> -- src/tv/engine/` showing no line changes beyond the added directives. This is a mechanical CI check, not a review convention.

This is verifiable and safe because I checked the actual import graph. `src/tv/engine/` is 3,123 lines (compositor, crt, power, schedule, video, audio×3) and **nothing in it imports `content/channels`**. The seven files that do are all outside it:

```
src/App.tsx:7                 channelByNum
src/tv/store.ts:2             channels
src/tv/TvMode.tsx:8           channels
src/tv/Guide.tsx:2            channels
src/tv/CrtScreen.tsx:3        channels
src/tv/useRemoteControl.ts:4  channelByNum   (used at :42 and :155)
src/boring/BoringEdition.tsx:3 channels
```

So the schedule-manifest refactor — the one genuinely architectural change in Phase 1 — touches seven files and none of the 3,123 engine lines. `engine/schedule.ts` in particular needs **no change at all**: `nowPlaying(channel, now)` takes a `Channel` object, so a manifest-built channel works through it unmodified.

### Preserving the never-unmount invariant

`App.tsx:85-96` documents the project's central invariant in a comment: the Boring Edition *"is always mounted, never unmounted. It is the document — the TV is an overlay on top of it."* The naive port (`app/page.tsx` = hub, `app/tv/page.tsx` = TV) unmounts the hub on navigation and kills it.

The fix is a route group whose **layout** owns both, because App Router layouts do not remount across child route changes:

```tsx
// src/app/(broadcast)/layout.tsx   — Server Component
export default async function BroadcastLayout({ children }) {
  const library = await getPublishedLibrary();   // cache: { tags: ['hub'] }
  return <StationShell library={library}>{children}</StationShell>;
}

// src/app/(broadcast)/page.tsx      → export default function Home() { return null }
// src/app/(broadcast)/tv/page.tsx   → export default function Tv()  { return null }
//   Both carry their own `metadata` export. Both are real, crawlable, back-button-correct routes.

// src/tv/StationShell.tsx           — 'use client'
const TvSet = dynamic(() => import('./TvSet'), { ssr: false });

export function StationShell({ library }) {
  const pathname = usePathname();
  const wantsTv = pathname.startsWith('/tv');
  const [mode, setMode] = useState<'boring'|'booting'|'tv'>(wantsTv ? 'booting' : 'boring');
  // ...popstate listener DELETED — usePathname does this job
  // ...first-gesture audio unlock effect COPIED VERBATIM from App.tsx:29-40
  return (
    <>
      <div inert={mode !== 'boring'}>
        <BoringEdition library={library} onEnterTv={enterTv} tvOpen={mode !== 'boring'} />
      </div>
      {mode !== 'boring' && <TvSet mode={mode} onBooted={finishBoot} onExit={exitTv} />}
    </>
  );
}
```

Three states are preserved (`boring | booting | tv`), and so is the exact boot choreography: `finishBoot → setPower(true) → powerOn() → setVolume() → setTimeout(resumeBed(slug), 950)`. `enterTv` becomes `router.push('/tv')`, `exitTv` becomes `router.push('/')`.

The audio-unlock effect matters more after the port, not less: someone deep-linking to `/tv` never clicks the button that would unlock WebAudio, and `/tv` is now a real crawlable, linkable route.

### The schedule manifest — the one architectural change in Phase 1

`channels.ts:3` imports `library` at module scope to build channel 10. That forces `books.data.ts` (84 KB) and `programmes.data.ts` (52 KB) into the client bundle regardless of anything else, and it becomes **impossible** the moment books are Postgres rows. So:

- `src/content/build-manifest.ts` exports a **pure** `buildManifest(library, CHANNEL_DATA): Manifest`. The existing derivation moves in wholesale — `COLOURS`, `BLURBS`, `libraryChannel()`, `splitForScreen()`, `interleave(programmes, 5)`, the 12–45 s clamp. Nothing about the algorithm changes.
- Phase 1 emits `public/schedule/current.json` at build time. Phase 4 changes one URL to `GET /api/v1/broadcast/schedule/current`. Nothing else in the TV changes, ever again.
- `store.ts` holds `channels: Channel[]` and a `loadManifest(m)` action. `channelByNum` becomes a store helper. `initialChannel()` re-resolves `?ch=NN` after the manifest lands.
- `BootSequence` already burns ~2 s of warm-up; the fetch happens there. It is thematically perfect — the set is warming up while the schedule loads.

**Determinism is a design constraint, not an implementation detail.** `engine/schedule.ts:5-9` states it: *"every viewer who loads the page at the same second sees the same frame… That is the whole feeling of live TV."* So a manifest is a **numbered revision with a whole-hour `effective_at`**. The client fetches the revision effective now, sets a timer to the next boundary, and adopts the new revision exactly at `HH:00:00`. Approving a review does **not** put it on air immediately — it enters the next revision. This is precisely what `channels.ts:52-56` already promises: *"Add a book and it is on television within the hour."*

**Three-tier fallback, non-negotiable: the television must never be broken by the backend.**
`fetch(/schedule/current)` → `localStorage` last-good revision → `public/schedule/minimal.json` (the 11 written channels, no library). A dead API means an out-of-date dial, never a dead set.

### SSR hazards, each with its disposition

| # | Hazard | Evidence | Fix |
|---|---|---|---|
| 1 | Routing via `pathname` sniff + raw `pushState` | `App.tsx:11-15, 57-59, 77-80` | `usePathname()` / `router.push`. Raw `pushState` desyncs Next's router |
| 2 | `Date.now()` read during render → guaranteed hydration mismatch | `TvMode.tsx:53` (`nowPlaying`), `TvMode.tsx:149` (clock), `Guide.tsx:42-43`, `CrtScreen.tsx:215` | `dynamic(ssr:false)`. These never render on the server. The wrapper must itself carry `'use client'` — `ssr:false` is illegal inside a Server Component |
| 3 | Module-scope side effects in the Node bundle | `useRemoteControl.ts:153` runs `useTv.subscribe(...)` at import; `audio/index.ts:1128` runs `new TvAudio()` at import | `'use client'` on every module in `src/tv/**`. Neither throws on the server — which is worse than throwing: a module-global Zustand store in an RSC bundle is state shared across concurrent requests |
| 4 | Store init reads the URL | `store.ts:56-61` | Guarded already; keep client-only. Manifest load re-resolves `?ch=` |
| 5 | `setChannel` calls `new URL(window.location.href)` + `replaceState` **with no `typeof` guard** | `store.ts:98-100` (verified — the read path at `:57` is guarded, this one is not) | Add the guard. Keep it as explicit out-of-band `window.history.replaceState` with a comment. **Do not** route through `router.replace()` — that fires an RSC request on every channel change, inside a 60 fps rAF loop |
| 6 | `saveData()` dereferences bare `navigator`, no guard, unreferenced anywhere | `env.ts:16` (verified) | Delete it |
| 7 | `tv.css` imported from inside `TvMode.tsx:13`; under `ssr:false` it loads after hydration → FOUC on the cabinet | | Hoist to `app/layout.tsx`. Both stylesheets use unscoped global selectors (`.boring`, `.tv-mode`, `.book`, `.btn`) so CSS Modules would need a rename pass — don't attempt one |
| 8 | Dropping `getServerSnapshot` throws "Missing getServerSnapshot" during SSR of the hub | `SoundToggle.tsx:18` | Keep the third argument. This component renders in **both** editions, which is why it is an external store |
| 9 | `import './App.tsx'` with explicit extension, permitted only by `allowImportingTsExtensions` | `main.tsx:4`, `tsconfig.app.json:12` | `main.tsx` is deleted; drop the flag, plus `types:["vite/client"]`, `verbatimModuleSyntax`, `erasableSyntaxOnly` |
| 10 | SPA catch-all rewrites will fight Next's routing | `vercel.json`, `public/_redirects` | Delete both. Delete `vite.config.ts`, `index.html`, `main.tsx` |
| 11 | `<noscript>` copy apologises for the book list not rendering — untrue under SSR | `index.html:29-40` | Rewrite it |
| 12 | Someone later imports a TV component into a Server Component tree "for convenience", reintroducing hazard 2 | — | oxlint `no-restricted-imports`: nothing may import `src/tv/**` except `src/tv/**` itself and `StationShell.tsx` |

### Abort path

If `/tv` cannot hit 55 fps under Next by **day 12**, ship it anyway with `dynamic(ssr:false)`, the manifest still served from `public/schedule/current.json`, and no further optimisation — then move on. The Vite build stays in git and Vercel can roll back to the prior deployment at any moment.

Explicitly rejected as an abort path: hosting the Vite SPA on `tv.starrytv.app`. A TV on a different origin cannot be an overlay on a hub it does not share a document with; that "mitigation" destroys the exact invariant it claims to protect, and forks the codebase permanently.

### Search, and what actually leaves the bundle

`BoringEdition.tsx:21-38` filters client-side over title + author + review + hook + origin + tags with `useDeferredValue`. Phase 1 ships the hub as a Server Component rendering full review text, plus a **trimmed client index** (`id, title, author, tags, hook` — no review body) hydrated into a search island. At 100–1,000 reviews that index is ~50 KB. Past ~2,000 it becomes a server `?q=` endpoint behind the same UI.

---

## 4. Data model

**Conventions throughout.** Seven named PG schemas, never `public`, **all created by migration 000** (the sibling shipped `COMMUNITY` in `schemas.ts:27` but omitted it from CreateSchemas, so it got made accidentally by a later migration). `uuid` PKs. Explicit snake_case `name:` on every multi-word column with camelCase TS properties — no naming strategy is configured, so a missing `name:` silently produces a camelCase column the hand-written SQL will not match. `timestamptz` everywhere. `citext` for email/handle/slug. **`varchar` + a TS union + a `CHECK`, never a PG enum type** — the sibling's newer convention (`1781600000058-CreateStudyMaterial.ts:15`); an `ALTER TYPE ADD VALUE` cannot run in the same transaction as its own migration, and TypeORM wraps migrations in one. **No relation decorators**: FKs are scalar `uuid` columns, constraints live only in migration DDL, joins are hand-written QueryBuilder. Named indexes `idx_<table>_<col>` / `uq_<table>_<cols>` / `fk_<table>_<ref>`. Every unique on a soft-deletable table is **partial** on `deleted_at IS NULL`.

```ts
// src/database/schemas.ts
export const DB_SCHEMAS = {
  IDENTITY:  'identity',
  LIBRARY:   'library',
  SHELF:     'shelf',
  UGC:       'ugc',
  MEDIA:     'media',
  BROADCAST: 'broadcast',
  SYSTEM:    'system',
} as const;
```
Migration `1000000000000-CreateSchemas.ts` creates all seven plus `uuid-ossp`, `citext`, `pg_trgm`.

---

### `identity` — Phase 2

**`identity.users`**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | citext NOT NULL | `uq_users_email UNIQUE (email) WHERE deleted_at IS NULL` — **partial**, so deletion frees the address |
| `handle` | citext NOT NULL | public byline, `/by/{handle}`. `uq_users_handle … WHERE deleted_at IS NULL` |
| `password_hash` | varchar(255) NULL | NULL for Google-only accounts |
| `display_name` | varchar(80) NOT NULL | |
| `byline_location` | varchar(40) NULL | renders as `— K. Rao, Bombay` |
| `bio` | varchar(280) NULL | |
| `avatar_object_key` | varchar(500) NULL | **plain column, no FK to media** — avoids a mutual cross-schema FK cycle |
| `role` | varchar(16) NOT NULL DEFAULT `'USER'` | `CHECK (role IN ('USER','ADMIN'))` |
| `status` | varchar(16) NOT NULL DEFAULT `'ACTIVE'` | `CHECK (status IN ('ACTIVE','SUSPENDED','BANNED'))` |
| `email_verified_at` | timestamptz NULL | |
| `last_login_at` | timestamptz NULL | |
| `created_at` `updated_at` `deleted_at` | timestamptz | |

`idx_users_role_status (role, status) WHERE deleted_at IS NULL`

**`identity.oauth_identities`** — a table, not a `google_sub` column, so a second provider is free later.
`id`, `user_id uuid`, `provider varchar(16)` CHECK `IN ('GOOGLE')`, `provider_user_id varchar(255)`, `email_at_provider citext`, `raw_profile jsonb`, `created_at`.
`uq_oauth_identities UNIQUE (provider, provider_user_id)` · `idx_oauth_identities_user (user_id)`

**`identity.refresh_tokens`**
`id`, `user_id`, `family_id uuid NOT NULL`, `token_hash bytea NOT NULL`, `parent_id uuid NULL`, `expires_at`, `rotated_at NULL`, `revoked_at NULL`, `revoked_reason varchar(24) NULL` CHECK `IN ('ROTATED','REUSE_DETECTED','LOGOUT','ADMIN_REVOKE','PASSWORD_CHANGE')`, `user_agent varchar(400)`, `ip inet`, `created_at`.
`uq_refresh_tokens_hash UNIQUE (token_hash)` — the backstop that closes the concurrent-refresh race
`idx_refresh_tokens_family (family_id)` · `idx_refresh_tokens_user_live (user_id) WHERE revoked_at IS NULL`

**`identity.email_tokens`**
`id`, `user_id`, `purpose varchar(24)` CHECK `IN ('VERIFY_EMAIL','RESET_PASSWORD','CHANGE_EMAIL')`, `token_hash bytea`, `expires_at`, `consumed_at NULL`, `created_at`.
`uq_email_tokens_hash UNIQUE (token_hash)` · `idx_email_tokens_user_purpose (user_id, purpose)`

**`identity.infringement_strikes`** — Phase 6
`id`, `user_id`, `report_id uuid NULL`, `notice_ref varchar(80) NULL`, `reason varchar(240)`, `issued_by_user_id uuid`, `issued_at`, `expires_at timestamptz NULL` — strikes **decay**, so three-strikes is a policy not a permanent trap.
`idx_strikes_live (user_id) WHERE expires_at IS NULL OR expires_at > now()`

---

### `library` — Phase 3 (canonical works, admin-governed)

**`library.genres`**
`id`, `slug citext` UNIQUE, `name varchar(80)`, `blurb varchar(300) NULL` (feeds the channel blurb), `channel_colour varchar(7) NULL` (`#RRGGBB`, drives `--screen-light`), `channel_number smallint NULL`, `sort_order int NOT NULL DEFAULT 0`, `is_active bool NOT NULL DEFAULT true`, `created_at`, `updated_at`.
Seeded from the 20 slugs and the `COLOURS`/`BLURBS` maps currently at `channels.ts:13-41`.

**`library.books`**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | citext NOT NULL | generated by the existing `bookId()` at `lib/links.ts:46` so the 100 house books keep their anchors |
| `title` | varchar(300) NOT NULL | |
| `author` | varchar(200) NOT NULL | |
| `first_published_year` | smallint NULL | |
| `origin` | varchar(160) NULL | `"Poland, tr. from Polish"` — the existing `Book.origin` |
| `page_count` | int NULL | |
| `description` | text NULL | |
| `isbn13` | varchar(13) NULL | |
| `open_library_work_key` | varchar(40) NULL | `/works/OL45804W` |
| `open_library_cover_id` | int NULL | `cover_i`. **Fetch covers by this, never by ISBN** |
| `google_volume_id` | varchar(40) NULL | |
| `cover_object_key` | varchar(500) NULL | our R2 key. Never hotlink |
| `metadata_source` | varchar(20) NOT NULL | `HOUSE \| OPEN_LIBRARY \| GOOGLE_BOOKS \| MANUAL` |
| `is_public_domain` | bool NOT NULL DEFAULT false | |
| `gutenberg_id` | int NULL | |
| `created_by_user_id` | uuid NULL | |
| `created_at` `updated_at` `deleted_at` | | |

`uq_books_slug UNIQUE (slug) WHERE deleted_at IS NULL`
`uq_books_isbn13 UNIQUE (isbn13) WHERE isbn13 IS NOT NULL AND deleted_at IS NULL`
`idx_books_title_trgm GIN (title gin_trgm_ops)` · `idx_books_author_trgm GIN (author gin_trgm_ops)` — fuzzy dedupe on submit

**No link columns.** Links stay *search* URLs built at render by `linksFor()` (`links.ts:3-9`): a hand-written product URL rots the moment an edition goes out of print; a search does not.

**`library.book_genres`** — `book_id`, `genre_id`, `is_primary bool`. PK `(book_id, genre_id)`. `idx_book_genres_genre (genre_id)`

---

### `shelf` — Phase 3 (private by default)

Three tables, not one. This is the fix for the flaw two judges flagged: merging shelf membership with read attempts leaves nothing preventing unlimited duplicate `WANT_TO_READ` rows for one book.

**`shelf.shelf_entries`** — *"this book is on my shelf"*
`id`, `user_id`, `book_id`, `status varchar(16) NOT NULL` CHECK `IN ('WANT_TO_READ','READING','PAUSED','READ','DNF')`, `is_favourite bool`, `visibility varchar(12) NOT NULL DEFAULT 'PRIVATE'` CHECK `IN ('PRIVATE','PUBLIC')`, `added_at`, `created_at`, `updated_at`, `deleted_at`.
**`uq_shelf_entries_user_book UNIQUE (user_id, book_id) WHERE deleted_at IS NULL`**
`idx_shelf_entries_user_status (user_id, status) WHERE deleted_at IS NULL`
`idx_shelf_entries_reading (updated_at DESC) WHERE status='READING' AND deleted_at IS NULL` — feeds the READING ROOM channel

**`shelf.read_entries`** — *"this is my second go at it"*. **Reads are rows, not a boolean.**
`id`, `shelf_entry_id`, `user_id`, `book_id`, `attempt_no smallint NOT NULL DEFAULT 1`, `started_on date NULL`, `finished_on date NULL`, `outcome varchar(16) NOT NULL` CHECK `IN ('IN_PROGRESS','FINISHED','ABANDONED','PAUSED')`, `abandoned_reason varchar(500) NULL`, `rating_quarter_stars smallint NULL CHECK (BETWEEN 0 AND 20)`, `format varchar(8) NOT NULL DEFAULT 'PRINT'` CHECK `IN ('PRINT','EBOOK','AUDIO')`, `edition_page_count int NULL`, `pace varchar(8) NULL` CHECK `IN ('SLOW','MEDIUM','FAST')`, `private_notes text NULL`, `created_at`, `updated_at`.
`uq_read_entries_attempt UNIQUE (shelf_entry_id, attempt_no)`
`idx_read_entries_user_finished (user_id, finished_on DESC) WHERE finished_on IS NOT NULL`

> `started_on` / `finished_on` are the highest value-per-effort fields in the product and the only ones that genuinely **cannot be backfilled**. Streaks, pace, "books read this month" and year-in-review are all impossible without them.
> `rating_quarter_stars` is an integer 0–20, not a float — dodges comparison bugs entirely, and 0.25 increments are one of StoryGraph's most-cited advantages.

**`shelf.reading_progress`** — 1:1 with a read
`id`, `read_entry_id uuid` **UNIQUE**, `user_id`, `book_id`, `page int NULL`, `total_pages int NULL`, `audio_seconds int NULL`, `total_audio_seconds int NULL`, `source varchar(12) NOT NULL DEFAULT 'MANUAL'` CHECK `IN ('MANUAL','PDF_READER','TIMER')`, `recorded_at`, `created_at`, `updated_at`.

> **Integer page, never a percent.** Percent is derived for display. Storing it destroys information and breaks across editions. Audio columns let one progress bar serve both formats.

**`shelf.reading_sessions`** — `id`, `read_entry_id`, `user_id`, `started_at`, `ended_at NULL`, `start_page NULL`, `end_page NULL`, `source varchar(12)`, `created_at`. `idx_reading_sessions_entry (read_entry_id, started_at DESC)`

**`shelf.read_moods`** — `read_entry_id`, `mood varchar(20)`. PK `(read_entry_id, mood)`.
*Fixed from the proposals: `pace` lives on `read_entries`, not here. Putting it on a `(read_entry_id, mood)` PK is a 2NF violation that lets two mood rows for the same read record contradictory pace.*

**`shelf.tags`** / **`shelf.shelf_entry_tags`** — user-defined multi-select, kept **strictly separate** from `status`. Goodreads conflates both into "shelves" and users complain about the result constantly; it is free to get right now and very expensive to undo.
`tags`: `id`, `user_id`, `name varchar(40)`, `slug citext`, `created_at`, `uq_tags_user_slug UNIQUE (user_id, slug)`
`shelf_entry_tags`: PK `(shelf_entry_id, tag_id)`

**`shelf.quotes`** — private-first, so it lives here rather than in `ugc`
`id`, `user_id`, `book_id`, `read_entry_id uuid NULL`, `body text NOT NULL CHECK (char_length(body) <= 2000)` (fair-use ceiling, ~300 words), `page int NULL`, `chapter varchar(80) NULL`, `note text NULL`, `visibility varchar(12) NOT NULL DEFAULT 'PRIVATE'`, `source varchar(12) NOT NULL DEFAULT 'MANUAL'` CHECK `IN ('MANUAL','OCR','PDF_SELECT')`, `image_object_key varchar(500) NULL`, `created_at`, `updated_at`, `deleted_at`.
`idx_quotes_user_book (user_id, book_id) WHERE deleted_at IS NULL`

**`shelf.book_images`** — "paste images from the book"
`id`, `user_id`, `book_id`, `upload_object_id uuid NOT NULL`, `kind varchar(20)` CHECK `IN ('PAGE_PHOTO','MARGINALIA','ILLUSTRATION','COVER')`, `caption varchar(240)`, `page int NULL`, `width int`, `height int`, `created_at`, `deleted_at`.

---

### `ugc` — Phase 4 (reviews as post + immutable revisions)

**`ugc.reviews`**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `author_user_id` `book_id` | uuid NOT NULL | |
| `read_entry_id` | uuid NULL | which read this review came out of |
| `slug` | citext NOT NULL | |
| `status` | varchar(24) NOT NULL DEFAULT `'DRAFT'` | CHECK `IN ('DRAFT','SUBMITTED','IN_REVIEW','CHANGES_REQUESTED','REJECTED','PUBLISHED','UNPUBLISHED','ARCHIVED')` |
| `live_revision_id` | uuid NULL | **what the public sees — not necessarily the newest** |
| `pending_revision_id` | uuid NULL | forward revision awaiting review (Drupal pattern) |
| `genre_id` | uuid NOT NULL | which hub section it files under |
| `is_house` | bool NOT NULL DEFAULT false | the original 100 |
| `tv_eligible` | bool NOT NULL DEFAULT true | keep it on the hub but off the air |
| `hub_pinned` | bool NOT NULL DEFAULT false | |
| `hub_sort_order` | int NULL | |
| `view_count` | int NOT NULL DEFAULT 0 | |
| `published_at` `unpublished_at` | timestamptz NULL | |
| `delete_reason` | varchar(240) NULL | |
| `created_at` `updated_at` `deleted_at` | | |

```sql
uq_reviews_slug        UNIQUE (slug)           WHERE deleted_at IS NULL
uq_reviews_read_entry  UNIQUE (read_entry_id)  WHERE deleted_at IS NULL AND read_entry_id IS NOT NULL
uq_reviews_inflight    UNIQUE (author_user_id, book_id)
                       WHERE deleted_at IS NULL
                         AND status IN ('DRAFT','SUBMITTED','IN_REVIEW','CHANGES_REQUESTED')
idx_reviews_hub   (genre_id, published_at DESC) WHERE status='PUBLISHED' AND deleted_at IS NULL
idx_reviews_queue (created_at)                  WHERE status IN ('SUBMITTED','IN_REVIEW')
idx_reviews_author (author_user_id, status)
```

> **This is the re-read fix.** One review per *read*, and only one *in-flight* review per book at a time — but a second read of the same book two years later gets its own review. The flat `UNIQUE (author_user_id, book_id)` that two proposals carried reintroduced exactly the Goodreads flaw they spent paragraphs condemning.

**`ugc.review_revisions`** — **IMMUTABLE. Inserted, never updated. No `updated_at`.**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `review_id` `rev_no` | | `uq_review_revisions_no UNIQUE (review_id, rev_no)` |
| `hook` | varchar(140) NOT NULL | one line. `hook_word_count smallint NOT NULL CHECK (BETWEEN 1 AND 14)` |
| `body` | text NOT NULL | **the broadcast cut.** `body_word_count smallint NOT NULL CHECK (BETWEEN 30 AND 120)` |
| `long_body` | text NULL | **the unconstrained essay.** Renders on the review page below the broadcast cut. Never on a hub card, never on TV |
| `underdog` | varchar(400) NOT NULL | one sentence naming the *mechanism* of neglect |
| `tags` | text[] NOT NULL DEFAULT `'{}'` | |
| `spoiler_ranges` | jsonb NOT NULL DEFAULT `'[]'` | `[{start,end}]` over `body`/`long_body` |
| `content_warnings` | text[] NOT NULL DEFAULT `'{}'` | self-applied |
| `style_report` | jsonb NOT NULL DEFAULT `'{}'` | house-style linter output; advisory + queue-sort weight |
| `content_hash` | bytea NOT NULL | clusters the moderation queue. `idx_review_revisions_hash` |
| `created_by_user_id` | uuid NOT NULL | author OR the admin who edited in place |
| `edited_by_admin` | bool NOT NULL DEFAULT false | shown on the page; byline stays the author's |
| `created_at` | timestamptz | |

> **Format is enforced; taste is advised.** The `CHECK` bounds are immovable outer rails; the *configured* window (default 45–70 words, matching `types.ts` and the existing corpus) lives in `system.settings` and is enforced in the service and mirrored in the composer's live counter via `GET /api/v1/settings/public`. Change the setting and both move together. The house-style linter — flagging *"a haunting meditation on"*, adjective stacks, exclamation marks, second-person marketing register — **never blocks submission**; it advises the author and weights the admin queue. And `long_body` means "write a REVIEW and hit publish" is always literally true: the broadcast cut is what earns the hub slot, not what limits your writing.

**`ugc.review_quotes`** / **`ugc.review_images`** — join tables with `(revision_id, quote_id|image_id, sort_order, caption)`.
*Fixed from all three proposals, which used `uuid[]` columns on an immutable table — deleting a quote left permanently dangling ids on a row that by design can never be updated.*

**`ugc.review_actions`** — **APPEND-ONLY. The audit trail.**
`id`, `review_id`, `revision_id NULL`, `from_status varchar(24) NULL`, `to_status varchar(24) NOT NULL`, `actor_user_id uuid NULL` — **deliberately no FK, so rows survive account erasure** — `actor_role varchar(16)`, `reason_code varchar(40) NULL`, `reason_text text NULL` (**surfaced verbatim to the author**), `automated bool`, `machine_scores jsonb NULL`, `created_at`.
`idx_review_actions_review (review_id, created_at DESC)`

`reason_code` vocabulary, in the house register because the author reads it: `TOO_FAMOUS`, `NOT_IN_VOICE`, `UNVERIFIABLE_BOOK`, `READS_LIKE_MARKETING`, `LENGTH_OUT_OF_RANGE`, `HOOK_TOO_LONG`, `UNDERDOG_NOT_A_MECHANISM`, `DUPLICATE`, `RIGHTS_CONCERN`, `POLICY_VIOLATION`, `OTHER`.

**The single choke point.** `ReviewTransitionService.transition()` is the **only** code that writes `reviews.status`. In one transaction it validates the edge against a const map in TypeScript, writes the `review_actions` row, updates the status, and queues cache/manifest invalidation. Controllers never touch `status`.

A trigger enforces the same edge set as a backstop — **with an escape hatch**, which none of the proposals specified:

```sql
CREATE FUNCTION ugc.guard_review_status() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('starrytv.bypass_status_guard', true), 'off') = 'on'
     THEN RETURN NEW; END IF;
  IF NOT ugc.is_legal_transition(OLD.status, NEW.status)
     THEN RAISE EXCEPTION 'illegal review transition % -> %', OLD.status, NEW.status; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```
Migrations and repair scripts run `SET LOCAL starrytv.bypass_status_guard = 'on'`. Without this, your own backfills and expand-only migrations are rejected during your first production incident.

**`ugc.moderation_signals`** — `id`, `revision_id`, `provider varchar(24)`, `label varchar(60)`, `score numeric(5,4)`, `raw jsonb`, `created_at`.

**`ugc.author_trust`** — a table, not columns on `users` (which would make every moderation decision write the users row).
`user_id uuid PK`, `level smallint NOT NULL DEFAULT 0` (0 = always review, 1 = fast lane, 2 = bypass), `approved_count int`, `rejected_count int`, `last_decision_at`, `updated_at`.

**`ugc.reports`** — Phase 6 — `id`, `target_type varchar(20)` CHECK `IN ('REVIEW','QUOTE','IMAGE','PDF','VIDEO','USER')`, `target_id`, `reporter_user_id uuid NULL`, `reporter_email citext NULL` (anonymous rights-holder notices), `reason_code varchar(40)` CHECK `IN ('COPYRIGHT','ABUSE','SPAM','NSFW','OTHER')`, `detail text`, `status varchar(20) NOT NULL DEFAULT 'OPEN'` CHECK `IN ('OPEN','ACTIONED','DISMISSED','COUNTER_NOTICED')`, `resolved_by_user_id`, `resolved_at`, `resolution_note`, `created_at`.
`idx_reports_open (created_at) WHERE status='OPEN'`

---

### `media` — Phases 5 / 6 / 8

Two tables, not one fused table with ten mutually-exclusive nullable columns.

**`media.upload_objects`** — R2 only — Phase 5
`id`, `owner_user_id`, `bucket varchar(60)`, `object_key varchar(500)`, `kind varchar(20)` CHECK `IN ('BOOK_IMAGE','AVATAR','COVER','BOOK_PDF')`, `mime varchar(80)`, `byte_size bigint`, `checksum_sha256 bytea NULL`, `width int NULL`, `height int NULL`, `status varchar(16) NOT NULL DEFAULT 'PENDING'` CHECK `IN ('PENDING','STORED','REJECTED','DELETED')`, `created_at`, `stored_at NULL`, `deleted_at NULL`.
`uq_upload_objects_key UNIQUE (bucket, object_key)` · `idx_upload_objects_owner (owner_user_id, kind) WHERE deleted_at IS NULL`

**`media.book_files`** — the legal firewall — Phase 6
`id`, `book_id`, `uploader_user_id`, `upload_object_id`, `rights_lane varchar(20) NOT NULL` CHECK `IN ('PUBLIC_DOMAIN','RIGHTS_HOLDER','OPEN_LICENSED','PRIVATE_LOCKER')`, `licence varchar(80) NULL`, `gutenberg_id int NULL`, `standard_ebooks_id varchar(60) NULL`, `page_count int NULL`, `has_text_layer bool NULL`, `visibility varchar(8) NOT NULL DEFAULT 'PRIVATE'` CHECK `IN ('PUBLIC','PRIVATE')`, `review_status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW'` CHECK `IN ('PENDING_REVIEW','APPROVED','REJECTED')`, `warranty_accepted_at timestamptz NULL`, `warranty_ip inet NULL`, `reviewed_by_user_id`, `reviewed_at`, `takedown_at NULL`, `takedown_report_id NULL`, `created_at`, `updated_at`, `deleted_at`.

```sql
CONSTRAINT ck_book_files_public_lane CHECK (
  visibility <> 'PUBLIC'
  OR (rights_lane <> 'PRIVATE_LOCKER' AND review_status = 'APPROVED')
)
idx_book_files_public (book_id)
  WHERE visibility='PUBLIC' AND review_status='APPROVED' AND deleted_at IS NULL
idx_book_files_queue (created_at) WHERE review_status='PENDING_REVIEW'
```

> **A public private-locker file is unrepresentable at the database level**, and the publish service enforces it independently. Two tests: one that a raw `UPDATE` is rejected by the constraint, one that the service rejects it. This is the one failure the product cannot survive, so it gets belt *and* braces.

**`media.pdf_reading_progress`** — Phase 6 — `id`, `user_id`, `book_file_id`, `page int`, `total_pages int`, `scroll_pct numeric(5,2) NULL`, `updated_at`. `uq_pdf_progress UNIQUE (user_id, book_file_id)`

**`media.takedown_notices`** — Phase 6 — `id`, `report_id`, `subject_book_file_id NULL`, `subject_review_id NULL`, `complainant_name`, `complainant_email citext`, `claim text`, `received_at`, `actioned_at NULL`, `action varchar(20) NULL` CHECK `IN ('REMOVED','REJECTED','RESTORED')`, `counter_notice_at NULL`, `restored_at NULL`.

**`media.video_assets`** — Phase 8
`id`, `owner_user_id`, `review_id NULL`, `book_id NULL`, `provider varchar(16) NOT NULL DEFAULT 'MUX'`, `provider_upload_id varchar(120) NULL`, `provider_asset_id varchar(120) NULL`, `playback_id varchar(120) NULL`, `playback_policy varchar(10) NOT NULL DEFAULT 'SIGNED'`, **`status varchar(24)`** CHECK `IN ('DRAFT','AWAITING_UPLOAD','UPLOADING','UPLOADED','PROCESSING','READY','UPLOAD_FAILED','PROCESSING_FAILED','CANCELLED')`, **`status_rank smallint NOT NULL DEFAULT 0`**, **`moderation_status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW'`** CHECK `IN ('PENDING_REVIEW','APPROVED','REJECTED')`, `duration_seconds numeric(9,2)`, `aspect_ratio varchar(12)`, `thumbnail_url varchar(500)`, `transcript_text text NULL`, `error_code`, `error_message`, `created_at`, `updated_at`, `ready_at`, `deleted_at`.

```sql
uq_video_assets_upload UNIQUE (provider, provider_upload_id) WHERE provider_upload_id IS NOT NULL
uq_video_assets_asset  UNIQUE (provider, provider_asset_id)  WHERE provider_asset_id IS NOT NULL
idx_video_assets_stuck (updated_at) WHERE status='PROCESSING'          -- reconciliation cron
idx_video_assets_queue (created_at) WHERE moderation_status='PENDING_REVIEW'
```

> **Two status columns is non-negotiable.** A video is routinely READY-but-not-APPROVED and one column cannot express that; conflating them is the classic bug. `status_rank` (DRAFT=0 … READY=50) is the monotonic guard: apply a transition only when the incoming rank exceeds the stored rank. Mux's `video.asset.ready` genuinely arrives before `video.upload.asset_created`, and a naive `UPDATE` silently regresses a live asset to PROCESSING.

**`media.video_webhook_events`** — `id`, `provider`, `provider_event_id varchar(160)`, `event_type varchar(80)`, `payload jsonb`, `received_at`, `processed_at NULL`, `process_error text NULL`.
`uq_video_webhook_events UNIQUE (provider, provider_event_id)`
Controller flow: verify signature → `INSERT … ON CONFLICT DO NOTHING RETURNING` → if we won the insert, enqueue a BullMQ job → return 200. **The state transition happens in the worker, never in the request.**

---

### `broadcast` — Phase 4

**`broadcast.channels`** — `id`, `num smallint` UNIQUE, `slug citext` UNIQUE, `name varchar(24)`, `colour varchar(7)`, `blurb varchar(300)`, `kind varchar(16)`, `source varchar(28)` CHECK `IN ('WRITTEN','GENERATED_LIBRARY','GENERATED_NEW_REVIEWS','GENERATED_READING_ROOM','VIDEO')`, `is_active bool`, `sort_order int`, `created_at`, `updated_at`.

**`broadcast.programmes`** — `id`, `channel_id`, `external_id varchar(120)` (`library-<book-slug>`, stable across rebuilds), `kind varchar(16)`, `heading varchar(120)`, `subheading varchar(160)`, `lines text[]` (already through `splitForScreen`), `footer varchar(400)`, `duration_sec smallint` (clamped 12–45), `sort_order int`, `source_review_id uuid NULL`, `video_asset_id uuid NULL`, `reel_offset_sec int NULL`, `created_at`.
`uq_programmes_external UNIQUE (channel_id, external_id)`

**`broadcast.schedule_revisions`** — the determinism mechanism
`id`, `rev_no int` UNIQUE, `manifest jsonb NOT NULL` (the exact `Channel[]` the client TV consumes), `manifest_hash bytea`, `programme_count int`, `byte_size int`, **`effective_at timestamptz NOT NULL`** (always a whole hour UTC), `published_at`, `published_by_user_id NULL`.
`idx_schedule_revisions_effective (effective_at DESC)`

`GET /api/v1/broadcast/schedule/current` returns the revision where `effective_at <= now()`, ordered desc, limit 1, with a strong ETag. The client sets a timer to the next boundary and adopts exactly at `HH:00:00`.

---

### `system` — Phase 2

**`system.audit_logs`** — `id`, `actor_user_id uuid NULL` (**no FK — trail outlives the account**), `actor_role varchar(16)`, `action varchar(80)`, `entity_type varchar(40)`, `entity_id uuid NULL`, `metadata jsonb`, `ip inet`, `user_agent varchar(400)`, `created_at`.
`idx_audit_logs_actor (actor_user_id, created_at DESC)` · `idx_audit_logs_entity (entity_type, entity_id, created_at DESC)`

**`system.settings`** — `key varchar(80) PK`, `value jsonb NOT NULL`, `description text`, `is_public bool NOT NULL DEFAULT false`, `updated_by_user_id`, `updated_at`.
Keys: `review.body_word_min` (45), `review.body_word_max` (70), `review.hook_word_max` (14), `hub.hero_headline`, `hub.section_order`, `moderation.auto_publish_trust_level` (2), `broadcast.publish_cron`, `broadcast.channel_10_enabled`, `uploads.max_pdf_mb`, `quotes.max_words` (300), `readingroom.min_cohort` (3).

**`system.email_deliveries`** — `id`, `dedup_key varchar(160)` **UNIQUE**, `to_email citext`, `template varchar(60)`, `status varchar(16)`, `provider_message_id varchar(120)`, `error text`, `created_at`, `sent_at`. The unique gate is what stops a retried BullMQ job double-sending a verification link.

**`system.query_result_cache`** — TypeORM's DB-backed cache table.

---

### Hub query performance

**No materialized view.** Escalation ladder, each step gated on a *measured* p95:
1. Partial index `idx_reviews_hub` + covering columns — good well past 10⁵ rows.
2. Next cache tags `hub`, `genre:{slug}`, `review:{id}` with long revalidate, `revalidateTag` fired **only from `ReviewTransitionService`**, plus a pre-warm fetch after invalidation.
3. Matview only if the hub genuinely needs joined author/genre/engagement aggregates. Note `REFRESH … CONCURRENTLY` requires a non-nullable, non-partial unique index and is *slower* than a plain refresh on large deltas — it is not a free upgrade.

**N+1 is the standing hazard of the no-relation-decorators convention.** A hub rendering 50 reviews with author, book, genre and cover would issue 200 queries if written as a service loop (the sibling does exactly this at `courses.service.ts:27-28`). Follow the grouped-query pattern instead (`courses.repository.ts:99-123`), and put a **query-count assertion on the hub endpoint in CI**.

---

## 5. Auth design

### The topology decision, made once

```
Frontend   https://starrytv.app          (Vercel)
Backend    https://api.starrytv.app      (Railway, custom domain, TLS terminated by Railway)
```

Cross-**origin** (CORS applies) but same-**site** — same eTLD+1 — so cookies are **first-party**. `SameSite=None` never appears in this design, which matters because `SameSite=None` cookies *are* third-party cookies and Safari ITP and Firefox Total Cookie Protection block or partition them regardless of the attribute. Chrome kept them (deprecation reversed April 2025), but building auth on a mechanism Safari already blocks is a standing liability with no upside.

> **`next.config.ts` contains no `rewrites()`.** All three proposals specified both a subdomain API *and* a Next proxy; they are mutually exclusive, and the panel was right that it must be resolved before the first cookie is set. Direct is correct here for a concrete reason: PDF byte-range reads go straight from the browser to a presigned R2 URL. Proxying them through Vercel functions would be metered, bounded by response-size limits, and would defeat R2's zero-egress economics — the entire reason R2 was chosen.

### Cookies

| name | contents | attributes | lifetime |
|---|---|---|---|
| `st_at` | access JWT (RS256) | `HttpOnly; Secure; SameSite=Lax; Domain=.starrytv.app; Path=/` | 15 min |
| `st_rt` | opaque refresh token (256-bit random) | `HttpOnly; Secure; SameSite=Lax; Domain=.starrytv.app; Path=/api/v1/auth` | 30 days |
| `st_csrf` | 32-byte random, **not** HttpOnly | `Secure; SameSite=Lax; Domain=.starrytv.app; Path=/` | session |
| `st_role` | `USER` / `ADMIN` hint, **not** HttpOnly | `Secure; SameSite=Lax; Domain=.starrytv.app; Path=/` | 30 days |

> **`Path=/api/v1/auth`, not `/auth/refresh`.** `main.ts` sets `setGlobalPrefix('api/v1')`, so a cookie scoped to `/auth/refresh` is never sent to the real endpoint — silent refresh would be permanently broken in production while passing every local test that hits the unprefixed path. This was a live bug in one proposal.

Never localStorage, never sessionStorage, never a readable token cookie. `st_role` is a **routing hint only** and is never a security control — the Nest guard chain is the boundary.

### The API client

`src/lib/api/client.ts` is adapted from the sibling — which is the best-engineered file in either repo — but is **not** a wholesale copy, because cookie-based auth invalidates half of it.

**Kept:** three-way auth posture (`'default' | 'login' | 'public'` — `'login'` makes a 401 mean *bad credentials*, never a refresh or redirect); three-way refresh outcome (`'ok' | 'unauthorized' | 'network'`, where a `network` verdict **must never tear down the session**, or thirty seconds of backend downtime logs out every open tab); single-flight refresh dedup via a module-level promise; **403 never retried, never redirected**; the `sessionTerminated` latch with `_rearmApiClient()`; `endSessionAndRedirect()` doing a hard navigation.

**Deleted, with the reason recorded in ADR-0005:** the Zustand in-memory access token; the `Authorization: Bearer` header; the role-hint priming hack at `client.ts:245-253` (which exists solely to avoid a first-paint 401 burst from a memory-only token — with an httpOnly cookie the browser just sends it); the super-admin preview-token layer.

Every request sets `credentials: 'include'`. Every non-GET sets `X-CSRF-Token` from `st_csrf`.

### CORS

```ts
app.enableCors({
  origin: config.get('CORS_ORIGIN', { infer: true }),   // real allowlist, parsed CSV
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['content-type','x-csrf-token'],
  maxAge: 86400,
});
```
Never `origin: true`. The sibling validates `CORS_ORIGIN` at `config/validation.ts:135-138` then hardcodes reflect-any-origin *with credentials* at `main.ts:39-42` — a live vulnerability, not a style issue.

### CSRF

`SameSite=Lax` already blocks cross-site POSTs, but httpOnly does not solve CSRF and Lax has edge cases. `CsrfGuard` runs on every non-`GET`/`HEAD`/`OPTIONS` request: compare `X-CSRF-Token` against the `st_csrf` cookie with a timing-safe equal. `@Public()` webhook routes are exempt via `@SkipCsrf()` (they verify a provider HMAC instead).

### Flows

**Signup** — `POST /api/v1/auth/register {email, password, displayName, handle}` → argon2id hash → insert `identity.users` with `email_verified_at NULL` → issue an `email_tokens` row (`VERIFY_EMAIL`, sha256-hashed, 60 min TTL, single-use) → enqueue mail with `dedup_key = 'verify:{userId}:{tokenId}'`. **No session is created.** Response is identical whether or not the email already exists.

**Verify** — `POST /api/v1/auth/verify-email {token}` → hash, look up, check TTL and `consumed_at` → set `consumed_at` and `email_verified_at` → **establish a session** (the user lands authenticated, so the welcome flow is not interrupted).

> **Write the unconsumed predicate as `IsNull()`, never `undefined`.** TypeORM silently drops `undefined` values from a `where` object, so `{ consumedAt: undefined }` compiles, runs, and matches **every** row including already-consumed ones — single-use is not enforced and there is no error to notice. The sibling has this exact bug live at `email-verification-token.repository.ts:24-29`; it is currently masked by an unrelated `isEmailVerified` early return, which is why it has never surfaced. Add a test that consumes a token twice and asserts the second attempt fails, because nothing else will catch it.

**Login** — `POST /api/v1/auth/login` → argon2 verify → if `email_verified_at IS NULL` throw `EmailNotVerifiedError` (code `EMAIL_NOT_VERIFIED`, so the UI can render an inline "verify now" CTA) → if `status='SUSPENDED'` throw `AccountSuspendedError` → issue access + refresh + csrf + role cookies. Throttled at 10/min.

> **Constant-time on the not-found path.** When no user matches the email, verify the supplied password against a module-level dummy argon2id hash before returning the generic error, and discard the result. The sibling returns immediately at `auth.service.ts:225-227` with the miss acknowledged in a comment and waved off — but a missing account answers in microseconds while a wrong password costs a full Argon2id hash, which is a usable email-enumeration oracle regardless of the identical error string. Cost is one hash on a path that is already rate-limited to 10/min. Compute the dummy hash once at module load, never per request, or the fix becomes its own timing signal.

> **OAuth-only accounts must not be verifiable.** `password_hash` is `NULL` for accounts created through Google (the sibling uses `''`, which is a hash that `argon2.verify` will simply fail against — same outcome, but `NULL` states the intent and makes the "this account has no password" branch explicit rather than incidental). Guard the branch before calling verify: a `NULL` hash returns the generic error, and the login response for such an account carries `code: 'USE_GOOGLE_SIGNIN'` so the UI can say so.

**Google** — redirect code flow. `GET /api/v1/auth/google` → Google → `GET /api/v1/auth/google/callback` → `passport-google-oauth20` verifies, we upsert `oauth_identities` (linking by verified email if a password account exists with that address, else creating one with `password_hash NULL` and `email_verified_at = now()`) → set cookies → `302` to `https://starrytv.app/desk`. **Tokens never touch JS, a URL fragment, or a query param.** If GIS One-Tap is added later, `POST` the credential to `/auth/google/one-tap`, verify with `google-auth-library`'s `verifyIdToken({ idToken, audience: CLIENT_ID })`, and validate the `g_csrf_token` double-submit.

**Refresh rotation with reuse detection** — `POST /api/v1/auth/refresh`, inside `dataSource.transaction`:
1. sha256 the presented token, `SELECT … FOR UPDATE`.
2. Not found, expired, or `revoked_at IS NOT NULL` → 401.
3. **`rotated_at IS NOT NULL` → already used.** If `now() - rotated_at <= ROTATION_GRACE_MS` (30 s), this is a benign race: re-issue the cookies for the successor already recorded at `rotated_at` and return 200 **without** minting a second successor. Otherwise revoke every row in the `family_id` with `revoked_reason='REUSE_DETECTED'`, clear cookies, 401.
4. Otherwise set `rotated_at`, insert a successor in the **same family** with `parent_id`, issue new cookies.

The `uq_refresh_tokens_hash` unique constraint plus `FOR UPDATE` is what closes the concurrent-refresh race — the usual exploitable gap. Test: 10 parallel refreshes on one token must yield **exactly one** valid successor.

> **The 30-second grace window is not optional, and it is the step every from-scratch implementation omits.** `FOR UPDATE` serialises refreshes that are *in flight simultaneously*, but it does nothing for the commoner case: a full page navigation fires a refresh, the response lands after the document is torn down, and a request from the newly-loaded page presents the same token a few seconds later. Strict reuse-detection reads that as theft and force-logs-out a legitimate user, intermittently and unreproducibly. The sibling carries this fix at `auth.service.ts:313-322` with a comment recording that it was reverse-engineered from exactly that breakage. The security cost is bounded and small: a stolen token is replayable for at most 30 s, and only until the legitimate client's next refresh, which then trips detection for real.
>
> Test both halves: replay at t+5 s must return 200 and **not** create a second successor; replay at t+35 s must revoke the family and 401.

**Logout** — `POST /api/v1/auth/logout` revokes the family (`revoked_reason='LOGOUT'`) and clears all four cookies with matching `Domain` and `Path` attributes. The client then does a **hard navigation** (`window.location.assign('/')`), never `router.push` — otherwise in-memory state and the API-client latch survive.

**Sessions are per-device, and this is a deliberate reversal of the sibling.** `client-lms-zskillup-backend` calls `revokeAllForUser` on every successful login (`auth.service.ts:246` for password, `:793` for Google), which enforces strictly one live session per account — signing in on a phone silently logs you out on a laptop. That is defensible for a proctored assessment platform. It is actively wrong here: the core loop is *track pages on your phone, write the review on a laptop*, and single-device turns that into a login every time you switch. Each login therefore opens a **new family**; families are independent and are revoked individually on logout, together on reuse-detection or suspension.

The cost is that "log out everywhere" must be built rather than falling out of the design: `POST /api/v1/auth/sessions/revoke-all` (revokes every family for the caller) plus `GET /api/v1/auth/sessions` listing live families with their `user_agent`, `ip_prefix`, `created_at` and `last_used_at`. Populate `refresh_tokens.device_label` at issue time from a parsed User-Agent — the sibling declares a `deviceFingerprint` column and writes `null` to it everywhere (`refresh-token.repository.ts:26`), so the column is there with no data behind it. Ship the write in Phase 2 even though the session-list UI is Phase 5; the alternative is a backfill that cannot be backfilled. Both are also the mechanism a user needs after a password reset, which already revokes every family.

### Authorization

Deny-by-default. `JwtAuthGuard` is global; `@Public()` is the only opt-out (and still best-effort attaches `req.user` on public routes when a valid cookie is present, so the hub can render "your review" affordances). Identity always comes from the verified token principal via `@CurrentUser()`, **never from the request body**. `@Roles(UserRole.ADMIN)` at class level on every `admin-*.controller.ts`.

No `CapabilitiesGuard` — two roles do not earn it, and copying it would drag the sibling's `common/guards → modules/users` coupling into a clean repo. **The role-staleness window is therefore one access-token lifetime (15 min).** For the two operations where that is too long — suspend and role-demote — the service also revokes every refresh family for that user, so the session dies at the next refresh and cannot be renewed. This is stated plainly rather than papered over.

**IDOR is the real risk** under the no-relation-decorators convention: every per-user read is a hand-written QueryBuilder, so a single omitted `AND user_id = :me` is a full cross-user library leak with no ORM backstop. Two controls:

1. `common/repository/scoped.ts` exports `scopedToUser(qb, alias, userId)`. Every shelf/quote/review repository method takes `userId` as its **first** parameter.
2. **`test/authz.e2e-spec.ts`** — a declarative table of every route × `{anonymous, owner, other-user, admin}` with expected statuses. The suite enumerates routes from the generated Swagger document and **fails if a route exists in Swagger but not in the table**. That is the mechanism that catches a new endpoint shipped without an authz decision. Runs on every PR from Phase 3 onward.

### Next.js: route protection and SSR sessions

**`src/proxy.ts`** — renamed from `middleware.ts` in Next 16 and now on the Node runtime. Run `npx @next/codemod middleware-to-proxy`: **a leftover `middleware.ts` is silently ignored with no build error**, so route gating simply stops running with nothing to tell you.

It reads `st_role` only, does a prefix match against `PROTECTED_PREFIXES = ['/desk','/control']`, redirects unauthenticated hits to `/login?redirect=<pathname>`, and bounces role mismatches to their own home. It is **UX only, never a security boundary** — CVE-2025-29927 (CVSS 9.1) let attackers bypass Next middleware entirely with a spoofed `x-middleware-subrequest` header. The file carries that citation as a comment.

**`src/lib/session.ts`** — the Data Access Layer:

```ts
export const verifySession = cache(async (): Promise<SessionDto | null> => {
  const res = await fetch(`${API_ORIGIN}/api/v1/auth/me`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiRequestError(res);
  return (await res.json()).data;
});
```
Called in **every** Server Component and Server Action that needs identity. React `cache()` dedupes it within a render pass. NestJS remains the only authority. Return a DTO to Client Components, never a raw session.

**The sharp edge, stated:** Server Components **cannot set cookies**, so a token refreshed during SSR cannot be persisted. Therefore: SSR fetches **fail closed** — a 401 becomes `redirect('/login')`, never a silent refresh. Refresh happens only in the client API layer or a Route Handler. Because the access cookie lives 15 minutes and the client refreshes proactively, an SSR 401 is rare; when it happens, one redirect is the correct, safe outcome.

**Login rescue path** — arriving at `/login?redirect=…`, the page calls `restoreSessionFromRefreshCookie()` first, in case a live httpOnly session exists but `st_role` expired. Without it, a user whose hint cookie died before the 30-day refresh session gets stranded in a `/login ↔ /desk` loop that no in-memory latch can stop, because each cycle is a fresh JS bundle.

---

## 6. The phases

Nine phases. **The product is genuinely complete and worth using after Phase 5** — a platform where readers track books, write reviews, get them published to a beautiful hub that is also live television. Phases 6–8 are expansion. If momentum runs out, it should run out somewhere the product coheres.

Effort is given in **focused working days**, plus a calendar estimate at ~4 focused days/week.

---

### Phase 0 — Decisions, domain, and two spikes
**Goal:** answer the three questions that would be catastrophically expensive to answer late. No production code.
**Effort: 4 focused days / ~1.5 weeks calendar (mostly waiting).**

**Deliverables**
- Buy `starrytv.app`. Point apex + `www` at Vercel, `api.` at Railway. Verify HTTPS end to end with a valid cert **before any cookie is ever set**.
- **Legal consult (paid, budget $500–1,500)** with a US internet/IP lawyer. Four questions: (a) is a self-attested `RIGHTS_HOLDER` lane with warranty + indemnity defensible; (b) is a strictly private, unlisted, self-only `PRIVATE_LOCKER` acceptable; (c) ToS + DMCA + repeat-infringer policy language; (d) jurisdiction given an Indian operator and predominantly US/EU users. **Named fallback if the answer is unfavourable:** Phase 6 shrinks to *"the reader for public-domain works we mirror from Gutenberg ourselves, plus link-out via the Open Library Read API for everything else"* — about 40% of the phase and zero exposure.
- **Spike A (4 hours): does Mux HLS survive the CRT shader?** Prototype `hls.js` → MSE → `<video crossOrigin="anonymous">` → `drawImage` into the 640×480 compositor canvas → `gl.texImage2D`. The expectation is that it works, because hls.js fetches segments by CORS-validated XHR and appends to a `SourceBuffer`, which does not taint the way a direct cross-origin `src` does — but this is the least-examined claim in the whole plan and it sits in the last phase where discovering it is most expensive. **Test in Safari specifically.** Fallback if it taints: channel 14 renders the `<video>` as a DOM layer clipped to the bezel with the shader bypassed for that channel and a CSS scanline/vignette overlay; the OSD stays canvas-drawn above. Degraded but shippable, and **decided now**.
- **Spike B (3 hours): baseline the television.** Record `/tv` fps in Chrome, Safari and Firefox on the current Vite build, on the actual dev machine, with a repeatable procedure. Without this number, Phase 1's fps exit criterion is meaningless.
- Provision: Railway project (Postgres 16, Redis 7, Nest service), Cloudflare R2 buckets + custom domain, Resend Pro, Sentry, Axiom, Google OAuth client, Mux account **with a card on file** (the free plan caps at 10 stored assets).
- Write `docs/adr/0001`–`0008` and both `CLAUDE.md` files.

**Exit:** the domain resolves over HTTPS on both hosts; the legal answer is written down and the Phase 6 scope is fixed accordingly; the video-in-shader question has a yes-or-fallback answer in writing; a baseline fps number exists for three browsers.

---

### Phase 1 — The Port
**Goal:** be on Next.js 16 with no user-visible change, and cut the one weld that would otherwise force a four-phase divergence between the hub and the television.
**Effort: 9 focused days / ~2.5 weeks calendar. Hard stop at day 12.**

**Deliverables**
- Next 16 App Router scaffolded in the existing repo on `next-port`. Same Vercel project, same URL. React 19.2 and Zustand 5 unchanged.
- `app/(broadcast)/layout.tsx` (Server Component) → `StationShell`; `page.tsx` and `tv/page.tsx` both return `null` and carry their own `metadata` exports. `genre/[slug]`, `review/[slug]` scaffolded but still reading `books.data.ts`.
- `src/tv/StationShell.tsx` replaces `App.tsx`: three modes preserved, `usePathname()` drives them, `popstate` listener and `document.title` effect deleted, first-gesture audio unlock copied verbatim, `inert` preserved.
- `src/tv/TvSet.tsx` — the sole `dynamic(() => import('./TvMode'), { ssr: false })` boundary, itself `'use client'`.
- `'use client'` at line 1 of every module in `src/tv/**` and `SoundToggle.tsx`.
- **The manifest cut.** `src/content/build-manifest.ts` (pure), emitting `public/schedule/current.json` at build time. `src/tv/schedule-manifest.ts` with the three-tier fallback. `store.ts` holds `channels` + `loadManifest()`; `channelByNum` becomes a store helper. **Exactly 7 files change** (`StationShell`, `store.ts`, `TvMode`, `Guide`, `CrtScreen`, `useRemoteControl`, `BoringEdition`) — verified, and none is in `src/tv/engine/`.
- `store.ts:98-100` gets its missing `typeof window` guard and a comment explaining that it deliberately bypasses the Next router.
- `tv.css` hoisted into `app/layout.tsx`. Trimmed client search index for the hub island.
- `sitemap.ts`, `robots.ts`, per-route `metadata`, rewritten `<noscript>`.
- Deleted: `main.tsx`, `index.html`, `vite.config.ts`, `vercel.json`, `public/_redirects`, `env.ts:16 saveData()`. tsconfig cleaned. oxlint kept, plus the restricted-import rule.
- CI: `next build`, oxlint, and the `engine/` zero-diff check.

**Exit criteria**
1. `git diff --numstat <base> -- src/tv/engine/` shows changes only on the `'use client'` lines.
2. `/tv` holds **≥95% of the Phase 0 baseline fps at no lower quality multiplier**, per engine, with the WebGL shader active (`Crt.ok === true`), the floor mirror painting, and audio unlocked on first gesture. Concretely: **Chrome ≥56 @ 1.00, Firefox ≥38 @ 0.62, WebKit ≥28 @ 0.62** (`docs/reference/tv-baseline.md`).

   > Revised after Spike B actually ran. The original criterion was "≥55 fps in Chrome, Safari and Firefox" — **which the current build does not meet**: Firefox medians ~40 fps and WebKit ~30 fps, both already shedding to quality 0.62, before a line has been ported. Keeping it would have blocked the port on a pre-existing condition, or been waived, which is worse because then nothing checks. Raising Firefox and Safari is real work with real value; it is not the port's job, and folding it in turns a 9-day phase into a 20-day one.
3. `curl -s https://<preview>/ | grep -c '<article class="book"'` returns **100** with JS disabled.
4. Navigating `/` → `/tv` → `/` does **not** remount `BoringEdition` — asserted by a mount counter in a Playwright test, not by eye.
5. `books.data.ts` and `programmes.data.ts` appear in **zero** client chunks (bundle-analyzer output attached to the PR).
6. `?ch=07` boots the set on channel 7; channel changes still rewrite the query string; the guide, keypad, handset and front panel all still funnel through `press()`.
7. Forcing WebGL failure still yields a picture via the 2D composite; `prefers-reduced-motion` still kills static/ident/warp; the rAF loop still stops on `visibilitychange`.
8. Blocking `/schedule/current.json` at the network level: the set still boots from `localStorage`; blocking that too, it still boots from `minimal.json`.
9. Zero hydration warnings on `/` and `/tv`. Lighthouse SEO ≥ 95 on `/`.
10. Deployed to the live URL, replacing the SPA.

---

### Phase 2 — Backend and the front door
**Goal:** the NestJS service exists and you can have an account. A logged-out visitor's experience is byte-identical to Phase 1.
**Effort: 14 focused days / ~3.5 weeks.**

**Deliverables**
- `starrytv-backend` scaffolded per §2, with the **do-not-copy checklist** signed off.
- `APP_*` chain, `DomainError` hierarchy used consistently, `RequestIdMiddleware`, real `CORS_ORIGIN` allowlist, `PageQueryDto` + `paginated()`, `Clock`, Swagger at `/api`, `/health` and `/ready` public and unprefixed with readiness gated on `dataSource.showMigrations()`.
- Migrations `1000000000000-CreateSchemas` (7 schemas + `uuid-ossp` + `citext` + `pg_trgm`), then `identity.*` and `system.*`.
- `auth` module: register, verify, login, logout, refresh with family revoke-on-reuse in a transaction, forgot/reset (single-use, hashed, short-TTL, enumeration-safe identical responses), Google redirect code flow. `cookies.ts` as the single place `Set-Cookie` is built. `@Throttle` at 5–15/min on every auth route.
- `CsrfGuard` + `st_csrf` double-submit.
- Frontend `(account)` route group with `AuthShell` in the StarryTV register; react-hook-form with rules restating the shared DTOs; every `useSearchParams` page split into an inner component wrapped in `<Suspense>`; the login rescue path.
- `src/proxy.ts`; `lib/session.ts` `verifySession()`; `lib/api/client.ts` per §5.
- Railway deploy with `${{ github.sha }}` tags and `migration:run` as a **gated CI job** before the service update. Resend Pro wired.
- CI: `openapi-typescript` → `schema.d.ts`; `src/shared/` drift check.

**Exit:** signup → verify → login → silent refresh → logout works end to end on production, in Safari, Firefox and Chrome, **with no `SameSite=None` cookie anywhere** (checked in devtools). Same again via Google, with no token in any URL. An integration test proves replaying a rotated refresh token revokes the whole family; a second proves 10 parallel refreshes yield exactly one successor. Killing the backend for 30 s does **not** log anyone out. `curl -i` shows a real UUID `requestId` in both success and error envelopes. CORS rejects an unlisted origin. A deliberately broken migration fails CI and blocks the deploy. `/ready` fails while a migration is pending. `/` and `/tv` are unchanged for logged-out visitors.

---

### Phase 3 — The Logbook
**Goal:** a private reading tracker good enough to use alone, with the hub switched off. Nothing here is public, so there is no moderation surface and no legal exposure.
**Effort: 16 focused days / ~4 weeks.**

**Deliverables**
- `library.*` and `shelf.*` migrations. **Seed the 100 curated books and 20 genres** from `books.data.ts` as the canonical editorial catalogue with `is_house=true` — this is what stops the hub from ever looking empty in Phase 4.
- Book lookup: `POST /api/v1/books/lookup`. Open Library `search.json?title=…&fields=key,title,author_name,first_publish_year,number_of_pages_median,isbn,cover_i&limit=5` with a `User-Agent` carrying app name + contact email (3 req/s instead of 1). Google Books fallback **only** when OL returns nothing, or `number_of_pages_median` is null, or `cover_i` is null. Merged record written to `library.books` and never looked up again. Covers fetched by `cover_i` from `/b/id/{cover_i}-L.jpg` — **never** `/b/isbn/`, which throttles at 100 req/IP/5min — and copied straight to R2.
- `(desk)` route group: `/desk` (currently reading + stats strip), `/desk/shelf`, `/desk/book/[entryId]`, `/desk/quotes`, `/desk/import`.
- Status control (`want / reading / paused / read / DNF`), integer page progress, quarter-star ratings, mood + pace, `started_on`/`finished_on`, `abandoned_reason` on DNF, private notes, quotes with page + chapter + optional page photo, user tags separate from status.
- **One-tap reading stopwatch** on the currently-reading card → `reading_sessions` → pages/hour and "about 3h 20m left". The real market gap: StoryGraph logs sessions but ships no timer, so heavy readers run two apps.
- **Goodreads CSV import** with a per-row reconciliation report. Their API died in Dec 2020 and issued keys were revoked, but the export still works and is the standard migration path off it.
- **The primitives kit** — `Button`, `FormField`, `DataTable`, `Pagination`, `ConfirmDialog`, `Drawer`, `DebouncedSearchInput` (300 ms), `EmptyState`, `StatusMark`, `PageRule`, `Toaster` (root layout), `SpoilerBar`. Built **here**, not in the admin phase, so Phase 5 is assembly rather than construction. In the Boring Edition register: mono 13 px, `border-radius: 0`, no shadow, `.book` article shape, progress as *"page 143 of 512"* with a hairline rule — never a rounded bar.
- Print stylesheet extended to shelves (`boring.css:304-310` already hides sidebar and links).
- `test/authz.e2e-spec.ts` goes live and gates every PR from here on.

**Exit:** a user takes a book from *on the pile* → *reading, page 143* → *read* with real dates, records three quotes with page numbers, DNFs another with a reason, then starts a **second** read of the first book and both attempts persist as separate `read_entries` rows. A 500-row Goodreads CSV imports with every row either matched or listed for manual resolution — no partial-state corruption. A session recorded via the timer produces a pages/hour figure. Every `/desk` route and every shelf endpoint returns 401/403 to an anonymous caller and to a second account — asserted by the authz matrix, not by the UI hiding links. The hub and `/tv` are unchanged.

---

### Phase 4 — The Composer, the Queue, the Hub — and the air
**Goal:** the pivot. A user writes a review, an admin approves it, it appears on the hub — **and on television**, because the manifest source swaps with no TV changes.
**Effort: 18 focused days / ~4.5 weeks.**

**Deliverables**
- `ugc.*` and `broadcast.*` migrations.
- **`ReviewTransitionService.transition()`** as the only writer of `status`: const transition map in TS, `review_actions` row, status update, cache + manifest invalidation, all in one transaction. Trigger backstop with the `bypass_status_guard` escape hatch.
- **The composer.** Two fields that matter: the *broadcast cut* (hook ≤14 words, body in the configured window, underdog one sentence — live counters, all validated in `src/shared/style/` so the browser is provably never the only enforcer) and the optional *long body*, unbounded. Attestation checkboxes mirroring the library's own rules (`books.data.ts:9-15`): the book is real and verified; not a #1 bestseller or prize-winner everyone owns; no famous film adaptation.
- **The house-style linter** — flags *"a haunting meditation on"*, adjective stacks, exclamation marks, second-person marketing register, "must-read". **Advisory to the author, a sort weight on the queue, never a block.** It teaches the voice instead of policing it.
- Attached quotes and images via `review_quotes` / `review_images`; spoiler ranges rendered as **blacked-out bars you tap to reveal** (StoryGraph's rendering, which preserves the reading flow) rather than a `(view spoiler)` link; self-applied content warnings.
- **Admin review queue as a single-item focus view**, not a table: `j`/`k` navigate, `a` approve, `r` reject (opens the reason picker), `e` request changes, `space` select, `⌘+Enter` resolve, `?` for help. Rendered beside a diff against the live revision. Clustered by author / `content_hash` / signal label; **bulk actions only within a cluster of clear-cut items**.
- **Admin edit-in-place before publish** — tighten the copy the way an editor does. Creates a new revision; the byline stays the author's; `edited_by_admin` is shown.
- Rejection payloads structured as **DSA-style statements of reasons** (action, `reason_code`, free text, automated yes/no, appeal path), surfaced **verbatim**. `CHANGES_REQUESTED` returns to draft with a threaded comment; `REJECTED` is terminal but appealable, and an appeal is just another `review_actions` row.
- OpenAI `omni-moderation-latest` (free) on submit via BullMQ → `moderation_signals` → queue sort. `author_trust` levels from day one, with level 2 bypassing the queue entirely — **the only lever that keeps admin load flat as volume grows.**
- Edit-after-publish: becomes a pending revision; auto-approve only whitelisted-field, below-threshold diffs that add **no new links, media or mentions** (that clause is the actual spam vector), and only at trust ≥ 2.
- Hub rewritten as a Server Component over `idx_reviews_hub`, layered over the seeded house catalogue. `/review/[slug]` with `article` JSON-LD, canonical URLs, `opengraph-image.tsx`, sitemap and RSS. Cache tags `hub`, `genre:{slug}`, `review:{id}`, revalidated only from the transition service, with a pre-warm fetch.
- **The manifest source swaps.** `manifest-builder.service.ts` rebuilds channel 10 from published reviews using the same `splitForScreen` / `interleave(5)` / duration logic; a BullMQ repeatable job publishes a new `schedule_revision` on the hour; `GET /api/v1/broadcast/schedule/current` with a strong ETag. **The frontend changes one URL.**
- **Publish-notification mail:** *"You are on channel 13 at 21:40 tonight."* A slot on a station is a materially better reward than a badge, and it costs one template.
- Public profiles at `/by/{handle}` — private by default, opt-in per shelf entry. Byline renders as *"— K. Rao, Bombay"*.
- Author-facing status UI showing draft / submitted / in review / changes requested / published, with the rejection reason verbatim.

**Exit:** a user publishes; the admin sees it in the queue within 5 s; approving puts it on the hub within one revalidation and **on channel 10 at the next hourly revision**, verified by diffing consecutive manifests. Two browsers on two machines, same channel, show the **same programme at the same wall-clock second**. A curl bypassing the UI cannot submit outside the configured word window or with a 15-word hook. Editing a published review does not change what a logged-out visitor sees until the pending revision is approved. Every state change has a `review_actions` row with actor and reason. A raw `UPDATE reviews SET status=…` is rejected by the trigger, **and** the same `UPDATE` succeeds after `SET LOCAL starrytv.bypass_status_guard='on'`. The hub renders fully in server HTML with JS disabled; Lighthouse SEO ≥ 95 on hub and review pages; a query-count assertion on the hub endpoint passes at 50 reviews.

---

### Phase 5 — The Control Room
**Goal:** the complete administrative surface the spec asks for. Every user, every shelf, every to-read list, every post; add or remove anything on the hub; manage genres; configure the station without a deploy.
**Effort: 12 focused days / ~3 weeks.**

*Moved from phase 7 to phase 5. The user's spec makes admin approval and full admin control the mechanism the whole platform turns on; it cannot sit behind optional scope.*

**Deliverables**
- `(control)` route group. Every page assembled from the Phase 3 primitives — **zero `window.confirm`, one `<DataTable>`, one `<Pagination>`, debounced search everywhere.**
- R2 wired: `POST /api/v1/uploads/sign` (validate MIME/size/entitlement, generate `books/{uuid}/{slug}.ext`, presign a PUT via `@aws-sdk/client-s3` + `s3-request-presigner`) → client PUTs **directly to R2**, never proxied → `POST /api/v1/uploads/complete` → `HeadObject` verifies size and type **before** the row is inserted. R2 CORS set programmatically via `PutBucketCORS` with `AllowedHeaders: ['content-type']`, not `*` — signing extra headers on a browser PUT is the usual cause of opaque 403s.
- Covers and book images served through the R2 custom domain with Cloudflare Image Transformations.
- **Draft-invisible read twins from day one:** every public catalogue read filters on published state, so each admin read gets an explicit unfiltered pair (`findBySlug` / `findBySlugAny`). The sibling discovered this late and had to retrofit it.
- Users: list with debounced server-side search + role/status filters; detail drawer showing shelves, currently-reading with page numbers, to-read, sessions, quotes, reviews across every state, trust level and strikes; suspend / restore / ban / role change / force-logout (revoke all families) / export.
- Hub composition: feature, pin, reorder, and **three reversible removal tiers** — `unpublished` (hidden, live revision intact), `archived` (out of listings, still addressable), `deleted_at` (invisible, restorable) — each with a reason. Hard purge only via a scheduled retention job. **No admin action is ever unrecoverable.**
- Genre CRUD writing `library.genres` — slug, name, blurb, sort order, `channel_colour`, `channel_number` — feeding **both** the hub navigation **and** the TV channel colour/blurb that currently live in the hardcoded maps at `channels.ts:13-41`.
- Channel administration: create, reorder, recolour, deactivate; preview a manifest revision; trigger an on-demand publish.
- `system.settings` editor for the configurable numbers, with `is_public` keys exposed at `GET /api/v1/settings/public` so the composer's counter and the server validator move together.
- Reports inbox over `ugc.reports`.
- Platform stats: submissions/week, approval rate, rejection-reason breakdown, **median time-to-decision** (the leading indicator for moderation load), queue depth.
- Every admin mutation writes `system.audit_logs`, browsable in the console.

**Exit:** an admin creates a genre and it appears in hub nav, in the composer's picker, and as a tinted section in the TV guide **without a redeploy**. Changing `review.body_word_max` changes the composer counter and the server validator simultaneously. The admin opens any user and sees their complete library, including notes flagged as private. Removing an item at each of the three tiers works and restores. Suspending a user kills their session within one access-token lifetime. Fifty queued reviews are processed in under ten minutes using only the keyboard. Every mutating admin endpoint has a corresponding audit row — asserted by a test that enumerates the routes. A contract test per admin PATCH proves every UI-editable field round-trips (`forbidNonWhitelisted` turns a missed DTO field into a 400, not a silent strip). A non-admin hitting any `/api/v1/admin/*` route gets 403 in the authz matrix.

> **The product is complete here.** If you stop, you have shipped a reading platform with a curated, publicly-indexed hub that is also live television. Everything below is expansion.

---

### Phase 6 — Reading in the browser
**Goal:** in-browser reading, lawfully. Scope was fixed in Phase 0; this phase executes whichever version that answer produced.
**Effort: 13 focused days full scope / 6 days on the fallback scope. ~3 weeks.**

**Compliance ships before the upload endpoint is enabled in production. This is an ordering gate, not a preference.**
DMCA designated agent registered with the U.S. Copyright Office ($6, online only); agent details and takedown page published and linked from the footer; in-app report-infringement flow live; counter-notice with the 10–14 business day restore window; every notice logged in `media.takedown_notices`; three-strikes repeat-infringer termination **enforced in code** via `identity.infringement_strikes`, with strikes that expire.

**Deliverables**
- `media.book_files` with `rights_lane` as a hard gate and the `ck_book_files_public_lane` CHECK. Three public lanes only: **PUBLIC_DOMAIN** (auto-verified against Gutenberg / Standard Ebooks IDs, or an admin publication-date check), **RIGHTS_HOLDER** (signed ownership warranty + indemnity with `warranty_accepted_at` and `warranty_ip` captured, admin-reviewed pre-publish), **OPEN_LICENSED** (licence recorded). Plus **PRIVATE_LOCKER**: self-only, unlisted, unsearchable, no public URL, per-user quota — it exists to power page tracking for a book the user already owns.
- **"Read now" for everything else is a link-out, not a re-host** — Open Library Read API resolves ISBN → Internet Archive borrow link; Project Gutenberg for public domain. A working read button with zero liability.
- `/read/[bookSlug]` on `react-pdf`: `getDocument` with `disableAutoFetch: true, disableRange: false, disableStream: false` so pdf.js byte-range-fetches only visible pages; `react-window` virtualisation with a ±2 page render window (pdf.js recommends never rendering more than 25 pages at once); `devicePixelRatio` capped at 2 and off-window canvases destroyed (canvas memory is the binding constraint on iOS Safari); text layer rendered only on the active page; `PDFFindController` + `EventBus` for in-document search.
- Page tracking: `IntersectionObserver` at threshold 0.5, topmost 50%-visible page wins, debounced 2 s, `PATCH`ed to Nest, flushed on `visibilitychange` via `navigator.sendBeacon` into `media.pdf_reading_progress` **and** `shelf.reading_progress` with `source='PDF_READER'`.
- Serving: 120–300 s presigned GETs after an entitlement check, with a **re-sign-on-403 reload path** because pdf.js hard-fails when a URL expires mid-read. Per-user range-request rate limits and sequential-full-scan anomaly detection. Per-user watermarking via `pdf-lib` on first access, derived object cached. **No right-click blocking — it is theatre.** ADR-0006 records honestly that bulk download cannot be prevented: anything the browser renders can be reassembled.
- `has_text_layer` detected at ingest; scanned PDFs flagged unsearchable rather than silently failing.
- **Selecting text in the reader creates a `shelf.quotes` row with the page number already filled in.** The reader and the logbook are one object.

**Exit:** the DMCA agent is registered and the takedown page is live **before** the upload endpoint is enabled. A 200 MB public-domain scan opens and renders page 400 in under 3 s cold, and scrolls on mobile Safari without an OOM crash, with byte-range requests visible in the network tab. Reading position survives a reload, a hard tab close (sendBeacon verified) and a device switch. A presigned URL expiring mid-read triggers a silent re-sign and the reader does not break. A PRIVATE_LOCKER file 404s for every other user including an admin's normal read path. `UPDATE … SET visibility='PUBLIC'` on a PRIVATE_LOCKER row is rejected by the constraint **and** separately by the service — one test each. A submitted report unpublishes a file in one admin action and records a strike; three live strikes terminate the account. No in-copyright commercial title exists in a public lane in production.

---

### Phase 7 — The dial fills out
**Goal:** the television stops being a channel about the library and becomes a channel about the platform.
**Effort: 9 focused days / ~2.5 weeks.**

**Deliverables**
- **Channel 13 — THE POST.** Newest published reviews in publication order, reviewer handle and city in the subheading. The user-content channel, and the reason to publish.
- **Channel 12 — READING ROOM.** Aggregate, anonymised platform reading state read out in the house register: *"Fourteen people are somewhere inside The Other Side. One of them has been on page 61 since March."* Built from `idx_shelf_entries_reading`, **baked into the manifest** (never queried live per viewer, or determinism dies), **k-anonymity ≥ 3** from `system.settings`, per-user opt-out, no user ever named. No competitor has a reading tracker that is also television.
- Channel colours and blurbs read from `library.genres` (admin-set in Phase 5) rather than the hardcoded maps, feeding `--screen-light` on the cabinet exactly as today.
- **Year-in-review and monthly wrap-up rendered as a CRT sign-off card** via `ImageResponse` — one renderer, both cadences. It is the only screen users voluntarily post publicly, so it is the growth loop, and here it is on-brand rather than a Spotify pastiche.
- Public `/guide` page: the schedule as a real, crawlable TV listing. RSS feed of new reviews.
- **`/rejected` — "Rejected, and why."** Anonymised rejection reasons with counts, published openly, from the DSA-shaped data already stored. Sets the bar visibly before people write and directly reduces the moderation load that is the binding constraint on a solo operator.
- "Seen on channel 10" cross-link on every published review, and a TV button that opens the CRT tuned to that programme.
- Kindle `My Clippings.txt` import.
- Ops hardening folded in here rather than a phase of its own: Sentry release tracking + source maps, Axiom logs keyed by `requestId`, uptime checks on `/ready` only (Redis is informational and must never gate readiness), a **performed** backup-restore drill against a scratch database with the elapsed time written into the runbook, and a **performed** production rollback to a previous image SHA.

**Exit:** publishing a review puts it on channels 10 and 13 at the next hourly revision. The manifest is ≤ 150 KB gzipped at 500 reviews — the tripwire that, when it trips, turns channel 10 into a windowed rolling slice (which is also more true to how a real station schedules). READING ROOM never renders a line derived from fewer than three readers and never names a user. A year-in-review card unfurls correctly as an OG preview on two social platforms. The restore drill and the rollback are both in the runbook with real timings.

---

### Phase 8 — Channel 14, MATINEE
**Goal:** 5–10 minute video book reviews, on television. The groundwork already exists: `types.ts:56-68` defines `Programme.media` with `reelOffsetSec` as an explicit escape hatch, `engine/video.ts` implements the one-reel seek, and the git log shows channel 14 was built and pulled.
**Effort: 12 focused days / ~3 weeks.**

**Deliverables**
- Mux on quality tier **`basic`** explicitly — $0 encoding at every resolution; Plus/Premium would add ~$19–28/mo for zero benefit on talking-head reviews.
- `MuxUploader` (tus-based, resumable) with **`passthrough` set to our own `media.video_assets` UUID** — the cheapest insurance in the integration, making every webhook self-correlating even if the upload id is lost.
- Webhook controller: verify signature with the Mux SDK → `INSERT … ON CONFLICT DO NOTHING RETURNING` → enqueue a BullMQ job only on the won insert → 200 immediately. **Transition in the worker, never in the request.**
- `status_rank` monotonic guard on every transition.
- **Reconciliation cron** polling Mux for anything stuck in PROCESSING beyond 30 minutes. Webhooks are dropped in practice; without this a lost event strands a user's video forever with no recovery path.
- Signed playback policy. `GET /api/v1/videos/:id/playback-token` runs authz then mints **three** short-lived RS256 JWTs in one response — Mux requires separate audiences for playback (`v`), thumbnail (`t`) and storyboard (`s`).
- `@mux/mux-player-react` behind our own `<VideoPlayer>` (`dynamic`, `ssr:false`) so a swap to Bunny or raw hls.js touches one file.
- On the TV: the HLS stream through the compositor per the **Phase 0 spike result** — shader path if the spike passed, clipped DOM layer with CSS scanlines if it did not. Channel bed ducked underneath; channel change as a seek, not a load.
- Moderation reuses the Phase 4 focus view. 100 videos/month is 3–4 a day and entirely tractable. Mux auto-captions piped through OpenAI's free moderation endpoint to **rank** the queue. Hive rejected: $0.13/min ≈ $97/mo, more than the whole video bill.
- **Delivered-minutes metric with an alert at 80,000 min/mo** — that alert, not a vague sense of scale, is the trigger to evaluate Bunny Stream, because 100,000 free minutes (~20k views at 5 min) is exactly where Mux's economics invert.

**Exit:** a 9-minute video uploads from a phone over a flaky connection, resumes after interruption, reaches READY, is approved, and plays behind a signed token in Safari on iOS and Chrome on desktop. Delivering `video.asset.ready` **before** `video.upload.asset_created` leaves the asset READY, not PROCESSING — integration test. Replaying an identical webhook twice produces exactly one `video_webhook_events` row and one transition. Killing the webhook endpoint during processing and relying only on the cron still lands the asset READY within 35 minutes. A PENDING_REVIEW video is unplayable even with a leaked `playback_id`. Channel 14 plays real user footage with captions on. The 80k alert fires against a synthetic value. Monthly Mux spend under $30.

---

### Totals

| | focused days | calendar |
|---|---|---|
| Phase 0 | 4 | 1.5 wk |
| Phase 1 | 9 | 2.5 wk |
| Phase 2 | 14 | 3.5 wk |
| Phase 3 | 16 | 4 wk |
| Phase 4 | 18 | 4.5 wk |
| Phase 5 | 12 | 3 wk |
| **Shippable product** | **73** | **~19 weeks** |
| Phase 6 | 13 (6 on fallback scope) | 3 wk |
| Phase 7 | 9 | 2.5 wk |
| Phase 8 | 12 | 3 wk |
| **Full scope** | **107** | **~28 weeks** |

At 4 focused days/week that is **~5 months to a complete product, ~7 months to everything.** This is a first project at this scale; treat those numbers as optimistic by 30% and be pleasantly surprised.

---

## 7. Open decisions for the user

**1. Domain and hosting region.**
*Recommendation: buy `starrytv.app` (~$14/yr). Frontend on Vercel at the apex, backend on Railway **Singapore** at `api.starrytv.app`.* The shared eTLD+1 is what makes cookies first-party and removes the entire Safari/Firefox third-party-cookie risk class — it is a Phase 0 blocker, not a nicety. Singapore is Railway's closest region to India (~50 ms) and acceptable globally; Vercel serves the frontend from the edge regardless. **Only you know where your readers will actually be.** If early analytics show India-dominant traffic and the API feels slow, the app is containerised and the sibling's AWS ap-south-1 playbook already exists — that is a redeploy, not a rewrite. Decide by end of Phase 7.

**2. The copyright stance on PDFs — the highest-stakes question in the product.**
*Recommendation: fund the Phase 0 legal consult ($500–1,500) and ship only the three verified lanes plus a strictly private locker.* The feature as literally specced — users upload PDFs of the books they are reading, published so hub visitors can read them — is a shadow library. DMCA §512(c) safe harbour is defeasible on red-flag knowledge (the titles will be recognisable), on direct financial benefit coupled with the right and ability to control, and on failure to enforce a repeat-infringer policy; *Hachette v. Internet Archive* (2d Cir., Sept 2024, affirmed on all four fair-use factors, appeal abandoned Dec 2024) removed controlled digital lending as a fallback theory. The three-lanes design delivers most of the intent lawfully. **If you want to skip the legal spend, take the fallback now:** metadata + link-out only, Phase 6 halves, and exposure is zero. *This is research, not legal advice.*

**3. Does the hub enforce a house format?**
*Recommendation: yes, as designed — broadcast cut format-enforced (hook ≤14 words, body 45–70, underdog one sentence), long body unbounded, window configurable in one setting.* Your own `types.ts` already declares these as the *type* of the content, and the existing 100 reviews obey them without exception. A bare textarea is how this becomes a Goodreads clone with better CSS. But the constraint is genuinely opinionated and you may hate it in practice — which is why it is a `system.settings` value you can widen to 0–100,000 words in one click, and why `long_body` means nobody is ever told their writing is too long.

**4. Public profiles: opt-in or opt-out?**
*Recommendation: private by default, opt-in per shelf entry, with published reviews always public (that is what publishing means).* Reading history is unusually personal data and a tracker that leaks it by default is one bad press cycle from dead. The cost is a slower social graph. Say so in the signup copy.

**5. Budget.**
*Recommendation: accept ~$95/month at launch, ~$115/month once video is live, plus a one-off ~$500–1,500 for counsel and $6 for the DMCA agent.* Breakdown: Railway ~$45–60 (Nest + Postgres + Redis), Vercel Pro $20, Resend Pro $20, R2 ~$1–3, Mux ~$2 rising to ~$20 by month 12, Sentry + Axiom $0. **The two costs you should not economise on** are Resend Pro (the free tier's real limit is 100/day, and the failure mode is users who never receive a verification link) and Railway Redis over Upstash pay-as-you-go (BullMQ polls Redis when idle and Upstash's own docs warn about it).

---

## 8. Risks and mitigations

**The CRT does not survive the port, or survives visibly degraded.** WebGL failure falls back to the 2D composite *by design* (`CrtScreen.tsx:50-58`), which means a broken shader path looks like a slightly flatter picture, not an error — the worst possible failure signature.
*Mitigation:* the quarantine rule with a mechanical `git diff --numstat` gate on `src/tv/engine/`; an explicit `Crt.ok === true` check; the Phase-0 fps baseline compared in three browsers; and a real abort at day 12 (ship with `ssr:false`, no optimisation, same origin — the Vite build stays in git and Vercel can roll back).

**The never-unmount invariant breaks silently.** The site still works; scroll position is lost, screen readers double-announce, and the thing the author documented as central is gone. Nothing automated catches it unless something is written to.
*Mitigation:* the Playwright mount-counter test in the Phase 1 exit criteria, plus a comment on `(broadcast)/page.tsx` — in the codebase's existing house style of naming the bug the code prevents — explaining why it returns `null` and must not be "tidied up" into a real page.

**Voice dilution — the slow, quiet failure.** No single review destroys the register; two hundred mediocre ones do, and by the time it is obvious the corpus is unfixable.
*Mitigation:* format enforced structurally (counters, hook cap, underdog validator, attestations) rather than by an admin rewriting mush at 2am; the house-style linter as a teaching aid and queue-sort weight; admin edit-in-place before publish; the house 100 permanently pinned as the tonal reference; and a **monthly** blind re-read of a random published sample against the `books.data.ts:3-21` rules — as an editorial ritual, deliberately *not* a phase gate, because "indistinguishable in register" is unfalsifiable and cannot gate a release.

**Moderation load outruns one person.** Comfortable at 3–4/day, a second job at 50/day, and the transition is abrupt.
*Mitigation:* `ugc.author_trust` from Phase 4 rather than as a later optimisation — level 2 bypasses the queue entirely and it is the only lever that keeps effort flat as volume grows; keyboard-only focus view; `content_hash` clustering with bulk actions confined to clear-cut clusters; free OpenAI moderation as a sort weight (**never** an auto-reject — AI-text detectors run ~11% false positives on human writing with documented bias against non-native English writers, which is directly hostile to a library full of translations); the public `/rejected` page setting the bar before people write. **Watch median time-to-decision** in the Phase 5 stats as the leading indicator.

**Copyright.** The largest existential risk, and it is not an engineering risk.
*Mitigation:* Phase 0 counsel with a named fallback scope; `rights_lane` as a `CHECK`-enforced hard gate, not a service comment; the compliance baseline shipped as an **ordering gate before** the upload endpoint is enabled; link-out via the Open Library Read API for everything else; 300-word quote cap enforced in DB and editor.

**Broadcast determinism is easy to break.** The moment anything makes the manifest per-viewer — a personalised channel, an A/B test, a live-injected review — the property the whole project is built on is gone.
*Mitigation:* determinism is stated as a design constraint in ADR-0007; manifests are numbered revisions with whole-hour `effective_at`; READING ROOM (the most likely violator) is baked into the manifest, never queried live; and the two-machines-same-second check is a Phase 4 exit criterion.

**IDOR through hand-written QueryBuilder.** With no relation decorators, one omitted `AND user_id = :me` is a full cross-user library leak with no ORM backstop — and Phase 5 deliberately adds *unscoped twins* (`findBySlugAny`) of every scoped read.
*Mitigation:* `scopedToUser()` convention with `userId` as the first parameter of every per-user repository method; the authz matrix suite live from Phase 3 and failing on any Swagger route missing from the table.

**Copying the sibling's defects along with its strengths.**
*Mitigation:* the explicit do-not-copy table in §2, signed off as a Phase 2 checklist item, and a committed in-repo `CLAUDE.md` + `docs/adr/` so citations resolve. (The sibling's `CLAUDE.md` is gitignored, points at an external `zskillup-brain` repo, and has drifted so far that its DESIGN LAW section describes a palette, font stack, shadow policy and component set that no longer exist. Read its code, never its docs.)

**Mux webhooks arrive out of order and sometimes not at all.**
*Mitigation:* `status_rank` monotonic guard, `passthrough` carrying our own UUID, the reconciliation cron — and integration tests that deliver events in reverse order and that drop the webhook entirely.

**Solo-founder operational surface.** Vercel, Railway, R2, Mux, Resend, Sentry, Axiom, Postgres, Redis — nine things that can page you and one person to answer.
*Mitigation:* uptime checks on `/ready` only, with Redis informational and never gating readiness; a written runbook covering rollback (possible because images are SHA-tagged), migration failure and provider outage; and a backup restore drill **actually performed** in Phase 7, with the elapsed time recorded.

**Scope creep into Phases 6–8.** PDF reading, extra channels and video are each genuinely optional.
*Mitigation:* stated plainly — **the product is complete after Phase 5.** If Phases 0–5 run long, ship them and stop.

---

## 9. Features worth adding that the user didn't ask for

Ranked by value per day of effort. Items 1–8 are in the plan above; items 9–14 are candidates.

| # | Feature | Effort | Why |
|---|---|---|---|
| 1 | **`started_on` / `finished_on` on every read** | 0 d (schema) | The single highest value-per-effort field in the product and the only one that genuinely cannot be backfilled. Streaks, pace, "books read this month" and year-in-review are all impossible without it. Already in Phase 3. |
| 2 | **Reads as rows, not a status column** | 0 d (schema) | Enables re-reads. Goodreads' inability to represent one is its most-complained-about structural flaw, and this costs nothing on day one versus a painful migration later. |
| 3 | **Channel 12 — READING ROOM** | 3 d | The reading tracker rendered as broadcast, k-anonymised. No competitor has a reading tracker that is also television. This is the feature that makes StarryTV unmistakable, and it is nearly free once `broadcast` and `shelf` both exist. Phase 7. |
| 4 | **The broadcast slot as the reward** | 0.5 d | Publishing produces a scheduled slot and an email reading *"You are on channel 13 at 21:40 tonight"*, not a toast. One template, and it is the most on-brand retention mechanic available. Phase 4. |
| 5 | **Goodreads CSV import** | 1 d | Their API died Dec 2020 and keys were revoked, but the export still works and is the standard migration path for every disgruntled user. The single biggest adoption unlock available. Phase 3. |
| 6 | **Year-in-review as a CRT sign-off card** | 2 d | Every tracker ships a wrapped; only this one can render it as a test card. The only screen users voluntarily post publicly — the entire growth loop. One renderer, both cadences. Phase 7. |
| 7 | **One-tap reading stopwatch** | 1 d | Real market gap: StoryGraph logs sessions but ships no timer, so heavy readers run two apps. Feeds pages/hour, the time-remaining estimate, and READING ROOM. Phase 3. |
| 8 | **Public "Rejected, and why" page** | 1 d | Anonymised reason counts from the DSA-shaped data already stored. Sets the bar visibly before people write, reduces the rejection sting, and directly cuts the moderation load that is the binding constraint. Phase 7. |
| 9 | **OCR quote capture from a page photo** | 2 d | The spec already asks for both quotes and images; fusing them — photograph a page, get the text with the page number attached — is the standout feature of the tracker, and OCR is a commodity API call now. `shelf.quotes.source` already has the `'OCR'` value. Add to Phase 3 or 7. |
| 10 | **Mood + pace filters on the hub** | 2 d | An enum plus a filter UI. StoryGraph's actual moat. Answers *"what do I want to read tonight"* in a way genre never does. Data is captured from Phase 3; the hub filter is Phase 7. |
| 11 | **Kindle `My Clippings.txt` import** | 1 d | A trivial parser, beloved by heavy readers, and one that Literal has only ever listed as "planned" — so shipping it is a genuine differentiator rather than table stakes. Phase 7. |
| 12 | **Print, extended** | 0.5 d | `boring.css:304-310` already has a print stylesheet. Extending it to personal shelves — print your year as a plain-text list — is almost free, entirely in character, and something no competitor bothers with. Phase 3. |
| 13 | **Series tracking with next-in-series prompts** | 3 d | Needs series data; Hardcover's free GraphQL API is the best source, but its token expires annually (resetting Jan 1), which is an operational landmine for an unattended service. Defer until a user asks. |
| 14 | **Book clubs with progress-gated discussion** | 15 d+ | Fable's clubs are the best structured social reading anywhere, but they cost chat, moderation tools, scheduling, and — the genuinely hard part — gating threads by each reader's progress so nobody gets spoiled. **Do not attempt before the single-player experience is loved.** |

---

*Two documents to write before Phase 1: `docs/adr/0001`–`0008` in each repo, and a committed `CLAUDE.md` that says what this plan says. The sibling's doc-comment habit — every module, guard, entity and migration opening with a block comment stating **why** and citing the governing decision — is the single best thing to inherit from it. Just keep the decisions inside the repo, so the citations resolve.*