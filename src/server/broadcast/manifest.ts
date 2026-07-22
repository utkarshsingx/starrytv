import 'server-only';
import type { Channel, Programme, ScheduleManifest } from '../../types';
import { channels } from '../../content/channels';
import { splitForScreen } from '../../content/channels';
import { publishedForHub } from '../ugc/service';

/**
 * The schedule, built on the server — the manifest swap that puts reader reviews
 * on television.
 *
 * Channel 10 (LIBRARY) used to be built entirely from `books.data.ts`. Now the
 * published reader reviews are folded into it too, shaped by the same
 * `splitForScreen` the house books use, so an approved review is not only on the
 * hub but on the air — with no change to anything under `src/tv/`. The set still
 * fetches one JSON file; that file now has more in it.
 *
 * Determinism is preserved at the hour: the schedule route caches this for an
 * hour (`revalidate = 3600`), so the manifest a viewer holds changes at most
 * once an hour rather than the instant a review is approved. Two viewers who
 * load within the same hour work from the same schedule and see the same frame
 * at the same wall-clock second — the property the whole broadcast rests on.
 */

const FNV = (json: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

/** Deal into `stride` piles and read back round-robin — the same interleave the
 *  house library channel uses, so consecutive programmes are not all one genre. */
function interleave<T>(items: T[], stride: number): T[] {
  const out: T[] = [];
  for (let offset = 0; offset < stride; offset++) {
    for (let i = offset; i < items.length; i += stride) out.push(items[i]);
  }
  return out;
}

export async function buildLiveManifest(): Promise<ScheduleManifest> {
  const reviews = await publishedForHub().catch(() => []);

  // Turn each published review into a LIBRARY programme, exactly as a house book
  // becomes one.
  const reviewProgrammes: Programme[] = reviews.map((r, i) => ({
    id: `review-${r.slug}`,
    kind: 'book' as const,
    heading: r.book.title,
    subheading: `${r.book.author}${r.book.year ? ` · ${r.book.year}` : ''} · reviewed by ${r.author.displayName}`,
    lines: [r.hook, '', ...splitForScreen(r.body)],
    footer: r.underdog,
    durationSec: 26 + (i % 3) * 3,
  }));

  const merged: Channel[] = channels.map((ch) => {
    if (ch.num !== 10 || reviewProgrammes.length === 0) return ch;
    // Interleave reader reviews among the house books so the two mix on air.
    return { ...ch, programmes: interleave([...ch.programmes, ...reviewProgrammes], 5) };
  });

  const json = JSON.stringify(merged);
  return { revision: FNV(json), generatedAt: new Date().toISOString(), channels: merged };
}
