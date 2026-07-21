import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { listShelf, stats } from '@/server/shelf/service';
import { AddBook } from './AddBook';
import { BookCard } from './parts';
import './desk.css';

export const metadata: Metadata = { title: 'Your desk' };

// The desk reflects live shelf state, so it renders per request.
export const dynamic = 'force-dynamic';

export default async function DeskPage() {
  const user = (await getCurrentUser())!; // (app) layout guarantees this
  const firstName = user.displayName.split(' ')[0];
  const [items, s] = await Promise.all([listShelf(user.id), stats(user.id)]);

  const reading = items.filter((i) => i.status === 'READING');
  const pile = items.filter((i) => i.status === 'WANT_TO_READ').slice(0, 6);
  const recentlyRead = items.filter((i) => i.status === 'READ').slice(0, 6);

  return (
    <main className="app-main">
      <p className="app-kicker">Your desk</p>
      <h1 className="app-h1">Evening, {firstName}.</h1>

      <div className="desk-stats">
        <span className="desk-stat"><span className="desk-stat-n">{s.reading}</span><span className="desk-stat-l">Reading now</span></span>
        <span className="desk-stat"><span className="desk-stat-n">{s.finishedThisYear}</span><span className="desk-stat-l">Read this year</span></span>
        <span className="desk-stat"><span className="desk-stat-n">{s.want}</span><span className="desk-stat-l">On the pile</span></span>
        <span className="desk-stat"><span className="desk-stat-n">{s.total}</span><span className="desk-stat-l">On your shelf</span></span>
      </div>

      <AddBook />

      {items.length === 0 && (
        <div className="desk-empty" style={{ marginTop: '2rem' }}>
          Your shelf is empty. Search a book above to start keeping track of what you read.
        </div>
      )}

      {reading.length > 0 && (
        <>
          <div className="desk-section-head">
            <h2>Reading now</h2>
            <span className="count">{reading.length}</span>
          </div>
          <div className="book-grid">
            {reading.map((i) => <BookCard key={i.id} item={i} />)}
          </div>
        </>
      )}

      {pile.length > 0 && (
        <>
          <div className="desk-section-head">
            <h2>On the pile</h2>
            <Link href="/desk/shelf" className="count">see all →</Link>
          </div>
          <div className="book-grid">
            {pile.map((i) => <BookCard key={i.id} item={i} />)}
          </div>
        </>
      )}

      {recentlyRead.length > 0 && (
        <>
          <div className="desk-section-head">
            <h2>Recently read</h2>
            <Link href="/desk/shelf" className="count">see all →</Link>
          </div>
          <div className="book-grid">
            {recentlyRead.map((i) => <BookCard key={i.id} item={i} />)}
          </div>
        </>
      )}
    </main>
  );
}
