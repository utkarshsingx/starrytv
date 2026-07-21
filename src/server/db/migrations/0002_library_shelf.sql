-- 0002 — library + shelf
--
-- The catalogue everyone shares, and the private reading log each person keeps.
-- Two Postgres schemas so the two concerns stay visibly separate, matching the
-- plan's data model. Cross-schema foreign keys to public.users (from 0001) are
-- fine.
--
-- Design decisions that are load-bearing and were argued for in the plan:
--  * READS ARE ROWS, not a boolean. shelf_entries says "this book is on my
--    shelf"; read_entries says "this is my Nth go at it". Merging them makes a
--    re-read impossible to represent — Goodreads' most-complained-about flaw.
--  * started_on / finished_on are dates on every read. They are the only fields
--    in the product that genuinely cannot be backfilled — streaks, pace and
--    year-in-review are impossible without them — so they exist from day one.
--  * ratings are an integer 0..20 (quarter-stars), never a float: no comparison
--    bugs, and 0.25 granularity is a real StoryGraph advantage.
--  * page progress is an integer, never a percent. Percent is derived for
--    display; storing it loses information and breaks across editions.
--  * user tags are kept strictly separate from status. Goodreads conflates them
--    and users complain endlessly; separating them now is free and undoing it
--    later is not.

create extension if not exists pg_trgm;

create schema if not exists library;
create schema if not exists shelf;

