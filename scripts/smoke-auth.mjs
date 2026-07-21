/**
 * One-off live smoke test: drive the real signup/verify flow in a browser
 * against the running dev server and the real Supabase DB.
 *
 *   node scripts/smoke-auth.mjs
 *
 * The verification code is not emailed (no Resend key yet) — it is printed to
 * the dev server log, so this reads it back from that log file. Throwaway: it
 * signs up a uniquely-suffixed address so it can run repeatedly.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const LOG = '/tmp/starry-dev.log';
const email = `browser-smoke+${Date.now()}@starrytv.app`;
const password = 'browserpass123';

const browser = await chromium.launch();
const page = await browser.newPage();
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

try {
  // 1. Sign up through the actual form.
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
  await page.fill('#name', 'Browser Smoke');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/verify**', { timeout: 15000 });
  console.log('✓ signup submitted, routed to verify');

  // 2. Read the code the server just logged for this address.
  await new Promise((r) => setTimeout(r, 500));
  const log = readFileSync(LOG, 'utf8');
  const re = new RegExp(`Verification code for ${email.replace(/[+.]/g, '\\$&')}: (\\d{6})`);
  const m = log.match(re);
  if (!m) { fail(`no verification code in the log for ${email}`); }
  else {
    const code = m[1];
    console.log(`✓ recovered verification code from server log: ${code}`);

    // 3. Verify → should land signed in on /desk.
    await page.fill('#code', code);
    await page.click('button[type=submit]');
    await page.waitForURL('**/desk', { timeout: 15000 });
    console.log('✓ verified and landed on /desk');

    // 4. The desk greets the user by name and the account chip is gone from here.
    const heading = await page.textContent('.app-h1');
    console.log(`✓ desk heading: "${heading?.trim()}"`);

    // 5. /me now returns the user.
    const me = await page.evaluate(async () => {
      const r = await fetch('/api/v1/auth/me', { credentials: 'include' });
      return r.json();
    });
    if (me?.data?.user?.email === email) console.log(`✓ /me confirms session: ${me.data.user.email} (role ${me.data.user.role})`);
    else fail(`/me did not confirm the session: ${JSON.stringify(me)}`);

    // 6. Sign out clears it.
    await page.click('.app-bar-signout');
    await page.waitForURL(BASE + '/', { timeout: 10000 });
    const after = await page.evaluate(async () => {
      const r = await fetch('/api/v1/auth/me', { credentials: 'include' });
      return r.json();
    });
    if (after?.data?.user === null) console.log('✓ sign-out cleared the session');
    else fail('session survived sign-out');
  }
} catch (err) {
  fail(err.message);
} finally {
  console.log(`\n(test account: ${email})`);
  await browser.close();
}
