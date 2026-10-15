-- 注册引导采集「想怎么参与」：发布项目 / 体验产品 / 提出需求，可多选、可重叠。
-- 沿用 0021 的列级 GRANT：把 intents 加进 authenticated 可更新的白名单。

alter table profiles add column intents text[] not null default '{}';

grant update (username, avatar_url, bio, display_name, onboarded_at, expertise, intents) on public.profiles to authenticated;
