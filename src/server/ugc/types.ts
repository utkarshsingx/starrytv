// No `server-only` here: this module is pure types plus the REASON_CODES const,
// and the admin queue (a Client Component) imports both. Marking it server-only
// would make importing REASON_CODES throw in the browser.

export type ReviewStatus =
  | 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'CHANGES_REQUESTED'
  | 'REJECTED' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';

export type RevisionInput = {
  hook: string;
  body: string;
  longBody: string | null;
  underdog: string;
  tags: string[];
};

export type ReviewView = {
  id: string;
  slug: string;
  status: ReviewStatus;
  genreId: string | null;
  book: { id: string; title: string; author: string; year: number | null; origin: string | null; coverUrl: string | null };
  revision: {
    hook: string;
    body: string;
    longBody: string | null;
    underdog: string;
    tags: string[];
    editedByAdmin: boolean;
  } | null;
  author: { id: string; displayName: string; handle: string };
  publishedAt: string | null;
  updatedAt: string;
  /** The most recent action's reason, surfaced verbatim to the author. */
  lastAction: { toStatus: ReviewStatus; reasonCode: string | null; reasonText: string | null } | null;
};

/** DSA-style reason vocabulary, in the house register because the author reads it. */
export const REASON_CODES = [
  'TOO_FAMOUS', 'NOT_IN_VOICE', 'UNVERIFIABLE_BOOK', 'READS_LIKE_MARKETING',
  'LENGTH_OUT_OF_RANGE', 'HOOK_TOO_LONG', 'UNDERDOG_NOT_A_MECHANISM',
  'DUPLICATE', 'RIGHTS_CONCERN', 'POLICY_VIOLATION', 'OTHER',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
