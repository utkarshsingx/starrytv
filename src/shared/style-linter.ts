/**
 * The house-style linter.
 *
 * It flags the tics that turn a review into jacket copy — "a haunting
 * meditation on", adjective stacks, exclamation marks, the second-person
 * marketing voice, "must-read". It is **advisory only**: it never blocks a
 * submission. It teaches the voice to the writer and gives the admin queue a
 * sort weight, so the reviews most likely to need an editor's eye float up.
 *
 * Plain shared logic, no imports — the composer runs it live to coach as you
 * type, the server runs it to attach the report to the revision.
 */

export type StyleFlag = { rule: string; message: string; span?: string };
export type StyleReport = { flags: StyleFlag[]; score: number };

const CLICHES = [
  'a haunting meditation',
  'a tour de force',
  'a searing portrait',
  'a masterful',
  'unputdownable',
  'a must-read',
  'must read',
  'page-turner',
  'a rollercoaster',
  'lyrical prose',
  'beautifully written',
  'a triumph',
  'a revelation',
  'gripping from the first page',
  'kept me on the edge of my seat',
];

export function lintStyle(text: string): StyleReport {
  const flags: StyleFlag[] = [];
  const lower = text.toLowerCase();

  for (const phrase of CLICHES) {
    if (lower.includes(phrase)) {
      flags.push({ rule: 'cliche', message: `"${phrase}" is jacket copy — say what the book actually does.`, span: phrase });
    }
  }

  // Exclamation marks — the register is dry.
  const bangs = (text.match(/!/g) || []).length;
  if (bangs > 0) {
    flags.push({ rule: 'exclamation', message: `${bangs} exclamation mark${bangs > 1 ? 's' : ''} — the house voice is deadpan.` });
  }

  // Second-person marketing register: "you will love / you won't be able to".
  if (/\byou('| wi)?ll\b|\byou won't\b|\byou need to\b/i.test(text)) {
    flags.push({ rule: 'second-person', message: 'Addressing the reader ("you will love…") reads as an ad. Describe the book, not their reaction.' });
  }

  // Adjective stacks: three+ adjectives in a row before a noun, roughly.
  const stack = text.match(/\b(\w+ly\s+)?(\w+,?\s+){2,}(\w+)\s+(novel|book|story|read|prose|writing)\b/i);
  if (stack) {
    flags.push({ rule: 'adjective-stack', message: 'An adjective pile-up — pick the one that earns its place.', span: stack[0] });
  }

  // "in this book/novel, the author…" — throat-clearing.
  if (/\bin this (book|novel|story)\b/i.test(text)) {
    flags.push({ rule: 'throat-clearing', message: 'Skip "in this book…" — we know it is the book.' });
  }

  // Score: higher = more to look at. Purely a queue-sort weight.
  const score = flags.length + bangs * 0.5;
  return { flags, score };
}
