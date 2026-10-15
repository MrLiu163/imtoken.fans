-- 评论区 Product Hunt 化：评论点赞、举报（管理员可见）、@提及通知。
-- 都是新增表，不改动任何已有列，在 Supabase Dashboard -> SQL Editor 里执行（在 0001-0009 之后）。

-- ========== 评论点赞 ==========
-- 结构和 RLS 完全镜像 votes 表：公开可读用于计数展示，只能以自己身份增删。
create table comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table comment_votes enable row level security;

create policy "comment votes are publicly readable" on comment_votes for select using (true);
create policy "users can vote on comments as themselves" on comment_votes for insert with check (user_id = auth.uid());
create policy "users can remove own comment vote" on comment_votes for delete using (user_id = auth.uid());

-- ========== 评论举报 ==========
-- 六个理由对应 Product Hunt 的 Report 菜单：Spam / Duplicate / Harmful / Not Working (Needs Editing) /
-- Self-promotion / Artificially generated。
create type comment_report_reason as enum (
  'spam', 'duplicate', 'harmful', 'not_working', 'self_promotion', 'ai_generated'
);

create table comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete cascade,
  reason comment_report_reason not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id) -- 同一个人对同一条评论只能举报一次
);

create index comment_reports_status_idx on comment_reports (status);

alter table comment_reports enable row level security;

-- 和 moderation_queue 同一个套路：任何登录用户可以举报，但只有 admin 能直接读/改；
-- member 想处理举报要走 Server Action 里的 requirePermission("moderate_comments") + admin client。
create policy "users can report comments as themselves" on comment_reports for insert with check (reporter_id = auth.uid());
create policy "admin only read comment reports" on comment_reports for select using (is_admin());
create policy "admin only update comment reports" on comment_reports for update using (is_admin());

-- ========== 通知 ==========
-- 目前只有两种触发场景：评论被 @提及、自己的评论收到回复。
create type notification_type as enum ('mention', 'reply');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade, -- 收件人
  actor_id uuid references profiles (id) on delete set null, -- 触发这条通知的人
  type notification_type not null,
  submission_id uuid references submissions (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

-- 和 badges 表同一个套路：只开放 select/update（本人），不开放 insert 策略——
-- 写入只能走 service_role（发评论时由 Server Action 触发），避免用户伪造给自己发通知。
create policy "users can read own notifications" on notifications for select using (user_id = auth.uid());
create policy "users can update own notifications" on notifications for update using (user_id = auth.uid());
