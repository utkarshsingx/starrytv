'use client';

import { useEffect, useRef, useState } from 'react';
import { useTv, tvState, channelByNum } from './store';
import { nowPlaying } from './engine/schedule';
import { paintFrame, W, H } from './engine/compositor';
import { Crt, DEFAULT_UNIFORMS, tintFromHex, type CrtUniforms } from './engine/crt';
import { VideoDeck } from './engine/video';
import { powerFrame, POWER_ON_SEC, POWER_OFF_SEC } from './engine/power';
import { prefersReducedMotion } from '../lib/env';

/**
 * The tube.
 *
 * One rAF loop drives everything: it composites the current programme to an
 * offscreen 2D canvas, then pushes that through the CRT shader. It reads state
 * non-reactively via `tvState()` so that turning the volume up does not cause
 * React to re-render sixty times a second.
 */
type Props = {
  /**
   * Optional canvas, owned by the caller and placed wherever it likes, that
   * receives a mirrored copy of each frame. It has to live outside the bezel to
   * read as a reflection on the floor, so the caller positions it and we just
   * paint into it.
   */
  floorRef?: React.RefObject<HTMLCanvasElement | null>;
};

export function CrtScreen({ floorRef }: Props) {
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const deckHostRef = useRef<HTMLDivElement | null>(null);
  const fallbackHostRef = useRef<HTMLDivElement | null>(null);
  const [degraded, setDegraded] = useState(false);

  // Only these three need to reach the DOM layer; everything else is read
  // inside the loop.
  const power = useTv((s) => s.power);
  const channelNum = useTv((s) => s.channelNum);

  useEffect(() => {
    const glCanvas = glRef.current;
    if (!glCanvas) return;

    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const ctx = src.getContext('2d', { alpha: false });
    if (!ctx) return;
    srcRef.current = src;

    // The composited picture is put into the DOM, not just kept offscreen. When
    // the shader is unavailable this canvas *is* the display — CSS supplies
    // scanlines and a vignette so it still reads as a television, just a flat
    // one. Without this, a machine with no WebGL gets a blank rectangle.
    src.className = 'crt-fallback';
    src.setAttribute('aria-hidden', 'true');
    fallbackHostRef.current?.appendChild(src);

    // The laid-out box the picture occupies, whether or not the shader is up.
    const screenEl = glCanvas.parentElement;

    const crt = new Crt(glCanvas);
    const deck = deckHostRef.current ? new VideoDeck(deckHostRef.current) : null;
    const reduceMotion = prefersReducedMotion();

    // Mirrors `degraded`, but readable from inside the loop. Context loss can
    // flip this either way at any time, so it is re-checked every frame.
    let shaderDown = !crt.ok;
    setDegraded(shaderDown);

    // Cap the backing store: the shader is fill-rate bound and a 4K device pixel
    // ratio buys nothing once the picture is 640x480 behind scanlines anyway.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let stopped = false;

    // Rolling FPS estimate. If a device can't hold up we shed shader work rather
    // than let the whole page stutter.
    let frames = 0;
    let fpsWindowStart = performance.now();
    let quality = 1;

    const u: CrtUniforms = { ...DEFAULT_UNIFORMS };

    const loop = (ts: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);

      const s = tvState();

      // Measure the screen, not the WebGL canvas.
      //
      // `.crt-screen.is-degraded .crt-canvas` is `display: none` (tv.css:363),
      // so the moment the shader is declared down the GL canvas measures 0x0 —
      // and an early return here would skip `paintFrame` for every subsequent
      // frame, leaving the 2D composite that is *supposed* to become the
      // picture permanently blank. That is precisely the "machine with no WebGL
      // gets a blank rectangle" outcome the fallback exists to prevent.
      //
      // It was latent before the port: `tv.css` used to be imported by
      // `TvMode.tsx` and arrived a beat after the first frames, so a couple of
      // paints landed before the rule applied and the tube showed a frozen
      // still. Hoisting the stylesheet into the root layout (which Next
      // requires) closed that window and turned a frozen picture into no
      // picture. `test/mount-counter.test.mjs` asserts the canvas has non-zero
      // pixels so it cannot regress quietly again.
      const glRect = glCanvas.getBoundingClientRect();
      const rect = glRect.width > 0 ? glRect : (screenEl?.getBoundingClientRect() ?? glRect);
      if (rect.width === 0) return;
      crt.resize(
        Math.round(rect.width * dpr * quality),
        Math.round(rect.height * dpr * quality),
      );

      const channel = s.channels.find((c) => c.num === s.channelNum) ?? s.channels[0];
      const np = s.power && channel ? nowPlaying(channel) : null;

      const sinceTune = (Date.now() - s.tunedAt) / 1000;

      // ---- static burst: hard on at tune-in, decaying away ----
      let staticLevel = 0;
      if (s.power && !reduceMotion) {
        staticLevel =
          sinceTune < 0.1 ? 1 : Math.max(0, Math.exp(-(sinceTune - 0.1) / 0.16));
      }

      // ---- power transition ----
      // A keyframed raster: snapping open from a line with an overshoot on the
      // way on, collapsing to a line and then a dot on the way off. Reduced
      // motion goes straight to the steady state at either end.
      const sinceSwitch = (Date.now() - s.poweredAt) / 1000;
      const pf = reduceMotion
        ? powerFrame(s.power, s.power ? POWER_ON_SEC : POWER_OFF_SEC)
        : powerFrame(s.power, sinceSwitch);

      // ---- real video, when a programme carries one ----
      let video: HTMLVideoElement | null = null;
      let caption: string | null = null;
      if (deck && np) {
        video = deck.sync(np.programme, np.offset, { muted: s.muted, volume: s.volume });
        caption = deck.activeCue();
        deck.preload(channel?.programmes[(np.index + 1) % channel.programmes.length]);
      }

      paintFrame(ctx, {
        now: np,
        power: s.power,
        captions: s.captions,
        osd: s.osd,
        sinceTune,
        reduceMotion,
        clock: ts / 1000,
        video,
        caption,
      });

      if (crt.ok) {
        u.static = staticLevel;
        u.scale = pf.scale;
        u.flash = pf.flash;
        u.warp = reduceMotion ? 0.16 : 0.42;
        u.bright = pf.bright * (quality < 1 ? 1.04 : 1);
        u.bloom = quality < 1 ? 0.32 : 0.5;
        u.scan = reduceMotion ? 0.42 : 0.75;
        u.tint = channel ? tintFromHex(channel.color) : [1, 1, 1];
        crt.render(src, ts / 1000, u);
      }

      // ---- floor reflection ----
      // The same frame, mirrored onto the floorboards. Drawn from the composited
      // canvas rather than read back from the GL one, because reading pixels out
      // of WebGL every frame stalls the pipeline and this is going to be blurred
      // to mush by CSS anyway. It follows the raster geometry, so it collapses
      // with the tube when the set is switched off.
      const floor = floorRef?.current;
      if (floor) {
        const fctx = floor.getContext('2d');
        if (fctx) {
          fctx.clearRect(0, 0, floor.width, floor.height);
          fctx.save();
          fctx.globalAlpha = 0.5 * Math.min(1, pf.scale[1]);
          fctx.translate(floor.width / 2, floor.height / 2);
          fctx.scale(pf.scale[0], -pf.scale[1]);
          fctx.drawImage(src, -floor.width / 2, -floor.height / 2, floor.width, floor.height);
          fctx.restore();
        }
      }

      // Track this as a local flag, not off React state — the closure captures
      // `degraded` at its initial value, so testing that here would call
      // setDegraded on every single frame.
      if (crt.ok === shaderDown) {
        shaderDown = !crt.ok;
        setDegraded(shaderDown);
      }

      // ---- adaptive quality ----
      frames++;
      if (ts - fpsWindowStart > 2000) {
        const fps = (frames * 1000) / (ts - fpsWindowStart);
        if (fps < 34 && quality > 0.62) quality = 0.62;
        else if (fps > 55 && quality < 1) quality = 1;
        frames = 0;
        fpsWindowStart = ts;
      }
    };

    raf = requestAnimationFrame(loop);

    // Stop burning GPU when the tab is hidden.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!stopped) {
        fpsWindowStart = performance.now();
        frames = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      crt.dispose();
      deck?.dispose();
      src.remove();
    };
    // The loop reads live state itself; it must be built exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channel = channelByNum(channelNum);
  const np = power && channel ? nowPlaying(channel) : null;

  return (
    <div className={`crt-screen ${degraded ? 'is-degraded' : ''}`}>
      <canvas ref={glRef} className="crt-canvas" aria-hidden="true" />
      {/* Holds the composited 2D canvas. Normally it is only a texture source
          for the shader and stays hidden; if WebGL is gone it becomes the
          picture. */}
      <div ref={fallbackHostRef} className="crt-fallback-host" aria-hidden="true" />
      {/* The deck's <video> elements live here, 1px and invisible. They are only
          ever a frame source for the canvas — never shown directly. */}
      <div ref={deckHostRef} className="crt-deck" aria-hidden="true" />
      <div className="crt-glass" aria-hidden="true" />
      {degraded && (
        <div className="crt-degraded" aria-hidden="true">
          <span>SIMPLE PICTURE MODE</span>
        </div>
      )}

      {/*
        The canvas is opaque to assistive tech. This is the same content as a
        live region, so a screen reader hears the programme change even though
        it can never see the tube.
      */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {np
          ? `Channel ${np.channel.num}, ${np.channel.name}. Now playing: ${np.programme.heading}. ${np.programme.subheading}. ${np.programme.lines.join(' ')} ${np.programme.footer}`
          : 'Television is off.'}
      </div>
    </div>
  );
}
