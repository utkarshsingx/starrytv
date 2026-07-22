'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import { REASON_CODES, type ReviewView } from '@/server/ugc/types';

/**
 * The review queue as a single-item focus view, not a table. One submission at a
 * time, the full broadcast cut in front of you, with approve / changes / reject.
 * Keyboard: a approve, e request changes, r reject, j/k move. Rejections and
 * change-requests carry a reason code and free text that the author reads
 * verbatim.
 */
const REASON_LABEL: Record<string, string> = {
  TOO_FAMOUS: 'Too famous — everyone owns it',
  NOT_IN_VOICE: 'Not in the house voice',
  UNVERIFIABLE_BOOK: 'Can’t verify the book is real',
  READS_LIKE_MARKETING: 'Reads like marketing copy',
  LENGTH_OUT_OF_RANGE: 'Length is off',
  HOOK_TOO_LONG: 'Hook runs long',
  UNDERDOG_NOT_A_MECHANISM: 'The “why missed” isn’t a real reason',
  DUPLICATE: 'Duplicate of an existing review',
  RIGHTS_CONCERN: 'Rights concern',
  POLICY_VIOLATION: 'Policy violation',
  OTHER: 'Other (say why below)',
};

export function Queue({ initialQueue }: { initialQueue: ReviewView[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initialQueue);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<null | 'reject' | 'changes'>(null);
  const [reasonCode, setReasonCode] = useState('OTHER');
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);

  const current = queue[i];

  const drop = () => {
    const next = queue.filter((_, idx) => idx !== i);
    setQueue(next);
    setI((v) => Math.min(v, Math.max(0, next.length - 1)));
    setMode(null); setReasonText(''); setReasonCode('OTHER');
    router.refresh();
  };

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!current) return;
    setBusy(true);
    const res = await api(`/api/v1/admin/reviews/${current.id}`, {
      method: 'POST', auth: true, body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    if (isOk(res)) drop();
  }

  if (queue.length === 0) {
    return <div className="desk-empty" style={{ marginTop: '2rem' }}>The queue is empty. Nothing waiting.</div>;
  }
  if (!current) return null;

  const rev = current.revision;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ fontSize: 12, color: '#a09b8e', marginBottom: '0.8rem' }}>
        {i + 1} of {queue.length} waiting
        {queue.length > 1 && (
          <>
            {' · '}
            <button onClick={() => setI((v) => Math.max(0, v - 1))} className="app-bar-signout">prev</button>
            {' / '}
            <button onClick={() => setI((v) => Math.min(queue.length - 1, v + 1))} className="app-bar-signout">next</button>
          </>
        )}
      </div>

      <article style={{ border: '1px solid #e6e2d6', padding: '1.5rem', background: '#fff' }}>
        <div style={{ fontSize: 12, color: '#a09b8e' }}>
          {current.book.title} · {current.book.author}{current.book.year ? ` · ${current.book.year}` : ''}
          {' — '}by {current.author.displayName}
        </div>
        {rev && (
          <>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', margin: '0.6rem 0' }}>{rev.hook}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#24242a' }}>{rev.body}</p>
            <p style={{ fontSize: 13, color: '#6b6659', marginTop: '0.8rem' }}>
              <strong>Why missed:</strong> {rev.underdog}
            </p>
            {rev.longBody && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6b6659' }}>Long version</summary>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{rev.longBody}</p>
              </details>
            )}
          </>
        )}
      </article>

      {mode === null ? (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
          <button className="btn" disabled={busy} onClick={() => act('approve')}>Approve &amp; publish</button>
          <button className="btn ghost" disabled={busy} onClick={() => setMode('changes')}>Ask for changes</button>
          <button className="btn ghost" disabled={busy} style={{ color: '#8a3a2a', borderColor: '#e0c4bd' }} onClick={() => setMode('reject')}>Reject</button>
        </div>
      ) : (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e6e2d6', background: '#fbfaf6' }}>
          <p className="app-kicker">{mode === 'reject' ? 'Reject — the author reads this' : 'Ask for changes — the author reads this'}</p>
          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}
            style={{ fontFamily: 'var(--mono)', fontSize: 13, padding: '0.4rem', border: '1px solid #d8d4c8', width: '100%', margin: '0.5rem 0' }}>
            {REASON_CODES.map((c) => <option key={c} value={c}>{REASON_LABEL[c]}</option>)}
          </select>
          <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)}
            placeholder="A sentence to the author, in the house voice."
            style={{ width: '100%', minHeight: '4rem', fontFamily: 'var(--mono)', fontSize: 13, padding: '0.5rem', border: '1px solid #d8d4c8' }} />
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
            <button className="btn" disabled={busy} onClick={() => act(mode === 'reject' ? 'reject' : 'changes', { reasonCode, reasonText })}>
              Send {mode === 'reject' ? 'rejection' : 'changes'}
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => setMode(null)}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
