import 'server-only';
import { sql } from '../db/client';

/**
 * The admin read models — the unfiltered twins.
 *
 * Every public catalogue read filters on published/active state. The admin reads
 * here are the deliberate unfiltered pair: they see drafts, suspended users,
 * private notes. Keeping them as separate named functions (rather than a flag on
 * the public read) is what stops an admin filter accidentally leaking into a
 * public query — the sibling retrofitted this the hard way.
 */

export type AdminUserRow = {
  id: string; email: string; displayName: string; handle: string;
  role: string; status: string; emailVerified: boolean; createdAt: string;
  shelfCount: number; reviewCount: number; publishedCount: number;
};

export async function listUsers(q: string, limit = 50): Promise<AdminUserRow[]> {
  const term = q.trim();
  const rows = await sql`
    select u.id, u.email, u.display_name, u.handle, u.role, u.status,
           u.email_verified_at, u.created_at,
           (select count(*) from shelf.shelf_entries se where se.user_id = u.id and se.deleted_at is null) as shelf_count,
           (select count(*) from ugc.reviews r where r.author_user_id = u.id and r.deleted_at is null) as review_count,
           (select count(*) from ugc.reviews r where r.author_user_id = u.id and r.status = 'PUBLISHED' and r.deleted_at is null) as published_count
    from public.users u
    where u.deleted_at is null
      ${term ? sql`and (u.email ilike ${'%' + term + '%'} or u.display_name ilike ${'%' + term + '%'} or u.handle ilike ${'%' + term + '%'})` : sql``}
    order by u.created_at desc
    limit ${limit}`;
  return rows.map((r) => ({
    id: r.id as string, email: r.email as string, displayName: r.display_name as string,
    handle: r.handle as string, role: r.role as string, status: r.status as string,
    emailVerified: r.email_verified_at !== null, createdAt: (r.created_at as Date).toISOString(),
    shelfCount: Number(r.shelf_count), reviewCount: Number(r.review_count), publishedCount: Number(r.published_count),
  }));
}

export type AdminUserDetail = AdminUserRow & {
  shelf: { title: string; author: string; status: string; page: number | null }[];
  reviews: { id: string; slug: string; bookTitle: string; status: string; hook: string | null }[];
  trust: { level: number; approved: number; rejected: number } | null;
};

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const [base] = await listUsers('', 1_000).then((all) => all.filter((u) => u.id === userId));
  if (!base) return null;

  const shelf = await sql`
    select b.title, b.author, se.status,
           (select rp.page from shelf.read_entries re
              join shelf.reading_progress rp on rp.read_entry_id = re.id
              where re.shelf_entry_id = se.id order by re.attempt_no desc limit 1) as page
    from shelf.shelf_entries se join library.books b on b.id = se.book_id
    where se.user_id = ${userId} and se.deleted_at is null
    order by se.updated_at desc`;

  const reviews = await sql`
    select r.id, r.slug, b.title as book_title, r.status,
           (select hook from ugc.review_revisions rr where rr.review_id = r.id order by rev_no desc limit 1) as hook
    from ugc.reviews r join library.books b on b.id = r.book_id
    where r.author_user_id = ${userId} and r.deleted_at is null
    order by r.updated_at desc`;

  const [trust] = await sql`select level, approved_count, rejected_count from ugc.author_trust where user_id = ${userId}`;

  return {
    ...base,
    shelf: shelf.map((s) => ({ title: s.title as string, author: s.author as string, status: s.status as string, page: (s.page as number) ?? null })),
    reviews: reviews.map((r) => ({ id: r.id as string, slug: r.slug as string, bookTitle: r.book_title as string, status: r.status as string, hook: (r.hook as string) ?? null })),
    trust: trust ? { level: Number(trust.level), approved: Number(trust.approved_count), rejected: Number(trust.rejected_count) } : null,
  };
}

// ─── genres ──────────────────────────────────────────────────────────────────

export type AdminGenre = {
  id: string; slug: string; name: string; blurb: string | null;
  channelColour: string | null; channelNumber: number | null; sortOrder: number; isActive: boolean;
  bookCount: number; reviewCount: number;
};

