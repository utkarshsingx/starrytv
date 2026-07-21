import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { resendOtp } from '@/server/auth/service';
import { jsonBody, str } from '@/server/auth/request';

export const runtime = 'nodejs';

export const POST = route(async (req: NextRequest) => {
  const b = await jsonBody(req);
  await resendOtp(str(b.email));
  // Always the same response, whether or not the address exists or is already
  // verified — nothing here reveals which.
  return ok({ ok: true });
});
