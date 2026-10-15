-- Phase 1：登录功能上线后，需要在新用户注册（邮箱/密码、Google OAuth、钱包签名）时
-- 自动在 profiles 表里建一行对应记录，否则提交/投票/评论等外键会找不到 profiles.id。
-- 在 Supabase Dashboard -> SQL Editor 里执行这个文件（在 0001_init.sql 之后）。

create or replace function public.handle_new_user()
returns trigger as $$
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
    -- username 撞车（比如两个人都叫 alice）：退化成不带 username，避免整个注册流程失败。
    insert into public.profiles (id, avatar_url, wallet_address)
    values (new.id, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'wallet_address')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
