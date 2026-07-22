import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { listQueue } from '@/server/ugc/service';
import { Queue } from './Queue';
import '../../desk/desk.css';

export const metadata: Metadata = { title: 'Review queue' };
export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');

  const queue = await listQueue();

  return (
    <main className="app-main">
      <p className="app-kicker">
        <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</Link> / Review queue
      </p>
      <h1 className="app-h1">The review queue</h1>
      <p className="app-lede">
        Every submission before it reaches the hub. Approve to publish it, ask for changes to send it
        back with a note, or reject with a reason the author reads verbatim.
      </p>
      <Queue initialQueue={queue} />
    </main>
  );
}
