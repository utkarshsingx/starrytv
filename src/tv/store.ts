'use client';

import { create } from 'zustand';
import type { Channel } from '../types';
import { tvAudio } from './engine/audio';
import { MINIMAL_CHANNELS } from './minimal-schedule';
import { loadSchedule, type ScheduleSource } from './schedule-manifest';

/**
 * All TV state lives here, deliberately outside React's render tree — the CRT
 * canvas runs its own rAF loop at 60fps and must never be driving re-renders.
 * Components subscribe to the slices they actually paint.
 *
 * The dial itself now lives here too. It used to be a module-scope
 * `import { channels } from '../content/channels'`, which was the single line
 * welding three hundred kilobytes of book and programme prose into every client
 * bundle — downloaded and parsed by every visitor, including the ones who never
 * switched the set on. The schedule is fetched instead (`schedule-manifest.ts`),
 * and this store is where it lands.
 */

export type Osd =
  | { kind: 'none' }
  | { kind: 'channel'; num: number; name: string }
  | { kind: 'volume'; value: number; muted: boolean }
  | { kind: 'message'; text: string };

type TvState = {
  /**
   * The dial. Starts as the bundled minimum so that every consumer has a real
   * array to work with from the first render — there is no "channels are not
   * loaded yet" state to handle at each call site, only a schedule that gets
   * better once the manifest lands.
   */
  channels: Channel[];
  scheduleSource: ScheduleSource;

  power: boolean;
  channelNum: number;
  volume: number;
  muted: boolean;
  captions: boolean;
  guideOpen: boolean;

  /** Digits typed on the keypad, cleared after a beat. */
  keypad: string;

  /** 0..1 — how much static the shader should be mixing in right now. */
  staticLevel: number;
  /** Wall-clock ms when the current tune-in started, for the warm-up wipe. */
  tunedAt: number;
  /** Wall-clock ms when the set was last switched on or off. */
  poweredAt: number;

  osd: Osd;

  loadManifest: () => Promise<void>;
  setPower: (on: boolean) => void;
  togglePower: () => void;
  setChannel: (num: number) => void;
  channelStep: (delta: number) => void;
  setVolume: (v: number) => void;
  volumeStep: (delta: number) => void;
  toggleMute: () => void;
  toggleCaptions: () => void;
  toggleGuide: () => void;
  pressDigit: (d: string) => void;
  setStatic: (v: number) => void;
  showOsd: (osd: Osd) => void;
  clearOsd: () => void;
};

/** Where the dial rests on a set that has just been unboxed. */
const FIRST = 2;

const dialOf = (list: Channel[]) => list.map((c) => c.num).sort((a, b) => a - b);

/**
 * Read ?ch=07 so channels are deep-linkable.
 *
 * This can no longer check the number against the real dial, because the dial
 * has not been fetched yet — so it accepts any plausible channel number and
 * `loadManifest` reconciles it once the schedule is in. A number that turns out
 * not to exist snaps to the first real channel rather than leaving the set
 * tuned to nothing.
 */
function initialChannel(): number {
  if (typeof window === 'undefined') return FIRST;
  const raw = new URLSearchParams(window.location.search).get('ch');
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n >= 0 && n < 100 ? n : FIRST;
}

let osdTimer: ReturnType<typeof setTimeout> | undefined;
let keypadTimer: ReturnType<typeof setTimeout> | undefined;

