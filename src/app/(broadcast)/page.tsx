import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Underdog Edition — 100 books almost nobody recommends',
  alternates: { canonical: '/' },
};

/**
 * Returns `null` on purpose, and must keep returning `null`.
 *
 * The whole site is rendered by this route group's `layout.tsx`, so that
 * navigating between `/` and `/tv` does not remount the library. Give this page
 * real content and that content would be mounted *alongside* the Boring
 * Edition rather than replacing it — and worse, moving the Boring Edition here
 * to "tidy it up" would silently break the never-unmount invariant, costing
 * scroll position on every trip to the television and making screen readers
 * re-announce the entire library. `test/mount-counter.test.mjs` guards it.
 */
export default function HubPage() {
  return null;
}
