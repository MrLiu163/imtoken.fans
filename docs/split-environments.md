# 测试环境和线上环境分开（工程量评估）

> 2026-10-14 复核说明：下文为 2026-09-09 的历史评估，未在当前 checkout 核验线上环境。
> 当前仓库有 22 个迁移文件；是否已执行、Auth/Storage 配置及环境是否同库需重新检查。
> 环境隔离纳入 [新路线图](../roadmap.md) 的 M2，在首次数据库/活动测试写入前完成。

> 状态：**只是评估，还没动手**。2026-09-09 写。
> 结论先说：**值得做，而且越早做越便宜**。核心工作量 **半天到一天**，
> 加上"把假数据变成可复现的种子脚本"这一项，合计 **1.5～2 天**。

## 现在是什么状况

只有一套 Supabase 项目。`.env.local`（本地）和 Vercel 的环境变量指向的是**同一个**数据库：

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
```

后果：
- 本地随手造的假数据（现在列表里那一堆"这是一条用于布局测试的假数据"）就摆在线上库里。
- 测抽奖/签到会真的消耗线上的券、写线上的经验流水和通知。
- 想验证一条 migration，只能拿线上库当靶子。
- 想清库重来，会把真实用户一起清掉。

## 要做的事

### 1. 新建一个 Supabase 项目当 dev/staging 库（~1 小时）

免费额度足够。建完把 21 个 migration 按顺序跑一遍。
Supabase 的 Auth 配置也要跟着建一份：Google OAuth 的 redirect URL、邮件模板、Storage bucket
（`submission-media`）和它的策略。**这一步是这件事里最容易漏的**，Auth 和 Storage 的配置不在
migration 里，得手动对一遍。

> 顺手的改进：接入 Supabase CLI（`supabase link` + `supabase db push`），
> 以后新建/重置环境就是一条命令，不用在网页后台点。这一项本身约 2 小时。

### 2. 环境变量分流（~1 小时）

代码**不用改**——所有 Supabase 凭证已经全部走 `process.env`，没有任何硬编码。只需要：

- 本地 `.env.local` 换成 dev 库的凭证。
- Vercel 上按环境分别配：Production 用线上库，Preview + Development 用 dev 库。
  （Vercel 的环境变量本来就能按 Production / Preview / Development 分别设值，
  所以 PR 的预览部署会自动打在 dev 库上。）
- `.env.example` 里补一句说明，别让下一个人又把两边配成同一个。

### 3. 把假数据变成可提交的种子脚本（~1 天，这是主要工作量）

现在这批测试数据是手动灌进去的，仓库里没有。dev 库建好之后是空的，
要么再手动灌一遍（下次重置又要再来），要么现在花一天写成
`supabase/seed.sql`（或 `scripts/seed.ts`）：若干测试用户 + 产品 + 点子 + 评论 + 投票 + 奖品配置。

写成脚本的收益不只是这一次：以后重置 dev 库、新同事上手、验证一条 migration，
都是一条命令的事。**建议一起做掉，不然分库之后 dev 库空着，还是会有人回去用线上库测。**

### 4. 顺手清理线上库的假数据（~1 小时）

分完之后线上库里那批 `这是一条用于布局测试的假数据` 就可以删了。
后台回收站能软删，但彻底清干净建议直接写一条一次性 SQL（按 `submitted_by = seedowner` 定位）。

## 风险和注意点

- **Auth 配置是双份的**：Google OAuth 的 client 可以复用，但 redirect URL 要把 dev 域名
  （`http://localhost:3000/auth/callback`）加进去；Supabase 项目也各自要配一次。
- **`SUPABASE_SERVICE_ROLE_KEY` 千万别串**：如果本地 `.env.local` 忘了换，就等于拿 admin
  权限直接操作线上库，比现在更危险。分库之后第一件事是确认本地连的是哪个库
  （打开 `/admin/analytics` 看数据量最直观）。
- **migration 要按同一个顺序在两个库都跑**：两边 schema 一旦漂移，问题会以"本地好使线上炸"的
  形式出现。这也是建议上 Supabase CLI 的主要原因。
- 不需要第三套。dev（本地 + Vercel Preview）+ prod 两套就够，再多是负担。

## 建议的执行顺序

1. 先做第 3 步（种子脚本）——它和分库无关，现在做完就能立刻用。
2. 再做 1 + 2（建库 + 环境变量分流）。
3. 最后做 4（清线上假数据）。
