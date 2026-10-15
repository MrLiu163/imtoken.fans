-- 更多站内通知类型。在 Supabase Dashboard -> SQL Editor 里执行（在 0017 之后）。
--
-- 原则：凡是"发生在用户身上、但用户当时不在现场"的事，都要有通知。
-- 0010 只有 mention / reply（都由别人的动作触发），0016 加了 level_up，
-- 这里补上剩下三类——它们的共同点是没有"触发人"，是系统或管理员做的：
--   lottery_ticket  抽奖券到账 / 被收回（管理员发放，或九宫格里抽到券）
--   badge           拿到徽章（自动成就、管理员颁发、抽奖抽中）
--   xp_adjust       管理员手动补 / 扣经验值
--
-- 具体数值放在 0016 加的 detail jsonb 里（金额、徽章 key 等），
-- 通知铃铛按类型分别渲染，见 src/components/notification-bell.tsx。
--
-- 注意：Postgres 不允许在同一个事务里新增枚举值之后马上使用它。
-- 这个文件只加值不用值（真正的 insert 发生在应用运行时），所以直接跑没问题。
alter type notification_type add value if not exists 'lottery_ticket';
alter type notification_type add value if not exists 'badge';
alter type notification_type add value if not exists 'xp_adjust';
