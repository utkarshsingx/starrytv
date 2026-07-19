import { useCallback, useEffect, useState } from 'react';
import { BoringEdition } from './boring/BoringEdition';
import { TvMode } from './tv/TvMode';
import { BootSequence } from './tv/BootSequence';
import { useTv } from './tv/store';
import { tvAudio } from './tv/engine/audio';
import { channelByNum } from './content/channels';

type Mode = 'boring' | 'booting' | 'tv';

function urlWantsTv(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, hash } = window.location;
  return pathname.replace(/\/$/, '').endsWith('/tv') || hash === '#tv';
}

export default function App() {
  // Arriving straight at /tv should still boot the set rather than dropping you
  // in front of a television that is switched off.
  const [mode, setMode] = useState<Mode>(() => (urlWantsTv() ? 'booting' : 'boring'));

  // Back/forward between the two editions should work like any other page.
  useEffect(() => {
    const onPop = () => setMode(urlWantsTv() ? 'tv' : 'boring');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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

  useEffect(() => {
    document.title =
      mode === 'boring'
        ? 'The Underdog Edition — 100 books almost nobody recommends'
        : 'Starry TV — the Not Boring Edition';
  }, [mode]);

  const enterTv = useCallback(() => {
    // The click that got us here is the gesture that lets us make sound. Waste
    // it and the first channel change is silent.
    tvAudio.unlock();
    tvAudio.modeSwitch();
    setMode('booting');
    const url = new URL(window.location.href);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/tv`;
    window.history.pushState({}, '', url);
  }, []);

  const finishBoot = useCallback(() => {
    setMode('tv');
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
    setMode('boring');
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/tv$/, '') || '/';
    url.searchParams.delete('ch');
    window.history.pushState({}, '', url);
  }, []);

  return (
    <>
      {/*
        The Boring Edition is always mounted, never unmounted. It is the document
        — the TV is an overlay on top of it. That means the real content is in
        the DOM from first paint, for crawlers, for screen readers, and for
        anyone whose GPU has decided today is not the day.
      */}
      {/*
        `inert` while the television is up. The Boring Edition stays mounted so
        its content is always in the document, but without this you can tab
        straight into a hundred book links that are hidden behind a full-screen
        overlay, and a screen reader finds two of every control.
      */}
      <div inert={mode !== 'boring'}>
        <BoringEdition onEnterTv={enterTv} tvOpen={mode !== 'boring'} />
      </div>
      {mode === 'booting' && <BootSequence onDone={finishBoot} />}
      {mode === 'tv' && <TvMode onExit={exitTv} />}
    </>
  );
}
