-- 用户等级（经验值）体系 + 活动中心（每日签到 / 九宫格抽奖）。
-- 在 Supabase Dashboard -> SQL Editor 里执行（在 0001-0015 之后）。
--
-- 设计要点：
--   1. 经验值只能通过 SECURITY DEFINER 函数增减，应用层永远不会直接 UPDATE profiles.xp。
--      原因有两个：一是 xp 必须原子自增（读-改-写在并发下会丢分），
--      二是「等级」要跟着 xp 一起算好写回去，两件事必须在同一个事务里。
--   2. 每一次加/减分都在 xp_events 留痕，并靠 (user_id, action, ref_id) 唯一索引做幂等——
--      同一条评论/同一个提交不管触发多少次都只计一次分。
--   3. "一天"统一按 Asia/Shanghai 算（签到、每日计分上限、抽奖次数），
--      不用服务器时区也不用 UTC，否则用户跨时区时会出现「一天签两次」。

-- ========== profiles：经验值 / 等级 / 签到状态 ==========
-- level 是 xp 的派生值，但仍然物化成一列：列表页要按等级展示几十个用户，
-- 每行都算一遍函数不划算，而且 submission_cards 这类视图直接取列更简单。
alter table profiles
  add column xp integer not null default 0,
  add column level integer not null default 0,
  add column checkin_streak integer not null default 0,
  add column last_checkin_date date;

-- 安全性说明：这里不需要补 REVOKE/GRANT。0004_rls_hardening.sql 已经把 authenticated
-- 对 profiles 的 UPDATE 收紧到白名单列（0013 之后是 username/avatar_url/bio/display_name/
-- onboarded_at），新加的列默认不在白名单里，普通用户改不了自己的 xp/level，天然安全。

create index profiles_xp_idx on profiles (xp desc);

-- ========== 等级阈值 ==========
-- 累计经验值 -> 等级。和 src/lib/level.ts 里的 LEVEL_THRESHOLDS 是同一份数字，
-- 改一边一定要改另一边（这里算等级，前端画进度条）。
--   Lv0->1 100 / 1->2 500 / 2->3 1000 / 3->4 2000 / 4->5 4000
--   5->6 7000 / 6->7 10000 / 7->8 20000 / 8->9 30000 / 9->10 50000
-- 累计后：100 / 600 / 1600 / 3600 / 7600 / 14600 / 24600 / 44600 / 74600 / 124600
create or replace function level_for_xp(p_xp integer) returns integer
language sql immutable
as $$
  select case
    when p_xp >= 124600 then 10
    when p_xp >= 74600  then 9
    when p_xp >= 44600  then 8
    when p_xp >= 24600  then 7
    when p_xp >= 14600  then 6
    when p_xp >= 7600   then 5
    when p_xp >= 3600   then 4
    when p_xp >= 1600   then 3
    when p_xp >= 600    then 2
    when p_xp >= 100    then 1
    else 0
  end;
$$;

