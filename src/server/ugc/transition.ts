import 'server-only';
import { sql } from '../db/client';
import * as repo from './repo';
import type { ReviewStatus } from './types';
import { badRequest, forbidden } from '../auth/errors';

/**
 * The single choke point. This is the ONLY code that writes reviews.status.
 *
 * In one transaction it: checks the edge against the const map below, writes the
 * append-only review_actions row, and updates the status. The database trigger
 * enforces the same edge set as a backstop, so even a stray raw UPDATE cannot
 * move a review along an illegal edge — but every legitimate change comes
 * through here, where the audit row and the status update commit together or
 * not at all.
 *
 * The TypeScript map and the SQL `ugc.is_legal_transition` must stay identical.
 * If you add an edge, add it in both.
 */
const LEGAL: Record<ReviewStatus, ReviewStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED'],
  IN_REVIEW: ['CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED'],
  CHANGES_REQUESTED: ['SUBMITTED', 'DRAFT'],
  REJECTED: ['IN_REVIEW'],
  PUBLISHED: ['UNPUBLISHED', 'ARCHIVED'],
  UNPUBLISHED: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: [],
};

export type TransitionOpts = {
  reviewId: string;
  to: ReviewStatus;
  actor: { userId: string | null; role: 'user' | 'admin' | 'system' };
  reasonCode?: string | null;
  reasonText?: string | null;
  automated?: boolean;
  /** When publishing, the revision to make live. */
  liveRevisionId?: string | null;
};

export async function transition(opts: TransitionOpts): Promise<ReviewStatus> {
  return sql.begin(async (tx) => {
    const [current] = await tx`select status from ugc.reviews where id = ${opts.reviewId} and deleted_at is null for update`;
    if (!current) throw badRequest('NO_REVIEW', 'That review does not exist.');
    const from = current.status as ReviewStatus;

    if (from !== opts.to && !LEGAL[from].includes(opts.to)) {
      throw badRequest('ILLEGAL_TRANSITION', `Cannot move a review from ${from} to ${opts.to}.`);
    }

    const publishing = opts.to === 'PUBLISHED' && from !== 'PUBLISHED';

    await repo.insertAction(tx, {
      reviewId: opts.reviewId,
      revisionId: opts.liveRevisionId ?? null,
      fromStatus: from,
      toStatus: opts.to,
      actorUserId: opts.actor.userId,
      actorRole: opts.actor.role,
      reasonCode: opts.reasonCode ?? null,
      reasonText: opts.reasonText ?? null,
      automated: opts.automated ?? false,
    });

    await repo.updateStatusWithinTx(tx, opts.reviewId, opts.to, {
      liveRevisionId: publishing ? opts.liveRevisionId : undefined,
      publish: publishing,
    });

    return opts.to;
  });
}

/** Only an admin may drive the review-side transitions. */
export function assertAdmin(role: string): asserts role is 'admin' {
  if (role !== 'admin') throw forbidden('NOT_ADMIN', 'Only an editor can do that.');
}
