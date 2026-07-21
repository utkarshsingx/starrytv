import type { Metadata, Viewport } from 'next';

/**
 * Every stylesheet in the project is imported here and nowhere else.
 *
 * Not a preference — Next only permits global CSS in the root layout, so the
 * three `import './x.css'` lines that used to sit next to the components they
 * styled (`main.tsx`, `BoringEdition.tsx`, `TvMode.tsx`) have to come up here.
 * Order is load-bearing: `index.css` carries the custom properties and the
 * resets that the other two build on.
 */
import '../index.css';
import '../boring/boring.css';
import '../tv/tv.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://starrytv.vercel.app'),
  title: {
    default: 'The Underdog Edition — 100 books almost nobody recommends',
    template: '%s — Starry',
  },
  description:
    'A library of 100 under-read books across 20 genres, each with a short review. Or switch on the television and watch channels of poems, film scenes, records and very short stories.',
  openGraph: {
    type: 'website',
    title: 'The Underdog Edition',
    description:
      '100 under-read books, 20 genres, one short review each. Then there is a television.',
  },
  twitter: { card: 'summary' },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#08090c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <noscript>
          {/*
            Rewritten for the port. The old copy apologised for needing
            JavaScript and pointed readers at a source file in the repository —
            true of the Vite build, where the document was an empty div. The
            library is now server-rendered, so every book is already here in the
            markup. Only the television actually needs script.
          */}
          <p className="noscript-note">
            The television needs JavaScript — the library does not. Every book below is already on
            this page, and it prints.
          </p>
        </noscript>
      </body>
    </html>
  );
}
