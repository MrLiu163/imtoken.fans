# 分支整合与本地运行

更新：2026-10-16。状态：整合预览已部署；所有者授权规则已生效，PR #1–#4 全部 MERGED，main 正式部署已成功。下文批准要求为历史记录。

## 范围

- 基线 `main`：`00f5801`，首次社区预览。
- PR #1 / `codex/team-git-workflow`：团队规则、公开仓库说明、PR 模板。
- PR #2 / `codex/vercel-auto-preview`：Vercel 自动预览说明；GitHub Vercel 状态 SUCCESS。
- 首页横幅、提示精简、跨板块排序与评论计数：原未提交工作已单独保存为 `ddb91d7`。
- 本地 `codex/community-integration` 合并上述已完成内容，合并记录 `709d3ef`。唯一冲突在 roadmap.md，同位置两条历史记录均保留。
- `codex/m1-brand-consistency` 没有新实现提交，只有未跟踪任务卡，保留原工作目录，不纳入本次合并。

## 当前验证

- 合并后 i18n（1092键）、lint、build/TypeScript 均通过。
- 本地启动 `npm run dev`，固定 http://localhost:3000，启动前端口空闲。
- 中英首页、四板块列表、反馈详情与三张横幅原图共15个URL返回200。
- 不存在的帖子显示 Next.js not-found 标记；流式响应HTTP头为200，不能把它记作HTTP404通过，后续SEO收尾需复核响应码。
- 浏览器验证中文/英文首页、横幅切换和图片加载、推荐/热门/最新切换；最新首条为首次学习钱包讨论，热门首条为客服私信案例。
- 反馈详情渲染8条种子评论；本地支持31→32，提示“已更新，仅当前页面有效”。页面无横向溢出。
- 已查看当前中文首页截图。此次没有重新执行全部手机与真实账号业务路径，历史手机检查见首页批次review。

## 限制与交付

本批仅整合已完成的演示页面与文档；未新增数据库迁移、业务权限或媒体上传。已有本地环境配置继续使用且不输出、不提交。前台虚拟内容、推荐标记、本地支持/评论不等同真实业务已接通，产品视觉review仍待用户反馈。

GitHub的PR #1、#2目前均 REVIEW_REQUIRED，无其他维护者批准。整合分支通过单一PR供审查，不直推main、不修改保护、不伪造他人批准。若合并整合PR，维护者应复核其包含 #1/#2 后再关闭已被覆盖的旧PR，避免重复合并。本地可先独立预览完整整合结果。


## 2026-10-16 全 PR 整合更新

- 新纳入 PR #4 `feature/product-hunter`（`889fb19`），与 PR #1/#2/#3 汇合为整合提交 `a3d0122`。
- 冲突：`messages/en.json`、`messages/zh.json`、`roadmap.md`。保留首页改造、Product Hunter 内容和双方历史记录，产品入口不宣称正式开放。
- 集成检查：i18n 1249 键、lint、build/TypeScript 通过。未执行真实登录、评分写入、数据库迁移或生产业务验收。
- 按风险启用独立 QA，真实业务存在 2 项 P1、4 项 P2；见 [QA 记录](../reviews/M3-C-product-hunter-security.md)。修复/迁移验收另批执行，不能把合并代码标为业务完成。
- PR #1–#4 均缺少另一位维护者批准，GitHub 状态 REVIEW_REQUIRED/BLOCKED。PR #3 作为含全部提交的整合 PR 保留；不能宣称所有 PR 已合并，不通过关闭旧 PR 冒充合并完成。

- 2026-10-16 10:51（新加坡）：Vercel 已为整合提交 `05db11a7a9f2ad222411a6c08d197b6602496813` 返回 success / Ready；部署 `1FuKFHbdhPSa7TF1daBs6tjJ8a64`。预览入口：https://imtoken-fans-git-codex-community-i-5a38c8-simonliulius-projects.vercel.app/zh （需要 Vercel 登录）。已在登录浏览器看到社区首页与安全板块；不代表真实业务通过。此记录后的纯文档提交不改变应用代码。
- 同次核对远端 main 仍为 `00f5801d9509b5d1b637988b512434b464e13292`；正式生产入口不能当作本次最新整合预览。


## 2026-10-16 所有者授权执行

用户明确其他成员为协作者，所有者自己的合并指令即可授权 AI 检查与合并。取消 GitHub 外部批准人数门槛；保留 PR、讨论解决、禁止强推/删除与管理员约束。采用整合 PR 的 merge commit 保留 #1/#2/#4 祖先关系，逐一核对实际 MERGED 状态。发布范围仍为无数据库演示，不执行迁移。


## 2026-10-16 实际合并结果

- GitHub 已核实 #1/#2/#3/#4 的 `state=MERGED`、`merged=true`，当前无待合并 PR；不是仅关闭旧 PR。
- #3 合并提交 `fc9974118c4beb108061c4027fc2564d9572846a`，包含全部整合内容；#4 已先以 `f86f958606ccdc142ae05554bbe1c352e70cef75` 合入。
- 主线保护回读：required_approving_review_count=0、enforce_admins=true、required_conversation_resolution=true、allow_force_pushes=false、allow_deletions=false。未扩大协作者权限。
- 正式站地址 https://imtoken-fans.vercel.app/zh；主线提交触发部署。无数据库业务发布验收，M3-C 风险记录继续有效。

- Vercel 已为 main 提交 `fc9974118c4beb108061c4027fc2564d9572846a` 返回 success；正式部署 `7xcYBupuvpXysaZfwaUrJch6kWVo`。后续此纯文档收尾仍需等待自身部署完成，应用代码与该成功版本一致。
