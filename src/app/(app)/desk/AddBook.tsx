'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import type { BookSummary, ReadStatus } from '@/server/shelf/types';

/**
 * The add-a-book box: type a title, pick from the catalogue + Open Library,
 * choose a shelf. Debounced at 300 ms so a specific title is searched once, not
 * on every keystroke.
 */
export function AddBook({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const res = await api<{ results: BookSummary[] }>(
        `/api/v1/books/lookup?q=${encodeURIComponent(term)}`,
        { auth: true },
      );
      if (isOk(res)) setResults(res.data.results);
      setLoading(false);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  async function add(book: BookSummary, status: ReadStatus) {
    setBusyId(book.id);
    setError(null);
    const res = await api('/api/v1/shelf', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ bookId: book.id, status }),
    });
    setBusyId(null);
    if (isOk(res)) {
      setQ('');
      setResults([]);
      onAdded?.();
      router.refresh();
    } else {
      setError((res.error.message) || 'Could not add that book.');
    }
  }

  return (
    <div className="add-book">
      <input
        type="search"
        placeholder="Add a book — search a title or author…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {error && <p className="auth-error" role="alert" style={{ marginTop: '0.5rem' }}>{error}</p>}
      {q.trim().length >= 2 && (
        <div className="lookup-results">
          {loading && results.length === 0 && <p className="lookup-loading">Searching…</p>}
          {!loading && results.length === 0 && <p className="lookup-empty">No matches. Try the author’s name.</p>}
          {results.map((b) => (
            <div key={b.id} className="lookup-row">
              <span style={{ minWidth: 0 }}>
                <span className="t">{b.title}</span>{' '}
                <span className="a">
                  {b.author}
                  {b.year ? ` · ${b.year}` : ''}
                </span>
              </span>
              <span className="src">{b.source === 'HOUSE' ? 'library' : 'open library'}</span>
              <span style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn ghost" disabled={busyId === b.id} onClick={() => add(b, 'WANT_TO_READ')}>
                  + pile
                </button>
                <button className="btn" disabled={busyId === b.id} onClick={() => add(b, 'READING')}>
                  reading
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
