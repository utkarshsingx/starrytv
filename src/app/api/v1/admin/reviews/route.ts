import { route, ok } from '@/server/http';
import { requireAdmin } from '@/server/auth/guard';
import { listQueue } from '@/server/ugc/service';

export const runtime = 'nodejs';

/** The review queue: everything SUBMITTED or IN_REVIEW, oldest first. */
export const GET = route(async () => {
  await requireAdmin();
  return ok({ queue: await listQueue() });
});
