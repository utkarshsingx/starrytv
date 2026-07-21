import 'server-only';
import { sql } from '../db/client';
import type { BookSummary, ShelfItem, Quote, ReadStatus, ReadOutcome } from './types';

/**
 * Every shelf/library database access, in hand-written SQL. Same discipline as
 * the auth repo: the one place `sql` is touched for this domain, and every
 * per-user read takes `userId` first and filters on it — a single missing
 * `and user_id = ...` is a cross-user leak with no ORM backstop, so the guard is
 * a convention enforced by eye and by the authz tests, not by a framework.
 */

// Open Library covers, sized L. Hotlinked for now; a later hardening step
// mirrors them to R2 and fills cover_object_key, at which point this changes.
function coverUrl(coverId: number | null, objectKey: string | null): string | null {
  if (objectKey) return `/covers/${objectKey}`; // R2, once mirrored
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  return null;
}

const bookFromRow = (r: Record<string, unknown>): BookSummary => ({
  id: r.id as string,
  slug: r.slug as string,
  title: r.title as string,
  author: r.author as string,
  year: (r.first_published_year as number) ?? null,
  origin: (r.origin as string) ?? null,
  pageCount: (r.page_count as number) ?? null,
  coverUrl: coverUrl((r.open_library_cover_id as number) ?? null, (r.cover_object_key as string) ?? null),
  source: r.metadata_source as string,
});

// ─── books ───────────────────────────────────────────────────────────────────

export async function findBookById(id: string): Promise<BookSummary | null> {
  const [b] = await sql`
    select id, slug, title, author, first_published_year, origin, page_count,
           open_library_cover_id, cover_object_key, metadata_source
    from library.books where id = ${id} and deleted_at is null`;
  return b ? bookFromRow(b) : null;
}

/** Fuzzy search over the catalogue, for the add-a-book box before we reach out
 *  to Open Library. Trigram-ranked so "solaris" finds "Solaris". */
export async function searchCatalogue(q: string, limit = 6): Promise<BookSummary[]> {
  const rows = await sql`
    select id, slug, title, author, first_published_year, origin, page_count,
           open_library_cover_id, cover_object_key, metadata_source,
           greatest(similarity(title, ${q}), similarity(author, ${q})) as score
    from library.books
    where deleted_at is null
      and (title % ${q} or author % ${q} or title ilike ${'%' + q + '%'})
    order by score desc
    limit ${limit}`;
  return rows.map(bookFromRow);
}

/** Insert a looked-up book, or return the existing one if the slug is already
 *  known — the catalogue is shared, so two users adding the same book converge
 *  on one row. */
export async function upsertBook(b: {
  slug: string;
  title: string;
  author: string;
  year: number | null;
  origin: string | null;
  pageCount: number | null;
  isbn13: string | null;
  openLibraryWorkKey: string | null;
  openLibraryCoverId: number | null;
  source: string;
  createdByUserId: string | null;
}): Promise<BookSummary> {
  const [row] = await sql`
    insert into library.books
      (slug, title, author, first_published_year, origin, page_count, isbn13,
       open_library_work_key, open_library_cover_id, metadata_source, created_by_user_id)
    values
      (${b.slug}, ${b.title}, ${b.author}, ${b.year}, ${b.origin}, ${b.pageCount}, ${b.isbn13},
       ${b.openLibraryWorkKey}, ${b.openLibraryCoverId}, ${b.source}, ${b.createdByUserId})
    on conflict (slug) where deleted_at is null
    do update set title = excluded.title, updated_at = now()
    returning id, slug, title, author, first_published_year, origin, page_count,
              open_library_cover_id, cover_object_key, metadata_source`;
  return bookFromRow(row);
}

// ─── shelf ───────────────────────────────────────────────────────────────────

export async function findShelfEntry(userId: string, bookId: string) {
  const [e] = await sql`
    select id, status from shelf.shelf_entries
    where user_id = ${userId} and book_id = ${bookId} and deleted_at is null`;
  return e ?? null;
}

