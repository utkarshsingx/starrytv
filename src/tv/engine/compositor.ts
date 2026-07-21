'use client';

import type { NowPlaying, ProgrammeKind } from '../../types';
import { formatClock } from './schedule';

/**
 * Paints one frame of broadcast onto a 2D canvas at CRT resolution.
 *
 * Everything the viewer sees — programme, station bug, clock, captions, the OSD
 * — is drawn *here*, into the same bitmap, so that when the shader warps and
 * scanlines the picture it warps the channel number too. HTML overlaid on the
 * canvas never gets that treatment and the eye notices immediately.
 */

export const W = 640;
export const H = 480;

const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const SERIF = 'Iowan Old Style, "Palatino Linotype", Palatino, Georgia, serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

type Style = {
  font: string;
  bg: [string, string];
  ink: string;
  accentInk: string;
  headingSize: number;
  bodySize: number;
  align: CanvasTextAlign;
  /** Body text is centred as a block rather than pinned to the top. */
  centreBlock: boolean;
  upperHeading: boolean;
};

const BASE: Style = {
  font: MONO,
  bg: ['#0b1410', '#04070a'],
  ink: '#d8f0e2',
  accentInk: '#7cfc9a',
  headingSize: 30,
  bodySize: 19,
  align: 'left',
  centreBlock: false,
  upperHeading: true,
};

const STYLES: Record<ProgrammeKind, Partial<Style>> = {
  poem: {
    font: SERIF,
    bg: ['#161022', '#05030a'],
    ink: '#e8e0ff',
    accentInk: '#c9b3ff',
    align: 'center',
    centreBlock: true,
    headingSize: 30,
    bodySize: 20,
    upperHeading: false,
  },
  scene: {
    font: SANS,
    bg: ['#12100c', '#05040a'],
    ink: '#efe6d4',
    accentInk: '#ffd479',
    headingSize: 34,
  },
  track: {
    bg: ['#1a0a18', '#06030a'],
    ink: '#ffe3f4',
    accentInk: '#ff86c8',
    headingSize: 32,
  },
  critter: {
    bg: ['#0a1a18', '#03080a'],
    ink: '#dcfaf0',
    accentInk: '#5ce8c0',
  },
  monologue: {
    bg: ['#181206', '#070403'],
    ink: '#ffeccd',
    accentInk: '#ffb000',
  },
  fact: {
    bg: ['#08131f', '#02060c'],
    ink: '#dceeff',
    accentInk: '#66c6ff',
  },
  archive: {
    font: SERIF,
    bg: ['#151109', '#070502'],
    ink: '#ece0c8',
    accentInk: '#d8a860',
    bodySize: 19,
  },
  ad: {
    font: SANS,
    bg: ['#2a0505', '#0d0202'],
    ink: '#fff3d6',
    accentInk: '#ff4f3a',
    headingSize: 42,
    align: 'center',
    upperHeading: true,
  },
  weather: {
    bg: ['#071522', '#02070d'],
    ink: '#d6f0ff',
    accentInk: '#7fd4ff',
  },
  shortfic: {
    font: SERIF,
    bg: ['#100d14', '#040308'],
    ink: '#e6e2ea',
    accentInk: '#b6a8d8',
    bodySize: 20,
    centreBlock: true,
  },
  ambient: {
    bg: ['#04080c', '#010204'],
    ink: '#9fc4d8',
    accentInk: '#6fa8c4',
    align: 'center',
    centreBlock: true,
    bodySize: 18,
  },
  book: {
    font: SERIF,
    bg: ['#120f0a', '#050403'],
    ink: '#f0e6d2',
    accentInk: '#e0b878',
    headingSize: 30,
    bodySize: 19,
  },
};

