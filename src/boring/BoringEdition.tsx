import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { library, bookCount } from '../content/library';
import { channels } from '../content/channels';
import { linksFor } from '../lib/links';
import { tvAudio } from '../tv/engine/audio';
import { SoundToggle } from '../components/SoundToggle';
import type { Book } from '../types';
import './boring.css';

type Props = { onEnterTv: () => void; tvOpen: boolean };

/**
 * The Boring Edition.
 *
 * Deliberately plain — but this is not a gag. It is the real content: every book
 * in the library as ordinary, selectable, printable, crawlable, screen-readable
 * text. If the WebGL mode fails on someone's machine, nothing is lost. That is
 * the whole point of building it this way round.
 */
export function BoringEdition({ onEnterTv, tvOpen }: Props) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return library;
    return library
      .map((g) => ({
        ...g,
        books: g.books.filter((b) =>
          [b.title, b.author, b.review, b.hook, b.origin, ...b.tags]
            .join(' ')
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter((g) => g.books.length > 0);
  }, [deferred]);

  const shown = results.reduce((n, g) => n + g.books.length, 0);

  // The drawer hitting its stop, once, when a search first comes up empty —
  // not on every keystroke that stays empty.
  const lastKey = useRef<string | undefined>(undefined);
  const wasEmpty = useRef(false);
  useEffect(() => {
    const empty = deferred.trim().length > 0 && shown === 0;
    if (empty && !wasEmpty.current) tvAudio.searchEmpty();
    wasEmpty.current = empty;
  }, [deferred, shown]);

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

          <fieldset className="mode-switch">
            <legend className="sr-only">Choose how to read this</legend>
            <label>
              <input type="radio" name="mode" checked={!tvOpen} onChange={() => {}} />
              <span>Boring</span>
            </label>
            <label>
              <input type="radio" name="mode" checked={tvOpen} onChange={onEnterTv} />
              <span>Not boring</span>
            </label>
          </fieldset>

          <button className="tv-cta" onClick={onEnterTv}>
            Switch on the television →
          </button>

          <div className="boring-search">
            <label htmlFor="q" className="sr-only">
              Search the library
            </label>
            <input
              id="q"
              type="search"
              placeholder="Search titles, authors, tags…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                tvAudio.unlock();
                tvAudio.keystroke(lastKey.current);
              }}
              onKeyDown={(e) => {
                // Modifiers and navigation keys strike no character, so they
                // make no sound.
                lastKey.current = e.key.length === 1 ? e.key : undefined;
              }}
              autoComplete="off"
            />
            {query && (
              <p className="boring-search-count">
                {shown} of {bookCount}
              </p>
            )}
          </div>

          <nav className="boring-nav" aria-label="Genres">
            {library.map((g) => (
              <a
                key={g.slug}
                href={`#${g.slug}`}
                onClick={() => {
                  tvAudio.unlock();
                  tvAudio.pageJump();
                }}
              >
                [{g.name}]
              </a>
            ))}
          </nav>

          <button
            className="print-btn"
            onClick={() => {
              tvAudio.unlock();
              tvAudio.print();
              window.print();
            }}
          >
            🖨 Print
          </button>

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
                actually tune. {channels.length} channels of poems, film scenes, records, animals,
                weather and very short stories. It is more fun and strictly less useful.
              </li>
            </ul>
          </section>

          {results.length === 0 && (
            <p className="boring-empty">
              Nothing matches “{query}”. Try an author, a country, or a tag like “grief” or
              “desert”.
            </p>
          )}

          {results.map((genre) => (
            <section key={genre.slug} id={genre.slug} className="genre">
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
                    <button className="book-link channel-link" onClick={onEnterTv}>
                      {String(c.num).padStart(2, '0')} — {c.name}
                    </button>
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
