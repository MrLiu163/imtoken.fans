-- Phase 1 MVP：读侧聚合视图 + 审核模式配置 + genesis_member 徽章自动发放
-- 在 Supabase Dashboard -> SQL Editor 里执行这个文件（在 0001/0002 之后）。

-- ========== submission_cards：读侧聚合视图 ==========
-- security_invoker = on：视图内部引用的每一张底表（submissions/profiles/votes/investments/comments）
-- 都按查询者自己的角色重新走一遍 RLS，而不是按视图属主的权限执行。
-- 这里不写死 status = 'published'，可见性完全交给底层表已有的 RLS 策略决定：
-- 公开列表页自己叠加 .eq('status','published')，「我的提交」页不加这个过滤（RLS 已保证只能看到自己的+已发布的）。
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
  coalesce(cm.count, 0)  as comment_count
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

-- ========== 审核模式配置：管理员可切换 不审核 / 人工审核 / AI 审核 ==========
create table moderation_settings (
  target_type moderation_target primary key,
  mode text not null default 'human' check (mode in ('none', 'human', 'ai')),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id)
);

alter table moderation_settings enable row level security;

create policy "moderation settings are publicly readable"
  on moderation_settings for select using (true);
create policy "admin can insert moderation settings"
  on moderation_settings for insert with check (is_admin());
create policy "admin can update moderation settings"
  on moderation_settings for update using (is_admin()) with check (is_admin());

insert into moderation_settings (target_type, mode) values
  ('submission', 'human'),
  ('comment', 'human')
on conflict (target_type) do nothing;

-- ========== badges：加个索引 + genesis_member 自动发放 ==========
create index if not exists badges_badge_key_idx on badges (badge_key);

create or replace function public.handle_new_user()
returns trigger as $$
declare
  member_count bigint;
begin
  begin
    insert into public.profiles (id, username, avatar_url, wallet_address)
    values (
      new.id,
      coalesce(
        new.raw_user_meta_data ->> 'username',
        new.raw_user_meta_data ->> 'full_name',
        split_part(new.email, '@', 1)
      ),
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'wallet_address'
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, avatar_url, wallet_address)
    values (new.id, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'wallet_address')
    on conflict (id) do nothing;
  end;

  -- 前 50 个用户自动拿 genesis_member 徽章。用 badges 里已有的 genesis_member 计数
  -- 而不是 profiles 总数，避免这张表随数据量变大扫描成本升高。
  select count(*) into member_count from public.badges where badge_key = 'genesis_member';
  if member_count < 50 then
    insert into public.badges (user_id, badge_key, level)
    values (new.id, 'genesis_member', 1)
    on conflict (user_id, badge_key) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