function styleFor(kind: ProgrammeKind): Style {
  return { ...BASE, ...(STYLES[kind] ?? {}) };
}

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const raw = text.split(/\s+/).filter(Boolean);
  if (!raw.length) return [''];

  // Glue a free-standing dash to the word after it. Otherwise a line can break
  // just before one and strand it alone on the next line, which looks like a
  // rendering fault rather than punctuation.
  const words: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (/^[-–—]$/.test(raw[i]) && i + 1 < raw.length) {
      words.push(`${raw[i]} ${raw[++i]}`);
    } else {
      words.push(raw[i]);
    }
  }
  const out: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width > maxWidth) {
      out.push(line);
      line = words[i];
    } else {
      line = candidate;
    }
  }
  out.push(line);
  return out;
}

/** Phosphor bleed: the same glyphs drawn once soft and once sharp. */
function glow(ctx: CanvasRenderingContext2D, draw: () => void, colour: string, amount = 10) {
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = amount;
  draw();
  ctx.shadowBlur = 0;
  draw();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// decorations — the small moving things that stop a card looking like a slide
// ---------------------------------------------------------------------------

function drawVisualiser(ctx: CanvasRenderingContext2D, t: number, colour: string) {
  const bars = 48;
  const baseY = H - 74;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < bars; i++) {
    // Layered sines fake a spectrum convincingly enough at this resolution.
    const seed = i * 0.37;
    const h =
      14 +
      Math.abs(Math.sin(t * 2.1 + seed) * 22) +
      Math.abs(Math.sin(t * 5.3 + seed * 2.4) * 14) +
      Math.abs(Math.sin(t * 0.9 + seed * 0.6) * 10);
    const x = 46 + i * ((W - 92) / bars);
    ctx.fillRect(x, baseY - h, (W - 92) / bars - 2, h);
  }
  ctx.restore();
}

