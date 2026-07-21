import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { removeQuote } from '@/server/shelf/service';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await removeQuote(userId, id);
  return ok({ ok: true });
});
