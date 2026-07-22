-- 0003 — user reviews, the approval pipeline, and the settings that govern them
--
-- The pivot: a reader's private reading becomes a public, admin-approved review.
--
-- Two invariants are enforced at the database level, not just in code, because
-- they are the ones a bug must never be able to violate:
--  1. review_revisions is IMMUTABLE — inserted, never updated. The published
--     text and the pending edit are different rows, so what the public sees
--     cannot silently change under an edit.
--  2. reviews.status only ever moves along a legal edge. A trigger rejects any
--     other transition — with a documented escape hatch for migrations and
--     repair scripts, because without one your own backfill is rejected during
--     an incident.

create schema if not exists system;
create schema if not exists ugc;

-- ─── system.settings ─────────────────────────────────────────────────────────
-- Key/value config the admin can change without a deploy. The review word
-- window lives here: the CHECK bounds on revisions are immovable outer rails,
-- but the *configured* window inside them (default 45–70 body words) is a
-- setting, mirrored into the composer's live counter so both move together.
create table if not exists system.settings (
  key        varchar(80) primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into system.settings (key, value) values
  ('review.window', '{"hookMaxWords":14,"bodyMinWords":45,"bodyMaxWords":70,"underdogMaxSentences":1}')
on conflict (key) do nothing;

-- ─── ugc.reviews ─────────────────────────────────────────────────────────────
create table if not exists ugc.reviews (
  id                  uuid primary key default gen_random_uuid(),
  author_user_id      uuid not null references public.users(id) on delete cascade,
  book_id             uuid not null references library.books(id) on delete cascade,
  read_entry_id       uuid references shelf.read_entries(id) on delete set null,
  slug                citext not null,
  status              varchar(24) not null default 'DRAFT'
    check (status in ('DRAFT','SUBMITTED','IN_REVIEW','CHANGES_REQUESTED','REJECTED','PUBLISHED','UNPUBLISHED','ARCHIVED')),
  live_revision_id    uuid,   -- what the public sees; not necessarily the newest
  pending_revision_id uuid,   -- a forward edit awaiting review
  genre_id            uuid references library.genres(id) on delete set null,
  is_house            boolean not null default false,
  tv_eligible         boolean not null default true,
  hub_pinned          boolean not null default false,
  hub_sort_order      int,
  view_count          int not null default 0,
  published_at        timestamptz,
  unpublished_at      timestamptz,
  delete_reason       varchar(240),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create unique index if not exists uq_reviews_slug on ugc.reviews (slug) where deleted_at is null;
create unique index if not exists uq_reviews_read_entry
  on ugc.reviews (read_entry_id) where deleted_at is null and read_entry_id is not null;
-- One IN-FLIGHT review per (author, book) — but a later read of the same book
-- gets its own review. This is the re-read fix; a flat unique on (author, book)
-- would forbid ever reviewing a book twice.
create unique index if not exists uq_reviews_inflight
  on ugc.reviews (author_user_id, book_id)
  where deleted_at is null and status in ('DRAFT','SUBMITTED','IN_REVIEW','CHANGES_REQUESTED');
create index if not exists idx_reviews_hub
  on ugc.reviews (genre_id, published_at desc) where status = 'PUBLISHED' and deleted_at is null;
create index if not exists idx_reviews_queue
  on ugc.reviews (created_at) where status in ('SUBMITTED','IN_REVIEW');
create index if not exists idx_reviews_author on ugc.reviews (author_user_id, status);

-- ─── ugc.review_revisions — IMMUTABLE, inserted never updated ─────────────────
create table if not exists ugc.review_revisions (
  id                 uuid primary key default gen_random_uuid(),
  review_id          uuid not null references ugc.reviews(id) on delete cascade,
  rev_no             int not null,
  hook               varchar(140) not null,
  hook_word_count    smallint not null check (hook_word_count between 1 and 14),
  body               text not null,                 -- the broadcast cut
  body_word_count    smallint not null check (body_word_count between 30 and 120),
  long_body          text,                          -- the unconstrained essay
  underdog           varchar(400) not null,
  tags               text[] not null default '{}',
  spoiler_ranges     jsonb not null default '[]',
  content_warnings   text[] not null default '{}',
  style_report       jsonb not null default '{}',
  content_hash       bytea not null,
  -- NOT NULL, and deliberately NO foreign key — the author/editor id survives
  -- account erasure as a plain value (same reasoning as review_actions.actor_
  -- user_id). A `references … on delete set null` here would contradict NOT NULL
  -- and block deleting any user who wrote a revision. See migration 0004.
  created_by_user_id uuid not null,
  edited_by_admin    boolean not null default false,
  created_at         timestamptz not null default now()
);
create unique index if not exists uq_review_revisions_no on ugc.review_revisions (review_id, rev_no);
create index if not exists idx_review_revisions_hash on ugc.review_revisions (content_hash);

-- ─── ugc.review_actions — APPEND-ONLY audit trail ────────────────────────────
-- actor_user_id has deliberately NO foreign key, so the trail survives account
-- erasure. reason_text is surfaced verbatim to the author.
create table if not exists ugc.review_actions (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid not null references ugc.reviews(id) on delete cascade,
  revision_id    uuid,
  from_status    varchar(24),
  to_status      varchar(24) not null,
  actor_user_id  uuid,
  actor_role     varchar(16),
  reason_code    varchar(40),
  reason_text    text,
  automated      boolean not null default false,
  machine_scores jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_review_actions_review on ugc.review_actions (review_id, created_at desc);

-- ─── ugc.author_trust ────────────────────────────────────────────────────────
-- A table, not columns on users — so a moderation decision does not rewrite the
-- user row. level 0 = always review, 1 = fast lane, 2 = bypass the queue.
create table if not exists ugc.author_trust (
  user_id          uuid primary key references public.users(id) on delete cascade,
  level            smallint not null default 0,
  approved_count   int not null default 0,
  rejected_count   int not null default 0,
  last_decision_at timestamptz,
  updated_at       timestamptz not null default now()
);

-- ─── ugc.moderation_signals ──────────────────────────────────────────────────
create table if not exists ugc.moderation_signals (
  id          uuid primary key default gen_random_uuid(),
  revision_id uuid not null references ugc.review_revisions(id) on delete cascade,
  provider    varchar(24) not null,
  label       varchar(60) not null,
  score       numeric(5,4),
  raw         jsonb,
  created_at  timestamptz not null default now()
);

-- ─── the status guard ────────────────────────────────────────────────────────
-- The legal edge set, in the database, mirroring the TypeScript transition map.
-- Both must agree; the trigger is the backstop for a raw UPDATE the service did
-- not make.
create or replace function ugc.is_legal_transition(old_status text, new_status text)
returns boolean language sql immutable as $$
  select (old_status, new_status) in (
    ('DRAFT','SUBMITTED'),
    ('SUBMITTED','IN_REVIEW'), ('SUBMITTED','CHANGES_REQUESTED'), ('SUBMITTED','REJECTED'), ('SUBMITTED','PUBLISHED'),
    ('IN_REVIEW','CHANGES_REQUESTED'), ('IN_REVIEW','REJECTED'), ('IN_REVIEW','PUBLISHED'),
    ('CHANGES_REQUESTED','SUBMITTED'), ('CHANGES_REQUESTED','DRAFT'),
    ('REJECTED','IN_REVIEW'),
    ('PUBLISHED','UNPUBLISHED'), ('PUBLISHED','ARCHIVED'),
    ('UNPUBLISHED','PUBLISHED'), ('UNPUBLISHED','ARCHIVED')
  ) or old_status = new_status;
$$;

create or replace function ugc.guard_review_status() returns trigger language plpgsql as $$
begin
  -- Escape hatch for migrations and repair scripts:
  --   SET LOCAL starrytv.bypass_status_guard = 'on';
  if coalesce(current_setting('starrytv.bypass_status_guard', true), 'off') = 'on' then
    return new;
  end if;
  if not ugc.is_legal_transition(old.status, new.status) then
    raise exception 'illegal review transition % -> %', old.status, new.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_review_status on ugc.reviews;
create trigger trg_guard_review_status
  before update of status on ugc.reviews
  for each row execute function ugc.guard_review_status();
