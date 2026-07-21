import { route, ok } from '@/server/http';
import { logout } from '@/server/auth/service';
import { readRefreshCookie, clearSessionCookies } from '@/server/auth/cookies';

export const runtime = 'nodejs';

export const POST = route(async () => {
  // Revoke the family server-side, then clear the cookies. Same-origin plus
  // SameSite=Lax means a cross-site page cannot forge this POST, so no separate
  // CSRF token is needed for it.
  await logout(await readRefreshCookie());
  await clearSessionCookies();
  return ok({ ok: true });
});
