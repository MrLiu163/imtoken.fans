-- 修 @提及 的一个真实 bug：Google 登录直接拿 full_name 当 username（handle_new_user，
-- 见 0002/0003_moderation_and_cards.sql），大小写和空格都不受控。评论里 @HONGBO LIU 这种
-- 用户名，正则只能捕到 "@HONGBO"（空格截断），链接 404，通知也发不出去——根子问题是
-- username 从注册那一刻起就没有按 normalizeUsername()（src/lib/username.ts）的规则校验，
-- 只有「用户名/密码」注册这一条路径走了这个校验，Google/钱包登录完全绕过了它。
--
-- 这个文件把这条规则收紧到数据库层：
--   1. 一个统一的归一化函数，新老数据都用它。
--   2. 回填已有的脏数据（本地这份库已经手动 PATCH 过一遍了，这里的 DO 块是幂等的，
--      重复跑不会有副作用，用于其他环境/以后又混进脏数据的情况）。
--   3. handle_new_user() 触发器以后也走这个函数，Google/钱包登录不会再产生带空格/大写的
--      username。
--   4. 最后加一个 check 约束，堵死以后任何写入路径再绕过这条规则的可能。

create or replace function public.normalize_username(raw text) returns text as $$
declare
  candidate text;
begin
  candidate := lower(coalesce(raw, ''));
  candidate := regexp_replace(candidate, '[^a-z0-9_]+', '_', 'g');
  candidate := regexp_replace(candidate, '_+', '_', 'g');
  candidate := trim(both '_' from candidate);
  if length(candidate) = 0 then
    candidate := 'user';
  end if;
  if length(candidate) < 3 then
    candidate := rpad(candidate, 3, '0');
  end if;
  return left(candidate, 20);
end;
$$ language plpgsql immutable;

-- ========== 回填已有的不合规 username ==========
do $$
declare
  row_record record;
  candidate text;
  base_candidate text;
  suffix int;
begin
  for row_record in
    select id, username from public.profiles
    where username is not null and username !~ '^[a-z0-9_]{3,20}$'
  loop
    base_candidate := public.normalize_username(row_record.username);
    candidate := base_candidate;
    suffix := 0;
    while exists (
      select 1 from public.profiles
      where username = candidate and id != row_record.id
    ) loop
      suffix := suffix + 1;
      candidate := left(base_candidate, 20 - length(suffix::text) - 1) || '_' || suffix::text;
    end loop;
    update public.profiles set username = candidate where id = row_record.id;
  end loop;
end $$;

-- ========== 以后的新用户也走同一套归一化 + 唯一性重试 ==========
create or replace function public.handle_new_user()
returns trigger as $$
declare
  member_count bigint;
  base_candidate text;
  candidate text;
  suffix int := 0;
begin
  base_candidate := public.normalize_username(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  ));
  candidate := base_candidate;

  loop
    begin
      insert into public.profiles (id, username, avatar_url, wallet_address)
      values (new.id, candidate, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'wallet_address')
      on conflict (id) do nothing; -- 触发器被重复触发（同一个 new.id）时，安静跳过，不算冲突
      exit;
    exception when unique_violation then
      -- 这里能走到，说明冲突来自 username 的唯一约束（不是上面 id 的 on conflict），换个带
      -- 数字后缀的候选名重试。suffix > 50 是防死循环的安全阀，理论上不会触发。
      suffix := suffix + 1;
      if suffix > 50 then
        insert into public.profiles (id, avatar_url, wallet_address)
        values (new.id, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'wallet_address')
        on conflict (id) do nothing;
        exit;
      end if;
      candidate := left(base_candidate, 20 - length(suffix::text) - 1) || '_' || suffix::text;
    end;
  end loop;

  -- 前 50 个用户自动拿 genesis_member 徽章（同 0003 的逻辑，未改动）。
  select count(*) into member_count from public.badges where badge_key = 'genesis_member';
  if member_count < 50 then
    insert into public.badges (user_id, badge_key, level)
    values (new.id, 'genesis_member', 1)
    on conflict (user_id, badge_key) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ========== 数据库层兜底：以后任何写入路径都不能再违反这条规则 ==========
alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
