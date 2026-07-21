import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { login } from '@/server/auth/service';
import { setSessionCookies } from '@/server/auth/cookies';
import { jsonBody, str, deviceLabel } from '@/server/auth/request';

export const runtime = 'nodejs';

export const POST = route(async (req: NextRequest) => {
  const b = await jsonBody(req);
  const { user, tokens } = await login({
    email: str(b.email),
    password: str(b.password),
    deviceLabel: deviceLabel(req),
  });
  await setSessionCookies(tokens);
  return ok({ user });
});
