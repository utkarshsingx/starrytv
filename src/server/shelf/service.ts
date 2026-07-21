import 'server-only';
import * as repo from './repo';
import { badRequest } from '../auth/errors';
import type { ReadStatus, ShelfItem, Quote } from './types';

/**
 * The reading-log logic, framework-free like the auth service.
 *
 * The one piece of real behaviour here is what a status change *means* for the
 * read-attempt rows underneath it:
 *  - moving to READING with no open attempt opens one (attempt N+1, dated today);
 *  - moving to READ finishes the open attempt (dated today);
 *  - re-adding a book you had removed revives the soft-deleted shelf row rather
 *    than colliding with the (user, book) uniqueness constraint.
 * The UI never has to know any of this; it sets a status and the reads follow.
 */

const STATUSES: ReadStatus[] = ['WANT_TO_READ', 'READING', 'PAUSED', 'READ', 'DNF'];

export async function addToShelf(
  userId: string,
  bookId: string,
  status: ReadStatus,
): Promise<ShelfItem> {
  if (!STATUSES.includes(status)) throw badRequest('BAD_STATUS', 'Unknown shelf status.');
  const book = await repo.findBookById(bookId);
  if (!book) throw badRequest('NO_BOOK', 'That book is not in the catalogue.');

  const existing = await repo.findShelfEntry(userId, bookId);
  if (existing) throw badRequest('ALREADY_ON_SHELF', 'That book is already on your shelf.');

  // Re-adding a previously-removed book revives its row (the partial unique index
  // still counts the soft-deleted one), otherwise insert fresh.
  let entryId: string;
  try {
    entryId = await repo.insertShelfEntry(userId, bookId, status);
  } catch {
    entryId = await repo.reviveShelfEntry(userId, bookId, status);
  }

  if (status === 'READING') {
    await repo.openRead({ shelfEntryId: entryId, userId, bookId, totalPages: book.pageCount });
  }

  const item = await repo.getShelfItem(userId, entryId);
  if (!item) throw badRequest('NO_BOOK', 'Could not read the shelf entry back.');
  return item;
}

export async function changeStatus(
  userId: string,
  entryId: string,
  status: ReadStatus,
  ratingQuarterStars?: number | null,
): Promise<ShelfItem> {
  if (!STATUSES.includes(status)) throw badRequest('BAD_STATUS', 'Unknown shelf status.');
  const before = await repo.getShelfItem(userId, entryId);
  if (!before) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');

  const ok = await repo.updateShelfStatus(userId, entryId, status);
  if (!ok) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');

  const open = await repo.currentOpenRead(userId, entryId);

  if (status === 'READING' && !open) {
    await repo.openRead({
      shelfEntryId: entryId,
      userId,
      bookId: before.book.id,
      totalPages: before.book.pageCount,
    });
  } else if (status === 'READ' && open) {
    await repo.finishRead(userId, open.id, ratingQuarterStars ?? null);
  }

  return (await repo.getShelfItem(userId, entryId))!;
}

export async function setProgress(userId: string, entryId: string, page: number): Promise<ShelfItem> {
  if (!Number.isInteger(page) || page < 0) throw badRequest('BAD_PAGE', 'Page must be a whole number.');
  const item = await repo.getShelfItem(userId, entryId);
  if (!item) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');

  let read = await repo.currentOpenRead(userId, entryId);
  // Recording progress on a book not yet marked reading starts the read.
  if (!read) {
    if (item.status !== 'READING') await repo.updateShelfStatus(userId, entryId, 'READING');
    await repo.openRead({ shelfEntryId: entryId, userId, bookId: item.book.id, totalPages: item.book.pageCount });
    read = await repo.currentOpenRead(userId, entryId);
  }
  await repo.updateProgressPage(userId, read!.id, page);
  return (await repo.getShelfItem(userId, entryId))!;
}

export async function toggleFavourite(userId: string, entryId: string, fav: boolean): Promise<void> {
  const ok = await repo.setFavourite(userId, entryId, fav);
  if (!ok) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');
}

export async function removeFromShelf(userId: string, entryId: string): Promise<void> {
  const ok = await repo.softDeleteEntry(userId, entryId);
  if (!ok) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');
}

export async function listShelf(userId: string, status?: ReadStatus) {
  return repo.listShelf(userId, status);
}
export async function getItem(userId: string, entryId: string) {
  return repo.getShelfItem(userId, entryId);
}
export async function stats(userId: string) {
  return repo.shelfStats(userId);
}

// ─── quotes ──────────────────────────────────────────────────────────────────

export async function addQuote(
  userId: string,
  entryId: string,
  input: { body: string; page?: number | null; chapter?: string | null; note?: string | null },
): Promise<Quote> {
  const item = await repo.getShelfItem(userId, entryId);
  if (!item) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');
  const body = input.body.trim();
  if (body.length < 1) throw badRequest('EMPTY_QUOTE', 'A quote needs some text.');
  if (body.length > 2000) throw badRequest('QUOTE_TOO_LONG', 'Quotes are capped at ~300 words.');

  const read = await repo.currentOpenRead(userId, entryId);
  return repo.insertQuote({
    userId,
    bookId: item.book.id,
    readEntryId: read?.id ?? null,
    body,
    page: input.page ?? null,
    chapter: input.chapter?.trim() || null,
    note: input.note?.trim() || null,
  });
}

export async function listQuotesForEntry(userId: string, entryId: string): Promise<Quote[]> {
  const item = await repo.getShelfItem(userId, entryId);
  if (!item) throw badRequest('NO_ENTRY', 'That shelf entry does not exist.');
  return repo.listQuotes(userId, item.book.id);
}

export async function removeQuote(userId: string, quoteId: string): Promise<void> {
  const ok = await repo.deleteQuote(userId, quoteId);
  if (!ok) throw badRequest('NO_QUOTE', 'That quote does not exist.');
}
