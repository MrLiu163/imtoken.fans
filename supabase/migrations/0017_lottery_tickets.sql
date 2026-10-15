-- 抽奖券 + 抽奖活动时间。在 Supabase Dashboard -> SQL Editor 里执行（在 0016 之后）。
--
-- 抽奖从「每天免费 N 次」改成纯券制：手里没券就抽不了（按钮直接点不动）。
-- 券的来源有两个：
--   1. 管理员在后台给指定用户发放（用户管理页每一行都有发券入口）
--   2. 九宫格里的「抽奖券」奖品（相当于"再来一次"）
-- 注意由此带来的运营前提：新用户手里是 0 张券，第 2 条来源要先有券才够得着，
-- 所以**冷启动必须由管理员先发一批券**，否则谁都抽不了。
--
-- 签到不发券，只给经验值（perform_checkin 保持 0016 的实现，这个文件不改它）。

-- ========== 券余额 ==========
-- 和 xp 一样物化在 profiles 上：抽奖按钮下面要实时显示"我还有几张券"，
-- 每次都去流水表 sum 一遍不划算。
-- 安全性同 0016 的 xp/level：0004 的列级 GRANT 是白名单制，新列不在白名单里，
-- 普通用户改不了自己的券余额，只能通过下面的 SECURITY DEFINER 函数变动。
alter table profiles add column lottery_tickets integer not null default 0;

-- 券的收支流水。和 xp_events 一个套路：既是审计，也是"这张券哪来的、花哪了"的依据。
-- 不做幂等唯一索引——券的发放本来就允许重复（管理员可以连着发两次 5 张）。
create table lottery_ticket_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  amount integer not null, -- 正数 = 发放，负数 = 消耗
  reason text not null,    -- 'admin_grant' | 'lottery_prize' | 'draw_cost'
  detail jsonb,
  created_at timestamptz not null default now()
);

create index lottery_ticket_events_user_idx on lottery_ticket_events (user_id, created_at desc);

alter table lottery_ticket_events enable row level security;

-- 和 xp_events 同款：本人可读，写入只能走 SECURITY DEFINER 函数 / service_role。
create policy "users can read own ticket events" on lottery_ticket_events
  for select using (user_id = auth.uid());

