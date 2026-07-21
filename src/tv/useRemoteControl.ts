'use client';

import { useCallback, useEffect } from 'react';
import { useTv } from './store';
import { tvAudio } from './engine/audio';
import { channelByNum } from './store';

/**
 * One place where a "button press" is defined, whether it came from the on-screen
 * remote, the TV's front panel, or the keyboard. Every path goes through
 * `press`, so the sound and the state change can never drift apart.
 */

export type Command =
  | { type: 'POWER' }
  | { type: 'CHANNEL_UP' }
  | { type: 'CHANNEL_DOWN' }
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' }
  | { type: 'MUTE' }
  | { type: 'CAPTIONS' }
  | { type: 'GUIDE' }
  | { type: 'DIGIT'; digit: string }
  | { type: 'CHANNEL'; num: number };

export function useRemoteControl() {
  const press = useCallback((cmd: Command) => {
    const before = useTv.getState();

    // Any button is a user gesture, which is our one chance to start audio.
    tvAudio.unlock();
    tvAudio.setVolume(before.volume, before.muted);

    switch (cmd.type) {
      case 'POWER': {
        const next = !before.power;
        before.setPower(next);
        if (next) {
          tvAudio.powerOn();
          const after = useTv.getState();
          tvAudio.setVolume(after.volume, after.muted);
          // The bed arrives once the tube has warmed, not on the same frame as
          // the relay.
          const ch = channelByNum(after.channelNum);
          if (ch) window.setTimeout(() => tvAudio.resumeBed(ch.slug), 900);
        } else {
          tvAudio.powerOff();
        }
        break;
      }

      case 'CHANNEL_UP':
      case 'CHANNEL_DOWN':
      case 'CHANNEL':
      case 'DIGIT': {
        if (!before.power) {
          // Pressing a channel button on a set that's off turns it on first,
          // the way a real remote does.
          before.setPower(true);
          tvAudio.powerOn();
          tvAudio.setVolume(before.volume, before.muted);
        }

        // The keypad and the channel rocker are different mouldings and sound
        // like it: the keypad has a bright plastic tick, the rocker has none.
        if (cmd.type === 'DIGIT') tvAudio.keypad();
        else tvAudio.rocker();

        if (cmd.type === 'CHANNEL_UP') before.channelStep(1);
        if (cmd.type === 'CHANNEL_DOWN') before.channelStep(-1);
        if (cmd.type === 'CHANNEL') before.setChannel(cmd.num);
        if (cmd.type === 'DIGIT') before.pressDigit(cmd.digit);

        // Digits only tune once the keypad buffer settles, so the tuning
        // sequence is fired from the store's channel change instead — see the
        // subscription at the bottom of this file.
        break;
      }

      case 'VOLUME_UP':
      case 'VOLUME_DOWN': {
        before.volumeStep(cmd.type === 'VOLUME_UP' ? 0.1 : -0.1);
        const after = useTv.getState();
        tvAudio.volumeDetent(after.volume);
        tvAudio.setVolume(after.volume, after.muted);
        break;
      }

      case 'MUTE': {
        before.toggleMute();
        const after = useTv.getState();
        tvAudio.setVolume(after.volume, after.muted);
        tvAudio.muteToggle(after.muted);
        break;
      }

      case 'CAPTIONS': {
        before.toggleCaptions();
        tvAudio.captionsToggle(useTv.getState().captions);
        break;
      }

      case 'GUIDE': {
        before.toggleGuide();
        tvAudio.guide(useTv.getState().guideOpen);
        break;
      }
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack typing in a field, and never break browser shortcuts.
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const map: Record<string, Command> = {
        ArrowUp: { type: 'CHANNEL_UP' },
        ArrowDown: { type: 'CHANNEL_DOWN' },
        ArrowRight: { type: 'VOLUME_UP' },
        ArrowLeft: { type: 'VOLUME_DOWN' },
        m: { type: 'MUTE' },
        c: { type: 'CAPTIONS' },
        g: { type: 'GUIDE' },
        p: { type: 'POWER' },
      };

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press({ type: 'DIGIT', digit: e.key });
        return;
      }

      const cmd = map[e.key] ?? map[e.key.toLowerCase()];
      if (cmd) {
        e.preventDefault();
        press(cmd);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return press;
}

/**
 * Fire the tuning sequence whenever the channel actually changes, from wherever
 * — remote, keypad buffer, guide, or a deep link. Subscribing to the state is
 * the only way to catch all of them in one place; wiring it into each caller
 * guarantees one of them will eventually be forgotten.
 */
useTv.subscribe((state, prev) => {
  if (state.channelNum === prev.channelNum) return;
  const ch = channelByNum(state.channelNum);
  if (ch) tvAudio.tune(ch.slug);
});

/** Keyboard shortcuts, for the help panel. */
export const SHORTCUTS: [string, string][] = [
  ['↑ ↓', 'change channel'],
  ['← →', 'volume'],
  ['0–9', 'tune directly'],
  ['M', 'mute'],
  ['C', 'captions'],
  ['G', 'channel guide'],
  ['P', 'power'],
];
