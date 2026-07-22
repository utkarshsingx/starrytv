import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { approve, reject, requestChanges, unpublish, claim } from '@/server/ugc/service';
import { jsonBody, str } from '@/server/auth/request';
import { REASON_CODES, type ReasonCode } from '@/server/ugc/types';
import { badRequest } from '@/server/auth/errors';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** One endpoint, dispatched on `action`: approve / reject / changes / unpublish
 *  / claim. Every one routes through the transition service, which is the only
 *  writer of status. */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const adminId = await requireAdmin();
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  const action = str(b.action);

  const reasonCode = (str(b.reasonCode) || 'OTHER') as ReasonCode;
  const reasonText = str(b.reasonText);
  const needsReason = () => {
    if (!REASON_CODES.includes(reasonCode)) throw badRequest('BAD_REASON', 'Pick a reason.');
  };

  switch (action) {
    case 'claim':
      return ok({ review: await claim(adminId, id) });
    case 'approve':
      return ok({ review: await approve(adminId, id) });
    case 'reject':
      needsReason();
      return ok({ review: await reject(adminId, id, reasonCode, reasonText) });
    case 'changes':
      needsReason();
      return ok({ review: await requestChanges(adminId, id, reasonCode, reasonText) });
    case 'unpublish':
      return ok({ review: await unpublish(adminId, id, reasonText) });
    default:
      throw badRequest('BAD_ACTION', 'Unknown action.');
  }
});
