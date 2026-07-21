import { StationShell } from '@/tv/StationShell';
import { BoringEdition } from '@/boring/BoringEdition';

/**
 * The station.
 *
 * Both `/` and `/tv` live in this route group, and the entire site is rendered
 * from here rather than from either page. That is the mechanism preserving the
 * invariant the old `App.tsx` documented at length: the Boring Edition mounts
 * once and never unmounts, and the television is an overlay on top of it.
 *
 * Next only re-renders the page when navigating within a shared layout, so
 * moving between `/` and `/tv` swaps one `null` for another and leaves this tree
 * — the library, the mounted set, the audio engine, the scroll position — fully
 * intact. `BoringEdition` is a Server Component and is passed through as a prop
 * so its hundred books render to HTML without any of the data crossing to the
 * client.
 */
export default function BroadcastLayout({ children }: { children: React.ReactNode }) {
  return <StationShell hub={<BoringEdition />}>{children}</StationShell>;
}
