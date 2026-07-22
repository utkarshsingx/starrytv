import { route, ok } from '@/server/http';
import { getReviewWindow } from '@/server/settings';

export const runtime = 'nodejs';

/** Public: the composer reads the current word window so its live counter and
 *  the server enforcement can never disagree. */
export const GET = route(async () => {
  return ok({ reviewWindow: await getReviewWindow() });
});
