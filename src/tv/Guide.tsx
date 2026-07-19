import { useEffect, useRef } from 'react';
import { channels } from '../content/channels';
import { useTv } from './store';
import { nowPlaying, upNext, formatClock } from './engine/schedule';
import type { Command } from './useRemoteControl';

type Props = { press: (cmd: Command) => void };

/**
 * The channel guide. This is also the accessible route to every channel — the
 * keypad is charming but a list of named, focusable buttons is what actually
 * works for everyone.
 */
export function Guide({ press }: Props) {
  const current = useTv((s) => s.channelNum);
  const close = useTv((s) => s.toggleGuide);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.guide-row.is-current')?.focus();
  }, []);

  return (
    <div className="guide-backdrop" onClick={close} role="presentation">
      <div
        className="guide"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Channel guide"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="guide-head">
          <h2>PROGRAMME GUIDE</h2>
          <button className="guide-close" onClick={close} aria-label="Close guide">
            ✕
          </button>
        </header>

        <div className="guide-list">
          {channels.map((c) => {
            const np = nowPlaying(c);
            const next = upNext(c, 2);
            return (
              <button
                key={c.num}
                className={`guide-row ${c.num === current ? 'is-current' : ''}`}
                // No close() here — tuning already dismisses the guide. Calling
                // both would toggle it straight back open.
                onClick={() => press({ type: 'CHANNEL', num: c.num })}
                style={{ '--ch-color': c.color } as React.CSSProperties}
              >
                <span className="guide-num">{String(c.num).padStart(2, '0')}</span>
                <span className="guide-body">
                  <span className="guide-name">{c.name}</span>
                  <span className="guide-blurb">{c.blurb}</span>
                  {np && (
                    <span className="guide-now">
                      <em>NOW</em> {np.programme.heading}
                      <span className="guide-remaining">
                        {formatClock(np.programme.durationSec - np.offset)} left
                      </span>
                    </span>
                  )}
                  {next.map((n) => (
                    <span className="guide-next" key={n.programme.id}>
                      <em>NEXT</em> {n.programme.heading}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
