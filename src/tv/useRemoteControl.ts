import { useCallback, useEffect } from 'react';
import { useTv } from './store';
import { tvAudio } from './engine/audio';

/**
 * One place where a "button press" is defined, whether it came from the on-screen
 * remote, the TV's front panel, or the keyboard. Every path goes through
 * `press`, so the click sound and the state change can never drift apart.
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
    const s = useTv.getState();

    // Any button is a user gesture, which is our one chance to start audio.
    tvAudio.unlock();
    tvAudio.setVolume(s.volume, s.muted);

    switch (cmd.type) {
      case 'POWER': {
        const next = !s.power;
        s.setPower(next);
        tvAudio.setPower(next);
        break;
      }
      case 'CHANNEL_UP':
      case 'CHANNEL_DOWN':
      case 'CHANNEL':
      case 'DIGIT': {
        if (!s.power) {
          // Pressing a channel button on a set that's off turns it on first,
          // the way a real remote does.
          s.setPower(true);
          tvAudio.setPower(true);
        }
        tvAudio.click();
        if (cmd.type === 'CHANNEL_UP') s.channelStep(1);
        if (cmd.type === 'CHANNEL_DOWN') s.channelStep(-1);
        if (cmd.type === 'CHANNEL') s.setChannel(cmd.num);
        if (cmd.type === 'DIGIT') s.pressDigit(cmd.digit);
        if (cmd.type !== 'DIGIT') tvAudio.staticBurst();
        break;
      }
      case 'VOLUME_UP':
        tvAudio.click(true);
        s.volumeStep(0.1);
        tvAudio.setVolume(useTv.getState().volume, useTv.getState().muted);
        break;
      case 'VOLUME_DOWN':
        tvAudio.click(true);
        s.volumeStep(-0.1);
        tvAudio.setVolume(useTv.getState().volume, useTv.getState().muted);
        break;
      case 'MUTE':
        s.toggleMute();
        tvAudio.setVolume(useTv.getState().volume, useTv.getState().muted);
        tvAudio.blip(!useTv.getState().muted);
        break;
      case 'CAPTIONS':
        tvAudio.click(true);
        s.toggleCaptions();
        break;
      case 'GUIDE':
        tvAudio.click(true);
        s.toggleGuide();
        break;
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
