'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import type { AdminGenre } from '@/server/admin/repo';

export function GenreManager({ initialGenres }: { initialGenres: AdminGenre[] }) {
  const router = useRouter();
  const [genres, setGenres] = useState(initialGenres);
  const [name, setName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    const res = await api('/api/v1/admin/genres', { method: 'POST', auth: true, body: JSON.stringify({ name, blurb }) });
    setBusy(false);
    if (isOk(res)) { setName(''); setBlurb(''); router.refresh(); }
    else setError((res as { error: { message: string } }).error.message);
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await api<{ genre: AdminGenre }>(`/api/v1/admin/genres/${id}`, { method: 'PATCH', auth: true, body: JSON.stringify(body) });
    if (isOk(res) && res.data.genre) setGenres((gs) => gs.map((g) => (g.id === id ? res.data.genre : g)));
    router.refresh();
  }

  return (
    <>
      <div style={{ margin: '1.5rem 0', padding: '1rem', border: '1px solid #e6e2d6', background: '#fbfaf6' }}>
        <p className="app-kicker">Add a genre</p>
        {error && <p className="auth-error" style={{ margin: '0.5rem 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Genre name"
            style={{ fontFamily: 'var(--mono)', fontSize: 14, padding: '0.5rem', border: '1px solid #d8d4c8', minWidth: '12rem' }} />
          <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="One-line blurb (optional)"
            style={{ fontFamily: 'var(--mono)', fontSize: 14, padding: '0.5rem', border: '1px solid #d8d4c8', flex: 1, minWidth: '14rem' }} />
          <button className="btn" disabled={busy || !name.trim()} onClick={create}>Add</button>
        </div>
      </div>

      <div style={{ border: '1px solid #e6e2d6' }}>
        {genres.map((g) => (
          <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr auto auto', gap: '1rem', alignItems: 'center', padding: '0.7rem 1rem', borderTop: '1px solid #f0ede4', fontSize: 13 }}>
            <span><strong style={{ opacity: g.isActive ? 1 : 0.4 }}>{g.name}</strong><br /><span style={{ color: '#a09b8e', fontSize: 11 }}>{g.slug}</span></span>
            <span style={{ color: '#6b6659' }}>{g.blurb ?? <em style={{ color: '#c4bfb2' }}>no blurb</em>}</span>
            <span style={{ color: '#a09b8e', fontSize: 12 }}>{g.bookCount} books · {g.reviewCount} live</span>
            <button className="app-bar-signout" onClick={() => patch(g.id, { isActive: !g.isActive })}>
              {g.isActive ? 'hide' : 'show'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