-- ========== 经验值规则（后台可配） ==========
-- action_key 是固定的一组（对应 src/lib/level.ts 的 XP_ACTION_INFO），后台只能改
-- 数值/开关/每日上限，不能凭空造出一个代码不认识的 key——所以这里不存中文名，
-- 文案跟 PERMISSION_INFO / BADGE_INFO 一样放在 TS 里。
create table xp_rules (
  action_key text primary key,
  amount integer not null default 0,
  -- 每天最多计分几次，0 = 不限。防的是「发一堆水评论刷等级」：
  -- 评论默认是不审核直接可见的（见 0008），没有上限就等于无门槛送经验。
  daily_cap integer not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

insert into xp_rules (action_key, amount, daily_cap) values
  ('comment_posted',          20,  5),   -- 回复消息
  ('submission_product',    1000,  0),   -- 发布产品（走审核，不需要上限）
  ('submission_idea',        300,  0),   -- 发布点子（同上）
  ('vote_cast',                5, 10),   -- 给产品/点子投票
  ('simulated_investment',    10,  5),   -- 模拟投资
  ('comment_upvote_received',  2, 20);   -- 自己的评论被别人点赞

-- ========== 经验值流水 ==========
-- 既是审计记录，也是幂等的依据，还兼做「每日计分上限」的计数来源。
-- revoked_at：内容被删除/驳回时把这条流水标记为已撤销并扣回经验（而不是删行），
-- 这样「删了又从回收站恢复」能原样把经验补回来，且重复撤销不会重复扣。
create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  action text not null,
  amount integer not null,
  ref_type text,
  ref_id uuid,
  detail jsonb,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index xp_events_user_created_idx on xp_events (user_id, created_at desc);
-- 幂等的核心：同一个用户 + 同一种行为 + 同一个对象只能有一条流水。
-- ref_id 为空的（签到、抽奖、管理员手动调整）不参与去重，所以用部分索引。
create unique index xp_events_ref_uniq on xp_events (user_id, action, ref_id) where ref_id is not null;

-- ========== 加减经验的唯一入口 ==========
-- 返回 awarded（这次实际加/减了多少，0 = 被幂等或上限挡住）+ 新的 xp + 升级前后的等级，
-- 应用层拿 old_level < new_level 判断要不要发升级通知。
create or replace function award_xp(
  p_user_id uuid,
  p_action text,
  p_amount integer,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_detail jsonb default null
)
returns table (awarded integer, new_xp integer, old_level integer, new_level integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing xp_events;
  v_old_xp integer;
  v_new_xp integer;
begin
  if p_user_id is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  if p_ref_id is not null then
    select * into v_existing from xp_events
     where user_id = p_user_id and action = p_action and ref_id = p_ref_id
     for update;

    if found then
      if v_existing.revoked_at is null then
        -- 已经发过了：幂等返回，不重复加分。
        return query select 0,
          coalesce((select xp from profiles where id = p_user_id), 0),
          coalesce((select level from profiles where id = p_user_id), 0),
          coalesce((select level from profiles where id = p_user_id), 0);
        return;
      end if;
      -- 之前被撤销过（内容删了又恢复）：重新激活这条流水，按当前规则的金额补回。
      update xp_events set revoked_at = null, amount = p_amount where id = v_existing.id;
    else
      begin
        insert into xp_events (user_id, action, amount, ref_type, ref_id, detail)
        values (p_user_id, p_action, p_amount, p_ref_type, p_ref_id, p_detail);
      exception when unique_violation then
        -- 并发下两个请求同时走到这里，后到的那个当成"已经发过"处理。
        return query select 0,
          coalesce((select xp from profiles where id = p_user_id), 0),
          coalesce((select level from profiles where id = p_user_id), 0),
          coalesce((select level from profiles where id = p_user_id), 0);
        return;
      end;
    end if;
  else
    insert into xp_events (user_id, action, amount, ref_type, ref_id, detail)
    values (p_user_id, p_action, p_amount, p_ref_type, null, p_detail);
  end if;

  -- for update 锁住这一行，把「读旧值 -> 算新值 -> 写回」变成原子操作。
  select xp into v_old_xp from profiles where id = p_user_id for update;
  if v_old_xp is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  v_new_xp := greatest(0, v_old_xp + p_amount);
  update profiles set xp = v_new_xp, level = level_for_xp(v_new_xp) where id = p_user_id;

  return query select p_amount, v_new_xp, level_for_xp(v_old_xp), level_for_xp(v_new_xp);
end;
$$;

-- 按后台配置的规则加分：金额、开关、每日上限都从 xp_rules 读，
-- 所以应用层只需要说"这个人做了什么"，不需要知道值多少分。
create or replace function award_xp_by_rule(
  p_user_id uuid,
  p_action text,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_detail jsonb default null
)
returns table (awarded integer, new_xp integer, old_level integer, new_level integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule xp_rules;
  v_today_count integer;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai';
begin
  select * into v_rule from xp_rules where action_key = p_action;

  if not found or not v_rule.enabled or v_rule.amount = 0 then
    return query select 0,
      coalesce((select xp from profiles where id = p_user_id), 0),
      coalesce((select level from profiles where id = p_user_id), 0),
      coalesce((select level from profiles where id = p_user_id), 0);
    return;
  end if;

  if v_rule.daily_cap > 0 then
    -- 注意统计的是"今天为这个行为产生的流水条数"，包含已撤销的：
    -- 否则「发评论拿分 -> 删掉 -> 再发」就能绕过上限。
    select count(*) into v_today_count from xp_events
     where user_id = p_user_id and action = p_action and created_at >= v_day_start;

    -- 已经为这个对象计过分的情况要放行进 award_xp，让它走幂等分支（返回 0），
    -- 而不是在这里被上限挡住——两者的返回值一样，但语义清楚些。
    if v_today_count >= v_rule.daily_cap and not exists (
      select 1 from xp_events
       where user_id = p_user_id and action = p_action and p_ref_id is not null and ref_id = p_ref_id
    ) then
      return query select 0,
        coalesce((select xp from profiles where id = p_user_id), 0),
        coalesce((select level from profiles where id = p_user_id), 0),
        coalesce((select level from profiles where id = p_user_id), 0);
      return;
    end if;
  end if;

  return query select * from award_xp(p_user_id, p_action, v_rule.amount, p_ref_type, p_ref_id, p_detail);
end;
$$;

-- 撤销某个对象带来的经验（内容被删除 / 审核驳回时调用）。
-- 幂等：已经撤销过的流水不会被扣第二次。
create or replace function revoke_xp(p_user_id uuid, p_action text, p_ref_id uuid)
returns table (revoked integer, new_xp integer, old_level integer, new_level integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount integer;
  v_old_xp integer;
  v_new_xp integer;
begin
  update xp_events set revoked_at = now()
   where user_id = p_user_id and action = p_action and ref_id = p_ref_id and revoked_at is null
   returning amount into v_amount;

  if v_amount is null or v_amount <= 0 then
    return query select 0,
      coalesce((select xp from profiles where id = p_user_id), 0),
      coalesce((select level from profiles where id = p_user_id), 0),
      coalesce((select level from profiles where id = p_user_id), 0);
    return;
  end if;

  select xp into v_old_xp from profiles where id = p_user_id for update;
  if v_old_xp is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  v_new_xp := greatest(0, v_old_xp - v_amount);
  update profiles set xp = v_new_xp, level = level_for_xp(v_new_xp) where id = p_user_id;

  return query select v_amount, v_new_xp, level_for_xp(v_old_xp), level_for_xp(v_new_xp);
end;
$$;

-- ========== 每日签到 ==========
-- 单行配置表，id 恒为 true（check 约束保证只可能有一行），
-- 这样 update 不需要 where 条件，也不可能出现"两份配置"。
create table checkin_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  cycle_length integer not null default 7 check (cycle_length between 1 and 31),
  -- 第 N 天的经验值奖励，下标 1..cycle_length（Postgres 数组默认 1-based）。
  day_rewards integer[] not null default '{10,10,10,10,10,10,50}',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

insert into checkin_settings (id) values (true);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  -- 按 Asia/Shanghai 的自然日存，唯一约束顺带把"一天只能签一次"钉死在数据库层。
  checkin_date date not null,
  day_index integer not null,  -- 落在周期里的第几天（1..cycle_length），决定拿多少经验
  streak integer not null,     -- 当时的连续天数（会一直累加，不因周期结束而清零）
  xp_awarded integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create index checkins_user_date_idx on checkins (user_id, checkin_date desc);

-- 签到：连续天数、断签重置、周期内第几天、发经验，全在一个事务里完成。
-- 断签的定义就一条：昨天没签 -> streak 归 1。
create or replace function perform_checkin(p_user_id uuid)
returns table (
  ok boolean, message text, day_index integer, streak integer,
  xp_awarded integer, new_xp integer, old_level integer, new_level integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings checkin_settings;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_last date;
  v_streak integer;
  v_day integer;
  v_reward integer;
  v_award record;
begin
  select * into v_settings from checkin_settings where id = true;
  if not found or not v_settings.enabled then
    return query select false, '签到暂未开放'::text, 0, 0, 0,
      coalesce((select xp from profiles where id = p_user_id), 0), 0, 0;
    return;
  end if;

  select last_checkin_date, checkin_streak into v_last, v_streak
    from profiles where id = p_user_id for update;
  if not found then
    return query select false, '用户不存在'::text, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  if v_last = v_today then
    return query select false, '今天已经签到过了'::text, 0, coalesce(v_streak, 0), 0,
      coalesce((select xp from profiles where id = p_user_id), 0), 0, 0;
    return;
  end if;

  if v_last = v_today - 1 then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  -- 周而复始：第 8 天回到周期里的第 1 天。streak 本身继续累加（用来展示"已连续 N 天"）。
  v_day := ((v_streak - 1) % v_settings.cycle_length) + 1;
  v_reward := coalesce(v_settings.day_rewards[v_day], 0);

  -- unique (user_id, checkin_date) 是并发下的最后一道闸：两个请求同时进来，
  -- 后到的那个会抛唯一冲突，整个函数回滚，不会重复发经验。
  insert into checkins (user_id, checkin_date, day_index, streak, xp_awarded)
  values (p_user_id, v_today, v_day, v_streak, v_reward);

  update profiles set checkin_streak = v_streak, last_checkin_date = v_today where id = p_user_id;

  select * into v_award from award_xp(
    p_user_id, 'daily_checkin', v_reward, 'checkin', null,
    jsonb_build_object('date', v_today, 'day_index', v_day, 'streak', v_streak)
  );

  return query select true, '签到成功'::text, v_day, v_streak, v_reward,
    v_award.new_xp, v_award.old_level, v_award.new_level;
end;
$$;

-- ========== 九宫格抽奖 ==========
create table lottery_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  draws_per_day integer not null default 1 check (draws_per_day between 0 and 100),
  -- 每次抽奖消耗的经验值，0 = 免费。用来给"无限刷抽奖"加一点成本。
  cost_xp integer not null default 0 check (cost_xp >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null
);

insert into lottery_settings (id) values (true);

-- position：九宫格外圈的顺序位（0..7，中间那格是抽奖按钮，不是奖品）。
-- weight：中奖概率权重（不是百分比），实际概率 = weight / 所有可抽奖品的 weight 之和。
-- stock：获奖人数上限，null = 不限量。
-- is_thanks：兜底奖位。所有限量奖品都抽完时必须还有东西可发，否则抽奖会直接报错，
--            所以后台至少要保留一个不限量的兜底奖位。
create table lottery_prizes (
  id uuid primary key default gen_random_uuid(),
  position integer not null check (position between 0 and 7),
  name text not null,
  icon text not null default '🎁',
  kind text not null default 'xp' check (kind in ('xp', 'badge', 'item', 'none')),
  xp_amount integer not null default 0 check (xp_amount >= 0),
  badge_key text,
  weight integer not null default 0 check (weight >= 0),
  stock integer check (stock is null or stock >= 0),
  awarded_count integer not null default 0,
  is_thanks boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (position)
);

insert into lottery_prizes (position, name, icon, kind, xp_amount, badge_key, weight, stock, is_thanks) values
  (0, '100 经验值',    '🎁', 'xp',    100, null,          20, null, false),
  (1, '50 经验值',     '🎫', 'xp',     50, null,          25, null, false),
  (2, '1000 经验值',   '💎', 'xp',   1000, null,           2,   10, false),
  (3, '谢谢参与',      '🍀', 'none',    0, null,          30, null, true),
  (4, '500 经验值',    '🏆', 'xp',    500, null,           8,   50, false),
  (5, '20 经验值',     '🧧', 'xp',     20, null,          30, null, false),
  (6, '内测成员徽章',  '🧪', 'badge',   0, 'beta_tester',  5,   30, false),
  (7, 'iCoin 徽章',    '⭐', 'badge',   0, 'icoin',        3,   20, false);

create table lottery_draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  -- 奖品可能被后台删掉，但中奖记录要留着，所以外键 set null + 快照名字和图标。
  prize_id uuid references lottery_prizes (id) on delete set null,
  prize_name text not null,
  prize_icon text not null default '🎁',
  prize_kind text not null default 'xp',
  xp_awarded integer not null default 0,
  cost_xp integer not null default 0,
  -- 实物奖品的发放状态：后台在中奖记录里标记「已发放」。
  fulfilled_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

create index lottery_draws_user_idx on lottery_draws (user_id, created_at desc);
create index lottery_draws_created_idx on lottery_draws (created_at desc);

-- 抽奖：次数校验、扣经验、按权重选奖、扣库存、发奖、记账，全在一个事务里。
-- 库存靠 update ... where awarded_count < stock 的条件更新保证不会超发；
-- 抢空了就退回兜底奖位。
create or replace function perform_lottery_draw(p_user_id uuid)
returns table (
  ok boolean, message text, prize_id uuid, prize_name text, prize_icon text, prize_kind text,
  prize_position integer, xp_awarded integer, new_xp integer,
  old_level integer, new_level integer, draws_left integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings lottery_settings;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai';
  v_used integer;
  v_xp integer;
  v_total_weight bigint;
  v_roll numeric;
  v_acc bigint := 0;
  v_candidate record;
  v_chosen_id uuid;
  -- 中奖的那一格，用标量变量逐个接住（而不是一个 rowtype 变量）：
  -- 条件更新有可能一行都没改到（库存被别人抢完），这时所有变量保持 null，
  -- 判断 v_claimed_id is null 就够了，不需要对一个可能为 null 的复合值取字段。
  v_claimed_id uuid;
  v_claimed_name text;
  v_claimed_icon text;
  v_claimed_kind text;
  v_claimed_badge text;
  v_claimed_xp integer;
  v_claimed_position integer;
  v_award record;
  v_xp_gain integer := 0;
begin
  select * into v_settings from lottery_settings where id = true;
  if not found or not v_settings.enabled then
    return query select false, '抽奖暂未开放'::text, null::uuid, ''::text, ''::text, ''::text, null::integer,
      0, coalesce((select xp from profiles where id = p_user_id), 0), 0, 0, 0;
    return;
  end if;

  -- 锁住用户行：同一个人的并发抽奖请求会排队，次数校验和扣经验都不会被绕过。
  select xp into v_xp from profiles where id = p_user_id for update;
  if v_xp is null then
    return query select false, '用户不存在'::text, null::uuid, ''::text, ''::text, ''::text, null::integer,
      0, 0, 0, 0, 0;
    return;
  end if;

  select count(*) into v_used from lottery_draws
   where user_id = p_user_id and created_at >= v_day_start;

  if v_used >= v_settings.draws_per_day then
    return query select false, '今天的抽奖次数已经用完了'::text, null::uuid, ''::text, ''::text, ''::text,
      null::integer, 0, v_xp, 0, 0, 0;
    return;
  end if;

  if v_settings.cost_xp > 0 and v_xp < v_settings.cost_xp then
    return query select false,
      format('经验值不足，每次抽奖需要 %s 点', v_settings.cost_xp)::text,
      null::uuid, ''::text, ''::text, ''::text, null::integer, 0, v_xp, 0, 0,
      v_settings.draws_per_day - v_used;
    return;
  end if;

  -- 按权重随机选一个还有库存的奖品。
  select coalesce(sum(weight), 0) into v_total_weight from lottery_prizes
   where active and weight > 0 and (stock is null or awarded_count < stock);

  if v_total_weight > 0 then
    v_roll := random() * v_total_weight;
    for v_candidate in
      select id, weight from lottery_prizes
       where active and weight > 0 and (stock is null or awarded_count < stock)
       order by position
    loop
      v_acc := v_acc + v_candidate.weight;
      if v_roll < v_acc then
        v_chosen_id := v_candidate.id;
        exit;
      end if;
    end loop;
  end if;

  -- 条件更新扣库存：并发下只有一个请求能把最后一件奖品拿走，
  -- 抢不到（或压根没有可抽奖品）就退回兜底奖位。
  if v_chosen_id is not null then
    update lottery_prizes set awarded_count = awarded_count + 1
     where id = v_chosen_id and (stock is null or awarded_count < stock)
     returning id, name, icon, kind, badge_key, xp_amount, position
     into v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
          v_claimed_badge, v_claimed_xp, v_claimed_position;
  end if;

  if v_claimed_id is null then
    update lottery_prizes set awarded_count = awarded_count + 1
     where id = (select id from lottery_prizes where active and is_thanks order by position limit 1)
     returning id, name, icon, kind, badge_key, xp_amount, position
     into v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
          v_claimed_badge, v_claimed_xp, v_claimed_position;
  end if;

  if v_claimed_id is null then
    return query select false, '奖品已经全部抽完了，等运营补货吧'::text, null::uuid, ''::text, ''::text,
      ''::text, null::integer, 0, v_xp, 0, 0, v_settings.draws_per_day - v_used;
    return;
  end if;

  -- 先扣抽奖成本，再发奖品经验，两笔都留在流水里，账目清楚。
  if v_settings.cost_xp > 0 then
    perform award_xp(p_user_id, 'lottery_cost', -v_settings.cost_xp, 'lottery', null,
      jsonb_build_object('reason', 'draw_cost'));
  end if;

  if v_claimed_kind = 'xp' and v_claimed_xp > 0 then
    v_xp_gain := v_claimed_xp;
  end if;

  select * into v_award from award_xp(
    p_user_id, 'lottery_prize', v_xp_gain, 'lottery', null,
    jsonb_build_object('prize', v_claimed_name, 'kind', v_claimed_kind)
  );

  if v_claimed_kind = 'badge' and v_claimed_badge is not null then
    insert into badges (user_id, badge_key, level, note)
    values (p_user_id, v_claimed_badge, 1, '抽奖获得')
    on conflict (user_id, badge_key) do nothing;
  end if;

  insert into lottery_draws (user_id, prize_id, prize_name, prize_icon, prize_kind, xp_awarded, cost_xp)
  values (p_user_id, v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind, v_xp_gain, v_settings.cost_xp);

  return query select true, '抽奖成功'::text, v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
    v_claimed_position, v_xp_gain, v_award.new_xp, v_award.old_level, v_award.new_level,
    v_settings.draws_per_day - v_used - 1;
end;
$$;

-- ========== 升级通知 ==========
-- 升级通知没有"触发人"（actor_id 为空），也不挂在某条内容上，
-- 所以需要 detail 存新等级，通知铃铛为这一类做单独渲染。
-- 注：Postgres 12+ 允许在事务块里 ADD VALUE（只是不能在同一个事务里使用这个新值，
-- 本文件也没有用到），所以整份文件一次执行没问题。万一你的 SQL 客户端报
-- "ALTER TYPE ... cannot run inside a transaction block"，把这一行单独执行一次即可。
alter type notification_type add value if not exists 'level_up';
alter table notifications add column detail jsonb;

-- ========== RLS ==========
alter table xp_rules enable row level security;
alter table xp_events enable row level security;
alter table checkin_settings enable row level security;
alter table checkins enable row level security;
alter table lottery_settings enable row level security;
alter table lottery_prizes enable row level security;
alter table lottery_draws enable row level security;

-- 配置类（规则、签到设置、奖品、抽奖设置）公开可读：活动页要把"怎么拿经验、
-- 有哪些奖品、概率多少"直接摆给用户看。写入一律走 service_role（后台 Server Action）。
create policy "xp rules are publicly readable" on xp_rules for select using (true);
create policy "checkin settings are publicly readable" on checkin_settings for select using (true);
create policy "lottery settings are publicly readable" on lottery_settings for select using (true);
create policy "lottery prizes are publicly readable" on lottery_prizes for select using (true);

-- 流水/签到记录只有本人（和 service_role）能看：别人拿了多少分不该被逐条翻出来。
create policy "users can read own xp events" on xp_events for select using (user_id = auth.uid());
create policy "users can read own checkins" on checkins for select using (user_id = auth.uid());

-- 中奖记录公开可读：活动页要展示"最近谁中了什么"（这也是抽奖最能带动参与的部分）。
create policy "lottery draws are publicly readable" on lottery_draws for select using (true);

-- 上面这些表一律没有 insert/update/delete 策略——和 badges / notifications 同一个套路，
-- 所有写入都必须经过 SECURITY DEFINER 函数或 service_role，用户伪造不了经验和中奖记录。

-- 函数只放开给 service_role 调（应用层用 admin client 走 RPC）。
-- 必须显式 grant：默认 EXECUTE 是给 PUBLIC 的，revoke 之后 service_role 也会一起失去执行权。
revoke all on function award_xp(uuid, text, integer, text, uuid, jsonb) from public;
revoke all on function award_xp_by_rule(uuid, text, text, uuid, jsonb) from public;
revoke all on function revoke_xp(uuid, text, uuid) from public;
revoke all on function perform_checkin(uuid) from public;
revoke all on function perform_lottery_draw(uuid) from public;

grant execute on function award_xp(uuid, text, integer, text, uuid, jsonb) to service_role;
grant execute on function award_xp_by_rule(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function revoke_xp(uuid, text, uuid) to service_role;
grant execute on function perform_checkin(uuid) to service_role;
grant execute on function perform_lottery_draw(uuid) to service_role;

-- ========== submission_cards 视图带上提交者等级 ==========
-- 详情页/列表页在提交者名字旁边显示等级徽章。
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
  s.deleted_at,
  p.level as submitted_by_level
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

-- ========== （可选）老用户历史经验回填 ==========
-- 目前站上多是测试数据，正式上线前会清库，所以这段默认注释掉。
-- 如果想让老用户不至于全是 Lv0，可以单独执行下面这段（按已发布内容补发经验，
-- 只写 profiles.xp/level，不产生流水、不发升级通知）：
--
-- update profiles p set xp = sub.total, level = level_for_xp(sub.total)
-- from (
--   select
--     pr.id,
--     coalesce((select count(*) * 1000 from submissions s
--                where s.submitted_by = pr.id and s.type = 'product'
--                  and s.status = 'published' and s.deleted_at is null), 0)
--   + coalesce((select count(*) * 300 from submissions s
--                where s.submitted_by = pr.id and s.type = 'idea'
--                  and s.status = 'published' and s.deleted_at is null), 0)
--   + coalesce((select count(*) * 20 from comments c
--                where c.user_id = pr.id and c.status = 'published' and c.deleted_at is null), 0)
--     as total
--   from profiles pr
-- ) sub
-- where p.id = sub.id and sub.total > 0;
