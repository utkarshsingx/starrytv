import type { Channel, Programme } from '../types';
import { CHANNEL_DATA } from './programmes.data';
import { library } from './library';

/**
 * The dial.
 *
 * `programmes.data.ts` holds the writing; this file holds the wiring — channel
 * colours, ids, and the one channel that is generated rather than written.
 */

/** Per-channel tint. Fed into the CRT shader and used throughout the UI. */
const COLOURS: Record<string, string> = {
  poetry: '#b79cff',
  cinema: '#ffc85c',
  music: '#ff7ec4',
  critters: '#5ce8c0',
  latenight: '#ffb000',
  science: '#66c6ff',
  archive: '#d8a860',
  adverts: '#ff5a45',
  library: '#e8c27a',
  weather: '#7fd4ff',
  shorts: '#c0b4e8',
  signoff: '#8fb8cc',
};

const BLURBS: Record<string, string> = {
  poetry: 'Poems, out of copyright and read at their own pace.',
  cinema: 'Great scenes, described. No clips, no rights holders, no ads.',
  music: 'Liner notes for records you may not have found yet.',
  critters: 'True animal facts, delivered with unearned confidence.',
  latenight: 'Deadpan bits about ordinary life. Broadcast to nobody in particular.',
  science: 'Wonder, stated accurately.',
  archive: 'Strange true history, well documented and hard to believe.',
  adverts: 'Commercials for products that have never existed.',
  library: 'One book from the library, every few minutes, forever.',
  weather: 'Forecasts for territories that are not on the map.',
  shorts: 'Complete stories, sixty to a hundred words.',
  signoff: 'Late-night quiet. Test card and company.',
};

function slugId(channelSlug: string, i: number, heading: string) {
  return `${channelSlug}-${String(i).padStart(2, '0')}-${heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)}`;
}

/**
 * Channel 10 is not written by hand — it is the book library, broadcast.
 *
 * This is the join between the two halves of the site: the same reviews that
 * are set as plain text in the Boring Edition come round again as programming.
 * Add a book and it is on television within the hour.
 */
function libraryChannel(): Channel {
  const programmes: Programme[] = library.flatMap((genre) =>
    genre.books.map((book, i) => ({
      id: `library-${book.id}`,
      kind: 'book' as const,
      heading: book.title,
      subheading: `${book.author} · ${book.year} · ${genre.name}`,
      lines: [book.hook, '', ...splitForScreen(book.review)],
      footer: book.underdog,
      durationSec: 26 + (i % 3) * 3,
    })),
  );

  return {
    num: 10,
    slug: 'library',
    name: 'LIBRARY',
    color: COLOURS.library,
    blurb: BLURBS.library,
    // Interleave genres so consecutive programmes are not five literary novels
    // in a row. Deterministic, so the schedule is the same for everyone.
    programmes: interleave(programmes, 5),
  };
}

/** A review is one paragraph; a CRT wants it in sentence-sized pieces. */
function splitForScreen(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > 150) {
      if (buf) out.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Deal the array into `stride` piles and read them back round-robin. */
function interleave<T>(items: T[], stride: number): T[] {
  const out: T[] = [];
  for (let offset = 0; offset < stride; offset++) {
    for (let i = offset; i < items.length; i += stride) out.push(items[i]);
  }
  return out;
}

const written: Channel[] = CHANNEL_DATA.map((c) => ({
  num: c.num,
  slug: c.slug,
  name: c.name,
  color: COLOURS[c.slug] ?? '#9fd4c4',
  blurb: BLURBS[c.slug] ?? '',
  programmes: c.programmes.map((p, i) => ({
    id: slugId(c.slug, i, p.heading),
    kind: c.kind,
    heading: p.heading,
    subheading: p.subheading,
    lines: p.lines,
    footer: p.footer,
    // Clamp: a segment that outstays its welcome is worse than one that is
    // slightly too short.
    durationSec: Math.min(45, Math.max(12, p.durationSec)),
  })),
}));

export const channels: Channel[] = [...written, libraryChannel()]
  .filter((c) => c.programmes.length > 0)
  .sort((a, b) => a.num - b.num);

export const channelBySlug = (slug: string) => channels.find((c) => c.slug === slug);
export const channelByNum = (num: number) => channels.find((c) => c.num === num);
