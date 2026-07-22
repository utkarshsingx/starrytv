import 'server-only';
import { sql } from './db/client';
import { DEFAULT_WINDOW, type ReviewWindow } from '../shared/review-format';

/**
 * Admin-editable settings, read from system.settings.
 *
 * The review word window lives here so it can be widened without a deploy. It is
 * read on submit (the enforcement) and exposed via /api/v1/settings/public (the
 * composer's live counter), so changing the one row moves both at once.
 *
 * Cached briefly in-process: this is read on every submit and every composer
 * load, and the value changes about never.
 */

let cache: { window: ReviewWindow; at: number } | null = null;
const TTL_MS = 60_000;

export async function getReviewWindow(): Promise<ReviewWindow> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.window;
  try {
    const [row] = await sql`select value from system.settings where key = ${'review.window'}`;
    // Defensive: a jsonb column normally reads back as an object, but tolerate a
    // string (an older double-encoded row) by parsing it, so one bad write can
    // never turn into character-indexed garbage spread over the defaults.
    let value = row?.value ?? {};
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { value = {}; }
    }
    const window: ReviewWindow = { ...DEFAULT_WINDOW, ...(value as Partial<ReviewWindow>) };
    cache = { window, at: Date.now() };
    return window;
  } catch {
    return DEFAULT_WINDOW;
  }
}

export function clearSettingsCache() {
  cache = null;
}
