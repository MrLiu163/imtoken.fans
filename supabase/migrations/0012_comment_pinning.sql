-- 置顶评论：admin / 有 moderate_comments 权限的 member / 该提交的作者本人都能置顶，
-- 但作者只能置顶自己提交下面的评论（权限判断在 Server Action 里做，见 toggleCommentPin）。
--
-- 用 timestamptz 而不是 boolean：多条置顶时可以按「谁先被置顶」稳定排序，
-- 也顺带留下了置顶时间这个审计信息。null = 没置顶。
alter table comments add column pinned_at timestamptz;

-- 详情页只按 submission_id 取评论后在应用层排序，这个索引主要服务于
-- 「某个提交下有哪些置顶评论」这类查询，nulls last 和排序方向保持一致。
create index comments_pinned_idx on comments (submission_id, pinned_at desc nulls last);

-- 写入一律走 service_role（同 deleteComment 的做法）：comments 表只有 is_admin() 的
-- update 策略，而提交作者是普通用户，走不通 RLS，所以权限校验放在应用层。
