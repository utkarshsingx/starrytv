import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { getItem, changeStatus, setProgress, toggleFavourite, removeFromShelf } from '@/server/shelf/service';
import { jsonBody, str } from '@/server/auth/request';
import type { ReadStatus } from '@/server/shelf/types';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const item = await getItem(userId, id);
  return ok({ item });
});

/** One PATCH endpoint for the three small mutations the book card makes:
 *  status change, page progress, favourite toggle. */
export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const b = await jsonBody(req);

  if (typeof b.page === 'number') {
    return ok({ item: await setProgress(userId, id, b.page) });
  }
  if (typeof b.isFavourite === 'boolean') {
    await toggleFavourite(userId, id, b.isFavourite);
    return ok({ item: await getItem(userId, id) });
  }
  if (b.status) {
    const rating = typeof b.ratingQuarterStars === 'number' ? b.ratingQuarterStars : null;
    return ok({ item: await changeStatus(userId, id, str(b.status) as ReadStatus, rating) });
  }
  return ok({ item: await getItem(userId, id) });
});

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await removeFromShelf(userId, id);
  return ok({ ok: true });
});
