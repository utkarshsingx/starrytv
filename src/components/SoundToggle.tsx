'use client';

import { useSyncExternalStore } from 'react';
import { tvAudio, readPref, subscribeToPref } from '../tv/engine/audio';

/**
 * One switch for every noise the site makes, in both modes.
 *
 * This exists because the site now makes sound in places people will not expect
 * it — a plain text page that ticks when you type is charming right up until it
 * is not, and the answer to that is a visible off switch rather than a quieter
 * tick. The preference persists, so it only has to be found once.
 *
 * Both editions render one of these at the same time (the Boring Edition is
 * never unmounted), so the state is read from an external store. With component
 * state, flipping the toggle in one would leave the other showing the opposite
 * label.
 */
export function SoundToggle({ className = '' }: { className?: string }) {
  const pref = useSyncExternalStore(subscribeToPref, readPref, () => 'on' as const);

  const toggle = () => {
    const next = pref === 'on' ? 'off' : 'on';
    // Unlock first, so that switching sound *on* can be confirmed audibly — this
    // click is the gesture that permits it.
    tvAudio.unlock();
    tvAudio.setEnabled(next);
    if (next === 'on') tvAudio.pageJump();
  };

  return (
    <button
      className={`sound-toggle ${className}`}
      onClick={toggle}
      aria-pressed={pref === 'on'}
      title={pref === 'on' ? 'Turn sound off' : 'Turn sound on'}
    >
      <span aria-hidden="true">{pref === 'on' ? '🔊' : '🔇'}</span>
      <span className="sr-only">{pref === 'on' ? 'Sound is on' : 'Sound is off'}</span>
      <span className="sound-toggle-label" aria-hidden="true">
        {pref === 'on' ? 'SOUND ON' : 'SOUND OFF'}
      </span>
    </button>
  );
}
