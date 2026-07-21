'use client';

import dynamic from 'next/dynamic';

/**
 * The one place the television is allowed to be loaded.
 *
 * `ssr: false` is not a performance choice — it is a correctness one. Everything
 * below `TvMode` reaches for WebGL, a 2D canvas, `AudioContext`, `requestAnimation
 * Frame` and `window.matchMedia` during mount. None of those exist while Next is
 * rendering on the server, and several of them throw rather than return
 * undefined, so the set has to be excluded from the server pass entirely rather
 * than guarded call-by-call.
 *
 * `next/dynamic` with `ssr: false` is only permitted inside a Client Component,
 * which is why this file exists at all instead of the import living in the
 * layout.
 *
 * No `loading` fallback on purpose: `BootSequence` is already the loading state,
 * it is mounted by `StationShell` while this chunk arrives, and putting a second
 * spinner behind it would show two loading screens stacked.
 */
export const TvMode = dynamic(() => import('./TvMode').then((m) => m.TvMode), {
  ssr: false,
});
