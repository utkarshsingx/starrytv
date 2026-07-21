import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * A short, human label for the device a session was opened on, parsed from the
 * User-Agent. Stored on the refresh row so a future "your sessions" screen can
 * say "Chrome on macOS" rather than showing a raw UA string — and so the column
 * has real data behind it from day one, rather than being backfilled later (the
 * sibling declared the column and only ever wrote null).
 */
export function deviceLabel(req: NextRequest): string | null {
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua) return null;

  const browser =
    /edg/i.test(ua) ? 'Edge'
    : /chrome|crios/i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /safari/i.test(ua) ? 'Safari'
    : 'Browser';

  const os =
    /iphone|ipad|ipod/i.test(ua) ? 'iOS'
    : /android/i.test(ua) ? 'Android'
    : /mac os x/i.test(ua) ? 'macOS'
    : /windows/i.test(ua) ? 'Windows'
    : /linux/i.test(ua) ? 'Linux'
    : 'device';

  return `${browser} on ${os}`.slice(0, 60);
}

/** Parse and lightly shape a JSON body; missing/invalid JSON yields {}. */
export async function jsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
