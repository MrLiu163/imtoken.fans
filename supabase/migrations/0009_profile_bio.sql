-- 个人主页「编辑资料」功能需要一个 bio 字段；沿用 0004 的列级 GRANT 收紧模式，
-- 只放开 username/avatar_url/bio 三列，其余列（role、permissions 等）依旧不能被普通用户直接改。

alter table profiles add column bio text;

grant update (username, avatar_url, bio) on public.profiles to authenticated;
