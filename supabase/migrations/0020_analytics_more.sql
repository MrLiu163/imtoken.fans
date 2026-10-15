-- 运营看板第二批指标。在 Supabase Dashboard -> SQL Editor 里执行（在 0019 之后）。
--
-- 0019 回答的是"有多少人来、看了什么"，这个文件回答剩下四类运营问题：
--   增长   访客到注册、注册到激活的转化，新用户回访率，等级分布
--   内容   审核积压与审核时长、通过率、零评论内容（待撬动的池子）
--   互动   投票 / 模拟投资 / 评论点赞 / 举报
--   活动   签到（人数、连签、发出的经验）、抽奖（次数、券收支、奖品分布）、经验值来源
--
-- 命名约定（0019 那批踩过的坑，这里统一避开）：
-- 输出列名不能和函数体里用到的表名重名（比如输出叫 checkins 而体内 from checkins），
-- 所以计数类输出一律叫 xxx_count / total_xxx，函数体里所有列引用都带表别名。

-- 0019 建的索引没覆盖"按用户查访问"，而回访率是逐个用户判断有没有再来过。
-- 部分索引：只有登录用户的行才有 user_id，游客行不进这个索引。
create index if not exists page_views_user_idx
  on page_views (user_id, created_at desc)
  where user_id is not null;

