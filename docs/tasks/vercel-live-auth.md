# Vercel 正式环境登录与数据接入

更新：2026-10-16。状态：配置、迁移、修复、独立 QA、正式部署及本批登录/数据验证完成。

## 配置与范围

用户授权使用本地配置恢复正式站登录与数据。Vercel 项目 imtoken-fans 仅 production 配置 6 项：NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY、WALLET_AUTH_SECRET、NEXT_PUBLIC_REOWN_PROJECT_ID、NEXT_PUBLIC_SITE_URL。服务端 key/钱包 secret 为 sensitive，公共变量为 encrypted。站点 URL 为 https://imtoken-fans.vercel.app。未将本地 localhost、空 Google/AI 配置或密钥提交到 Git；Preview 仍不复制正式库凭证。

Supabase 继续使用原 imAihunt 库。Google Provider 已启用，Client ID/Secret 由 Supabase 保管，本站无需重复配置。默认 Site URL 已改为正式站，增加精确 /auth/callback，保留旧站/本地回调。使用无效 token 的无副作用探针验证正式回调路径、查询参数、本地回调均保留；这不等同真实 Google 用户完成 OAuth。

## 数据迁移与回退

只读确认目标库缺少 0023 的字段和两互动表后，执行 [受控事务](../operations/2026-10-16-live-data-transaction.sql)：LOCK submissions → 旧记录 ID/内容快照 → 原 0023 → 仅旧产品新增价格/阶段/创作者关系还原 NULL → 新 0024 权限加固 → 数据断言 → COMMIT。没有修改旧迁移。

事务前后均为 41 投稿、26 资料、502 投票、86 评论；4 条 restrictive 保护存在，新视图字段和两互动表匿名 REST 查询均 200。旧内容/互动未删除。历史产品资料未知保持 NULL，不假设免费、已上线或创作者身份。

执行前任意失败事务整体回滚；执行后优先回滚应用部署/移除 production 变量关闭真实入口，保留新增表与数据。不要为回退丢弃用户新增数据或重新执行一次性 0023。迁移由 SQL Editor 手工执行，项目原本没有 CLI 迁移历史；以本记录、执行 SQL 和实际结构为证据，不宣称已建立完整自动迁移台账。

## 接入前修复

- 产品投稿始终进入人工队列，不受旧全局 none/ai 或个人免审权限绕过。
- restrictive INSERT 要求本人、pending、未删除且非黑名单；支持/评分补齐数据库黑名单限制。
- 登录跳转拒绝反斜杠、控制字符、规范化后双斜杠，防止站外跳转。
- Google 头像只允许 HTTPS lh数字.googleusercontent.com，禁重定向，限时且限制流大小；错误日志不输出源地址。
- 草稿按真实用户 ID 隔离、账户切换重建表单；AuthProvider 拒绝退出/切号后的旧异步响应。

## 实际验证

- i18n 1249 键、lint、build/TypeScript 通过；6 个持久回归测试通过：`node --test scripts/test-live-auth-security.mjs`。
- 独立 QA 复核上述源码和迁移；另以内存 mocks 验证 12 项跳转、7 个非法头像来源、正常/超限流及 6 种账户竞态，无新增阻塞。
- 专用测试账号：密码登录、资料读取、普通 pending 投稿成功；直接 published 投稿及黑名单投稿/支持/评分均返回 403/42501。测试内容和标签已清理，正式页面验证后两个专用测试账号（密码/临时钱包）均已清理；未修改其他账号。
- PR #10 已合并，主线 `87008377b850e61cf04250cb1b8e361661193b61` 的 Vercel 正式部署 `8YYkLBjLgzJxzBzewZJJowgf4rNg` 返回 success。
- 正式浏览器验证：用户名/密码登录进入个人主页，重新加载保持会话；退出后个人主页仅显示登录入口，不暴露资料；产品页读到 21 条原库已发布记录。
- Google 入口进入 accounts.google.com/v3/signin/accountchooser；真人账号选择/同意授权由用户完成，未代操作。Supabase 正式 /auth/callback 查询参数及本地回调探针均通过。
- 临时随机测试钱包完成正式站 nonce → 免 Gas 签名 → verify → session cookie → 个人主页 200。没有链上交易、资金或用户真实私钥；外部钱包 App/扫码连接未验证。
- 专用账号不能自行改 role（403）；所有测试账号、投稿和标签清理后再次核对原记录数仍为 41/26/502/86。

## 保留限制

产品网址规范化/并发去重 P2 尚未处理，不标记 Product Hunter 全部验收通过。Google 真人授权、外部钱包 App/扫码、四板块真实帖子及媒体完整流程不能由环境配置替代；首页及板块的演示数据属性不变。AI key 为空，AI 审核未启用。


本记录后的收尾仅为文档提交，应用代码与上述已验证版本一致；最终部署状态以 GitHub 对应主线 SHA 的 Vercel success 为准。
