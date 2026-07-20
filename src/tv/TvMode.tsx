import { useEffect, useRef, useState } from 'react';
import { CrtScreen } from './CrtScreen';
import { Remote } from './Remote';
import { Guide } from './Guide';
import { useTv } from './store';
import { useRemoteControl, SHORTCUTS } from './useRemoteControl';
import { tvAudio } from './engine/audio';
import { channels } from '../content/channels';
import { allBooks } from '../content/library';
import { primaryLink } from '../lib/links';
import { SoundToggle } from '../components/SoundToggle';
import { nowPlaying, formatClock } from './engine/schedule';
import './tv.css';

type Props = { onExit: () => void };

export function TvMode({ onExit }: Props) {
  const press = useRemoteControl();
  const floorRef = useRef<HTMLCanvasElement | null>(null);
  const power = useTv((s) => s.power);
  const channelNum = useTv((s) => s.channelNum);
  const guideOpen = useTv((s) => s.guideOpen);
  const captions = useTv((s) => s.captions);
  const muted = useTv((s) => s.muted);

  // A once-a-second tick is enough for the panel text; the tube has its own
  // 60fps loop and does not depend on this.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useTv.getState().guideOpen) useTv.getState().toggleGuide();
        else onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  // NOTE: deliberately no `powerOff()` on unmount. The set's power is store
  // state and is switched off by `exitTv`, which is the only way out of here.
  // Hanging it off this component's teardown looked like belt and braces but
  // React's StrictMode mounts, unmounts and remounts in development — so the
  // teardown fired immediately after power-on, leaving the engine convinced the
  // set was off and silently swallowing every tuning sequence after it.

  const channel = channels.find((c) => c.num === channelNum);
  const np = channel ? nowPlaying(channel) : null;
  const book =
    np?.programme.kind === 'book'
      ? allBooks.find((b) => b.title === np.programme.heading)
      : undefined;

  // A programme ending and the next beginning is a real broadcast event, so it
  // gets a real (very quiet) sound. Watching the programme id rather than a
  // timer means it fires on the actual boundary — and only on a boundary, not
  // on every one of the twice-a-second ticks above.
  const programmeId = np?.programme.id;
  const lastProgramme = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastProgramme.current && programmeId && lastProgramme.current !== programmeId) {
      tvAudio.segmentChange();
    }
    lastProgramme.current = programmeId;
  }, [programmeId]);

  return (
    /*
      The room's light comes from the tube, so the colour of the room is the
      colour of what is on. Handing the current channel's tint to CSS means the
      cabinet, the bezel chamfer and the pool on the floor all shift when you
      change channel — violet on POETRY, red on ADVERTS — instead of the set
      being lit by an imaginary fixed lamp.
    */
    <div
      className="tv-mode"
      style={
        {
          '--screen-light': power && channel ? channel.color : '#3a4048',
        } as React.CSSProperties
      }
    >
      <div className="tv-room" aria-hidden="true" />

      <header className="tv-topbar">
        <div className="tv-topbar-left">
          <button className="tv-exit" onClick={onExit} aria-label="Back to the Boring Edition">
            <span aria-hidden="true">✕</span>
            <span className="tv-exit-label">BORING MODE</span>
          </button>
          <SoundToggle />
        </div>
        <div className="tv-wordmark">
          STARRY TV<span className="tv-wordmark-sub">THE NOT BORING EDITION</span>
        </div>
      </header>

      <div className="tv-stage">
        {/* The set and its reflection are one grid cell — the reflection has to
            sit directly under the chassis, not in the next column along. */}
        <div className="tv-set-column">
          <div className="tv-set">
            <div className="tv-bezel">
              <CrtScreen floorRef={floorRef} />
            </div>

            <div className="tv-underbar" aria-hidden="true">
              <span className="tv-grille" />
              <span className="tv-brand">STARRY</span>
              <span className="tv-grille" />
            </div>

            <div className="tv-panel" role="group" aria-label="Television front panel">
              <button className="panel-btn" onClick={() => press({ type: 'VOLUME_DOWN' })} aria-label="Volume down">
                ◄
              </button>
              <button className="panel-btn" onClick={() => press({ type: 'VOLUME_UP' })} aria-label="Volume up">
                ►
              </button>
              <button
                className={`panel-btn ${muted ? 'is-active' : ''}`}
                onClick={() => press({ type: 'MUTE' })}
                aria-label="Mute"
              >
                ✖
              </button>
              <button className="panel-btn" onClick={() => press({ type: 'CHANNEL_DOWN' })} aria-label="Channel down">
                CH▼
              </button>
              <button className="panel-btn" onClick={() => press({ type: 'CHANNEL_UP' })} aria-label="Channel up">
                CH▲
              </button>
              <button
                className={`panel-btn ${captions ? 'is-active' : ''}`}
                onClick={() => press({ type: 'CAPTIONS' })}
                aria-label="Captions"
              >
                CC
              </button>

              <div className="panel-readout" aria-hidden="true">
                <span className="panel-readout-label">TIME</span>
                <span className="panel-readout-value">
                  {np && power ? formatClock(np.programme.durationSec - np.offset) : '--:--'}
                </span>
              </div>

              <button
                className={`panel-btn panel-power ${power ? 'is-on' : ''}`}
                onClick={() => press({ type: 'POWER' })}
                aria-label={power ? 'Power off' : 'Power on'}
              >
                ⏻
              </button>
            </div>

            <div className="tv-ports" aria-hidden="true">
              <span className="port port-white" />
              <span className="port port-yellow" />
              <span className="port port-red" />
              <span className="port port-black" />
            </div>
          </div>

          {/* The picture, mirrored on the floorboards under the set. */}
          <canvas
            ref={floorRef}
            className="tv-floor-reflection"
            width={320}
            height={240}
            aria-hidden="true"
          />
        </div>

        <aside className="tv-aside">
          <div className="now-card">
            <div className="now-card-head">
              CH {String(channelNum).padStart(3, '0')}
              {channel && <span className="now-card-name">{channel.name}</span>}
            </div>
            {power && np ? (
              <div className="now-card-body">
                <h2>{np.programme.heading}</h2>
                {np.programme.subheading && <p className="now-card-sub">{np.programme.subheading}</p>}
                <p className="now-card-lines">{np.programme.lines.slice(0, 3).join(' ')}</p>
                {/* On the LIBRARY channel the thing on screen is a real book, so
                    give people the way out to actually go and find it. */}
                {book && (
                  <a
                    className="now-card-link"
                    href={primaryLink(book)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Find “{book.title}” →
                  </a>
                )}
                {channel && <p className="now-card-blurb">{channel.blurb}</p>}
              </div>
            ) : (
              <div className="now-card-body">
                <p className="now-card-lines">
                  Set is off. Press <kbd>P</kbd> or hit the power button to begin broadcasting.
                </p>
              </div>
            )}
          </div>

          <Remote press={press} />

          <details className="tv-help">
            <summary>Keyboard</summary>
            <dl>
              {SHORTCUTS.map(([key, what]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </details>
        </aside>
      </div>

      {guideOpen && <Guide press={press} />}
    </div>
  );
}
