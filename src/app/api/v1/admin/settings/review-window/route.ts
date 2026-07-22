import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { updateReviewWindow } from '@/server/admin/service';
import { jsonBody } from '@/server/auth/request';

export const runtime = 'nodejs';

export const PUT = route(async (req: NextRequest) => {
  const adminId = await requireAdmin();
  const b = await jsonBody(req);
  const window = await updateReviewWindow({ id: adminId, role: 'admin' }, {
    hookMaxWords: Number(b.hookMaxWords),
    bodyMinWords: Number(b.bodyMinWords),
    bodyMaxWords: Number(b.bodyMaxWords),
    underdogMaxSentences: Number(b.underdogMaxSentences),
  });
  return ok({ reviewWindow: window });
});
