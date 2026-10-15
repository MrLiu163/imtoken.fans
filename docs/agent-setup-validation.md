# Agent 协作机制安装验证 v2

完成日期：2026-10-15。范围仅为协作配置与调用入口，**M1 设计及工程实现尚未开始**。

## 配置结果

- 主聊天总调度：GPT-6.1 Sol / medium。
- Claude 设计：`.codex/external-agents/designer.toml`，`devin/claude-opus-5-5` / low，经现有 magpie/Devin 调用。
- 原生角色只保留 developer（前后端统一，Sol/medium）与 qa（Sol/high，按风险启用）。
- 主配置最多两个原生工作者；主调度把外部 Claude 也计入总并发预算。
- 原九角色、原主配置与原工作流归档在 `docs/archive/agents-v1/`，不是当前调度指令。

## 真实 Claude 调用（2026-10-14）

初次通过 ChatGPT 默认 provider 请求 Cursor 模型：400，不支持该模型。已有 magpie/Cursor 请求：403，地区限制。已有 magpie/Devin 请求 `devin/claude-opus-5-5`：成功。

最终调用脚本亦成功，退出码 0，返回 `CLAUDE_ROUTE_OK`，并生成设计输出文件和用量记录。归档为 [最小证据记录](agent-validation/claude-route-2026-10-14.json)，已去除临时路径和无关进程日志，无账号凭证。

最终脚本回执：输入 11,611、输出 17 tokens，另有缓存写入字段。连接成功不独立证明提供商内部模型身份，不将计数直接换算成实际账单。Claude CLI 有固定上下文开销，因此按短 Brief、少轮次使用。

## 2026-10-15 收尾检查

- Python TOML 解析、角色必填字段、注册路径与主配置一致性。
- [Codex 严格有效配置读取](agent-validation/effective-config-2026-10-15.json)通过：核对主模型、并发上限及仅 developer/qa 原生注册。
- 脚本 Python 语法与参数预检；最终控制流程用本地模拟 CLI 检查成功输出/记录、已有文件拒绝、渠道失败、空响应、超时、用户中断（SIGINT/SIGTERM）和过长 Brief，共九项检查通过。
- 上述离线检查不请求任何模型、不读账号凭证、不写应用数据库；详见 [离线检查记录](agent-validation/offline-controls-2026-10-15.json)。
- 当前管理文档的本地链接、代码围栏与协作规则一致性。
- i18n 检查通过（743 键）；30 个当前文档本地链接通过；应用 src/messages/Supabase/public/包依赖等 186 文件与安装前哈希基线一致。

QA 没有作为本次文档收尾的固定额外角色启动；检查由主调度执行。真实工程中的权限、签名、媒体、迁移、并发等改动仍按工作流做独立 QA。

## 使用入口

读 [工作流及指挥示例](agent-workflow.md)。用户可以在主聊天说：

> 按三角色工作流开始 M1，先让 Claude Opus 5.5 经 Devin 给首页和四板块导航做设计，暂不开发。

脚本依赖 Python 3.11+、本机 Codex CLI 及已配置的 magpie/Devin。当前没有修改个人全局配置或安装新凭证。新聊天 UI 自动发现、第三方内部路由和实际设计质量不在本次验证范围；当前可通过显式 CLI/模型参数分派。
