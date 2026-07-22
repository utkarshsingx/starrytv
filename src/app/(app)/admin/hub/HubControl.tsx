'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';

type Row = { id: string; slug: string; bookTitle: string; bookAuthor: string; reviewer: string; hook: string | null; publishedAt: string | null };

export function HubControl({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function unpublish(id: string) {
    const reason = prompt('Why is this coming down? (the author sees this, and it is logged)') ?? '';
    if (reason === '') return;
    setBusy(id);
    const res = await api(`/api/v1/admin/reviews/${id}`, { method: 'POST', auth: true, body: JSON.stringify({ action: 'unpublish', reasonText: reason }) });
    setBusy(null);
    if (isOk(res)) { setRows((r) => r.filter((x) => x.id !== id)); router.refresh(); }
  }

  if (rows.length === 0) return <div className="desk-empty" style={{ marginTop: '2rem' }}>Nothing published yet.</div>;

  return (
    <div style={{ marginTop: '1.5rem', border: '1px solid #e6e2d6' }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '0.8rem 1rem', borderTop: '1px solid #f0ede4', fontSize: 13 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/review/${r.slug}`} style={{ color: '#0b3ecc', textDecoration: 'none' }}><strong>{r.bookTitle}</strong></Link>
            <span style={{ color: '#a09b8e' }}> · {r.bookAuthor} · by {r.reviewer}</span>
            {r.hook && <div style={{ color: '#6b6659', marginTop: '0.2rem' }}>{r.hook}</div>}
          </div>
          <button className="btn ghost" disabled={busy === r.id} style={{ color: '#8a3a2a', borderColor: '#e0c4bd', flex: 'none' }} onClick={() => unpublish(r.id)}>
            Take down
          </button>
        </div>
      ))}
    </div>
  );
}
