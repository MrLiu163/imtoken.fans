# imAihunt 项目路线图与关键决策（v0.2，2026-08-26）

完整可视化版本见 Artifact：https://claude.ai/code/artifact/57b7ced7-d416-4b0a-905e-25df58f10dc8

## 已确认决策
- 技术方案：Next.js + Supabase（数据库/认证/存储一体，部署到 Vercel）
- 登录方式：Google OAuth、账号密码、Web3 钱包三种，第一期（P1）就全部实现
- 投资功能：第一期只做「模拟投资」，「真实投资 + NFT 权益凭证」放到 P3，启动前需先咨询法律合规
- 部署账号现状：GitHub✓、Vercel✓；Supabase / Google OAuth 凭证 / WalletConnect(Reown) Project ID 待新建

## 阶段划分
- P0 工程基座：仓库、Supabase 项目、Vercel 部署打通、三方登录凭证申请（~2-4 天）
- P1 MVP 核心社区闭环：提交（产品/点子）、评论、双维度投票、模拟投资、排序、详情页、Profile+徽章、运营数据自助更新、人工审核队列（预留 AI 审核接口）、管理后台 v1（~3-5 周）
- P2 运营化：接入真实 AI 审核 API、抽奖活动系统、通知中心、举报功能、搜索/标签、Trending 榜单、徽章正式版（~2-3 周）
- P3 真实投资 + NFT：链上验资、真实转账/托管方案、NFT 铸造 —— 启动前必须先完成法律合规评估

## Phase 0 进度（2026-08-26 更新）
- [x] Next.js 16 (App Router + TS + Tailwind v4) 项目骨架搭建完成，本地 `npm run build` / eslint 均通过
- [x] 页面：首页、产品/点子列表、排行榜、详情页、提交页、登录页、Profile、管理后台（均为占位 UI + 示例数据，视觉参照 imToken 蓝白风格）
- [x] Supabase 客户端封装（browser + server）已写好，等待真实项目凭证
- [x] 数据库 Schema + RLS 策略已写好（supabase/migrations/0001_init.sql），覆盖 profiles/submissions/votes/investments/comments/moderation_queue/badges/admin_logs
- [x] README 写好详细的 Supabase / Google OAuth / Reown(WalletConnect) 账号配置步骤
- [x] 代码已在沙盒环境本地 git commit，等待推送到 Simon 的 GitHub 仓库
- [ ] 待 Simon：新建 GitHub 仓库并提供推送方式（PAT 或手动上传）
- [ ] 待 Simon：注册 Supabase / 创建 Google OAuth 客户端 / 创建 Reown 项目，并提供对应的 URL / Key
- [ ] 推送代码到 GitHub，接入 Vercel 完成首次部署

## 核心数据实体（已在 SQL migration 中实现）
profiles, submissions（产品/点子）, votes（愿付费/创意，per-user per-type 唯一）, investments（模拟/真实）, comments, moderation_queue（人工/AI 判定，预留接口）, badges, admin_logs

## Phase 1 进度（2026-08-31 更新，登录功能已全部跑通）
- [x] GitHub 仓库已连通（origin -> github.com/simonliuliu/imaihunt），代码已推送
- [x] 登录功能代码已完成并**端到端验证通过**，接的是真实 Supabase Auth（不是示例数据）：
  - 邮箱 / 密码注册登录（`src/app/auth/actions.ts`）—— 已用真实测试账号验证成功
  - Google OAuth（同上，走 `/auth/callback` 换 session）—— 已验证正确跳转到 Google 授权页
  - 钱包签名登录（`src/lib/wallet-client.ts` + `src/app/api/auth/wallet/`）—— 插件钱包（MetaMask / imToken）和 WalletConnect 扫码两种方式都已实现并验证通过
  - session 保活用 `src/proxy.ts`（Next 16 的 middleware 改名叫 proxy）
  - 数据库迁移 `0001_init.sql` + `0002_auth_profile_sync.sql` 均已在 Supabase 项目执行，新用户注册自动建 profiles 记录已验证生效
- [x] Supabase / Google OAuth / Reown 三个外部配置均已就位（`.env.local` 已配置真实凭证，未提交到 git）

