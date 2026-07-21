'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import { Cover, STATUS_LABEL } from '../../parts';
import type { ShelfItem, Quote, ReadStatus } from '@/server/shelf/types';

const STATUSES: ReadStatus[] = ['WANT_TO_READ', 'READING', 'PAUSED', 'READ', 'DNF'];

/**
 * The interactive book page: change status, record page progress, keep quotes,
 * remove the book. State starts from the server-rendered item and is updated in
 * place from each mutation's response, so the page never flickers back to a
 * loading state for a one-field change.
 */
export function BookControls({ initialItem, initialQuotes }: { initialItem: ShelfItem; initialQuotes: Quote[] }) {
  const router = useRouter();
  const [item, setItem] = useState(initialItem);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [page, setPage] = useState(String(item.currentRead?.page ?? ''));
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await api<{ item: ShelfItem }>(`/api/v1/shelf/${item.id}`, {
      method: 'PATCH', auth: true, body: JSON.stringify(body),
    });
    setBusy(false);
    if (isOk(res) && res.data.item) setItem(res.data.item);
    router.refresh();
  };

  const savePage = async () => {
    const n = parseInt(page, 10);
    if (Number.isNaN(n)) return;
    await patch({ page: n });
  };

  const remove = async () => {
    if (!confirm(`Remove “${item.book.title}” from your shelf? Your quotes are kept.`)) return;
    await api(`/api/v1/shelf/${item.id}`, { method: 'DELETE', auth: true });
    router.push('/desk/shelf');
    router.refresh();
  };

  const b = item.book;

  return (
    <>
      <div className="book-detail-head">
        <Cover url={b.coverUrl} title={b.title} className="book-detail-cover" />
        <div>
          <h1 className="book-detail-title">{b.title}</h1>
          <p className="book-detail-author">
            {b.author}
            {b.year ? ` · ${b.year}` : ''}
            {b.origin ? ` · ${b.origin}` : ''}
          </p>
          <div className="status-picker">
            {STATUSES.map((st) => (
              <button
                key={st}
                className={st === item.status ? 'is-current' : ''}
                disabled={busy}
                onClick={() => patch({ status: st })}
              >
                {STATUS_LABEL[st]}
              </button>
            ))}
          </div>
          {(item.status === 'READING' || item.status === 'PAUSED') && (
            <div className="progress-row">
              <span>Page</span>
              <input
                type="number" min={0} value={page}
                onChange={(e) => setPage(e.target.value)}
                onBlur={savePage}
                onKeyDown={(e) => e.key === 'Enter' && savePage()}
              />
              {b.pageCount ? <span style={{ color: '#a09b8e' }}>of {b.pageCount}</span> : null}
              {item.currentRead?.attemptNo && item.currentRead.attemptNo > 1 && (
                <span style={{ color: '#a09b8e', fontSize: 11 }}>· reread #{item.currentRead.attemptNo}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <QuoteBlock entryId={item.id} quotes={quotes} setQuotes={setQuotes} />

      <p style={{ marginTop: '2.5rem' }}>
        <button className="btn ghost" onClick={remove} style={{ color: '#8a3a2a', borderColor: '#e0c4bd' }}>
          Remove from shelf
        </button>
      </p>
    </>
  );
}

function QuoteBlock({
  entryId, quotes, setQuotes,
}: { entryId: string; quotes: Quote[]; setQuotes: (q: Quote[]) => void }) {
  const [body, setBody] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const res = await api<{ quote: Quote }>(`/api/v1/shelf/${entryId}/quotes`, {
      method: 'POST', auth: true,
      body: JSON.stringify({ body: text, page: page ? parseInt(page, 10) : null }),
    });
    setBusy(false);
    if (isOk(res)) {
      setQuotes([...quotes, res.data.quote].sort((a, b) => (a.page ?? 1e9) - (b.page ?? 1e9)));
      setBody('');
      setPage('');
    }
  };

  const del = async (id: string) => {
    await api(`/api/v1/quotes/${id}`, { method: 'DELETE', auth: true });
    setQuotes(quotes.filter((q) => q.id !== id));
  };

  return (
    <section>
      <div className="desk-section-head"><h2>Quotes &amp; passages</h2><span className="count">{quotes.length}</span></div>

      <div className="quote-form">
        <textarea
          placeholder="A line worth keeping…"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="quote-form-row">
          <input type="number" placeholder="page" min={0} value={page} onChange={(e) => setPage(e.target.value)} />
          <button className="btn" disabled={busy || !body.trim()} onClick={add}>Keep it</button>
          <span style={{ color: '#a09b8e', fontSize: 11 }}>{body.length}/2000</span>
        </div>
      </div>

      {quotes.length === 0 ? (
        <p style={{ color: '#a09b8e', fontSize: 13 }}>Nothing kept yet. Add a passage that stayed with you.</p>
      ) : (
        <div className="quote-list">
          {quotes.map((q) => (
            <blockquote key={q.id} className="quote">
              <p className="quote-body">{q.body}</p>
              <p className="quote-meta">
                {q.page != null && <span>page {q.page}</span>}
                {q.chapter && <span>{q.chapter}</span>}
                <button onClick={() => del(q.id)}>delete</button>
              </p>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}
