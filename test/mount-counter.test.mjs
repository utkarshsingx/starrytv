/**
 * Phase 1 exit criteria that a human cannot check by looking.
 *
 *   npm run build && npm run test:e2e
 *
 * The headline case is the never-unmount invariant. `App.tsx` documented at
 * length that the Boring Edition is mounted once and never unmounted — it is the
 * document, and the television is an overlay on top of it. Under Next that now
 * depends on a structural detail: the shell lives in `(broadcast)/layout.tsx`
 * and both pages return `null`. Anyone who later "tidies up" by moving the hub
 * into `page.tsx` breaks it, and **nothing about the site looks wrong when they
 * do** — it still renders, it still tunes. You only lose scroll position and
 * make screen readers re-announce a hundred books on every trip to the set.
 *
 * So it is asserted by element identity across a navigation, which is the only
 * thing that actually distinguishes "kept" from "rebuilt identically".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4180;
const BASE = `http://localhost:${PORT}`;

let server;
let browser;

before(async () => {
  server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const bail = setTimeout(() => reject(new Error('server did not start')), 60_000);
    server.stdout.on('data', (b) => {
      if (/Ready in|Local:/.test(b.toString())) {
        clearTimeout(bail);
        resolve();
      }
    });
    server.on('exit', (c) => reject(new Error(`server exited early (${c})`)));
  });
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

test('the Boring Edition survives a round trip to the television', async () => {
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'load' });

  // Stash the actual element, and mark it. If React unmounts and remounts the
  // subtree, the new node is a different object and carries no marker — which a
  // querySelector-based check would happily fail to notice.
  await page.evaluate(() => {
    const el = document.querySelector('.boring');
    el.dataset.mountWitness = 'original';
    window.__witness = el;
  });

  await page.click('.tv-cta');
  await page.waitForURL('**/tv');
  await page.waitForTimeout(3500); // boot sequence + power-on

  const duringTv = await page.evaluate(() => ({
    sameNode: window.__witness === document.querySelector('.boring'),
    stillConnected: window.__witness.isConnected,
    marker: document.querySelector('.boring')?.dataset.mountWitness ?? null,
    inert: document.querySelector('.boring').closest('[inert]') !== null,
    tvUp: !!document.querySelector('.tv-mode'),
  }));

  assert.equal(duringTv.tvUp, true, 'the television should be on screen at /tv');
  assert.equal(duringTv.sameNode, true, 'the hub element was replaced — it remounted');
  assert.equal(duringTv.stillConnected, true, 'the hub was detached from the document');
  assert.equal(duringTv.marker, 'original', 'the hub lost its marker — it remounted');
  assert.equal(duringTv.inert, true, 'the hub must be inert while the set is up');

  // ...and back again.
  await page.click('.tv-exit');
  await page.waitForURL((u) => !u.pathname.endsWith('/tv'));
  await page.waitForTimeout(300);

  const afterReturn = await page.evaluate(() => ({
    sameNode: window.__witness === document.querySelector('.boring'),
    marker: document.querySelector('.boring')?.dataset.mountWitness ?? null,
    inert: document.querySelector('.boring').closest('[inert]') !== null,
  }));

  assert.equal(afterReturn.sameNode, true, 'the hub remounted on the way back');
  assert.equal(afterReturn.marker, 'original', 'the hub remounted on the way back');
  assert.equal(afterReturn.inert, false, 'the hub should be interactive again');

  await page.close();
});

test('no hydration errors on either route', async () => {
  for (const path of ['/', '/tv']) {
    const page = await browser.newPage();
    const bad = [];
    page.on('console', (m) => {
      const t = m.text();
      if (m.type() === 'error' && /hydrat|did not match|server HTML/i.test(t)) bad.push(t);
    });
    page.on('pageerror', (e) => bad.push(String(e)));
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    assert.deepEqual(bad, [], `${path} produced errors`);
    await page.close();
  }
});

test('?ch=07 boots the set on channel 7', async () => {
  const page = await browser.newPage();
  await page.goto(`${BASE}/tv?ch=07`, { waitUntil: 'load' });
  await page.mouse.click(700, 400); // skip the boot
  await page.waitForTimeout(3000);

  const num = await page.evaluate(
    () => document.querySelector('.now-card-head')?.textContent ?? '',
  );
  assert.match(num, /007/, `expected channel 7, front panel read "${num}"`);
  await page.close();
});

