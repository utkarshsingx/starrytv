import { type Bus, tone, noise, noiseBuffer } from './synth';
import { Bed, type BedSpec } from './bed';
import { BED_SPECS } from '../../../content/beds.data';

/**
 * The whole site's sound.
 *
 * Nothing here loads a file. Every noise the site makes is synthesised at the
 * moment it is needed, which keeps the bundle honest and — more usefully — lets
 * the flyback whine actually track the state of the tube instead of being a
 * loop that happens to be playing.
 *
 * Routing:
 *
 *   master              the sound preference; one switch kills everything
 *    ├── tvBus          follows the TV's own volume and mute
 *    │    ├── bedBus    per-channel ambient
 *    │    └── sfxBus    tuning, remote buttons, on-screen menus
 *    ├── elecBus        the tube's own electrical noise
 *    └── pageBus        the Boring Edition, at a fixed and very low level
 *
 * Two deliberate routing decisions:
 *
 *   - `elecBus` hangs off master, NOT off tvBus. Muting a television does not
 *     stop its flyback transformer whining, and turning the volume down does
 *     not either. Putting the electronics behind the volume knob is the single
 *     biggest realism miss available here.
 *   - `pageBus` does not follow the TV's volume either, because the Boring
 *     Edition has no volume knob. Its sounds are meant to be the kind of thing
 *     you only notice once they are gone.
 */

const PREF_KEY = 'starry.sound';

/** NTSC line rate. PAL sets whine at 15625. */
const LINE_RATE_HZ = 15734.264;
/** NTSC field rate, which amplitude-modulates the whine. */
const FIELD_RATE_HZ = 59.94;
/** Mains hum, doubled. 100/200 in a 50 Hz country. */
const MAINS_HZ = 120;

export type SoundPref = 'on' | 'off';

export function readPref(): SoundPref {
  if (typeof localStorage === 'undefined') return 'on';
  return localStorage.getItem(PREF_KEY) === 'off' ? 'off' : 'on';
}

/**
 * The preference is rendered in more than one place at once — both editions
 * carry a toggle, and the Boring Edition is never unmounted — so it needs to be
 * an external store rather than component state, or flipping one leaves the
 * other showing a stale label.
 */
const prefListeners = new Set<() => void>();

