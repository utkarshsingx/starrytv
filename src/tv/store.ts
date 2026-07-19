import { create } from 'zustand';
import { channels } from '../content/channels';
import { tvAudio } from './engine/audio';

/**
 * All TV state lives here, deliberately outside React's render tree — the CRT
 * canvas runs its own rAF loop at 60fps and must never be driving re-renders.
 * Components subscribe to the slices they actually paint.
 */

export type Osd =
  | { kind: 'none' }
  | { kind: 'channel'; num: number; name: string }
  | { kind: 'volume'; value: number; muted: boolean }
  | { kind: 'message'; text: string };

type TvState = {
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

const numbers = channels.map((c) => c.num).sort((a, b) => a - b);
const FIRST = numbers[0] ?? 2;

/** Read ?ch=07 so channels are deep-linkable. */
function initialChannel(): number {
  if (typeof window === 'undefined') return FIRST;
  const raw = new URLSearchParams(window.location.search).get('ch');
  const n = raw ? parseInt(raw, 10) : NaN;
  return numbers.includes(n) ? n : FIRST;
}

let osdTimer: ReturnType<typeof setTimeout> | undefined;
let keypadTimer: ReturnType<typeof setTimeout> | undefined;

export const useTv = create<TvState>((set, get) => ({
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

  setPower: (on) => {
    set({ power: on, tunedAt: Date.now(), poweredAt: Date.now(), staticLevel: on ? 1 : 0 });
    if (on) {
      const c = channels.find((x) => x.num === get().channelNum);
      if (c) get().showOsd({ kind: 'channel', num: c.num, name: c.name });
    }
  },
  togglePower: () => get().setPower(!get().power),

  setChannel: (num) => {
    const c = channels.find((x) => x.num === num);
    if (!c) {
      get().showOsd({ kind: 'message', text: `NO SIGNAL — CH ${String(num).padStart(2, '0')}` });
      tvAudio.noSignal();
      return;
    }
    set({ channelNum: num, staticLevel: 1, tunedAt: Date.now(), guideOpen: false });
    get().showOsd({ kind: 'channel', num: c.num, name: c.name });

    const url = new URL(window.location.href);
    url.searchParams.set('ch', String(num).padStart(2, '0'));
    window.history.replaceState({}, '', url);
  },

  channelStep: (delta) => {
    const i = numbers.indexOf(get().channelNum);
    const next = numbers[(i + delta + numbers.length) % numbers.length];
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
