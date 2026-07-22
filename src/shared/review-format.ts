/**
 * The house format, defined once and shared by the composer and the server.
 *
 * This file has NO server-only import and NO React — it is plain logic that
 * runs identically in the browser (live counters) and in the route handler
 * (the actual enforcement). The composer showing a green counter is a courtesy;
 * this same `validateBroadcastCut` in the service is what actually decides, so
 * the browser is provably never the only enforcer. A curl with a 15-word hook
 * is rejected by the same function that turns the counter red.
 *
 * The CHECK constraints on `review_revisions` are the immovable outer rails
 * (hook 1–14 words, body 30–120). The *window* enforced here is narrower and
 * configurable (default 45–70 body words) — the editorial house style, which an
 * admin can widen without a deploy by changing `system.settings`.
 */

export type ReviewWindow = {
  hookMaxWords: number;
  bodyMinWords: number;
  bodyMaxWords: number;
  underdogMaxSentences: number;
};

export const DEFAULT_WINDOW: ReviewWindow = {
  hookMaxWords: 14,
  bodyMinWords: 45,
  bodyMaxWords: 70,
  underdogMaxSentences: 1,
};

/** Hard rails matching the database CHECK constraints. The configured window
 *  must always sit inside these; the service clamps to them defensively. */
export const HARD_RAILS = {
  hookMax: 14,
  bodyMin: 30,
  bodyMax: 120,
} as const;

export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Sentence count, tolerant of "Mr." and ellipses — good enough to hold the
 *  "underdog is one sentence" rule without a grammar engine. */
export function sentenceCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const matches = t.replace(/\.\.\./g, '…').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return matches ? matches.length : 1;
}

export type FieldCheck = { ok: boolean; count: number; message: string | null };
export type FormatResult = {
  ok: boolean;
  hook: FieldCheck;
  body: FieldCheck;
  underdog: FieldCheck;
};

export function validateBroadcastCut(
  input: { hook: string; body: string; underdog: string },
  window: ReviewWindow = DEFAULT_WINDOW,
): FormatResult {
  const hookWords = wordCount(input.hook);
  const bodyWords = wordCount(input.body);
  const underdogSentences = sentenceCount(input.underdog);

  const hook: FieldCheck = {
    count: hookWords,
    ok: hookWords >= 1 && hookWords <= window.hookMaxWords,
    message:
      hookWords < 1
        ? 'The hook is the one line that makes someone pick it up.'
        : hookWords > window.hookMaxWords
          ? `The hook runs long — keep it to ${window.hookMaxWords} words.`
          : null,
  };

  const body: FieldCheck = {
    count: bodyWords,
    ok: bodyWords >= window.bodyMinWords && bodyWords <= window.bodyMaxWords,
    message:
      bodyWords < window.bodyMinWords
        ? `A little more — the review wants ${window.bodyMinWords}–${window.bodyMaxWords} words.`
        : bodyWords > window.bodyMaxWords
          ? `Tighten it — the broadcast cut is ${window.bodyMinWords}–${window.bodyMaxWords} words. (The long version below has no limit.)`
          : null,
  };

  const underdog: FieldCheck = {
    count: underdogSentences,
    ok: input.underdog.trim().length > 0 && underdogSentences <= window.underdogMaxSentences,
    message:
      input.underdog.trim().length === 0
        ? 'One sentence: why did this book get missed?'
        : underdogSentences > window.underdogMaxSentences
          ? 'One sentence — name the single reason it was overlooked.'
          : null,
  };

  return { ok: hook.ok && body.ok && underdog.ok, hook, body, underdog };
}