export const useTv = create<TvState>((set, get) => ({
  channels: MINIMAL_CHANNELS,
  scheduleSource: 'minimal',

  power: false,
  channelNum: initialChannel(),
  volume: 0.7,
  muted: false,
  captions: true,
  guideOpen: false,
  keypad: '',
  staticLevel: 1,
  tunedAt: Date.now(),
  poweredAt: Date.now(),
  osd: { kind: 'none' },

  loadManifest: async () => {
    // Already holding the real schedule — a second trip to /tv in the same
    // session should not refetch it. Cache and minimal both retry, because
    // either means the network was unavailable and it may not be any more.
    if (get().scheduleSource === 'network') return;

    const { channels, source } = await loadSchedule();

    // The URL asked for a channel before we knew which ones exist. Honour it if
    // it turned out to be real; otherwise land on the first channel rather than
    // sitting on a number that will never produce a picture.
    const dial = dialOf(channels);
    const wanted = get().channelNum;
    const channelNum = dial.includes(wanted) ? wanted : (dial[0] ?? FIRST);

    set({ channels, scheduleSource: source, channelNum });
  },

  setPower: (on) => {
    set({ power: on, tunedAt: Date.now(), poweredAt: Date.now(), staticLevel: on ? 1 : 0 });
    if (on) {
      const c = get().channels.find((x) => x.num === get().channelNum);
      if (c) get().showOsd({ kind: 'channel', num: c.num, name: c.name });
    }
  },
  togglePower: () => get().setPower(!get().power),

  setChannel: (num) => {
    const c = get().channels.find((x) => x.num === num);
    if (!c) {
      get().showOsd({ kind: 'message', text: `NO SIGNAL — CH ${String(num).padStart(2, '0')}` });
      tvAudio.noSignal();
      return;
    }
    set({ channelNum: num, staticLevel: 1, tunedAt: Date.now(), guideOpen: false });
    get().showOsd({ kind: 'channel', num: c.num, name: c.name });

    // Deliberately `history.replaceState` and not the Next router.
    //
    // Tuning is not navigation: it happens inside a 60fps rAF loop driving a
    // WebGL shader and a synthesised audio engine, and routing it through
    // `router.replace()` would fire an RSC request on every channel change and
    // re-render the tree under the canvas. The query string is a bookmarkable
    // record of where the dial is, nothing more, so writing it directly is both
    // cheaper and more truthful.
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('ch', String(num).padStart(2, '0'));
    window.history.replaceState({}, '', url);
  },

  channelStep: (delta) => {
    const dial = dialOf(get().channels);
    if (dial.length === 0) return;
    const i = dial.indexOf(get().channelNum);
    const next = dial[(i + delta + dial.length) % dial.length];
    get().setChannel(next);
  },

  setVolume: (v) => {
    const value = Math.min(1, Math.max(0, v));
    set({ volume: value, muted: value === 0 ? get().muted : false });
    get().showOsd({ kind: 'volume', value, muted: get().muted });
  },
  volumeStep: (delta) => get().setVolume(Math.round((get().volume + delta) * 100) / 100),

  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    get().showOsd({ kind: 'volume', value: get().volume, muted });
  },

  toggleCaptions: () => {
    const captions = !get().captions;
    set({ captions });
    get().showOsd({ kind: 'message', text: captions ? 'CAPTIONS ON' : 'CAPTIONS OFF' });
  },

  toggleGuide: () => set({ guideOpen: !get().guideOpen }),

  pressDigit: (d) => {
    const keypad = (get().keypad + d).slice(-2);
    set({ keypad });
    get().showOsd({ kind: 'message', text: `CH ${keypad.padStart(2, '-')}` });
    clearTimeout(keypadTimer);
    // Two digits tunes immediately; one digit waits in case a second follows.
    keypadTimer = setTimeout(
      () => {
        const num = parseInt(get().keypad, 10);
        set({ keypad: '' });
        if (!Number.isNaN(num)) get().setChannel(num);
      },
      keypad.length >= 2 ? 250 : 1100,
    );
  },

  setStatic: (v) => set({ staticLevel: v }),

  showOsd: (osd) => {
    set({ osd });
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => set({ osd: { kind: 'none' } }), 2200);
  },
  clearOsd: () => set({ osd: { kind: 'none' } }),
}));

/** Non-reactive read, for the animation loop. */
export const tvState = () => useTv.getState();

/**
 * Dial lookups.
 *
 * These were exports of `content/channels.ts` and are store helpers now, for the
 * same reason the array moved: reading them from anywhere else would re-import
 * the content module and undo the cut. Neither is reactive — components that
 * need to re-render on a channel change subscribe to `channelNum` and call
 * these, which is what they already did.
 */
export const channelByNum = (num: number) =>
  useTv.getState().channels.find((c) => c.num === num);

export const channelBySlug = (slug: string) =>
  useTv.getState().channels.find((c) => c.slug === slug);
