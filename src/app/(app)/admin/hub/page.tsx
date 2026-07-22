import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { listPublishedReviews } from '@/server/admin/repo';
import { HubControl } from './HubControl';
import '../../desk/desk.css';

export const metadata: Metadata = { title: 'The hub' };
export const dynamic = 'force-dynamic';

export default async function AdminHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');
  const reviews = await listPublishedReviews();

  return (
    <main className="app-main">
      <p className="app-kicker"><Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Control room</Link> / The hub</p>
      <h1 className="app-h1">Live on the hub</h1>
      <p className="app-lede">
        Everything readers currently see. Taking a review down is reversible — the text is kept and
        it can go back up. Nothing here is ever destroyed.
      </p>
      <HubControl initial={reviews} />
    </main>
  );
}
