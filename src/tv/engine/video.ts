import type { Programme } from '../../types';

/**
 * The video deck.
 *
 * Channels ship as text cards, but any programme can carry a real video file
 * instead (`programme.media`). This keeps that path working properly rather than
 * theoretically:
 *
 *   - Two elements, ping-ponged. One is on air while the other preloads what is
 *     coming next, so a cut between programmes has no black frame in it.
 *   - Playback is slaved to the broadcast clock, not to the element. Tuning into
 *     a channel drops you into the middle of whatever is running, which is the
 *     entire point of the schedule being a pure function of wall time.
 *   - Captions come from the browser's own WebVTT parser via `<track>`. We never
 *     get to use its *renderer* — the frames go into a WebGL texture, so the
 *     native caption layer is bypassed — but `track.activeCues` still fires, so
 *     we get parsed, correctly-timed cue text for free and draw it ourselves.
 */

/** Re-seek only when we have drifted further than this. */
const DRIFT_TOLERANCE = 0.45;

type Slot = {
  el: HTMLVideoElement;
  src: string | null;
};

function makeSlot(): Slot {
  const el = document.createElement('video');
  el.preload = 'auto';
  el.playsInline = true; // without this iOS hijacks into fullscreen and the illusion dies
  el.muted = true;
  el.loop = false;
  el.crossOrigin = 'anonymous'; // or reading it into WebGL taints the canvas
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  return { el, src: null };
}

export class VideoDeck {
  private a = makeSlot();
  private b = makeSlot();
  private live: Slot;
  private host: HTMLElement;

  constructor(host: HTMLElement) {
    this.host = host;
    this.live = this.a;
    host.appendChild(this.a.el);
    host.appendChild(this.b.el);
  }

  /**
   * Point the deck at the programme that should be on air, at the offset the
   * clock says. Returns the element to draw, or null if this programme is a text
   * card or the video is not ready yet.
   */
  sync(
    programme: Programme,
    offset: number,
    opts: { muted: boolean; volume: number },
  ): HTMLVideoElement | null {
    const media = programme.media;
    if (!media) {
      this.pauseAll();
      return null;
    }

    // Swap decks if the incoming programme is not what is loaded.
    if (this.live.src !== media.src) {
      const other = this.live === this.a ? this.b : this.a;
      if (other.src === media.src) {
        // Already preloaded on the spare deck — this is the free cut.
        this.live.el.pause();
        this.live = other;
      } else {
        this.load(this.live, media);
      }
    }

    const el = this.live.el;
    el.muted = opts.muted || opts.volume === 0;
    el.volume = Math.min(1, Math.max(0, opts.volume));

    if (el.readyState < 2) return null; // HAVE_CURRENT_DATA

    const target = Math.min(offset, Math.max(0, (el.duration || offset) - 0.05));
    if (Number.isFinite(target) && Math.abs(el.currentTime - target) > DRIFT_TOLERANCE) {
      try {
        el.currentTime = target;
      } catch {
        /* seeking before metadata; the next frame will retry */
      }
    }

    if (el.paused) {
      // Autoplay can still be refused. Muted playback is always allowed, so fall
      // back to that rather than showing a frozen frame.
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => undefined);
      });
    }

    return el;
  }

  /** Warm up the deck that is not on air with whatever is coming next. */
  preload(next: Programme | undefined) {
    if (!next?.media) return;
    const spare = this.live === this.a ? this.b : this.a;
    if (spare.src === next.media.src) return;
    this.load(spare, next.media);
  }

  private load(slot: Slot, media: NonNullable<Programme['media']>) {
    slot.el.pause();
    while (slot.el.firstChild) slot.el.removeChild(slot.el.firstChild);

    slot.el.src = media.src;
    if (media.poster) slot.el.poster = media.poster;
    slot.src = media.src;

    for (const c of media.captions ?? []) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = c.label;
      track.srclang = c.lang;
      track.src = c.src;
      track.default = true;
      slot.el.appendChild(track);
    }
    // "hidden" still parses the file and fires cue events; "showing" would ask
    // the browser to paint captions onto an element nobody can see.
    for (let i = 0; i < slot.el.textTracks.length; i++) {
      slot.el.textTracks[i].mode = 'hidden';
    }

    slot.el.load();
  }

  /** The caption text that should be on screen right now, if any. */
  activeCue(): string | null {
    const tracks = this.live.el.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const cues = tracks[i].activeCues;
      if (cues && cues.length) {
        return Array.from(cues)
          .map((c) => (c as VTTCue).text)
          .join(' ')
          .replace(/<[^>]+>/g, '')
          .trim();
      }
    }
    return null;
  }

  private pauseAll() {
    if (!this.a.el.paused) this.a.el.pause();
    if (!this.b.el.paused) this.b.el.pause();
  }

  dispose() {
    for (const slot of [this.a, this.b]) {
      slot.el.pause();
      slot.el.removeAttribute('src');
      slot.el.load();
      slot.el.remove();
    }
    void this.host;
  }
}
