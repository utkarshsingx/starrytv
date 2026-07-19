import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/env';
import { tvAudio } from './engine/audio';

const LINES = [
  'STARRY BROADCASTING SYSTEM',
  'ROM v2.6 — 64K CHARACTER GENERATOR OK',
  'DEGAUSSING COIL .................. OK',
  'PHOSPHOR MASK .................... OK',
  'VERTICAL HOLD .................... OK',
  'TUNER SWEEP 02–13 ................ 12 CHANNELS FOUND',
  '',
  'LOADING NOT BORING MODE',
];

/**
 * The boot screen. It exists to buy the two seconds the tube needs to warm up,
 * and because arriving somewhere should feel like arriving somewhere.
 *
 * Skippable by any key or click — a loading screen you cannot escape is just a
 * delay with a costume on.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          setShown(i + 1);
          // The line that says it is sweeping the tuner actually sweeps it.
          if (line.startsWith('TUNER SWEEP')) tvAudio.tunerSweep();
          // The blank line gets the paper feed and no strikes; the last line is
          // longer, so it earns more of them.
          else if (!line) tvAudio.paperAdvance();
          else tvAudio.bootLine(i, line === 'LOADING NOT BORING MODE' ? 6 : 4);
        }, 170 + i * 190),
      );
    });
    timers.push(setTimeout(finish, 170 + LINES.length * 190 + 620));

    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [onDone]);

  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-inner">
        {LINES.slice(0, shown).map((line, i) => (
          <p key={i} className={line === 'LOADING NOT BORING MODE' ? 'boot-final' : undefined}>
            {line || ' '}
          </p>
        ))}
        <span className="boot-caret" aria-hidden="true" />
      </div>
      <p className="boot-skip">press any key to skip</p>
    </div>
  );
}
