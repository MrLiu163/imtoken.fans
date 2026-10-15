-- imAihunt 初始数据库 Schema
-- 在 Supabase 项目建好后，去 Dashboard -> SQL Editor 粘贴并执行这个文件即可。
-- （具体步骤见 README「配置 Supabase」章节）

-- ========== 扩展 ==========
create extension if not exists "pgcrypto";

-- ========== 枚举类型 ==========
create type submission_type as enum ('product', 'idea');
create type submission_status as enum ('pending', 'published', 'rejected');
create type vote_type as enum ('paid', 'creative');
create type investment_type as enum ('simulated', 'real');
create type moderation_target as enum ('submission', 'comment');
create type moderation_source as enum ('human', 'ai');
create type moderation_result as enum ('pending', 'approved', 'rejected');
create type user_role as enum ('user', 'admin');

-- ========== 用户资料 ==========
-- 真正的账号（邮箱/密码、Google、钱包）由 Supabase Auth 的 auth.users 表管理，
-- 这张 profiles 表存放业务需要的额外信息，通过 id 和 auth.users 一一对应。
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  wallet_address text unique,
  role user_role not null default 'user',
  submission_cooldown_until timestamptz,
  created_at timestamptz not null default now()
);

-- ========== 提交（产品 / 点子） ==========
create table submissions (
  id uuid primary key default gen_random_uuid(),
  type submission_type not null,
  title text not null,
  tagline text not null,
  description text not null,
  tags text[] not null default '{}',
  status submission_status not null default 'pending',
  submitted_by uuid not null references profiles (id) on delete cascade,
  stats_users bigint,
  stats_dau bigint,
  stats_updated_at timestamptz,
  built_from_idea_id uuid references submissions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_status_idx on submissions (status);
create index submissions_type_idx on submissions (type);
create index submissions_submitted_by_idx on submissions (submitted_by);

-- ========== 投票 ==========
create table votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  vote_type vote_type not null,
  created_at timestamptz not null default now(),
  unique (submission_id, user_id, vote_type) -- 一人每个票种限投一次，但两种票种可以都投
);

-- ========== 投资（模拟 / 真实） ==========
create table investments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  type investment_type not null,
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null default 'USD',
  tx_hash text, -- 真实投资时的链上交易哈希，模拟投资为空
  nft_token_id text, -- 真实投资凭证 NFT，P3 阶段使用
  created_at timestamptz not null default now()
);

create index investments_submission_idx on investments (submission_id);

-- ========== 评论 ==========
create table comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  parent_id uuid references comments (id) on delete cascade,
  body text not null,
  status submission_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index comments_submission_idx on comments (submission_id);

-- ========== 审核队列 ==========
-- 预留 AI 审核接口：source 字段区分是人工判定还是 AI 判定，
-- 以后接入 AI 审核 API 时，只需要新增一条 source = 'ai' 的记录，不用改表结构。
create table moderation_queue (
  id uuid primary key default gen_random_uuid(),
  target_type moderation_target not null,
  target_id uuid not null,
  source moderation_source not null default 'human',
  result moderation_result not null default 'pending',
  reason text,
  reviewed_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ========== 徽章 ==========
create table badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  badge_key text not null, -- 例如 'ideas', 'ideas_built', 'trending_idea', 'contributions', 'backed_projects', 'genesis_member'
  level integer not null default 1,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

-- ========== 管理员操作日志 ==========
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles (id),
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ========== 行级安全（RLS） ==========
-- 开启 RLS 是 Supabase 的最佳实践：默认所有人都读不到、写不到，再逐条开放需要的权限。
alter table profiles enable row level security;
alter table submissions enable row level security;
alter table votes enable row level security;
alter table investments enable row level security;
alter table comments enable row level security;
alter table moderation_queue enable row level security;
alter table badges enable row level security;
alter table admin_logs enable row level security;

-- 判断当前登录用户是否是管理员，供下面的策略复用
create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- profiles：任何人可读公开信息，本人可改自己的资料
create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users can update own profile" on profiles for update using (auth.uid() = id);

-- submissions：已发布内容公开可读；作者本人可读自己的所有状态；作者可插入；管理员可全权限
create policy "published submissions are public" on submissions for select using (status = 'published' or submitted_by = auth.uid() or is_admin());
create policy "users can submit" on submissions for insert with check (submitted_by = auth.uid());
create policy "author or admin can update" on submissions for update using (submitted_by = auth.uid() or is_admin());
create policy "admin can delete submissions" on submissions for delete using (is_admin());

-- votes：登录用户可读全部投票（用于计数展示），只能以自己身份投票
create policy "votes are publicly readable" on votes for select using (true);
create policy "users can vote as themselves" on votes for insert with check (user_id = auth.uid());
create policy "users can remove own vote" on votes for delete using (user_id = auth.uid());

-- investments：公开可读（用于展示投资总额），只能以自己身份投资
create policy "investments are publicly readable" on investments for select using (true);
create policy "users can invest as themselves" on investments for insert with check (user_id = auth.uid());

-- comments：已发布评论公开可读，作者本人可读自己未发布的评论，登录用户可发评论
create policy "published comments are public" on comments for select using (status = 'published' or user_id = auth.uid() or is_admin());
create policy "users can comment as themselves" on comments for insert with check (user_id = auth.uid());
create policy "admin can moderate comments" on comments for update using (is_admin());
create policy "admin can delete comments" on comments for delete using (is_admin());

-- moderation_queue / admin_logs：仅管理员可读写
create policy "admin only read moderation queue" on moderation_queue for select using (is_admin());
create policy "admin only write moderation queue" on moderation_queue for all using (is_admin());
create policy "admin only read admin logs" on admin_logs for select using (is_admin());
create policy "admin only write admin logs" on admin_logs for insert with check (is_admin());

-- badges：公开可读（展示在 Profile 页），只有服务端（service_role）才能写入，避免用户伪造徽章
create policy "badges are publicly readable" on badges for select using (true);
