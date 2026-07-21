import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { listShelf } from '@/server/shelf/service';
import { BookCard, STATUS_LABEL } from '../parts';
import '../desk.css';

export const metadata: Metadata = { title: 'My library' };
export const dynamic = 'force-dynamic';

const ORDER = ['READING', 'PAUSED', 'WANT_TO_READ', 'READ', 'DNF'] as const;

export default async function ShelfPage() {
  const user = (await getCurrentUser())!;
  const items = await listShelf(user.id);

  const groups = ORDER.map((status) => ({
    status,
    items: items.filter((i) => i.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="app-main">
      <p className="app-kicker">
        <Link href="/desk" style={{ color: 'inherit', textDecoration: 'none' }}>Desk</Link> / My library
      </p>
      <h1 className="app-h1">Everything on your shelf</h1>

      {items.length === 0 && (
        <div className="desk-empty" style={{ marginTop: '2rem' }}>
          Nothing here yet. <Link href="/desk">Add a book</Link> to get started.
        </div>
      )}

      {groups.map((g) => (
        <section key={g.status}>
          <div className="desk-section-head">
            <h2>{STATUS_LABEL[g.status]}</h2>
            <span className="count">{g.items.length}</span>
          </div>
          <div className="book-grid">
            {g.items.map((i) => <BookCard key={i.id} item={i} />)}
          </div>
        </section>
      ))}
    </main>
  );
}
