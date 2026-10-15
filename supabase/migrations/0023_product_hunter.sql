-- 社区产品猎手：产品资料、支持票与真实体验评分。
-- 保留旧 votes / investments 数据供历史页面读取，但新的产品主路径不再使用它们。

alter table submissions
  add column product_platforms text[] not null default '{}',
  add column pricing_type text,
  add column launch_stage text,
  add column maker_relationship text,
  add column maker_note text,
  add column feedback_prompt text,
  add column published_at timestamptz;

alter table submissions
  add constraint submissions_pricing_type_check
    check (pricing_type is null or pricing_type in ('free', 'freemium', 'paid', 'open_source')),
  add constraint submissions_launch_stage_check
    check (launch_stage is null or launch_stage in ('live', 'public_beta', 'private_beta', 'coming_soon')),
  add constraint submissions_maker_relationship_check
    check (maker_relationship is null or maker_relationship in ('creator', 'team_member')),
  add constraint submissions_product_platforms_check
    check (product_platforms <@ array['web', 'ios', 'android', 'browser_extension', 'telegram', 'hardware', 'other']::text[]);

update submissions
set
  pricing_type = coalesce(pricing_type, 'free'),
  launch_stage = coalesce(launch_stage, 'live'),
  maker_relationship = coalesce(maker_relationship, 'creator'),
  published_at = case when status = 'published' then coalesce(published_at, created_at) else published_at end
where type = 'product';

create index submissions_products_published_at_idx
  on submissions (published_at desc)
  where type = 'product' and status = 'published' and deleted_at is null;

create or replace function set_submission_published_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger submissions_set_published_at
before insert or update on submissions
for each row execute function set_submission_published_at();

create table product_supports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (submission_id, user_id)
);

create index product_supports_submission_idx on product_supports (submission_id);

alter table product_supports enable row level security;

create policy "product supports are publicly readable"
  on product_supports for select using (true);
create policy "users can support published products"
  on product_supports for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from submissions s
      where s.id = submission_id
        and s.type = 'product'
        and s.status = 'published'
        and s.deleted_at is null
    )
  );
create policy "users can remove own product support"
  on product_supports for delete using (user_id = auth.uid());

create table product_ratings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(trim(body)) between 20 and 1000),
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  experienced boolean not null check (experienced),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, user_id),
  check (cardinality(strengths) <= 3),
  check (cardinality(improvements) <= 3)
);

create index product_ratings_submission_idx on product_ratings (submission_id, created_at desc);

alter table product_ratings enable row level security;

create policy "product ratings are publicly readable"
  on product_ratings for select using (
    exists (
      select 1 from submissions s
      where s.id = submission_id
        and s.type = 'product'
        and s.status = 'published'
        and s.deleted_at is null
    )
  );
create policy "users can rate published products"
  on product_ratings for insert with check (
    user_id = auth.uid()
    and experienced
    and exists (
      select 1 from submissions s
      where s.id = submission_id
        and s.type = 'product'
        and s.status = 'published'
        and s.deleted_at is null
        and s.submitted_by <> auth.uid()
    )
  );
create policy "users can update own product rating"
  on product_ratings for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and experienced
    and exists (
      select 1 from submissions s
      where s.id = submission_id
        and s.type = 'product'
        and s.status = 'published'
        and s.deleted_at is null
        and s.submitted_by <> auth.uid()
    )
  );
create policy "users can remove own product rating"
  on product_ratings for delete using (user_id = auth.uid());

grant select on product_supports, product_ratings to anon, authenticated;
grant insert, delete on product_supports to authenticated;
grant insert, update, delete on product_ratings to authenticated;

-- 保持 submission_cards 的既有列顺序，只在末尾追加产品猎手字段。
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
  p.role as submitted_by_role,
  s.deleted_at,
  p.level as submitted_by_level,
  s.product_platforms,
  s.pricing_type,
  s.launch_stage,
  s.maker_relationship,
  s.maker_note,
  s.feedback_prompt,
  s.published_at,
  coalesce(ps.count, 0) as support_count,
  coalesce(pr.count, 0) as rating_count,
  pr.average as rating_average
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
  where c.submission_id = s.id and c.status = 'published' and c.deleted_at is null
) cm on true
left join lateral (
  select count(*) as count from product_supports x where x.submission_id = s.id
) ps on true
left join lateral (
  select count(*) as count, round(avg(r.rating)::numeric, 1) as average
  from product_ratings r where r.submission_id = s.id
) pr on true;

grant select on submission_cards to anon, authenticated;
