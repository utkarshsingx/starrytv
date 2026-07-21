import { library, bookCount } from '../content/library';
import { channels } from '../content/channels';
import { linksFor } from '../lib/links';
import { SoundToggle } from '../components/SoundToggle';
import { HubControls } from './HubControls';
import { TvLink } from './TvLink';
import { AccountChip } from './AccountChip';
import type { Book } from '../types';

/**
 * The Boring Edition.
 *
 * Deliberately plain — but this is not a gag. It is the real content: every book
 * in the library as ordinary, selectable, printable, crawlable, screen-readable
 * text. If the WebGL mode fails on someone's machine, nothing is lost. That is
 * the whole point of building it this way round.
 *
 * **A Server Component**, and that is the other half of the port. It imports the
 * library directly and renders all hundred books to HTML on the server, so the
 * content is in the document for a crawler with no JavaScript at all — while
 * `books.data.ts` never reaches a client bundle. The interactive parts (search,
 * the mode switch, the print button, the channel rows) are small islands that
 * carry no book data with them.
 */
export function BoringEdition() {
  return (
    <div className="boring">
      <a className="skip-link" href="#library">
        Skip to the library
      </a>

      <header className="boring-topbar">
        <span className="boring-topbar-brand">Starry</span>
        <span className="boring-topbar-sep">/</span>
        <span>The Underdog Edition</span>
        <span className="boring-topbar-right">
          {bookCount} books · {channels.length} channels
        </span>
        <SoundToggle />
        <AccountChip />
      </header>

      <div className="boring-layout">
        {/* ---------------- sidebar ---------------- */}
        <aside className="boring-side">
          <h1 className="boring-title">
            The
            <br />
            Underdog
            <br />
            Edition
          </h1>

          <p className="boring-standfirst">
            {bookCount} books almost nobody recommends. Twenty genres, five each, one short review
            apiece. No bestsellers, no prize-winners everyone already owns.
          </p>

          <HubControls
            bookCount={bookCount}
            genres={library.map((g) => ({ slug: g.slug, name: g.name }))}
          />

          <p className="boring-note">
            Links go to Bookshop.org, WorldCat, Open Library and Goodreads. Try the library one
            first — most of these are easier to borrow than to buy.
          </p>
        </aside>

        {/* ---------------- main ---------------- */}
        <main className="boring-main" id="library">
          <section className="boring-intro">
            <h2>How this works</h2>
            <ul>
              <li>
                Twenty genres. Five books in each. Every one picked for being <em>good</em> and{' '}
                <em>under-read</em> — out of print, badly timed, overshadowed, or never translated
                until recently.
              </li>
              <li>
                Nothing here has been a number-one bestseller or had a famous film made of it. If
                you have heard of all five in a genre, tell me and I will replace them.
              </li>
              <li>
                The <strong>Not boring</strong> version is the same site as a television you can
                actually tune. {channels.length} channels of poems, records, animals, weather, very
                short stories — and one showing actual film. It is more fun and strictly less
                useful.
              </li>
            </ul>
          </section>

          {/*
            Rendered in place and hidden, rather than returned from the search
            island in the sidebar — the message belongs beside the list it is
            describing, and this way it needs no JavaScript to be in the right
            column.
          */}
          <p className="boring-empty" id="boring-empty" role="status" hidden>
            Nothing matches “<span data-query />”. Try an author, a country, or a tag like “grief”
            or “desert”.
          </p>

          {library.map((genre) => (
            <section key={genre.slug} id={genre.slug} className="genre" data-searchable="true">
              <h2 className="genre-head">
                {genre.name}
                <span className="genre-count">{genre.books.length}</span>
              </h2>
              <div className="genre-grid">
                {genre.books.map((book) => (
                  <BookEntry key={book.id} book={book} />
                ))}
              </div>
            </section>
          ))}

          <section className="genre" id="channels">
            <h2 className="genre-head">
              The Channels
              <span className="genre-count">{channels.length}</span>
            </h2>
            <div className="genre-grid">
              {channels.map((c) => (
                <article key={c.num} className="book">
                  <h3>
                    <TvLink>
                      {String(c.num).padStart(2, '0')} — {c.name}
                    </TvLink>
                  </h3>
                  <p className="book-meta">{c.programmes.length} segments on rotation</p>
                  <p className="book-review">{c.blurb}</p>
                  <ul className="channel-programmes">
                    {c.programmes.slice(0, 4).map((p) => (
                      <li key={p.id}>{p.heading}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      <footer className="boring-footer">
        <p>
          Starry — The Underdog Edition. Built as an homage to the format, not a copy of anyone's
          site. All reviews written for this library; all channel writing original except the
          public-domain poems, which are credited on screen.
        </p>
      </footer>
    </div>
  );
}

function BookEntry({ book }: { book: Book }) {
  const links = linksFor(book);
  return (
    <article className="book" id={book.id}>
      <h3>
        <a className="book-link" href={links[0].href} target="_blank" rel="noopener noreferrer">
          {book.title}
        </a>
      </h3>
      <p className="book-meta">
        {book.author} · {book.year} · {book.origin}
      </p>
      <p className="book-hook">{book.hook}</p>
      <p className="book-review">{book.review}</p>
      <p className="book-underdog">
        <span className="book-underdog-tag">Why you missed it:</span> {book.underdog}
      </p>
      <ul className="book-tags">
        {book.tags.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <ul className="book-links">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" title={l.note}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
