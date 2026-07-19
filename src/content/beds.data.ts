import type { BedSpec } from '../tv/engine/audio/bed';

/**
 * CHANNEL AMBIENT BEDS. The third content file.
 *
 * Each channel has a continuous sound of its own, so that turning the dial is
 * an audible event and not only a visual one. These are specs, not code — see
 * `src/tv/engine/audio/bed.ts` for what each layer type does and which
 * parameters it reads.
 *
 * The rule every one of these obeys: it plays underneath text that people are
 * reading. It has to be possible to forget it is there. If you are tuning one
 * and cannot decide, the answer is quieter and slower.
 *
 * Two things worth knowing before editing:
 *
 *   - Repeat intervals across a bed are deliberately coprime (13s against 26s
 *     against a 20s filter LFO), and the engine jitters each one, so no two
 *     layers line up twice. Round them all to multiples of four and you will
 *     hear a bar line, which is the thing that becomes unbearable.
 *   - `pulse` is the one layer that ignores the scale — it takes a literal
 *     `freq`. Retune the root and you must retune any pulse by hand, or it
 *     will sit at some arbitrary interval underneath everything else.
 */

export const BED_SPECS: Record<string, BedSpec> = {
  // A high-ceilinged room after midnight with one lamp on — the air itself is humming faintly, something glass chimes far off every so often, and nobody is in a hurry to turn the page.
  poetry: {
    character: "A high-ceilinged room after midnight with one lamp on — the air itself is humming faintly, something glass chimes far off every so often, and nobody is in a hurry to turn the page.",
    rootHz: 98,
    scale: [0, 2, 3, 7, 10],
    overallGain: 0.085,
    layers: [
      { type: "drone", gain: 0.2, waveform: "triangle", detuneCents: 7, filterType: "lowpass", filterHz: 420, filterQ: 0.7, lfoHz: 0.05, lfoDepth: 140 },
      { type: "noise", gain: 0.035, filterType: "lowpass", filterHz: 700, filterQ: 0.5, lfoHz: 0.03, lfoDepth: 220 },
      { type: "pad", gain: 0.07, waveform: "triangle", filterHz: 900, filterQ: 0.6, chord: [3,5,7], attack: 3, release: 6.5, everyNoteSec: 26 },
      { type: "bell", gain: 0.07, degrees: [2,4,5,6], octave: 1, decay: 4.5, everyNoteSec: 15, ratio: 3.5, index: 120 },
    ],
  },

  // Sitting in the fourth row of an empty auditorium twenty minutes early, house lights at half, warm air moving, something mechanical idling behind the wall — nothing has started yet and nothing is going to hurry.
  cinema: {
    character: "Sitting in the fourth row of an empty auditorium twenty minutes early, house lights at half, warm air moving, something mechanical idling behind the wall — nothing has started yet and nothing is going to hurry.",
    rootHz: 87.31,
    scale: [0, 2, 4, 5, 7, 9],
    overallGain: 0.085,
    layers: [
      { type: "drone", gain: 0.22, waveform: "triangle", detuneCents: 7, filterType: "lowpass", filterHz: 320, filterQ: 0.7, lfoHz: 0.05, lfoDepth: 90 },
      { type: "noise", gain: 0.042, filterType: "bandpass", filterHz: 262, filterQ: 1.6, lfoHz: 0.07, lfoDepth: 110 },
      { type: "bell", gain: 0.09, degrees: [0,2,3], octave: 1, decay: 4.5, everyNoteSec: 13, ratio: 2, index: 120 },
      { type: "sweep", gain: 0.045, everySec: 15, fromHz: 90, toHz: 260, durationSec: 7 },
    ],
  },

  // A record shop at closing time with the dub plate still spinning in the back room — warm, weightless, a bassline you feel in the desk more than hear, and one muffled melodica note drifting off into a spring tank every few seconds.
  music: {
    character: "A record shop at closing time with the dub plate still spinning in the back room — warm, weightless, a bassline you feel in the desk more than hear, and one muffled melodica note drifting off into a spring tank every few seconds.",
    rootHz: 110,
    scale: [0, 2, 3, 5, 7, 10],
    overallGain: 0.095,
    layers: [
      { type: "drone", gain: 0.18, waveform: "triangle", detuneCents: 6, filterType: "lowpass", filterHz: 240, filterQ: 1.1, lfoHz: 0.05, lfoDepth: 70 },
      { type: "pulse", gain: 0.1, decay: 0.38, everyNoteSec: 1.85, freq: 55 },
      { type: "pluck", gain: 0.09, waveform: "sawtooth", filterHz: 1100, degrees: [0,2,4,5,7], octave: 1, decay: 1.1, everyNoteSec: 2.9 },
      { type: "noise", gain: 0.022, filterType: "bandpass", filterHz: 1600, filterQ: 0.7, lfoHz: 0.05, lfoDepth: 320 },
    ],
  },

  // Sitting in an open doorway twenty minutes after sunrise with a mug going cold — the field is awake before you are, and none of it is performing for you.
  critters: {
    character: "Sitting in an open doorway twenty minutes after sunrise with a mug going cold — the field is awake before you are, and none of it is performing for you.",
    rootHz: 98,
    scale: [0, 2, 4, 7, 10],
    overallGain: 0.09,
    layers: [
      { type: "drone", gain: 0.16, waveform: "triangle", detuneCents: 7, filterType: "lowpass", filterHz: 420, filterQ: 0.7, lfoHz: 0.047, lfoDepth: 130 },
      { type: "noise", gain: 0.035, filterType: "bandpass", filterHz: 3400, filterQ: 2.2, lfoHz: 0.11, lfoDepth: 900 },
      { type: "pluck", gain: 0.085, waveform: "triangle", filterHz: 1500, degrees: [0,1,2,4,5], octave: 1, decay: 0.5, everyNoteSec: 5.5 },
      { type: "sweep", gain: 0.028, everySec: 37, fromHz: 260, toHz: 1500, durationSec: 5 },
    ],
  },

  // A nearly empty room at 1am with the chairs still down — warm amber low end, a brush circling a snare head out of habit, and a bass that plays about a third of the notes it's thinking about.
  latenight: {
    character: "A nearly empty room at 1am with the chairs still down — warm amber low end, a brush circling a snare head out of habit, and a bass that plays about a third of the notes it's thinking about.",
    rootHz: 82.41,
    scale: [0, 2, 3, 5, 7, 9, 10],
    overallGain: 0.1,
    layers: [
      { type: "drone", gain: 0.15, waveform: "triangle", detuneCents: 7, filterType: "lowpass", filterHz: 190, filterQ: 0.7, lfoHz: 0.05, lfoDepth: 55 },
      { type: "noise", gain: 0.034, filterType: "bandpass", filterHz: 3400, filterQ: 0.7, lfoHz: 0.09, lfoDepth: 700 },
      { type: "pluck", gain: 0.085, waveform: "triangle", filterHz: 420, degrees: [0,1,2,4,5,6], octave: 0, decay: 0.9, everyNoteSec: 3.2 },
      { type: "bell", gain: 0.065, degrees: [2,4,5,6], octave: 1, decay: 3.2, everyNoteSec: 14, ratio: 2, index: 120 },
    ],
  },

  // Standing at a window in an empty observatory at 3am — enormous, cold, completely calm, with something glittering very far away that has nothing to do with you.
  science: {
    character: "Standing at a window in an empty observatory at 3am — enormous, cold, completely calm, with something glittering very far away that has nothing to do with you.",
    rootHz: 73.42,
    scale: [0, 2, 4, 7, 9, 11],
    overallGain: 0.085,
    layers: [
      { type: "drone", gain: 0.18, waveform: "triangle", detuneCents: 9, filterType: "lowpass", filterHz: 460, filterQ: 1.1, lfoHz: 0.05, lfoDepth: 140 },
      { type: "pad", gain: 0.07, waveform: "triangle", filterHz: 820, filterQ: 0.7, chord: [3,6,7], attack: 3.5, release: 7, everyNoteSec: 23 },
      { type: "bell", gain: 0.09, degrees: [0,2,4], octave: 2, decay: 5, everyNoteSec: 13, ratio: 3, index: 180 },
      { type: "noise", gain: 0.03, filterType: "highpass", filterHz: 4800, filterQ: 0.5, lfoHz: 0.02, lfoDepth: 600 },
    ],
  },

  // A projector running in the next room over a reel nobody has labelled — warm, dust-flecked, slightly off-speed, with a music box somewhere in it that never quite gets to the end of the phrase.
  archive: {
    character: "A projector running in the next room over a reel nobody has labelled — warm, dust-flecked, slightly off-speed, with a music box somewhere in it that never quite gets to the end of the phrase.",
    rootHz: 97.2,
    scale: [0, 3, 5, 7, 10],
    overallGain: 0.09,
    layers: [
      { type: "drone", gain: 0.16, waveform: "triangle", detuneCents: 7, filterType: "lowpass", filterHz: 320, filterQ: 0.7, lfoHz: 0.071, lfoDepth: 90 },
      { type: "noise", gain: 0.045, filterType: "bandpass", filterHz: 1450, filterQ: 0.9, lfoHz: 0.13, lfoDepth: 380 },
      { type: "bell", gain: 0.07, degrees: [2,4,5,7], octave: 1, decay: 3.4, everyNoteSec: 9, ratio: 3.5, index: 180 },
      { type: "pulse", gain: 0.02, decay: 0.09, everyNoteSec: 0.34, freq: 48.6 },
    ],
  },

  // Being inside a 1962 supermarket commercial that has been running in the next room for eleven hours and has not once stopped smiling.
  adverts: {
    character: "Being inside a 1962 supermarket commercial that has been running in the next room for eleven hours and has not once stopped smiling.",
    rootHz: 146.83,
    scale: [0, 4, 7, 9, 11],
    overallGain: 0.075,
    layers: [
      { type: "drone", gain: 0.1, waveform: "triangle", detuneCents: 8, filterType: "lowpass", filterHz: 780, filterQ: 0.9, lfoHz: 0.24, lfoDepth: 240 },
      { type: "pluck", gain: 0.07, waveform: "square", filterHz: 1500, degrees: [0,2,3,4,5], octave: 1, decay: 0.3, everyNoteSec: 0.85 },
      { type: "pulse", gain: 0.055, decay: 0.16, everyNoteSec: 1.05, freq: 73.42 },
      { type: "bell", gain: 0.045, degrees: [4,5,6], octave: 1, decay: 2.4, everyNoteSec: 11, ratio: 3, index: 160 },
      { type: "noise", gain: 0.03, filterType: "bandpass", filterHz: 900, filterQ: 0.8 },
    ],
  },

  // A large wooden room two floors below street level, where the air itself is warm and slightly gold, someone turns a page four aisles away, and a clock you can't see marks a hour nobody is counting.
  library: {
    character: "A large wooden room two floors below street level, where the air itself is warm and slightly gold, someone turns a page four aisles away, and a clock you can't see marks a hour nobody is counting.",
    rootHz: 110,
    scale: [0, 2, 4, 7, 9],
    overallGain: 0.08,
    layers: [
      { type: "drone", gain: 0.2, waveform: "triangle", detuneCents: 6, filterType: "lowpass", filterHz: 320, filterQ: 0.7, lfoHz: 0.05, lfoDepth: 90 },
      { type: "noise", gain: 0.03, filterType: "lowpass", filterHz: 700, filterQ: 0.4, lfoHz: 0.04, lfoDepth: 220 },
      { type: "bell", gain: 0.085, degrees: [0,2,4,5], octave: 1, decay: 4.5, everyNoteSec: 19, ratio: 2.6, index: 110 },
      { type: "sweep", gain: 0.045, everySec: 26, fromHz: 200, toHz: 700, durationSec: 9 },
    ],
  },

  // Standing at a cold window at 4am watching weather happen to someone else — enveloping, unbothered, with no opinion about whether you stay.
  weather: {
    character: "Standing at a cold window at 4am watching weather happen to someone else — enveloping, unbothered, with no opinion about whether you stay.",
    rootHz: 92.5,
    scale: [0, 2, 5, 7, 10],
    overallGain: 0.085,
    layers: [
      { type: "drone", gain: 0.16, waveform: "sawtooth", detuneCents: 6, filterType: "lowpass", filterHz: 260, filterQ: 0.7, lfoHz: 0.045, lfoDepth: 130 },
      { type: "noise", gain: 0.055, filterType: "bandpass", filterHz: 230, filterQ: 1.4, lfoHz: 0.031, lfoDepth: 170 },
      { type: "noise", gain: 0.018, filterType: "bandpass", filterHz: 1500, filterQ: 0.8, lfoHz: 0.073, lfoDepth: 550 },
      { type: "bell", gain: 0.07, degrees: [2,3,4], octave: 2, decay: 3.2, everyNoteSec: 17, ratio: 3.5, index: 180 },
    ],
  },

  // Reading someone else's diary in a lilac room at dusk, while somewhere behind you the house quietly shifts its weight.
  shorts: {
    character: "Reading someone else's diary in a lilac room at dusk, while somewhere behind you the house quietly shifts its weight.",
    rootHz: 103.83,
    scale: [0, 2, 3, 8, 10],
    overallGain: 0.09,
    layers: [
      { type: "drone", gain: 0.16, waveform: "triangle", detuneCents: 11, filterType: "lowpass", filterHz: 420, filterQ: 1.6, lfoHz: 0.07, lfoDepth: 180 },
      { type: "pad", gain: 0.09, waveform: "triangle", filterHz: 900, filterQ: 0.7, chord: [7,11,14], attack: 3, release: 6.5, everyNoteSec: 19 },
      { type: "bell", gain: 0.05, degrees: [1,4,5], octave: 1, decay: 4.2, everyNoteSec: 22, ratio: 2.41, index: 140 },
      { type: "noise", gain: 0.03, filterType: "lowpass", filterHz: 700, filterQ: 0.5, lfoHz: 0.05, lfoDepth: 300 },
    ],
  },

  // A cold room at 4am with the set still on: a low hum you feel more than hear, air moving in the dark, and every twenty seconds or so a single soft line-up tone from a station that stopped broadcasting hours ago.
  signoff: {
    character: "A cold room at 4am with the set still on: a low hum you feel more than hear, air moving in the dark, and every twenty seconds or so a single soft line-up tone from a station that stopped broadcasting hours ago.",
    rootHz: 61.74,
    scale: [0, 7],
    overallGain: 0.06,
    layers: [
      { type: "drone", gain: 0.13, waveform: "triangle", detuneCents: 5, filterType: "lowpass", filterHz: 260, filterQ: 0.7, lfoHz: 0.03, lfoDepth: 90 },
      { type: "noise", gain: 0.03, filterType: "lowpass", filterHz: 800, filterQ: 0.5, lfoHz: 0.024, lfoDepth: 260 },
      { type: "bell", gain: 0.06, degrees: [1], octave: 3, decay: 1.4, everyNoteSec: 20, ratio: 1, index: 12 },
    ],
  },

};
