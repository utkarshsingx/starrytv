/**
 * The power transitions.
 *
 * Both are keyframe timelines rather than eased interpolations, because neither
 * is a simple move. Switching a CRT off is a sequence with a hold in the middle
 * (line, then dot, then a pause on the dot while the phosphor gives up), and
 * switching one on overshoots before it settles, because magnetic deflection is
 * a physical system with momentum and it rings.
 *
 * Timings and shapes follow the CSS keyframes in jesseweb.com's CRT (MIT,
 * Jesse M. Torres), reimplemented against our shader uniforms so the animation
 * happens inside the tube — picking up the barrel warp, the aperture grille and
 * the vignette — rather than as a DOM element sitting on top of the glass.
 */

export type PowerFrame = {
  /** Raster geometry. [1, 1] is a normal picture. */
  scale: [number, number];
  /** Additive white bloom. */
  flash: number;
  /** Overall brightness multiplier. */
  bright: number;
};

type Key = { t: number } & PowerFrame;

/**
 * Switching on. The raster snaps open from a horizontal line, blows out bright
 * as the beam current surges, overshoots, and rings down to square. The colour
 * wobble on a real set comes from the shadow mask still being magnetised; here
 * the brightness overshoot carries it.
 */
const ON: Key[] = [
  { t: 0.0, scale: [1.04, 0.002], flash: 0.85, bright: 2.4 },
  { t: 0.18, scale: [0.97, 1.05], flash: 0.16, bright: 1.7 },
  { t: 0.4, scale: [1.02, 0.98], flash: 0.04, bright: 1.22 },
  { t: 0.7, scale: [0.995, 1.005], flash: 0.0, bright: 1.06 },
  { t: 1.0, scale: [1, 1], flash: 0, bright: 1.06 },
];

/**
 * Switching off. Collapse to a line, then to a dot, hold on the dot, then let
 * the phosphor fade. The hold is what makes it read as a dying tube rather than
 * as something being scaled to zero.
 */
const OFF: Key[] = [
  { t: 0.0, scale: [1, 1], flash: 0.0, bright: 1.06 },
  { t: 0.28, scale: [1, 0.006], flash: 1.15, bright: 1.4 },
  { t: 0.55, scale: [0.012, 0.006], flash: 0.9, bright: 1.4 },
  { t: 0.75, scale: [0.012, 0.006], flash: 0.42, bright: 1.2 },
  { t: 1.0, scale: [0.002, 0.002], flash: 0.0, bright: 1.0 },
];

export const POWER_ON_SEC = 0.9;
export const POWER_OFF_SEC = 1.1;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function sample(keys: Key[], k: number): PowerFrame {
  const t = Math.min(1, Math.max(0, k));
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t < t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  const f = span <= 0 ? 0 : (t - a.t) / span;
  return {
    scale: [lerp(a.scale[0], b.scale[0], f), lerp(a.scale[1], b.scale[1], f)],
    flash: lerp(a.flash, b.flash, f),
    bright: lerp(a.bright, b.bright, f),
  };
}

/**
 * Where the tube is right now.
 *
 * `sinceSwitch` is seconds since the power state last changed. Once a transition
 * has run its course this settles on a steady state, so the caller can keep
 * asking without tracking whether the animation has finished.
 */
export function powerFrame(powered: boolean, sinceSwitch: number): PowerFrame {
  if (powered) {
    if (sinceSwitch >= POWER_ON_SEC) return { scale: [1, 1], flash: 0, bright: 1.06 };
    return sample(ON, sinceSwitch / POWER_ON_SEC);
  }
  if (sinceSwitch >= POWER_OFF_SEC) return { scale: [0.002, 0.002], flash: 0, bright: 1 };
  return sample(OFF, sinceSwitch / POWER_OFF_SEC);
}
