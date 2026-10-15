-- 修复两个已上线的权限漏洞：RLS 只能按行过滤，管不了列，下面两条策略被 GRANT 层面绕过了：
--   1. profiles 的 "users can update own profile" 允许任何登录用户把自己的 role 改成 admin，
--      或者清空 submission_cooldown_until 绕过反垃圾冷却。
--   2. submissions 的 "author or admin can update" 允许作者直接把自己的 status 改成 published，绕过审核。
--
-- 用 Postgres 的列级 GRANT/REVOKE 收紧：普通登录用户（authenticated）之后只能通过常规客户端
-- 改自己 profiles 的 username/avatar_url，以及自己 submissions 的 stats_users/stats_dau/stats_updated_at。
--
-- 连带后果（架构约定）：管理员审核通过/驳回、改角色、改提交状态等操作，从此一律要走
-- createAdminClient()（service_role，不受这里的 GRANT 限制），并在应用代码里用
-- requireAdminForAction() 做权限校验——数据库层面不再区分"作者"和"管理员"。

revoke update on public.profiles from authenticated, anon;
grant update (username, avatar_url) on public.profiles to authenticated;

revoke update on public.submissions from authenticated, anon;
grant update (stats_users, stats_dau, stats_updated_at) on public.submissions to authenticated;
