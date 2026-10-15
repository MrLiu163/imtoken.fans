-- 用户名 / 昵称分离（Twitter 那套）+ 首次登录引导。
--
-- username     ：对外唯一标识，不可重复，@提及用的就是它。格式受 0011 的
--                profiles_username_format 约束（^[a-z0-9_]{3,20}$），因为它要能被
--                评论正文里的 @ 正则稳定解析，也要能直接当 /u/xxx 的路径。
-- display_name ：昵称，可以重复、可以有空格和中文，评论区等地方展示的是它。
-- onboarded_at ：首次登录引导完成（或用户点了 skip）的时间，null = 还没走过引导。

alter table profiles
  add column display_name text,
  add column onboarded_at timestamptz;

-- 老用户回填：昵称先等于 username，避免评论区显示成空白。
update profiles set display_name = username where display_name is null;

-- 已有用户不该被强拉去走引导（他们的资料本来就填过了），统一标记为已完成。
update profiles set onboarded_at = now() where onboarded_at is null;

-- 沿用 0004/0009 的列级 GRANT 收紧模式：只放开这几列给普通登录用户，
-- role / permissions / muted_until 等依旧改不了。
grant update (username, avatar_url, bio, display_name, onboarded_at) on public.profiles to authenticated;

-- ========== 注册时同时写入 username 和 display_name ==========
-- 相比 0011 只多了 display_name：username 继续走 normalize_username 变成合规 slug，
-- display_name 则保留用户/Google 给的原始写法（大小写、空格、中文都不动）。
create or replace function public.handle_new_user()
returns trigger as $$
declare
  member_count bigint;
  raw_name text;
  base_candidate text;
  candidate text;
  suffix int := 0;
begin
  raw_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  );

  base_candidate := public.normalize_username(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  ));
  candidate := base_candidate;

  loop
    begin
      insert into public.profiles (id, username, display_name, avatar_url, wallet_address)
      values (
        new.id,
        candidate,
        raw_name,
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'wallet_address'
      )
      on conflict (id) do nothing; -- 同一个 new.id 重复触发时安静跳过
      exit;
    exception when unique_violation then
      -- 冲突来自 username 唯一约束，换个带数字后缀的候选名重试。
      suffix := suffix + 1;
      if suffix > 50 then
        insert into public.profiles (id, display_name, avatar_url, wallet_address)
        values (new.id, raw_name, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'wallet_address')
        on conflict (id) do nothing;
        exit;
      end if;
      candidate := left(base_candidate, 20 - length(suffix::text) - 1) || '_' || suffix::text;
    end;
  end loop;

  -- 前 50 个用户自动拿 genesis_member 徽章（同 0003，逻辑未变）。
  select count(*) into member_count from public.badges where badge_key = 'genesis_member';
  if member_count < 50 then
    insert into public.badges (user_id, badge_key, level)
    values (new.id, 'genesis_member', 1)
    on conflict (user_id, badge_key) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
