import { useCallback, useEffect, useState } from 'react';
import { BoringEdition } from './boring/BoringEdition';
import { TvMode } from './tv/TvMode';
import { BootSequence } from './tv/BootSequence';
import { useTv } from './tv/store';
import { tvAudio } from './tv/engine/audio';

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
    setMode('booting');
    const url = new URL(window.location.href);
    url.pathname = `${url.pathname.replace(/\/$/, '')}/tv`;
    window.history.pushState({}, '', url);
  }, []);

  const finishBoot = useCallback(() => {
    setMode('tv');
    useTv.getState().setPower(true);
    tvAudio.setPower(true);
    const s = useTv.getState();
    tvAudio.setVolume(s.volume, s.muted);
  }, []);

  const exitTv = useCallback(() => {
    useTv.getState().setPower(false);
    tvAudio.setPower(false);
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
      <BoringEdition onEnterTv={enterTv} tvOpen={mode !== 'boring'} />
      {mode === 'booting' && <BootSequence onDone={finishBoot} />}
      {mode === 'tv' && <TvMode onExit={exitTv} />}
    </>
  );
}
