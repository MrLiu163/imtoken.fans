-- 提交表单加官网链接、演示视频链接、Logo、截图、团队信息、社交链接——参考 Product Hunt 的信息密度。
-- 图片走 Supabase Storage，视频不托管文件，只存一个外部链接（YouTube/Bilibili 等），
-- 避免视频文件的存储成本和转码复杂度超出这个阶段该做的事。

alter table submissions
  add column website_url text,
  add column video_url text,
  add column logo_path text,
  add column screenshot_paths text[] not null default '{}',
  add column team jsonb not null default '[]'::jsonb,
  add column social_links jsonb not null default '[]'::jsonb;

-- submission_cards 视图要重新声明才能带上这几个新列（视图不会自动继承底表新加的列）。
create or replace view submission_cards
with (security_invoker = on) as
-- 注意：Postgres 的 CREATE OR REPLACE VIEW 只允许在已有列末尾追加新列，
-- 不能在中间插入（会报 "cannot change name of view column" 错误），
-- 所以新加的 6 个字段必须放在 comment_count 后面，不能按"逻辑顺序"插到 submitted_by 相关列旁边。
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
  s.website_url, s.video_url, s.logo_path, s.screenshot_paths, s.team, s.social_links
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

-- ========== 提交素材存储桶 ==========
-- 5MB/文件、只收图片格式；视频只存外链，不在这个桶里。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-media',
  'submission-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 路径约定：{user_id}/{random}-{filename}，用第一段目录名对应 auth.uid() 来判断"是不是自己的文件"，
-- 这是 Supabase Storage 官方推荐的路径级权限写法。
create policy "submission media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'submission-media');

create policy "authenticated users can upload their own submission media"
  on storage.objects for insert
  with check (bucket_id = 'submission-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users can delete their own submission media"
  on storage.objects for delete
  using (bucket_id = 'submission-media' and auth.uid()::text = (storage.foldername(name))[1]);
