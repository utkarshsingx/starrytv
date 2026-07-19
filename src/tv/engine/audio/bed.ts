import {
  type Bus,
  noiseBuffer,
  tone,
  bell,
  noise,
  degreeHz,
  pick,
  jitter,
} from './synth';

/**
 * Channel ambient beds.
 *
 * Each channel has its own continuous sound so that turning the dial is an
 * audible event and not just a visual one. Beds are specified as data (see
 * `src/content/beds.data.ts`) and rendered here.
 *
 * Design rule everything obeys: this plays underneath text people are reading.
 * It must be possible to forget it is there. Nothing gets a strong phrase that
 * will become maddening on the twelfth repeat, and every repeating layer is
 * jittered so it never lands on an audible grid.
 */

export type LayerSpec = {
  type: 'drone' | 'pad' | 'pluck' | 'bell' | 'noise' | 'pulse' | 'sweep';
  gain: number;
  waveform?: OscillatorType | null;
  detuneCents?: number | null;
  filterType?: BiquadFilterType | null;
  filterHz?: number | null;
  filterQ?: number | null;
  lfoHz?: number | null;
  lfoDepth?: number | null;
  chord?: number[] | null;
  degrees?: number[] | null;
  octave?: number | null;
  attack?: number | null;
  decay?: number | null;
  release?: number | null;
  everyNoteSec?: number | null;
  everySec?: number | null;
  freq?: number | null;
  ratio?: number | null;
  index?: number | null;
  fromHz?: number | null;
  toHz?: number | null;
  durationSec?: number | null;
};

export type BedSpec = {
  character: string;
  rootHz: number;
  scale: number[];
  overallGain: number;
  layers: LayerSpec[];
};

const FADE = 1.1;

