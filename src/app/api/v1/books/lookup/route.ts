import type { NextRequest } from 'next/server';
import { route, ok } from '@/server/http';
import { requireUserId } from '@/server/auth/guard';
import { lookupBooks } from '@/server/shelf/lookup';

export const runtime = 'nodejs';

export const GET = route(async (req: NextRequest) => {
  const userId = await requireUserId();
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const results = await lookupBooks(q, userId);
  return ok({ results });
});