-- ========== 流量（轻量版） ==========
-- 后台总览页的「今日访问」小卡片只要两个数，不值得为它跑 analytics_summary 那 8 个子查询。
create or replace function analytics_traffic(p_from timestamptz, p_to timestamptz)
returns table (view_count bigint, visitor_count bigint, member_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(distinct pv.visitor_id)::bigint,
    count(distinct pv.user_id)::bigint
  from page_views pv
  where pv.created_at >= p_from and pv.created_at < p_to;
$$;

-- ========== 增长 ==========

-- 注册转化漏斗：访客 -> 注册 -> 激活 -> 创作。
-- 「激活」= 注册之后做过任意一件留下痕迹的事（评论 / 投票 / 模拟投资 / 签到 / 发内容）。
-- 刻意包含"发内容"，这样漏斗一定是单调收窄的——否则创作者可能比激活用户还多，图会画反。
--
-- 注意 visitor_count 和后三个不是同一批人：访客是浏览器维度且只有埋点上线之后才有，
-- 注册数是账号维度、从建站起就完整。区间跨到埋点上线之前时，这一级会偏小。
create or replace function analytics_funnel(p_from timestamptz, p_to timestamptz)
returns table (visitor_count bigint, signup_count bigint, activated_count bigint, creator_count bigint)
language sql
security definer
set search_path = public
as $$
  with cohort as (
    select p.id from profiles p where p.created_at >= p_from and p.created_at < p_to
  )
  select
    (select count(distinct pv.visitor_id) from page_views pv
      where pv.created_at >= p_from and pv.created_at < p_to)::bigint,
    (select count(*) from cohort)::bigint,
    (select count(*) from cohort c
      where exists (select 1 from comments cm where cm.user_id = c.id and cm.deleted_at is null)
         or exists (select 1 from votes v where v.user_id = c.id)
         or exists (select 1 from investments i where i.user_id = c.id)
         or exists (select 1 from checkins ck where ck.user_id = c.id)
         or exists (select 1 from submissions s where s.submitted_by = c.id and s.deleted_at is null)
      )::bigint,
    (select count(*) from cohort c
      where exists (select 1 from submissions s where s.submitted_by = c.id and s.deleted_at is null)
      )::bigint;
$$;

-- 新用户回访率，按注册日分组。
-- 「回访」的定义故意选成"注册当天之后还来过至少一次"，而不是常见的次日/7 日留存：
-- 后者要等 cohort 满 1 天 / 7 天才有意义，今天注册的人会显示 0%，看板上像掉量。
-- 这个定义对所有 cohort 都立即可读，代价是当天注册的人几乎必然是 0（页面上标注了这点）。
create or replace function analytics_retention(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Asia/Shanghai'
)
returns table (cohort_day date, cohort_size bigint, returned_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    (p.created_at at time zone p_tz)::date,
    count(*)::bigint,
    count(*) filter (
      where exists (
        select 1 from page_views pv
        where pv.user_id = p.id
          and (pv.created_at at time zone p_tz)::date > (p.created_at at time zone p_tz)::date
      )
    )::bigint
  from profiles p
  where p.created_at >= p_from and p.created_at < p_to
  group by 1
  order by 1 desc;
$$;

-- 等级分布。全站快照，不受时间区间影响——「现在各等级各有多少人」本身就是个存量问题。
create or replace function analytics_levels()
returns table (level_value integer, user_count bigint)
language sql
security definer
set search_path = public
as $$
  select coalesce(p.level, 0), count(*)::bigint
  from profiles p
  group by coalesce(p.level, 0)
  order by 1;
$$;

-- ========== 内容与审核 ==========

-- 审核效率 + 内容健康度。
-- pending_count 和 zero_comment_count 是存量（当前积压 / 当前零评论），不随区间变；
-- 其余是区间内发生的量。混在一个函数里是为了少一次往返，页面上分开标注。
create or replace function analytics_content_health(p_from timestamptz, p_to timestamptz)
returns table (
  approved_count bigint,
  rejected_count bigint,
  pending_count bigint,
  median_review_minutes numeric,
  p90_review_minutes numeric,
  zero_comment_count bigint,
  report_new_count bigint,
  report_resolved_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from moderation_queue q
      where q.reviewed_at >= p_from and q.reviewed_at < p_to and q.result = 'approved')::bigint,
    (select count(*) from moderation_queue q
      where q.reviewed_at >= p_from and q.reviewed_at < p_to and q.result = 'rejected')::bigint,
    (select count(*) from moderation_queue q where q.result = 'pending')::bigint,
    -- 中位数而不是平均值：一条放了三天没人管的记录会把平均值拉到没意义。
    -- 走 interval 版的 percentile_cont（order by 的是 interval 差值），再换算成分钟，
    -- 避免 numeric / double precision 两个重载之间的隐式转换。
    (select round(
        (extract(epoch from percentile_cont(0.5) within group (order by q.reviewed_at - q.created_at)) / 60)::numeric,
        1)
      from moderation_queue q
      where q.reviewed_at >= p_from and q.reviewed_at < p_to),
    -- P90 才是"最慢的那批等了多久"，运营承诺时效看这个。
    (select round(
        (extract(epoch from percentile_cont(0.9) within group (order by q.reviewed_at - q.created_at)) / 60)::numeric,
        1)
      from moderation_queue q
      where q.reviewed_at >= p_from and q.reviewed_at < p_to),
    -- 已发布但一条评论都没有的内容：运营最该去撬动的池子。
    (select count(*) from submissions s
      where s.status = 'published' and s.deleted_at is null
        and not exists (
          select 1 from comments c where c.submission_id = s.id and c.deleted_at is null
        ))::bigint,
    (select count(*) from comment_reports r
      where r.created_at >= p_from and r.created_at < p_to)::bigint,
    (select count(*) from comment_reports r
      where r.reviewed_at >= p_from and r.reviewed_at < p_to and r.status <> 'open')::bigint;
$$;

-- 互动量。content_visitor_count 放在这里是为了和投票 / 评论人数并排看：
-- 「内容页来了 N 个访客，其中只有 M 个投了票」才是可执行的结论，单看投票数看不出好坏。
create or replace function analytics_engagement(p_from timestamptz, p_to timestamptz)
returns table (
  vote_paid_count bigint,
  vote_creative_count bigint,
  voter_count bigint,
  investment_count bigint,
  invest_usd numeric,
  comment_vote_count bigint,
  commenter_count bigint,
  content_visitor_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from votes v
      where v.created_at >= p_from and v.created_at < p_to and v.vote_type = 'paid')::bigint,
    (select count(*) from votes v
      where v.created_at >= p_from and v.created_at < p_to and v.vote_type = 'creative')::bigint,
    (select count(distinct v.user_id) from votes v
      where v.created_at >= p_from and v.created_at < p_to)::bigint,
    (select count(*) from investments i
      where i.created_at >= p_from and i.created_at < p_to)::bigint,
    (select coalesce(sum(i.amount), 0) from investments i
      where i.created_at >= p_from and i.created_at < p_to and i.type = 'simulated'),
    (select count(*) from comment_votes cv
      where cv.created_at >= p_from and cv.created_at < p_to)::bigint,
    (select count(distinct c.user_id) from comments c
      where c.created_at >= p_from and c.created_at < p_to and c.deleted_at is null)::bigint,
    (select count(distinct pv.visitor_id) from page_views pv
      where pv.created_at >= p_from and pv.created_at < p_to and pv.content_id is not null)::bigint;
$$;

-- 未收录路径（404 / 失效外链）。埋点侧把这些路径的 route 归到了同一个兜底桶，
-- 但原始 path 照存，这个函数就是从那一桶里反查出"到底哪些链接被点了却打不开"。
-- 运营价值很直接：外站挂了错的链接、旧 URL 改版后没做跳转，都会在这里堆起来。
create or replace function analytics_unknown_paths(
  p_from timestamptz,
  p_to timestamptz,
  p_route text,
  p_limit integer default 10
)
returns table (path text, view_count bigint, visitor_count bigint)
language sql
security definer
set search_path = public
as $$
  select pv.path, count(*)::bigint, count(distinct pv.visitor_id)::bigint
  from page_views pv
  where pv.created_at >= p_from and pv.created_at < p_to
    and pv.route = p_route
  group by pv.path
  order by count(*) desc
  limit greatest(1, p_limit);
$$;

-- ========== 活动 ==========

-- 活动趋势：每天有多少人签到、抽了多少次、发出去多少经验。
-- 签到按 checkins.checkin_date 分组而不是 created_at——那一列本来就是按东八区的自然日存的，
-- 再做一次时区换算反而会把边界上的记录挪错天。
create or replace function analytics_activity_daily(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Asia/Shanghai'
)
returns table (day date, checkin_user_count bigint, draw_count bigint, xp_granted bigint)
language sql
security definer
set search_path = public
as $$
  with span as (
    select
      (p_from at time zone p_tz)::date as d_from,
      ((p_to at time zone p_tz) - interval '1 microsecond')::date as d_to
  ),
  axis as (
    -- 和 0019 的 analytics_daily 同款：显式转 timestamp，避开 generate_series 的重载歧义。
    select generate_series(
      (select span.d_from from span)::timestamp,
      (select span.d_to from span)::timestamp,
      interval '1 day'
    )::date as day
  ),
  ck as (
    select c.checkin_date as day, count(distinct c.user_id) as n
    from checkins c, span
    where c.checkin_date >= span.d_from and c.checkin_date <= span.d_to
    group by 1
  ),
  dr as (
    select (d.created_at at time zone p_tz)::date as day, count(*) as n
    from lottery_draws d
    where d.created_at >= p_from and d.created_at < p_to
    group by 1
  ),
  xp as (
    -- 只算正数：负数是抽奖消耗，混进来会把"今天发了多少经验"抵消掉。
    select (e.created_at at time zone p_tz)::date as day, sum(e.amount) as n
    from xp_events e
    where e.created_at >= p_from and e.created_at < p_to
      and e.revoked_at is null and e.amount > 0
    group by 1
  )
  select
    axis.day,
    coalesce(ck.n, 0)::bigint,
    coalesce(dr.n, 0)::bigint,
    coalesce(xp.n, 0)::bigint
  from axis
  left join ck on ck.day = axis.day
  left join dr on dr.day = axis.day
  left join xp on xp.day = axis.day
  order by axis.day;
$$;

-- 签到概览。
-- streak 相关的三个数只看"还活着"的连签（最后一次签到是今天或昨天）：
-- 一个人上个月连签 30 天然后消失了，把他算进"当前连签 7 天+"是自欺欺人。
create or replace function analytics_checkin_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Asia/Shanghai'
)
returns table (
  total_checkins bigint,
  checkin_user_count bigint,
  xp_awarded bigint,
  avg_streak numeric,
  streak_7plus_count bigint,
  longest_streak integer
)
language sql
security definer
set search_path = public
as $$
  with span as (
    select
      (p_from at time zone p_tz)::date as d_from,
      ((p_to at time zone p_tz) - interval '1 microsecond')::date as d_to,
      (now() at time zone p_tz)::date as today
  ),
  ranged as (
    select c.user_id, c.xp_awarded
    from checkins c, span
    where c.checkin_date >= span.d_from and c.checkin_date <= span.d_to
  ),
  latest as (
    -- 每个人最近一次签到（distinct on 需要 order by 的前缀和它一致）
    select distinct on (c.user_id) c.user_id, c.checkin_date, c.streak
    from checkins c
    order by c.user_id, c.checkin_date desc
  ),
  alive as (
    select l.streak from latest l, span where l.checkin_date >= span.today - 1
  )
  select
    (select count(*) from ranged)::bigint,
    (select count(distinct r.user_id) from ranged r)::bigint,
    (select coalesce(sum(r.xp_awarded), 0) from ranged r)::bigint,
    (select round(avg(a.streak)::numeric, 1) from alive a),
    (select count(*) from alive a where a.streak >= 7)::bigint,
    (select coalesce(max(c.streak), 0) from checkins c);
$$;

-- 抽奖概览。券的收支是这里最重要的一组数：
-- tickets_outstanding 是全站还没花掉的券（运营的"负债"），
-- 它决定了接下来还会被抽走多少奖品，比"抽了多少次"更该盯。
create or replace function analytics_lottery_summary(p_from timestamptz, p_to timestamptz)
returns table (
  draw_count bigint,
  drawer_count bigint,
  xp_awarded bigint,
  xp_cost bigint,
  tickets_granted bigint,
  tickets_spent bigint,
  tickets_outstanding bigint,
  unfulfilled_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from lottery_draws d
      where d.created_at >= p_from and d.created_at < p_to)::bigint,
    (select count(distinct d.user_id) from lottery_draws d
      where d.created_at >= p_from and d.created_at < p_to)::bigint,
    (select coalesce(sum(d.xp_awarded), 0) from lottery_draws d
      where d.created_at >= p_from and d.created_at < p_to)::bigint,
    (select coalesce(sum(d.cost_xp), 0) from lottery_draws d
      where d.created_at >= p_from and d.created_at < p_to)::bigint,
    (select coalesce(sum(t.amount), 0) from lottery_ticket_events t
      where t.created_at >= p_from and t.created_at < p_to and t.amount > 0)::bigint,
    (select coalesce(-sum(t.amount), 0) from lottery_ticket_events t
      where t.created_at >= p_from and t.created_at < p_to and t.amount < 0)::bigint,
    -- 存量，不受区间影响
    (select coalesce(sum(p.lottery_tickets), 0) from profiles p)::bigint,
    -- 实物奖品（kind = 'item'）抽中了但还没标记发放的，运营要去发货
    (select count(*) from lottery_draws d
      where d.prize_kind = 'item' and d.fulfilled_at is null)::bigint;
$$;

-- 奖品中奖分布。按快照的名字分组（奖品可能已经被后台改名或删掉，
-- lottery_draws 里存的是当时的名字，这正是我们想看的"当时发出去的是什么"）。
create or replace function analytics_lottery_prizes(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 12
)
returns table (prize_name text, prize_icon text, draw_count bigint, winner_count bigint)
language sql
security definer
set search_path = public
as $$
  select d.prize_name, d.prize_icon, count(*)::bigint, count(distinct d.user_id)::bigint
  from lottery_draws d
  where d.created_at >= p_from and d.created_at < p_to
  group by d.prize_name, d.prize_icon
  order by count(*) desc
  limit greatest(1, p_limit);
$$;

-- 经验值发放来源。防刷用：如果 comment_posted 占了九成，说明有人在灌水刷等级，
-- 该去调 xp_rules 的 daily_cap 了。已撤销的流水（内容被删/驳回）不计。
create or replace function analytics_xp_breakdown(p_from timestamptz, p_to timestamptz)
returns table (action_key text, event_count bigint, amount_total bigint, user_count bigint)
language sql
security definer
set search_path = public
as $$
  select e.action, count(*)::bigint, coalesce(sum(e.amount), 0)::bigint, count(distinct e.user_id)::bigint
  from xp_events e
  where e.created_at >= p_from and e.created_at < p_to and e.revoked_at is null
  group by e.action
  order by sum(e.amount) desc nulls last;
$$;

-- ========== 一次性回填：把历史的未收录路径归桶 ==========
-- 0019 上线后发现 404 页面也会上报（Next 的 not-found 同样渲染根 layout），
-- 于是爬虫探路和失效外链的路径直接进了"热门页面"。埋点侧已经改成白名单归一
-- （见 src/lib/analytics.ts 的 ROUTE_LABEL / OTHER_ROUTE），这里把已经入库的老行补齐。
--
-- 下面这份清单必须和 ROUTE_LABEL 的 key 一致。它只在这一次回填里出现，
-- 不是运行时依赖——以后新增页面不需要回来改这段。
update page_views
set route = '/[未收录]', content_id = null
where route <> '/[未收录]'
  and route not in (
    '/', '/products', '/products/[id]', '/ideas', '/ideas/[id]', '/leaderboard',
    '/activities', '/submit', '/search', '/profile', '/u/[username]',
    '/faq', '/welcome', '/auth/sign-in'
  );

-- ========== 函数权限 ==========
-- 和 0019 结尾同一段：新加的函数默认 grant execute to public，必须收回，
-- 否则登录用户能通过 /rest/v1/rpc/... 直接拿到全站聚合数据。
-- 这个块按名字前缀匹配，重复执行是幂等的（0019 那批函数会被再收一遍，无副作用）。
do $$
declare
  fn record;
  v_has_service_role boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'analytics\_%' or p.proname = 'purge_expired_page_views')
  loop
    execute format('revoke all on function %s from public', fn.sig);
    if v_has_service_role then
      execute format('grant execute on function %s to service_role', fn.sig);
    end if;
  end loop;
end;
$$;
