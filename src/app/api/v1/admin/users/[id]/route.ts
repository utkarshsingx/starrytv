import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { setUserStatus, setUserRole, forceLogout } from '@/server/admin/service';
import { getUserDetail } from '@/server/admin/repo';
import { jsonBody, str } from '@/server/auth/request';
import { badRequest } from '@/server/auth/errors';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  return ok({ user: await getUserDetail(id) });
});

/** Dispatched on `action`: suspend / restore / role / force-logout. */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const adminId = await requireAdmin();
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  const actor = { id: adminId, role: 'admin' as const };
  const reason = str(b.reason);

  switch (str(b.action)) {
    case 'suspend': await setUserStatus(actor, id, 'SUSPENDED', reason); break;
    case 'restore': await setUserStatus(actor, id, 'ACTIVE', reason); break;
    case 'make-admin': await setUserRole(actor, id, 'admin', reason); break;
    case 'make-user': await setUserRole(actor, id, 'user', reason); break;
    case 'force-logout': await forceLogout(actor, id); break;
    default: throw badRequest('BAD_ACTION', 'Unknown action.');
  }
  return ok({ user: await getUserDetail(id) });
});
