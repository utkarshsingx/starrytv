import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { listShelf, addToShelf, stats } from '@/server/shelf/service';
import { jsonBody, str } from '@/server/auth/request';
import type { ReadStatus } from '@/server/shelf/types';

export const runtime = 'nodejs';

export const GET = route(async (req: NextRequest) => {
  const userId = await requireUserId();
  const status = req.nextUrl.searchParams.get('status') as ReadStatus | null;
  const withStats = req.nextUrl.searchParams.get('stats') === '1';
  const items = await listShelf(userId, status ?? undefined);
  return ok(withStats ? { items, stats: await stats(userId) } : { items });
});

export const POST = route(async (req: NextRequest) => {
  const userId = await requireUserId();
  const b = await jsonBody(req);
  const item = await addToShelf(userId, str(b.bookId), (str(b.status) || 'WANT_TO_READ') as ReadStatus);
  return ok({ item }, { status: 201 });
});
