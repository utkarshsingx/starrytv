/**
 * Seed the canonical catalogue: the 20 house genres and 100 curated books.
 *
 *   npm run seed:catalogue
 *
 * These are the editorial library the site launched with. They go in as
 * `metadata_source = 'HOUSE'`, keep the exact slugs the Boring Edition already
 * uses for its anchors (via the same `bookId()` the frontend uses), and become
 * the books that stop the public hub from ever rendering empty once user
 * reviews arrive in Phase 4.
 *
 * Idempotent: on a slug that already exists it updates the bibliographic fields
 * rather than inserting a duplicate, so re-running after editing `books.data.ts`
 * reconciles the catalogue.
 *
 * Only bibliographic data is seeded here — title, author, year, origin. The
 * reviews/hooks/underdog lines in `books.data.ts` are editorial content that
 * Phase 4 turns into published reviews; they do not belong in `library.books`.
 */
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

// The frontend's own data + id derivation, imported so the slugs match exactly.
const { library } = await import('../src/content/library.ts');

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('No DIRECT_URL / DATABASE_URL in .env.local');
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  let genreN = 0;
  let bookN = 0;

  await sql.begin(async (tx) => {
    for (const [i, genre] of library.entries()) {
      const [g] = await tx`
        insert into library.genres (slug, name, sort_order)
        values (${genre.slug}, ${genre.name}, ${i})
        on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order
        returning id`;
      genreN++;

      for (const book of genre.books) {
        const [b] = await tx`
          insert into library.books (slug, title, author, first_published_year, origin, metadata_source)
          values (${book.id}, ${book.title}, ${book.author}, ${book.year}, ${book.origin}, 'HOUSE')
          on conflict (slug) where deleted_at is null
          do update set title = excluded.title, author = excluded.author,
                        first_published_year = excluded.first_published_year,
                        origin = excluded.origin, updated_at = now()
          returning id`;
        bookN++;

        await tx`
          insert into library.book_genres (book_id, genre_id, is_primary)
          values (${b.id}, ${g.id}, true)
          on conflict (book_id, genre_id) do update set is_primary = true`;
      }
    }
  });

  const [{ genres }] = await sql`select count(*)::int as genres from library.genres`;
  const [{ books }] = await sql`select count(*)::int as books from library.books`;
  console.log(`seeded ${genreN} genres, ${bookN} books`);
  console.log(`catalogue now holds ${genres} genres and ${books} books`);
} catch (err) {
  console.error('seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