export class Bed {
  private ctx: AudioContext;
  private gain: GainNode;
  private nodes: AudioScheduledSourceNode[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private stopped = false;
  readonly spec: BedSpec;

  constructor(bus: Bus, spec: BedSpec) {
    this.ctx = bus.ctx;
    this.spec = spec;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.gain.connect(bus.out);

    const inner: Bus = { ctx: this.ctx, out: this.gain };
    for (const layer of spec.layers) this.startLayer(inner, layer);

    // Fade in rather than cut in — a bed that arrives abruptly announces itself,
    // which is precisely what it must not do.
    this.gain.gain.setTargetAtTime(spec.overallGain, this.ctx.currentTime, FADE / 3);
  }

  private startLayer(bus: Bus, l: LayerSpec) {
    switch (l.type) {
      case 'drone':
        this.drone(bus, l);
        break;
      case 'noise':
        this.noiseTexture(bus, l);
        break;
      default:
        this.schedule(bus, l);
    }
  }

  // ---- continuous layers ----------------------------------------------------

  private drone(bus: Bus, l: LayerSpec) {
    const t0 = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(l.gain, t0, 0.8);

    let head: AudioNode = gain;
    if (l.filterType && l.filterHz) {
      const f = this.ctx.createBiquadFilter();
      f.type = l.filterType;
      f.frequency.value = l.filterHz;
      f.Q.value = l.filterQ ?? 1;
      gain.connect(f);
      head = f;

      // Slow filter movement is what stops a drone reading as a held organ note.
      if (l.lfoHz && l.lfoDepth) {
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = l.lfoHz;
        const depth = this.ctx.createGain();
        depth.gain.value = l.lfoDepth;
        lfo.connect(depth).connect(f.frequency);
        lfo.start(t0);
        this.nodes.push(lfo);
      }
    }
    head.connect(bus.out);

    const voices = l.detuneCents ? [0, l.detuneCents] : [0];
    for (const cents of voices) {
      const osc = this.ctx.createOscillator();
      osc.type = l.waveform ?? 'sine';
      osc.frequency.value = this.spec.rootHz;
      osc.detune.value = cents;
      osc.connect(gain);
      osc.start(t0);
      this.nodes.push(osc);
    }
  }

  private noiseTexture(bus: Bus, l: LayerSpec) {
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    src.loop = true;

    const f = this.ctx.createBiquadFilter();
    f.type = l.filterType ?? 'bandpass';
    f.frequency.value = l.filterHz ?? 1200;
    f.Q.value = l.filterQ ?? 0.7;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(l.gain, t0, 0.8);

    src.connect(f).connect(gain).connect(bus.out);

    if (l.lfoHz && l.lfoDepth) {
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = l.lfoHz;
      const depth = this.ctx.createGain();
      depth.gain.value = l.lfoDepth;
      lfo.connect(depth).connect(f.frequency);
      lfo.start(t0);
      this.nodes.push(lfo);
    }

    // Start somewhere random in the buffer. Every noise source in the app shares
    // one cached buffer, so two textures started at the same instant would read
    // the same samples and be correlated — they would sum as one louder hiss
    // rather than as two independent textures, which is the whole point of
    // having two.
    src.start(t0, Math.random() * (src.buffer!.duration - 0.05));
    this.nodes.push(src);
  }

  // ---- sparse, repeating layers --------------------------------------------

  private schedule(bus: Bus, l: LayerSpec) {
    const interval = l.everyNoteSec ?? l.everySec ?? 8;

    const fire = () => {
      if (this.stopped) return;
      try {
        this.fireOnce(bus, l);
      } catch {
        /* a single missed note is never worth taking the page down for */
      }
      this.timers.push(setTimeout(fire, jitter(interval) * 1000));
    };

    // Stagger the first hit so tuning to a channel does not trigger every
    // scheduled layer on the same frame.
    this.timers.push(setTimeout(fire, Math.random() * interval * 1000));
  }

  private fireOnce(bus: Bus, l: LayerSpec) {
    const { rootHz, scale } = this.spec;
    const degrees = l.degrees?.length ? l.degrees : [0, 2, 4];

    switch (l.type) {
      case 'pad': {
        const chord = l.chord?.length ? l.chord : [0, 2, 4];
        for (const d of chord) {
          tone(bus, {
            type: l.waveform ?? 'triangle',
            freq: degreeHz(rootHz, scale, d, l.octave ?? 0),
            detune: 7,
            filter: l.filterHz
              ? { type: l.filterType ?? 'lowpass', hz: l.filterHz, q: l.filterQ ?? 0.8 }
              : undefined,
            env: {
              a: l.attack ?? 2,
              hold: 1.5,
              r: l.release ?? 4,
              peak: l.gain / chord.length,
            },
          });
        }
        break;
      }
      case 'pluck':
        tone(bus, {
          type: l.waveform ?? 'triangle',
          freq: degreeHz(rootHz, scale, pick(degrees), l.octave ?? 0),
          filter: { type: 'lowpass', hz: l.filterHz ?? 2200, q: 0.8 },
          env: { a: 0.006, d: l.decay ?? 0.6, s: 0.001, r: 0.08, peak: l.gain },
        });
        break;
      case 'bell':
        bell(bus, {
          freq: degreeHz(rootHz, scale, pick(degrees), l.octave ?? 1),
          ratio: l.ratio ?? 2.4,
          index: l.index ?? 260,
          decay: l.decay ?? 3,
          peak: l.gain,
          pan: Math.random() * 1.2 - 0.6,
        });
        break;
      case 'pulse':
        tone(bus, {
          type: 'sine',
          freq: l.freq ?? 60,
          freqTo: (l.freq ?? 60) * 0.72,
          env: { a: 0.004, d: l.decay ?? 0.22, s: 0.001, r: 0.05, peak: l.gain },
        });
        break;
      case 'sweep':
        noise(bus, {
          filter: {
            type: 'bandpass',
            hz: l.fromHz ?? 300,
            hzTo: l.toHz ?? 3000,
            q: 1.4,
          },
          env: {
            a: (l.durationSec ?? 3) * 0.4,
            r: (l.durationSec ?? 3) * 0.6,
            peak: l.gain,
          },
        });
        break;
    }
  }

  // ---- teardown -------------------------------------------------------------

  /** Fade out and tear down. Safe to call twice. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];

    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, FADE / 4);

    // Let the fade finish before pulling the oscillators out from under it.
    setTimeout(() => {
      for (const n of this.nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      this.nodes = [];
      this.gain.disconnect();
    }, FADE * 1000);
  }

  /** Momentarily pull the bed down, e.g. while the tuner is searching. */
  duck(amount: number, seconds: number) {
    if (this.stopped) return;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(this.spec.overallGain * amount, t, 0.04);
    this.gain.gain.setTargetAtTime(this.spec.overallGain, t + seconds, 0.25);
  }
}
