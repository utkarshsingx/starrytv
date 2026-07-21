import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { getItem, listQuotesForEntry } from '@/server/shelf/service';
import { BookControls } from './BookControls';
import '../../desk.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: 'Book' };
  const item = await getItem(user.id, (await params).id);
  return { title: item ? item.book.title : 'Book' };
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const item = await getItem(user.id, id);
  if (!item) notFound();
  const quotes = await listQuotesForEntry(user.id, id);

  return (
    <main className="app-main">
      <p className="app-kicker">
        <Link href="/desk" style={{ color: 'inherit', textDecoration: 'none' }}>Desk</Link> /{' '}
        <Link href="/desk/shelf" style={{ color: 'inherit', textDecoration: 'none' }}>My library</Link>
      </p>
      <BookControls initialItem={item} initialQuotes={quotes} />
    </main>
  );
}
