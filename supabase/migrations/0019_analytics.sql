-- 访问数据看板。在 Supabase Dashboard -> SQL Editor 里执行（在 0018 之后）。
--
-- 目标是"够运营用"而不是"做一个 GA"：自己埋一张原始访问表，
-- 加一组聚合函数供后台看板调用。这样不用引第三方脚本（也就不用管 Cookie 同意弹窗），
-- 数据留在自己的库里，还能和 profiles / submissions 直接 join——
-- 「这个产品页被看了多少次」这种问题，第三方分析工具反而答不上来。
--
-- 隐私上刻意做了取舍：
--   * 不存 IP、不存 User-Agent 原文，只存归一化后的 device（desktop/mobile/tablet）
--   * referrer 只留域名，不留完整 URL（带查询参数的外链可能含隐私信息）
--   * visitor_id 是服务端下发的随机 uuid（httpOnly cookie），不是指纹
--   * 原始行只留 180 天，之后由 purge_expired_page_views() 删掉，聚合结论靠不了老数据就算了

-- ========== 原始访问记录 ==========
-- 用 identity 而不是 uuid 主键：这张表是全站写入量最大的（每次翻页一行），
-- bigint 自增的索引比随机 uuid 紧凑得多，而且这些行没有对外暴露 id 的需求。
create table page_views (
  id bigint generated always as identity primary key,
  -- path：真实访问的路径（/products/8f3e…）。route：把动态段折叠掉的模板（/products/[id]）。
  -- 两个都存，因为看板要问两种问题："哪类页面流量大"用 route，"哪个具体产品火"用 content_id。
  path text not null,
  route text not null,
  -- 内容页的 submission id，从 path 里解析出来（列表页 / 静态页为 null）。
  -- 故意不加外键：id 是从 URL 里来的，指向已删除或压根不存在的内容时，
  -- 埋点不该整条插入失败——查询侧用 join 天然过滤掉这些行。
  content_id uuid,
  visitor_id uuid not null,
  -- 登录用户才有值。用户注销时置空而不是删行，否则历史流量曲线会凭空缺一块。
  user_id uuid references profiles (id) on delete set null,
  referrer_host text,
  device text not null default 'desktop',
  -- 来自 CDN 的地理头（Vercel 的 x-vercel-ip-country 等），本地开发或自建部署下就是 null。
  country text,
  created_at timestamptz not null default now()
);

-- 三个索引对应看板的三种扫法：按时间切片（所有面板的 where 条件）、
-- 按页面聚合、按访客去重。写入侧多三个索引的代价可以接受——这表只有 insert，没有 update。
create index page_views_created_idx on page_views (created_at desc);
create index page_views_route_idx on page_views (route, created_at desc);
create index page_views_visitor_idx on page_views (visitor_id, created_at desc);
create index page_views_content_idx on page_views (content_id, created_at desc) where content_id is not null;

alter table page_views enable row level security;
-- 故意一条 policy 都不写：RLS 开着且无策略 = 除 service_role 之外谁都读不到、写不进。
-- 埋点接口（/api/analytics/track）和看板查询都走 service_role，权限检查在应用层做。

-- ========== 聚合函数 ==========
-- PostgREST 不能做 group by，所以每个面板配一个 SQL 函数。
-- 统一约定：p_from 含、p_to 不含（半开区间），这样相邻两段不会把边界那一行数两遍。
-- 函数体里一律用表别名引用列（pv.views 而不是裸 views），避免和 returns table 的输出列名撞名。

-- 天级时区。站点面向国内运营，"今天"按东八区切，不按 UTC——
-- 否则每天早上 8 点前的数据会被算到前一天，看曲线的人会以为掉量了。
-- 要换时区改这里的默认值（调用方也可以显式传）。

