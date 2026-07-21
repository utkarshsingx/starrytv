import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { verifyEmail } from '@/server/auth/service';
import { setSessionCookies } from '@/server/auth/cookies';
import { jsonBody, str, deviceLabel } from '@/server/auth/request';

export const runtime = 'nodejs';

export const POST = route(async (req: NextRequest) => {
  const b = await jsonBody(req);
  const { user, tokens } = await verifyEmail({
    email: str(b.email),
    code: str(b.code),
    deviceLabel: deviceLabel(req),
  });
  // Verifying establishes the session — the user lands signed in so the welcome
  // flow is not interrupted by a second trip through the login form.
  await setSessionCookies(tokens);
  return ok({ user });
});
