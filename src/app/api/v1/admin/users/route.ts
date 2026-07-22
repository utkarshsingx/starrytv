import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { listUsers } from '@/server/admin/repo';

export const runtime = 'nodejs';

/** The users list. The console page fetches this server-side too, but exposing
 *  it lets a future debounced live-search box call it directly. */
export const GET = route(async (req: NextRequest) => {
  await requireAdmin();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  return ok({ users: await listUsers(q) });
});
