/**
 * Spike B — baseline the television.
 *
 * Phase 1 of the port has to prove it did not degrade the picture, and "it looks
 * fine" is not a criterion. This records the number to beat, with a procedure
 * repeatable enough that the after-measurement means something.
 *
 *   node scripts/fps-baseline.mjs                  # chrome, headed
 *   node scripts/fps-baseline.mjs --browser=webkit # safari's engine
 *   node scripts/fps-baseline.mjs --seconds=20
 *
 * FPS ALONE IS NOT THE MEASUREMENT. The render loop sheds resolution when it
 * cannot keep up — below 34fps it drops the backing store to 0.62 and restores
 * it above 55 (CrtScreen.tsx:177-184). A port that halved the throughput would
 * still report a comfortable 60fps, just at 62% resolution with the bloom turned
 * down. So we also recover the quality multiplier, by comparing the WebGL
 * canvas's backing store against the CSS box it is painted into — `crt.resize()`
 * sets it to `rect.width * dpr * quality`, which makes the ratio readable from
 * outside without instrumenting the engine.
 *
 * A pass is >=55fps AT quality 1.0. Either number alone is meaningless.
 */
import { chromium, webkit, firefox } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const BROWSER = arg('browser', 'chrome');
const SECONDS = Number(arg('seconds', '12'));
const PORT = Number(arg('port', '4173'));
const CHANNEL = arg('channel', '');

const ENGINES = { chrome: chromium, chromium, webkit, firefox };

/** The production server, waited on properly rather than by guessing at a sleep. */
async function serve() {
  const proc = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const bail = setTimeout(() => reject(new Error('server did not start')), 60_000);
    proc.stdout.on('data', (b) => {
      if (/Ready in|Local:/.test(b.toString())) {
        clearTimeout(bail);
        resolve();
      }
    });
    proc.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });
  return proc;
}

/**
 * Counts frames the same way the engine does — one rAF tick per painted frame —
 * and samples the backing-store ratio across the run rather than once at the
 * end, so a mid-run shed is visible instead of averaged away.
 */
const probe = (seconds) =>
  new Promise((resolve) => {
    const gl = document.querySelector('canvas.crt-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let frames = 0;
    const qualities = [];
    const t0 = performance.now();

    const tick = () => {
      frames++;
      if (gl) {
        const rect = gl.getBoundingClientRect();
        if (rect.width > 0) qualities.push(gl.width / (rect.width * dpr));
      }
      if (performance.now() - t0 < seconds * 1000) requestAnimationFrame(tick);
      else {
        const elapsed = (performance.now() - t0) / 1000;
        qualities.sort((a, b) => a - b);
        resolve({
          fps: frames / elapsed,
          seconds: elapsed,
          quality: qualities.length ? qualities[Math.floor(qualities.length / 2)] : null,
          qualityMin: qualities.length ? qualities[0] : null,
          canvas: gl ? { w: gl.width, h: gl.height } : null,
        });
      }
    };
    requestAnimationFrame(tick);
  });

const server = await serve();
let browser;
try {
  const engine = ENGINES[BROWSER];
  if (!engine) throw new Error(`unknown browser "${BROWSER}" (chrome|webkit|firefox)`);

  // Headed, and real Chrome where we can get it. Headless swaps in a software
  // rasteriser on some machines, which measures the wrong thing entirely for a
  // fill-rate-bound fragment shader.
  browser = await engine.launch({
    headless: false,
    ...(BROWSER === 'chrome' && !CHANNEL ? { channel: 'chrome' } : {}),
    ...(CHANNEL ? { channel: CHANNEL } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // `/tv` is a real route since the port — the old `#tv` hash form existed only
  // because the Vite preview server had no SPA fallback.
  await page.goto(`http://localhost:${PORT}/tv`, { waitUntil: 'load' });

  // One real gesture: skips the boot sequence and unlocks the audio context,
  // which is the state a visitor is actually in.
  await page.mouse.click(720, 450);

  // Let the power-on transition and the tune-in static burst finish — both are
  // deliberately expensive and would drag the average down unrepresentatively.
  await sleep(4000);

  const result = await page.evaluate(probe, SECONDS);

  // `is-degraded` is set from `!crt.ok` (CrtScreen.tsx:66-67). It matters that
  // this is checked rather than assumed: a dead shader falls back to the 2D
  // composite *by design*, so the failure renders as a slightly flatter picture
  // at a very comfortable frame rate — the most misleading signature available.
  const webglUp = await page.evaluate(
    () => !document.querySelector('.crt-screen')?.classList.contains('is-degraded'),
  );

  const pass = result.fps >= 55 && (result.quality ?? 0) >= 0.99;
  console.log(
    `\n  ${BROWSER}  ${result.fps.toFixed(1)} fps over ${result.seconds.toFixed(1)}s` +
      `   quality ${result.quality?.toFixed(2) ?? 'n/a'} (min ${result.qualityMin?.toFixed(2) ?? 'n/a'})` +
      `   backing store ${result.canvas ? `${result.canvas.w}x${result.canvas.h}` : 'n/a'}` +
      `\n  shader ${webglUp ? 'active' : 'DOWN — measuring the 2D fallback, not the shader'}` +
      `   ${pass ? 'PASS' : 'BELOW THRESHOLD'}` +
      (errors.length ? `\n  page errors: ${errors.join('; ')}` : '') +
      '\n',
  );
  console.log(JSON.stringify({ browser: BROWSER, ...result, webglUp, pass }));
} finally {
  await browser?.close();
  server.kill();
}
