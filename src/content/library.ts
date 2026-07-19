import type { Genre } from '../types';
import { bookId } from '../lib/links';
import { GENRE_DATA } from './books.data';

/**
 * The library.
 *
 * `books.data.ts` is the file to edit — it is plain data, no logic. Everything
 * here just derives ids and convenience indexes from it, so adding, removing or
 * rewriting a book is a one-file change and nothing downstream needs touching.
 */

export const library: Genre[] = GENRE_DATA.map((g) => ({
  slug: g.slug,
  name: g.name,
  books: g.books.map((b) => ({ ...b, id: bookId(g.slug, b.title) })),
}));

export const bookCount = library.reduce((n, g) => n + g.books.length, 0);

export const allBooks = library.flatMap((g) => g.books);

export function genreOf(bookIdValue: string): Genre | undefined {
  return library.find((g) => g.books.some((b) => b.id === bookIdValue));
}
