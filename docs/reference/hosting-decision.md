# Backend Hosting Decision — StarryTV

**Status: this OVERTURNS the Railway-Singapore plan. But not for the reason the review was opened.**

---

## 1. The call

**DigitalOcean App Platform, BLR1 (Bangalore)** — NestJS web component + a separate BullMQ Worker component — with **DO Managed PostgreSQL 16, BLR1** and **DO Managed Valkey, BLR1**. One vendor, one bill, one VPC, private networking between all three. `api.starrytv.app` points at the App Platform app with automatic Let's Encrypt TLS; `starrytv.app` stays on Vercel Pro with the function region set to `bom1`. This **changes** the previous decision: Railway is dropped entirely, and Singapore with it.

---

## 2. Why

**The latency premise that triggered this review is real but not decisive — say so out loud.** Singapore costs roughly **+35ms per warm round trip and +105ms once on cold connect**. Against Nielsen's 100ms "instant" threshold, +35ms warm is *imperceptible*. It is also dwarfed by the Indian last mile: Airtel's **best** mobile ping in India is 64ms (SpeedGeo Q1 2026), so the network your reader is already on costs about twice what this entire region decision does. And the public hub and review pages are ISR at Vercel `bom1` — **zero API round trips** — so the reading experience is byte-identical on either continent. If DO were more expensive than Railway, I would have kept Singapore.

**Railway is disqualified on reliability, not geography.** On 2026-02-11 a fraud-model false positive sent SIGTERMs to live workloads *including Postgres and MySQL databases*. On 2026-05-19 Google Cloud's automated systems suspended Railway's entire production GCP account with no notice: **8 hours of total outage** across dashboard, API, deploys and databases for 3M users; disks back at 23:54 UTC, networking not until 01:30. The founder's own postmortem concedes a single upstream action cascaded platform-wide. Hobby support is Discord-only with no guaranteed response. A solo founder with no on-call absorbs that outage with his own body, and can do nothing during it but refresh a status page.

**The one latency number that genuinely compounds is app-to-DB, and it is what eliminates the seductive alternative.** Fly.io has a real Mumbai (`bom`) region — and **Fly Managed Postgres is not available in it** (recent MPG expansions went to ams, nrt, sin, sjc). App-in-Mumbai against MPG-in-Singapore pays ~50-60ms on *every query*, and a page view fans out to several sequential queries, so a 5-query page costs 250-300ms — **strictly worse than deploying everything in Singapore**. Since Feb 2026 Fly also bills MPG inter-region private traffic, so you pay a permanent egress tax for being slower. Any comparison table that just checks "has India region" recommends Fly and is wrong. DO's ~1ms private BLR1 link is the only latency figure here worth paying for.

---

## 3. Cost

| Line | Launch (~0 users) | ~1000 users |
|---|---|---|
| App Platform — web (1 vCPU / 1 GiB) | $10.00 | $10.00 |
| App Platform — BullMQ worker (basic) | $5.00 | $5.00 |
| Managed PostgreSQL 16, 1 GB / 1 vCPU, BLR1 | $15.15 | $15.15 |
| Managed Valkey, 1 GB / 1 vCPU, BLR1 | $15.00 | $15.00 |
| **Backend subtotal** | **$45.15** | **$45.15** |
| Vercel Pro (inside 1 TB / 10M inclusions) | $20.00 | $20.00 |
| Cloudflare R2 | ~$1 | ~$3 |
| Resend (free tier at launch) | $0 | $0–20 |
| Mux (pure usage) | ~$5 | $10–25 |
| **Sticker total** | **~$71** | **~$93–108** |
| **+18% Indian GST (OIDAR, all foreign SaaS)** | +$12.80 | +$16.70–19.40 |
| **Landed, actually paid** | **~$84** | **~$110–128** |

**Against the previous ~$95 figure:** the backend line lands at $45 and does not move between launch and 1000 users — reads are edge-cached, so traffic growth does not touch the DB tier. Railway's realistic web+worker+PG+Redis band was $35–80/mo with documented 2–5x bill surprises, so this is **price parity with better predictability**, not a saving.

Read the bottom row honestly: **the ~$95 target is breached by Mux and GST, not by hosting.** Backend infrastructure is the smallest controllable line in the table. Cutting it below $45 buys almost nothing and costs reliability; the leverage is in Mux usage and edge caching. Do not let the $95 number push you toward a worse platform.

