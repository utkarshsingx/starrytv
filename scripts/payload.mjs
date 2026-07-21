/**
 * What a visitor actually downloads.
 *
 * Summing every file in `.next/static/chunks` answers a different and much less
 * interesting question — it counts chunks for routes nobody loaded, and both
 * halves of a code-split that only ever runs one way. This drives a real browser
 * and adds up the bytes that genuinely crossed the wire, per route, which is the
 * only figure comparable to the single bundle the Vite build used to ship.
 *
 *   node scripts/payload.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4181;

const server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
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
});

const browser = await chromium.launch();

async function measure(path, { enterTv = false } = {}) {
  const page = await browser.newPage();
  const byType = new Map();

  page.on('response', async (res) => {
    const type = (res.request().resourceType() || 'other').toLowerCase();
    let n = 0;
    try {
      const sizes = await res.request().sizes();
      n = sizes.responseBodySize || 0;
    } catch {
      /* redirects and aborted requests have no body */
    }
    byType.set(type, (byType.get(type) ?? 0) + n);
  });

  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
  if (enterTv) {
    await page.click('.tv-cta');
    await sleep(4500);
  }
  await page.close();

  return byType;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const show = (label, m) => {
  const script = m.get('script') ?? 0;
  const doc = m.get('document') ?? 0;
  const fetchXhr = (m.get('fetch') ?? 0) + (m.get('xhr') ?? 0);
  const css = m.get('stylesheet') ?? 0;
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  console.log(
    `${label.padEnd(28)} js ${kb(script).padStart(9)}   html ${kb(doc).padStart(9)}` +
      `   css ${kb(css).padStart(8)}   fetch ${kb(fetchXhr).padStart(9)}   total ${kb(total)}`,
  );
};

console.log('\n(transfer sizes, compressed, as the browser received them)\n');
show('/ (hub only)', await measure('/'));
show('/tv (direct)', await measure('/tv'));
show('/ then switch on the TV', await measure('/', { enterTv: true }));
console.log('\npre-port Vite build: js 131.5 KB gzip on every route, html ~0.8 KB\n');

await browser.close();
server.kill();
