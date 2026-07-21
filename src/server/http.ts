import 'server-only';
import { NextResponse } from 'next/server';
import { AuthError } from './auth/errors';

/**
 * The response envelope, matching the shape the eventual NestJS backend uses so
 * the frontend's API client never has to learn two formats: `{ data }` on
 * success, `{ error: { code, message } }` on failure.
 */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  // Anything else is a bug or an outage. Log the real thing server-side; tell
  // the client nothing it could exploit.
  console.error('[auth] unhandled error:', err);
  return NextResponse.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
    { status: 500 },
  );
}

/** Wraps a route handler so thrown AuthErrors become clean responses. */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return fail(err);
    }
  };
}
