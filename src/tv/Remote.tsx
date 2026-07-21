'use client';

import { useTv } from './store';
import type { Command } from './useRemoteControl';

type Props = { press: (cmd: Command) => void };

/**
 * The handset. Deliberately a real, focusable, labelled set of buttons rather
 * than hotspots on an image — it is the primary control surface on touch, and
 * it is how a keyboard or screen-reader user drives the set.
 */
export function Remote({ press }: Props) {
  const power = useTv((s) => s.power);
  const muted = useTv((s) => s.muted);
  const captions = useTv((s) => s.captions);

  return (
    <div className="remote" role="group" aria-label="Television remote control">
      <div className="remote-brand">STARRY</div>

      <button
        className={`btn btn-power ${power ? 'is-on' : ''}`}
        onClick={() => press({ type: 'POWER' })}
        aria-pressed={power}
        aria-label={power ? 'Power off' : 'Power on'}
      >
        <span className="power-glyph" aria-hidden="true" />
      </button>

      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            className="btn btn-num"
            onClick={() => press({ type: 'DIGIT', digit: d })}
            aria-label={`Digit ${d}`}
          >
            {d}
          </button>
        ))}
        <button
          className="btn btn-num btn-zero"
          onClick={() => press({ type: 'DIGIT', digit: '0' })}
          aria-label="Digit 0"
        >
          0
        </button>
      </div>

      <div className="remote-lower">
        <div className="rocker" role="group" aria-label="Volume">
          <button className="btn btn-rocker" onClick={() => press({ type: 'VOLUME_UP' })} aria-label="Volume up">
            +
          </button>
          <span className="rocker-label">VOL</span>
          <button className="btn btn-rocker" onClick={() => press({ type: 'VOLUME_DOWN' })} aria-label="Volume down">
            −
          </button>
        </div>

        <div className="remote-mid">
          <button
            className={`btn btn-small ${muted ? 'is-active' : ''}`}
            onClick={() => press({ type: 'MUTE' })}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <span aria-hidden="true">🔇</span>
          </button>
          <button
            className={`btn btn-small ${captions ? 'is-active' : ''}`}
            onClick={() => press({ type: 'CAPTIONS' })}
            aria-pressed={captions}
            aria-label={captions ? 'Turn captions off' : 'Turn captions on'}
          >
            <span aria-hidden="true">CC</span>
          </button>
        </div>

        <div className="rocker" role="group" aria-label="Channel">
          <button className="btn btn-rocker" onClick={() => press({ type: 'CHANNEL_UP' })} aria-label="Channel up">
            ⌃
          </button>
          <span className="rocker-label">CH</span>
          <button className="btn btn-rocker" onClick={() => press({ type: 'CHANNEL_DOWN' })} aria-label="Channel down">
            ⌄
          </button>
        </div>
      </div>

      <button className="btn btn-wide" onClick={() => press({ type: 'GUIDE' })} aria-label="Open channel guide">
        GUIDE
      </button>
    </div>
  );
}
