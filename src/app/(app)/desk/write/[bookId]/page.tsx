import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { findBookById } from '@/server/shelf/repo';
import { findInflight, getReviewForOwner } from '@/server/ugc/repo';
import { getReviewWindow } from '@/server/settings';
import { Composer } from './Composer';
import '../../desk.css';

export const metadata: Metadata = { title: 'Write a review' };
export const dynamic = 'force-dynamic';

export default async function WritePage({ params }: { params: Promise<{ bookId: string }> }) {
  const user = (await getCurrentUser())!;
  const { bookId } = await params;
  const book = await findBookById(bookId);
  if (!book) notFound();

  const [window, inflight] = await Promise.all([getReviewWindow(), findInflight(user.id, bookId)]);
  const existing = inflight ? await getReviewForOwner(user.id, inflight.id as string) : null;

  return (
    <main className="app-main">
      <p className="app-kicker">
        <Link href="/desk" style={{ color: 'inherit', textDecoration: 'none' }}>Desk</Link> / Write a review
      </p>
      <Composer book={book} window={window} existing={existing} />
    </main>
  );
}
