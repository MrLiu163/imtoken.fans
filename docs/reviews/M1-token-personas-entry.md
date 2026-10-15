# 数字币人入口 review

2026-10-15。本地可预览，等待用户 review。

## 交付

首页原「参与社区」卡片替换为「数字币人」，BTC、ETH、NEAR、ZEC、牛来币共五个头像。桌面3列两行，手机5列一行；综合交流复用同一卡片，手机放在帖子流之前，入口每页仅一份。点击头像打开相应圈子占位预览，展示拟定性格、筹备提示与前往综合交流链接。

真实AI/圈子由其他负责人实现。本批没有聊天输入、@触发、自动回复、币人对话、管理员权限、真实加入或人数数据，不接数据库/积分。全局发帖按钮保留。

头像通过内置imagegen生成，已复制到 `public/images/token-personas/{btc,eth,near,zec,niulai}.png`，五张已逐一视觉检查。完整[提示集](../design/token-personas/prompts.json)与[资源说明](../design/token-personas/README.md)已保存。牛来币首次生成输出被服务拦截，简化为普通卡通小牛后重试成功；共5张最终产物，无外部图像授权依赖。头像与性格均为展示设定，不是官方身份。

## 验证

- check-i18n（1084键）、lint、build（包含TypeScript）均通过。
- ego-browser：1440桌面首页、390手机首页与英文综合交流卡片各一份，无全页横向溢出；五张头像全部加载完成。
- BTC预览打开后标题正确，弹窗无输入框；Esc关闭后焦点返回BTC按钮。
- 英文牛来币预览与关闭按钮、中文综合交流桌面入口已复核，截图见下方。
- 无真实AI服务、@、群组权限、数据库、账号或活动业务验收；仅入口及本地预览。

## 预览

[首页](http://localhost:3000/zh) · [综合交流](http://localhost:3000/zh/community/discussion)

[桌面首页](screenshots/token-personas/home-desktop.png) · [手机首页](screenshots/token-personas/home-mobile.png) · [英文综合交流手机](screenshots/token-personas/discussion-mobile-en.png) · [桌面综合交流](screenshots/token-personas/discussion-desktop.png) · [英文圈子预览](screenshots/token-personas/dialog-mobile-en.png)。

后续接入需要对接实际圈子/角色ID和目标路由，再由功能负责人定义AI触发、上下文、回复治理和币人间交互；牛来币保留用户给定名称，不编造ticker或合约。
