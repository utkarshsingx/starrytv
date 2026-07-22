import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { updateGenre } from '@/server/admin/service';
import { listGenres } from '@/server/admin/repo';
import { jsonBody, str } from '@/server/auth/request';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const adminId = await requireAdmin();
  const { id } = await ctx.params;
  const b = await jsonBody(req);
  await updateGenre({ id: adminId, role: 'admin' }, id, {
    name: b.name !== undefined ? str(b.name) : undefined,
    blurb: b.blurb !== undefined ? str(b.blurb) : undefined,
    channelColour: b.channelColour !== undefined ? (str(b.channelColour) || null) : undefined,
    channelNumber: b.channelNumber !== undefined ? (typeof b.channelNumber === 'number' ? b.channelNumber : null) : undefined,
    sortOrder: typeof b.sortOrder === 'number' ? b.sortOrder : undefined,
    isActive: typeof b.isActive === 'boolean' ? b.isActive : undefined,
  });
  const genres = await listGenres();
  return ok({ genre: genres.find((g) => g.id === id) ?? null });
});
