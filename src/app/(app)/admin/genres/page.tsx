import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { listGenres } from '@/server/admin/repo';
import { GenreManager } from './GenreManager';
import '../../desk/desk.css';

export const metadata: Metadata = { title: 'Genres & channels' };
export const dynamic = 'force-dynamic';

export default async function AdminGenresPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');
  const genres = await listGenres();

  return (
    <main className="app-main">
      <p className="app-kicker"><Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Control room</Link> / Genres &amp; channels</p>
      <h1 className="app-h1">Genres &amp; channels</h1>
      <p className="app-lede">
        A genre is a section of the hub and, when you give it a channel number and colour, a tinted
        channel on the television. Changes appear without a redeploy.
      </p>
      <GenreManager initialGenres={genres} />
    </main>
  );
}
