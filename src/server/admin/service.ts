import 'server-only';
import { sql } from '../db/client';
import * as repo from './repo';
import { transition } from '../ugc/transition';
import { clearSettingsCache } from '../settings';
import { badRequest } from '../auth/errors';
import { DEFAULT_WINDOW } from '../../shared/review-format';

/**
 * Admin mutations. Every one writes a system.audit_logs row through
 * `recordAudit`, so the console can answer "who changed this, and why" for any
 * action. No admin action is ever unrecoverable — status changes are reversible,
 * removals are soft, and the audit row is permanent.
 */

type Actor = { id: string; role: 'admin' };

// ─── users ───────────────────────────────────────────────────────────────────

export async function setUserStatus(actor: Actor, userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
  if (userId === actor.id) throw badRequest('SELF', 'You cannot suspend your own account.');
  await sql`update public.users set status = ${status}, updated_at = now() where id = ${userId} and deleted_at is null`;
  // Suspending must bite now, not in 15 minutes: burn every refresh family so the
  // session dies at the next refresh and cannot be renewed. (The access token
  // still works for up to its 15-minute life; the refresh chokepoint is what
  // makes suspension effective — the auth service re-checks status on refresh.)
  if (status === 'SUSPENDED') {
    await sql`update refresh_tokens set revoked_at = now(), revoked_reason = 'suspended'
              where user_id = ${userId} and revoked_at is null`;
  }
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: `user.${status.toLowerCase()}`, targetType: 'USER', targetId: userId, reason });
}

export async function setUserRole(actor: Actor, userId: string, role: 'user' | 'admin', reason: string) {
  if (userId === actor.id) throw badRequest('SELF', 'You cannot change your own role.');
  await sql`update public.users set role = ${role}, updated_at = now() where id = ${userId} and deleted_at is null`;
  // A demotion, like a suspension, must take effect promptly.
  if (role === 'user') {
    await sql`update refresh_tokens set revoked_at = now(), revoked_reason = 'suspended'
              where user_id = ${userId} and revoked_at is null`;
  }
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'user.role', targetType: 'USER', targetId: userId, reason, metadata: { role } });
}

export async function forceLogout(actor: Actor, userId: string) {
  await sql`update refresh_tokens set revoked_at = now(), revoked_reason = 'logout'
            where user_id = ${userId} and revoked_at is null`;
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'user.force_logout', targetType: 'USER', targetId: userId });
}

// ─── hub control ─────────────────────────────────────────────────────────────

export async function unpublishReview(actor: Actor, reviewId: string, reason: string) {
  await transition({ reviewId, to: 'UNPUBLISHED', actor: { userId: actor.id, role: 'admin' }, reasonText: reason });
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'review.unpublish', targetType: 'REVIEW', targetId: reviewId, reason });
}

export async function republishReview(actor: Actor, reviewId: string) {
  await transition({ reviewId, to: 'PUBLISHED', actor: { userId: actor.id, role: 'admin' } });
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'review.republish', targetType: 'REVIEW', targetId: reviewId });
}

// ─── genres ──────────────────────────────────────────────────────────────────

function genreSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'genre';
}

export async function createGenre(actor: Actor, input: { name: string; blurb?: string; channelColour?: string; channelNumber?: number | null }) {
  const name = input.name.trim();
  if (!name) throw badRequest('NO_NAME', 'A genre needs a name.');
  const slug = genreSlug(name);
  const [exists] = await sql`select 1 from library.genres where slug = ${slug}`;
  if (exists) throw badRequest('DUPLICATE', 'A genre with that name already exists.');
  const [max] = await sql`select coalesce(max(sort_order), 0) + 1 as n from library.genres`;
  const [row] = await sql`
    insert into library.genres (slug, name, blurb, channel_colour, channel_number, sort_order)
    values (${slug}, ${name}, ${input.blurb?.trim() || null}, ${input.channelColour || null}, ${input.channelNumber ?? null}, ${Number(max.n)})
    returning id`;
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'genre.create', targetType: 'GENRE', targetId: row.id as string, metadata: { name, slug } });
  return row.id as string;
}

export async function updateGenre(actor: Actor, genreId: string, patch: { name?: string; blurb?: string; channelColour?: string | null; channelNumber?: number | null; sortOrder?: number; isActive?: boolean }) {
  const sets: ReturnType<typeof sql>[] = [];
  if (patch.name !== undefined) sets.push(sql`name = ${patch.name.trim()}`);
  if (patch.blurb !== undefined) sets.push(sql`blurb = ${patch.blurb.trim() || null}`);
  if (patch.channelColour !== undefined) sets.push(sql`channel_colour = ${patch.channelColour || null}`);
  if (patch.channelNumber !== undefined) sets.push(sql`channel_number = ${patch.channelNumber}`);
  if (patch.sortOrder !== undefined) sets.push(sql`sort_order = ${patch.sortOrder}`);
  if (patch.isActive !== undefined) sets.push(sql`is_active = ${patch.isActive}`);
  if (sets.length === 0) return;
  // Compose the SET list.
  let clause = sets[0];
  for (let i = 1; i < sets.length; i++) clause = sql`${clause}, ${sets[i]}`;
  await sql`update library.genres set ${clause}, updated_at = now() where id = ${genreId}`;
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'genre.update', targetType: 'GENRE', targetId: genreId, metadata: patch });
}

// ─── settings ────────────────────────────────────────────────────────────────

export async function updateReviewWindow(actor: Actor, window: { hookMaxWords: number; bodyMinWords: number; bodyMaxWords: number; underdogMaxSentences: number }) {
  // Clamp to the hard rails the DB CHECK also enforces, so the setting can never
  // ask for something the constraints will reject.
  const clamped = {
    hookMaxWords: Math.max(1, Math.min(14, window.hookMaxWords || DEFAULT_WINDOW.hookMaxWords)),
    bodyMinWords: Math.max(30, Math.min(120, window.bodyMinWords || DEFAULT_WINDOW.bodyMinWords)),
    bodyMaxWords: Math.max(30, Math.min(120, window.bodyMaxWords || DEFAULT_WINDOW.bodyMaxWords)),
    underdogMaxSentences: Math.max(1, Math.min(3, window.underdogMaxSentences || 1)),
  };
  if (clamped.bodyMinWords > clamped.bodyMaxWords) throw badRequest('RANGE', 'The minimum cannot exceed the maximum.');
  // sql.json(), NOT JSON.stringify(): a stringified object goes into a jsonb
  // column as a quoted JSON *string*, which reads back as text and, when spread,
  // explodes into character-indexed keys. sql.json() stores a real jsonb object.
  await sql`
    insert into system.settings (key, value) values ('review.window', ${sql.json(clamped)})
    on conflict (key) do update set value = ${sql.json(clamped)}, updated_at = now()`;
  clearSettingsCache();
  await repo.recordAudit({ actorUserId: actor.id, actorRole: 'admin', action: 'setting.review_window', targetType: 'SETTING', targetId: 'review.window', metadata: clamped });
  return clamped;
}
