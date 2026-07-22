-- 0005 — the admin audit trail
--
-- Every mutating admin action writes one row here: who did what to which thing,
-- and why. Like ugc.review_actions, actor_user_id carries NO foreign key, so the
-- trail outlives the account that made the change. Append-only by convention.

create table if not exists system.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role    varchar(16),
  action        varchar(60) not null,      -- 'user.suspend', 'genre.create', 'review.unpublish', …
  target_type   varchar(24),               -- 'USER' | 'REVIEW' | 'GENRE' | 'SETTING' | …
  target_id     varchar(120),
  reason        text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on system.audit_logs (created_at desc);
create index if not exists idx_audit_logs_target on system.audit_logs (target_type, target_id);
