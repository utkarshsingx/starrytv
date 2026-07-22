import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { forOwner } from '@/server/ugc/service';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  return ok({ review: await forOwner(userId, id) });
});
