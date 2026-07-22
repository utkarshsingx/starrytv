import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { listGenres } from '@/server/admin/repo';
import { createGenre } from '@/server/admin/service';
import { jsonBody, str } from '@/server/auth/request';

export const runtime = 'nodejs';

export const GET = route(async () => {
  await requireAdmin();
  return ok({ genres: await listGenres() });
});

export const POST = route(async (req: NextRequest) => {
  const adminId = await requireAdmin();
  const b = await jsonBody(req);
  const id = await createGenre({ id: adminId, role: 'admin' }, {
    name: str(b.name),
    blurb: str(b.blurb) || undefined,
    channelColour: str(b.channelColour) || undefined,
    channelNumber: typeof b.channelNumber === 'number' ? b.channelNumber : null,
  });
  return ok({ id }, { status: 201 });
});