## Phase 1 MVP 核心闭环进度（2026-08-31 更新，已全部跑通并端到端验证）
- [x] 提交产品/点子（`src/app/actions/submissions.ts`）：真实写库，24 小时反垃圾冷却已验证生效
- [x] 人工审核队列 + AI 审核预留接口（`src/lib/moderation/`）：管理员可在后台把「提交」「评论」两种内容各自设成 不审核/人工审核/AI 审核，三态都已验证；AI 审核走 Anthropic API，审核标准在 `src/lib/moderation/prompts/*.md`，没配 `AI_MODERATION_API_KEY` 时选项自动置灰，配了之后不用改代码直接生效
- [x] 双维度投票（愿付费/有创意）、模拟投资、评论（含一层回复）：`src/app/actions/votes.ts` / `investments.ts` / `comments.ts`，全部验证通过
- [x] 排序（首页热度榜/排行榜 4 个维度）、详情页（含相似内容推荐）：读侧统一用新增的 `submission_cards` 视图聚合
- [x] Profile 页真实徽章（genesis_member / 点子贡献者 / 活跃评论者 / 模拟投资人）+ 真实提交记录，替换了原来的示例数据
- [x] 运营数据自助更新：提交者可以在自己发布的内容详情页更新累计用户数/日活
- [x] 管理后台 v1：审核队列、审核模式开关、用户角色管理、内容状态管理，均为真实数据读写
- [x] 顺带修复两个上线时就存在的权限漏洞（`0004_rls_hardening.sql`）：普通用户之前能直接调用 API 把自己设成管理员、或绕过审核把自己的提交设为已发布，现在用 Postgres 列级 GRANT 收紧了，已用真实攻击请求验证确实被拦截
- [x] 顺带修复一个测试时发现的问题（`0005_admin_logs_fk_fix.sql`）：管理员账号一旦审核过内容就永远删不掉（外键卡住），现在改成账号删除后只清空"是谁做的"这个记录，不影响审计日志本身
- [x] 提交表单加了 Product Hunt 级别的信息密度（`0006_submission_media.sql`）：官网/演示视频链接、Logo + 最多 5 张截图（Supabase Storage，5MB/文件、只收图片，桶权限按用户 ID 分文件夹隔离）、团队信息、社交链接；提交/点子两个 Tab 各自保留独立草稿，互相切换不丢内容
- [ ] 下一步：邮箱验证链接的真实收信流程；P2 事项（真实 AI 审核已经做了架构预留但还没配 Key、抽奖/通知/举报/搜索/Trending）

## 身份权限体系升级（2026-09-01，与 Simon 讨论后确定，超出原 P1 范围）
运营过程中发现两级角色（user/admin）不够用，和 Simon 对齐后升级成三级：
- **admin**：最高权限，发帖免审，能设置任何人的角色
- **member**：权限由 admin 按项授予（自己发帖免审 / 审核别人的提交 / 删评论+禁言 / 管理用户标签 / 活动管理占位）
- **user**：只有发帖、投票、评论、参与活动等基础功能

同时把评论的管理方式从"和提交一样走审核队列"改成"默认直接可见，管理员/有权限的 member 用删除+禁言事后处理"——评论量大，逐条预审不现实。原有的审核流水线（人工/AI 三态开关）机制保留，只是把评论这一项的默认值改成"不审核"，admin 随时能切回去。

另外确认了一个容易混的概念边界：**徽章（成就系统，自动计算）/ 角色（admin/member 标签）/ 用户标签（VIP、官方认证、黑名单，人工管理）是三个独立的东西**，分开建模，不混用。黑名单不只是展示，真的会拦提交和评论。

- [x] 三级角色 + member 细粒度权限（`0007_add_member_role.sql` + `0008_permissions_and_tags.sql`）：代码已完成，`tsc`/`eslint`/`npm run build` 全过
- [ ] 待 Simon：依次执行 `0007`（先，单独一次）→ `0008`（后）—— 这两个必须分开跑，Postgres 不允许在同一事务里新增枚举值又立刻用它
- [ ] 待验证：用测试账号把 member 各项权限、禁言、拉黑逐条跑一遍

## 下一步该做什么（三个方向，未排优先级）
1. **收尾当前这批**：把上面两个迁移跑完 + 完整验证一遍角色权限系统，这是最快能完成的
2. **上线部署**：目前只在本地 `next dev` 测试过，从没有真正部署到 Vercel 验证过生产环境（尤其是 Google OAuth 回调地址在真实域名下能不能走通）——P0 阶段说 Vercel 账号已经有了，但接入部署这一步实际上还没做
3. **挑一个 P2 功能**：真实 AI 审核（等 Simon 提供 API Key）、抽奖活动系统（目前只有权限占位，没有功能）、搜索/标签筛选、Trending 榜单算法、举报功能、通知中心