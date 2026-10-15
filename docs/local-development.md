# 本地启动与预览

本项目固定使用 `http://localhost:3000`，开发和生产预览都只监听本机 `127.0.0.1:3000`。`npm run dev`、`npm run start`、VS Code F5 与 `.claude/launch.json` 使用同一端口；端口占用时启动失败，先处理占用，不自动改为 3001。

## 第一次启动

VS Code 打开项目根目录，先在集成终端执行：

```sh
npm ci
```

项目精确安装了本地 Node.js 22.23.3（`node` 开发依赖），无需修改电脑全局 Node。即使默认终端是 Node 20，安装完成后 `npm run` 的 PATH 会优先使用项目的 Node 22。可执行以下命令核对：

```sh
npm exec -- node --version
```

预期为 `v22.23.3`。VS Code F5 也直接使用 `${workspaceFolder}/node_modules/node/bin/node`。`.nvmrc` 提供同版本提示；没有 nvm 也可直接使用本地依赖。安装阶段可能因为全局 Node 20 而出现依赖 engine 警告，本地 Node 安装完成后再运行检查。

## 最简单的预览方式

在 VS Code「运行和调试」中选择 **imToken Fans: 启动并预览 (3000)**，按 F5。启动后自动用默认浏览器打开 `http://localhost:3000`；停止调试可结束本次启动的开发服务。若浏览器未自动打开，直接访问上述地址。

也可使用 VS Code 集成终端：

```sh
npm run dev
```

看到 Local 地址后访问 `http://localhost:3000`，按 Ctrl+C 停止。只选择一种启动方式，避免同时启动两个服务。「调试已运行页面」仅附加到已经启动的网页，不启动服务。

生产模式需要先成功执行 `npm run build`，再执行 `npm run start`。生产服务也固定在本机 3000。生产环境如果只安装 `--omit=dev`，需由部署环境另外提供受支持的 Node 22.13+，不能依赖开发依赖中的 Node。

## 3000 已被占用

macOS 可先查看监听进程：

```sh
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

确认进程属于自己之前开的本项目后，回到对应终端 Ctrl+C 或停止对应 VS Code 调试会话。未知进程先确认用途，不自动杀进程。若是本项目已经运行，直接打开现有 3000 页面，无需再次启动。

## 数据库与首页预览

当前 M1-A2 首页/四板块/帖子使用独立静态演示数据，替代下述M1-A旧首页读取方式。打开首页点四板块即可浏览；演示点赞/投票/评论/回复只保存在当前页面，刷新恢复，发帖仅弹窗预览。原Supabase、旧AI页面、账号与签到抽奖逻辑继续保留，详见 [本批review](reviews/M1-A2-community.md)。

数据库沿用原未上线 imAihunt 项目；凭证只放本地 `.env.local`，不提交、不输出。首页只读取已发布内容，不执行迁移或业务写入。现有访问埋点沿用原流程。

M1 首页在未配置数据库时会显示内容服务未连接状态；数据库读取失败时显示失败状态及重试入口。品牌介绍、四板块说明仍可显示。这里没有模拟帖子；可识别的历史布局测试占位会从首页展示中过滤，数据库原记录保留。登录、完整内容页和活动等既有流程仍需有效开发环境。

## 本批工程检查

2026-10-15：`npm ci` 完成；已安装并实际执行本地 Node 22.23.3。Next.js 与 eslint-config-next 精确更新为 16.3.8，定向更新 sharp 0.35.5、source-map-js 1.2.2、axios 1.20.0；cdp-sdk 在父依赖允许范围内解析为 1.58.0。`npm audit --omit=dev --json` 报告生产依赖 0 项漏洞；随后仅运行 `npm update brace-expansion js-yaml`，更新 3 个传递包：brace-expansion 1.1.21 / 5.0.12 与 js-yaml 4.3.2，未添加直接依赖、override 或强制升级。最终全量 audit 剩余 5 项 high，均沿 ESLint 配置的 fast-glob → micromatch → braces 3.0.3 链传播（包含 5 个受影响包，不是 5 个独立根漏洞）；这些包用于开发期代码检查，生产依赖 audit 仍为 0。未降级 eslint-config-next，braces 无可用兼容补丁的问题留待上游修复；不将生产结果当作全部依赖无风险。定向更新后 lint 通过。

已阅读当前安装版的本地指南：`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`、`node_modules/next/dist/docs/01-app/02-guides/debugging.md`、`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`。实际启动、浏览器、F5、端口冲突与无数据库分支由本批统一验证分别记录，不能由配置存在推断通过。
