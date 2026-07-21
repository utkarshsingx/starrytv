import type { NextConfig } from 'next';

/**
 * Deliberately almost empty.
 *
 * There is no `rewrites()` proxying the API. The frontend and the API share an
 * eTLD+1 (`starrytv.app` / `api.starrytv.app`) so auth cookies are first-party
 * on their own; a proxy would be a second, contradictory answer to the same
 * question, and it would put PDF byte-range reads through a metered function
 * instead of straight from the browser to storage. See docs/PLAN.md §5.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The television is the product. If a type error can reach production, the
  // exit criteria are decorative. (Linting is oxlint's job and runs in CI —
  // Next 16 dropped the `eslint` config key along with `next lint`.)
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      {
        // The schedule manifest is content-hashed by revision and read on every
        // boot. Cache hard at the edge, revalidate in the background.
        source: '/schedule/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