export async function listShelf(userId: string, status?: ReadStatus): Promise<ShelfItem[]> {
  const rows = await sql`
    select se.id, se.status, se.is_favourite, se.added_at,
           b.id as b_id, b.slug, b.title, b.author, b.first_published_year, b.origin,
           b.page_count, b.open_library_cover_id, b.cover_object_key, b.metadata_source,
           re.id as re_id, re.attempt_no, re.started_on, re.outcome, re.rating_quarter_stars,
           rp.page, rp.total_pages
    from shelf.shelf_entries se
    join library.books b on b.id = se.book_id
    left join lateral (
      select * from shelf.read_entries r
      where r.shelf_entry_id = se.id
      order by r.attempt_no desc limit 1
    ) re on true
    left join shelf.reading_progress rp on rp.read_entry_id = re.id
    where se.user_id = ${userId} and se.deleted_at is null
      ${status ? sql`and se.status = ${status}` : sql``}
    order by
      case se.status when 'READING' then 0 when 'PAUSED' then 1 when 'WANT_TO_READ' then 2
                     when 'READ' then 3 else 4 end,
      se.updated_at desc`;

  return rows.map((r) => ({
    id: r.id as string,
    status: r.status as ReadStatus,
    isFavourite: r.is_favourite as boolean,
    addedAt: (r.added_at as Date).toISOString(),
    book: bookFromRow({
      id: r.b_id, slug: r.slug, title: r.title, author: r.author,
      first_published_year: r.first_published_year, origin: r.origin,
      page_count: r.page_count, open_library_cover_id: r.open_library_cover_id,
      cover_object_key: r.cover_object_key, metadata_source: r.metadata_source,
    }),
    currentRead:
      r.re_id && (r.status === 'READING' || r.status === 'PAUSED')
        ? {
            id: r.re_id as string,
            attemptNo: r.attempt_no as number,
            startedOn: r.started_on ? String(r.started_on) : null,
            outcome: r.outcome as ReadOutcome,
            ratingQuarterStars: (r.rating_quarter_stars as number) ?? null,
            page: (r.page as number) ?? null,
            totalPages: (r.total_pages as number) ?? null,
          }
        : null,
  }));
}

export async function getShelfItem(userId: string, entryId: string): Promise<ShelfItem | null> {
  const rows = await listShelf(userId);
  return rows.find((r) => r.id === entryId) ?? null;
}

export async function insertShelfEntry(userId: string, bookId: string, status: ReadStatus): Promise<string> {
  const [row] = await sql`
    insert into shelf.shelf_entries (user_id, book_id, status)
    values (${userId}, ${bookId}, ${status})
    returning id`;
  return row.id as string;
}

/** Revive a soft-deleted entry (re-adding a book previously removed). */
export async function reviveShelfEntry(userId: string, bookId: string, status: ReadStatus): Promise<string> {
  const [row] = await sql`
    update shelf.shelf_entries
    set deleted_at = null, status = ${status}, updated_at = now(), added_at = now()
    where user_id = ${userId} and book_id = ${bookId} and deleted_at is not null
    returning id`;
  return row.id as string;
}

export async function updateShelfStatus(userId: string, entryId: string, status: ReadStatus): Promise<boolean> {
  const rows = await sql`
    update shelf.shelf_entries set status = ${status}, updated_at = now()
    where id = ${entryId} and user_id = ${userId} and deleted_at is null
    returning id`;
  return rows.length > 0;
}

export async function setFavourite(userId: string, entryId: string, fav: boolean): Promise<boolean> {
  const rows = await sql`
    update shelf.shelf_entries set is_favourite = ${fav}, updated_at = now()
    where id = ${entryId} and user_id = ${userId} and deleted_at is null returning id`;
  return rows.length > 0;
}

export async function softDeleteEntry(userId: string, entryId: string): Promise<boolean> {
  const rows = await sql`
    update shelf.shelf_entries set deleted_at = now(), updated_at = now()
    where id = ${entryId} and user_id = ${userId} and deleted_at is null returning id`;
  return rows.length > 0;
}

// ─── reads + progress ────────────────────────────────────────────────────────

