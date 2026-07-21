import { buildManifest } from '@/content/manifest';

/**
 * The schedule, emitted as a static file at build time.
 *
 * `force-static` makes Next prerender this during `next build` and serve the
 * result as a plain asset — so this is a build step wearing a route handler's
 * clothes, with the advantage that the TypeScript imports simply work instead
 * of needing a separate compile pass for a standalone generator script.
 *
 * When Phase 4 puts reviews in Postgres, this becomes the one place that has to
 * change: swap `buildManifest()` for a query and add `revalidate`. Nothing in
 * `src/tv/` will notice.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildManifest());
}
