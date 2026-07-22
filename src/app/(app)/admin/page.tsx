import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { listQueue } from '@/server/ugc/service';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');

  const queue = await listQueue();

  return (
    <main className="app-main">
      <p className="app-kicker">Admin</p>
      <h1 className="app-h1">The editor’s desk.</h1>
      <p className="app-lede">
        What readers submit reaches the hub only after you approve it. The queue holds everything
        waiting.
      </p>

      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '1px', background: '#e6e2d6', border: '1px solid #e6e2d6' }}>
        <Link href="/admin/reviews" style={{ background: '#fff', padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#141414' }}>{queue.length}</div>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a09b8e', marginTop: '0.2rem' }}>
            Waiting in the queue →
          </div>
        </Link>
      </div>
    </main>
  );
}
