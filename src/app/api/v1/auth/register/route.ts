import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { register } from '@/server/auth/service';
import { jsonBody, str } from '@/server/auth/request';

export const runtime = 'nodejs';

export const POST = route(async (req: NextRequest) => {
  const b = await jsonBody(req);
  const { user } = await register({
    email: str(b.email),
    password: str(b.password),
    displayName: str(b.displayName),
  });
  // No session yet — the account is created but unverified. The client sends the
  // user to the verify step. Response is identical whether the email was new or
  // an existing-but-unverified re-registration.
  return ok({ user, next: 'verify' }, { status: 201 });
});
