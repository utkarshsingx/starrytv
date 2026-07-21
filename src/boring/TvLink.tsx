'use client';

import { useRouter } from 'next/navigation';
import { tvAudio } from '../tv/engine/audio';

/**
 * A channel row in the Boring Edition's channel list, which switches the set on
 * when clicked.
 *
 * Its own island because the list it sits in is server-rendered: the channels
 * come from `content/channels.ts` on the server, and only this button — the one
 * part that has to make a sound and navigate — crosses to the client.
 */
export function TvLink({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      className="book-link channel-link"
      onClick={() => {
        tvAudio.unlock();
        tvAudio.modeSwitch();
        router.push('/tv');
      }}
    >
      {children}
    </button>
  );
}
