import type { Book } from '../types';

/**
 * Where a book links to.
 *
 * These are built as *search* URLs rather than stored per-book. A hand-written
 * product URL rots the moment an edition goes out of print; a search for title +
 * author keeps working for as long as the shop does. It also means adding a book
 * to the library never involves hunting down an ISBN.
 */

export type BookLink = { label: string; href: string; note: string };

const q = (b: Book) => encodeURIComponent(`${b.title} ${b.author}`);

export function linksFor(book: Book): BookLink[] {
  return [
    {
      label: 'Bookshop.org',
      href: `https://bookshop.org/beta-search?keywords=${q(book)}`,
      note: 'supports independent bookshops',
    },
    {
      label: 'Your library',
      href: `https://search.worldcat.org/search?q=${q(book)}`,
      note: 'find a copy in a library near you',
    },
    {
      label: 'Goodreads',
      href: `https://www.goodreads.com/search?q=${q(book)}`,
      note: 'reviews and editions',
    },
    {
      label: 'Open Library',
      href: `https://openlibrary.org/search?q=${q(book)}`,
      note: 'often has a free scan to borrow',
    },
  ];
}

/** The one link used in compact contexts — the TV overlay, the index. */
export function primaryLink(book: Book): string {
  return `https://bookshop.org/beta-search?keywords=${q(book)}`;
}

export function bookId(genreSlug: string, title: string): string {
  return `${genreSlug}--${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}
