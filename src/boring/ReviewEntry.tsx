import type { HubReview } from '../server/ugc/service';

/**
 * A published reader review on the hub, rendered in the same `.book` article
 * shape as a house entry so the two sit side by side without a visible seam —
 * the only tell is the byline. The book title links to the full review page,
 * where the long version (if any) lives.
 */
export function ReviewEntry({ review }: { review: HubReview }) {
  return (
    <article className="book" id={review.slug}>
      <h3>
        <a className="book-link" href={`/review/${review.slug}`}>
          {review.book.title}
        </a>
      </h3>
      <p className="book-meta">
        {review.book.author}
        {review.book.year ? ` · ${review.book.year}` : ''}
        {review.book.origin ? ` · ${review.book.origin}` : ''}
      </p>
      <p className="book-hook">{review.hook}</p>
      <p className="book-review">{review.body}</p>
      <p className="book-underdog">
        <span className="book-underdog-tag">Why you missed it:</span> {review.underdog}
      </p>
      {review.tags.length > 0 && (
        <ul className="book-tags">
          {review.tags.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
      <p className="book-byline">— {review.author.displayName}</p>
    </article>
  );
}