-- 顶部统计卡：一段时间内的总量。看板会用同样的参数再查一次上一段，算环比。
create or replace function analytics_summary(p_from timestamptz, p_to timestamptz)
returns table (
  views bigint,
  visitors bigint,
  member_views bigint,
  member_visitors bigint,
  new_users bigint,
  new_submissions bigint,
  new_comments bigint,
  new_votes bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from page_views pv where pv.created_at >= p_from and pv.created_at < p_to),
    (select count(distinct pv.visitor_id) from page_views pv where pv.created_at >= p_from and pv.created_at < p_to),
    (select count(*) from page_views pv
      where pv.created_at >= p_from and pv.created_at < p_to and pv.user_id is not null),
    (select count(distinct pv.user_id) from page_views pv
      where pv.created_at >= p_from and pv.created_at < p_to and pv.user_id is not null),
    (select count(*) from profiles p where p.created_at >= p_from and p.created_at < p_to),
    (select count(*) from submissions s
      where s.created_at >= p_from and s.created_at < p_to and s.deleted_at is null),
    (select count(*) from comments c
      where c.created_at >= p_from and c.created_at < p_to and c.deleted_at is null),
    (select count(*) from votes v where v.created_at >= p_from and v.created_at < p_to);
$$;

-- 趋势曲线。用 generate_series 生成完整日期轴再 left join：
-- 没有访问的那天必须返回 0 而不是缺行，否则折线图会把两个相隔三天的点直接连起来，
-- 看起来像"平稳增长"，其实中间断了。
create or replace function analytics_daily(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Asia/Shanghai'
)
returns table (
  day date,
  views bigint,
  visitors bigint,
  members bigint,
  new_users bigint,
  new_submissions bigint,
  new_comments bigint
)
language sql
security definer
set search_path = public
as $$
  with axis as (
    -- ::date::timestamp 是刻意写全的：只写到 ::date 时，generate_series 的
    -- timestamp / timestamptz 两个重载都能匹配（date 到两者都是隐式转换），
    -- Postgres 会挑 timestamptz 那个，于是日期轴会被会话时区再解释一遍。
    -- 转成不带时区的 timestamp 之后，这段就和会话时区无关了。
    select generate_series(
      (p_from at time zone p_tz)::date::timestamp,
      ((p_to at time zone p_tz) - interval '1 microsecond')::date::timestamp,
      interval '1 day'
    )::date as day
  ),
  pv as (
    select (v.created_at at time zone p_tz)::date as day,
           count(*) as views,
           count(distinct v.visitor_id) as visitors,
           count(distinct v.user_id) as members
    from page_views v
    where v.created_at >= p_from and v.created_at < p_to
    group by 1
  ),
  joined as (
    select (p.created_at at time zone p_tz)::date as day, count(*) as n
    from profiles p
    where p.created_at >= p_from and p.created_at < p_to
    group by 1
  ),
  posted as (
    select (s.created_at at time zone p_tz)::date as day, count(*) as n
    from submissions s
    where s.created_at >= p_from and s.created_at < p_to and s.deleted_at is null
    group by 1
  ),
  commented as (
    select (c.created_at at time zone p_tz)::date as day, count(*) as n
    from comments c
    where c.created_at >= p_from and c.created_at < p_to and c.deleted_at is null
    group by 1
  )
  select
    axis.day,
    coalesce(pv.views, 0)::bigint,
    coalesce(pv.visitors, 0)::bigint,
    coalesce(pv.members, 0)::bigint,
    coalesce(joined.n, 0)::bigint,
    coalesce(posted.n, 0)::bigint,
    coalesce(commented.n, 0)::bigint
  from axis
  left join pv        on pv.day = axis.day
  left join joined    on joined.day = axis.day
  left join posted    on posted.day = axis.day
  left join commented on commented.day = axis.day
  order by axis.day;
$$;

