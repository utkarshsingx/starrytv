import type { ScheduleManifest } from '../types';
import { channels } from './channels';

/**
 * The schedule, serialised for the television.
 *
 * Server-only by construction: this is the only module that reaches both the
 * channel data and the manifest type, and nothing under `src/tv/` imports it.
 * That is what keeps `books.data.ts` and `programmes.data.ts` out of the client
 * bundle — the rule is enforced mechanically by the restricted-import lint rule
 * and checked by the bundle assertion in the Phase 1 exit criteria.
 */

/**
 * FNV-1a over the serialised channels. Not a security hash — it only has to
 * change when the content changes, and be stable when it does not, so a browser
 * holding a cached manifest can tell whether it is stale without re-parsing it.
 */
function revisionOf(json: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function buildManifest(): ScheduleManifest {
  const json = JSON.stringify(channels);
  return {
    revision: revisionOf(json),
    generatedAt: new Date().toISOString(),
    channels,
  };
}
