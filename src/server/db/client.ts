/**
 * The one database connection.
 *
 * postgres.js, pointed at Supabase's transaction pooler. Two settings are
 * load-bearing and both are here because of the pooler, not by taste:
 *
 *  - `prepare: false` — Supavisor's transaction mode multiplexes many clients
 *    over few server connections and cannot carry prepared-statement state
 *    across the boundary. Leave prepares on and queries fail intermittently
 *    under load in a way that never reproduces locally.
 *  - `max: 1` — every serverless invocation is its own isolated process with its
 *    own pool, so a large per-invocation pool just multiplies connections
 *    against the account limit. One is plenty for our traffic and keeps the
 *    footprint honest.
 *
 * The client is built LAZILY, on first query, behind a Proxy — not at module
 * import. `next build` imports every route module to read its config, and if
 * constructing this touched `env().DATABASE_URL` at import time the whole build
 * would fail whenever the connection string is absent (a fresh clone, CI before
 * secrets, a teammate who has not filled `.env.local`). A database connection is
 * a request-time concern, so it is deferred to the first actual query.
 *
 * In dev, Next's hot reload re-evaluates modules on every edit; stashing the
 * client on globalThis stops that leaking a connection per save until the pool
 * limit wedges the app.
 */
import 'server-only';
import postgres, { type Sql } from 'postgres';
import { env } from '../env';

const make = (): Sql =>
  postgres(env().DATABASE_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
  });

const g = globalThis as unknown as { __sql?: Sql };

function getSql(): Sql {
  if (!g.__sql) g.__sql = make();
  return g.__sql;
}

/**
 * A stand-in for the real client that forwards both tagged-template calls
 * (`sql\`...\``, trapped by `apply`) and property access (`sql.begin`,
 * `sql.unsafe`, `sql.end`, trapped by `get`) to a client built on first use.
 * Callers use `sql` exactly as if it were the postgres.js client.
 */
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const real = getSql() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