---

## 4. What it costs us

Stated plainly, because these are real:

- **DX is meaningfully worse than Render or Vercel.** The CLI lags, there are no preview deploys, and DO ships features slowly. This is the actual price of the recommendation and you will feel it every week. It is an annoyance tax, not a lock-in tax.
- **Pre-deploy job components are `app.yaml`/`doctl` only** — invisible in the dashboard UI. Your migration gate lives in YAML you commit, or it does not exist.
- **BLR1 is a single region with no in-India DO failover pair.** A regional incident is total downtime.
- **Base-tier Postgres is a single node with no automatic failover**, and PITR caps at **7 days**. HA is $60/mo (4x) and is not justified yet.
- **Hard limits to design around:** 1-hour build timeout, 30-minute job timeout (your migration must finish inside it), images over 2 GiB go flaky, 4 GiB ephemeral filesystem, no persistent volumes, **AMD64-only** — do not build on your M-series Mac without `--platform linux/amd64`.
- **Support is a <24h target**, ~48h average resolution. There is no 3am human at this budget on any platform in the comparison.
- **No native Axiom log drain** (DO forwards to Datadog / Better Stack / OpenSearch only). Use the OTel SDK straight to Axiom's OTLP endpoint — which you want anyway, because it is portable.

Realistic babysitting: **~2-3 h/month**. If you exceed 5 h/month at 1000 users, the platform is wrong, not your skills.

---

## 5. DPDP / data residency

**⚠️ This is research, not legal advice. Engage an Indian privacy practitioner before the May 2027 commencement date.**

**Hosting outside India is lawful for this app in 2026.** DPDP Act s.16 read with Rule 15 is a **negative-list regime**: cross-border transfers are permitted *unless* the Central Government notifies a restricted country, and as of mid-2026 no such list exists. There are no adequacy decisions, no SCCs, no transfer impact assessments, and no blanket localisation. Only Significant Data Fiduciaries face possible localisation of notified categories, and a 1000-user book-review site is nowhere near SDF designation. **So Singapore was never illegal — residency is a bonus of this decision, not its justification.** That said, BLR1 does permanently close the tail risk that a future notification under Rule 15 restricts a destination.

**Obligations that apply regardless of where you host.** The Rules were notified 13/14 Nov 2025 with phased commencement — the Board is live now, Consent Managers from Nov 2026, and **Rule 3 (notice) plus Rules 5–16 in force 13/14 May 2027**. By that date you need:

1. **An itemised, standalone privacy notice** — not buried in T&Cs — stating purpose, the specific categories of personal data, retention period, and the withdrawal mechanism. **Available in English plus the 22 Eighth Schedule languages.** This translation obligation is the sleeper cost and it is not waived for small entities.
2. **A consent-withdrawal path** that is as easy as giving consent.
3. **A children's flow**: verifiable parental consent for under-18s, and **no behavioural tracking or targeted advertising to under-18s at all.** For a book-review platform with reading-progress data, decide now whether you accept under-18 signups.
4. **Breach reporting**: notice to affected users without delay, and a full report to the Data Protection Board **within 72 hours**.
5. **Grievance redressal + a published contact point** able to answer questions about processing. *(Flagged: I did not independently verify the specific rule cites for the grievance/DPO mechanics in this pass — confirm these with counsel.)*

Penalties run to **Rs 250 crore**. No revenue or user threshold exempts you; only the timeline is generous. **Treat DPDP as a May 2027 deliverable, not a 2026 blocker.**

---

## 6. The migration path

**If this is wrong in 12 months, leaving costs an afternoon — and it stays an afternoon at 10x this traffic.** At 1000 users with light writes the Postgres is single-digit GB, so byte-level data gravity is effectively zero. The entire proprietary surface is **one `app.yaml` of roughly 40 lines plus a pre-deploy job component**. The app is a Dockerfile, Postgres is stock PG16, and Valkey speaks the Redis wire protocol so BullMQ is untouched. Exit = `docker build` elsewhere + `pg_dump`/restore + repoint `api.starrytv.app`.

**Do these NOW to keep it that cheap:**