export async function openRead(opts: {
  shelfEntryId: string;
  userId: string;
  bookId: string;
  totalPages: number | null;
}): Promise<string> {
  // attempt_no = one past the highest existing attempt for this shelf entry, so
  // a re-read is a new row rather than an overwrite.
  const [read] = await sql`
    insert into shelf.read_entries (shelf_entry_id, user_id, book_id, attempt_no, started_on, outcome, edition_page_count)
    values (
      ${opts.shelfEntryId}, ${opts.userId}, ${opts.bookId},
      (select coalesce(max(attempt_no), 0) + 1 from shelf.read_entries where shelf_entry_id = ${opts.shelfEntryId}),
      current_date, 'IN_PROGRESS', ${opts.totalPages}
    )
    returning id`;
  await sql`
    insert into shelf.reading_progress (read_entry_id, user_id, book_id, page, total_pages)
    values (${read.id}, ${opts.userId}, ${opts.bookId}, 0, ${opts.totalPages})`;
  return read.id as string;
}

export async function currentOpenRead(userId: string, shelfEntryId: string) {
  const [r] = await sql`
    select id, book_id from shelf.read_entries
    where shelf_entry_id = ${shelfEntryId} and user_id = ${userId} and outcome = 'IN_PROGRESS'
    order by attempt_no desc limit 1`;
  return r ?? null;
}

export async function finishRead(userId: string, readId: string, ratingQuarterStars: number | null): Promise<boolean> {
  const rows = await sql`
    update shelf.read_entries
    set outcome = 'FINISHED', finished_on = current_date, updated_at = now(),
        rating_quarter_stars = coalesce(${ratingQuarterStars}, rating_quarter_stars)
    where id = ${readId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export async function updateProgressPage(userId: string, readId: string, page: number): Promise<boolean> {
  const rows = await sql`
    update shelf.reading_progress
    set page = ${page}, source = 'MANUAL', recorded_at = now(), updated_at = now()
    where read_entry_id = ${readId} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

// ─── quotes ──────────────────────────────────────────────────────────────────

export async function insertQuote(q: {
  userId: string;
  bookId: string;
  readEntryId: string | null;
  body: string;
  page: number | null;
  chapter: string | null;
  note: string | null;
}): Promise<Quote> {
  const [row] = await sql`
    insert into shelf.quotes (user_id, book_id, read_entry_id, body, page, chapter, note)
    values (${q.userId}, ${q.bookId}, ${q.readEntryId}, ${q.body}, ${q.page}, ${q.chapter}, ${q.note})
    returning id, body, page, chapter, note, created_at`;
  return {
    id: row.id as string, body: row.body as string, page: (row.page as number) ?? null,
    chapter: (row.chapter as string) ?? null, note: (row.note as string) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function listQuotes(userId: string, bookId: string): Promise<Quote[]> {
  const rows = await sql`
    select id, body, page, chapter, note, created_at from shelf.quotes
    where user_id = ${userId} and book_id = ${bookId} and deleted_at is null
    order by coalesce(page, 2147483647), created_at`;
  return rows.map((r) => ({
    id: r.id as string, body: r.body as string, page: (r.page as number) ?? null,
    chapter: (r.chapter as string) ?? null, note: (r.note as string) ?? null,
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

export async function deleteQuote(userId: string, quoteId: string): Promise<boolean> {
  const rows = await sql`
    update shelf.quotes set deleted_at = now() where id = ${quoteId} and user_id = ${userId} and deleted_at is null
    returning id`;
  return rows.length > 0;
}

// ─── stats for the desk header ───────────────────────────────────────────────

export async function shelfStats(userId: string) {
  const [row] = await sql`
    select
      count(*) filter (where status = 'READING' and deleted_at is null) as reading,
      count(*) filter (where status = 'WANT_TO_READ' and deleted_at is null) as want,
      count(*) filter (where status = 'READ' and deleted_at is null) as read,
      count(*) filter (where deleted_at is null) as total
    from shelf.shelf_entries where user_id = ${userId}`;
  const [finished] = await sql`
    select count(*) as n from shelf.read_entries
    where user_id = ${userId} and finished_on is not null
      and finished_on >= date_trunc('year', current_date)`;
  return {
    reading: Number(row.reading),
    want: Number(row.want),
    read: Number(row.read),
    total: Number(row.total),
    finishedThisYear: Number(finished.n),
  };
}
