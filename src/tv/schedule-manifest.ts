'use client';

import type { Channel, ScheduleManifest } from '../types';
import { MINIMAL_CHANNELS } from './minimal-schedule';

/**
 * Getting the dial into the browser.
 *
 * Three tiers, tried in this order and for this reason:
 *
 *  1. **Network.** The manifest is the station's own idea of what is on air, and
 *     broadcast determinism — everyone loading at the same second sees the same
 *     frame — only holds if everyone is working from the same schedule. So a
 *     fresh copy always wins, and a cached one is never preferred for speed.
 *  2. **localStorage.** For the reader on a train. A stale schedule shows the
 *     wrong programme, which is a small lie; a dead set shows nothing, which is
 *     a bigger one.
 *  3. **The bundled minimum.** Cannot fail, because it involves no I/O at all.
 *
 * The fetch is racing the boot sequence, which takes about 2.3 seconds — so in
 * practice tier 1 has already landed by the time the tube warms up and none of
 * this is visible.
 */

const STORAGE_KEY = 'starry.schedule.v1';
const FETCH_TIMEOUT_MS = 4000;

export type ScheduleSource = 'network' | 'cache' | 'minimal';
export type LoadedSchedule = { channels: Channel[]; source: ScheduleSource; revision: string };

function isUsable(m: unknown): m is ScheduleManifest {
  if (!m || typeof m !== 'object') return false;
  const c = (m as ScheduleManifest).channels;
  return Array.isArray(c) && c.length > 0 && c.every((ch) => Array.isArray(ch?.programmes));
}

function readCache(): ScheduleManifest | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUsable(parsed) ? parsed : null;
  } catch {
    // Private mode, a quota error, or somebody's extension. Not worth a branch.
    return null;
  }
}

function writeCache(manifest: ScheduleManifest): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
  } catch {
    // The cache is an optimisation for a future visit, never a correctness
    // requirement — failing to write one must not fail the boot.
  }
}

export async function loadSchedule(): Promise<LoadedSchedule> {
  // A hung request must not hold the set off air indefinitely. AbortSignal
  // rather than Promise.race so the socket is actually released.
  try {
    const res = await fetch('/schedule/current.json', {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-cache',
    });
    if (res.ok) {
      const manifest: unknown = await res.json();
      if (isUsable(manifest)) {
        writeCache(manifest);
        return { channels: manifest.channels, source: 'network', revision: manifest.revision };
      }
    }
  } catch {
    // Offline, timed out, blocked, or served something that is not a manifest.
    // Every one of those means: try the next tier.
  }

  const cached = readCache();
  if (cached) return { channels: cached.channels, source: 'cache', revision: cached.revision };

  return { channels: MINIMAL_CHANNELS, source: 'minimal', revision: 'minimal' };
}
