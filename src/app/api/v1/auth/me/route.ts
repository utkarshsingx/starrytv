import { route, ok } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';

export const runtime = 'nodejs';

export const GET = route(async () => {
  // Null rather than 401 for "not signed in" — asking who you are is not an
  // error, and the client treats null as anonymous without tripping its
  // refresh-and-retry path.
  const user = await getCurrentUser();
  return ok({ user });
});
