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
  /** Optional real video. When present the compositor paints frames from it. */
  media?: {
    src: string;
    poster?: string;
    captions?: { lang: string; label: string; src: string }[];
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