function drawWeatherGlyph(ctx: CanvasRenderingContext2D, t: number, colour: string) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = (i * 97 + t * 40) % (W + 60) - 30;
    const y = ((i * 53 + t * 130) % (H + 60)) - 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAdFlash(ctx: CanvasRenderingContext2D, t: number, colour: string) {
  // A starburst behind the product name, rotating slowly.
  ctx.save();
  ctx.translate(W - 92, 96);
  ctx.rotate(t * 0.5);
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 === 0 ? 52 : 34;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// station ident — the first beat of every programme
// ---------------------------------------------------------------------------

function drawIdent(
  ctx: CanvasRenderingContext2D,
  np: NowPlaying,
  k: number, // 0..1 through the ident
) {
  const c = np.channel;
  ctx.save();
  ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // A colour field that wipes in from the left.
  const wipe = Math.min(1, k / 0.35);
  ctx.fillStyle = c.color;
  ctx.globalAlpha *= 0.22;
  ctx.fillRect(0, 0, W * wipe, H);
  ctx.globalAlpha /= 0.22;

  ctx.textAlign = 'center';
  ctx.fillStyle = c.color;
  ctx.font = `700 96px ${MONO}`;
  glow(ctx, () => ctx.fillText(String(c.num).padStart(2, '0'), W / 2, H / 2 - 6), c.color, 26);

  ctx.font = `600 26px ${MONO}`;
  ctx.fillStyle = '#ffffff';
  glow(ctx, () => ctx.fillText(c.name, W / 2, H / 2 + 46), c.color, 14);

  ctx.font = `14px ${MONO}`;
  ctx.globalAlpha *= 0.6;
  ctx.fillText(c.blurb.toUpperCase(), W / 2, H / 2 + 78);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// the main card
// ---------------------------------------------------------------------------

function drawProgramme(
  ctx: CanvasRenderingContext2D,
  np: NowPlaying,
  t: number,
  reduceMotion: boolean,
  captionsOn: boolean,
) {
  const p = np.programme;
  const s = styleFor(p.kind);
  const accent = p.kind === 'ad' ? s.accentInk : np.channel.color;

  // background
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, s.bg[0]);
  g.addColorStop(1, s.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // a slow wash of the channel colour, so each channel reads differently
  ctx.save();
  ctx.globalAlpha = 0.1 + Math.sin(t * 0.4) * 0.03;
  ctx.fillStyle = np.channel.color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (p.kind === 'weather') drawWeatherGlyph(ctx, t, s.accentInk);
  if (p.kind === 'ad') drawAdFlash(ctx, t, s.accentInk);

  // The footer and the caption line carry the same text — a caption of this
  // segment is exactly what the footer says. Printing both stacks the sentence
  // on top of itself. Captions win when they are on; the card keeps it when
  // they are off, so the line is never simply lost.
  const showFooter = Boolean(p.footer) && !captionsOn;
  const footerHeight = showFooter ? 46 : 0;

  // Decorations that live in the picture rather than behind it need their space
  // reserving too, or the autofit happily runs text straight through them —
  // MUSIC's spectrum bars sit across the bottom of the frame.
  const decorationHeight = p.kind === 'track' ? 84 : 0;

  const M = 46; // margin
  const maxW = W - M * 2;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = s.align;
  const cx = s.align === 'center' ? W / 2 : M;

  // ---- heading ----
  let y = 84;
  ctx.font = `700 ${s.headingSize}px ${s.font}`;
  const headingText = s.upperHeading ? p.heading.toUpperCase() : p.heading;
  const headingLines = wrap(ctx, headingText, maxW);
  ctx.fillStyle = s.accentInk;
  for (const line of headingLines) {
    const draw = () => ctx.fillText(line, cx, y);
    glow(ctx, draw, s.accentInk, 14);
    y += s.headingSize + 4;
  }

  // ---- subheading ----
  if (p.subheading) {
    ctx.font = `500 15px ${MONO}`;
    ctx.fillStyle = s.ink;
    ctx.globalAlpha = 0.72;
    for (const line of wrap(ctx, p.subheading.toUpperCase(), maxW)) {
      ctx.fillText(line, cx, y + 6);
      y += 20;
    }
    ctx.globalAlpha = 1;
  }

  // rule under the header block
  y += 14;
  ctx.save();
  ctx.strokeStyle = s.accentInk;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  if (s.align === 'center') {
    ctx.moveTo(W / 2 - 70, y);
    ctx.lineTo(W / 2 + 70, y);
  } else {
    ctx.moveTo(M, y);
    ctx.lineTo(W - M, y);
  }
  ctx.stroke();
  ctx.restore();
  y += 30;

  // ---- body ----
  //
  // Autofit. Segments are hand-written, so line counts vary a lot — a two-line
  // weather report and a fourteen-line Sappho fragment both have to land inside
  // the same tube. Shrink the type until the block fits the space left between
  // the header and the furniture, rather than letting long poems run off the
  // bottom of the screen and collide with the captions.
  const bodyBottom = H - (footerHeight + decorationHeight + 26);
  const available = bodyBottom - y;
  const leading = p.kind === 'poem' ? 11 : 8;

  let bodySize = s.bodySize;
  let bodyLineHeight = bodySize + leading;
  let wrapped: string[] = [];

  for (;;) {
    ctx.font = `${bodySize}px ${s.font}`;
    bodyLineHeight = bodySize + leading * (bodySize / s.bodySize);
    // Each source line is wrapped independently, so a poem's own line breaks and
    // a book review's blank lines survive — they are meaning, not formatting.
    wrapped = p.lines.flatMap((raw) => wrap(ctx, raw, maxW));
    if (wrapped.length * bodyLineHeight <= available || bodySize <= 11) break;
    bodySize -= 1;
  }

  const blockHeight = wrapped.length * bodyLineHeight;
  const bodyTop = s.centreBlock
    ? y + Math.max(0, (available - blockHeight) / 2)
    : y;

  // Lines arrive one at a time over the first stretch of the programme. It reads
  // as a broadcast unfolding rather than a slide that appeared.
  const revealWindow = Math.min(p.durationSec * 0.45, wrapped.length * 0.55);
  ctx.fillStyle = s.ink;
  for (let i = 0; i < wrapped.length; i++) {
    const lineY = bodyTop + i * bodyLineHeight;
    if (lineY > bodyBottom) break; // autofit should prevent this; belt and braces
    let alpha = 1;
    if (!reduceMotion && revealWindow > 0) {
      const due = (i / Math.max(1, wrapped.length)) * revealWindow;
      alpha = Math.min(1, Math.max(0, (t - due) / 0.45));
    }
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    ctx.fillText(wrapped[i], cx, lineY);
  }
  ctx.globalAlpha = 1;

  if (p.kind === 'track') drawVisualiser(ctx, t, accent);

  // ---- footer: the quote / disclaimer line ----
  if (showFooter) {
    const isQuote = p.kind === 'scene';
    ctx.save();
    ctx.textAlign = s.align === 'center' ? 'center' : 'left';
    ctx.font = isQuote ? `italic 19px ${SERIF}` : `13px ${MONO}`;
    ctx.fillStyle = isQuote ? s.accentInk : s.ink;
    ctx.globalAlpha = isQuote ? 0.95 : 0.55;
    const text = isQuote ? `"${p.footer}"` : p.footer;
    const lines = wrap(ctx, text, maxW);
    let fy = H - 86 - (lines.length - 1) * 22;
    for (const line of lines) {
      ctx.fillText(line, cx, fy);
      fy += 22;
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// permanent furniture: station bug, clock, captions, OSD
// ---------------------------------------------------------------------------

/**
 * A real video frame, scaled to cover the 4:3 tube. Broadcast never letterboxes
 * within the frame — it crops — and cropping is what makes the picture feel like
 * it belongs to the set rather than being pasted onto it.
 */
function drawVideo(ctx: CanvasRenderingContext2D, el: HTMLVideoElement) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const vw = el.videoWidth;
  const vh = el.videoHeight;
  if (!vw || !vh) return;

  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  np: NowPlaying,
  captionsOn: boolean,
  captionText: string | null,
) {
  const c = np.channel;

  // bottom scrim so furniture stays legible over any card
  const g = ctx.createLinearGradient(0, H - 78, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 78, W, 78);

  // station bug, bottom left
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 15px ${MONO}`;
  ctx.fillStyle = c.color;
  glow(ctx, () => ctx.fillText(`${String(c.num).padStart(2, '0')} ${c.name}`, 24, H - 26), c.color, 10);
  ctx.restore();

  // programme timer, bottom right
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = `14px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  const remaining = np.programme.durationSec - np.offset;
  ctx.fillText(formatClock(remaining), W - 24, H - 26);
  ctx.restore();

  // progress hairline
  ctx.save();
  ctx.fillStyle = c.color;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, H - 4, W * np.progress, 3);
  ctx.restore();

  // Captions. For a real video these are parsed WebVTT cues; for a text card the
  // programme's own footer stands in, which is what a captioned broadcast of
  // that segment would actually carry.
  const caption =
    captionText ?? (np.programme.kind !== 'ad' ? np.programme.footer : '');
  if (captionsOn && caption) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `16px ${MONO}`;
    const lines = wrap(ctx, caption.toUpperCase(), W - 80);
    let cy = H - 68 - (lines.length - 1) * 24;
    for (const line of lines) {
      const width = Math.min(W - 50, ctx.measureText(line).width + 26);
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(W / 2 - width / 2, cy, width, 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, W / 2, cy + 18);
      cy += 24;
    }
    ctx.restore();
  }
}

export type OsdPaint =
  | { kind: 'none' }
  | { kind: 'channel'; num: number; name: string }
  | { kind: 'volume'; value: number; muted: boolean }
  | { kind: 'message'; text: string };

function drawOsd(ctx: CanvasRenderingContext2D, osd: OsdPaint, colour: string) {
  if (osd.kind === 'none') return;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  if (osd.kind === 'channel') {
    ctx.textAlign = 'right';
    ctx.font = `700 64px ${MONO}`;
    ctx.fillStyle = colour;
    glow(ctx, () => ctx.fillText(String(osd.num).padStart(2, '0'), W - 30, 92), colour, 22);
    ctx.font = `600 17px ${MONO}`;
    ctx.fillStyle = '#ffffff';
    glow(ctx, () => ctx.fillText(osd.name, W - 30, 118), colour, 10);
  }

  if (osd.kind === 'volume') {
    const barW = 260;
    const x = (W - barW) / 2;
    const y = H - 132;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 14, y - 30, barW + 28, 56);
    ctx.textAlign = 'left';
    ctx.font = `600 14px ${MONO}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(osd.muted ? 'MUTED' : 'VOLUME', x, y - 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(x, y, barW, 14);
    ctx.fillStyle = osd.muted ? 'rgba(255,255,255,0.28)' : colour;
    ctx.fillRect(x + 2, y + 2, (barW - 4) * osd.value, 10);
  }

  if (osd.kind === 'message') {
    ctx.textAlign = 'center';
    ctx.font = `600 22px ${MONO}`;
    const w = ctx.measureText(osd.text).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.66)';
    ctx.fillRect(W / 2 - w / 2, 52, w, 44);
    ctx.fillStyle = colour;
    glow(ctx, () => ctx.fillText(osd.text, W / 2, 82), colour, 12);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// no signal / standby
// ---------------------------------------------------------------------------

const BAR_COLOURS = [
  '#c0c0c0', '#c0c000', '#00c0c0', '#00c000',
  '#c000c0', '#c00000', '#0000c0', '#101010',
];

export function drawTestCard(ctx: CanvasRenderingContext2D, t: number, subtitle: string) {
  const barW = W / BAR_COLOURS.length;
  BAR_COLOURS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * barW, 0, barW + 1, H * 0.72);
  });
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  ctx.textAlign = 'center';
  ctx.font = `600 22px ${MONO}`;
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText('STARRY TV — STANDBY', W / 2, H * 0.86);
  ctx.font = `14px ${MONO}`;
  ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.35;
  ctx.fillText(subtitle, W / 2, H * 0.92);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

export type FrameInput = {
  now: NowPlaying | null;
  power: boolean;
  captions: boolean;
  osd: OsdPaint;
  /** Seconds since this channel was tuned — drives the ident. */
  sinceTune: number;
  reduceMotion: boolean;
  clock: number;
  /** A live video element to paint instead of the text card, when one exists. */
  video?: HTMLVideoElement | null;
  /** Parsed WebVTT cue text for the current moment, when there is one. */
  caption?: string | null;
};

export const IDENT_SEC = 2.1;

export function paintFrame(ctx: CanvasRenderingContext2D, input: FrameInput) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (!input.power || !input.now) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // A set that is on but has nothing to show still shows *something* — a black
    // rectangle reads as a bug, a test card reads as a television.
    drawTestCard(
      ctx,
      input.clock,
      input.power ? 'NO SIGNAL ON THIS CHANNEL' : 'PRESS POWER TO BEGIN',
    );
    ctx.restore();
    return;
  }

  if (input.video) {
    drawVideo(ctx, input.video);
  } else {
    drawProgramme(ctx, input.now, input.now.offset, input.reduceMotion, input.captions);
  }
  drawFurniture(ctx, input.now, input.captions, input.caption ?? null);

  // The ident sits on top of the programme, which is already running underneath
  // — exactly like tuning into a show that started without you.
  if (input.sinceTune < IDENT_SEC && !input.reduceMotion) {
    drawIdent(ctx, input.now, input.sinceTune / IDENT_SEC);
  }

  drawOsd(ctx, input.osd, input.now.channel.color);
  ctx.restore();
}
