-- 个人资料加「专长」多选（增长/研发/运营/KOL 等），用于以后按专长筛选/展示用户。
-- 沿用 0013 的列级 GRANT 收紧模式：只放开这一列给 authenticated 自己改。

alter table profiles add column expertise text[] not null default '{}';

grant update (username, avatar_url, bio, display_name, onboarded_at, expertise) on public.profiles to authenticated;
