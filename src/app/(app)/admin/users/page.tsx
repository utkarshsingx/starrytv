import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { listUsers } from '@/server/admin/repo';
import '../../desk/desk.css';

export const metadata: Metadata = { title: 'Readers' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');

  const q = (await searchParams).q ?? '';
  const users = await listUsers(q);

  return (
    <main className="app-main">
      <p className="app-kicker"><Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Control room</Link> / Readers</p>
      <h1 className="app-h1">Everyone on the platform</h1>

      <form style={{ margin: '1.5rem 0' }}>
        <input name="q" defaultValue={q} placeholder="Search name, email, or handle…"
          style={{ width: '100%', maxWidth: '28rem', fontFamily: 'var(--mono)', fontSize: 14, padding: '0.6rem 0.8rem', border: '1px solid #d8d4c8' }} />
      </form>

      <div style={{ border: '1px solid #e6e2d6' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.6rem 1rem', background: '#fbfaf6', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a09b8e', borderBottom: '1px solid #e6e2d6' }}>
          <span>Reader</span><span>Role / status</span><span>Shelf</span><span>Reviews</span>
        </div>
        {users.map((u) => (
          <Link key={u.id} href={`/admin/users/${u.id}`}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.7rem 1rem', textDecoration: 'none', color: 'inherit', borderTop: '1px solid #f0ede4', fontSize: 13 }}>
            <span><strong>{u.displayName}</strong><br /><span style={{ color: '#a09b8e', fontSize: 11 }}>{u.email}</span></span>
            <span>{u.role === 'admin' ? '★ admin' : 'reader'}{u.status === 'SUSPENDED' ? <span style={{ color: '#8a3a2a' }}> · suspended</span> : ''}</span>
            <span>{u.shelfCount}</span>
            <span>{u.reviewCount} {u.publishedCount > 0 && <span style={{ color: '#0b6b3a' }}>({u.publishedCount} live)</span>}</span>
          </Link>
        ))}
        {users.length === 0 && <div style={{ padding: '1.5rem', color: '#a09b8e', fontSize: 13 }}>No readers match “{q}”.</div>}
      </div>
    </main>
  );
}