-- ─── library.genres ──────────────────────────────────────────────────────────
create table if not exists library.genres (
  id             uuid primary key default gen_random_uuid(),
  slug           citext not null,
  name           varchar(80) not null,
  blurb          varchar(300),
  channel_colour varchar(7),      -- #RRGGBB, drives --screen-light when a genre becomes a channel
  channel_number smallint,
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_genres_slug on library.genres (slug);

-- ─── library.books ───────────────────────────────────────────────────────────
create table if not exists library.books (
  id                     uuid primary key default gen_random_uuid(),
  slug                   citext not null,
  title                  varchar(300) not null,
  author                 varchar(200) not null,
  first_published_year   smallint,
  origin                 varchar(160),
  page_count             int,
  description            text,
  isbn13                 varchar(13),
  open_library_work_key  varchar(40),
  open_library_cover_id  int,           -- cover_i; fetch covers by THIS, never by ISBN
  google_volume_id       varchar(40),
  cover_object_key       varchar(500),  -- our R2 key once covers are mirrored; null = use OL cover id
  metadata_source        varchar(20) not null check (metadata_source in ('HOUSE','OPEN_LIBRARY','GOOGLE_BOOKS','MANUAL')),
  is_public_domain       boolean not null default false,
  gutenberg_id           int,
  created_by_user_id     uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create unique index if not exists uq_books_slug on library.books (slug) where deleted_at is null;
create unique index if not exists uq_books_isbn13 on library.books (isbn13) where isbn13 is not null and deleted_at is null;
create index if not exists idx_books_title_trgm on library.books using gin (title gin_trgm_ops);
create index if not exists idx_books_author_trgm on library.books using gin (author gin_trgm_ops);

-- ─── library.book_genres ─────────────────────────────────────────────────────
create table if not exists library.book_genres (
  book_id    uuid not null references library.books(id) on delete cascade,
  genre_id   uuid not null references library.genres(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (book_id, genre_id)
);
create index if not exists idx_book_genres_genre on library.book_genres (genre_id);

-- ─── shelf.shelf_entries ─────────────────────────────────────────────────────
-- "this book is on my shelf" — one row per (user, book), enforced.
create table if not exists shelf.shelf_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  book_id      uuid not null references library.books(id) on delete cascade,
  status       varchar(16) not null check (status in ('WANT_TO_READ','READING','PAUSED','READ','DNF')),
  is_favourite boolean not null default false,
  visibility   varchar(12) not null default 'PRIVATE' check (visibility in ('PRIVATE','PUBLIC')),
  added_at     timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create unique index if not exists uq_shelf_entries_user_book
  on shelf.shelf_entries (user_id, book_id) where deleted_at is null;
create index if not exists idx_shelf_entries_user_status
  on shelf.shelf_entries (user_id, status) where deleted_at is null;
create index if not exists idx_shelf_entries_reading
  on shelf.shelf_entries (updated_at desc) where status = 'READING' and deleted_at is null;

-- ─── shelf.read_entries ──────────────────────────────────────────────────────
-- "this is my Nth go at it". A re-read is a new row, not an overwrite.
create table if not exists shelf.read_entries (
  id                  uuid primary key default gen_random_uuid(),
  shelf_entry_id      uuid not null references shelf.shelf_entries(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  book_id             uuid not null references library.books(id) on delete cascade,
  attempt_no          smallint not null default 1,
  started_on          date,
  finished_on         date,
  outcome             varchar(16) not null check (outcome in ('IN_PROGRESS','FINISHED','ABANDONED','PAUSED')),
  abandoned_reason    varchar(500),
  rating_quarter_stars smallint check (rating_quarter_stars between 0 and 20),
  format              varchar(8) not null default 'PRINT' check (format in ('PRINT','EBOOK','AUDIO')),
  edition_page_count  int,
  pace                varchar(8) check (pace in ('SLOW','MEDIUM','FAST')),
  private_notes       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists uq_read_entries_attempt on shelf.read_entries (shelf_entry_id, attempt_no);
create index if not exists idx_read_entries_user_finished
  on shelf.read_entries (user_id, finished_on desc) where finished_on is not null;

-- ─── shelf.reading_progress ──────────────────────────────────────────────────
-- 1:1 with a read. Integer page; percent is derived for display only.
create table if not exists shelf.reading_progress (
  id                  uuid primary key default gen_random_uuid(),
  read_entry_id       uuid not null unique references shelf.read_entries(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  book_id             uuid not null references library.books(id) on delete cascade,
  page                int,
  total_pages         int,
  audio_seconds       int,
  total_audio_seconds int,
  source              varchar(12) not null default 'MANUAL' check (source in ('MANUAL','PDF_READER','TIMER')),
  recorded_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── shelf.reading_sessions (stopwatch) ──────────────────────────────────────
create table if not exists shelf.reading_sessions (
  id            uuid primary key default gen_random_uuid(),
  read_entry_id uuid not null references shelf.read_entries(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  start_page    int,
  end_page      int,
  source        varchar(12) not null default 'TIMER',
  created_at    timestamptz not null default now()
);
create index if not exists idx_reading_sessions_entry on shelf.reading_sessions (read_entry_id, started_at desc);

-- ─── shelf.read_moods ────────────────────────────────────────────────────────
create table if not exists shelf.read_moods (
  read_entry_id uuid not null references shelf.read_entries(id) on delete cascade,
  mood          varchar(20) not null,
  primary key (read_entry_id, mood)
);

-- ─── shelf.tags / shelf_entry_tags ───────────────────────────────────────────
create table if not exists shelf.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       varchar(40) not null,
  slug       citext not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_tags_user_slug on shelf.tags (user_id, slug);

create table if not exists shelf.shelf_entry_tags (
  shelf_entry_id uuid not null references shelf.shelf_entries(id) on delete cascade,
  tag_id         uuid not null references shelf.tags(id) on delete cascade,
  primary key (shelf_entry_id, tag_id)
);

-- ─── shelf.quotes ────────────────────────────────────────────────────────────
-- Private-first. The 2000-char ceiling is a fair-use limit (~300 words).
create table if not exists shelf.quotes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  book_id           uuid not null references library.books(id) on delete cascade,
  read_entry_id     uuid references shelf.read_entries(id) on delete set null,
  body              text not null check (char_length(body) <= 2000),
  page              int,
  chapter           varchar(80),
  note              text,
  visibility        varchar(12) not null default 'PRIVATE' check (visibility in ('PRIVATE','PUBLIC')),
  source            varchar(12) not null default 'MANUAL' check (source in ('MANUAL','OCR','PDF_SELECT')),
  image_object_key  varchar(500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists idx_quotes_user_book on shelf.quotes (user_id, book_id) where deleted_at is null;

-- ─── shelf.book_images ("paste images from the book") ────────────────────────
create table if not exists shelf.book_images (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  book_id           uuid not null references library.books(id) on delete cascade,
  object_key        varchar(500) not null,
  kind              varchar(20) not null check (kind in ('PAGE_PHOTO','MARGINALIA','ILLUSTRATION','COVER')),
  caption           varchar(240),
  page              int,
  width             int,
  height            int,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists idx_book_images_user_book on shelf.book_images (user_id, book_id) where deleted_at is null;