-- 发放 / 扣减抽奖券。余额不会被扣成负数（greatest(0, ...)），
-- 返回实际变动量，调用方据此判断"到底扣掉了几张"。
create or replace function grant_lottery_tickets(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_detail jsonb default null
)
returns table (changed integer, new_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer;
  v_new integer;
begin
  if p_user_id is null or p_amount = 0 then
    return query select 0, coalesce((select lottery_tickets from profiles where id = p_user_id), 0);
    return;
  end if;

  -- for update：把「读余额 -> 算新值 -> 写回」变成原子操作，
  -- 并发发券 / 连点抽奖不会丢分也不会超扣。
  select lottery_tickets into v_old from profiles where id = p_user_id for update;
  if v_old is null then
    return query select 0, 0;
    return;
  end if;

  v_new := greatest(0, v_old + p_amount);
  update profiles set lottery_tickets = v_new where id = p_user_id;

  insert into lottery_ticket_events (user_id, amount, reason, detail)
  values (p_user_id, v_new - v_old, p_reason, p_detail);

  return query select v_new - v_old, v_new;
end;
$$;

-- ========== 抽奖设置：券成本 + 活动时间 ==========
-- cost_tickets：每次抽奖消耗几张券，这是现在唯一的门槛。
-- starts_at / ends_at：活动开放时间，null = 该侧不限制（都为 null 就是长期开放）。
--   放在配置表而不是代码里，运营就能自己安排"双十一三天抽奖"这种档期。
-- draws_per_day 的语义随之改变：不再是"每天免费几次"，而是"每天最多抽几次"的可选上限
--   （0 = 不限，只受券约束）。默认改成 0——券本身就是限制了，再叠一层容易让人困惑；
--   留着它是为了万一运营一次性发多了券，能临时踩一脚刹车。
alter table lottery_settings
  add column cost_tickets integer not null default 1 check (cost_tickets between 1 and 10),
  add column starts_at timestamptz,
  add column ends_at timestamptz;

alter table lottery_settings drop constraint lottery_settings_draws_per_day_check;
alter table lottery_settings
  add constraint lottery_settings_draws_per_day_check check (draws_per_day between 0 and 1000);

-- 结束时间必须晚于开始时间，不然会配出一个永远抽不了的活动。
alter table lottery_settings
  add constraint lottery_settings_window_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

update lottery_settings set draws_per_day = 0 where id = true;

-- ========== 抽奖券作为奖品 ==========
alter table lottery_prizes drop constraint lottery_prizes_kind_check;
alter table lottery_prizes
  add constraint lottery_prizes_kind_check check (kind in ('xp', 'badge', 'item', 'ticket', 'none'));

alter table lottery_prizes
  add column ticket_amount integer not null default 0 check (ticket_amount >= 0);

-- 把「20 经验值」那一格换成「抽奖券 ×1」（相当于"再来一次"），
-- 让券在九宫格里有个默认出处。运营随时能在后台改回去。
update lottery_prizes
set name = '抽奖券 ×1', icon = '🎟️', kind = 'ticket', xp_amount = 0, ticket_amount = 1
where position = 5;

-- 中奖记录带上券的收支，后台对账时能看清这一抽花了几张、赢了几张。
alter table lottery_draws
  add column cost_tickets integer not null default 0,
  add column tickets_awarded integer not null default 0;

-- ========== 抽奖：活动时间 + 消耗券 ==========
-- 返回值多了券相关的列，而 create or replace 不允许改返回类型，只能先 drop。
drop function if exists perform_lottery_draw(uuid);

create or replace function perform_lottery_draw(p_user_id uuid)
returns table (
  ok boolean, message text, prize_id uuid, prize_name text, prize_icon text, prize_kind text,
  prize_position integer, xp_awarded integer, tickets_awarded integer, ticket_balance integer,
  new_xp integer, old_level integer, new_level integer, draws_left integer
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
  v_tickets integer;
  v_total_weight bigint;
  v_roll numeric;
  v_acc bigint := 0;
  v_candidate record;
  v_chosen_id uuid;
  -- 中奖的那一格用标量变量逐个接住：条件更新有可能一行都没改到（库存被别人抢完），
  -- 这时所有变量保持 null，判断 v_claimed_id is null 就够了。
  v_claimed_id uuid;
  v_claimed_name text;
  v_claimed_icon text;
  v_claimed_kind text;
  v_claimed_badge text;
  v_claimed_xp integer;
  v_claimed_tickets integer;
  v_claimed_position integer;
  v_award record;
  v_ticket record;
  v_xp_gain integer := 0;
  v_ticket_gain integer := 0;
  v_balance integer;
  -- draws_left 只在设了每日上限时才有意义，不限时统一回 -1，应用层据此转成 null。
  v_draws_left integer;
begin
  select * into v_settings from lottery_settings where id = true;
  if not found or not v_settings.enabled then
    return query select false, '抽奖暂未开放'::text, null::uuid, ''::text, ''::text, ''::text, null::integer,
      0, 0, coalesce((select lottery_tickets from profiles where id = p_user_id), 0),
      coalesce((select xp from profiles where id = p_user_id), 0), 0, 0, -1;
    return;
  end if;

  -- 活动时间校验放在最前面：档期之外连券都不该扣。
  if v_settings.starts_at is not null and now() < v_settings.starts_at then
    return query select false, '抽奖活动还没开始'::text, null::uuid, ''::text, ''::text, ''::text,
      null::integer, 0, 0, coalesce((select lottery_tickets from profiles where id = p_user_id), 0),
      coalesce((select xp from profiles where id = p_user_id), 0), 0, 0, -1;
    return;
  end if;

  if v_settings.ends_at is not null and now() >= v_settings.ends_at then
    return query select false, '抽奖活动已经结束了'::text, null::uuid, ''::text, ''::text, ''::text,
      null::integer, 0, 0, coalesce((select lottery_tickets from profiles where id = p_user_id), 0),
      coalesce((select xp from profiles where id = p_user_id), 0), 0, 0, -1;
    return;
  end if;

  -- 锁住用户行：同一个人的并发抽奖请求会排队，券和次数都不会被绕过。
  select xp, lottery_tickets into v_xp, v_tickets from profiles where id = p_user_id for update;
  if v_xp is null then
    return query select false, '用户不存在'::text, null::uuid, ''::text, ''::text, ''::text, null::integer,
      0, 0, 0, 0, 0, 0, -1;
    return;
  end if;

  -- 每日上限是可选的，设成 0 时连这次 count 都不用查。
  if v_settings.draws_per_day > 0 then
    select count(*) into v_used from lottery_draws
     where user_id = p_user_id and created_at >= v_day_start;
    v_draws_left := greatest(0, v_settings.draws_per_day - v_used);
  else
    v_draws_left := -1;
  end if;

  if v_draws_left = 0 then
    return query select false, '今天的抽奖次数已经用完了'::text, null::uuid, ''::text, ''::text, ''::text,
      null::integer, 0, 0, v_tickets, v_xp, 0, 0, 0;
    return;
  end if;

  if v_tickets < v_settings.cost_tickets then
    return query select false,
      format('抽奖券不够了，每次抽奖需要 %s 张', v_settings.cost_tickets)::text,
      null::uuid, ''::text, ''::text, ''::text, null::integer, 0, 0, v_tickets, v_xp, 0, 0, v_draws_left;
    return;
  end if;

  if v_settings.cost_xp > 0 and v_xp < v_settings.cost_xp then
    return query select false,
      format('经验值不足，每次抽奖需要 %s 点', v_settings.cost_xp)::text,
      null::uuid, ''::text, ''::text, ''::text, null::integer, 0, 0, v_tickets, v_xp, 0, 0, v_draws_left;
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
     returning id, name, icon, kind, badge_key, xp_amount, ticket_amount, position
     into v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
          v_claimed_badge, v_claimed_xp, v_claimed_tickets, v_claimed_position;
  end if;

  if v_claimed_id is null then
    update lottery_prizes set awarded_count = awarded_count + 1
     where id = (select id from lottery_prizes where active and is_thanks order by position limit 1)
     returning id, name, icon, kind, badge_key, xp_amount, ticket_amount, position
     into v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
          v_claimed_badge, v_claimed_xp, v_claimed_tickets, v_claimed_position;
  end if;

  if v_claimed_id is null then
    return query select false, '奖品已经全部抽完了，等运营补货吧'::text, null::uuid, ''::text, ''::text,
      ''::text, null::integer, 0, 0, v_tickets, v_xp, 0, 0, v_draws_left;
    return;
  end if;

  -- 先扣成本（券 + 可选的经验），再发奖品，两边都留流水，账目清楚。
  select * into v_ticket from grant_lottery_tickets(
    p_user_id, -v_settings.cost_tickets, 'draw_cost', jsonb_build_object('prize', v_claimed_name)
  );
  v_balance := v_ticket.new_balance;

  if v_settings.cost_xp > 0 then
    perform award_xp(p_user_id, 'lottery_cost', -v_settings.cost_xp, 'lottery', null,
      jsonb_build_object('reason', 'draw_cost'));
  end if;

  if v_claimed_kind = 'xp' and v_claimed_xp > 0 then
    v_xp_gain := v_claimed_xp;
  end if;

  -- 中了「抽奖券」奖品：把券加回去（净效果就是"再来一次"）。
  if v_claimed_kind = 'ticket' and v_claimed_tickets > 0 then
    v_ticket_gain := v_claimed_tickets;
    select * into v_ticket from grant_lottery_tickets(
      p_user_id, v_ticket_gain, 'lottery_prize', jsonb_build_object('prize', v_claimed_name)
    );
    v_balance := v_ticket.new_balance;
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

  insert into lottery_draws (
    user_id, prize_id, prize_name, prize_icon, prize_kind,
    xp_awarded, cost_xp, cost_tickets, tickets_awarded
  )
  values (
    p_user_id, v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
    v_xp_gain, v_settings.cost_xp, v_settings.cost_tickets, v_ticket_gain
  );

  return query select true, '抽奖成功'::text, v_claimed_id, v_claimed_name, v_claimed_icon, v_claimed_kind,
    v_claimed_position, v_xp_gain, v_ticket_gain, v_balance,
    v_award.new_xp, v_award.old_level, v_award.new_level,
    case when v_draws_left > 0 then v_draws_left - 1 else v_draws_left end;
end;
$$;

-- 函数一律只 grant 给 service_role（应用层用 admin client 走 RPC）。
-- drop 掉重建的函数会连同原来的 grant 一起没掉，所以这里要重新授权。
revoke all on function grant_lottery_tickets(uuid, integer, text, jsonb) from public;
revoke all on function perform_lottery_draw(uuid) from public;

grant execute on function grant_lottery_tickets(uuid, integer, text, jsonb) to service_role;
grant execute on function perform_lottery_draw(uuid) to service_role;
