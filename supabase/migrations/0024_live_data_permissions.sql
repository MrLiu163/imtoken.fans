-- 接入正式站前收紧真实写入；保留既有记录和迁移，不清空任何业务数据。
-- 必须在 0023 结构之后执行；历史资料修复由受控的 0023 执行事务按原 ID 完成。
create policy "submission insert must be pending and permitted"
  on public.submissions as restrictive for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and deleted_at is null
    and not exists (
      select 1 from public.user_tags t
      where t.user_id = auth.uid() and t.tag_key = 'blacklisted'
    )
  );

-- 直接 REST 请求与 Server Actions 使用相同黑名单限制。
create policy "support insert requires permitted account"
  on public.product_supports as restrictive for insert to authenticated
  with check (not exists (
    select 1 from public.user_tags t
    where t.user_id = auth.uid() and t.tag_key = 'blacklisted'
  ));
create policy "rating insert requires permitted account"
  on public.product_ratings as restrictive for insert to authenticated
  with check (not exists (
    select 1 from public.user_tags t
    where t.user_id = auth.uid() and t.tag_key = 'blacklisted'
  ));
create policy "rating update requires permitted account"
  on public.product_ratings as restrictive for update to authenticated
  using (not exists (
    select 1 from public.user_tags t
    where t.user_id = auth.uid() and t.tag_key = 'blacklisted'
  ))
  with check (not exists (
    select 1 from public.user_tags t
    where t.user_id = auth.uid() and t.tag_key = 'blacklisted'
  ));

notify pgrst, 'reload schema';