1. **One Dockerfile, strictly 12-factor.** All config via env vars — `DATABASE_URL`, `REDIS_URL` injected. No DO SDKs anywhere in application code. R2/Mux/Resend stay external. You already have this pattern working in the sibling NestJS repo (`node:22-alpine` multi-stage build) — reuse it, and add `--platform linux/amd64`.
2. **Migrations as a pre-deploy job component** in `app.yaml`, with `migrationsRun: false` in the TypeORM DataSource. Migrations are a deploy gate, never a race between replicas, and never on boot.
3. **BullMQ workers as a separate Worker component.** App Platform scales web components on HTTP and *will* restart your job processor if you co-locate it.
4. **Point TypeORM at DO's built-in PgBouncer in transaction mode with an app-side pool of 5–10.** The API and the workers both hold connections against a 1 GiB tier's modest ceiling. This is mandatory configuration, not tuning.
5. **Monthly scripted `pg_dump` to R2 with a verified restore into a throwaway DB and a row-count diff.** 30 minutes a month. It is simultaneously your 7-day-PITR mitigation, your single-node-failover insurance, and a pre-built exit hatch.
6. **OTel SDK → Axiom OTLP, plus the Sentry NestJS SDK.** App-level instrumentation is portable to every alternative on the list.
7. **Keep authorization in NestJS guards, never in database-vendor features.** The moment authz lives in RLS policies, exit stops being a dump and becomes a rewrite of your security model.
8. **Copy every secret into a password manager.** App Platform will not show them back to you.

Documented fallbacks, in order: **Render Singapore** if DO's DX genuinely blocks you (best-in-class `preDeployCommand` and one-click rollback, but +$25 workspace and a region you'd later leave); **Sevalla Mumbai/Delhi** in 2027 once the Feb-2026 Kinsta consolidation has a track record; **a DO BLR1 droplet + Dokploy** as a year-two cost-crisis move, never a launch position.

---

## 7. Decision for the user

**Closed by me — do not reopen:**

- **No Next.js rewrite proxy.** The judging panel recommended fronting the API through a same-origin rewrite to kill CORS preflight. **`next.config.ts` already rejects this deliberately and is correct.** Two reasons the panel missed: (a) your CORS config already sets `maxAge: 86400`, so preflight is *cached*, not paid per mutation — browsers cap it (Chromium 2h, Firefox 24h, Safari ~10 min), but it is amortised either way, not the per-request tax claimed; (b) a proxy would route every API call browser → Vercel `bom1` → DO BLR1, **adding the ~20-25ms Mumbai-Bangalore hop to every single call** to save an amortised preflight, and would meter it at bom1's Fast Origin Transfer of $0.25/GB (4x iad1). Direct subdomain stays. The cookie `Domain=.starrytv.app` design is unaffected.
- **Do not block the decision on a latency benchmark.** The research recommended benchmarking BLR1 vs Singapore before committing. The decision does not rest on latency — it rests on Railway's reliability record at price parity. Run the RUM measurements *after* you ship, from Jio/Airtel mobile and home fibre in your two biggest reader cities, as instrumentation rather than as a gate.

**Genuinely open — with my recommendation:**

| Question | My call |
|---|---|
| Bangalore (BLR1) vs a Mumbai region | **Take BLR1.** Mumbai is ~20-25ms of backbone closer for the largest metro, and getting it means Sevalla (5 months old under that brand, unverifiable pricing) or a hyperscaler ($70-130/mo). Not worth it against a 64ms last mile. |
| Postgres HA / standby node | **Skip at launch.** $60/mo is 4x for a book-review site at 1000 users. The `pg_dump`-to-R2 cron plus a verified monthly restore is the right insurance now. Add HA when you hold user data you cannot reconstruct. |
| Staging environment | **Second DO app on a `staging` branch sharing the prod PG cluster via a separate database.** ~$5-10, not a second $15 cluster. Watch this — DB clusters bill hourly, so a forgotten staging DB is a silent $15/mo. |
| Resend tier | **Start free.** 1000 users of transactional email fits; move to $20 only when digests start. |
| Vercel function region | **Set it to `bom1`.** $0 marginal inside your inclusions. Keep hub and review pages on ISR so they never touch the API at all. |

**One verification task before you provision:** the research could not independently confirm that DO's Managed Database pricing carries no regional variation **for BLR1 specifically**. Pull the actual BLR1 quote in the console and confirm $15.15 / $15.00 before you finalise the budget. Everything else in this recommendation is confirmed.