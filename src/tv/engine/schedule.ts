import type { Channel, NowPlaying } from '../../types';

/**
 * The broadcast clock.
 *
 * Nothing about playback is stored. What is on air is a pure function of the
 * wall clock, so every viewer who loads the page at the same second sees the
 * same frame — and tuning away and back lands you where the programme has got
 * to, not where you left it. That is the whole feeling of live TV.
 */

/** Sign-on. Everything is measured from here. */
export const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);

/** Seconds since the station signed on. */
export function elapsed(now = Date.now()): number {
  return (now - EPOCH) / 1000;
}

/** Total runtime of one loop of a channel's schedule. */
export function loopDuration(channel: Channel): number {
  return channel.programmes.reduce((n, p) => n + p.durationSec, 0);
}

/**
 * Each channel gets a fixed offset into its own loop so the channels are not
 * all sitting at the top of their schedules at the same moment. Derived from
 * the channel number, so it stays stable across reloads and across viewers.
 */
function channelPhase(channel: Channel): number {
  const total = loopDuration(channel);
  if (total <= 0) return 0;
  // Cheap deterministic hash of the slug, so adding a channel does not reshuffle
  // the others.
  let h = channel.num * 2654435761;
  for (let i = 0; i < channel.slug.length; i++) {
    h = (h ^ channel.slug.charCodeAt(i)) * 16777619;
    h >>>= 0;
  }
  return (h % 100000) / 100000 * total;
}

export function nowPlaying(channel: Channel, now = Date.now()): NowPlaying | null {
  const total = loopDuration(channel);
  if (total <= 0 || channel.programmes.length === 0) return null;

  let t = (elapsed(now) + channelPhase(channel)) % total;
  if (t < 0) t += total;

  let acc = 0;
  for (let i = 0; i < channel.programmes.length; i++) {
    const p = channel.programmes[i];
    if (t < acc + p.durationSec) {
      const offset = t - acc;
      return {
        channel,
        programme: p,
        index: i,
        offset,
        progress: offset / p.durationSec,
      };
    }
    acc += p.durationSec;
  }

  // Floating-point tail: fall through to the last programme.
  const last = channel.programmes.length - 1;
  return {
    channel,
    programme: channel.programmes[last],
    index: last,
    offset: 0,
    progress: 0,
  };
}

/** The next few programmes on a channel — used to build the on-screen guide. */
export function upNext(channel: Channel, count = 4, now = Date.now()) {
  const current = nowPlaying(channel, now);
  if (!current) return [];
  const out: { programme: Channel['programmes'][number]; startsInSec: number }[] = [];
  let startsIn = current.programme.durationSec - current.offset;
  for (let i = 1; i <= count; i++) {
    const p = channel.programmes[(current.index + i) % channel.programmes.length];
    out.push({ programme: p, startsInSec: startsIn });
    startsIn += p.durationSec;
  }
  return out;
}

/** "01:19" — the broadcast timer on the TV's front panel. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60) % 100).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