-- 哪类页面在被看（按折叠后的 route 聚合）。
create or replace function analytics_top_routes(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 12
)
returns table (route text, views bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  select pv.route, count(*)::bigint, count(distinct pv.visitor_id)::bigint
  from page_views pv
  where pv.created_at >= p_from and pv.created_at < p_to
  group by pv.route
  order by count(*) desc
  limit greatest(1, p_limit);
$$;

-- 哪个具体产品 / 点子在被看。这是自建埋点相对第三方工具最有价值的一张表：
-- 直接 join 出标题，运营不用拿 uuid 去数据库里对。
create or replace function analytics_top_content(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (
  submission_id uuid,
  submission_type text,
  title text,
  views bigint,
  visitors bigint
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.type::text, s.title, count(*)::bigint, count(distinct pv.visitor_id)::bigint
  from page_views pv
  join submissions s on s.id = pv.content_id
  where pv.created_at >= p_from and pv.created_at < p_to
    and pv.content_id is not null
    and s.deleted_at is null
  group by s.id, s.type, s.title
  order by count(*) desc
  limit greatest(1, p_limit);
$$;

-- 外部流量从哪来。站内跳转在埋点侧就被丢掉了（同域 referrer 不记），
-- 所以这里剩下的都是真的外链；referrer_host 为 null = 直接访问 / 无 referrer。
create or replace function analytics_referrers(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (referrer_host text, views bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  select pv.referrer_host, count(*)::bigint, count(distinct pv.visitor_id)::bigint
  from page_views pv
  where pv.created_at >= p_from and pv.created_at < p_to
  group by pv.referrer_host
  order by count(*) desc
  limit greatest(1, p_limit);
$$;

-- 设备分布：决定"下次改版先照顾哪个端"。
create or replace function analytics_devices(p_from timestamptz, p_to timestamptz)
returns table (device text, views bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  select pv.device, count(*)::bigint, count(distinct pv.visitor_id)::bigint
  from page_views pv
  where pv.created_at >= p_from and pv.created_at < p_to
  group by pv.device
  order by count(*) desc;
$$;

-- 地区分布。country 全是 null 时看板会整块隐藏（本地开发 / 没有地理头的部署环境）。
create or replace function analytics_countries(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (country text, views bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  select pv.country, count(*)::bigint, count(distinct pv.visitor_id)::bigint
  from page_views pv
  where pv.created_at >= p_from and pv.created_at < p_to and pv.country is not null
  group by pv.country
  order by count(*) desc
  limit greatest(1, p_limit);
$$;

-- 一天 24 小时的活跃分布，发公告 / 推送活动挑时间用。
-- 同样补齐 0-23 全部小时，缺的小时给 0（凌晨没人访问是信息，不是缺数据）。
create or replace function analytics_hourly(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Asia/Shanghai'
)
returns table (hour integer, views bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  with axis as (select generate_series(0, 23) as hour),
  pv as (
    select extract(hour from (v.created_at at time zone p_tz))::integer as hour,
           count(*) as views,
           count(distinct v.visitor_id) as visitors
    from page_views v
    where v.created_at >= p_from and v.created_at < p_to
    group by 1
  )
  select axis.hour, coalesce(pv.views, 0)::bigint, coalesce(pv.visitors, 0)::bigint
  from axis
  left join pv on pv.hour = axis.hour
  order by axis.hour;
$$;

-- ========== 原始数据保留期 ==========
-- 和回收站的 purge_expired_deleted_content() 一个套路：数据库里不一定开了 pg_cron，
-- 所以由应用在有人打开看板时顺手调一次。幂等，重复调用没有副作用。
create or replace function purge_expired_page_views(p_retention_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from page_views
  where created_at < now() - make_interval(days => greatest(1, p_retention_days));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ========== 函数权限 ==========
-- 这些函数是 security definer，绕过 RLS 返回全站聚合数据，绝不能让登录用户直接调
-- （Supabase 的 anon / authenticated 角色能通过 /rest/v1/rpc/... 调任何有 execute 权限的函数）。
-- Postgres 新建函数默认 grant execute to public，所以必须显式收回，只留给 service_role。
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
    -- 非 Supabase 环境里没有 service_role 这个角色，跳过授权而不是整个文件报错。
    if v_has_service_role then
      execute format('grant execute on function %s to service_role', fn.sig);
    end if;
  end loop;
end;
$$;
