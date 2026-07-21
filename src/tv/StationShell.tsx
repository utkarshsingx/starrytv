'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BootSequence } from './BootSequence';
import { TvMode } from './TvSet';
import { useTv, channelByNum } from './store';
import { tvAudio } from './engine/audio';

type Props = {
  /**
   * The Boring Edition, already rendered on the server.
   *
   * It arrives as a prop rather than an import because it is a Server Component
   * and this file is not. Passing it through means the hundred books are
   * rendered to HTML on the server and only the HTML crosses — the book data
   * never enters a client bundle, which is the other half of the manifest cut.
   */
  hub: React.ReactNode;
  /**
   * The active page. Both `/` and `/tv` render `null` — see the note below on
   * why the shell lives in the layout — so this is only ever an empty slot. It
   * is rendered anyway rather than dropped, so that a page which one day does
   * have content is not silently swallowed.
   */
  children?: React.ReactNode;
};

/**
 * What `App.tsx` used to be.
 *
 * The important property, carried over unchanged: **the Boring Edition is
 * mounted once and never unmounted.** It is the document; the television is an
 * overlay on top of it. That is what keeps the real content in the DOM from
 * first paint for crawlers, for screen readers, and for anyone whose GPU has
 * decided today is not the day.
 *
 * Under Next that property is load-bearing in a new way. This component lives in
 * the route group's `layout.tsx`, and `/` and `/tv` are both pages inside it
 * that render `null`. Navigating between them therefore swaps a null for a null
 * and leaves the layout — and `hub`, and the mounted television — completely
 * untouched. Move any of this into a `page.tsx` and every trip to `/tv` and back
 * would remount the library, losing scroll position and making a screen reader
 * announce the whole thing again. There is a Playwright mount-counter test
 * guarding exactly this.
 *
 * Two effects from `App.tsx` are deliberately gone:
 *  - the `popstate` listener, because `usePathname()` already tracks history;
 *  - the `document.title` effect, because each page now exports its own
 *    `metadata` and Next owns the title.
 */
export function StationShell({ hub, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const wantsTv = pathname === '/tv';

  // The set warming up is a real state but not a location — /tv covers both the
  // boot and the picture, so it cannot come from the pathname.
  const [booted, setBooted] = useState(false);

  const mode = !wantsTv ? 'boring' : booted ? 'tv' : 'booting';

  // Arriving straight at /tv should still boot the set rather than dropping you
  // in front of a television that is already on.
  useEffect(() => {
    if (!wantsTv) setBooted(false);
  }, [wantsTv]);

  // Fetch the schedule when the television is asked for — not on mount.
  //
  // Doing it on mount was the obvious-looking choice and it was wrong: it made
  // every reader of the Boring Edition download the whole schedule, about 130KB
  // of programming they will never see unless they switch the set on. That is
  // most of the weight the port just removed from the bundle, paid straight back
  // by the people least likely to want it.
  //
  // Firing on `wantsTv` still gets it in early enough to be invisible: the boot
  // sequence runs ~2.3s and the fetch starts at the top of it, so the manifest
  // has landed long before the tube warms up. `loadManifest` is idempotent
  // enough for the repeat visits a route toggle causes.
  useEffect(() => {
    if (wantsTv) void useTv.getState().loadManifest();
  }, [wantsTv]);

  // Browsers will not let us make a sound until the user has interacted, and
  // someone who deep-links straight to /tv never clicks the button that would
  // normally do the unlocking — so the boot and the power-on would play out in
  // silence. Take the first gesture of any kind, wherever it lands.
  useEffect(() => {
    const unlock = () => tvAudio.unlock();
    const opts = { once: true, capture: true } as const;
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
    };
  }, []);

  // Going *into* the television is triggered from inside the hub — by the CTA,
  // the mode switch and the channel rows — so it lives in those islands
  // (`HubControls`, `TvLink`) rather than here. The hub is a Server Component
  // now and cannot be handed a callback.

  const finishBoot = useCallback(() => {
    setBooted(true);
    const s = useTv.getState();
    s.setPower(true);
    tvAudio.powerOn();
    tvAudio.setVolume(s.volume, s.muted);
    // The channel's own bed comes up behind the warm-up, not with the relay.
    const ch = channelByNum(s.channelNum);
    if (ch) window.setTimeout(() => tvAudio.resumeBed(ch.slug), 950);
  }, []);

  const exitTv = useCallback(() => {
    useTv.getState().setPower(false);
    tvAudio.powerOff();
    router.push('/');
  }, [router]);

  return (
    <>
      {/*
        `inert` while the television is up. The Boring Edition stays mounted so
        its content is always in the document, but without this you can tab
        straight into a hundred book links that are hidden behind a full-screen
        overlay, and a screen reader finds two of every control.
      */}
      <div inert={mode !== 'boring'}>{hub}</div>
      {children}
      {mode === 'booting' && <BootSequence onDone={finishBoot} />}
      {mode === 'tv' && <TvMode onExit={exitTv} />}
    </>
  );
}
