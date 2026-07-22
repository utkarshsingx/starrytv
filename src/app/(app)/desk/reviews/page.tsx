import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { myReviews } from '@/server/ugc/service';
import '../desk.css';

export const metadata: Metadata = { title: 'My reviews' };
export const dynamic = 'force-dynamic';

const STATUS_COPY: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'With the editor',
  IN_REVIEW: 'Being read',
  CHANGES_REQUESTED: 'Changes asked for',
  REJECTED: 'Not this time',
  PUBLISHED: 'On the hub',
  UNPUBLISHED: 'Taken down',
  ARCHIVED: 'Archived',
};

export default async function MyReviewsPage() {
  const user = (await getCurrentUser())!;
  const reviews = await myReviews(user.id);

  return (
    <main className="app-main">
      <p className="app-kicker">
        <Link href="/desk" style={{ color: 'inherit', textDecoration: 'none' }}>Desk</Link> / My reviews
      </p>
      <h1 className="app-h1">Your reviews</h1>

      {reviews.length === 0 && (
        <div className="desk-empty" style={{ marginTop: '2rem' }}>
          You haven’t written any yet. Open a book on your shelf and write one — an editor reads
          every submission before it reaches the hub.
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1px', background: '#e6e2d6', border: '1px solid #e6e2d6' }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ background: '#fff', padding: '1rem 1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{r.book.title}</span>
              <span className={`status-mark status-${r.status === 'PUBLISHED' ? 'READING' : r.status === 'REJECTED' ? 'DNF' : 'WANT_TO_READ'}`}>
                {STATUS_COPY[r.status] ?? r.status}
              </span>
            </div>
            {r.revision && <p style={{ fontSize: 13, color: '#55524b', margin: '0.4rem 0 0' }}>{r.revision.hook}</p>}
            {(r.status === 'CHANGES_REQUESTED' || r.status === 'REJECTED') && r.lastAction?.reasonText && (
              <p style={{ fontSize: 12.5, color: '#a11400', margin: '0.5rem 0 0' }}>
                <strong>Editor:</strong> {r.lastAction.reasonText}
              </p>
            )}
            <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.8rem' }}>
              {(r.status === 'DRAFT' || r.status === 'CHANGES_REQUESTED') && (
                <Link href={`/desk/write/${r.book.id}`} style={{ fontSize: 12, color: '#0b3ecc' }}>
                  {r.status === 'CHANGES_REQUESTED' ? 'Revise & resend' : 'Continue writing'} →
                </Link>
              )}
              {r.status === 'PUBLISHED' && (
                <Link href={`/review/${r.slug}`} style={{ fontSize: 12, color: '#0b3ecc' }}>See it on the hub →</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
