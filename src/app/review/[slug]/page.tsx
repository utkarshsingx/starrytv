import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { bySlug } from '@/server/ugc/service';

// The root layout already loads index.css + boring.css globally, so this page
// styles itself with the Boring Edition's classes without re-importing them.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const review = await bySlug((await params).slug);
  if (!review || review.status !== 'PUBLISHED' || !review.revision) return { title: 'Review' };
  return {
    title: `${review.book.title} — a review`,
    description: review.revision.hook,
    openGraph: { title: review.book.title, description: review.revision.hook, type: 'article' },
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const review = await bySlug(slug);
  // Only published reviews are public. A draft or rejected review 404s to
  // everyone, including a logged-out author following an old link.
  if (!review || review.status !== 'PUBLISHED' || !review.revision) notFound();

  const rev = review.revision;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: { '@type': 'Book', name: review.book.title, author: review.book.author },
    reviewBody: rev.body,
    author: { '@type': 'Person', name: review.author.displayName },
    ...(review.publishedAt ? { datePublished: review.publishedAt } : {}),
  };

  return (
    <div className="boring" style={{ minHeight: '100dvh' }}>
      <header className="boring-topbar">
        <Link href="/" className="boring-topbar-brand" style={{ textDecoration: 'none' }}>Starry</Link>
        <span className="boring-topbar-sep">/</span>
        <span>A review</span>
      </header>

      <main className="boring-main" style={{ maxWidth: '46rem', margin: '0 auto', padding: '2.5rem 1.25rem' }}>
        <article className="book" id={review.slug} style={{ border: 0, padding: 0 }}>
          <p className="book-meta" style={{ marginBottom: '0.5rem' }}>
            {review.book.author}{review.book.year ? ` · ${review.book.year}` : ''}{review.book.origin ? ` · ${review.book.origin}` : ''}
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.8rem,5vw,2.6rem)', lineHeight: 1.1, margin: '0 0 1rem' }}>
            {review.book.title}
          </h1>
          <p className="book-hook" style={{ fontSize: '1.15rem' }}>{rev.hook}</p>
          <p className="book-review" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{rev.body}</p>
          <p className="book-underdog">
            <span className="book-underdog-tag">Why you missed it:</span> {rev.underdog}
          </p>
          {rev.longBody && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--rule)', paddingTop: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {rev.longBody}
            </div>
          )}
          {rev.tags.length > 0 && (
            <ul className="book-tags" style={{ marginTop: '1.5rem' }}>
              {rev.tags.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
          <p style={{ marginTop: '2rem', fontSize: 13, color: 'var(--ink-soft)' }}>
            — {review.author.displayName}
            {rev.editedByAdmin && <span style={{ color: 'var(--ink-faint)' }}> · edited by the house</span>}
          </p>
        </article>

        <p style={{ marginTop: '2.5rem' }}>
          <Link href="/" style={{ fontSize: 13, color: '#0b3ecc' }}>← back to the library</Link>
        </p>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
