'use client';

import { useCallback, useEffect, useRef, useState, useDeferredValue } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { tvAudio } from '../tv/engine/audio';

type Props = {
  bookCount: number;
  /** Just slug and name — the nav needs no more of the library than that. */
  genres: { slug: string; name: string }[];
};

/**
 * The interactive half of the sidebar.
 *
 * Everything in the Boring Edition that reacts to a click or a keystroke lives
 * here, and nothing else does. The hundred books are rendered on the server and
 * stay there; this island is a search box, a mode switch, a nav and a print
 * button, and it ships no book data at all.
 *
 * The search works by hiding server-rendered DOM rather than re-rendering a
 * filtered list in React. That is the unusual choice, and it is deliberate:
 * re-rendering would require every book's title, author, review, hook, origin
 * and tags in the client bundle — the exact payload the port exists to remove —
 * to reproduce markup the server has already sent. Reading `textContent` off the
 * articles instead means the search index *is* the page, it costs nothing to
 * ship, and it can never drift out of sync with what is displayed.
 */
export function HubControls({ bookCount, genres }: Props) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [shown, setShown] = useState(bookCount);

  const router = useRouter();
  const pathname = usePathname();
  const tvOpen = pathname === '/tv';

  const lastKey = useRef<string | undefined>(undefined);
  /** Lazily built on first search: [article, its lowercased text]. */
  const haystack = useRef<{ el: HTMLElement; text: string; genre: HTMLElement | null }[] | null>(
    null,
  );

  const enterTv = useCallback(() => {
    // The click that got us here is the gesture that lets us make sound. Waste
    // it and the first channel change is silent.
    tvAudio.unlock();
    tvAudio.modeSwitch();
    router.push('/tv');
  }, [router]);

  useEffect(() => {
    if (!haystack.current) {
      haystack.current = Array.from(document.querySelectorAll<HTMLElement>('article.book')).map(
        (el) => ({
          el,
          text: (el.textContent ?? '').toLowerCase(),
          genre: el.closest<HTMLElement>('section.genre'),
        }),
      );
    }

    const q = deferred.trim().toLowerCase();
    const perGenre = new Map<HTMLElement, number>();
    let visible = 0;

    for (const entry of haystack.current) {
      const hit = q === '' || entry.text.includes(q);
      entry.el.hidden = !hit;
      if (hit) {
        visible++;
        if (entry.genre) perGenre.set(entry.genre, (perGenre.get(entry.genre) ?? 0) + 1);
      }
    }

    // A genre heading with nothing under it reads as a section that failed to
    // load, so empty ones go too — and their counts follow the filter.
    for (const section of document.querySelectorAll<HTMLElement>('section.genre')) {
      const n = perGenre.get(section) ?? 0;
      // The channels section holds no books; it is not part of the search.
      if (section.dataset.searchable !== 'true') continue;
      section.hidden = n === 0;
      const count = section.querySelector<HTMLElement>('.genre-count');
      if (count) count.textContent = String(n);
    }

    // The "nothing matches" line belongs in the main column next to the list,
    // not in the sidebar with the controls, so it is server-rendered in place
    // and toggled here rather than returned from this component.
    const empty = document.getElementById('boring-empty');
    if (empty) {
      empty.hidden = !(q !== '' && visible === 0);
      const echo = empty.querySelector('[data-query]');
      if (echo) echo.textContent = deferred.trim();
    }

    setShown(visible);
  }, [deferred]);

  // The drawer hitting its stop, once, when a search first comes up empty —
  // not on every keystroke that stays empty.
  const wasEmpty = useRef(false);
  useEffect(() => {
    const empty = deferred.trim().length > 0 && shown === 0;
    if (empty && !wasEmpty.current) tvAudio.searchEmpty();
    wasEmpty.current = empty;
  }, [deferred, shown]);

  return (
    <>
      <fieldset className="mode-switch">
        <legend className="sr-only">Choose how to read this</legend>
        <label>
          <input type="radio" name="mode" checked={!tvOpen} onChange={() => {}} />
          <span>Boring</span>
        </label>
        <label>
          <input type="radio" name="mode" checked={tvOpen} onChange={enterTv} />
          <span>Not boring</span>
        </label>
      </fieldset>

      <button className="tv-cta" onClick={enterTv}>
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
        {genres.map((g) => (
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
    </>
  );
}
