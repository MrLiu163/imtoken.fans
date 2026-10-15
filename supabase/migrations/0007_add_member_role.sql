-- 三级身份体系第一步：给 user_role 枚举加 'member'。
-- 必须单独执行、单独一个事务——Postgres 不允许在同一个事务里
-- 先 ADD VALUE 再使用这个新枚举值，所以这个文件只做这一件事，
-- 下一个文件（0008）再去用它。

alter type user_role add value 'member';
