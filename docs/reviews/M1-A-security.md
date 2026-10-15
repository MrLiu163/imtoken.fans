# M1-A 基础依赖安全审查

日期：2026-10-15。角色：独立 QA（只读）核对版本、风险及修复边界，developer 更新依赖，主调度核验构建与浏览器。

## 已发现的风险与最小修复

| 依赖 | 原版本 | QA 推荐最小目标 | 依据 |
| --- | --- | --- | --- |
| next / eslint-config-next | 16.3.3 | 同步精确 16.3.8 | [官方补丁记录](https://github.com/vercel/next.js/releases/tag/v16.3.8) |
| sharp | 0.35.4 | 0.35.5 | [维护者公告](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) |
| axios | 1.16.0 | 1.20.0 | [维护者修复记录](https://github.com/axios/axios/releases/tag/v1.20.0) |
| @coinbase/cdp-sdk | 1.55.0（精确钉旧axios） | 1.56.0（放开axios范围） | npm registry 包依赖核对，保持父包允许范围 |
| source-map-js | 1.2.1 | 1.2.2 | [维护者修复记录](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) |

修复前生产依赖 audit 共5项：1 critical、3 high、1 moderate。框架 audit 建议16.4.1，但本次公告可通过16.3.8补丁解决，不需要为此切换minor版本。

## 风险判断边界

源码没有发现 next/og、ImageResponse、draftMode、use cache、Next Image组件或直接axios调用。这不等于框架路由不存在：remotePatterns允许Google头像和Supabase存储，`/_next/image`仍需修补。[Next SSRF公告](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4)

原 dev/start 未绑定hostname；Next默认0.0.0.0。本批绑定127.0.0.1缩小本地暴露范围，但不能代替[开发MCP信息泄漏补丁](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv)。

sharp公告涉及特定SVG/Linux条件；Axios多个公告涉及原型污染、特定adapter或不可信URL等前提。当前代码没有证明所有利用条件成立，不把audit级别直接当作当前漏洞可被利用的证明。

## 验收范围

- targeted依赖修复后核对npm ls和生产audit，不使用force升级或大范围override。
- i18n、lint、build、中文/英文首页、导航、登录页、品牌图片与固定端口检查。
- 非白名单图片优化URL仍应拒绝；构建产物生产启动可正常服务。
- WalletConnect依赖链变化需要动态加载检查；真实钱包连接、扫码、签名登录及Google OAuth完整流程若未测试必须明确留待独立阶段，不能以build成功替代。

## 最终结果

实际 npm ls 与 lock 一致：next / eslint-config-next 16.3.8、sharp 0.35.5、source-map-js 1.2.2、axios 1.20.0、@coinbase/cdp-sdk 1.58.0（父依赖允许范围），本地 Node 22.23.3。未新增 override，也未执行 audit fix --force。

生产 audit 实测 **0 项**。全量原剩7 high，定向更新 brace-expansion 1.1.21 / 5.0.12 与 js-yaml 4.3.2 后，最终剩 **5 high**。这5项来自 eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces 3.0.3，同一个根问题沿依赖链计数；全部为 dev 依赖。当前 npm 尚无 braces 修复版，audit 建议跨主版本降级 eslint-config-next 到14，不适用于本项目。恶意深层glob可能影响lint/CI；本机 review 可信代码不因此阻塞，不能解释为全部依赖无风险。[braces 公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

最终检查：818键i18n、lint、生产build均通过；开发工具补丁后lint再次通过。主调度验证生产启动、中英桌面/手机页面、品牌图片、登录页可访问；开发和生产的非白名单图片优化请求均400。127.0.0.1:3000监听与重复启动报端口占用实测通过。

QA 在项目 Node 22 中动态 import WalletConnect provider，确认 EthereumProvider 与 init 均为函数，未调用 init/connect。浏览器分包、QR/relay、取消恢复、真实钱包连接、nonce/签名/会话登录、Google OAuth和部署未验证。此处只说明无签名 Node 加载通过，不能代替认证回归；涉及认证改造时须独立验收。

本批无数据库结构变更和业务写入；安全结果限于本批依赖补丁，不代表原有完整系统已完成安全审计。
