/**
 * The whole site derives from these types. Both modes — the plain-text "Boring
 * Edition" and the CRT "Not Boring" mode — are two renderings of this same data.
 */

export type Book = {
  /** Stable id, derived from genre + title. Used for anchors and deep links. */
  id: string;
  title: string;
  author: string;
  /** Year of first publication. */
  year: number;
  /** Country / language of origin, e.g. "Poland, tr. from Polish". */
  origin: string;
  /** One line, max ~14 words. The reason to pick it up. */
  hook: string;
  /** The short review. 45-70 words. */
  review: string;
  /** Why this book is under-read. */
  underdog: string;
  tags: string[];
};

export type Genre = {
  slug: string;
  name: string;
  books: Book[];
};

/**
 * A programme is one segment of broadcast. Everything is text-first so it can be
 * rendered to canvas, to the DOM, or read aloud by a screen reader.
 *
 * `media` is the escape hatch: drop a real video file in and the compositor will
 * paint that instead of drawing the text card. Nothing else has to change.
 */
export type ProgrammeKind =
  | 'poem'
  | 'scene'
  | 'track'
  | 'critter'
  | 'monologue'
  | 'fact'
  | 'archive'
  | 'ad'
  | 'weather'
  | 'shortfic'
  | 'ambient'
  | 'book';

export type Programme = {
  id: string;
  kind: ProgrammeKind;
  heading: string;
  subheading: string;
  lines: string[];
  footer: string;
  durationSec: number;
  /**
   * Where to actually go and find the thing on screen — only the LIBRARY
   * channel sets it. Baked into the manifest at build time so the television
   * can offer the link without the book data ever reaching the browser.
   */
  link?: { label: string; href: string };
  /** Optional real video. When present the compositor paints frames from it. */
  media?: {
    src: string;
    poster?: string;
    captions?: { lang: string; label: string; src: string }[];
    /**
     * Where this programme starts inside `src`, for the one-reel technique:
     * many programmes share a single long file and a channel change is a seek
     * rather than a load. Browsers never block a seek, so audio and video keep
     * playing and there is no black frame between segments.
     */
    reelOffsetSec?: number;
  };
};

export type Channel = {
  /** The number you type on the keypad. */
  num: number;
  slug: string;
  name: string;
  /** Per-channel tint pushed into the CRT shader. */
  color: string;
  /** One-line description of what this channel broadcasts. */
  blurb: string;
  programmes: Programme[];
};

/**
 * The dial, serialised.
 *
 * This is the seam introduced by the Next port. The television used to `import`
 * the channel data, which welded `books.data.ts` and `programmes.data.ts` into
 * every client bundle — around 300KB of prose that the browser parsed on every
 * visit whether or not anyone switched the set on. Now the schedule is built on
 * the server and fetched as JSON, and the two content files never cross to the
 * client at all.
 *
 * It is also the seam Phase 4 needs: once reviews come from Postgres rather than
 * a `.ts` file, the manifest is the thing that changes and nothing in
 * `src/tv/engine/` notices.
 */
export type ScheduleManifest = {
  /**
   * Content hash of `channels`. The television stores the last manifest it saw
   * and compares revisions, so a cached copy can be reused without refetching.
   */
  revision: string;
  /** When this revision was generated. ISO 8601. */
  generatedAt: string;
  channels: Channel[];
};

/** What is on air right now on a given channel. */
export type NowPlaying = {
  channel: Channel;
  programme: Programme;
  /** Index of the programme in the channel's schedule. */
  index: number;
  /** Seconds into the current programme. */
  offset: number;
  /** 0..1 through the current programme. */
  progress: number;
};
