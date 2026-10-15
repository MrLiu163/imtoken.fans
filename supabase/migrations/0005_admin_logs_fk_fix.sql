-- 修复一个在测试时发现的问题：admin_logs.admin_id 和 moderation_settings.updated_by
-- 引用 profiles(id) 时没写 ON DELETE 行为，默认是 NO ACTION——意味着任何一个管理员，
-- 只要曾经批准/驳回过一条内容，或者改过一次审核模式，他的账号就永远删不掉
-- （删 auth.users 会级联到 profiles，但 profiles 会因为被 admin_logs/moderation_settings
-- 引用着而删除失败，报一个不好排查的外键错误）。
--
-- 处理方式：这两个字段本质上是"操作时是谁做的"这个审计信息，账号被删掉之后，
-- 保留这条记录本身（动作、目标、时间、detail）但把"是谁"清空为 null 是合理的行为，
-- 好过直接不让删账号。
--
-- 用动态查找约束名而不是硬编码，避免猜错 Postgres 自动生成的约束名字导致这个文件跑不动。

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'admin_logs' and con.contype = 'f'
    and con.conkey = (
      select array_agg(attnum) from pg_attribute
      where attrelid = rel.oid and attname = 'admin_id'
    );

  if constraint_name is not null then
    execute format('alter table admin_logs drop constraint %I', constraint_name);
  end if;

  alter table admin_logs alter column admin_id drop not null;
  alter table admin_logs add constraint admin_logs_admin_id_fkey
    foreign key (admin_id) references profiles (id) on delete set null;
end $$;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'moderation_settings' and con.contype = 'f'
    and con.conkey = (
      select array_agg(attnum) from pg_attribute
      where attrelid = rel.oid and attname = 'updated_by'
    );

  if constraint_name is not null then
    execute format('alter table moderation_settings drop constraint %I', constraint_name);
  end if;

  alter table moderation_settings add constraint moderation_settings_updated_by_fkey
    foreign key (updated_by) references profiles (id) on delete set null;
end $$;
