import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Starry TV — the Not Boring Edition',
  description:
    'The same library as a CRT television you can actually tune. Channels of poems, film scenes, records, animals, strange history, fake commercials, surreal weather and very short stories.',
  alternates: { canonical: '/tv' },
};

/** `null` for the same reason as the hub page — see the note there. */
export default function TvPage() {
  return null;
}