export async function listGenres(): Promise<AdminGenre[]> {
  const rows = await sql`
    select g.*,
      (select count(*) from library.book_genres bg where bg.genre_id = g.id) as book_count,
      (select count(*) from ugc.reviews r where r.genre_id = g.id and r.status = 'PUBLISHED' and r.deleted_at is null) as review_count
    from library.genres g order by g.sort_order, g.name`;
  return rows.map((g) => ({
    id: g.id as string, slug: g.slug as string, name: g.name as string, blurb: (g.blurb as string) ?? null,
    channelColour: (g.channel_colour as string) ?? null, channelNumber: (g.channel_number as number) ?? null,
    sortOrder: Number(g.sort_order), isActive: g.is_active as boolean,
    bookCount: Number(g.book_count), reviewCount: Number(g.review_count),
  }));
}

// ─── published reviews (for hub control) ────────────────────────────────────

export async function listPublishedReviews() {
  const rows = await sql`
    select r.id, r.slug, b.title as book_title, b.author, u.display_name as author_name,
           (select hook from ugc.review_revisions rr where rr.id = r.live_revision_id) as hook,
           r.published_at
    from ugc.reviews r
    join library.books b on b.id = r.book_id
    join public.users u on u.id = r.author_user_id
    where r.status = 'PUBLISHED' and r.deleted_at is null
    order by r.published_at desc`;
  return rows.map((r) => ({
    id: r.id as string, slug: r.slug as string, bookTitle: r.book_title as string,
    bookAuthor: r.author as string, reviewer: r.author_name as string, hook: (r.hook as string) ?? null,
    publishedAt: r.published_at ? (r.published_at as Date).toISOString() : null,
  }));
}

// ─── platform stats ──────────────────────────────────────────────────────────

export async function stats() {
  const [users] = await sql`select count(*)::int n from public.users where deleted_at is null`;
  const [reviews] = await sql`select
    count(*) filter (where status='PUBLISHED') as published,
    count(*) filter (where status in ('SUBMITTED','IN_REVIEW')) as queued,
    count(*) filter (where status='REJECTED') as rejected,
    count(*) as total from ugc.reviews where deleted_at is null`;
  const [week] = await sql`select count(*)::int n from ugc.reviews
    where created_at >= now() - interval '7 days' and deleted_at is null`;
  // Median time-to-decision: submit -> first admin decision, over the last 30 days.
  const [ttd] = await sql`
    with decided as (
      select r.id,
        min(a1.created_at) as submitted_at,
        min(a2.created_at) as decided_at
      from ugc.reviews r
      join ugc.review_actions a1 on a1.review_id = r.id and a1.to_status = 'SUBMITTED'
      join ugc.review_actions a2 on a2.review_id = r.id and a2.to_status in ('PUBLISHED','REJECTED','CHANGES_REQUESTED')
      where a2.created_at >= now() - interval '30 days'
      group by r.id
    )
    select extract(epoch from percentile_cont(0.5) within group (order by decided_at - submitted_at)) as median_sec from decided`;
  return {
    users: Number(users.n),
    published: Number(reviews.published), queued: Number(reviews.queued),
    rejected: Number(reviews.rejected), totalReviews: Number(reviews.total),
    submittedThisWeek: Number(week.n),
    medianDecisionSec: ttd.median_sec != null ? Number(ttd.median_sec) : null,
  };
}

// ─── audit log ───────────────────────────────────────────────────────────────

export async function recordAudit(a: {
  actorUserId: string; actorRole: string; action: string;
  targetType?: string; targetId?: string; reason?: string | null; metadata?: unknown;
}): Promise<void> {
  await sql`
    insert into system.audit_logs (actor_user_id, actor_role, action, target_type, target_id, reason, metadata)
    values (${a.actorUserId}, ${a.actorRole}, ${a.action}, ${a.targetType ?? null}, ${a.targetId ?? null},
            ${a.reason ?? null}, ${a.metadata ? sql.json(a.metadata as never) : null})`;
}

export async function listAudit(limit = 100) {
  const rows = await sql`
    select a.*, u.display_name as actor_name from system.audit_logs a
    left join public.users u on u.id = a.actor_user_id
    order by a.created_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id as string, action: r.action as string, actorName: (r.actor_name as string) ?? 'system',
    targetType: (r.target_type as string) ?? null, targetId: (r.target_id as string) ?? null,
    reason: (r.reason as string) ?? null, createdAt: (r.created_at as Date).toISOString(),
  }));
}
