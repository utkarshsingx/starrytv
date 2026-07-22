import 'server-only';
import * as repo from './repo';
import { transition } from './transition';
import { sql } from '../db/client';
import { getReviewWindow } from '../settings';
import { bookId as deriveSlug } from '../../lib/links';
import { validateBroadcastCut, wordCount } from '../../shared/review-format';
import { lintStyle } from '../../shared/style-linter';
import { badRequest } from '../auth/errors';
import type { ReviewView, RevisionInput, ReasonCode } from './types';
export type { HubReview } from './repo';

/**
 * The review lifecycle, framework-free.
 *
 * A review is a `reviews` row plus a chain of immutable `review_revisions`.
 * Saving edits a draft in place by appending a new revision and pointing the
 * pending pointer at it; the status only ever moves through `transition()`.
 */

async function bookGenreId(bookId: string): Promise<string | null> {
  const [row] = await sql`
    select genre_id from library.book_genres where book_id = ${bookId} order by is_primary desc limit 1`;
  return (row?.genre_id as string) ?? null;
}

async function uniqueSlug(title: string, author: string): Promise<string> {
  const base = deriveSlug('r', `${title}-${author}`).slice(0, 90);
  if (!(await repo.slugExists(base))) return base;
  for (let i = 2; i < 100; i++) {
    const s = `${base}-${i}`;
    if (!(await repo.slugExists(s))) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Create or update a user's draft review for a book, appending a revision. */
export async function saveDraft(
  userId: string,
  input: { bookId: string; readEntryId?: string | null; hook: string; body: string; longBody?: string | null; underdog: string; tags?: string[] },
): Promise<ReviewView> {
  const [book] = await sql`select id, title, author from library.books where id = ${input.bookId} and deleted_at is null`;
  if (!book) throw badRequest('NO_BOOK', 'That book is not in the catalogue.');

  const rev: RevisionInput = {
    hook: input.hook.trim(),
    body: input.body.trim(),
    longBody: input.longBody?.trim() || null,
    underdog: input.underdog.trim(),
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
  };

  // A draft can hold half-written text, so the window is NOT enforced on save —
  // only on submit. But the hard rails (which the DB CHECK also enforces) must
  // hold, or the insert fails with a raw constraint error; clamp-check here for
  // a friendly message.
  const hookWords = wordCount(rev.hook);
  const bodyWords = wordCount(rev.body);
  if (hookWords < 1 || hookWords > 14) throw badRequest('HOOK_RAILS', 'The hook must be 1–14 words.');
  if (bodyWords < 30 || bodyWords > 120) throw badRequest('BODY_RAILS', 'The broadcast cut must be 30–120 words.');
  if (!rev.underdog) throw badRequest('NO_UNDERDOG', 'Say why the book was overlooked.');

  let reviewId: string;
  const inflight = await repo.findInflight(userId, input.bookId);
  if (inflight) {
    reviewId = inflight.id as string;
  } else {
    const genreId = await bookGenreId(input.bookId);
    const slug = await uniqueSlug(book.title as string, book.author as string);
    reviewId = await repo.createDraft({ userId, bookId: input.bookId, genreId, readEntryId: input.readEntryId ?? null, slug });
  }

  const styleReport = lintStyle(`${rev.body} ${rev.longBody ?? ''}`);
  const revisionId = await repo.insertRevision({
    reviewId, input: rev, hookWords, bodyWords, styleReport, createdBy: userId, editedByAdmin: false,
  });
  await repo.setPendingRevision(reviewId, revisionId);

  return (await repo.getReviewForOwner(userId, reviewId))!;
}

/** Submit a draft for review — where the configured house window IS enforced. */
export async function submit(userId: string, reviewId: string): Promise<ReviewView> {
  const review = await repo.getReviewForOwner(userId, reviewId);
  if (!review) throw badRequest('NO_REVIEW', 'That review does not exist.');
  if (!review.revision) throw badRequest('EMPTY', 'Write the review before submitting.');
  if (review.status !== 'DRAFT' && review.status !== 'CHANGES_REQUESTED') {
    throw badRequest('NOT_SUBMITTABLE', 'This review has already been submitted.');
  }

  const window = await getReviewWindow();
  const check = validateBroadcastCut(
    { hook: review.revision.hook, body: review.revision.body, underdog: review.revision.underdog },
    window,
  );
  if (!check.ok) {
    // The same validation the composer runs live — enforced here so the browser
    // is never the only gate.
    const first = check.hook.message ?? check.body.message ?? check.underdog.message;
    throw badRequest('OUT_OF_WINDOW', first ?? 'The review is outside the house format.');
  }

  await transition({ reviewId, to: 'SUBMITTED', actor: { userId, role: 'user' } });
  return (await repo.getReviewForOwner(userId, reviewId))!;
}

// ─── admin actions ───────────────────────────────────────────────────────────

export async function listQueue(): Promise<ReviewView[]> {
  return repo.listQueue();
}

export async function claim(adminId: string, reviewId: string): Promise<ReviewView> {
  const review = await repo.getReviewByIdAdmin(reviewId);
  if (!review) throw badRequest('NO_REVIEW', 'That review does not exist.');
  if (review.status === 'SUBMITTED') {
    await transition({ reviewId, to: 'IN_REVIEW', actor: { userId: adminId, role: 'admin' } });
  }
  return (await repo.getReviewByIdAdmin(reviewId))!;
}

export async function approve(adminId: string, reviewId: string): Promise<ReviewView> {
  const review = await repo.getReviewByIdAdmin(reviewId);
  if (!review) throw badRequest('NO_REVIEW', 'That review does not exist.');
  // Publish the pending (or latest) revision. Read it back to make it live.
  const [rev] = await sql`
    select id from ugc.review_revisions where review_id = ${reviewId} order by rev_no desc limit 1`;
  if (!rev) throw badRequest('NO_REVISION', 'This review has nothing to publish.');
  await transition({
    reviewId, to: 'PUBLISHED', actor: { userId: adminId, role: 'admin' }, liveRevisionId: rev.id as string,
  });
  // Clear the pending pointer now that it is live.
  await sql`update ugc.reviews set pending_revision_id = null where id = ${reviewId}`;
  await bumpTrust(review.author.id, 'approved');
  return (await repo.getReviewByIdAdmin(reviewId))!;
}

export async function reject(
  adminId: string, reviewId: string, reasonCode: ReasonCode, reasonText: string,
): Promise<ReviewView> {
  const review = await repo.getReviewByIdAdmin(reviewId);
  if (!review) throw badRequest('NO_REVIEW', 'That review does not exist.');
  await transition({
    reviewId, to: 'REJECTED', actor: { userId: adminId, role: 'admin' },
    reasonCode, reasonText: reasonText.trim() || null,
  });
  await bumpTrust(review.author.id, 'rejected');
  return (await repo.getReviewByIdAdmin(reviewId))!;
}

export async function requestChanges(
  adminId: string, reviewId: string, reasonCode: ReasonCode, reasonText: string,
): Promise<ReviewView> {
  const review = await repo.getReviewByIdAdmin(reviewId);
  if (!review) throw badRequest('NO_REVIEW', 'That review does not exist.');
  await transition({
    reviewId, to: 'CHANGES_REQUESTED', actor: { userId: adminId, role: 'admin' },
    reasonCode, reasonText: reasonText.trim() || null,
  });
  return (await repo.getReviewByIdAdmin(reviewId))!;
}

export async function unpublish(adminId: string, reviewId: string, reason: string): Promise<ReviewView> {
  await transition({
    reviewId, to: 'UNPUBLISHED', actor: { userId: adminId, role: 'admin' }, reasonText: reason.trim() || null,
  });
  return (await repo.getReviewByIdAdmin(reviewId))!;
}

async function bumpTrust(userId: string, kind: 'approved' | 'rejected'): Promise<void> {
  await sql`
    insert into ugc.author_trust (user_id, approved_count, rejected_count, last_decision_at)
    values (${userId}, ${kind === 'approved' ? 1 : 0}, ${kind === 'rejected' ? 1 : 0}, now())
    on conflict (user_id) do update set
      approved_count = ugc.author_trust.approved_count + ${kind === 'approved' ? 1 : 0},
      rejected_count = ugc.author_trust.rejected_count + ${kind === 'rejected' ? 1 : 0},
      last_decision_at = now(), updated_at = now()`;
}

// ─── reads ───────────────────────────────────────────────────────────────────

export async function myReviews(userId: string): Promise<ReviewView[]> {
  return repo.listOwnReviews(userId);
}
export async function bySlug(slug: string): Promise<ReviewView | null> {
  return repo.getReviewBySlug(slug);
}
export async function forOwner(userId: string, reviewId: string): Promise<ReviewView | null> {
  return repo.getReviewForOwner(userId, reviewId);
}
export async function publishedForHub() {
  return repo.listPublishedForHub();
}

