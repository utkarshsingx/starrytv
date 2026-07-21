import Link from 'next/link';
import type { ShelfItem } from '@/server/shelf/types';

export const STATUS_LABEL: Record<string, string> = {
  WANT_TO_READ: 'On the pile',
  READING: 'Reading',
  PAUSED: 'Paused',
  READ: 'Read',
  DNF: 'Gave up',
};

/** A cover image, or a typographic placeholder in the book's own register. */
export function Cover({ url, title, className = 'book-cover' }: { url: string | null; title: string; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" /> : <span>{title.slice(0, 24)}</span>}
    </span>
  );
}

export function StatusMark({ status }: { status: string }) {
  return <span className={`status-mark status-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** Progress as "page 143 of 512" with a hairline rule — never a rounded bar. */
export function Progress({ page, total }: { page: number | null; total: number | null }) {
  if (page == null || page === 0) return null;
  const pct = total && total > 0 ? Math.min(100, Math.round((page / total) * 100)) : null;
  return (
    <span className="book-card-progress">
      page {page}
      {total ? ` of ${total}` : ''}
      {pct != null && (
        <span className="rule">
          <i style={{ width: `${pct}%` }} />
        </span>
      )}
    </span>
  );
}

export function BookCard({ item }: { item: ShelfItem }) {
  return (
    <Link href={`/desk/book/${item.id}`} className="book-card">
      <Cover url={item.book.coverUrl} title={item.book.title} />
      <span className="book-card-body">
        <span className="book-card-title">{item.book.title}</span>
        <span className="book-card-author">{item.book.author}</span>
        <span className="book-card-meta">
          <StatusMark status={item.status} />
        </span>
        {item.status === 'READING' && (
          <Progress page={item.currentRead?.page ?? null} total={item.currentRead?.totalPages ?? null} />
        )}
      </span>
    </Link>
  );
}
