-- 通知铃铛加了「清空」按钮：0010 建表时只开了本人 select/update，没有 delete 策略
-- （insert 特意锁死给 service_role，防止伪造通知；delete 当时没考虑到，现在补上）。
-- 只放开"删自己的"，不影响 insert 仍然只能走 service_role 的安全设计。

create policy "users can delete own notifications"
  on notifications for delete using (user_id = auth.uid());
