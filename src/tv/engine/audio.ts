/**
 * CRT sound design, synthesised. No audio files ship with this site.
 *
 * A television you can't hear is a picture of a television. The flyback whine in
 * particular does more for the illusion than any shader — it is the sound
 * everyone born before 2005 associates with "a TV is on in this room".
 *
 * Everything is gated behind a user gesture (`unlock`), because browsers require
 * it and because a page that makes noise before you touch it is rude.
 */

export class TvAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private whineOsc: OscillatorNode | null = null;
  private whineGain: GainNode | null = null;
  private hissSource: AudioBufferSourceNode | null = null;
  private hissGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private enabled = false;

  /** Must be called from inside a user gesture. */
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

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // ---- white noise buffer, reused by every hiss ----
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    // ---- the 15.7kHz flyback whine ----
    // Real NTSC line frequency. Most adults cannot hear it; the ones who can
    // will feel oddly at home.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 15734;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0;
    osc.connect(oscGain).connect(master);
    osc.start();
    this.whineOsc = osc;
    this.whineGain = oscGain;

    // ---- continuous low room hiss, sitting under everything ----
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2400;
    hp.Q.value = 0.4;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(hp).connect(hissGain).connect(master);
    hiss.start();
    this.hissSource = hiss;
    this.hissGain = hissGain;

    this.enabled = true;
  }

  private now() {
    return this.ctx?.currentTime ?? 0;
  }

  setVolume(v: number, muted: boolean) {
    if (!this.master || !this.ctx) return;
    const target = muted ? 0 : Math.min(1, Math.max(0, v));
    this.master.gain.cancelScheduledValues(this.now());
    this.master.gain.setTargetAtTime(target, this.now(), 0.05);
  }

  /** Called when the set is switched on or off. */
  setPower(on: boolean) {
    if (!this.enabled || !this.ctx) return;
    const t = this.now();
    if (on) {
      this.thunk();
      this.whineGain?.gain.setTargetAtTime(0.012, t + 0.15, 0.4);
      this.hissGain?.gain.setTargetAtTime(0.02, t + 0.15, 0.5);
    } else {
      this.whineGain?.gain.setTargetAtTime(0, t, 0.08);
      this.hissGain?.gain.setTargetAtTime(0, t, 0.08);
      this.collapse();
    }
  }

  /** Low-frequency thump of the tube coming alive. */
  private thunk() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);

    // degauss shimmer
    const d = ctx.createOscillator();
    d.type = 'triangle';
    d.frequency.setValueAtTime(70, t);
    const dg = ctx.createGain();
    dg.gain.setValueAtTime(0.0001, t);
    dg.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
    dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 26;
    lfo.connect(lfoGain).connect(d.frequency);
    lfo.start(t);
    lfo.stop(t + 0.8);
    d.connect(dg).connect(this.master);
    d.start(t);
    d.stop(t + 0.8);
  }

  /** The picture collapsing to a dot. */
  private collapse() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  /** Burst of tuning noise during a channel change. */
  staticBurst(durationSec = 0.42) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(4800, t + durationSec);
    filter.Q.value = 0.6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + durationSec + 0.05);
  }

  /** Remote button. Two flavours so a keypad run doesn't sound like a metronome. */
  click(soft = false) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(soft ? 1500 : 2100, t);
    osc.frequency.exponentialRampToValueAtTime(soft ? 600 : 900, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(soft ? 0.05 : 0.09, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** Short confirmation blip, e.g. captions toggled. */
  blip(up = true) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(up ? 620 : 820, t);
    osc.frequency.linearRampToValueAtTime(up ? 880 : 500, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  dispose() {
    try {
      this.whineOsc?.stop();
      this.hissSource?.stop();
      void this.ctx?.close();
    } catch {
      /* already torn down */
    }
    this.ctx = null;
    this.enabled = false;
  }
}

export const tvAudio = new TvAudio();
