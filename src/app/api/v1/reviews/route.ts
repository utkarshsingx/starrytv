import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { saveDraft, myReviews } from '@/server/ugc/service';
import { jsonBody, str } from '@/server/auth/request';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const userId = await requireUserId();
  return ok({ reviews: await myReviews(userId) });
});

/** Create or update the draft for a book (append a revision). */
export const POST = route(async (req: NextRequest) => {
  const userId = await requireUserId();
  const b = await jsonBody(req);
  const review = await saveDraft(userId, {
    bookId: str(b.bookId),
    readEntryId: str(b.readEntryId) || null,
    hook: str(b.hook),
    body: str(b.body),
    longBody: str(b.longBody) || null,
    underdog: str(b.underdog),
    tags: Array.isArray(b.tags) ? (b.tags as unknown[]).map(String) : [],
  });
  return ok({ review }, { status: 201 });
});
