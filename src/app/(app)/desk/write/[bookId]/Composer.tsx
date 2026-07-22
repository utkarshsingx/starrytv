'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import { validateBroadcastCut, type ReviewWindow } from '@/shared/review-format';
import { lintStyle } from '@/shared/style-linter';
import type { BookSummary } from '@/server/shelf/types';
import type { ReviewView } from '@/server/ugc/types';

/**
 * The composer.
 *
 * Two fields carry the format: the hook (one line, ≤14 words) and the broadcast
 * cut (the configured window, default 45–70 words). The counters go green in the
 * window and red outside it — but they are courtesy only; the identical
 * `validateBroadcastCut` runs on the server at submit, so the browser is never
 * the enforcer. The long body below has no limit, so "write a review and hit
 * publish" is always literally true.
 *
 * The house-style linter runs live and advises — it never blocks. The three
 * attestations mirror the library's own rules and must be checked to submit.
 */
export function Composer({
  book, window, existing,
}: { book: BookSummary; window: ReviewWindow; existing: ReviewView | null }) {
  const router = useRouter();
  const r = existing?.revision;
  const [hook, setHook] = useState(r?.hook ?? '');
  const [body, setBody] = useState(r?.body ?? '');
  const [longBody, setLongBody] = useState(r?.longBody ?? '');
  const [underdog, setUnderdog] = useState(r?.underdog ?? '');
  const [att, setAtt] = useState({ real: false, notFamous: false, noFilm: false });
  const [reviewId, setReviewId] = useState(existing?.id ?? null);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fmt = useMemo(() => validateBroadcastCut({ hook, body, underdog }, window), [hook, body, underdog, window]);
  const style = useMemo(() => lintStyle(`${body} ${longBody}`), [body, longBody]);
  const canSubmit = fmt.ok && att.real && att.notFamous && att.noFilm;

  const rejectionReason =
    existing?.status === 'CHANGES_REQUESTED' || existing?.status === 'REJECTED'
      ? existing.lastAction?.reasonText
      : null;

  async function save(): Promise<string | null> {
    setBusy('save'); setError(null);
    const res = await api<{ review: ReviewView }>('/api/v1/reviews', {
      method: 'POST', auth: true,
      body: JSON.stringify({ bookId: book.id, hook, body, longBody: longBody || null, underdog }),
    });
    setBusy(null);
    if (isOk(res)) { setReviewId(res.data.review.id); setSaved(true); setTimeout(() => setSaved(false), 2000); return res.data.review.id; }
    setError(res.error.message); return null;
  }

  async function submit() {
    const id = reviewId ?? (await save());
    if (!id) return;
    setBusy('submit'); setError(null);
    const res = await api<{ review: ReviewView }>(`/api/v1/reviews/${id}/submit`, { method: 'POST', auth: true });
    setBusy(null);
    if (isOk(res)) { router.push('/desk/reviews'); router.refresh(); }
    else setError(res.error.message);
  }

  const counter = (n: number, ok: boolean, label: string) => (
    <span style={{ fontSize: 11, color: ok ? '#0b6b3a' : '#a11400' }}>{n} {label}</span>
  );

  return (
    <>
      <h1 className="app-h1" style={{ marginBottom: '0.2rem' }}>{book.title}</h1>
      <p className="book-detail-author">{book.author}{book.year ? ` · ${book.year}` : ''}</p>

      {rejectionReason && (
        <div className="auth-error" style={{ margin: '1rem 0' }}>
          <strong>The editor asked for changes:</strong> {rejectionReason}
        </div>
      )}
      {error && <div className="auth-error" style={{ margin: '1rem 0' }} role="alert">{error}</div>}

      <div className="quote-form" style={{ marginTop: '1.5rem' }}>
        <label className="app-kicker" htmlFor="hook">The hook — one line that makes someone pick it up</label>
        <input id="hook" className="add-book" style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 15, padding: '0.6rem 0.7rem', border: '1px solid #d8d4c8' }}
          value={hook} onChange={(e) => setHook(e.target.value)} placeholder="A priest hunts a fox across a glacier; the fox has opinions." />
        <div style={{ marginTop: 4 }}>{counter(fmt.hook.count, fmt.hook.ok, `/ ${window.hookMaxWords} words`)}{fmt.hook.message && <span style={{ fontSize: 11, color: '#a11400' }}> — {fmt.hook.message}</span>}</div>
      </div>

      <div className="quote-form">
        <label className="app-kicker" htmlFor="body">The review — the broadcast cut, {window.bodyMinWords}–{window.bodyMaxWords} words</label>
        <textarea id="body" style={{ minHeight: '7rem' }} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Say what the book actually does. No jacket copy." />
        <div>{counter(fmt.body.count, fmt.body.ok, `/ ${window.bodyMinWords}–${window.bodyMaxWords} words`)}{fmt.body.message && <span style={{ fontSize: 11, color: '#a11400' }}> — {fmt.body.message}</span>}</div>
      </div>

      <div className="quote-form">
        <label className="app-kicker" htmlFor="underdog">Why it was missed — one sentence naming the reason</label>
        <textarea id="underdog" style={{ minHeight: '3rem' }} value={underdog} onChange={(e) => setUnderdog(e.target.value)}
          placeholder="Won a prize, then quietly vanished in translation." />
        <div>{counter(fmt.underdog.count, fmt.underdog.ok, 'sentence(s)')}{fmt.underdog.message && <span style={{ fontSize: 11, color: '#a11400' }}> — {fmt.underdog.message}</span>}</div>
      </div>

      <details className="quote-form">
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6b6659' }}>Add a longer version (optional, no limit) — shows below the review, never on the hub card</summary>
        <textarea style={{ minHeight: '8rem', marginTop: '0.5rem' }} value={longBody} onChange={(e) => setLongBody(e.target.value)} placeholder="The unconstrained essay, for the review page." />
      </details>

      {style.flags.length > 0 && (
        <div style={{ margin: '1rem 0', padding: '0.8rem', border: '1px solid #e6e2d6', background: '#fbfaf6', fontSize: 12, color: '#6b6659' }}>
          <strong style={{ color: '#8a6d0b' }}>A note on the voice</strong> (advice, not a rule):
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
            {style.flags.slice(0, 4).map((f, i) => <li key={i}>{f.message}</li>)}
          </ul>
        </div>
      )}

      <fieldset style={{ margin: '1.5rem 0', border: '1px solid #e6e2d6', padding: '1rem' }}>
        <legend style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b6659', padding: '0 0.4rem' }}>Before it goes to the editor</legend>
        {[
          ['real', 'This is a real book I have actually read.'],
          ['notFamous', 'It was not a #1 bestseller or a prize-winner everyone already owns.'],
          ['noFilm', 'There is no famous film adaptation of it.'],
        ].map(([k, label]) => (
          <label key={k} style={{ display: 'flex', gap: '0.5rem', fontSize: 13, marginBottom: '0.4rem', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={att[k as keyof typeof att]} onChange={(e) => setAtt({ ...att, [k]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <button className="btn ghost" onClick={save} disabled={busy !== null}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
        <button className="btn" onClick={submit} disabled={busy !== null || !canSubmit} title={canSubmit ? '' : 'Meet the format and check the three boxes first'}>
          {busy === 'submit' ? 'Sending…' : 'Send to the editor'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#0b6b3a' }}>Draft saved.</span>}
      </div>
    </>
  );
}