test('search hides books without shipping the book data', async () => {
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'load' });

  // At least the 100 house books. Not *exactly* 100 any more: since Phase 4 the
  // hub also renders published reader reviews as `article.book`, so the count
  // legitimately grows with the corpus. Asserting a fixed 100 would fail the
  // moment a review is live — the search behaviour is what this tests, not the
  // catalogue size.
  const before = await page.locator('article.book[id]:visible').count();
  assert.ok(before >= 100, `expected at least 100 entries, got ${before}`);

  // A tag that really is in the corpus — 17 books carry "translated". The first
  // draft of this test searched for "iceland", which appears nowhere in
  // `books.data.ts`; it came from the illustrative example in the README rather
  // than the data, so the test failed on its own fixture and not on the code.
  await page.fill('#q', 'translated');
  await page.waitForTimeout(400);

  const after = await page.locator('article.book[id]:visible').count();
  assert.ok(after > 0 && after < before, `search matched ${after} of ${before}`);

  // Empty-state copy lives in the main column, server-rendered and toggled.
  await page.fill('#q', 'zzzzzzzz');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#boring-empty').isVisible(), true);
  assert.equal(await page.locator('article.book[id]:visible').count(), 0);

  await page.close();
});

test('a set with no WebGL still shows a picture', async () => {
  const page = await browser.newPage();
  // Refuse every WebGL context. `Crt` reports `ok === false`, the loop stops
  // running the shader, and the composited 2D canvas becomes the display —
  // which is the documented design (CrtScreen.tsx:53-56), and the reason a
  // broken shader is so easy to miss: it degrades to a flatter picture rather
  // than to an error.
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      // `experimental-webgl` must be refused explicitly — it does not start
      // with "webgl", and `crt.ts:263` falls back to it. A first draft of this
      // test only blocked the `webgl*` prefix, so the second attempt quietly
      // succeeded and the test failed while the site was behaving correctly.
      const t = String(type);
      if (t.startsWith('webgl') || t === 'experimental-webgl') return null;
      return real.call(this, type, ...rest);
    };
  });
  await page.goto(`${BASE}/tv`, { waitUntil: 'load' });
  await page.mouse.click(700, 400);
  await page.waitForTimeout(3500);

  const state = await page.evaluate(() => {
    const fallback = document.querySelector('canvas.crt-fallback');
    return {
      degraded: !!document.querySelector('.crt-screen.is-degraded'),
      notice: !!document.querySelector('.crt-degraded'),
      fallbackPresent: !!fallback,
      // A blank canvas is the failure this test exists to catch, so check that
      // pixels were actually painted rather than that an element exists.
      painted: fallback
        ? (() => {
            const d = fallback.getContext('2d').getImageData(0, 0, fallback.width, fallback.height)
              .data;
            for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) return true;
            return false;
          })()
        : false,
    };
  });

  assert.equal(state.degraded, true, 'the set did not notice WebGL was gone');
  assert.equal(state.notice, true, 'SIMPLE PICTURE MODE should be shown');
  assert.equal(state.fallbackPresent, true, 'the 2D fallback canvas is missing');
  assert.equal(state.painted, true, 'the fallback canvas is blank — no picture at all');
  await page.close();
});

test('reduced motion is still respected', async () => {
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/tv`, { waitUntil: 'load' });
  // The boot sequence short-circuits entirely under reduced motion, so the set
  // should be up without anyone clicking to skip it.
  await page.waitForTimeout(2000);
  assert.equal(
    await page.locator('.tv-mode').count(),
    1,
    'reduced motion should skip the boot and go straight to the set',
  );
  await page.close();
});

test('the set still boots when the schedule cannot be fetched', async () => {
  const page = await browser.newPage();
  // Tier 1 and tier 2 both unavailable: no network for the manifest, and a
  // fresh context so localStorage is empty. Only the bundled minimum is left.
  await page.route('**/schedule/current.json', (r) => r.abort());
  await page.goto(`${BASE}/tv`, { waitUntil: 'load' });
  await page.mouse.click(700, 400);
  await page.waitForTimeout(3500);

  const state = await page.evaluate(() => ({
    tvUp: !!document.querySelector('.tv-mode'),
    head: document.querySelector('.now-card-head')?.textContent ?? '',
    heading: document.querySelector('.now-card-body h2')?.textContent ?? '',
  }));

  assert.equal(state.tvUp, true, 'the set did not come up at all');
  assert.ok(
    /STANDBY|TONE|GOODNIGHT/.test(state.heading),
    `expected the bundled fallback schedule, got "${state.heading}"`,
  );
  await page.close();
});
