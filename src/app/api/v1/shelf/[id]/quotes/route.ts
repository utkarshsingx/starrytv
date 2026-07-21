import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { addQuote, listQuotesForEntry } from '@/server/shelf/service';
import { jsonBody, str } from '@/server/auth/request';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  return ok({ quotes: await listQuotesForEntry(userId, id) });
});

export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  const quote = await addQuote(userId, id, {
    body: str(b.body),
    page: typeof b.page === 'number' ? b.page : null,
    chapter: str(b.chapter) || null,
    note: str(b.note) || null,
  });
  return ok({ quote }, { status: 201 });
});