export function subscribeToPref(fn: () => void): () => void {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export class TvAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private tvBus: GainNode | null = null;
  private bedBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private elecBus: GainNode | null = null;
  private pageBus: GainNode | null = null;

  private whineGain: GainNode | null = null;
  private hissGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private running: AudioScheduledSourceNode[] = [];

  private bed: Bed | null = null;
  private bedSlug: string | null = null;
  private powered = false;

  private lastPopAt = 0;
  private lastKeyAt = 0;
  private enabled: SoundPref = readPref();

  // ---- lifecycle ------------------------------------------------------------

  /** Must be called from inside a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;

    const mk = (parent: AudioNode, value: number) => {
      const g = ctx.createGain();
      g.gain.value = value;
      g.connect(parent);
      return g;
    };

    this.master = mk(ctx.destination, this.enabled === 'on' ? 1 : 0);
    this.tvBus = mk(this.master, 0);
    this.bedBus = mk(this.tvBus, 1);
    this.sfxBus = mk(this.tvBus, 1);
    this.elecBus = mk(this.master, 1);
    this.pageBus = mk(this.master, 0.5);

    this.buildElectronics();
  }

  private get out(): { sfx: Bus; page: Bus; bed: Bus } | null {
    if (!this.ctx || !this.sfxBus || !this.pageBus || !this.bedBus) return null;
    return {
      sfx: { ctx: this.ctx, out: this.sfxBus },
      page: { ctx: this.ctx, out: this.pageBus },
      bed: { ctx: this.ctx, out: this.bedBus },
    };
  }

  setEnabled(pref: SoundPref) {
    this.enabled = pref;
    try {
      localStorage.setItem(PREF_KEY, pref);
    } catch {
      /* private browsing */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(pref === 'on' ? 1 : 0, this.ctx.currentTime, 0.05);
    }
    for (const fn of prefListeners) fn();
  }

  isEnabled() {
    return this.enabled;
  }

  setVolume(v: number, muted: boolean) {
    if (!this.tvBus || !this.ctx) return;
    const target = muted || !this.powered ? 0 : Math.min(1, Math.max(0, v));
    this.tvBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.tvBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  // ---- the tube's own electrical noise --------------------------------------

  private buildElectronics() {
    const ctx = this.ctx;
    if (!ctx || !this.elecBus) return;

    // ---- the flyback whine ----
    //
    // The horizontal output transformer's ferrite core magnetostricts once per
    // scan line and radiates the line rate straight into the room. It is nearly
    // a pure sine, and it is the single most evocative sound a CRT makes.
    //
    // No second harmonic: 2 x 15734 is 31.5 kHz, above Nyquist at both 44.1 and
    // 48 kHz. It would either be dropped or — worse — alias back down to a
    // spurious audible tone that is nothing like a television.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = LINE_RATE_HZ;

    const whineGain = ctx.createGain();
    whineGain.gain.value = 0;
    const whineLp = ctx.createBiquadFilter();
    whineLp.type = 'lowpass';
    whineLp.frequency.value = 17000;
    whineLp.Q.value = 0.5;
    osc.connect(whineGain).connect(whineLp).connect(this.elecBus);
    osc.start();
    this.whineGain = whineGain;
    this.running.push(osc);

    // A static sine reads as tinnitus; a modulated one reads as a machine.
    // Every LFO gets a different start phase so nothing lines up on a grid.
    const modulate = (
      hz: number,
      depth: number,
      target: AudioParam,
      type: OscillatorType = 'sine',
    ) => {
      const lfo = ctx.createOscillator();
      lfo.type = type;
      lfo.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = depth;
      lfo.connect(g).connect(target);
      lfo.start(ctx.currentTime + Math.random() * 0.5);
      this.running.push(lfo);
    };

    // 1. Field-rate AM. Puts sidebands either side of the line rate; the most
    //    important of the four.
    modulate(FIELD_RATE_HZ, 0.0008, whineGain.gain);
    // 2. Beam-current breathing — picture content loading the flyback.
    modulate(0.13, 0.0016, whineGain.gain);
    modulate(0.31, 0.0011, whineGain.gain);
    // 3. Slow pitch drift, about five cents.
    modulate(0.4, 45, osc.detune);

    // ---- amplifier hiss ----
    // Carries "the set is on" for everyone who cannot hear 15.7 kHz.
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx);
    hiss.loop = true;
    const hissBp = ctx.createBiquadFilter();
    hissBp.type = 'bandpass';
    hissBp.frequency.value = 2600;
    hissBp.Q.value = 0.35;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(hissBp).connect(hissGain).connect(this.elecBus);
    hiss.start(0, Math.random() * 1.5);
    this.hissGain = hissGain;
    this.running.push(hiss);

    // ---- mains hum ----
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    const humLp = ctx.createBiquadFilter();
    humLp.type = 'lowpass';
    humLp.frequency.value = 400;
    humGain.connect(humLp).connect(this.elecBus);
    for (const [hz, rel] of [
      [MAINS_HZ, 1],
      [MAINS_HZ * 2, 0.3],
    ]) {
      const h = ctx.createOscillator();
      h.type = 'sine';
      h.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = rel;
      h.connect(g).connect(humGain);
      h.start();
      this.running.push(h);
    }
    this.humGain = humGain;
  }

  /**
   * Never step the whine's level — a step on a 15.7 kHz sine is an audible click
   * and, worse, it draws attention to the tone as a tone.
   */
  private setWhine(level: number, tc = 0.3) {
    if (!this.whineGain || !this.ctx) return;
    this.whineGain.gain.setTargetAtTime(level, this.ctx.currentTime, tc);
  }

  // ---- power ----------------------------------------------------------------

  /**
   * Switching on is five physical events over about two seconds, not one sound:
   * the mains relay slams and its contacts bounce, the degauss coil jumps
   * against the glass and buzzes as the thermistor heats, the flyback climbs to
   * voltage, and the amplifier thumps as its DC settles.
   */
  powerOn() {
    const o = this.out;
    if (!this.ctx || !o) return;
    this.powered = true;
    const t = this.ctx.currentTime;

    this.relay(t, true);
    this.degauss(t + 0.028, 0.75);

    // Flyback ramps as the EHT rail charges: fast at first, then creeping the
    // last few hundred Hz.
    const osc = this.running[0] as OscillatorNode | undefined;
    if (osc?.frequency) {
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(6200, t + 0.12);
      osc.frequency.exponentialRampToValueAtTime(14900, t + 0.9);
      osc.frequency.linearRampToValueAtTime(LINE_RATE_HZ, t + 1.35);
    }
    this.setWhine(0.008, 0.45);
    this.hissGain?.gain.setTargetAtTime(0.018, t + 0.2, 0.5);
    this.humGain?.gain.setTargetAtTime(0.005, t + 0.25, 0.5);

    // Speaker DC thump once the amplifier is live.
    tone(o.sfx, {
      type: 'sine',
      freq: 170,
      freqTo: 62,
      glide: 'lin',
      filter: { type: 'lowpass', hz: 900, q: 0.7 },
      env: { a: 0.001, d: 0.045, s: 0.001, r: 0.025, peak: 0.12 },
      when: t + 0.62,
    });
  }

  powerOff() {
    const o = this.out;
    if (!this.ctx || !o) return;
    const t = this.ctx.currentTime;
    this.powered = false;

    // The whine falls away as the EHT drains rather than stopping dead.
    const osc = this.running[0] as OscillatorNode | undefined;
    if (osc?.frequency) {
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(LINE_RATE_HZ, t);
      osc.frequency.exponentialRampToValueAtTime(5200, t + 0.42);
    }
    this.setWhine(0, 0.12);
    this.hissGain?.gain.setTargetAtTime(0, t, 0.07);
    this.humGain?.gain.setTargetAtTime(0, t, 0.09);

    this.relay(t, false);

    // The scan collapsing to a dot.
    tone(o.sfx, {
      type: 'sine',
      freq: 1150,
      freqTo: 55,
      env: { a: 0.002, d: 0.26, s: 0.001, r: 0.06, peak: 0.26 },
      when: t + 0.02,
    });
    // Residual discharge, a soft crackle a beat later.
    noise(o.sfx, {
      filter: { type: 'highpass', hz: 3000, q: 0.7 },
      env: { a: 0.004, d: 0.13, s: 0.001, r: 0.06, peak: 0.05 },
      when: t + 0.2,
    });

    this.bed?.stop();
    this.bed = null;
    this.bedSlug = null;
  }

  /**
   * Mains relay contacts. The bounce is what makes a relay sound like a relay
   * and not a click: the armature slams home and the contacts chatter two or
   * three times over the next ten milliseconds.
   */
  private relay(when: number, closing: boolean) {
    const o = this.out;
    if (!o) return;
    const bounces: [number, number, number, number][] = [
      [0, 2200, 0.3, 0.022],
      [0.0055, 2600, 0.13, 0.009],
      [0.009, 3000, 0.05, 0.005],
    ];
    for (const [dt, hz, peak, decay] of bounces) {
      noise(o.sfx, {
        filter: { type: 'bandpass', hz: closing ? hz : hz * 0.75, q: 3 },
        env: { a: 0.0004, d: decay, s: 0.001, r: 0.012, peak },
        when: when + dt,
      });
    }
    // Chassis thud underneath.
    tone(o.sfx, {
      type: 'square',
      freq: closing ? 170 : 138,
      freqTo: 62,
      glide: 'lin',
      filter: { type: 'lowpass', hz: 900, q: 0.7 },
      env: { a: 0.001, d: 0.045, s: 0.001, r: 0.025, peak: 0.12 },
      when,
    });
  }

  /**
   * The degauss coil: full mains voltage across a few hundred turns tied around
   * the tube's bell, in series with a cold thermistor. The first half-cycle
   * draws several amps — the coil physically jumps against the glass and the
   * shadow mask rings — then the thermistor heats and chokes it off over a
   * second or so.
   *
   * There is no pitch sweep anywhere in this. The buzz is mains-locked; only its
   * level and brightness fall. Sweeping the pitch is the classic mistake and it
   * immediately sounds like a synthesiser.
   */
  private degauss(when: number, scale = 1) {
    const ctx = this.ctx;
    const o = this.out;
    if (!ctx || !o) return;

    // The coil jumping on the first current peak.
    tone(o.sfx, {
      type: 'sine',
      freq: 82,
      freqTo: 46,
      glide: 'lin',
      filter: { type: 'lowpass', hz: 300, q: 0.9 },
      env: { a: 0.0015, d: 0.11, s: 0.001, r: 0.07, peak: 0.42 * scale },
      when: when + 0.018,
    });
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 340, q: 1.3 },
      env: { a: 0.0007, d: 0.045, s: 0.001, r: 0.03, peak: 0.2 * scale },
      when: when + 0.018,
    });
    // The shadow mask being shocked. Brief, metallic, onset only — this is the
    // part that sells it.
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 2600, q: 7 },
      env: { a: 0.002, d: 0.07, s: 0.001, r: 0.09, peak: 0.065 * scale },
      when: when + 0.018,
    });

    // The buzz: three voices into one filter into one gain.
    const buzz = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3.2;
    lp.frequency.setValueAtTime(2800, when + 0.03);
    lp.frequency.exponentialRampToValueAtTime(950, when + 0.32);
    lp.frequency.exponentialRampToValueAtTime(240, when + 1.35);
    buzz.connect(lp).connect(o.sfx.out);

    // Two-stage gain, following the thermistor's resistance curve.
    buzz.gain.setValueAtTime(0.0001, when + 0.024);
    buzz.gain.exponentialRampToValueAtTime(0.26 * scale, when + 0.054);
    buzz.gain.exponentialRampToValueAtTime(0.1 * scale, when + 0.32);
    buzz.gain.exponentialRampToValueAtTime(0.0001, when + 1.42);

    const voices: [OscillatorType, number, number, number][] = [
      ['sawtooth', MAINS_HZ, 1, 0],
      ['sawtooth', MAINS_HZ / 2, 0.28, 0],
      ['triangle', MAINS_HZ * 2, 0.15, 7],
    ];
    for (const [type, hz, rel, detune] of voices) {
      const v = ctx.createOscillator();
      v.type = type;
      v.frequency.value = hz;
      v.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = rel;
      v.connect(g).connect(buzz);
      v.start(when + 0.024);
      v.stop(when + 1.5);
    }

    // The coil is cable-tied and shifts as it buzzes.
    for (const [hz, depth] of [
      [4.3, 0.09],
      [1.7, 0.05],
    ]) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.value = depth * scale * 0.26;
      lfo.connect(g).connect(buzz.gain);
      lfo.start(when + 0.024);
      lfo.stop(when + 1.5);
    }
  }

  // ---- tuning ---------------------------------------------------------------

  /**
   * Changing channel is five stages in about three-quarters of a second. The
   * audio goes dead FIRST — that beat of silence before the snow is what sells
   * it as a circuit rather than a crossfade.
   */
  tune(slug: string) {
    const o = this.out;
    if (!this.ctx || !o || !this.powered) {
      this.bedSlug = slug;
      return;
    }
    const t = this.ctx.currentTime;

    // 1. Audio drops out. The outgoing bed goes with it.
    this.bed?.stop();
    this.bed = null;
    this.speakerPop(t, false);

    // 2. Snow. Broadband, with the top taken off so it does not sting.
    noise(o.sfx, {
      filter: { type: 'highpass', hz: 900, q: 0.4 },
      rate: rand(0.92, 1.08),
      env: { a: 0.012, d: 0.1, s: 0.6, hold: 0.16, r: 0.2, peak: 0.3 },
      when: t + 0.03,
    });

    // 3. Sync searching — two OPPOSED sweeps. This is load-bearing: one rising
    //    sweep reads as a musical gesture, two opposed sweeps read as a machine
    //    hunting for something.
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 420, hzTo: 2600, q: 3.5 },
      env: { a: 0.05, hold: 0.14, r: 0.14, peak: 0.17 },
      when: t + 0.08,
    });
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 2200, hzTo: 700, q: 3 },
      env: { a: 0.05, hold: 0.14, r: 0.14, peak: 0.08 },
      when: t + 0.08,
    });

    // 4. Horizontal tear ticks — the sync pulse caught and lost.
    for (const at of [0.18, 0.265]) {
      noise(o.sfx, {
        filter: { type: 'bandpass', hz: 1200, q: 6 },
        env: { a: 0.001, d: 0.005, s: 0.001, r: 0.003, peak: 0.09 },
        when: t + at + rand(-0.02, 0.02),
      });
    }

    // 5. Lock. A linear glide, because this is a mechanical event and an
    //    exponential one would sound like a note.
    tone(o.sfx, {
      type: 'triangle',
      freq: 240,
      freqTo: 90,
      glide: 'lin',
      env: { a: 0.004, d: 0.09, s: 0.001, r: 0.05, peak: 0.2 },
      when: t + 0.4,
    });
    this.speakerPop(t + 0.42, true);

    // 6. The new channel's bed arrives just behind the lock.
    this.bedSlug = slug;
    window.setTimeout(() => {
      if (this.bedSlug === slug && this.powered) this.startBed(slug);
    }, 440);
  }

  /**
   * Tuning to a channel that is not there. The one sound here that does not
   * resolve — everything else lands on something, this just decays out.
   */
  noSignal() {
    const ctx = this.ctx;
    const o = this.out;
    if (!ctx || !o) return;
    const t = ctx.currentTime;
    this.bed?.duck(0.25, 0.7);

    // Main hiss, with AGC pumping: on a dead channel the gain circuit hunts, so
    // the hiss breathes at a few Hz instead of sitting flat. This is the detail
    // that makes it convincing.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    hp.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.01);
    g.gain.setValueAtTime(0.26, t + 0.51);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.81);
    src.connect(hp).connect(g).connect(o.sfx.out);

    const agc = ctx.createOscillator();
    agc.frequency.value = 3.2;
    const agcDepth = ctx.createGain();
    agcDepth.gain.value = 0.26 * 0.18;
    agc.connect(agcDepth).connect(g.gain);
    agc.start(t + Math.random() * 0.3);
    agc.stop(t + 0.85);

    src.start(t, Math.random());
    src.stop(t + 0.85);
    src.onended = () => g.disconnect();

    // The tuner trying twice and giving up. Nothing follows.
    for (const at of [0.12, 0.41]) {
      noise(o.sfx, {
        filter: { type: 'bandpass', hz: 900, hzTo: 600, q: 5 },
        env: { a: 0.003, d: 0.024, s: 0.001, r: 0.013, peak: 0.06 },
        when: t + at + rand(-0.03, 0.03),
      });
    }
  }

  /**
   * One programme ending and the next beginning on the same channel. The dip in
   * the bed IS the sound; the layers under it only give the dip an edge to hang
   * on. Nothing above 4 kHz — the ear orients to high-frequency onsets, so
   * stripping the top is what pushes this below conscious notice.
   */
  segmentChange() {
    const o = this.out;
    if (!o || !this.powered) return;
    const t = this.ctx!.currentTime;
    this.bed?.duck(0.72, 0.3);
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 1800, q: 0.9 },
      env: { a: 0.004, d: 0.05, s: 0.001, r: 0.04, peak: 0.045 },
      when: t,
    });
    tone(o.sfx, {
      type: 'sine',
      freq: 62,
      freqTo: 44,
      glide: 'lin',
      env: { a: 0.003, d: 0.06, s: 0.001, r: 0.03, peak: 0.05 },
      when: t + 0.008,
    });
  }

  /**
   * The output stage's DC operating point stepping: the cone is displaced and
   * relaxes back as the coupling capacitor recharges. Randomised per fire,
   * because this goes off on every channel change and every mute — a fixed
   * version becomes recognisably a sample within about six plays.
   */
  private speakerPop(when: number, on: boolean) {
    const o = this.out;
    if (!o || !this.ctx) return;
    // The coupling capacitor cannot recharge in under 40ms; coalesce fast
    // toggles into one pop rather than machine-gunning.
    if (when - this.lastPopAt < 0.04) return;
    this.lastPopAt = when;

    const body = (on ? 96 : 78) * rand(0.93, 1.07);
    tone(o.sfx, {
      type: 'sine',
      freq: body,
      freqTo: body * 0.54,
      glide: 'lin',
      filter: { type: 'lowpass', hz: 300, q: 0.8 },
      env: { a: 0.001, d: 0.055, s: 0.001, r: 0.03, peak: (on ? 0.095 : 0.075) * rand(0.88, 1.12) },
      when,
    });
    // The cone tick. Omit it and the whole thing reads as a synth blip rather
    // than as a loudspeaker.
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 2900 + rand(-400, 400), q: 2.2 },
      env: { a: 0.00025, d: 0.0035, s: 0.001, r: 0.003, peak: 0.028 },
      when,
    });
  }

  // ---- channel beds ---------------------------------------------------------

  private startBed(slug: string) {
    const o = this.out;
    if (!o) return;
    const spec: BedSpec | undefined = BED_SPECS[slug];
    if (!spec) return;
    this.bed?.stop();
    this.bed = new Bed(o.bed, spec);
  }

  /** Start the bed for the channel already tuned, without the tuning sequence. */
  resumeBed(slug: string) {
    if (!this.powered) return;
    this.bedSlug = slug;
    this.startBed(slug);
  }

  // ---- remote and on-screen controls ----------------------------------------

  /**
   * A rubber-dome remote button: cheap, quite dead, under 30ms. The character is
   * entirely in the noise band around 2.6 kHz — anything with a discernible tone
   * reads as a UI beep, which is exactly what this must not be.
   */
  keypad() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    // Randomised per press, so twenty in a row never repeat the same timbre.
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 2600 + Math.random() * 500, q: 1.6 },
      env: { a: 0.001, d: 0.014, s: 0.001, r: 0.012, peak: 0.14 },
      when: t,
    });
    // Square, not sine: the odd harmonics read as cheap moulded plastic. It
    // glides an octave in 20ms, far too fast to hear as a pitch.
    tone(o.sfx, {
      type: 'square',
      freq: 320,
      freqTo: 150,
      glide: 'lin',
      env: { a: 0.001, d: 0.02, s: 0.001, r: 0.012, peak: 0.035 },
      when: t,
    });
    // The contact actually making.
    noise(o.sfx, {
      filter: { type: 'highpass', hz: 5000, q: 0.5 },
      env: { a: 0.0005, d: 0.006, s: 0.001, r: 0.004, peak: 0.05 },
      when: t + 0.006,
    });
  }

  /**
   * The bigger rocker: lower, duller, longer. The defining difference from the
   * keypad is the *absence* of the high tick — nothing above 3 kHz, and no
   * oscillator anywhere. That omission is the entire distinction.
   */
  rocker() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 1500 + Math.random() * 260, q: 1.1 },
      env: { a: 0.002, d: 0.026, s: 0.001, r: 0.02, peak: 0.11 },
      when: t,
    });
    noise(o.sfx, {
      filter: { type: 'lowpass', hz: 700, q: 0.7 },
      env: { a: 0.003, d: 0.032, s: 0.001, r: 0.022, peak: 0.06 },
      when: t,
    });
  }

  /**
   * A dry mechanical notch. Running the volume up has to feel like going up
   * without ever sounding like a scale, so the pitch motion lives in a bandpass
   * centre rather than an oscillator: the ear hears the band brighten, but there
   * is no fundamental to land on a scale degree.
   *
   * Peak gain very slightly *falls* as level rises — the brightening already
   * carries the direction, and tracking gain would make the top of the range
   * painful.
   */
  volumeDetent(level: number) {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;

    // At an end stop the travel has finished, so the sound must stop implying
    // motion.
    if (level <= 0 || level >= 1) {
      noise(o.sfx, {
        filter: { type: 'lowpass', hz: 400, q: 0.7 },
        env: { a: 0.002, d: 0.04, s: 0.001, r: 0.02, peak: 0.09 },
        when: t,
      });
      return;
    }

    noise(o.sfx, {
      filter: {
        type: 'bandpass',
        hz: (900 + level * 2400) * rand(0.97, 1.03),
        q: 2.6 + level * 1.2,
      },
      env: { a: 0.001, d: 0.022, s: 0.001, r: 0.015, peak: 0.14 - level * 0.02 },
      when: t,
    });
  }

  /**
   * Mute and unmute are distinguished by contour and by release time, not by
   * melody. The restore is deliberately slower than the cut, because a real
   * muting circuit charges back through a resistor — that asymmetry is most of
   * what makes the pair legible as a pair.
   */
  muteToggle(muted: boolean) {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    this.speakerPop(t, !muted);
    // Continuous glide, never a held frequency, so it cannot read as a note.
    tone(o.sfx, {
      type: 'sine',
      freq: muted ? 760 : 560,
      freqTo: muted ? 470 : 780,
      env: { a: 0.004, d: 0.07, s: 0.001, r: 0.05, peak: 0.06 },
      when: t + 0.02,
    });
    // Grit, so the sine is never heard as a pure tone.
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: 3000, q: 1.5 },
      env: { a: 0.002, d: 0.025, s: 0.001, r: 0.015, peak: 0.03 },
      when: t + 0.02,
    });
  }

  /**
   * The most electronic sound in the set and, by design, the quietest. Mute has
   * body; captions has none, and that is the distinction. The two blips sit at a
   * ratio of about 1.42 — deliberately missing a fifth (1.5) and a fourth
   * (1.33), landing near a tritone, which refuses to resolve and so never
   * sounds like a jingle.
   */
  captionsToggle(on: boolean) {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    const pair = on ? [900, 1280] : [1100, 720];
    pair.forEach((hz, i) => {
      tone(o.sfx, {
        type: 'square',
        freq: hz,
        filter: { type: 'lowpass', hz: 4500, q: 0.5 },
        env: { a: 0.002, d: 0.028, s: 0.001, r: 0.015, peak: 0.045 },
        when: t + i * 0.055,
      });
    });
  }

  /**
   * A menu arriving into the raster. Open and close use inverse contours, but
   * deliberately not mirrored structures — things paint in, they blank out. The
   * three-hit stutter on open (character rows painting) is what dates it to the
   * right decade, and dropping it on close is what stops the pair sounding like
   * one sound played backwards.
   */
  guide(open: boolean) {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    noise(o.sfx, {
      filter: { type: 'bandpass', hz: open ? 700 : 2200, hzTo: open ? 2600 : 620, q: 2 },
      env: { a: 0.01, d: open ? 0.1 : 0.09, s: 0.001, r: open ? 0.06 : 0.05, peak: 0.1 },
      when: t,
    });
    // Triangle rather than sine: enough harmonic content to sit inside the
    // noise instead of floating above it as a tone.
    tone(o.sfx, {
      type: 'triangle',
      freq: open ? 420 : 620,
      freqTo: open ? 640 : 400,
      env: { a: 0.006, d: 0.09, s: 0.001, r: 0.05, peak: 0.06 },
      when: t,
    });

    if (open) {
      for (const at of [0.04, 0.058, 0.074]) {
        noise(o.sfx, {
          filter: { type: 'bandpass', hz: 3200, q: 4 },
          env: { a: 0.001, d: 0.003, s: 0.001, r: 0.002, peak: 0.035 },
          when: t + at,
        });
      }
    } else {
      noise(o.sfx, {
        filter: { type: 'lowpass', hz: 900, q: 0.7 },
        env: { a: 0.002, d: 0.025, s: 0.001, r: 0.012, peak: 0.05 },
        when: t + 0.01,
      });
    }
  }

  // ---- the Boring Edition ---------------------------------------------------
  //
  // Everything below is deliberately near-inaudible. This page is meant to feel
  // silent; the sounds are here to give it weight, not presence.
  //
  // There is deliberately no hover sound. Every other sound on the page
  // corresponds to something that physically moved — a dome collapsed, a switch
  // latched, a print head struck paper. Hover is the only one with no moving
  // part behind it.

  /** A jump to an anchor: a drawer divider dropping. Wood is mostly thud. */
  pageJump() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    tone(o.page, {
      type: 'triangle',
      freq: 220,
      freqTo: 150,
      glide: 'lin',
      filter: { type: 'lowpass', hz: 900, q: 0.7 },
      env: { a: 0.001, d: 0.032, s: 0.001, r: 0.018, peak: 0.028 },
      when: t,
    });
    noise(o.page, {
      rate: 0.8, // darker and grainier: cardboard, not glass
      filter: { type: 'bandpass', hz: 1800, q: 1.2 },
      env: { a: 0.0006, d: 0.014, s: 0.001, r: 0.008, peak: 0.02 },
      when: t,
    });
  }

  /**
   * One keystroke in the search box. This fires more than anything else on the
   * site, so it is the quietest thing on it and the design is defensive:
   * nothing above 3 kHz (the moment there is, it becomes a mechanical keyboard
   * and unbearable), randomised per press, and rate-limited so a held key or a
   * paste cannot machine-gun it.
   */
  keystroke(key?: string) {
    const o = this.out;
    if (!o || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastKeyAt < 0.035) return;
    this.lastKeyAt = t;

    // The space bar is bigger and stabiliser-damped. It is the only key that
    // should sound different; anything more becomes a performance.
    const space = key === ' ';
    noise(o.page, {
      rate: 0.7,
      filter: { type: 'lowpass', hz: space ? 700 : 1400, q: 0.9 },
      env: { a: 0.0005, d: 0.009, s: 0.001, r: 0.006, peak: 0.012 * rand(0.8, 1.2) * (space ? 1.15 : 1) },
      when: t,
    });
    // Sine, not triangle: triangle harmonics poke through the mix on repeats.
    tone(o.page, {
      type: 'sine',
      freq: (space ? 128 : 170) * rand(0.94, 1.06),
      filter: { type: 'lowpass', hz: 400, q: 0.7 },
      env: { a: 0.001, d: 0.022, s: 0.001, r: 0.01, peak: 0.009 * rand(0.8, 1.2) },
      when: t,
    });
  }

  /**
   * A search that matched nothing. Emphatically not an error sound — no
   * descending minor third, no buzzer. The reader did nothing wrong; they asked
   * for a book that is not here. A wooden stop absorbing, and then nothing.
   */
  searchEmpty() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    tone(o.page, {
      type: 'triangle',
      freq: 130,
      freqTo: 118, // a 12 Hz droop; more than about two semitones is editorial
      glide: 'lin',
      filter: { type: 'lowpass', hz: 520, q: 0.6 },
      env: { a: 0.003, d: 0.06, s: 0.001, r: 0.04, peak: 0.02 },
      when: t,
    });
    noise(o.page, {
      rate: 0.6,
      filter: { type: 'lowpass', hz: 900, q: 0.7 },
      env: { a: 0.002, d: 0.025, s: 0.001, r: 0.015, peak: 0.01 },
      when: t,
    });
  }

  /**
   * The print button. What it should sound like is not the button — which is
   * plastic and boring — but the thing it summons: a solenoid picking up and a
   * motor spinning and immediately stopping. Kept under 250ms, because the print
   * dialog takes the screen about a frame later.
   */
  print() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    noise(o.page, {
      filter: { type: 'bandpass', hz: 1500, q: 1.6 },
      env: { a: 0.0005, d: 0.013, s: 0.001, r: 0.007, peak: 0.05 },
      when: t,
    });
    tone(o.page, {
      type: 'sine',
      freq: 150,
      filter: { type: 'lowpass', hz: 400, q: 0.7 },
      env: { a: 0.001, d: 0.03, s: 0.001, r: 0.015, peak: 0.035 },
      when: t,
    });
    // The resonant Q is doing the work here: a peak riding up with the pitch is
    // exactly the gear-mesh formant of a cheap laser engine.
    tone(o.page, {
      type: 'sawtooth',
      freq: 62,
      freqTo: 88,
      filter: { type: 'lowpass', hz: 600, q: 3 },
      env: { a: 0.025, hold: 0.09, r: 0.045, peak: 0.03 },
      when: t + 0.06,
    });
  }

  /**
   * One line of the boot sequence. A dot-matrix line is a burst, not a click —
   * the head travels and strikes repeatedly, and the paper feed follows.
   */
  bootLine(index: number, strikes = 4) {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < strikes; i++) {
      const at = t + i * 0.011 + rand(-0.003, 0.003);
      noise(o.page, {
        filter: { type: 'bandpass', hz: 2200, q: 2.8 },
        env: { a: 0.0003, d: 0.007, s: 0.001, r: 0.004, peak: 0.035 * rand(0.75, 1.25) },
        when: at,
      });
      // The pin arriving at the platen through the paper.
      tone(o.page, {
        type: 'sine',
        freq: 320,
        filter: { type: 'lowpass', hz: 900, q: 0.7 },
        env: { a: 0.0005, d: 0.009, s: 0.001, r: 0.005, peak: 0.02 },
        when: at,
      });
    }
    void index;
    this.paperAdvance(t + 0.048);
  }

  /** The blank line in the boot sequence gets the feed and no strikes. */
  paperAdvance(when?: number) {
    const o = this.out;
    if (!o) return;
    noise(o.page, {
      rate: 0.5,
      filter: { type: 'lowpass', hz: 700, q: 0.7 },
      env: { a: 0.006, hold: 0.018, r: 0.022, peak: 0.012 },
      when: when ?? this.ctx!.currentTime,
    });
  }

  /**
   * The boot sequence's tuner sweep. The character lives entirely in the
   * unevenness — a regular grid of identical locks sounds like a step
   * sequencer. A real aerial finds three strong stations, four weak ones, and
   * a lot of nothing.
   */
  tunerSweep() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;

    noise(o.page, {
      rate: 0.9,
      filter: { type: 'bandpass', hz: 480, hzTo: 3400, q: 1.4 },
      env: { a: 0.06, hold: 0.64, r: 0.12, peak: 0.045 },
      when: t,
    });
    noise(o.page, {
      filter: { type: 'lowpass', hz: 300, q: 0.5 },
      env: { a: 0.06, hold: 0.66, r: 0.12, peak: 0.02 },
      when: t,
    });

    // Twelve stations, matching the "12 CHANNELS FOUND" on screen. Uneven on
    // purpose, with three strong and four weak.
    const locks: [number, number][] = [
      [0.08, 1], [0.132, 0.5], [0.205, 1.8], [0.24, 0.5],
      [0.318, 1], [0.395, 1], [0.43, 1.8], [0.508, 0.5],
      [0.585, 1], [0.64, 0.5], [0.715, 1.8], [0.79, 1],
    ];
    for (const [at, strength] of locks) {
      const when = t + at + rand(-0.008, 0.008);
      tone(o.page, {
        type: 'sine',
        freq: 1950,
        env: { a: 0.002, d: 0.018, s: 0.001, r: 0.01, peak: strength * 0.012 },
        when,
      });
      // Q of 6 gives the hollow "locked" colour.
      noise(o.page, {
        filter: { type: 'bandpass', hz: 900, q: 6 },
        env: { a: 0.003, hold: 0.012, r: 0.014, peak: strength * 0.02 },
        when,
      });
    }

    // AGC settling on the last lock, then silence. The sudden quiet is what
    // makes it read as "found".
    tone(o.page, {
      type: 'sine',
      freq: 90,
      filter: { type: 'lowpass', hz: 250, q: 0.7 },
      env: { a: 0.004, d: 0.09, s: 0.001, r: 0.05, peak: 0.03 },
      when: t + 0.79,
    });
  }

  /**
   * Clicking through to the television — the only genuinely one-way action the
   * quiet page offers, and the one sound on it allowed to be a real gesture. A
   * latching switch going over centre, then iron taking the load.
   */
  modeSwitch() {
    const o = this.out;
    if (!o) return;
    const t = this.ctx!.currentTime;

    noise(o.page, {
      filter: { type: 'bandpass', hz: 2600, q: 2.2 },
      env: { a: 0.0004, d: 0.011, s: 0.001, r: 0.006, peak: 0.09 },
      when: t,
    });
    tone(o.page, {
      type: 'triangle',
      freq: 190,
      freqTo: 140,
      glide: 'lin',
      filter: { type: 'lowpass', hz: 700, q: 0.8 },
      env: { a: 0.001, d: 0.045, s: 0.001, r: 0.025, peak: 0.11 },
      when: t + 0.018,
    });
    // Contacts make and the transformer takes load. The detune makes the two
    // voices beat slowly against each other — real iron is never clean, and the
    // beat is what sells it as a transformer rather than an oscillator.
    tone(o.page, {
      type: 'sine',
      freq: MAINS_HZ,
      filter: { type: 'lowpass', hz: 400, q: 0.7 },
      env: { a: 0.04, hold: 0.09, r: 0.18, peak: 0.05 },
      when: t + 0.055,
    });
    tone(o.page, {
      type: 'sine',
      freq: MAINS_HZ * 1.5,
      detune: 7,
      filter: { type: 'lowpass', hz: 400, q: 0.7 },
      env: { a: 0.04, hold: 0.09, r: 0.18, peak: 0.05 },
      when: t + 0.055,
    });
  }

  // ---- teardown -------------------------------------------------------------

  dispose() {
    this.bed?.stop();
    this.bed = null;
    for (const n of this.running) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.running = [];
    try {
      void this.ctx?.close();
    } catch {
      /* already torn down */
    }
    this.ctx = null;
  }
}

export const tvAudio = new TvAudio();
