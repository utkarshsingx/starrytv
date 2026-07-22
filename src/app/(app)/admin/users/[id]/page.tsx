import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { getUserDetail } from '@/server/admin/repo';
import { UserActions } from './UserActions';
import '../../../desk/desk.css';

export const metadata: Metadata = { title: 'Reader' };
export const dynamic = 'force-dynamic';

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'admin') redirect('/desk');

  const { id } = await params;
  const u = await getUserDetail(id);
  if (!u) notFound();

  return (
    <main className="app-main">
      <p className="app-kicker">
        <Link href="/admin/users" style={{ color: 'inherit', textDecoration: 'none' }}>Readers</Link> / {u.displayName}
      </p>
      <h1 className="app-h1">{u.displayName}</h1>
      <p className="app-lede" style={{ marginBottom: '0.5rem' }}>
        {u.email} · @{u.handle} · joined {new Date(u.createdAt).toLocaleDateString()}
        {' · '}{u.role === 'admin' ? 'admin' : 'reader'}{u.status === 'SUSPENDED' ? ' · suspended' : ''}
        {u.trust ? ` · trust ${u.trust.level} (${u.trust.approved}✓/${u.trust.rejected}✗)` : ''}
      </p>

      <UserActions userId={u.id} status={u.status} role={u.role} isSelf={u.id === me.id} />

      <div className="desk-section-head"><h2>Shelf</h2><span className="count">{u.shelf.length}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: 13 }}>
        {u.shelf.length === 0 && <span style={{ color: '#a09b8e' }}>Nothing on the shelf.</span>}
        {u.shelf.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ minWidth: '9rem', color: '#a09b8e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.status.replace(/_/g, ' ')}{s.page ? ` · p.${s.page}` : ''}</span>
            <span><strong>{s.title}</strong> — {s.author}</span>
          </div>
        ))}
      </div>

      <div className="desk-section-head"><h2>Reviews</h2><span className="count">{u.reviews.length}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: 13 }}>
        {u.reviews.length === 0 && <span style={{ color: '#a09b8e' }}>No reviews yet.</span>}
        {u.reviews.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ minWidth: '9rem', color: '#a09b8e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{r.status.replace(/_/g, ' ')}</span>
            <span>
              {r.status === 'PUBLISHED' ? <Link href={`/review/${r.slug}`} style={{ color: '#0b3ecc' }}><strong>{r.bookTitle}</strong></Link> : <strong>{r.bookTitle}</strong>}
              {r.hook ? <span style={{ color: '#6b6659' }}> — {r.hook}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
