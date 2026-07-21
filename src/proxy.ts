import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route gating — a UX guard, not the security boundary.
 *
 * This reads the readable `st_role` hint cookie only; it never decodes the JWT
 * (that needs the secret and belongs server-side). All it does is keep a signed-
 * out visitor from seeing the shell of a protected page before the server would
 * reject them anyway, and bounce a non-admin away from the admin area. The real
 * authorization is the server checking the verified access token on every route
 * and query — a forged `st_role=admin` cookie gets a browser to the admin URL
 * and then a wall of empty 403s, because nothing trusts this cookie.
 *
 * Renamed from `middleware.ts` — Next 16 calls this `proxy.ts` and runs it on
 * the Node runtime. A leftover `middleware.ts` is silently ignored with no build
 * error, so if gating ever seems not to run, check the filename first.
 */

const PROTECTED = ['/desk', '/library', '/admin'];
const ADMIN_ONLY = ['/admin'];
const AUTH_PAGES = ['/login', '/signup', '/verify'];

const isUnder = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'));

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get('st_role')?.value;
  const signedIn = role === 'user' || role === 'admin';

  if (isUnder(pathname, PROTECTED) && !signedIn) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isUnder(pathname, ADMIN_ONLY) && role !== 'admin') {
    return NextResponse.redirect(new URL('/desk', req.url));
  }

  // Already signed in? The login/signup pages have nothing to offer you.
  if (isUnder(pathname, AUTH_PAGES) && signedIn) {
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/desk', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/desk/:path*', '/library/:path*', '/admin/:path*', '/login', '/signup', '/verify'],
};
