'use client';

/**
 * The browser's side of talking to the auth routes.
 *
 * Same-origin, so `credentials: 'include'` is really just "send the cookies" —
 * there is no cross-site dance here. The one piece of real logic is the
 * refresh-once retry: an authenticated call that comes back 401 because the
 * 15-minute access token lapsed will try a single silent refresh and replay,
 * and only give up (as signed-out) if that refresh also fails. A `network`
 * failure is deliberately NOT treated as signed-out — a flaky connection must
 * not log you out.
 */

export type ApiResult<T> = { data: T } | { error: { code: string; message: string } };

async function raw(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

let refreshing: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  // Collapse a burst of concurrent 401s into a single refresh.
  if (!refreshing) {
    refreshing = raw('/api/v1/auth/refresh', { method: 'POST' as const })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<ApiResult<T>> {
  const attempt = () => raw(path, init);
  let res: Response;
  try {
    res = await attempt();
  } catch {
    return { error: { code: 'NETWORK', message: 'Could not reach the server.' } };
  }

  // On an authenticated call, one silent refresh-and-replay before surrendering.
  if (res.status === 401 && init?.auth) {
    if (await refreshOnce()) {
      try {
        res = await attempt();
      } catch {
        return { error: { code: 'NETWORK', message: 'Could not reach the server.' } };
      }
    }
  }

  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { error: { code: 'BAD_RESPONSE', message: 'Unexpected server response.' } };
  }
}

export const isOk = <T>(r: ApiResult<T>): r is { data: T } => 'data' in r;
