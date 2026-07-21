# Spike B — television performance baseline

Recorded 2026-07-22 on the pre-port Vite build (`d919e88`), via `node scripts/fps-baseline.mjs`.
Machine: darwin 25.5.0, Apple silicon. Viewport 1440×900, backing store capped at dpr 2.

**This exists so that Phase 1 can prove it did not degrade the picture.** Without a before-number,
"≥55 fps after the port" is unfalsifiable — and, as it turns out, wrong.

## Numbers

| Engine | fps (median of 3) | quality | shader | vs. plan's ≥55 target |
|---|---:|---:|:--|:--|
| Chrome (real, `channel: 'chrome'`) | **59.0** | 1.00 | active | pass |
| Firefox (Playwright 151) | **40.4** | 0.62 | active | **fail** |
| WebKit (Playwright 26.0) | **29.9** | 0.62 | active | **fail** |

Raw: Chrome 58.0 / 59.0 / 60.1 · Firefox 40.4 / 40.0 / 42.2 · WebKit 30.1 / 29.9 / 29.5.

## Why quality is recorded alongside fps

The render loop sheds resolution when it cannot keep up: below 34 fps it drops the WebGL backing
store to 0.62 and dims the bloom, restoring only above 55 fps (`CrtScreen.tsx:177-184`). A build
that halved throughput would therefore still report a comfortable frame rate, just at 62%
resolution — so **fps alone cannot detect a regression**. The harness recovers the multiplier by
comparing the canvas backing store against its CSS box, which `crt.resize()` sets to
`rect.width * dpr * quality`; no engine instrumentation is needed.

Both failing engines are failing in the shed state. Firefox and WebKit are not merely below target,
they are rendering at 62% resolution to stay where they are.

The shed is also **hysteretic**: once triggered it only releases above 55 fps, which a shed engine
cannot reach. One early dip pins a run low for its whole duration. This showed up directly — an
early cold-machine Firefox run held 47.7 fps at quality 1.00, while three later back-to-back runs
all sat at ~40 fps at 0.62. Same build, same machine.

## Caveats — read before citing these numbers

1. **Playwright's WebKit is not Safari.** It is a WebKit build with different GPU integration, and
   it generally understates real Safari on macOS. The WebKit row is a *lower bound*, not a Safari
   measurement. Verify in Safari.app before treating it as the real number.
2. **Playwright's Firefox is a patched build**, same caveat in weaker form.
3. **Thermal sequencing contaminates back-to-back runs.** The three-per-engine sweep ran nine
   browser launches in a row; the later engines were measured on a hotter machine. WebKit ran last.
4. Three samples per engine is enough to see a 30-vs-59 gap and not enough to resolve 5 fps.
5. Automated headed runs, not a human watching a television. The subjective read may differ.

## What this changes

Phase 1's exit criterion as originally written — *"/tv sustains ≥55 fps in Chrome, Safari and
Firefox"* — **is not achievable, because it is not true today.** Two of three engines miss it on
the current build, before a single line has been ported. Adopting it as written would either block
the port on a pre-existing condition or, more likely, be quietly waived — which is worse, because
then nothing is checking.

**Replace it with a no-regression criterion, per engine:**

> `/tv` holds **≥95% of the Phase 0 baseline fps at no lower quality multiplier**, in each of
> Chrome, Firefox and WebKit, with `Crt.ok === true`. Concretely: Chrome ≥56 @ 1.00,
> Firefox ≥38 @ 0.62, WebKit ≥28 @ 0.62.

That is falsifiable, it is achievable, and it measures the thing the criterion was actually for —
*did the port cost us anything* — rather than a target the project has never met.

Improving Safari and Firefox is real work with real value, but it is **not** the port's job, and
bundling it into Phase 1 is how a 9-day phase becomes a 20-day one. Track it separately.

## Post-port result (Phase 1)

Measured the same way on the Next.js build, after the port.

| Engine | before | after | quality before → after | verdict |
|---|---:|---:|:--|:--|
| Chrome | 59.0 | **60.1** | 1.00 → 1.00 | no regression |
| Firefox | 40.4 | **50.4 / 51.4** | 0.62 → **1.00** | no regression (better) |
| WebKit | 29.9 | **30.1** | 0.62 → 0.62 | no regression |

