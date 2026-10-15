-- 三级身份体系第二步：在 0007 把 'member' 加进枚举之后才能跑这个文件。
--
-- profiles.permissions：只对 role='member' 有意义，key 是权限名，value 是 boolean。
--   auto_publish_submissions / moderate_submissions / moderate_comments /
--   manage_user_tags / manage_campaigns（campaigns 目前没有对应功能，先留开关位）
-- profiles.muted_until：评论禁言到期时间，null = 没被禁言，和 submission_cooldown_until 一个模式。
-- 注意：不需要再补 REVOKE/GRANT——0004_rls_hardening.sql 已经把 authenticated/anon
-- 对 profiles 的 UPDATE 权限收紧到只有 username/avatar_url 两列，新加的列默认就不在
-- 这个允许列表里，普通用户改不了，天然安全，不用再声明一遍。
alter table profiles
  add column permissions jsonb not null default '{}'::jsonb,
  add column muted_until timestamptz;

-- ========== 用户标签：VIP / 官方认证（加V） / 黑名单 ==========
-- 和角色（admin/member）、徽章（badges，成就系统）是三个独立的概念，分开建模。
-- tag_key 用文本不用枚举，方便以后加新类型不用再改表结构。
create table user_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  tag_key text not null,
  set_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, tag_key)
);

alter table user_tags enable row level security;

-- 和 badges 表同款套路：公开可读（VIP/加V 图标要让所有人看到），
-- 不设 insert/update/delete 策略——写入一律走 service_role，由应用层的权限检查兜底。
create policy "user tags are publicly readable"
  on user_tags for select using (true);

-- ========== 评论默认不再走审核队列 ==========
-- 评论量大，逐条预审不现实：默认直接可见，管理员/有权限的 member 用"删除评论"+"禁言"
-- 这种事后处理来管理。moderation_settings 机制、AI 审核接口都还在，admin 随时能在后台
-- 把这一项切回"人工"或"AI"。
update moderation_settings set mode = 'none' where target_type = 'comment';

-- submission_cards 视图带上提交者的角色（用于在提交者名字旁边展示"成员"/"管理员"标签）。
-- 同样只能追加在末尾，不能插到 submitted_by_username 旁边。
create or replace view submission_cards
with (security_invoker = on) as
select
  s.id, s.type, s.title, s.tagline, s.description, s.tags, s.status,
  s.submitted_by, s.stats_users, s.stats_dau, s.stats_updated_at,
  s.built_from_idea_id, s.created_at, s.updated_at,
  p.username   as submitted_by_username,
  p.avatar_url as submitted_by_avatar_url,
  coalesce(vp.count, 0)  as votes_paid,
  coalesce(vc.count, 0)  as votes_creative,
  coalesce(inv.total, 0) as sim_invest_usd,
  coalesce(cm.count, 0)  as comment_count,
  s.website_url, s.video_url, s.logo_path, s.screenshot_paths, s.team, s.social_links,
  p.role as submitted_by_role
from submissions s
left join profiles p on p.id = s.submitted_by
left join lateral (
  select count(*) as count from votes v
  where v.submission_id = s.id and v.vote_type = 'paid'
) vp on true
left join lateral (
  select count(*) as count from votes v
  where v.submission_id = s.id and v.vote_type = 'creative'
) vc on true
left join lateral (
  select coalesce(sum(i.amount), 0) as total from investments i
  where i.submission_id = s.id and i.type = 'simulated'
) inv on true
left join lateral (
  select count(*) as count from comments c
  where c.submission_id = s.id and c.status = 'published'
) cm on true;

grant select on submission_cards to anon, authenticated;
