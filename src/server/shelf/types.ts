// Pure types — no `server-only`, because Client Components (the composer, the
// add-a-book box) import these shapes.

/**
 * The shapes the shelf service returns to the routes. Kept separate from the
 * database row types so the API surface is a deliberate choice, not whatever
 * columns happen to exist.
 */

export type ReadStatus = 'WANT_TO_READ' | 'READING' | 'PAUSED' | 'READ' | 'DNF';
export type ReadOutcome = 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED' | 'PAUSED';

export type BookSummary = {
  id: string;
  slug: string;
  title: string;
  author: string;
  year: number | null;
  origin: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  source: string;
};

export type ShelfItem = {
  id: string;
  status: ReadStatus;
  isFavourite: boolean;
  addedAt: string;
  book: BookSummary;
  /** The live read attempt, if one is open (status READING/PAUSED). */
  currentRead: {
    id: string;
    attemptNo: number;
    startedOn: string | null;
    outcome: ReadOutcome;
    ratingQuarterStars: number | null;
    page: number | null;
    totalPages: number | null;
  } | null;
};

export type Quote = {
  id: string;
  body: string;
  page: number | null;
  chapter: string | null;
  note: string | null;
  createdAt: string;
};