Criterion 2 passes on all three engines.

Firefox improved by enough to escape the quality shed entirely, which is the more
meaningful part of that row — it is now rendering at full resolution where before it was at 62%.
Do not read the +10 fps as a win the port earned, though: the pre-port Firefox median was measured
last in a hot nine-run sweep, and a cold pre-port run had already reached 47.7 @ 1.00. The honest
claim is *no regression, and Firefox is no longer shedding*, not *the port made Firefox faster*.

**Playwright's Firefox crashes intermittently** during `page.evaluate` — roughly one run in three,
both before and after the port. It is a harness flake, not a site defect; retry the run.

## Deployed (criterion 10) — and one thing that only failed in production

Live on `starrytv.vercel.app`. Verified there: 100 book articles server-rendered with no
JavaScript (538,578 bytes, against 1,585 and zero books on the old SPA); `/tv`, `/sitemap.xml`,
`/robots.txt` and `/schedule/current.json` all 200.

**The manifest compression question is settled: the CDN brotli-compresses it — 50,759 bytes against
134,102 raw.** `next start` serves it uncompressed locally, which is why this had to be measured on
the real deployment rather than assumed.

**The first production deploy 404'd every route**, including the hub. The Vercel project had been
created for the Vite build with Framework Preset "Other" and output directory `public` — settings
that live in the Vercel project rather than the repo, and that override framework auto-detection.
The build produced `.next` correctly and Vercel then served the `public/` folder, which contains one
favicon. Fixed by pinning `"framework": "nextjs"` in `vercel.json`, in version control rather than
the dashboard.

Worth noting as a class of failure: **nothing local could have caught this.** `next build`,
`next start`, the test suite and the fps harness all exercise the app, never the hosting
configuration. Preview deploys would have caught it, but Vercel puts previews behind SSO by default,
so an unauthenticated check against a preview URL returns a login redirect rather than the site.

## A bug the port surfaced: the WebGL fallback was painting nothing

Worth recording, because it was invisible in exactly the way the whole
degradation design is supposed to prevent.

`.crt-screen.is-degraded .crt-canvas` is `display: none` (`tv.css:363`), so the
instant the shader is declared down, the GL canvas measures 0×0 — and the render
loop began with `if (rect.width === 0) return`, measured against that canvas
(`CrtScreen.tsx:89-90`). So on a machine with no WebGL, every frame returned
before reaching `paintFrame`, and the 2D composite that is *supposed* to become
the picture stayed blank. A set with no WebGL showed nothing at all.

It was latent before the port rather than introduced by it. `tv.css` used to be
imported by `TvMode.tsx`, so under Vite it arrived a beat after the component
mounted; a couple of frames landed before the rule applied, and the tube showed a
**frozen still** — 68,437 of 307,200 pixels painted once and never updated.
Hoisting the stylesheet into the root layout, which Next requires, closed that
window and turned a frozen picture into no picture.

Fixed by measuring the screen container when the GL canvas is hidden. The
fallback is now fully painted (307,200/307,200) and live — successive frames
differ. That is better than the pre-port behaviour, not merely restored.

Guarded by `test/mount-counter.test.mjs`, which refuses every WebGL context and
asserts the fallback canvas has non-zero pixels. Note that the test must refuse
`experimental-webgl` explicitly as well as the `webgl*` prefix — `crt.ts:263`
falls back to it, and a first draft of the test that only blocked `webgl*` failed
against correctly-working code.

## Reproducing

```bash
npm run build
node scripts/fps-baseline.mjs --browser=chrome  --seconds=10
node scripts/fps-baseline.mjs --browser=firefox --seconds=10
node scripts/fps-baseline.mjs --browser=webkit  --seconds=10
```

Let the machine cool between runs, or the later engines are measured unfairly. For a Safari.app
number, open `http://localhost:4173/#tv`, click once to skip the boot, wait ~4 s for the power-on
and tune-in burst to finish, then paste the probe from `scripts/fps-baseline.mjs` into the console.
