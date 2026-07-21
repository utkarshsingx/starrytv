'use client';

/**
 * Web Audio primitives.
 *
 * Everything the site makes a noise with is built from these. No audio files
 * ship — partly because it keeps the bundle honest, and partly because a
 * synthesised flyback whine can track the tube's state in a way a sample never
 * could.
 *
 * Every helper schedules itself, cleans itself up, and is safe to fire from a
 * click handler at any rate.
 */

export type Bus = { ctx: AudioContext; out: AudioNode };

// ---------------------------------------------------------------------------
// shared noise
// ---------------------------------------------------------------------------

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();

/** Two seconds of white noise, reused by every hiss, burst and texture. */
export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

// ---------------------------------------------------------------------------
// envelopes
// ---------------------------------------------------------------------------

export type Env = {
  /** Attack, seconds. */
  a?: number;
  /** Decay to sustain, seconds. */
  d?: number;
  /** Sustain level, 0..1 of peak. */
  s?: number;
  /** Time held at sustain before release, seconds. */
  hold?: number;
  /** Release, seconds. */
  r?: number;
  /** Peak gain. */
  peak: number;
};

/**
 * Applies an ADSR to a gain param and returns when the tail finishes.
 *
 * Uses exponential ramps because linear ones sound synthetic on decays —
 * with a floor, since exponentialRampToValueAtTime cannot reach zero.
 */
export function applyEnv(param: AudioParam, t0: number, env: Env): number {
  const { a = 0.005, d = 0, s = 1, hold = 0, r = 0.08, peak } = env;
  const floor = 0.0001;
  const sustain = Math.max(floor, peak * s);

  param.cancelScheduledValues(t0);
  param.setValueAtTime(floor, t0);
  param.exponentialRampToValueAtTime(Math.max(floor, peak), t0 + a);
  if (d > 0) param.exponentialRampToValueAtTime(sustain, t0 + a + d);
  const releaseAt = t0 + a + d + hold;
  param.setValueAtTime(d > 0 ? sustain : Math.max(floor, peak), releaseAt);
  param.exponentialRampToValueAtTime(floor, releaseAt + r);
  return releaseAt + r;
}

// ---------------------------------------------------------------------------
// voices
// ---------------------------------------------------------------------------

export type ToneOpts = {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the note. */
  freqTo?: number;
  /** 'exp' glides musically; 'lin' is right for mechanical sweeps. */
  glide?: 'exp' | 'lin';
  env: Env;
  filter?: { type: BiquadFilterType; hz: number; q?: number; hzTo?: number };
  /** Detuned second voice, in cents. Creates beating. */
  detune?: number;
  when?: number;
  pan?: number;
};

/** One pitched note. The workhorse. */
export function tone(bus: Bus, o: ToneOpts): number {
  const { ctx } = bus;
  const t0 = o.when ?? ctx.currentTime;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;

  let node: AudioNode = gain;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.hz, t0);
    f.Q.value = o.filter.q ?? 1;
    if (o.filter.hzTo !== undefined) {
      f.frequency.exponentialRampToValueAtTime(
        Math.max(20, o.filter.hzTo),
        t0 + (o.env.a ?? 0) + (o.env.d ?? 0) + (o.env.hold ?? 0) + (o.env.r ?? 0.08),
      );
    }
    gain.connect(f);
    node = f;
  }

  if (o.pan !== undefined && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    node.connect(p);
    node = p;
  }
  node.connect(bus.out);

  const oscs: OscillatorNode[] = [];
  const voices = o.detune ? [0, o.detune] : [0];
  for (const cents of voices) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqTo !== undefined) {
      const end = t0 + (o.env.a ?? 0) + (o.env.d ?? 0) + (o.env.hold ?? 0) + (o.env.r ?? 0.08);
      if (o.glide === 'lin') osc.frequency.linearRampToValueAtTime(o.freqTo, end);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), end);
    }
    if (cents) osc.detune.value = cents;
    osc.connect(gain);
    oscs.push(osc);
  }

  // Two voices at the same envelope are twice as loud; keep the peak honest.
  const end = applyEnv(gain.gain, t0, { ...o.env, peak: o.env.peak / voices.length });

  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(end + 0.02);
  }
  oscs[oscs.length - 1].onended = () => gain.disconnect();
  return end;
}

