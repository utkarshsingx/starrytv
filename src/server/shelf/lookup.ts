import 'server-only';
import * as repo from './repo';
import { bookId as deriveSlug } from '../../lib/links';
import type { BookSummary } from './types';

/**
 * Finding a book to add.
 *
 * First the local catalogue (the 100 house books plus anything anyone has added
 * before) via trigram search — instant, and it means popular books are added
 * once and shared. Only if that comes up short do we ask Open Library.
 *
 * Open Library, not Google Books, as the primary: it is free, keyless, and its
 * data is permanently cacheable (the Internet Archive asserts no proprietary
 * rights), so a looked-up book is written to our catalogue once and never
 * fetched again. The User-Agent carries the app name and a contact address,
 * which lifts Open Library's rate limit from 1 to ~3 requests/second.
 */

const OL_UA = 'StarryTV/0.1 (+https://starrytv.vercel.app; mail.shubhamlal@gmail.com)';

type OlDoc = {
  key?: string; // /works/OL...W
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  isbn?: string[];
  cover_i?: number;
  edition_count?: number;
};

export async function lookupBooks(query: string, userId: string | null): Promise<BookSummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // Both sources, always, in parallel. The earlier "skip Open Library when the
  // local catalogue already returned a few" short-circuit was wrong: trigram
  // matching inflates the local count on common words, so searching a specific
  // title ("the master and margarita") could match three house books on
  // "master"/"the" and never reach the book the reader actually wanted. Open
  // Library is a debounced call in the UI, so one request per search is fine.
  const [local, remote] = await Promise.all([
    repo.searchCatalogue(q, 6),
    searchOpenLibrary(q, userId).catch(() => [] as BookSummary[]),
  ]);

  // House/local catalogue first (a curated or already-known book beats a raw
  // Open Library hit), then Open Library, de-duplicated by slug.
  const seen = new Set(local.map((b) => b.slug));
  const merged = [...local];
  for (const b of remote) {
    if (!seen.has(b.slug)) {
      merged.push(b);
      seen.add(b.slug);
    }
  }
  return merged.slice(0, 10);
}

async function searchOpenLibrary(q: string, userId: string | null): Promise<BookSummary[]> {
  // `q=` (general relevance), NOT `title=`. Title-only matching ranked a German
  // dissertation *about* Solaris above Lem's actual novel, because the thesis
  // carries "Solaris" and "Lem" in its title. The general query matches title
  // and author together and surfaces the canonical work.
  const url =
    'https://openlibrary.org/search.json?' +
    new URLSearchParams({
      q,
      fields: 'key,title,author_name,first_publish_year,number_of_pages_median,isbn,cover_i,edition_count',
      limit: '10',
    });

  const res = await fetch(url, {
    headers: { 'User-Agent': OL_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { docs?: OlDoc[] };

  // Re-rank: a canonical work has many editions and a cover; an obscure thesis
  // has one edition and none. Keep Open Library's relevance as the base and
  // nudge multi-edition, covered works up, so the book a reader means is near
  // the top even when a same-titled oddity scored well.
  const docs = (data.docs ?? [])
    .filter((d) => d.title && d.author_name?.[0])
    .map((d, i) => ({
      d,
      score:
        -i * 2 + // preserve OL's order as the dominant signal
        Math.min(6, Math.log2((d.edition_count ?? 1) + 1)) +
        (d.cover_i ? 1.5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.d)
    .slice(0, 6);

  // Persist each result so the second person to want it finds it locally.
  const out: BookSummary[] = [];
  for (const d of docs) {
    const author = d.author_name![0];
    const slug = deriveSlug('ol', `${d.title}-${author}`);
    const isbn13 = (d.isbn ?? []).find((i) => i.replace(/[^0-9Xx]/g, '').length === 13) ?? null;
    const saved = await repo.upsertBook({
      slug,
      title: d.title.slice(0, 300),
      author: author.slice(0, 200),
      year: d.first_publish_year ?? null,
      origin: null,
      pageCount: d.number_of_pages_median ?? null,
      isbn13: isbn13 ? isbn13.replace(/[^0-9Xx]/g, '').slice(0, 13) : null,
      openLibraryWorkKey: d.key ?? null,
      openLibraryCoverId: d.cover_i ?? null,
      source: 'OPEN_LIBRARY',
      createdByUserId: userId,
    });
    out.push(saved);
  }
  return out;
}
