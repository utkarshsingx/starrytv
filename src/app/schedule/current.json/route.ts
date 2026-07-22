import { buildLiveManifest } from '@/server/broadcast/manifest';

/**
 * The schedule, emitted for the television.
 *
 * No longer `force-static`: since the manifest now folds in published reader
 * reviews (`buildLiveManifest`), it has to read the database. It is cached for
 * an hour instead — `revalidate = 3600` — which keeps broadcast determinism at
 * the hour boundary (everyone loading within the same hour gets the same
 * schedule) while letting a newly-approved review reach the air within the hour.
 *
 * Nothing under `src/tv/` changed: the set still fetches this one URL.
 */
export const revalidate = 3600;

export async function GET() {
  const manifest = await buildLiveManifest();
  return Response.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=3600' },
  });
}
