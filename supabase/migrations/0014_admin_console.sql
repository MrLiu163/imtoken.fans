-- 管理后台重构：软删除回收站、举报处理记录、可授予徽章、给徽章权限。
-- 在 Supabase Dashboard -> SQL Editor 里执行（在 0001-0013 之后）。

-- ========== 软删除 / 回收站 ==========
-- 之前「删除评论」是把 status 置成 'rejected'，和「审核驳回」共用同一个状态，
-- 后台没法区分「被审核驳回的」和「被管理员删掉的」，也没有恢复入口。
--
-- 这里补三组信息：
--   deleted_at          删除时间，null = 没被删除。回收站只看这一列，不看 status。
--   deleted_by          谁删的（用于审计，管理员账号被删时置 null，不影响回收站）
--   delete_reason       删除理由（可选）
--   deleted_prev_status 删除前的状态，恢复时原样还回去（避免把一条待审核的内容恢复成已发布）
alter table comments
  add column deleted_at timestamptz,
  add column deleted_by uuid references profiles (id) on delete set null,
  add column delete_reason text,
  add column deleted_prev_status submission_status;

alter table submissions
  add column deleted_at timestamptz,
  add column deleted_by uuid references profiles (id) on delete set null,
  add column delete_reason text,
  add column deleted_prev_status submission_status;

-- 回收站按删除时间倒序翻页，只关心非 null 的行，用部分索引最省。
create index comments_deleted_at_idx on comments (deleted_at desc) where deleted_at is not null;
create index submissions_deleted_at_idx on submissions (deleted_at desc) where deleted_at is not null;

-- 一周后彻底清空。定时任务和「打开回收站时顺手清一次」都调这个函数，
-- 所以它必须是幂等的：只删 deleted_at 超过保留期的行，重复调用无副作用。
--
-- 两个 not exists 是为了不牵连还活着的数据，它们对应两条会误伤的外键：
--   comments.parent_id on delete cascade —— 删掉一条主评论会连带删掉它下面的回复。
--     主评论进回收站时回复并没有一起删，直接 delete 会把还活着的回复也带走。
--   submissions.built_from_idea_id 没有 on delete 子句（= NO ACTION）—— 删一个
--     被某个产品标为「来源点子」的点子会直接抛外键错误，让整个清理事务回滚，
--     后台每次打开都报错。
-- 所以这两种情况一律跳过：那条记录留在库里但过期后不再出现在回收站界面上，
-- 等它的回复/衍生产品也被删掉并过期之后，下一次清理才会真的删掉它。
--
-- security definer + 固定 search_path：允许通过 RPC 调用而不受调用者 RLS 影响
-- （目前应用层是用 service_role 直接调，留着这个属性是为了以后能挂 pg_cron）。
create or replace function purge_expired_deleted_content(retention_days integer default 7)
returns table (purged_comments integer, purged_submissions integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => retention_days);
  comment_count integer;
  submission_count integer;
begin
  with removed as (
    delete from comments c
    where c.deleted_at is not null
      and c.deleted_at < cutoff
      and not exists (
        select 1 from comments reply
        where reply.parent_id = c.id
          and (reply.deleted_at is null or reply.deleted_at >= cutoff)
      )
    returning 1
  )
  select count(*) into comment_count from removed;

  with removed as (
    delete from submissions s
    where s.deleted_at is not null
      and s.deleted_at < cutoff
      and not exists (
        select 1 from submissions child
        where child.built_from_idea_id = s.id
          and (child.deleted_at is null or child.deleted_at >= cutoff)
      )
    returning 1
  )
  select count(*) into submission_count from removed;

  return query select comment_count, submission_count;
end;
$$;

-- 只让 service_role 调（应用层用 service_role 的 admin client 走 RPC）。
-- 必须显式 grant：默认的 EXECUTE 权限是给 PUBLIC 的，一旦 revoke 掉，
-- service_role 也会跟着失去执行权，RPC 会报 permission denied。
revoke all on function purge_expired_deleted_content(integer) from public;
grant execute on function purge_expired_deleted_content(integer) to service_role;

-- 如果项目开了 pg_cron，可以把清理挂成每天一次的定时任务，就不必依赖有人打开回收站：
--   select cron.schedule('purge-deleted-content', '17 3 * * *',
--     $$select purge_expired_deleted_content(7)$$);

-- ========== 举报处理结果 ==========
-- 原来只有 open / resolved 两态，「驳回举报」和「举报成立并处理了」写进去长得一样。
-- 拆成 dismissed（驳回，举报不成立）和 resolved（举报成立，已处理），
-- resolution 记下具体做了什么（删评论 / 禁言多久），后台「已处理」页要展示。
alter table comment_reports drop constraint comment_reports_status_check;
alter table comment_reports
  add constraint comment_reports_status_check check (status in ('open', 'resolved', 'dismissed'));

alter table comment_reports add column resolution text;

-- 举报处理记录不能跟着评论一起消失。
-- comment_id 原来是 not null + on delete cascade：一周后清理程序真删掉那条评论时，
-- 连带把举报记录也 cascade 掉了，后台「已处理」列表会凭空少几条。
-- 改成可空 + on delete set null，并把评论正文快照进 comment_snapshot，
-- 这样评论没了，「谁举报了什么、管理员怎么处理的」还留着。
alter table comment_reports add column comment_snapshot text;
alter table comment_reports alter column comment_id drop not null;
alter table comment_reports drop constraint comment_reports_comment_id_fkey;
alter table comment_reports
  add constraint comment_reports_comment_id_fkey
  foreign key (comment_id) references comments (id) on delete set null;

-- 注意 unique (comment_id, reporter_id) 不受影响：Postgres 里 NULL 互不相等，
-- 所以多条 comment_id 为 null 的历史记录可以共存，同一个人对同一条现存评论
-- 还是只能举报一次。

-- ========== 可授予徽章 ==========
-- badges 表原来只承载自动成就（发过点子、评论过、模拟投资过……），由 refreshBadgesForUser
-- 计算后 upsert。现在还要承载「管理员手动授予」的荣誉徽章（官方认证、iCoin 持有者……）。
--
-- granted_by 就是这两类的分界线：null = 系统自动算出来的，非 null = 人工授予的。
-- 撤销徽章时只允许撤人工授予的那些，自动成就撤了下次刷新又会回来。
alter table badges
  add column granted_by uuid references profiles (id) on delete set null,
  add column note text;

create index badges_granted_by_idx on badges (granted_by) where granted_by is not null;

-- ========== submission_cards 视图带上删除标记 ==========
-- 后台的内容列表和公开列表都读这个视图，需要能过滤掉回收站里的内容。
-- 老规矩：create or replace view 不允许改动已有列的顺序/类型，新列只能追加在末尾。
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
  s.deleted_at
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
) cm on true;

grant select on submission_cards to anon, authenticated;