export type NoiseOpts = {
  env: Env;
  filter?: { type: BiquadFilterType; hz: number; hzTo?: number; q?: number };
  when?: number;
  /** Playback rate; below 1 makes the noise darker and grainier. */
  rate?: number;
  pan?: number;
};

/** A burst of filtered noise: hiss, snow, wind, breath, mechanical scrape. */
export function noise(bus: Bus, o: NoiseOpts): number {
  const { ctx } = bus;
  const t0 = o.when ?? ctx.currentTime;
  const total = (o.env.a ?? 0.005) + (o.env.d ?? 0) + (o.env.hold ?? 0) + (o.env.r ?? 0.08);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;

  let head: AudioNode = src;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(Math.max(20, o.filter.hz), t0);
    f.Q.value = o.filter.q ?? 1;
    if (o.filter.hzTo !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.hzTo), t0 + total);
    }
    head.connect(f);
    head = f;
  }
  head.connect(gain);

  let tail: AudioNode = gain;
  if (o.pan !== undefined && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    tail.connect(p);
    tail = p;
  }
  tail.connect(bus.out);

  const end = applyEnv(gain.gain, t0, o.env);
  // Random offset into the shared buffer, so repeated bursts are not literally
  // the same noise every time. Two static bursts in a row from the same samples
  // read as a looping sample rather than as static.
  src.start(t0, Math.random() * (src.buffer!.duration - 0.05));
  src.stop(end + 0.02);
  src.onended = () => gain.disconnect();
  return end;
}

export type BellOpts = {
  freq: number;
  /** Modulator:carrier frequency ratio. Non-integer ratios give inharmonic, bell-like tones. */
  ratio: number;
  /** Modulation depth in Hz. Higher is more metallic. */
  index: number;
  decay: number;
  peak: number;
  when?: number;
  pan?: number;
};

/** Two-operator FM. Cheap, and the only convincing way to get a bell. */
export function bell(bus: Bus, o: BellOpts): number {
  const { ctx } = bus;
  const t0 = o.when ?? ctx.currentTime;

  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = o.freq;

  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = o.freq * o.ratio;

  // The modulation index decays faster than the note, which is what makes a
  // struck bell go from clangorous to pure as it rings out.
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(o.index, t0);
  modGain.gain.exponentialRampToValueAtTime(0.001, t0 + o.decay * 0.55);
  mod.connect(modGain).connect(carrier.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(o.peak, t0 + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.decay);

  let tail: AudioNode = gain;
  if (o.pan !== undefined && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = o.pan;
    tail.connect(p);
    tail = p;
  }
  carrier.connect(gain);
  tail.connect(bus.out);

  const end = t0 + o.decay;
  carrier.start(t0);
  mod.start(t0);
  carrier.stop(end + 0.02);
  mod.stop(end + 0.02);
  carrier.onended = () => gain.disconnect();
  return end;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Semitones above a root, as a frequency. */
export function semitone(rootHz: number, n: number): number {
  return rootHz * Math.pow(2, n / 12);
}

/**
 * Scale-degree index to frequency, wrapping into higher octaves past the top of
 * the scale so `degrees` arrays can range freely without bounds checks.
 */
export function degreeHz(rootHz: number, scale: number[], degree: number, octave = 0): number {
  const n = scale.length;
  const oct = Math.floor(degree / n) + octave;
  const idx = ((degree % n) + n) % n;
  return semitone(rootHz, scale[idx] + oct * 12);
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Humanises a repeat interval so nothing lands on an audible grid. */
export function jitter(seconds: number, amount = 0.25): number {
  return seconds * (1 + (Math.random() * 2 - 1) * amount);
}
