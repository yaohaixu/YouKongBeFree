# 开发日志

## 2026-08-10 - 活动系列、活动复盘与小程序订阅提醒

### 任务目标

在保持 PC 与小程序普通用户能力同步的前提下，补齐活动系列、发起人复盘和小程序专属通知能力；通知只做微信小程序订阅提醒，不在 PC 端加入无法触发微信授权的入口。

### 具体修改内容

- 新增 `activitySeries` 默认数据和公开 `/api/activity-series` 接口，活动创建、编辑、详情和列表 payload 支持 `seriesId`、`seriesName` 和 `seriesColor`。
- 新增 `/api/activities/:id/recap`，按活动管理权限返回报名、感兴趣、反馈状态、成团状态、精选反馈和复盘摘要。
- 新增 `activityNotificationSubscriptions` 集合、`/api/miniprogram/config` 和 `/api/activities/:id/notification-subscriptions`，记录小程序活动提醒订阅偏好。
- PC 发起页新增活动系列下拉；近期 / 历史活动列表新增系列筛选；活动卡、活动详情、我的活动和活动反馈页同步展示系列 / 复盘。
- 小程序发起页、活动列表、活动卡、活动详情和活动反馈管理页同步活动系列与复盘；活动详情页新增订阅提醒入口。
- README、CHANGELOG、小程序说明、安全说明和 smoke 测试同步更新到 `0.29.0`。

### 设计决策原因

- 活动系列用于长期栏目化整理活动，不替代原有「模块」和「客厅 / 客厅的朋友们」来源，因此默认可不选择。
- 活动复盘先基于现有结构化数据生成，避免引入新的 AI 成本和等待；后续可扩展为 AI 公众号式复盘。
- 微信订阅消息必须由小程序用户点击授权，因此只在小程序端展示；PC 端只同步活动系列和复盘等普通业务能力。

### 遗留问题

- 当前订阅提醒先记录授权偏好，尚未接入定时发送任务；如需真实推送，需要补充模板字段映射、加密 openid 发送凭证和 CloudBase 定时触发器。
- 活动系列目前为默认种子和公开读取，后台可维护系列的管理页可在下一轮再做。

## 2026-07-08 - 开启 GitHub Pages 静态外网访问

### 任务目标

为 GitHub 仓库 `YouKongBeFree` 开启 GitHub Pages，使官网静态页面可以通过外网访问，并同步更新项目文档中的访问地址。

### 具体修改内容

- 将项目版本从 `0.2.0` 升级到 `0.2.1`。
- README 新增 GitHub Pages 静态官网地址：
  - `https://yaohaixu.github.io/YouKongBeFree/`
  - `https://yaohaixu.github.io/YouKongBeFree/login.html`
  - `https://yaohaixu.github.io/YouKongBeFree/admin.html`
  - `https://yaohaixu.github.io/YouKongBeFree/me.html`
- README 保留本地完整动态功能地址：
  - `http://127.0.0.1:8080/`
  - `http://127.0.0.1:8080/login.html`
  - `http://127.0.0.1:8080/admin.html`
  - `http://127.0.0.1:8080/me.html`
- CHANGELOG 新增 `0.2.1` 版本记录。

### 技术方案选择

本次采用 GitHub Pages 从 `main` 分支根目录发布静态页面。该方案适合低成本展示官网页面，但不能运行 Node.js 后端。

### 设计决策原因

- 用户当前诉求是“打开 GitHub 的网址托管，让项目可以外网访问”，GitHub Pages 是 GitHub 原生的静态托管方案。
- 当前项目动态功能依赖 Express API、本地 JSON 数据和文件上传，不能仅靠 GitHub Pages 完整运行。
- 文档中必须明确区分“静态外网访问”和“完整动态功能访问”，避免后续接手者或使用者误解。

### 当前完成情况

- 文档已更新外网访问地址。
- 版本已升级至 `0.2.1`。
- 待将本次变更合并到 `main` 并启用 GitHub Pages。

### 遗留问题

- GitHub Pages 上登录、后台、活动发布和报名接口不可用。
- 完整动态功能仍需部署到支持 Node.js 的平台。

### 下一步建议

1. 选择 Render、Railway、Fly.io、Vercel Serverless 或云服务器部署 Express 后端。
2. 将数据存储迁移到托管数据库，避免依赖本地 JSON。
3. 配置正式线上 API 地址，让 GitHub Pages 静态前端调用线上后端。

## 2026-07-08 - 建立 YouKongBeFree 工程化基线

### 任务目标

将「有空客厅」从静态中文官网升级为可运行的活动管理 MVP，并建立 Git 双分支、文档、版本记录和可交接工程规范。项目名称确定为 `YouKongBeFree`。

### 具体修改内容

- 新增 Express 后端 `server.js`，提供登录、成员管理、模块管理、活动发布、活动报名和报名表查询 API。
- 新增 `app.js`，负责前端登录态、活动列表、发布活动、报名、后台管理等交互。
- 新增页面：
  - `login.html`：手机号登录。
  - `me.html`：成员发布活动和查看报名表。
  - `admin.html`：YKadmin 后台。
  - `activity.html`：活动详情和访客报名。
- 修改现有页面：
  - `index.html` 和 `participate.html` 接入动态活动列表。
  - 全站导航增加登录态入口。
  - 左上角圆形「有空」按钮可跳转登录/我的。
- 新增工程文件：
  - `package.json`
  - `package-lock.json`
  - `.gitignore`
  - `.env.example`
  - `data/example-db.json`
  - `uploads/.gitkeep`
- 新增文档：
  - `README.md`
  - `CHANGELOG.md`
  - `docs/dev-log.md`

### 涉及文件

- `server.js`
- `app.js`
- `script.js`
- `styles.css`
- `index.html`
- `participate.html`
- `login.html`
- `me.html`
- `admin.html`
- `activity.html`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `.env.example`
- `data/example-db.json`
- `uploads/.gitkeep`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

当前阶段选择 Node.js + Express + 本地 JSON 文件作为 MVP 方案。原因：

- 原项目是静态 HTML/CSS/JS，Express 可以低成本接管静态资源和 API。
- 本地 JSON 能快速验证业务闭环，避免过早引入数据库部署成本。
- 数据结构已按用户、模块、活动、报名、session 分层，后续迁移数据库较直接。
- 文件上传使用 Multer，便于后续替换为对象存储。

### 设计决策原因

- 登录采用手机号白名单：符合需求中“YKadmin 先录入昵称和手机号，用户录入手机号即可登录”的描述。
- 管理员登录后直接进入后台：减少操作路径，符合 YKadmin 工作流。
- 成员登录后进入「我的」：突出活动发布和报名表查看。
- 未登录访客可报名：符合公开活动传播场景。
- `data/youkong-db.json` 不提交 Git：避免真实手机号、报名记录和活动运营数据泄露。
- `data/example-db.json` 提交 Git：让新开发者理解数据结构。

### 当前完成情况

已完成 MVP 功能闭环：

- YKadmin 登录。
- YKadmin 添加成员和模块。
- 成员登录。
- 成员发布活动。
- 访客报名活动。
- 发起人查看报名表。
- 首页和活动页展示动态活动。

已完成浏览器端到端验证：

- 管理员登录跳转后台。
- 后台新增成员。
- 新成员登录跳转我的页面。
- 成员发布活动跳转活动详情页。
- 访客报名成功。
- 发起人查看报名表看到报名者。

### 遗留问题

- 当前登录没有验证码或密码，不适合直接暴露到公网。
- 当前数据存储为本地 JSON，并发写入和备份能力有限。
- 活动暂不支持编辑、下架、删除。
- 报名暂不支持取消和导出。
- 图片上传保存在本地 `uploads/`，正式部署需要对象存储或持久磁盘。
- 尚未配置 CI。

### 下一步建议

1. 引入 SQLite 或 Supabase，迁移本地 JSON 数据。
2. 增加短信验证码或管理员密码。
3. 增加活动编辑、取消、删除和报名导出。
4. 编写 Playwright 测试脚本并接入 GitHub Actions。
5. 增加部署文档和生产环境备份策略。

## 2026-07-09 - 部署 CloudBase 动态线上版本

### 任务目标

将「有空客厅」从本地 Express + JSON MVP 升级为可外网访问、可动态落库的腾讯云 CloudBase 版本，并保持 Git 双分支、文档、版本记录和可交接工程规范。

### 具体修改内容

- 将项目版本从 `0.2.1` 升级到 `0.3.0`。
- 新增 `lib/app.js`，抽出 Express 应用、API 路由、CORS、Cookie 和上传处理，让本地服务与云函数复用同一套后端逻辑。
- 新增 `lib/store.js`，支持 `json` 与 `cloudbase` 两种存储驱动。
- 新增 CloudBase NoSQL 集合约定：`yk_users`、`yk_modules`、`yk_activities`、`yk_registrations`、`yk_sessions`。
- 新增 CloudBase Storage 活动封面上传；本地开发仍使用 `uploads/`。
- 新增 `cloudbaserc.json`，配置环境 `youkong-d5gh4x0ayc29a2187` 与云函数 `youkongApi`。
- 新增 `scripts/build-static.js`，生成 CloudBase Hosting 静态产物 `dist/`。
- 新增 `scripts/build-function.js`，生成云函数临时部署包 `tmp/cloudfunctions/youkongApi`。
- 修改 `app.js`，CloudBase 静态域名下自动调用 `https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api`。
- 修改 `.env.example`，默认管理员改为 `有空管理员 / 已隐藏`，补充 CloudBase 配置项。
- 修改 `.gitignore`，忽略 `dist/` 和 `tmp/` 构建产物。
- 更新 README 和 CHANGELOG。

### 涉及文件

- `server.js`
- `app.js`
- `lib/app.js`
- `lib/store.js`
- `scripts/build-static.js`
- `scripts/build-function.js`
- `cloudbaserc.json`
- `package.json`
- `package-lock.json`
- `.env.example`
- `.gitignore`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

最终采用 CloudBase Hosting + Event 云函数 + HTTP 访问服务 + CloudBase NoSQL + CloudBase Storage。

尝试过程：

- 评估 CloudRun 承载 Express，但 CloudRun 服务端访问 NoSQL 需要额外凭证与环境配置，且当前免费体验版下管理成本较高。
- 尝试 HTTP Web 云函数，CloudBase HTTP 访问服务返回 `FunctionType parameter is invalid`，说明当前访问链路更适合 Event 云函数绑定。
- 改为 Event 云函数并使用 `serverless-http` 包装 Express，成功复用现有 API。

### 设计决策原因

- CloudBase Hosting 适合静态官网，CloudBase 云函数适合低成本动态接口。
- Event 云函数 + HTTP 访问服务在当前 CLI 与环境下更稳定。
- `dist/` 和 `tmp/` 作为构建产物不提交 Git，避免污染仓库和误提交依赖。
- 云函数代码目录只读，云端临时上传目录必须放在 `/tmp`。
- CloudBase HTTP 访问服务会剥离 `/api` 前缀，因此云函数中在非静态模式下补回 `/api` 路由前缀。
- 静态域名与 API 域名不同，线上 Cookie 必须使用 `SameSite=None; Secure`，并配置 CORS credentials。

### 当前完成情况

已完成线上部署：

- 静态官网：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/
- API 服务：https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api
- 云函数：`youkongApi`
- CloudBase 环境：`youkong-d5gh4x0ayc29a2187`

已完成验证：

- `node --check` 通过：`app.js`、`script.js`、`server.js`、`lib/app.js`、`lib/store.js`、构建脚本。
- 本地 JSON 模式 API 冒烟通过。
- CloudBase 线上 API 冒烟通过：模块读取、管理员登录、成员新增、成员登录、活动发布、访客报名、报名表查看。
- Playwright 浏览器验证通过：CloudBase 静态登录页输入 `已隐藏` 后跳转后台，后台内容可见。
- 线上冒烟产生的测试成员、活动和报名记录已通过 CloudBase NoSQL 命令清理。
- 临时探针函数 `ping` 已删除。

### 遗留问题

- 当前登录仍是手机号白名单免密登录，不适合长期直接公网使用。
- 活动暂不支持编辑、下架、删除。
- 报名暂不支持取消和导出。
- CloudBase NoSQL 尚未配置定期备份脚本。
- 静态站点与 API 当前跨域访问，后续建议绑定自定义域名或配置同源代理，降低 Cookie 运维复杂度。
- CloudBase 体验版有效期至 2027-01-09 23:59:59，需在到期前确认续费或迁移方案。

### 下一步建议

1. 增加管理员密码或短信验证码，降低手机号免密登录的安全风险。
2. 增加活动编辑、删除、下架和报名导出功能。
3. 增加 CloudBase NoSQL 数据导出/备份脚本。
4. 配置 GitHub Actions，在合并 `dev` 到 `main` 前自动运行语法检查和基础 API 测试。
5. 绑定自定义域名，让静态页面和 API 尽量同源。

## 2026-07-09 - 优化导航、活动编辑、报名管理和报名成功页

### 任务目标

优化 CloudBase 线上版本的活动管理体验：统一顶部导航展示，允许发起人编辑活动，允许发起人删除报名记录，并在访客报名成功后展示确认页。

### 具体修改内容

- 顶部导航改为由 `app.js` 统一渲染，固定展示：首页、社区共识、活动与参与、捐赠支持、关于与联系、我的、昵称退出。
- `script.js` 的移动端菜单关闭逻辑改为事件代理，适配动态导航。
- 新增活动编辑接口 `PUT /api/activities/:id`，仅活动发起人或管理员可编辑。
- 新增报名记录详情接口 `GET /api/activities/:id/registrations/:registrationId`，供报名成功页读取确认信息。
- 新增报名删除接口 `DELETE /api/activities/:id/registrations/:registrationId`，仅活动发起人或管理员可删除。
- 「我的」页面新增活动编辑按钮，支持保存和取消。
- 「我的」页面报名表新增删除报名人员按钮。
- 新增 `success.html` 报名成功页，展示活动信息、报名昵称和手机号。
- 活动报名成功后跳转到 `success.html`。
- 更新 README、CHANGELOG，并将版本升级到 `0.3.1`。

### 涉及文件

- `app.js`
- `script.js`
- `lib/app.js`
- `me.html`
- `success.html`
- `styles.css`
- `scripts/build-static.js`
- `scripts/build-function.js`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 活动编辑继续复用现有活动表单，使用前端状态 `editingActivity` 区分新增与编辑，避免新增复杂页面。
- 报名成功页通过活动 ID 和报名 ID 查询服务端确认信息，不把手机号等确认信息只放在 URL 中。
- 删除报名记录放在服务端权限校验中，前端只负责触发，确保非发起人不能越权删除。
- 顶部导航由统一函数渲染，解决不同 HTML 页面手写导航不一致的问题。
- `.playwright-cli/` 是本地浏览器验证缓存，加入 `.gitignore`，避免自动化产物污染提交。
- 线上部署后发现 CloudBase CDN 仍返回旧 `app.js`，因此为 `styles.css`、`script.js`、`app.js` 增加 `v=0.3.1` 版本参数，强制页面加载本次静态资源。

### 当前完成情况

已完成开发与本地验证：

- `node --check` 语法检查通过。
- `npm run build:cloudbase` 构建通过。
- 本地 JSON 模式 API 冒烟通过：活动编辑、报名成功查询、报名删除。
- 本地 Playwright 浏览器回归通过：PC/移动导航、活动编辑、访客报名成功页、报名表删除。
- CloudBase 静态站点和云函数已部署，线上 API 冒烟通过：活动编辑、报名成功查询、报名删除。

CloudBase 线上部署验证已完成，待提交并合并稳定分支。

### 遗留问题

- 活动仍暂不支持删除、下架和取消。
- 报名记录删除目前是直接删除，后续可考虑增加二次确认弹窗样式或软删除。
- 报名成功页依赖报名 ID，用户关闭页面后如未保存链接，暂时没有“通过手机号找回报名”的功能。

### 下一步建议

1. 增加活动删除/下架能力。
2. 增加报名导出 CSV。
3. 增加更完整的 Playwright 回归脚本覆盖编辑和删除报名流程。

## 2026-07-09 - 引入活动双岗审核与报名取消

### 任务目标

优化有空客厅活动系统：减少顶部导航闪烁，修复移动端登录后台跳转，增加重复报名直达成功页、报名取消、活动草稿、双岗审核、协作员角色、待办任务和管理员全量活动视图。

### 具体修改内容

- 顶部导航先读取本地缓存用户渲染，再用 `/api/session` 校准，减少“昵称 · 退出”闪烁。
- 登录接口返回 session token，前端保存到 `localStorage` 并通过 `Authorization: Bearer` 兜底，改善移动端跨域 Cookie 兼容性。
- 用户模型从单角色 `role` 扩展为多角色 `roles`，支持成员和协作员多选；默认管理员仍是唯一 `admin`。
- 新增协作员列表接口 `GET /api/collaborators`。
- 活动新增 `status`、`reviewStep`、`reviewLogs`、`collaboratorId` 字段。
- 活动创建支持 `intent=draft` 存草稿，`intent=submit` 提交管理员审核。
- 新增审核接口 `POST /api/activities/:id/review`，支持通过、退回、拒绝。
- 新增撤回接口 `POST /api/activities/:id/withdraw`，审核中、已发布、已满员活动可撤回为草稿。
- 新增报名取消接口 `POST /api/activities/:id/registrations/:registrationId/cancel`。
- 重复报名不再报错，直接返回已有报名记录并跳转同一报名成功页。
- 「我的」页面新增待办任务区、协作员选择、存草稿、提交审核、审核状态展示和撤回按钮。
- 后台新增待办任务区和全部活动区，成员角色管理改为成员/协作员复选。
- 报名成功页新增取消报名按钮和确认弹窗。
- 静态资源版本参数升级为 `v=0.4.0`。
- README、CHANGELOG 同步更新到 `0.4.0`。

### 涉及文件

- `lib/app.js`
- `lib/store.js`
- `app.js`
- `me.html`
- `admin.html`
- `success.html`
- `styles.css`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 保留旧字段 `role`，新增 `roles`，通过 `normalizeRoles` 兼容线上旧数据，降低迁移风险。
- 旧活动没有 `status` 时按 `published` 处理，避免线上已有活动因升级从公开列表消失。
- 审核流使用轻量状态机：`draft`、`admin_review`、`collaborator_review`、`returned`、`rejected`、`published`、`full`、`cancelled`、`ended`。
- 公开列表仅返回 `published`、`full`、`ended`，草稿和审核中活动只允许发起人、管理员或对应协作员查看。
- 移动端登录问题采用 Cookie + Bearer token 双通道，不改变现有云函数 Cookie 机制。

### 当前完成情况

- `node --check` 语法检查通过。
- `npm run build:cloudbase` 构建通过。
- 本地 JSON 模式 API 冒烟通过：角色多选、草稿、提审、管理员审核、协作员审核、重复报名、取消报名、撤回。
- 本地 Playwright 移动端回归通过：管理员手机号登录后进入后台、后台角色区可见、我的页面协作员选择和存草稿可见。
- CloudBase 静态站点和云函数已部署成功。
- CloudBase 线上 API 冒烟通过：成员/协作员新增、活动草稿、提交审核、管理员审核、协作员审核、重复报名、取消报名。
- CloudBase 线上移动端页面验证通过：管理员登录后进入后台，待办区和协作员角色控件可见。
- 线上冒烟产生的测试成员、活动、报名和 session 已清理。
- Git 已提交 `67e1344 feat(workflow): add activity review flow`，并已推送到 GitHub `dev` 和 `main`。

### 遗留问题

- 活动取消和活动结束状态已预留，但暂未提供手动操作入口。
- 审核待办暂无消息通知，需要用户进入页面查看。
- 报名取消无需手机号二次验证，当前依赖报名成功页链接。
- 暂未提供活动删除和报名导出 CSV。

### 下一步建议

1. 增加活动取消/结束入口和状态权限规则。
2. 增加审核通知，可先用微信/飞书群机器人或短信提醒。
3. 增加报名导出 CSV 和活动运营统计。

## 2026-07-09 - 优化审核待办、报名状态和全站视觉体验

### 任务目标

按最新反馈优化活动系统体验：普通成员隐藏待办任务，审核待办可查看上传图片，草稿和审核中活动不能报名，保存/删除动作有明确反馈，全站增加左右留白、统一表单间距，并增强整体视觉和动效。

### 具体修改内容

- 「我的」页面待办任务区增加角色判断，仅协作员显示；普通成员登录后不再看到空待办模块。
- 审核待办详情增加上传封面图展示，管理员和协作员展开详情即可查看活动图片、描述和审核记录。
- 活动详情页按状态控制报名区域：草稿、审核中、退回、拒绝等状态只展示“暂不开放报名”；已发布活动展示报名表；满员/结束活动允许已报名手机号找回确认页，但不接受新报名。
- 后端报名接口调整为只允许 `published` 状态新增报名；公开但满员/结束活动可通过已报名手机号返回原报名确认信息。
- 管理操作增加轻提示：保存、提交审核、撤回、审核通过/退回/拒绝显示“保存成功”；取消报名显示“取消成功”；删除报名、成员、模块显示“删除成功”。
- 删除报名记录、删除成员、删除活动模块均增加确认弹窗。
- 动态渲染内容增加进入动效，覆盖活动列表、待办任务、报名表、活动详情和成功页等区域。
- 全站布局变量调整为 `--max: 1200px`，新增 `--page-gutter` 统一 PC / 移动端左右留白。
- 表单、按钮、管理行、审核卡片、报名表、活动行统一输入框与按钮间距，移动端改为更稳定的单列布局。
- 静态资源版本参数和 package 版本升级到 `0.4.1`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `app.js`
- `lib/app.js`
- `me.html`
- `styles.css`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- `index.html`
- `whitepaper.html`
- `participate.html`
- `donate.html`
- `about.html`
- `login.html`
- `admin.html`
- `activity.html`
- `success.html`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 待办任务隐藏放在前端角色判断中完成，后端 `/api/activities?pending=me` 仍保留权限过滤，避免多余 UI 和越权数据同时出现。
- 报名状态采用前后端双层约束：前端按状态隐藏或调整报名表，后端只允许 `published` 新增报名，确保绕过页面请求也无法报名草稿或审核中活动。
- 满员/结束活动保留已报名手机号查找确认页，是为了兼容“重复报名直接跳转成功页”的使用习惯，同时不扩大新报名入口。
- 视觉优化复用现有黑白克制风格和 reveal 动效体系，只补布局变量、卡片层次、hover、动态内容进入效果，避免引入新框架和过度装饰。
- 静态资源查询参数升级到 `v=0.4.1`，减少 CloudBase Hosting 或浏览器缓存导致线上仍加载旧文件的风险。

### 当前完成情况

- `node --check` 通过：`app.js`、`lib/app.js`、`lib/store.js`、`script.js`、`server.js`、`scripts/build-static.js`、`scripts/build-function.js`。
- `npm run build:cloudbase` 构建通过。
- 本地隔离 JSON 数据库 API 冒烟通过：草稿报名 `400`、审核中报名 `400`、已发布活动报名 `200`。
- 本地 Playwright 页面回归通过：普通成员不显示待办任务区；管理员审核待办可展开查看上传图片；草稿活动详情显示“暂不开放报名”；公开活动移动端报名表正常展示；保存操作出现“保存成功”轻提示。
- PC 后台审核页、移动端活动详情页、移动端「我的」页面截图检查通过，未发现明显按钮挤压、横向溢出或内容贴边问题。

### 遗留问题

- CloudBase 已完成本次 `0.4.1` 部署；后续如继续改动，仍需重新执行部署并验证线上缓存。
- 当前自动化验证仍以手工 Playwright CLI 和 curl 冒烟为主，尚未沉淀为可重复运行的测试脚本。
- 活动取消、活动结束和活动删除仍未提供正式操作入口。
- 富文本编辑器、图片多图排版和报名导出 CSV 仍待后续实现。

### 下一步建议

1. 把本次 API 冒烟和关键 Playwright 流程整理为 `npm test` 或 CI 脚本。
2. 增加活动取消/结束入口和报名导出 CSV。
3. 继续完善生产级登录方式，例如短信验证码、微信登录或后台密码二次校验。

## 2026-07-10 - 全站调整为 Apple 风格视觉系统

### 任务目标

按用户反馈将整个网站从原有社区刊物 / 黑白克制风格统一调整为更高级、清爽、接近 Apple 官网和系统界面的视觉风格，并保证公开页、登录页、后台页、「我的」页和活动页的元素语言一致。

### 具体修改内容

- 全站 CSS 变量改为 Apple 风格浅色系统色：浅灰背景、深灰正文、Apple 蓝主色、柔和边框和轻阴影。
- 顶部导航改为半透明玻璃拟态效果，统一导航项、登录态按钮、移动端折叠菜单的圆角和 hover 状态。
- 首页 Hero、各子页面 Hero、社区共识和治理相关深色区块调整为浅色系统风格，减少沉重色块。
- 主按钮统一为 Apple 蓝胶囊按钮，次级按钮统一为白色半透明描边按钮，危险操作保留红色语义。
- 卡片、统计块、活动行、捐赠卡、二维码占位、FAQ、后台管理行、表格、成功页统一为大圆角、轻阴影、玻璃白背景。
- 表单输入框、下拉框、审核意见区和后台管理块统一圆角、聚焦蓝色描边和更稳定间距。
- 滚动进入动效改为“默认可见、进入视口轻微上浮”，避免截图、低性能设备或脚本延迟时出现大片空白。
- 移动端继续保持单列优先，同时保留首页行动按钮的紧凑两列布局，并在超窄屏降为单列。
- 静态资源版本参数和 package 版本升级到 `0.4.2`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `styles.css`
- `index.html`
- `whitepaper.html`
- `participate.html`
- `donate.html`
- `about.html`
- `login.html`
- `admin.html`
- `me.html`
- `activity.html`
- `success.html`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- `.gitignore`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 保留现有 HTML 结构和业务 JS，仅用 CSS 系统层统一视觉，避免对登录、审核、报名等已验证功能造成额外风险。
- 使用系统字体栈和 Apple 蓝作为主色，配合浅灰背景、玻璃导航、大圆角卡片和轻阴影，形成一致的 Apple 风格而不引入新依赖。
- 将旧的深色页面区块和纸张网格弱化为浅色系统层，解决不同页面视觉割裂的问题。
- 继续使用资源版本号 `v=0.4.2` 控制缓存，降低 CloudBase Hosting 线上样式更新不及时的风险。

### 当前完成情况

- `node --check` 已通过：`app.js`、`lib/app.js`、`lib/store.js`、`script.js`、`server.js`、`scripts/build-static.js`、`scripts/build-function.js`。
- `npm run build:cloudbase` 已通过。
- 本地 Playwright 截图检查通过：首页 PC / 移动端、活动与参与页、登录页、后台页 PC / 移动端均加载新版视觉层，无明显重叠、错位或横向溢出。
- CloudBase `0.4.2` 已部署成功，线上 HTML 已引用 `v=0.4.2` 静态资源，线上 CSS 可查到 Apple 蓝主色、Apple 风格样式层和非阻塞 reveal 动效；公开 API `/api/session` 与 `/api/modules` 返回正常。

### 遗留问题

- 本次主要是视觉系统统一，未新增业务功能。
- 站点仍缺少正式自动化视觉回归测试，当前依赖人工截图检查。
- 如后续有真实活动照片，应替换占位图，让 Apple 风格的清爽界面和有空客厅的真实生活气更好结合。

### 下一步建议

1. 增加可重复运行的 Playwright 视觉冒烟脚本，覆盖首页、登录页、后台页、我的页、活动详情页和报名成功页。
2. 接入真实活动照片和空间照片，建立图片压缩与命名规范。
3. 继续补齐活动取消/结束、报名导出 CSV 和生产级登录方式。

## 2026-07-10 - 网站安全加固

### 任务目标

按用户要求优化网站安全性，在不重构技术栈、不破坏现有登录、后台、活动审核和报名流程的前提下，补齐 MVP 阶段最关键的 Web 安全控制。

### 具体修改内容

- 后端禁用 `X-Powered-By`，新增安全响应头：CSP、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`，CloudBase / HTTPS 环境返回 HSTS。
- 所有 HTML 页面新增 `Content-Security-Policy` meta 和 referrer meta，弥补 CloudBase Hosting 静态页不继承 Express 响应头的问题。
- CORS 从动态回显请求头调整为固定白名单头，只允许配置中的前端 Origin 携带凭据访问 API。
- 所有非 GET API 请求必须携带 `X-Requested-With: XMLHttpRequest`，前端 API 客户端统一自动添加该请求头，降低跨站表单提交风险。
- 新增内存级限流：普通写操作按 IP 限流，登录按 IP 和手机号双维度限流，报名按 IP 和活动限流。
- Session 服务端从明文 token 调整为 token 哈希存储，并新增 `expiresAt` 过期时间；登录 token 随机强度提升到 32 字节。
- 新生成业务 ID 的随机后缀从 4 字节提升到 8 字节，降低报名确认链接和资源 ID 被猜测的概率。
- 上传封面新增 MIME 和扩展名双重白名单，只允许 JPG、PNG、WebP、GIF，单文件最大 6MB。
- 手机号、昵称、模块名称、模块说明、活动标题、发起人、地点、活动描述、审核说明增加格式和长度校验。
- 公开协作员接口和登录态接口不再返回手机号，管理员成员管理接口保留手机号。
- 错误处理优化：上传类型错误、文件过大、请求体过大等返回明确 4xx 信息，避免泛化 500。
- 新增 `docs/security.md`，记录当前安全控制、配置项和遗留风险。
- 环境变量新增 `CORS_ORIGINS`、`SESSION_MAX_AGE_DAYS`，CloudBase 部署配置同步增加。
- 静态资源版本参数和 package 版本升级到 `0.4.3`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `lib/app.js`
- `app.js`
- `.env.example`
- `cloudbaserc.json`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- `index.html`
- `whitepaper.html`
- `participate.html`
- `donate.html`
- `about.html`
- `login.html`
- `admin.html`
- `me.html`
- `activity.html`
- `success.html`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`
- `docs/security.md`

### 技术方案选择

- 不引入 `helmet`、`express-rate-limit` 等新依赖，而是在现有 Express 应用中实现轻量安全中间件，减少 CloudBase 云函数部署和依赖审计的不确定性。
- 继续保留前端 Bearer token 兜底，以兼容 CloudBase 静态域名和 API 域名跨站 Cookie 的移动端问题；服务端改为只保存 token 哈希，降低数据库泄露风险。
- CSRF 防护选择“自定义请求头 + CORS 白名单”的轻量方案，适合当前 Vanilla JS 前端和 API 分域部署形态。
- 限流采用进程内 Map，适合 MVP 阶段快速降低暴力尝试风险；多实例全局限流后续应交给网关、WAF 或共享存储。
- 上传限制采用 MIME 与扩展名双重校验，直接拒绝 SVG、HTML 和脚本类文件，降低上传型 XSS 风险。

### 当前完成情况

- `node --check` 已通过：`app.js`、`lib/app.js`、`lib/store.js`、`script.js`、`server.js`、`scripts/build-static.js`、`scripts/build-function.js`。
- 本地隔离 JSON 数据库安全冒烟通过：缺少安全校验头的 POST 返回 `403`；正常登录成功；Session 数据库只保存 `tokenHash` 和 `expiresAt`；静态页返回 CSP、XFO、nosniff、Referrer-Policy、Permissions-Policy；管理员新增协作员成功；活动草稿保存成功；非法 HTML 文件上传返回 `400`。
- 本地浏览器验证通过：登录页输入管理员手机号后进入后台，控制台无 CSP 或脚本错误。
- CloudBase `0.4.3` 已部署成功：线上静态页引用 `v=0.4.3` 并包含 HTML CSP；线上 API 返回安全响应头；缺少安全校验头的登录 POST 返回 `403`。
- `npm audit --omit=dev --registry=https://registry.npmjs.org` 已运行，仍报告 `@cloudbase/node-sdk@3.18.3` 传递依赖中的 axios / lodash 风险；当前 CloudBase 官方最新版本仍为 `3.18.3`，暂未强行 override，已记录到 `docs/security.md`。

### 遗留问题

- 当前登录仍是手机号白名单免密登录，建议后续升级为短信验证码、微信登录或密码加二次校验。
- 取消报名和报名成功页仍依赖报名 ID 作为访问凭据，后续可增加一次性确认 token 或手机号二次校验。
- 当前限流是进程内存级，多实例下不是全局限流，生产流量增长后应接入 CloudBase 网关、WAF 或共享存储限流。
- 依赖审计中的 CloudBase SDK 传递依赖风险需要持续关注官方更新。
- 尚未把安全冒烟整理成可重复运行的 `npm test` 或 CI 流程。

### 下一步建议

1. 增加生产级登录：短信验证码、微信登录或后台密码二次校验。
2. 给报名确认 / 取消报名增加独立一次性 token，并支持报名手机号二次确认。
3. 接入自动化安全测试和依赖审计 CI，定期检查 CloudBase SDK 漏洞修复。

## 2026-07-10 - 角色工作台与管理子页面重构

### 任务目标

按用户确认的方向，将「我的」和 YKadmin 后台从高增长长列表页面重构为入口型工作台，并把活动、成员、模块、审核待办拆成独立子页面，降低活动和人员数据增长后的臃肿感。

### 具体修改内容

- 将 `me.html` 改为成员工作台：展示活动状态概览和入口卡片。
- 将 `admin.html` 改为 YKadmin 工作台：展示全部活动、成员管理、模块管理、审核待办入口。
- 新增 `activity-editor.html`，承载发起 / 编辑活动表单，支持存草稿与提交审核。
- 新增 `my-activities.html`，承载我发起的活动列表、搜索筛选、撤回和报名表查看。
- 新增 `review-tasks.html`，承载管理员 / 协作员审核待办，可展开活动详情、封面图和审核记录。
- 新增 `admin-activities.html`，承载管理员全部活动查看和筛选。
- 新增 `admin-members.html`，承载成员搜索、角色筛选、新增、编辑、删除。
- 新增 `admin-modules.html`，承载活动模块搜索、新增、编辑、删除。
- `app.js` 新增工作台渲染、筛选排序、分页加载、子页面初始化和角色权限控制逻辑。
- `styles.css` 新增工作台卡片、筛选面板、编辑 / 管理双栏布局、粘性侧栏、加载更多按钮等样式。
- 增加全局 `[hidden] { display: none !important; }`，修复按钮样式覆盖 HTML 隐藏属性导致隐藏控件外露的问题。
- `scripts/build-static.js` 补齐新增 HTML 页面，确保 CloudBase Hosting 部署包含所有子页面。
- 首页、活动与参与页、活动详情页和登录页相关入口文案与链接改为新的工作台 / 发起活动页面。
- 版本号和静态资源参数升级到 `0.5.0`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `app.js`
- `styles.css`
- `me.html`
- `admin.html`
- `activity-editor.html`
- `my-activities.html`
- `review-tasks.html`
- `admin-activities.html`
- `admin-members.html`
- `admin-modules.html`
- `index.html`
- `participate.html`
- `activity.html`
- `login.html`
- `scripts/build-static.js`
- `scripts/build-function.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 继续使用现有 HTML / CSS / Vanilla JS 架构，不引入 React 或新的前端框架，降低部署和接手成本。
- 保留现有 API 与审核流，只重构前端信息架构和页面入口，避免影响已经验证过的登录、审核、报名和 CloudBase 存储逻辑。
- 使用工作台卡片承载高层入口，使用独立列表页承载高增长数据，后续活动、成员和模块数量增加时可继续扩展筛选、分页和导出。
- 筛选分页先放在前端完成，适合当前数据规模；当活动量继续增长后可把筛选条件下沉到 API 查询层。
- 沿用 Apple 风格视觉系统，新增页面使用同一套按钮、表单、卡片、间距和移动端断点。

### 当前完成情况

- `node --check` 已通过：`app.js`、`lib/app.js`、`lib/store.js`、`script.js`、`server.js`、`scripts/build-static.js`、`scripts/build-function.js`。
- `npm run build:cloudbase` 已通过。
- CloudBase `0.5.0` 已部署成功：静态托管上传 26 个文件，新增子页面均可通过线上地址访问，线上 HTML 已引用 `v=0.5.0`；云函数 `youkongApi` 部署成功，线上 `/api/session` 返回安全响应头和 `{"user":null}`。
- 本地 Playwright 验证通过：管理员登录进入 YKadmin 工作台；普通成员只看到发起活动和我的活动入口；协作员可看到审核待办入口。
- 本地 Playwright 流程验证通过：新增协作员和成员、成员发起活动、管理员审核、协作员审核、活动发布、访客报名、重复报名跳转已有确认页、取消报名弹窗和取消后页面。
- 本地 Playwright 验证通过：审核待办展开后可查看上传封面图；管理员全部活动、成员管理、模块管理页面均可打开且控制台无错误。
- 本地移动端 390px 验证通过：工作台卡片、全部活动筛选、活动列表和导航自然换行；隐藏控件不再外露。

### 遗留问题

- 当前列表筛选和分页仍在前端完成，数据量明显增加后需要改为服务端分页和查询。
- 管理员全部活动页目前以查看为主，后续可增加管理员取消、结束、删除活动能力。
- 报名表目前显示在「我的活动」侧栏中，后续可以拆成活动报名详情页，适合报名人数较多的活动。
- 工作台统计仍是基础计数，后续可增加待办趋势、报名趋势、即将开始活动等运营指标。

### 下一步建议

1. 为活动、成员、模块列表增加服务端分页和查询参数。
2. 新增活动报名详情页，并支持 CSV 导出。
3. 增加管理员取消 / 结束活动能力和操作日志。
4. 把本次 Playwright 冒烟流程沉淀为可重复运行的自动化测试脚本。

## 2026-07-10 - 报名表详情、操作日志与分页筛选优化

### 任务目标

按用户新增优化要求，继续拆解高增长数据页面：将报名表改为独立详情页并支持 CSV 导出；新增管理员操作日志；将活动、成员、模块筛选改为点击「筛选」后查询；将列表改为 API 分页；补齐管理员取消 / 结束活动能力，并继续修复表单间距和移动端输入溢出。

### 具体修改内容

- 新增 `registrations.html`，活动发起人和管理员可进入独立报名表页面，查看报名者、删除报名记录、导出 CSV。
- 新增 `admin-logs.html`，管理员可查看系统关键操作日志，支持关键词搜索和加载更多。
- `lib/store.js` 新增 `logs` 集合，本地 JSON 和 CloudBase 均会初始化日志集合。
- `lib/app.js` 新增操作日志写入能力，覆盖登录、退出、成员新增/保存/删除、模块新增/保存/删除、活动草稿/提审/审核/退回/拒绝/撤回/取消/结束、报名新增/删除/取消。
- `lib/app.js` 新增 `/api/logs`、`POST /api/activities/:id/cancel`、`POST /api/activities/:id/end`。
- `lib/app.js` 为 `/api/activities`、`/api/users`、`/api/modules` 增加服务端筛选和分页返回 `pageInfo`。
- `app.js` 将活动、成员、模块、日志列表改为点击筛选后请求 API；加载更多请求下一页并追加，避免扩大 `pageSize` 的隐患。
- `app.js` 将报名表按钮改为跳转 `registrations.html`；草稿、退回、拒绝、审核中且无人报名的活动不展示报名表入口，已发布过或已有报名记录的活动展示入口。
- `app.js` 将审核意见默认值改为「请选择」，未选择时阻止提交。
- `app.js` 将成员角色控件改为单选下拉，YKadmin 仍固定为唯一管理员。
- `styles.css` 增加表单按钮、工具栏按钮、筛选面板和移动端日期输入的统一间距与宽度约束，修复移动端 `datetime-local` / `date` 控件溢出。
- `me.html` 和 `admin.html` 保持待办预览在入口模块上方；普通成员不展示待办区。
- `scripts/build-static.js` 补齐 `registrations.html` 和 `admin-logs.html`。
- 版本号、静态资源参数和云函数构建版本升级到 `0.6.0`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `app.js`
- `lib/app.js`
- `lib/store.js`
- `styles.css`
- `registrations.html`
- `admin-logs.html`
- `me.html`
- `admin.html`
- `my-activities.html`
- `admin-activities.html`
- `admin-members.html`
- `admin-modules.html`
- `activity-editor.html`
- `scripts/build-static.js`
- `scripts/build-function.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 继续沿用现有 Vanilla JS + Express 架构，不引入前端框架，避免重构成本过大。
- 报名表拆成独立详情页，避免活动列表随着报名人数增长变得臃肿；CSV 在浏览器端生成，减少后端导出接口复杂度。
- 操作日志采用追加写入 `logs` 集合，日志写入失败不阻断主流程，避免审计能力影响用户操作。
- 列表分页采用 API 层 `page` + `pageSize`，前端加载更多请求下一页并追加；当前 CloudBase Store 仍会在服务端读取集合后筛选，后续数据量更大时可继续升级为数据库条件查询。
- 搜索只绑定 `submit`，不绑定输入事件，避免用户每打一个字就触发请求。
- 活动人数上限固定为 99，留空也按 99 处理，降低被批量提交拖垮报名表的风险。

### 当前完成情况

- `node --check` 已通过：`app.js`、`lib/app.js`、`lib/store.js`、`script.js`、`server.js`、`scripts/build-static.js`、`scripts/build-function.js`。
- `git diff --check` 已通过。
- `npm run build:cloudbase` 已通过。
- 本地 JSON 模式 API 冒烟通过：管理员登录、新增协作员/成员、成员发起活动、人数留空默认 99、管理员审核、协作员审核、访客报名、重复报名找回确认页、报名表读取、操作日志搜索、管理员结束活动。
- 本地 Playwright 验证通过：管理员登录跳转后台；待办预览位于后台入口模块上方；移动端 390px 下发起活动时间字段、全部活动开始/结束日期筛选、成员管理、操作日志、报名表页面均无横向溢出。
- 本地 Playwright 验证通过：成员角色为单选下拉；报名表 CSV 按钮可见；审核意见默认「请选择」；带封面活动在审核待办中可查看上传图片；控制台无错误。
- CloudBase `0.6.0` 已部署成功：静态托管上传 28 个文件，`registrations.html` 和 `admin-logs.html` 均可访问，线上 HTML / JS / CSS 已引用 `v=0.6.0`；云函数 `youkongApi` 部署成功，线上 `/api/session` 返回 `200`、安全响应头和 `{"user":null}`。

### 遗留问题

- 当前 CloudBase Store 的筛选分页仍是 API 进程读取集合后处理，不是数据库索引级分页；当数据量明显增长时，建议改为 CloudBase 查询条件、索引和游标分页。
- 操作日志目前只支持关键词搜索，后续可增加动作类型、操作人、时间范围等筛选条件。
- CSV 导出在浏览器端完成，后续如需更复杂报表可增加后端导出接口。
- 尚未把本次 API 和 Playwright 冒烟整理成可重复运行的 `npm test`。

### 下一步建议

1. 将 CloudBase 查询升级为数据库层筛选、排序和分页，并为常用字段建立索引。
2. 增加自动化测试脚本，覆盖登录、审核、报名、报名表导出和日志查询。
3. 增加操作日志高级筛选：操作类型、操作人、目标对象、时间范围。
4. 继续升级登录体系：短信验证码、微信登录或管理员二次校验。

## 2026-07-10 - CloudBase 存储层分页与自动化冒烟测试

### 任务目标

落实上次建议：将 CloudBase 查询升级为数据库层筛选、排序和分页，避免云函数读取集合全量后再分页；同时把 API / Playwright 冒烟沉淀为 `npm test`，让后续发版前可以一键回归。

### 具体修改内容

- `lib/store.js` 新增统一 `query(collection, options)` 接口。
- JSON 本地模式通过 `localQueryItems` 模拟等值、包含、范围、关键词、排序和分页。
- CloudBase 模式通过 `where`、`orderBy`、`skip`、`limit` 和 `count` 执行存储层查询。
- `/api/users`、`/api/collaborators`、`/api/modules`、`/api/activities`、`/api/logs` 改为调用 `store.query()`。
- 活动创建时写入 `registrationCount: 0`；报名新增、删除、取消时同步维护 `registrationCount`，支持按报名人数排序。
- `package.json` 新增 `test`、`test:syntax`、`test:smoke`。
- 新增 `tests/smoke.test.js`，使用隔离 JSON 数据库启动临时 Express 服务，覆盖 API 主链路和 Playwright 浏览器布局检查。
- 新增 `docs/cloudbase-indexes.md`，记录 CloudBase 推荐索引、查询字段和后续注意事项。
- 版本号升级到 `0.7.0`，云函数构建版本同步升级。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `lib/store.js`
- `lib/app.js`
- `tests/smoke.test.js`
- `docs/cloudbase-indexes.md`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 没有直接在路由层写 CloudBase SDK 代码，而是新增 `store.query()`，保持 JSON / CloudBase 双存储接口一致。
- CloudBase 查询支持等值、数组包含、`in`、日期范围、关键词正则、排序和分页；本地 JSON 用同一 options 结构模拟，保证本地测试能覆盖同样语义。
- 活动报名数采用冗余字段 `registrationCount` 支持数据库层排序；页面展示仍由业务层补齐真实报名数，兼容历史活动记录。
- 自动化测试使用 Node 内置 test runner 启动临时服务，并直接调用 Playwright 库做浏览器冒烟，避免依赖外部手工启动服务。
- 测试服务使用随机端口和临时 JSON 数据库，不污染本地真实数据和 CloudBase 线上数据。

### 当前完成情况

- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- API 冒烟覆盖：缺少安全校验头的 POST 返回 `403`；管理员登录；新增协作员/成员；成员发起活动；人数留空默认 99；服务端分页；双岗审核；访客报名；重复报名找回确认页；报名表读取；操作日志搜索；按报名人数排序。
- Playwright 冒烟覆盖：管理员登录跳转后台；移动端 390px 下发起活动页、全部活动页、成员管理页、操作日志页、报名表页无横向溢出；审核意见默认「请选择」；审核待办展示上传封面图。
- `node --check` 已纳入 `npm test` 的 `test:syntax` 阶段。
- CloudBase `0.7.0` 已部署成功：静态托管上传 28 个文件，云函数 `youkongApi` 部署成功；线上成员、模块、活动、日志分页查询均返回正确 `pageInfo`。

### 遗留问题

- CloudBase 推荐索引需要在 CloudBase 控制台手动创建，索引配置本身未纳入自动部署。
- 关键词搜索仍使用正则，数据继续增长后建议增加更明确筛选项，例如操作类型、操作人和时间范围。
- 活动模块名、创建人名、协作员名仍是 API 聚合字段；如需完全索引化搜索这些派生字段，需要在活动记录中增加冗余字段并维护同步。
- 尚未增加 GitHub Actions CI。

### 下一步建议

1. 在 CloudBase 控制台按 `docs/cloudbase-indexes.md` 建立推荐索引。
2. 新增 GitHub Actions，在 PR 或 dev/main push 时运行 `npm test` 和 `npm run build:cloudbase`。
3. 为操作日志增加操作类型、时间范围和操作人筛选，减少宽泛关键词正则查询。

## 2026-07-10 - 活动自动结束与近期 / 历史活动页

### 任务目标

优化公开活动体验：活动日期结束后自动归档为「活动结束」，结束活动不再出现在首页；首页将近期活动提前展示并最多露出 3 条；新增可查看所有近期活动和历史活动的独立页面；首页 Hero 按钮从「发起一个活动」调整为「参加活动」。

### 具体修改内容

- `lib/app.js` 新增活动自动结束逻辑：按北京时间判断活动日期，发布 / 满员活动在活动日期次日 0 点后自动更新为 `ended`。
- 新增 `sweepExpiredActivities()`、`closeExpiredActivities()` 和 `startActivityAutoEndScheduler()`，本地服务启动后开启轮询，公开活动列表请求前强制兜底 sweep。
- `scripts/build-function.js` 更新 CloudBase 云函数入口，每次云函数请求前执行节流后的活动结束 sweep。
- `/api/activities` 新增公开视图语义：默认 `view=upcoming` 只返回未结束活动，`view=history` 返回已结束活动。
- `index.html` 将近期活动区移动到「我们是谁」之前，最多展示 3 条近期活动；Hero 按钮改为「参加活动」。
- 新增 `activities.html`，承载所有近期活动和历史活动两种视图。
- `app.js` 新增公开活动列表页初始化、近期 / 历史 tab 状态、加载更多、首页列表按 `data-limit` 拉取。
- `styles.css` 新增活动列表页、分段切换、列表工具栏和活动预览样式。
- `scripts/build-static.js` 将 `activities.html` 加入 CloudBase Hosting 构建清单。
- `tests/smoke.test.js` 新增动态未来 / 过去活动时间、自动归档断言、近期 / 历史页移动端无横向溢出检查。
- 版本号、静态资源参数和云函数构建版本升级到 `0.8.0`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `lib/app.js`
- `scripts/build-function.js`
- `scripts/build-static.js`
- `app.js`
- `styles.css`
- `index.html`
- `participate.html`
- `activities.html`
- `tests/smoke.test.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 活动自动结束按「活动日期」而不是具体开始时间判断：例如 2026-07-19 18:00 的活动，会在北京时间 2026-07-20 00:00 后归档，符合用户描述。
- 保留 `ended` 活动的详情页可见性，让已报名者仍能进入确认页或查看历史活动；但默认公开列表只展示 `published` / `full`。
- CloudBase 云函数不保证长期常驻，因此除本地 / 常驻服务的 `setInterval` 轮询外，公开活动列表请求前也会强制 sweep，避免首页展示过期活动。
- 历史活动未另建后端接口，而是复用 `/api/activities?view=history`，减少 API 面并保留分页 / 排序能力。
- 测试中使用动态日期生成未来活动和过期活动，避免固定日期在未来变成不稳定测试。

### 当前完成情况

- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `git diff --check` 已通过。
- `npm run build:cloudbase` 已通过。
- API 冒烟覆盖：过期发布活动在公开列表请求时自动改为 `ended`，不再出现在近期活动中，并出现在历史活动视图。
- Playwright 冒烟覆盖：`activities.html` 和 `activities.html?view=history` 在 390px 移动端无横向溢出。
- CloudBase `0.8.0` 已部署成功：静态托管上传 29 个文件，云函数 `youkongApi` 部署成功。
- 线上只读冒烟通过：首页已引用 `v=0.8.0` 并出现「参加活动」，`activities.html` 已上线；`/api/activities?view=upcoming&page=1&pageSize=3` 返回 2 条，`view=history` 返回 1 条，均带正确 `pageInfo`。

### 遗留问题

- CloudBase 控制台索引仍需按 `docs/cloudbase-indexes.md` 手动确认，尤其是 `status + startsAt`。
- 当前自动结束以活动开始日期为准，暂未支持活动发起人填写单独结束时间；如果未来出现跨天活动，需要增加 `endsAt` 字段。

### 下一步建议

1. 在 CloudBase 控制台确认 `yk_activities` 的 `status + startsAt` 索引。
2. 在活动编辑表单增加可选「结束时间」，支持跨天活动精确归档。
3. 增加 GitHub Actions，在 `dev` / `main` push 时自动运行 `npm test` 和 `npm run build:cloudbase`。

## 2026-07-10 - 活动结束时间与 GitHub Actions CI

### 任务目标

继续完成上次建议：为活动增加可选「结束时间」字段，避免跨天活动只按开始日期被提前归档；同时补齐 GitHub Actions CI，让 `dev` / `main` push 和 PR 自动运行测试与构建。

### 具体修改内容

- `activity-editor.html` 新增「结束时间（可选）」输入框。
- `lib/app.js` 的活动输入解析新增 `endsAt` 字段。
- 活动校验新增结束时间格式检查，且结束时间不能早于开始时间。
- 活动创建和编辑接口保存 `endsAt`。
- 自动结束归档逻辑优先使用 `endsAt` 所在日期判断；未填写结束时间时继续使用 `startsAt`。
- `app.js` 新增 `formatActivityTime()`，列表、详情页、报名确认、报名表、审核待办、后台活动管理统一展示起止时间。
- `tests/smoke.test.js` 增加带结束时间活动和跨天未结束活动的 API 冒烟覆盖。
- 新增 `.github/workflows/ci.yml`，在 `dev` / `main` push 和 PR 时执行 `npm ci`、安装 Playwright Chromium、`npm test` 和 `npm run build:cloudbase`。
- 版本号、静态资源参数和云函数构建版本升级到 `0.9.0`。
- README、CHANGELOG、开发日志同步更新。

### 涉及文件

- `activity-editor.html`
- `lib/app.js`
- `app.js`
- `tests/smoke.test.js`
- `.github/workflows/ci.yml`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- `endsAt` 保持可选，避免增加普通单日活动的填写负担；只有跨天或明确结束时间的活动才需要填写。
- 归档仍按日期而不是精确分钟执行：填写 `endsAt=2026-07-20 10:00` 的活动，会在北京时间 2026-07-21 00:00 后自动归档，符合「结束日期次日归档」的规则。
- 公开列表仍按 `startsAt` 排序，结束时间只影响展示和归档判断；这避免破坏已有首页和历史活动排序体验。
- CI 只做测试和构建，不做 CloudBase 自动部署，避免 main push 直接影响线上环境；部署仍保留人工执行。

### 当前完成情况

- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `git diff --check` 已通过。
- `npm run build:cloudbase` 已通过。
- CloudBase `0.9.0` 已部署成功：静态托管上传 29 个文件，云函数 `youkongApi` 部署成功。
- 线上只读冒烟通过：`activity-editor.html` 已引用 `v=0.9.0` 并包含 `endsAt` 字段，线上 `app.js` 已包含 `formatActivityTime` 和 `activity.endsAt` 逻辑，`/api/activities?view=upcoming&page=1&pageSize=3` 返回 2 条并带正确 `pageInfo`。

### 遗留问题

- CI 首次在 GitHub 运行时需要确认 Playwright 依赖安装耗时和缓存是否稳定。
- 如未来需要精确到活动结束当分钟归档，需要将当前按日期归档策略改为按时间戳比较。

### 下一步建议

1. 观察 GitHub Actions 首次运行结果，如 Playwright 依赖安装过慢，可增加更细缓存或改用官方 Playwright GitHub Action。
2. 后续可增加 CloudBase 数据备份脚本，并把备份校验纳入定期运维。

## 2026-07-11 - 报名保护、安全日志与运营归档加固

### 任务目标

根据下一阶段优化清单，优先处理长期运营最容易出问题的底座能力：报名名额保护、重复报名幂等、日志隐私、活动操作限流、过期 session 清理和管理员手动归档能力。

### 具体修改内容

- `lib/app.js` 新增活动维度报名写入锁 `withMutationLock()`，报名、删除报名和取消报名按活动串行执行。
- 新增幂等报名 ID：同一活动同一手机号生成稳定 `reg_` ID，并保存 `phoneHash`，重复提交可稳定返回已有报名。
- 新增 `syncActivityRegistrationCount()`，统一维护报名数和 `published` / `full` 状态切换。
- 活动创建、编辑、审核、撤回、取消、结束接口增加成员级细粒度限流。
- 操作日志中的 `actorPhone` 改为脱敏手机号，减少日志长期保存完整手机号。
- 登录和本地服务启动时清理过期 session。
- 自动归档日志记录归档日期和触发来源；新增管理员手动触发归档接口 `/api/system/auto-end`。
- `tests/smoke.test.js` 增加一人名额并发报名、满员删除报名后释放名额、日志手机号脱敏、手动归档接口断言。
- 版本号、静态资源参数和云函数构建版本升级到 `0.10.0`。
- README、CHANGELOG、`docs/security.md`、`docs/cloudbase-indexes.md` 和开发日志同步更新。

### 涉及文件

- `lib/app.js`
- `tests/smoke.test.js`
- `package.json`
- `package-lock.json`
- `scripts/build-function.js`
- 全部 HTML 静态资源版本参数
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/cloudbase-indexes.md`
- `docs/dev-log.md`

### 技术方案选择

- 报名保护先采用活动维度进程锁和幂等报名 ID：实现成本低，能覆盖当前单实例、本地测试和大多数低并发场景；同时文档明确多实例下仍需升级数据库事务、唯一索引或队列锁。
- 报名 ID 使用活动 ID + 手机号哈希生成，避免重复请求生成多条不同 ID 的报名记录；报名表仍保留完整手机号供发起人和管理员联系报名者。
- 操作日志改为保存脱敏手机号，而不是只在前端展示时脱敏，降低后端日志数据本身的隐私风险。
- 活动报名数状态统一收口到 `syncActivityRegistrationCount()`，减少未来维护时新增、删除、取消报名三处逻辑不一致。
- 管理员手动归档接口只暴露给 YKadmin，用于运营排查和补扫；正常情况下仍依赖定时 / 请求兜底 sweep。

### 当前完成情况

- 已完成代码开发和文档更新。
- 已补充自动化测试覆盖上述关键路径。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `git diff --check` 已通过。
- `npm run build:cloudbase` 已通过。
- CloudBase `0.10.0` 已部署成功：静态托管上传 29 个文件，云函数 `youkongApi` 部署成功。
- 线上只读冒烟通过：`index.html` 已引用 `v=0.10.0`，`/api/activities?view=upcoming&page=1&pageSize=3` 返回活动数据和 `pageInfo`，`/api/system/auto-end` 未登录返回 `403`。
- 待执行：GitHub 双分支推送和 CI 观察。

### 遗留问题

- 当前活动维度报名锁仍是进程内锁，CloudBase 多实例或高并发场景下不能替代全局事务。
- 旧报名记录可能没有 `phoneHash` 字段，代码已兼容旧 `phone` 判断；后续可做一次数据回填。
- 取消报名页仍以报名 ID 作为访问凭据，后续可增加一次性 token 或手机号二次校验。

### 下一步建议

1. 为 CloudBase `yk_registrations` 增加 `activityId + phoneHash` 索引。
2. 设计数据库级报名事务或队列锁，彻底解决多实例并发名额问题。
3. 增加通知系统雏形：审核通过 / 退回通知发起人，有人报名通知发起人。

## 2026-07-11 - 0.11.0 全站视觉系统改版

### 任务目标

根据最新设计要求，充分使用 `design-taste-frontend` 和 `impeccable` 两个前端审美 skill，对有空客厅官网和后台整体视觉进行大改，降低通用 Apple / SaaS 感，让公开页面更贴近重庆社区公共客厅，后台页面更像稳定可交接的产品工具。

### 具体修改内容

- `styles.css` 新增 0.11.0 视觉刷新层：统一色彩、边距、半径、按钮、表单、表格、卡片、活动列表、工作台入口和响应式规则。
- 首页首屏文案压缩，保留原核心含义，减少首屏文字负担。
- 全部 HTML 静态资源版本参数升级到 `v=0.11.0`。
- `package.json` 和 `package-lock.json` 版本升级到 `0.11.0`。
- README 和 CHANGELOG 同步更新当前版本、视觉体验说明、完成状态和验证记录。

### 涉及文件

- `styles.css`
- `index.html`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 保留现有路由、业务 JS 和后端 API，不重写审核、报名、登录逻辑，降低功能回归风险。
- 公开页面采用“社区公共客厅 / 城市公告栏 / 真实照片”的视觉方向，替换原先偏通用的 Apple 蓝、玻璃卡片和科技感按钮。
- 后台和“我的”页面按产品界面处理：控件间距、表单焦点、筛选面板、工作台入口卡片保持克制和一致，不加入装饰性动效。
- 工作台卡片使用 `auto-fit` 自适应网格，避免管理员、成员、协作员入口数量不同时出现空列。
- 四宫格 bento 规则只在桌面宽度启用，移动端统一回到单列，避免隐式列导致横向溢出。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run build:cloudbase` 已通过。
- `git diff --check` 已通过。
- 本地 Playwright 视觉检查通过：`index.html`、`login.html`、`activities.html`、`admin.html` 在 1440px 和 390px 关键视口下无横向溢出。
- 本地验证中，`已隐藏` 不存在于当前 JSON 种子数据；使用本地种子管理员 `18800000000` 登录验证后台跳转和管理员工作台。

### 遗留问题

- 0.11.0 尚未部署到 CloudBase 线上环境，需要后续执行 `npm run deploy:cloudbase` 并做线上只读冒烟。
- 当前视觉改版以 CSS 覆盖层为主，后续如继续大改，可考虑整理 `styles.css`，把旧 Apple 风格覆盖层合并清理，降低长期维护成本。
- 公开页面仍依赖现有少量真实照片和占位照片位，后续应补充更多饭桌、活动、街区和空间照片。

### 下一步建议

1. 部署 0.11.0 到 CloudBase，并确认线上静态页已引用 `v=0.11.0`。
2. 用真实活动数据复查首页近期活动和活动列表卡片，必要时微调封面比例和空状态。
3. 把 `styles.css` 做一次结构化整理，拆出设计 token、公开页面组件和后台产品组件三段，减少后续改版冲突。

## 2026-07-11 - 0.12.0 艺术化视觉升级

### 任务目标

根据反馈继续提升网站精致度和艺术感，充分使用 `design-taste-frontend` 和 `impeccable` 两个 skill，将公开页从相对简洁的社区册页继续推进到更接近艺术网站 / 展览网站的视觉效果，同时保持后台功能页的稳定可读。

### 具体修改内容

- `styles.css` 新增 0.12 艺术化视觉层：公开页切换为深色展场氛围、真实照片首屏、图片拼贴、暗色活动公告和更强色彩对比。
- `script.js` 新增页面分类：公开页添加 `public-surface`，后台和成员工作台添加 `product-surface`。
- `script.js` 新增桌面端指针聚光动效：通过 CSS 变量驱动背景光感和卡片局部高光，尊重 `prefers-reduced-motion`。
- `activity-editor.html` 给发起活动页补充 `data-activity-editor-page`，避免公开页艺术化样式误伤活动编辑表单。
- 全部 HTML 静态资源版本参数升级到 `v=0.12.0`。
- `package.json` 和 `package-lock.json` 版本升级到 `0.12.0`。
- README 和 CHANGELOG 同步更新当前版本、视觉体验和验证结果。

### 涉及文件

- `styles.css`
- `script.js`
- `activity-editor.html`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 公开页和产品页分层处理：公开页承担品牌感和艺术感，产品页保留任务导向的浅色工具台，避免管理操作被复杂动效和深色背景干扰。
- 动效优先使用 CSS transform / opacity / filter 和 IntersectionObserver，不引入 GSAP 或其他大依赖，保持当前 Vanilla JS 项目的轻量结构。
- 指针聚光只在 `pointer: fine` 且未开启减少动态效果时启用，移动端和减少动态效果用户不会承担额外动效负担。
- 继续使用现有真实图片资产，不引入外链图片，避免 CloudBase 静态资源依赖外部可用性。

### 当前完成情况

- 已完成代码开发和文档更新。
- 已完成 `node --check script.js`。
- 本地 Playwright 视觉检查通过：`index.html` 桌面 1440px、首页手机 390px、`activities.html` 手机 390px、`admin.html` 手机 390px 均无横向溢出。
- 本地 Playwright 复查通过：`login.html` 手机 390px 登录卡片与说明区不再重叠，`admin.html` 手机 390px 产品页顶部标签对比度已修正。
- 修复检查中发现的五类视觉问题：移动端 Hero 竖排、活动页标签对比度、后台按钮和空状态可读性、登录页移动端重叠、产品页顶部标签对比度。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run build:cloudbase` 已通过。
- `git diff --check` 已通过。

### 遗留问题

- 0.12.0 尚未部署到 CloudBase 线上环境，需要后续执行 `npm run deploy:cloudbase` 并做线上只读冒烟。
- `styles.css` 目前通过 0.11 和 0.12 两层覆盖实现快速迭代，长期应整理为结构化样式文件，降低覆盖规则复杂度。
- 公开页更依赖视觉资产质量，后续建议补充真实饭桌、活动、街区、夜晚和空间细节照片，替换少量重复图片。

### 下一步建议

1. 完成完整自动化测试和构建后，部署 0.12.0 到 CloudBase。
2. 用线上真实活动数据复查活动卡片封面、空状态和报名页详情。
3. 把视觉系统整理成三层：基础 token、公开页艺术组件、后台产品组件。

## 2026-07-11 - 0.13.1 主题切换与旧标识清理

### 任务目标

根据最新优化要求，为全站增加白天 / 黑夜 / 跟随系统主题切换；管理员、成员、协作员登录后的后台页面也支持主题切换；增加一键回到首页按钮；移除网站中所有旧标识相关信息。

### 具体修改内容

- 新增 `theme.js`，在 CSS 加载前读取本地主题偏好，设置 `html[data-theme]` 和 `html[data-theme-mode]`，并监听系统深浅色变化。
- `script.js` 新增顶部导航主题切换控件，包含白天、黑夜、跟随系统三个按钮；新增浮动「首页」按钮。
- `styles.css` 新增 0.13 主题层：公开页支持白天主题，后台产品页支持黑夜主题，并补充主题按钮、图标和浮动首页按钮样式。
- 全部 HTML 页面引入 `theme.js`，静态资源参数升级到 `v=0.13.1`。
- 新增 `assets/youkong-gathering.png`，从现有材料中裁出不含旧标识信息的饭桌现场图。
- 新增 `assets/youkong-hero-illustration.png`，作为首页 Hero 专用背景图。
- 首页、关于页、社区共识页替换旧图片和相关文案。
- 首页 Hero 背景引用切换为用户提供的新图，右侧内容图继续使用饭桌现场图。
- 顶部导航从 `position: sticky` 调整为全站 `position: fixed`，并补充 `body` 顶部空间和移动端菜单展开位置，确保滚动到页面底部仍固定可见。
- 删除含旧标识信息的旧图片素材文件。
- `tests/smoke.test.js` 将封面上传测试图片改为新的饭桌图。
- `package.json` 和 `package-lock.json` 版本升级到 `0.13.1`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `theme.js`
- `script.js`
- `styles.css`
- `index.html`
- `about.html`
- `whitepaper.html`
- 全部 HTML 静态资源版本参数
- `assets/youkong-gathering.png`
- `assets/youkong-hero-illustration.png`
- `tests/smoke.test.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 主题预设放在独立 `theme.js` 并在 `<head>` 中优先加载，减少深浅色切换初始闪烁。
- 主题状态只存本地 `localStorage`，不写入后端，避免增加登录与权限复杂度。
- 公开页和后台页继续保留 `public-surface` / `product-surface` 分层：公开页白天与黑夜都强调品牌感，后台暗色模式保持产品工具可读性。
- 回首页按钮由 `script.js` 注入，避免逐页复制 HTML，同时保证所有页面一致。
- 顶部导航使用 fixed 层级覆盖替代 sticky，避免在复杂背景层、页脚和长页面滚动到底部时出现固定失效；通过 `--header-height` 统一桌面和移动端正文避让。
- 首页背景图只替换 Hero 背景，不替换白皮书、关于页和内容图，控制视觉变更范围。
- 对旧标识信息采取“移除引用 + 删除静态资源”的处理，避免即使页面不引用、旧图片仍被静态托管访问。

### 当前完成情况

- 已完成代码开发和文档更新。
- `node --check theme.js script.js` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run build:cloudbase` 已通过。
- `git diff --check` 已通过。
- 本地 Playwright 视觉检查通过：首页白天 / 黑夜 / 跟随系统切换正常，移动端导航主题按钮可用，后台暗色模式可读，浮动首页按钮可见，无横向溢出。
- 本地 Playwright 视觉检查通过：首页桌面和移动端滚动到底部后顶部导航仍固定可见，首页 Hero 背景已加载 `youkong-hero-illustration.png`。
- 构建产物检查通过：`dist/assets` 中不再包含旧图片素材，页面文本不含旧标识信息。

### 遗留问题

- 主题系统目前是本地偏好，不跟随账号同步；如果未来有多端登录需求，可考虑把主题偏好写入成员资料。
- 当前安全视觉素材只有一张饭桌裁剪图，公开页仍需要补充更多不含旧标识信息的真实活动、街区和空间照片。
- `styles.css` 覆盖层继续增加，后续建议拆分为基础 token、公开页主题、后台产品主题和组件样式。

### 下一步建议

1. 使用 Playwright 验证首页白天 / 黑夜 / 跟随系统切换、后台暗色模式和移动端导航。
2. 部署 0.13.1 到 CloudBase 并确认线上旧图片不再出现在构建产物中。
3. 补充新的真实照片素材库，逐步替换重复使用的饭桌裁剪图。

## 2026-07-13 - 0.13.3 三态主题、白天模式和日志保留优化

### 任务目标

根据最新反馈，继续修复白天模式下文字对比度不足的问题；把主题切换改为品牌右侧单图标三态循环，默认跟随系统；将成员工作台概览移动到所有入口模块底部；并让操作日志只保留最近 30 天。

### 具体修改内容

- `script.js` 将主题切换控件从 `.nav-links` 内部改为插入 `.brand` 后方，避免 `app.js` 重绘导航链接时移除控件。
- `script.js` 将主题交互改为单图标三态循环：跟随系统 -> 黑夜 -> 白天 -> 跟随系统，并同步 `aria-label`、状态类名和当前解析主题。
- `styles.css` 新增圆形主题切换按钮：月亮、太阳、小电脑三种 CSS 图标，含点击动效和减少动态效果降级。
- `styles.css` 修复旧二态开关样式残留对三态图标的影响，使用 `data-theme-mode` 作为最终视觉状态选择，避免太阳、月亮、小电脑图标偏位或残影。
- `styles.css` 补充公开页和产品页白天模式对比度覆盖，重点修复首页数字条、捐赠说明、二维码说明、联系信息、模块管理表单标签和主按钮文字可读性。
- `me.html` 将「工作台概览」区块移动到入口卡片模块之后，待办仍保留在最上方。
- `lib/app.js` 新增操作日志保留期常量、节流清理函数，写日志和查询 `/api/logs` 时会清理 30 天前日志。
- `lib/store.js` 新增 `removeWhere()` 和 `lt` 查询操作，本地 JSON 与 CloudBase 存储共用日志清理能力。
- `tests/smoke.test.js` 新增旧操作日志清理断言，确认超过 30 天的日志不会被返回且会从本地存储移除。
- 全部 HTML 静态资源参数升级到 `v=0.13.3`。
- `package.json` 和 `package-lock.json` 版本升级到 `0.13.3`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `script.js`
- `styles.css`
- `me.html`
- `lib/app.js`
- `lib/store.js`
- `tests/smoke.test.js`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 切换键脱离 `.nav-links`，因为登录状态初始化会调用 `renderMainNav()` 重写导航 HTML；放在 `.nav-wrap` 中品牌后方能保证控件不被业务导航刷新影响。
- 三态按钮使用当前主题模式而不是解析后的明暗状态决定下一步，避免「跟随系统」被误判成普通白天或黑夜。
- 三态图标显示以 `data-theme-mode` 为最高优先级状态源，并移除图标透明度过渡，只保留轻微 transform 反馈，避免点击后上一状态图标短暂残留。
- 主题按钮图形使用 CSS 形状，不引入图标库或外部资源，保持当前 Vanilla JS 和静态站点结构。
- 白天模式修复采用末尾覆盖层，集中补齐高风险文字和控件色值，降低对既有艺术化黑夜模式的回归风险。
- 日志保留在后端实现，前端不只做隐藏；`/api/logs` 查询同时添加保留期过滤，避免清理失败时旧日志仍被展示。
- CloudBase 和本地 JSON 通过统一 `removeWhere()` 接口清理，避免 API 层区分存储驱动。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过：`app.js`、`lib/app.js`、`lib/store.js`、`theme.js`、`script.js`、`server.js` 和构建脚本语法检查通过。
- `git diff --check` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过；新增断言覆盖 30 天前操作日志清理。
- `npm run build:cloudbase` 已通过：静态站点和云函数包均可构建。
- Playwright 视觉检查通过：主题默认跟随系统，单击后按黑夜、白天、跟随系统循环，且全站只有 1 个主题切换键。
- Playwright 图标检查通过：系统、黑夜、白天三种模式下仅当前图标 `opacity: 1`，其余图标 `opacity: 0`；0ms、100ms、250ms 状态均无残影，图标中心与按钮圆环中心对齐。
- Playwright 白天模式对比度抽检通过：首页数字条、Hero 正文、捐赠说明、二维码说明、关于页地址 / 微信、模块管理标签和「添加模块」按钮均达到可读对比度。
- Playwright 工作台检查通过：「工作台概览」位于入口卡片模块之后。
- Playwright 移动端检查通过：390px 下品牌右侧主题按钮可见且不随导航重绘消失。

### 遗留问题

- `styles.css` 仍以多轮版本覆盖层迭代，后续建议拆分成基础 token、公开页主题、后台产品页和组件文件。
- 主题偏好仍保存在浏览器本地，不随账号同步。
- 操作日志目前按自然日近似为 30 天保留；如需更严格的自然月口径，后续可改为按上海时区月历计算。

### 下一步建议

1. 如需上线，执行 `npm run deploy:cloudbase` 并做线上只读冒烟。
2. 后续建议整理 `styles.css` 覆盖层，拆成主题 token、公开页组件和产品页组件，降低后续视觉迭代成本。

## 2026-07-13 - 0.13.4 工作台性能优化与部署准备

### 任务目标

根据线上反馈，优化访问「我的」页面时入口模块卡片需要等待约 10 秒才加载的问题，并在完成后提交 GitHub、合并 main、部署到腾讯云 CloudBase。

### 具体修改内容

- `lib/store.js` 新增 `count()` 和 `findByFilters()`：本地 JSON 复用本地筛选语义，CloudBase 下推为 `where(...).count()` 和 `where(...).limit(1)`。
- `lib/app.js` 新增 `/api/dashboard/me`，返回成员工作台需要的活动状态计数、审核中 / 已发布汇总、待办总数和最多 3 条待办预览。
- `lib/app.js` 新增 `/api/dashboard/admin`，返回 YKadmin 工作台需要的活动、成员、模块、待办计数和最多 4 条管理员待办预览。
- `lib/app.js` 将登录态校验从读取 `yk_sessions` 集合后筛选，改为按 `tokenHash` / 旧 `token` 字段查询第一条；手机号登录改为按 `phone` 字段查询。
- `lib/app.js` 将活动列表 payload 的报名人数来源改为活动记录上的 `registrationCount`，避免列表接口每次读取全量报名集合。
- `app.js` 将 `me.html` 和 `admin.html` 工作台入口卡片接入 dashboard API，不再依赖完整活动 / 成员 / 模块列表。
- `tests/smoke.test.js` 增加 dashboard API 断言，覆盖成员工作台计数、管理员工作台计数和待办预览。
- `docs/cloudbase-indexes.md` 补充 `yk_sessions.tokenHash`、`yk_sessions.expiresAt`、`yk_users.phone` 等索引建议。
- 全部 HTML 静态资源参数升级到 `v=0.13.4`。
- `package.json` 和 `package-lock.json` 版本升级到 `0.13.4`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `app.js`
- `lib/app.js`
- `lib/store.js`
- `tests/smoke.test.js`
- `docs/cloudbase-indexes.md`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 不在工作台继续调用完整列表接口，因为入口卡片只需要计数和少量待办预览；独立列表页仍保留完整分页接口。
- dashboard 计数通过存储层 `count()` 下推到 CloudBase，减少云函数内存和网络响应体大小。
- 待办预览只取 3 到 4 条，保留用户进入工作台后立即判断是否有待处理事项的能力。
- 活动列表改用 `registrationCount` 字段，是因为报名新增、删除和取消已经统一同步该字段；完整报名表仍通过报名记录集合读取。
- 会话和手机号查询改为字段级查询，是为了降低每个登录页面的基础查询开销，并为后续补 CloudBase 索引留下明确路径。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过；新增断言覆盖成员 / 管理员 dashboard API。
- `npm run build:cloudbase` 已通过：静态站点和云函数包均可构建。
- Git 已提交 `dd911e1 feat(dashboard): optimize workspace loading`，并推送到 `dev` 与 `main`。
- CloudBase 静态托管已部署成功：上传 28 个文件，访问地址为 `https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com`。
- CloudBase 云函数 `youkongApi` 已部署成功，HTTP API 地址为 `https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api`。
- 线上冒烟通过：`index.html` 已引用 `v=0.13.4`，线上 `app.js` 已包含 `/api/dashboard/me` 调用。
- 线上 API 冒烟通过：管理员手机号 `已隐藏` 可登录，`/api/dashboard/admin` 返回活动、成员、模块和待办计数；本次实测 dashboard 响应约 662ms。
- GitHub Actions 初次触发后发现 `npm ci` 失败：`package-lock.json` 中的 `registry.npmmirror.com/retry-0.13.3.tgz` 在 GitHub runner 上返回 404。
- 已将 `package-lock.json` 的依赖 tarball 地址统一替换为官方 npm registry，并把错误锁定的 `retry@0.13.3` 修正为官方存在的 `retry@0.13.1`。
- `npm ci --registry=https://registry.npmjs.org` 已本地验证通过。
- lockfile 修复后，`npm test` 和 `npm run build:cloudbase` 已再次通过。

### 遗留问题

- CloudBase 控制台建议补充 `yk_sessions.tokenHash`、`yk_sessions.expiresAt`、`yk_users.phone` 索引；代码可运行，但索引能保证数据量增长后的稳定性。
- `toActivityListPayload()` 仍会读取模块和用户集合补充名称；如果成员继续增长，可进一步把模块名、发起人名和协作员名冗余到活动记录中。

### 下一步建议

1. 在 CloudBase 控制台补齐本次新增的登录态和手机号相关索引。
2. 后续为线上 API 增加耗时日志或简单性能监控，定位真实慢查询。

## 2026-07-13 - 0.13.5 运维增强：备份脚本和 API 慢请求日志

### 任务目标

根据项目下一步优化方向，优先补齐稳定运营底座：数据备份、API 慢请求观测和索引检查文档，让后续上线和排障更可控。

### 具体修改内容

- `lib/app.js` 新增 `apiTimingLogger()` 中间件，记录超过阈值的 API 请求和所有 5xx 响应。
- 新增环境变量 `API_TIMING_LOGS` 和 `API_SLOW_LOG_MS`，默认启用 API 耗时日志，慢请求阈值为 1200ms。
- 新增 `scripts/backup-data.js`，支持导出本地 JSON 或 CloudBase NoSQL 数据。
- 新增 `npm run backup:data`，并将 `scripts/backup-data.js` 加入 `npm run test:syntax`。
- 新增 `docs/operations.md`，记录备份命令、慢请求日志格式和 CloudBase 索引检查清单。
- `docs/cloudbase-indexes.md` 补充 `status + createdAt` 索引建议，对应管理员待办、状态计数和 dashboard 预览。
- `.env.example` 新增 API 耗时日志配置项。
- `package.json` 和 `package-lock.json` 版本升级到 `0.13.5`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `lib/app.js`
- `scripts/backup-data.js`
- `docs/operations.md`
- `docs/cloudbase-indexes.md`
- `.env.example`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 慢请求日志只写本地控制台 / CloudBase 云函数日志，不写入 `yk_logs` 操作日志集合，避免高频访问把业务审计日志刷爆。
- 慢请求日志只记录 `method`、`path`、状态码、耗时和存储驱动，不记录 query、body、手机号或昵称，降低日志隐私风险。
- 数据备份默认排除 `sessions`，避免把 session hash 写入备份文件；需要排查登录态时可显式追加 `--include-sessions`。
- 备份脚本复用现有存储层 `store.query()`，因此本地 JSON 和 CloudBase 使用同一条导出路径。
- 备份文件默认输出到 `output/backups/`，该目录已经被 `.gitignore` 忽略，避免误提交生产数据。

### 当前完成情况

- 已完成代码开发和文档更新。
- 本地备份脚本验证通过：`npm run backup:data -- --out tmp/backup-test.json --include-sessions` 可导出完整 JSON；默认模式可排除 `sessions`。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run build:cloudbase` 已通过：静态站点和云函数包均可构建。
- Git 已提交本次运维增强变更。
- CloudBase 静态托管已部署成功：上传 28 个文件。
- CloudBase 云函数 `youkongApi` 已部署成功，HTTP API 地址为 `https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api`。
- 线上冒烟通过：`/api/session` 返回 200，管理员手机号 `已隐藏` 可登录，`/api/dashboard/admin` 返回活动、成员、模块和待办计数；本次实测 dashboard 响应约 452ms。
- GitHub `dev` / `main` 已推送到 `403daaf feat(ops): add backup and api timing logs`；`dev` CI、`main` CI 和 GitHub Pages 部署任务均已通过。

### 遗留问题

- 当前只有导出备份，尚未实现一键恢复脚本；恢复仍需人工确认后导入，避免误覆盖线上数据。
- CloudBase 索引仍需要在控制台手动创建，代码和文档只提供检查清单。

### 下一步建议

1. 增加受控恢复脚本，要求显式确认目标环境和备份文件。
2. 在 CloudBase 控制台补齐 `docs/operations.md` 和 `docs/cloudbase-indexes.md` 中列出的索引。

## 2026-07-13 - 0.14.0 活动运营增强：富文本、分享、日志筛选和 CI dry-run

### 任务目标

根据新的运营优化需求，补齐三个直接影响日常使用的能力：关键操作审计可筛选、活动发起更像公众号编辑、活动详情更方便传播；同时启动前后端拆分和 CI 发版前检查。

### 具体修改内容

- 操作日志页新增操作类型、操作人、角色、开始日期和结束日期筛选。
- `/api/logs` 支持服务端字段筛选，并将日志路由拆到 `lib/routes/logs.js`。
- 删除报名记录日志补充被删除报名人的昵称和脱敏手机号；删除成员日志补充脱敏手机号；取消活动继续进入操作日志。
- 新增 `lib/rich-text.js`，服务端对白名单富文本标签、链接和图片做清洗。
- 新增 `assets/js/rich-editor.js`，活动发起页支持正文段落、二级/三级标题、加粗、引用、列表、分隔线和正文小图。
- 新增 `assets/js/activity-share.js`，活动详情页支持生成 PNG 分享海报、复制报名链接和下载 `.ics` 日历文件。
- 浮动「首页」按钮改为滚动后显示，避免移动端首屏遮挡表单。
- 新增 `scripts/verify-cloudbase-package.js` 和 `npm run deploy:dry-run`，检查 CloudBase 构建产物完整性和敏感文件误打包。
- 新增 `scripts/visual-snapshots.js` 和 `npm run test:visual`，生成关键页面桌面 / 移动端截图。
- GitHub Actions 改为 Node.js 24，并新增 CloudBase dry-run 与视觉截图 artifact 上传。
- `scripts/build-function.js` 中云函数包版本改为读取根 `package.json`，避免部署包版本号漂移。
- `package.json` / `package-lock.json` 版本升级到 `0.14.0`，全部 HTML 静态资源参数升级到 `v=0.14.0`。
- README、CHANGELOG、`docs/cloudbase-indexes.md`、`docs/operations.md` 同步更新。

### 涉及文件

- `app.js`
- `script.js`
- `styles.css`
- `activity.html`
- `activity-editor.html`
- `admin-logs.html`
- `assets/js/rich-editor.js`
- `assets/js/activity-share.js`
- `lib/app.js`
- `lib/rich-text.js`
- `lib/routes/logs.js`
- `scripts/verify-cloudbase-package.js`
- `scripts/visual-snapshots.js`
- `scripts/build-function.js`
- `.github/workflows/ci.yml`
- `tests/smoke.test.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/cloudbase-indexes.md`
- `docs/operations.md`
- `docs/dev-log.md`

### 技术方案选择

- 富文本不引入外部 CDN 或大型编辑器，避免 CSP、体积和移动端加载复杂度上升；先实现小而可控的白名单编辑能力。
- 富文本最终以 HTML 片段保存，但服务端只允许有限标签和安全图片地址；客户端渲染前也做一次白名单清理，降低篡改请求带来的风险。
- 正文图片限制为小图，适合插入活动说明中的小插图；大图仍建议走首页图上传，避免单条活动记录过大。
- 日志筛选走服务端分页查询，不在前端拉全量后筛选，符合此前“点击筛选才查询”的性能原则。
- 后端路由拆分先从日志路由开始，因为日志状态机少、依赖清晰；活动、用户和模块路由保留在 `lib/app.js`，后续单独拆分更稳。
- CI 的视觉回归先保存截图 artifact，不做像素差异硬拦截；当前项目视觉还在快速迭代，先沉淀可查看的发版证据更实用。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：静态站点和云函数包可构建，关键产物存在且未打包敏感文件。
- `npm run test:visual` 已通过：桌面 / 移动端首页、登录、后台和活动编辑页截图已生成到 `test-results/visual/`。
- 本地视觉抽查通过：移动端活动编辑页不再被浮动「首页」按钮遮挡，富文本工具栏和表单单列布局正常。
- Git 已提交 `3d6d53d feat(activity): add rich editor sharing and log filters`。
- CloudBase 静态托管已部署成功：上传 30 个文件。
- CloudBase 云函数 `youkongApi` 已部署成功，HTTP API 地址为 `https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api`。
- 线上冒烟通过：`activity-editor.html` 已引用 `rich-editor.js?v=0.14.0`，`activity.html` 已引用 `activity-share.js?v=0.14.0`，`/api/session` 返回 200，管理员手机号 `已隐藏` 可登录，`/api/dashboard/admin` 和 `/api/logs?action=login` 返回 200。
- GitHub `dev` / `main` 已推送到 `3d6d53d feat(activity): add rich editor sharing and log filters`；`dev` CI、`main` CI 和 GitHub Pages 部署任务均已通过。CI 已执行 `npm test`、CloudBase dry-run 和视觉截图 artifact 上传。

### 遗留问题

- 后端 route 拆分只完成日志路由；auth、activities、users、modules 仍在 `lib/app.js`。
- 当前富文本是轻量编辑器，不支持复杂图文模板、拖拽排序、图片压缩上传和草稿自动保存。
- CI 视觉截图暂不做像素基线比对，只提供 artifact 给人工检查。
- CloudBase 需要在控制台补充 `yk_logs.action + createdAt`、`yk_logs.actorId + createdAt`、`yk_logs.actorRole + createdAt` 等索引。

### 下一步建议

1. 继续拆分后端路由，优先迁移 auth 和 activities，同时为活动状态字段补 JSDoc / TypeScript 类型边界。
2. 为富文本正文图片增加压缩和上传到 CloudBase Storage 的能力，避免 data URL 进入数据库。
3. 为视觉截图建立人工审核基线，待视觉趋稳后再考虑像素 diff 阈值。

## 2026-07-13 - 0.15.0 活动描述模板与正文图片上传

### 任务目标

根据活动发起页的进一步优化需求，补齐更接近公众号写作的正文能力：正文图片不再以 base64 进入活动描述，支持 10MB 原图内浏览器压缩后上传；富文本新增一级标题；YKadmin 可以维护活动描述模板，成员发起活动时一键套用。

### 具体修改内容

- `lib/rich-text.js` 新增 H1 白名单，并新增 `richTextLengthExcludingImages()`，用于活动描述和模板内容的 50000 字校验。
- `assets/js/rich-editor.js` 新增 H1 工具、正文图片压缩上传链路和通用 textarea 挂载能力，可复用于活动描述和模板内容。
- `lib/store.js` 新增 `templates` 集合，并支持 CloudBase 上传时通过 `directory` 区分 `activity-covers` 和 `rich-images`。
- `lib/app.js` 新增 `/api/uploads/rich-image`、`/api/templates`、`POST /api/templates`、`PUT /api/templates/:id`、`DELETE /api/templates/:id`。
- `activity-editor.html` 新增「活动描述模板」下拉框；选择模板只影响活动描述，已有正文时弹窗确认是否覆盖。
- 新增 `admin-templates.html` 活动模板管理页，并在 YKadmin 工作台增加「活动模板」入口卡片。
- `app.js` 新增模板分页读取、模板表单增删改、模板下拉填充和套用确认逻辑。
- `styles.css` 增加富文本 H1 样式和模板管理页细节样式。
- `tests/smoke.test.js` 新增模板增删改、模板日志、正文图上传、图片不计入描述长度校验、模板页富文本挂载和 H1 工具断言。
- `scripts/build-static.js`、`scripts/verify-cloudbase-package.js`、`scripts/visual-snapshots.js` 同步纳入 `admin-templates.html`。
- `data/example-db.json` 补充 `templates` 和 `logs` 集合示例。
- `package.json` / `package-lock.json` 版本升级到 `0.15.0`，全部 HTML 静态资源参数升级到 `v=0.15.0`。
- README、CHANGELOG、`docs/cloudbase-indexes.md`、`docs/operations.md`、`docs/security.md` 同步更新。

### 涉及文件

- `admin-templates.html`
- `activity-editor.html`
- `admin.html`
- `admin-activities.html`
- `admin-members.html`
- `admin-modules.html`
- `admin-logs.html`
- 全部 HTML 静态资源版本参数
- `app.js`
- `assets/js/rich-editor.js`
- `styles.css`
- `lib/app.js`
- `lib/rich-text.js`
- `lib/store.js`
- `tests/smoke.test.js`
- `scripts/build-static.js`
- `scripts/verify-cloudbase-package.js`
- `scripts/visual-snapshots.js`
- `data/example-db.json`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/cloudbase-indexes.md`
- `docs/operations.md`
- `docs/security.md`
- `docs/dev-log.md`

### 技术方案选择

- 正文图片改为“浏览器压缩后上传”，避免 data URL 长期写入数据库，也避免图片内容挤占活动描述字数上限。
- 前端保留分级压缩处理，服务端再次限制压缩后需在 10MB 以内，防止绕过前端直接上传过大文件，同时避免 1MB 阈值过低导致正文图片不可用。
- 模板使用独立 `yk_templates` 集合，而不是写死在前端或模块配置里，便于运营人员后续持续维护。
- 模板只覆盖活动描述，不影响标题、时间、地点、模块和协作员，避免套用模板时误改结构化字段。
- 富文本仍维持轻量白名单编辑器，不引入大型富文本依赖，继续降低 CSP、包体和维护复杂度。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、隔离 JSON 数据库 API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：静态站点和云函数包可构建，关键产物存在且未打包敏感文件。
- `npm run test:visual` 已通过：新增桌面 / 移动端活动模板管理页截图，视觉抽查无明显错位或横向溢出。
- Git 已提交 `f78e299 feat(templates): add activity description templates`，并推送到 `dev` 与 `main`。
- CloudBase 静态托管已部署成功：上传 31 个文件，新增 `admin-templates.html` 已进入线上站点。
- CloudBase 云函数 `youkongApi` 已部署成功，HTTP API 地址为 `https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api`。
- 线上冒烟通过：`activity-editor.html` 已引用 `rich-editor.js?v=0.15.0` 并包含活动描述模板下拉；`admin-templates.html` 已引用 `v=0.15.0` 并包含模板管理表单；`/api/session` 返回 200，管理员手机号 `已隐藏` 可登录，`/api/dashboard/admin` 返回 `templates` 计数，`/api/templates?page=1&pageSize=1` 返回分页信息。

### 遗留问题

- 富文本图片压缩会统一输出 JPEG，GIF 动图会被压成静态图；当前按活动正文图片场景接受该取舍。
- 模板内容暂不支持版本历史或恢复；删除前只有确认弹窗和操作日志。
- CloudBase 线上仍建议为 `yk_templates.updatedAt + createdAt` 建立索引，保证模板管理页数据增长后仍稳定。

### 下一步建议

1. 上线后在 CloudBase 控制台确认 `yk_templates` 集合已创建，并补充 `updatedAt + createdAt` 索引。
2. 后续可继续拆分 `app.js` 中的模板、活动、工作台逻辑，降低主文件体积。
3. 若模板数量增多，可增加模板适用模块字段，让发起活动页根据所选模块筛选模板。

## 2026-07-13 - 0.15.1 活动模板详情页拆分与正文图片显示修复

### 任务目标

根据新的优化反馈，将活动模板管理从“列表页内嵌新增表单”调整为“列表页 + 新增 / 编辑详情页”的结构，同时修复活动描述和活动模板里上传的正文图片在审核待办和公开活动报名页不展示的问题。

### 具体修改内容

- 新增 `admin-template-editor.html`，作为活动模板新增 / 编辑详情页。
- `admin-templates.html` 移除内嵌新增表单，改为搜索列表页，并增加「新增活动模板」入口。
- `app.js` 新增 `initAdminTemplateEditorPage()`，支持通过 `?id=` 加载模板详情、编辑保存和保存后返回列表。
- `app.js` 中模板列表的编辑按钮改为跳转详情页，删除仍保留在列表页。
- `lib/app.js` 新增 `GET /api/templates/:id`，供模板详情页读取单个模板。
- `lib/app.js` 新增 `GET /api/files?fileId=...`，正文图片通过稳定代理链接访问 CloudBase 最新临时文件地址。
- `/api/uploads/rich-image` 在 CloudBase 模式下返回 `/api/files?fileId=...` 稳定链接，避免将一次性临时 URL 长期保存到富文本正文里。
- `script.js`、`scripts/build-static.js`、`scripts/verify-cloudbase-package.js`、`scripts/visual-snapshots.js` 同步纳入新页面。
- `tests/smoke.test.js` 新增模板列表 / 详情页结构断言，并增加审核待办和活动详情页正文图片渲染断言。
- `package.json` / `package-lock.json` 版本升级到 `0.15.1`，全部 HTML 静态资源参数升级到 `v=0.15.1`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `admin-templates.html`
- `admin-template-editor.html`
- 全部 HTML 静态资源版本参数
- `app.js`
- `script.js`
- `styles.css`
- `lib/app.js`
- `tests/smoke.test.js`
- `scripts/build-static.js`
- `scripts/verify-cloudbase-package.js`
- `scripts/visual-snapshots.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 模板列表页只做检索、入口和删除，详情页承担写作任务，降低后台列表页的信息密度，也符合产品界面“一个页面一个主要任务”的原则。
- 正文图片采用 API 代理链接，而不是继续保存 CloudBase 临时 URL；公开活动页和审核待办页无需登录即可通过稳定链接获取最新临时图片地址。
- 保留原有富文本白名单和图片大小限制，不增加新的外部编辑器依赖。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：静态站点和云函数包可构建，新增 `admin-template-editor.html` 已进入 CloudBase dry-run 检查。
- `npm run test:visual` 已通过：新增桌面 / 移动端活动模板详情页截图，移动端视觉抽查无明显错位或横向溢出。
- Git 已提交 `8140a6e fix(activity): keep rich text images visible`，并推送到 `dev` 与 `main`。
- CloudBase 静态托管已部署成功：上传 32 个文件，新增 `admin-template-editor.html` 已进入线上站点。
- CloudBase 云函数 `youkongApi` 已部署成功，HTTP API 地址为 `https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api`。
- 线上冒烟通过：`admin-templates.html` 已引用 `v=0.15.1` 并只保留列表和新增入口；`admin-template-editor.html` 已引用 `v=0.15.1` 并包含模板详情表单；管理员手机号 `已隐藏` 可登录；`/api/uploads/rich-image` 返回 `/api/files?fileId=...` 稳定代理链接，代理链接返回 302 到 CloudBase 临时图片地址；线上测试模板已创建后删除。

### 遗留问题

- 已经保存为旧 CloudBase 临时 URL 且不包含 `fileId` 的历史正文图片无法自动恢复；本次修复保证新上传图片使用稳定代理链接。
- `/api/files` 当前按 `fileId` 公开重定向，适合公开活动正文图片；如果后续出现私密文件，需要增加访问权限判断或分桶策略。

### 下一步建议

1. 上线后创建一条包含正文图片的测试活动，走审核到公开页，确认线上 CloudBase 图片代理链路可用。
2. 后续可继续把模板逻辑从主 `app.js` 拆到独立前端模块。

## 2026-07-14 - 0.15.2 主题切换按钮视觉精修

### 任务目标

根据反馈，重新设计顶部白天 / 黑夜 / 跟随系统主题切换按钮。功能逻辑保持不变，重点解决原图标粗糙、旧样式互相覆盖、视觉质感不足的问题。

### 具体修改内容

- `script.js` 将主题按钮内部图标从 CSS 伪元素改为三枚内联 SVG：小电脑、月亮、太阳。
- `styles.css` 在文件末尾增加最终覆盖样式，统一按钮尺寸、圆形表面、图标居中、hover / active / focus 状态和三态切换动效。
- `styles.css` 明确关闭旧 `.theme-switch-icon::before / ::after` 伪元素，避免历史样式继续影响新图标。
- `tests/smoke.test.js` 新增主题按钮浏览器断言：必须存在三枚 SVG，默认跟随系统，单击可切换到黑夜模式。
- 项目版本升级到 `0.15.2`，全部 HTML 静态资源参数升级为 `v=0.15.2`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `script.js`
- `styles.css`
- `tests/smoke.test.js`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 参考 Vercel / Geist、shadcn 和 GitHub Primer 的主题切换思路，采用单按钮当前状态图标，而不是三段式控件，继续满足“单击循环：跟随系统 / 黑夜 / 白天”的既定交互。
- 不引入新的图标依赖，避免仅为一个导航按钮增加包体和构建复杂度；图标使用极简线性 SVG，并由 CSS 统一 stroke、颜色和状态动效。
- 通过文件末尾最终样式覆盖历史主题按钮样式，降低大范围重构 `styles.css` 的风险，同时保证线上缓存更新后视觉稳定。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：新增主题按钮 SVG 结构和点击切换断言。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建。
- `npm run test:visual` 已通过：桌面 / 移动端关键页面截图已生成到 `test-results/visual/`。
- 已用 Playwright 截取主题按钮元素截图，系统态、黑夜态、白天态图标均居中可读，无旧图标残影。

### 遗留问题

- 当前仅做主题按钮视觉精修，未系统清理 `styles.css` 中早期主题按钮旧样式块；后续若继续拆分样式文件，可把历史块整理掉。

### 下一步建议

1. 后续可把导航、主题按钮、浮动首页按钮拆成独立前端模块，减少 `script.js` 顶层逻辑。
2. 若继续追求视觉统一，可建立小型 UI token 文档，统一按钮、图标按钮、表单控件和后台卡片的状态样式。

## 2026-07-14 - 0.16.0 工作台、近期活动与富文本体验优化

### 任务目标

根据最新反馈，继续优化成员工作台、首页近期活动、富文本编辑器、审核待办和页面背景图兼容性。目标是让数据入口更可持续，活动展示更贴近公告栏横向纸条，移动端不再出现字段或活动卡片撑出屏幕，富文本工具在手机端也能稳定工作。

### 具体修改内容

- `app.js` 将工作台概览四个统计卡片改为可点击链接，分别进入全部、草稿、审核中和已发布活动筛选页。
- `app.js` 为我的活动筛选表单增加 URL 查询参数预填，支持从 `me.html` 直接跳转到目标状态筛选。
- `lib/app.js` 为活动列表状态筛选增加 `reviewing` 和 `published_group` 两个组合状态，便于前端用一个入口查询多个真实状态。
- `index.html` 调整首页近期活动结构：说明文案后直接展示最多三张活动纸条，再展示近期 / 历史活动入口按钮。
- `styles.css` 增加最终覆盖层，修复移动端首页活动横向滚动撑宽页面的问题，并统一公开页、工作台和中间页 `page-hero` 背景图遮罩。
- `styles.css` 优化审核待办操作区、富文本工具栏、亮色模式表单说明文字和关于页联系区间距。
- `assets/js/rich-editor.js` 增强富文本编辑器：保存 / 恢复选区、工具按钮触屏 `pointerup` 执行、H1 / H2 / H3 / 引用重复点击恢复正文、粘贴文本清洗为干净段落、工具栏 active 状态更新。
- `scripts/visual-snapshots.js` 新增桌面 / 移动端 `me.html` 截图，确保成员入口背景图和工作台概览纳入视觉回归。
- `tests/smoke.test.js` 新增工作台概览链接断言、工作台和我的活动筛选页移动端无横向溢出断言、富文本 H1 开关和粘贴清洗断言。
- README 和 CHANGELOG 同步更新到 `0.16.0`。

### 涉及文件

- `index.html`
- 全部 HTML 静态资源版本参数
- `app.js`
- `assets/js/rich-editor.js`
- `styles.css`
- `lib/app.js`
- `tests/smoke.test.js`
- `scripts/visual-snapshots.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 首页近期活动桌面端保留三列横排，移动端改成容器内部横向 flex 滚动，而不是 grid auto-flow，避免子元素把整页 `scrollWidth` 撑宽。
- 富文本编辑器参考 Vercel Geist / GitHub Primer 的轻量工具栏思路，但继续使用原生 contenteditable，不引入大型编辑器依赖，降低包体、CSP 和 CloudBase 部署复杂度。
- 富文本标题工具采用“同一按钮再次点击恢复正文”的交互，减少用户在手机上反复选择正文按钮的成本。
- 页面背景图通过统一 `page-hero::before` 遮罩层处理，保证公开页、工作台和中间页都能复用同一图片，同时在白天 / 黑夜模式下保持文字可读。
- 审核操作区放在详情之后，桌面三列排列，移动端单列，避免活动详情和审核意见被割裂成两个不相关区域。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- `npm run test:visual` 已通过：桌面 / 移动端首页、社区共识、关于与联系、登录、工作台、后台、审核待办、活动编辑页和活动模板页面截图已生成。
- 人工抽查截图：`mobile-home.png`、`desktop-home.png`、`desktop-me.png`、`mobile-me.png`、`desktop-about.png`、`mobile-activity-editor.png`，未发现横向溢出、明显文字不可读或排版错乱。

### 遗留问题

- 富文本编辑器仍是轻量 contenteditable 方案，不支持拖拽图片排序、图片标题、撤销栈增强和复杂公众号组件。
- 视觉截图仍是 artifact / 本地人工抽查，没有建立像素基线自动 diff。
- `styles.css` 历史覆盖层较多，本次通过末尾覆盖降低风险，后续仍建议逐步拆分样式文件。
- 后端组合状态筛选已支持本轮入口，但活动、用户、模块等 route 仍主要集中在 `lib/app.js`。

### 下一步建议

1. 将 `styles.css` 按公开页、产品页、组件、主题覆盖逐步拆分，减少后续样式覆盖成本。
2. 富文本可以继续补撤销 / 重做、图片块删除和移动端工具栏吸顶时的阴影状态。
3. 给视觉截图增加基线比对或至少保存关键截图 artifact，发版前更容易发现背景图、白天模式文字和移动端溢出回归。
4. 继续拆分 `lib/app.js` 中 auth、activities、users、modules 路由，并逐步给活动状态和富文本字段补类型约束。

## 2026-07-14 - 0.16.1 发起人联系方式与分享海报二维码

### 任务目标

根据新的活动发布和分享需求，发起活动时允许发起人决定是否公开联系方式；公开活动详情页只在允许时展示联系方式；分享海报要包含完整封面、发起人、诚邀昵称、报名手机号、地址、日期和活动二维码，并避免文字与二维码重叠。

### 具体修改内容

- `activity-editor.html` 新增「是否展示活动发起人联系方式」下拉框和「活动发起人联系方式」输入框。
- `app.js` 新增联系方式字段显隐逻辑：选择「是」时展示输入框，默认填入当前登录手机号；编辑活动时回填已有设置。
- `lib/app.js` 新增 `showInitiatorContact` 和 `initiatorContact` 解析、校验、落库与公开 payload 控制；关闭展示时不向公开端返回联系方式。
- `lib/app.js` 的 `/api/session` 和 `/api/login` 对当前登录用户返回本人手机号，用于发起活动页默认联系方式。
- `lib/app.js` 新增 `/api/qr`，使用 `qrcode` 生成 SVG 二维码。
- `assets/js/activity-share.js` 重做分享海报：封面按原比例完整展示，Canvas 高度随封面动态增高；活动二维码绘制到右下角独立区域；地址和日期分行展示。
- `assets/js/activity-share.js` 将海报默认地址规范为「有空客厅|江北劳动一村」：当活动地点为空或仅填写「有空客厅」时自动补全，其他自定义地点保持原样。
- `success.html` 引入活动分享脚本，报名成功页增加「下载分享海报」按钮，海报可带入报名昵称和手机号。
- `styles.css` 新增活动详情发起人联系方式信息条样式。
- `tests/smoke.test.js` 新增二维码接口、联系方式字段、活动详情联系方式展示、报名成功页分享海报入口等断言。
- `scripts/build-function.js` 云函数依赖新增 `qrcode`。
- `package.json` / `package-lock.json` 版本升级到 `0.16.1`，全部 HTML 静态资源参数升级到 `v=0.16.1`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `activity-editor.html`
- `success.html`
- 全部 HTML 静态资源版本参数
- `app.js`
- `assets/js/activity-share.js`
- `styles.css`
- `lib/app.js`
- `scripts/build-function.js`
- `tests/smoke.test.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 联系方式使用显式开关，不默认公开，避免把成员手机号不经确认展示到公开活动详情页。
- 关闭展示时后端 payload 强制返回空联系方式，即使历史数据里存在联系方式，也不向公开端泄露。
- 二维码由后端 `/api/qr` 生成 SVG，前端 fetch 后转 Blob 再绘制到 Canvas，避免外部二维码服务跨域污染 Canvas，保证海报可下载。
- 海报封面不再使用 cover 裁切，而是按封面原始宽高比完整绘制，Canvas 根据封面高度动态增高。
- 报名成功页也提供下载海报入口，因为此时能准确拿到报名昵称和手机号；活动详情页生成海报时会优先读取报名表中已输入的昵称和手机号。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过，并覆盖真实分享海报 PNG 下载。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- `npm run test:visual` 已通过：桌面 / 移动端关键页面截图已生成。
- 人工抽查 `mobile-activity-editor.png`：新增联系方式开关在 390px 移动端无超边界和明显错位。

### 遗留问题

- 第 1 条反馈“审核意见、备注这里，”未写完整，本轮暂未对审核意见和备注继续改动。
- 海报二维码当前指向活动详情页，不是报名成功页专属链接；如果未来需要个人专属海报，可继续在成功页生成带报名参数的二维码。

### 下一步建议

1. 如需更精美海报，可增加海报主题模板，例如放映、食堂、夜校分别有不同版式。
2. 可继续补充活动详情页海报预览弹窗，让用户下载前先查看二维码和文字是否符合预期。

## 2026-07-14 - 0.16.2 审核待办 PC 审批区对齐

### 任务目标

根据反馈修复审核待办页 PC 端「审核意见」和「备注」没有对齐、视觉比较散的问题；移动端体验已确认没问题，本轮不改移动端单列布局。

### 具体修改内容

- `styles.css` 新增桌面端专用规则：审核操作区改为三列审批面板，审核意见选择框、备注文本框和提交按钮统一 46px 高度并底部对齐。
- `styles.css` 为审批面板补充浅色 / 深色主题背景和边框，保持和当前产品后台风格一致。
- `scripts/visual-snapshots.js` 增加一条临时审核待办数据，确保视觉截图能覆盖真实审批操作区，而不是只截空状态。
- `package.json` / `package-lock.json` 版本升级到 `0.16.2`，全部 HTML 静态资源参数升级到 `v=0.16.2`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `styles.css`
- `scripts/visual-snapshots.js`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 只使用 `@media (min-width: 981px)` 作用于桌面端，避免影响用户已认可的 app / 移动端体验。
- 不改审核表单语义和提交流程，仅调整布局和控件高度，降低回归风险。
- 视觉快照补种临时待办数据，方便后续发版前直接检查审核操作区的真实 UI。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- `npm run test:visual` 已通过：桌面 / 移动端关键页面截图已生成。
- 人工抽查 `desktop-review-tasks.png`：审核意见、备注和提交按钮已在 PC 端统一对齐。
- 人工抽查 `mobile-review-tasks.png`：移动端仍保持原有单列布局。

### 遗留问题

- 视觉截图仍未做像素基线自动 diff，目前仍需要人工抽查关键截图。

### 下一步建议

1. 可以给审核待办页增加状态密度更高的列表工具栏，例如按模块 / 发起人快速筛选。
2. 后续继续拆分 `styles.css`，把审核待办这类后台页面样式迁移到独立产品页样式文件。

## 2026-07-14 - 0.16.3 分享海报文案格式修正

### 任务目标

根据反馈调整分享海报最终展示文案：去掉需求解释用的 `【】` 符号；二维码说明放在二维码上方；删除明文活动网址；地址和日期不换行，日期精确到年月日时分。

### 具体修改内容

- `assets/js/activity-share.js` 修改海报标题生成：默认显示为 `模块丨标题`，不再包裹 `【】`。
- `assets/js/activity-share.js` 修改字段绘制：发起人、诚邀、报名手机号、地址、日期的值不再包裹 `【】`。
- `assets/js/activity-share.js` 将地址和日期改为单行绘制；地址严格使用活动填写地点；日期格式改为 `2026年7月12日20:00-2026年7月12日23:00`。
- `assets/js/activity-share.js` 将「活动二维码」移动到二维码上方，并删除底部明文 URL。
- `assets/js/activity-share.js` 暴露 `posterTextPreview` 测试辅助，用于 Playwright 冒烟断言海报文案格式。
- `tests/smoke.test.js` 新增固定日期样例断言，覆盖无括号、完整日期、二维码标题和不展示 URL。
- `package.json` / `package-lock.json` 版本升级到 `0.16.3`，全部 HTML 静态资源参数升级到 `v=0.16.3`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `assets/js/activity-share.js`
- `tests/smoke.test.js`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 日期格式在海报脚本内单独处理，不复用页面列表的短日期格式，确保海报信息完整。
- 地址和日期使用单行绘制，并在文本过长时小幅缩小字号，避免换行或与二维码区域冲突。
- 保留二维码内实际活动 URL，但删除画布上的明文 URL，减少视觉噪音。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过，并覆盖海报文字格式预览断言和真实海报 PNG 下载。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- 人工抽查 `test-results/poster-format-check.png`：海报无 `【】`，二维码说明位于二维码上方，无明文活动网址，地址和日期均为单行完整格式。

### 遗留问题

- 当前自动化能断言海报文案格式，但还没有对生成 PNG 做 OCR 或像素级文字位置识别，最终版式仍需要人工抽查下载海报。

### 下一步建议

1. 可增加海报预览弹窗，让用户下载前直接查看最终 PNG。
2. 后续可为不同活动模块配置不同海报主题模板。

## 2026-07-14 - 0.16.4 首页近期活动与移动端操作按钮优化

### 任务目标

根据反馈优化两个排版问题：PC 端首页「近期活动」不应呈现为过窄竖条，应更接近近期活动详情页的横向活动展示；移动端全部活动管理和我的活动页面在 3 个以上操作按钮时按钮尺寸要统一，避免文字被挤成细长条。

### 具体修改内容

- `styles.css` 新增 PC 端首页近期活动覆盖规则：桌面端最多展示两条横向活动行，每条保留左侧封面 / 模块占位和右侧活动信息；移动端保持原有横向滑动卡片。
- `styles.css` 新增移动端产品页活动操作按钮规则：`.event-row .row-actions` 在手机端使用两列等宽 grid，按钮统一高度、居中对齐、允许正常换行。
- `scripts/visual-snapshots.js` 为视觉截图补充 3 条已发布活动测试数据，使 `desktop-home.png` 能覆盖真实首页近期活动布局。
- `tests/smoke.test.js` 增加移动端操作按钮布局断言，覆盖管理员全部活动管理和成员我的活动页面。
- `package.json` / `package-lock.json` 版本升级到 `0.16.4`，全部 HTML 静态资源参数升级到 `v=0.16.4`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `styles.css`
- `scripts/visual-snapshots.js`
- `tests/smoke.test.js`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 首页近期活动只在 `min-width: 981px` 桌面断点改为横向活动行，明确满足“app 端不需要改”的要求。
- 手机端按钮使用两列 grid，而不是继续 flex 自动分配，保证 2、3、4 个操作按钮都有稳定宽度和可点击高度。
- 视觉截图补充测试活动数据，避免首页空状态截图无法发现近期活动布局问题。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过，并覆盖移动端活动操作按钮两列等宽布局。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- `npm run test:visual` 已通过：桌面 / 移动端关键页面截图已生成。
- 人工抽查 `desktop-home.png`：PC 首页近期活动已变成两条横向活动行。
- 人工抽查 `mobile-admin-activities.png`：4 个操作按钮为两列等宽网格，2 个操作按钮同样保持统一尺寸。

### 遗留问题

- 首页 PC 端目前只展示前两条活动，第三条仍由移动端横向滑动展示；如需 PC 端展示三条，可后续改成两行布局或“2+1”宽卡布局。

### 下一步建议

1. 可继续把首页近期活动改成更明确的“公告栏列表”组件，和活动详情页共用同一套卡片变量。
2. 可以给移动端操作按钮补图标，进一步提高多个按钮并列时的可扫读性。

## 2026-07-14 - 0.16.5 首页活动长条与移动端竖排按钮修正

### 任务目标

修正上一版对需求的误解：移动端活动操作按钮不应两列并排，而应在活动行右侧竖向排列，每个按钮外轮廓同宽同高；PC 首页近期活动不应只占页面一半，而应像近期活动详情页一样展示完整宽度横向长条。

### 具体修改内容

- `styles.css` 移除 PC 首页近期活动半宽限制，改为完整宽度单列横向活动长条，最多读取的 3 条活动均可展示。
- `styles.css` 将移动端全部活动管理 / 我的活动页的活动行改为左侧内容 + 右侧 96px 操作列。
- `styles.css` 将移动端活动操作按钮改为竖向 flex 栈，按钮统一宽度、高度、字号和横向文字显示。
- `tests/smoke.test.js` 将移动端按钮断言从两列 grid 改为竖排 stack：检查活动行为两列布局、按钮列为 flex column、按钮等宽且纵向排列。
- `package.json` / `package-lock.json` 版本升级到 `0.16.5`，全部 HTML 静态资源参数升级到 `v=0.16.5`。
- README 和 CHANGELOG 同步更新。

### 涉及文件

- `styles.css`
- `tests/smoke.test.js`
- 全部 HTML 静态资源版本参数
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 参考 Vercel Geist 的实体列表思路：主要内容保持在左侧，行级操作集中在右侧 controls 区，减少列表扫描时的视觉跳动。
- 手机端按钮使用固定宽度右侧操作列，比 flex-wrap 或两列 grid 更符合用户给出的示例，也能保证 2、3、4 个按钮时外轮廓一致。
- PC 首页近期活动直接回到活动详情页同款 `event-card` 横向尺度，不再做额外半宽容器。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm run test:syntax` 已通过。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过，并覆盖移动端活动操作按钮竖排同宽布局。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- `npm run test:visual` 已通过：桌面 / 移动端关键页面截图已生成。
- 人工抽查 `desktop-home.png`：PC 首页近期活动已铺满内容区，呈现为完整宽度横向活动长条。
- 人工抽查 `mobile-admin-activities.png`：活动操作按钮位于右侧竖排，同宽同高，文字保持横向可读。

### 遗留问题

- 手机端右侧操作列当前宽度固定为 96px；如果未来出现更长按钮文案，需要改为短标签或引入图标 + tooltip。

### 下一步建议

1. 可把活动操作按钮文案进一步标准化为两个到三个汉字，如「报名」「撤回」「结束」，提升移动端密度。
2. 后续可抽出活动列表组件，避免首页、公开活动页、我的活动页和后台活动页样式重复覆盖。

## 2026-07-15 - 0.17.0 安全与一致性加固

### 任务目标

根据端到端 bug 复盘结果修复高风险问题；登录方案暂不重做，仅先从公开页面和当前文档中隐藏真实管理员手机号。其余按复盘建议推进：报名确认访问保护、上传图片内容校验、CSV 导出保护、CloudBase 查询和构建可靠性、文档版本更新。

### 具体修改内容

- `lib/app.js` 新增报名确认 token：报名 / 重复报名返回 `accessToken`，公开查看报名确认页和公开取消报名都必须携带 token；服务端仅保存 token 哈希，不在公开响应中返回 `phoneHash` 或 token 哈希。
- `lib/app.js` 新增上传图片魔数校验，封面和正文图片都会校验实际内容是否为 JPG、PNG、WebP 或 GIF；`/api/files` 只代理 `activity-covers` 和 `rich-images` 路径下的文件标识。
- `lib/app.js` 将活动详情 / 列表模块和成员读取改为按当前活动需要的 ID 查询，减少 CloudBase 全量读取超过 1000 条后的截断风险。
- `lib/app.js` 将审核、撤回、取消、结束和报名相关路径放到活动 / 报名维度锁内重新读取当前状态，降低并发旧状态覆盖风险。
- `app.js` 报名成功跳转带上 token，成功页读取和取消报名均携带 token；CSV 导出对 `= + - @` 开头单元格加前缀；动态模块读取失败时展示刷新重试提示。
- `assets/js/activity-share.js` 为二维码图片加载增加 `image.decode()` 兼容兜底，改善 Safari / 微信内置浏览器表现。
- `scripts/build-static.js` 自动发现根目录全部 HTML；`scripts/verify-cloudbase-package.js` 校验所有 HTML 都进入 `dist/`。
- `login.html`、`.env.example`、`cloudbaserc.json`、`README.md` 移除公开真实管理员手机号；测试和视觉脚本改用本地假号码。
- `tests/smoke.test.js` 增加伪图片拒绝、报名 token、无 token 访问 / 取消拦截、重复报名刷新 token、CSV 防公式注入和成功页 token 访问覆盖。
- `package.json` / `package-lock.json` 版本升级到 `0.17.0`，全部 HTML 静态资源参数升级到 `v=0.17.0`。
- README、CHANGELOG、docs/security.md 同步更新。

### 涉及文件

- `.env.example`
- `*.html`
- `app.js`
- `assets/js/activity-share.js`
- `cloudbaserc.json`
- `lib/app.js`
- `lib/store.js`
- `scripts/build-function.js`
- `scripts/build-static.js`
- `scripts/verify-cloudbase-package.js`
- `scripts/visual-snapshots.js`
- `tests/smoke.test.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/dev-log.md`

### 技术方案选择

- 报名确认采用随机 token + 服务端哈希保存，而不是继续只依赖可预测的报名 ID；重复报名刷新 token，使旧确认链接失效。
- 伪图片防护放在 Multer 文件接收后、保存前做内容魔数校验；保留前端压缩体验，但不信任前端 MIME 和文件名。
- CloudBase 静态构建改为自动发现 HTML，避免新增页面时忘记更新构建清单。
- 没有强制 override CloudBase SDK 的 axios / lodash 传递依赖，因为当前 latest / release / next 版本仍带同类依赖，贸然 override 可能破坏云函数 SDK。

### 当前完成情况

- 已完成代码开发和文档更新。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包均可构建，自动 HTML 校验通过。
- 已执行 `npm audit --omit=dev`：仍有 5 个生产依赖风险，均来自 `@cloudbase/node-sdk` 传递依赖，已记录到 `docs/security.md`。

### 遗留问题

- 登录仍是手机号白名单免密登录，后续需要单独设计短信验证码、微信登录或密码 + 二次验证方案。
- 活动报名锁仍是进程内锁，CloudBase 多实例下不是全局事务；报名规模增长后应引入数据库唯一约束、事务、队列或网关级限流。
- CloudBase SDK 传递依赖审计风险仍需等待官方修复或在独立分支验证替代方案。

### 下一步建议

1. 先做登录专项设计：验证码 / 微信登录 / 管理员二次验证三选一或组合，并补权限矩阵。
2. 给 CloudBase 数据库补充报名唯一索引或事务型写入策略，彻底解决多实例并发报名。
3. 将 `lib/app.js` 继续拆分为 auth、activities、registrations、uploads、users、modules 路由文件，降低后续改动风险。

## 2026-07-15 - 0.17.1 首页近期活动间距修复

### 任务目标

修复 PC 端首页「近期活动」横向活动长条中，左侧海报与右侧活动标题、时间、状态、发起人等文字信息贴得太近的问题；保持移动端现有横向滑动卡片体验不变，并完成上线所需版本与静态资源参数更新。

### 具体修改内容

- `styles.css`：将 PC 首页 `#events .home-event-strip .event-card` 的海报 / 文字间距从 `gap: 0` 调整为 `column-gap: clamp(24px, 2.6vw, 36px)`。
- `*.html`：全站静态资源参数从 `v=0.17.0` 升级到 `v=0.17.1`，避免线上浏览器或 CDN 继续使用旧 CSS。
- `package.json` / `package-lock.json`：项目版本升级到 `0.17.1`。
- `README.md` / `CHANGELOG.md`：同步记录版本状态、变更内容和验证情况。

### 涉及文件

- `styles.css`
- `*.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

本次只在 PC 首页最终覆盖规则里增加 `column-gap`，不改 `app.js` 渲染结构，也不改移动端媒体查询。原因是问题根源来自 `0.16.5` 为了把首页近期活动改成横向长条时，将 `.event-card` 的 `gap` 覆盖为 `0`，而右侧 `.event-body` 左 padding 也为 `0`，导致海报与文字视觉粘连。

### 设计决策原因

- PC 端横向活动长条需要像活动列表一样有明确的「海报区 / 信息区」分隔，列间距应大于活动内部标签、标题、元信息之间的紧凑间距。
- 使用 `clamp(24px, 2.6vw, 36px)` 能在常规桌面和大屏上自然放松，不会破坏 176px 海报列和右侧信息密度。
- 移动端此前已验证为横向滑动卡片，用户反馈 app 端很好，因此本次不触碰 `max-width: 980px` 和 `max-width: 640px` 下的布局。

### 当前完成情况

- 代码修改、版本更新和文档更新已完成。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，关键产物检查通过。
- Playwright 计算样式抽检通过：1440px 首页近期活动海报与文字实际间距为 `36px`；390px 移动端仍保持上下堆叠。

### 遗留问题

- 本次是窄范围视觉修复，未重构 `.home-event-strip` 在不同版本中累积的多处覆盖规则；后续如继续调整首页活动模块，可顺手整理为一段更清晰的桌面 / 移动端样式源。

### 下一步建议

1. 后续可把首页近期活动与 `activities.html` 的活动行样式抽成共享组件级样式，减少重复覆盖。
2. 对 CSS 文件继续做模块拆分，把公开页、后台页、活动组件、富文本编辑器和主题样式分区维护。

## 2026-07-15 - 0.17.2 活动详情联系方式间距与长链接修复

### 任务目标

修复活动详情页两个移动端和阅读体验问题：其一，「活动发布 / 发起人 / 限额 / 已报名」与「发起人联系方式」两块信息之间挨得太近；其二，活动正文中类似腾讯会议的超长链接在手机端可能直接撑出页面。

### 具体修改内容

- `styles.css`：新增 `.activity-hero .event-meta + .initiator-contact` 间距规则，将活动 Hero 内联系方式与上方元信息之间的距离提升到 `clamp(24px, 3vw, 34px)`。
- `styles.css`：为 `.article-content` 容器、段落、列表项、标题、强调文本和链接增加 `overflow-wrap: anywhere` / `word-break` 兜底，避免超长 URL 撑破移动端布局。
- `tests/smoke.test.js`：在活动描述中加入超长腾讯会议链接，并在 390px 移动端断言活动详情页无横向溢出。
- `tests/smoke.test.js`：增加活动详情页发起人联系方式 `margin-top >= 24px` 的回归断言。
- `package.json` / `package-lock.json`：项目版本升级到 `0.17.2`。
- `*.html`：静态资源参数升级到 `v=0.17.2`。
- `README.md` / `CHANGELOG.md`：同步更新当前状态、功能说明、版本记录和验证结果。

### 涉及文件

- `styles.css`
- `tests/smoke.test.js`
- `*.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 间距问题只在活动详情页 Hero 内部处理，使用相邻选择器 `.event-meta + .initiator-contact`，避免影响首页活动卡片和列表页元信息。
- 长链接问题从 `.article-content` 统一处理，而不是只针对腾讯会议域名。这样微信群链接、网盘链接、文档链接等无空格长字符串也会自动折行。
- 回归测试复用已有活动描述，把长链接并入原活动，避免额外创建活动时增加管理员登录次数并触发登录限流。

### 设计决策原因

- 「发起人联系方式」是一个独立信息块，和活动状态 / 报名信息属于不同语义组，应有比标签之间更大的垂直间距。
- 活动正文由用户维护，无法假设 URL 长度或是否包含自然断点，因此应在展示容器层提供强制换行能力。
- 移动端横向溢出属于高感知问题，必须纳入浏览器冒烟测试，而不是只靠人工肉眼检查。

### 当前完成情况

- 代码修改、版本更新和文档更新已完成。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。

### 遗留问题

- 本次只修复展示层换行；富文本编辑器内编辑态如果未来出现更复杂的表格或代码块需求，需要单独设计移动端滚动策略。

### 下一步建议

1. 补一次 `npm run deploy:dry-run` 后再提交部署，确保 CloudBase 静态与函数产物完整。
2. 后续可以把活动详情页 Hero 信息区抽为组件级样式，统一管理状态、报名数、联系方式和分享按钮的垂直节奏。

## 2026-07-15 - 0.17.3 活动详情白天模式地点时间可读性修复

### 任务目标

修复白天模式下活动详情页 Hero 中「有空客厅｜两江新区劳动一村4号楼一楼左边阳台 · 07/18 19:30 - 07/18 21:30」这类地点与时间信息在浅色照片背景上对比度不足、发灰看不清的问题。

### 具体修改内容

- `styles.css`：新增白天模式专用规则 `html[data-theme="light"] body.public-surface .activity-hero > div:first-child > p`，将地点 / 时间行改为 `#2b302b`、字重 `650`，并加轻微浅色 `text-shadow`。
- `tests/smoke.test.js`：活动详情页浏览器冒烟中强制切换白天模式，断言地点 / 时间行颜色为 `rgb(43, 48, 43)` 且字重不低于 `650`。
- `package.json` / `package-lock.json`：项目版本升级到 `0.17.3`。
- `*.html`：静态资源参数升级到 `v=0.17.3`。
- `README.md` / `CHANGELOG.md`：同步更新版本状态、功能说明和变更记录。

### 涉及文件

- `styles.css`
- `tests/smoke.test.js`
- `*.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

只针对活动详情页 Hero 的地点 / 时间段落加更具体的白天主题覆盖，不改全局 `--muted`。原因是 `--muted` 在普通白底卡片上仍可读，真正的问题发生在浅色照片背景和活动详情 Hero 的叠加场景里。

### 设计决策原因

- 地点与时间是活动详情页的关键信息，不应使用过浅的说明文字层级。
- 使用深墨色而不是纯黑，可以提升对比度，同时保持当前苹果风格的柔和质感。
- 轻微浅色文字阴影能在背景图细节较复杂时增加边缘清晰度，但不会形成厚重描边。

### 当前完成情况

- 代码修改、版本更新和文档更新已完成。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。

### 遗留问题

- 本次只覆盖活动详情页地点 / 时间行；后续如发现白天模式下其他 Hero 文案在具体背景图上对比度不足，需要继续做逐页视觉抽检。

### 下一步建议

1. 后续可以在视觉截图脚本里增加白天 / 黑夜模式活动详情页截图，减少主题切换后的人工抽检成本。
2. 建议继续沉淀主题颜色 token，例如 `--hero-text`、`--hero-muted`，让带图 Hero 的文字层级和普通卡片文字层级分开维护。

## 2026-07-15 - 0.17.4 白天模式白底文字对比度修复

### 任务目标

修复白天模式下报名成功页「你的报名已经记录下来，可以把这个页面留作确认信息。」这一段文字在白色卡片上过浅、看不清的问题，并检查公开白底 / 近白底页面是否还有同类浅色文字。

### 具体修改内容

- `styles.css`：新增白天模式规则 `html[data-theme="light"] body.public-surface .success-card > p`，将报名成功页主说明改为 `#2b302b`，字重提升到 `620`。
- `styles.css`：新增白天模式规则 `html[data-theme="light"] body.public-surface .success-grid span`，将成功页信息标签改为 `#3f493f`。
- `tests/smoke.test.js`：报名成功页浏览器冒烟中强制切换白天模式，断言主说明颜色、字重和信息标签颜色。
- `package.json` / `package-lock.json`：项目版本升级到 `0.17.4`。
- `*.html`：静态资源参数升级到 `v=0.17.4`。
- `README.md` / `CHANGELOG.md`：同步更新版本状态、功能说明和变更记录。

### 涉及文件

- `styles.css`
- `tests/smoke.test.js`
- `*.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`

### 技术方案选择

- 没有全局加深所有 `--muted`，而是针对白天模式下成功页白底卡片中实际低对比的选择器做覆盖。这样可以保留其他页面柔和但仍可读的辅助层级。
- 使用白底扫描脚本检查 `index.html`、`whitepaper.html`、`participate.html`、`donate.html`、`about.html`、`activities.html`、`activity.html` 和注入成功卡片样本的 `success.html`，按可见文字和近白背景计算对比度。

### 设计决策原因

- 报名成功页主说明是用户完成报名后的确认信息，不应像装饰性说明一样被弱化。
- 成功页小标签虽然是辅助信息，但字号较小，白底上也需要达到更稳定的深色层级。
- 保持 `#2b302b` / `#3f493f` 这组已在系统中使用的墨绿灰色，和当前苹果风格 + 社区温暖感保持一致。

### 当前完成情况

- 代码修改、版本更新和文档更新已完成。
- 白天模式公开页白底 / 近白底文字对比度扫描结果为 0 个低对比项。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。

### 遗留问题

- 本次扫描覆盖公开页和成功页样本；后台 / 工作台白底区域后续如果继续出现浅字，可以把同一套扫描扩展到登录态页面。

### 下一步建议

1. 将白天 / 黑夜主题对比度扫描沉淀为可复用测试脚本，纳入 `npm test` 或独立 `npm run test:contrast`。
2. 后续抽象主题文字 token，例如 `--text-primary`、`--text-secondary`、`--text-tertiary`，减少深色主题层和白天主题层互相覆盖造成的回归。

## 2026-07-21 - 0.18.0 Community OS 活动发布安全架构重构

### 任务目标

按用户新的产品理念重构活动发布系统：取消“成员登录后才能发起活动”的中心化门槛，改为开放优先、自治优先、信任优先、最少中心化干预。真实用户尽量无感发起，机器人、广告和诈骗内容通过 Turnstile、综合身份、限流、规则引擎、社区信用度、社区举报和 AI 分析逐步提高成本。管理员和协作员保留为兜底复核，不作为日常发布前置审核。

### 具体修改内容

- `lib/community-safety/`：新增 Community OS 安全基础模块，包含默认配置、匿名身份、持久化限流、规则引擎、Community Trust、Turnstile、策略引擎和安全服务。
- `lib/ai-analysis/`：新增可插拔 AI Analysis Engine，包含 Provider Registry、OpenAI Compatible Adapter、Prompt Service、统一 Schema、JSON Parser、缓存、用量日志、重试和 API Key 加密工具。
- `lib/store.js`：新增 `safetyRules`、`systemConfigs`、`anonymousIdentities`、`trustProfiles`、`trustEvents`、`rateEvents`、`analysisReports`、`communityReports`、`aiPrompts`、`aiCache`、`aiUsageLogs` 集合；初始化默认规则、AI 设置和 Prompt；旧 `member` 角色迁移为 `collaborator`。
- `lib/app.js`：活动创建 / 编辑取消强制登录，接入匿名身份、管理 token、综合限流、规则引擎、AI 分析、策略分流、风险提示和分析报告；报名表查看 / 删除支持管理 token；新增社区反馈、活动置信度、重新分析、规则配置、AI 设置、Prompt、社区信用度 API；保留管理员 / 协作员复核作为兜底。
- `app.js`：前端自动生成浏览器本地 UUID 和简易 fingerprint，并随 API 请求发送；保存活动管理 token；开放 `me.html`、`activity-editor.html`、`my-activities.html` 和 `registrations.html` 的未登录访问；活动详情展示风险提示和社区反馈入口；后台新增规则引擎、AI 分析、活动置信度和社区信用度页面逻辑。
- 新增页面：`admin-safety.html`、`admin-ai.html`、`admin-activity-confidence.html`、`admin-trust.html`、`admin-trust-detail.html`。
- `script.js`：后台页面分类加入新 Community OS 页面，并统一给 footer 增加“管理员登录”入口。
- `styles.css`：补充风险提示、反馈表单、规则行、配置编辑器、置信度面板、AI 报告和信用度详情样式。
- `tests/smoke.test.js`：冒烟改为覆盖低风险活动直接发布、高风险活动进入兜底双岗复核、规则引擎、AI 设置脱敏、活动置信度、社区反馈、Community Trust、匿名管理 token 和新后台页面移动端无横向溢出。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`.env.example`：同步开放发布、Community OS、Turnstile、AI 加密配置、新页面说明和 CloudBase 索引建议。

### 涉及文件

- `.env.example`
- `*.html`
- `app.js`
- `script.js`
- `styles.css`
- `lib/app.js`
- `lib/store.js`
- `lib/community-safety/*`
- `lib/ai-analysis/*`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`
- `docs/security.md`

### 技术方案选择

- 匿名身份不只使用 IP，而是由本地 UUID、浏览器 fingerprint、User-Agent 和 IP 摘要组合。对外只展示脱敏 IP / UA 样本，避免把真实网络信息暴露到后台以外。
- 活动管理使用每个活动独立的管理 token。匿名身份用于“我的活动”归属和限流，管理 token 用于编辑、撤回、报名表等敏感操作，避免只靠可伪造的 client id 管理活动。
- Rule Engine 不做一票否决，只输出风险分、置信分和可解释的 findings；策略引擎再决定直接发布、带提示发布、进入复核或按配置拒绝。
- AI Analysis Engine 独立于活动业务。业务层只调用 `analyzeActivity()`，Provider、Prompt、Schema、缓存、重试、日志都在 AI 模块内封装，未来扩展评论 / 帖子 / 举报分析不需要改活动业务层。
- AI 默认关闭、失败跳过、只输出 Analysis Report，不直接删除内容、不直接处罚、不直接修改 Community Trust。
- 保留现有管理员 / 协作员双岗审核功能，但只作为高风险或策略配置触发的兜底复核路径。

### 设计决策原因

- 这个社区的目标不是“平台审核”，而是让真实社区活动更容易发生，因此默认路径必须是低摩擦发布。
- 社区信用度不是黑名单或信誉分，而是一套可演进的自治基础能力。它需要独立集合、事件历史和 API，以后才能自然扩展到徽章、DAO 治理、志愿者体系和推荐权重。
- 风险提示应保持中立。低风险活动不显示“AI 判断可信”，避免把 AI 变成权威背书；中高风险才展示提示，帮助参与者自行判断。
- 配置先用 JSON 编辑区承载复杂策略，是为了快速保留完整可调能力；后续可以逐步把常用字段拆成更友好的表单。

### 当前完成情况

- 开放发起、匿名管理 token、规则引擎、Community Trust、社区反馈、Risk Notice、AI Analysis Engine 和新后台页面均已实现。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟主流程通过。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，新增页面和新增后端模块进入部署产物。

### 遗留问题

- Turnstile 默认关闭，生产启用前需要在 Cloudflare 获取 Site Key / Secret Key，并写入 CloudBase 环境变量。
- AI 默认关闭；启用前需要配置 Provider、Base URL、Model、API Key 和 Prompt，并通过后台“测试连接”确认模型可用。
- 当前限流和管理 token 校验已持久化到数据层，但报名锁仍是进程内锁；CloudBase 多实例高并发报名仍建议继续升级为数据库事务、唯一索引或队列。
- 规则和策略配置目前以 JSON 编辑为主，后续可为高频字段做更友好的表单控件和输入校验。

### 下一步建议

1. 在 CloudBase 控制台按 `docs/cloudbase-indexes.md` 补充 Community OS 新集合索引，尤其是 `anonymousIdentityId + createdAt`、`identityId + createdAt`、`activityId + createdAt`、`resetAt`。
2. 生产启用 Turnstile，并确认 CloudBase Hosting / API 的 CSP、CORS 和自定义请求头都已生效。
3. 在独立任务里继续拆分 `lib/app.js` 和 `app.js`，把 auth、activities、safety、ai、trust、reports 路由和前端页面控制器逐步拆开。

## 2026-07-22 - 0.18.1 AI 介入策略与活动重新分析修复

### 任务目标

按最新优化要求明确活动发布工作流：先走规则引擎，再按配置决定是否调用 AI，最后再进入策略分流或兜底审核。同时让 AI 后台可以配置“规则置信度达到什么阈值触发 AI”和“匿名身份前几场活动必须调用 AI”，并修复活动置信度页重新分析后分数异常飙升的问题。

### 具体修改内容

- `lib/community-safety/defaults.js`：AI 默认调用策略改为规则置信度 `<= 70` 触发、匿名身份前 `3` 场活动必调 AI；新增 AI 风险合并影响参数。
- `lib/ai-analysis/service.js`：AI 设置读取改为深合并，旧配置会自动补齐新 `callStrategy` 字段；`shouldCallAi()` 增加草稿跳过、低规则置信度触发和新匿名身份前 N 场触发。
- `lib/community-safety/service.js`：活动发布前统计匿名身份既有活动数量，并把活动序号、AI 触发原因写入分析报告元信息。
- `lib/community-safety/policy-engine.js`：风险合并改为以规则引擎风险分为基准，默认 AI 不降低规则风险，只能按配置有限增加风险；低信任惩罚后同步重算 `confidenceScore`。
- `lib/app.js`：活动置信度重新分析接口补齐匿名身份活动计数上下文，确保手动重分析和正常发布使用同一套策略输入。
- `admin-ai.html` / `app.js`：AI 设置页新增“规则置信度 ≤”和“匿名前 N 场必调 AI”两个表单项，保存时写回调用策略 JSON；活动置信度页补充规则基准分、AI 调整和 AI 触发原因展示。
- `tests/smoke.test.js`：新增 AI 触发策略断言、AI 设置深合并断言，以及修改敏感词规则权重后重新分析活动分数不会归零的回归断言。
- `README.md`、`CHANGELOG.md`、`docs/security.md`：同步更新当前状态、功能说明、安全设计和版本记录。

### 涉及文件

- `admin-ai.html`
- `app.js`
- `lib/ai-analysis/service.js`
- `lib/community-safety/defaults.js`
- `lib/community-safety/policy-engine.js`
- `lib/community-safety/service.js`
- `lib/app.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`
- `docs/security.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- AI 调用策略放在 AI Analysis Engine 的 `callStrategy` 中，而不是写入活动业务代码，保证后续可以继续扩展全部分析、低信用度分析、随机抽检、举报后分析和手动分析。
- 匿名身份前 N 场使用活动集合中的 `anonymousIdentityId` 计数，而不是只使用 Trust Profile 的 `activityCount`，避免重复提交或信用事件导致计数偏移。
- 风险合并从“规则分和 AI 分加权平均”改为“规则分为基准，AI 有界调整”。这样 AI 仍能作为社区观察员补充语义风险，但不能把规则引擎已经明确命中的活动直接变成低风险满分。
- 低规则置信度触发使用 `confidenceScore <= ruleConfidenceMax` 表达，比旧的 `riskScore 30-70` 更贴近后台活动置信度页面的语言。

### 设计决策原因

- 用户需要的是“开放优先，但机器人和广告成本更高”，所以 AI 应是后置观察员，不应覆盖规则引擎和社区配置。
- 新发起者前几场调用 AI 可以在不要求注册的情况下增加早期风险识别，而老用户、高信用度用户可以逐步减少限制。
- 重新分析应该可解释、可复现。管理员调整规则权重后，活动置信度应跟随规则明细稳定变化，而不是因为 AI 跳过或返回低风险就异常归零。

### 当前完成情况

- 代码修改、版本更新和文档更新已完成。
- `npm test` 已通过：语法检查、API 冒烟和 Playwright 浏览器冒烟全部通过。
- `npm run deploy:dry-run` 已通过：CloudBase 静态站点和云函数包可构建，必需文件完整。

### 遗留问题

- AI 设置页仍保留 JSON 编辑区，适合高级配置但不够产品化；后续可以把随机抽检、低信用度触发、手动重分析、举报后重分析等策略拆成开关和数字输入。
- AI Provider 默认仍关闭；生产启用前仍需配置真实模型和 API Key，并观察 AI 用量日志。

### 下一步建议

1. 给活动置信度详情页继续增加分数变化趋势图和规则项瀑布图，让管理员更容易比较多次重新分析之间的差异。
2. 将规则引擎管理页也从 JSON 参数编辑逐步改成结构化表单，降低误改 params 的概率。

## 2026-07-22 - 0.19.0 Community Governance 核心模块

### 任务目标

按用户确认的方向，先实现 Community Governance 基础能力，不做积分商城、排行榜、治理委员会。目标是把 Community Trust 从简单分数升级为事件驱动的社区治理底座，并补齐 Trust Policy、Community Badge 和 Badge Policy，保证活动置信度与人的社区信用度解耦、可追溯、可配置。

### 具体修改内容

- 新增 `lib/community-governance/`：包含默认 Trust Policy / Badge / Badge Policy、通用 Rule Builder、Community Event 记录、Trust 投影、Badge 授予和身份详情服务。
- `lib/store.js`：新增 `communityEvents`、`trustPolicies`、`communityBadges`、`identityBadges`、`badgePolicies` 集合，并在 JSON / CloudBase `ensureSeed()` 中补默认策略和徽章。
- `lib/community-safety/service.js`：活动提交不再硬编码按风险等级加减分，改为写入 `activity.submitted` 和 `activity.confidence.evaluated` 事件，由 Trust Policy 计算 Trust 变化；社区举报提交也改为统一事件。
- `lib/app.js`：新增 Governance API，覆盖概览、社区身份列表 / 详情、Trust Policy 增删改查、Community Badge 增删改查、Badge Policy 保存；活动直接发布、复核发布、举报成立、报名回应和报名里程碑写入统一事件流。
- 新增页面：`admin-governance.html`、`admin-trust-policy.html`、`admin-badges.html`、`admin-badge-policy.html`。
- `app.js`：新增治理后台渲染逻辑；社区信用度列表 / 详情展示 Community ID、社区等级、状态、徽章、Community Timeline、策略命中和徽章授予记录。
- `script.js` / `styles.css`：新治理页面加入 product surface；补齐后台 JSON textarea 在白天 / 黑夜模式下的统一样式。
- `tests/smoke.test.js`：新增 Governance API、策略增删改、徽章增删、展示策略保存和新后台页面移动端无横向溢出覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`：同步 0.19.0 功能、集合、索引、安全说明和验证结果。

### 涉及文件

- `admin-governance.html`
- `admin-trust-policy.html`
- `admin-badges.html`
- `admin-badge-policy.html`
- `app.js`
- `script.js`
- `styles.css`
- `lib/app.js`
- `lib/store.js`
- `lib/community-governance/*`
- `lib/community-safety/service.js`
- `lib/community-safety/trust-engine.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/dev-log.md`
- `docs/security.md`
- `docs/cloudbase-indexes.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 采用 Event Sourcing 方向，但保留 `trustProfiles` 当前分数作为查询投影缓存，避免后台列表每次都扫描历史事件。
- 新 `communityEvents` 是治理来源事件；旧 `trustEvents` 继续同步写入，保证旧接口、旧页面和已有测试兼容。
- Trust Policy 使用 `{ eventType, conditions, conditionMode, effect.trustDelta }` 配置模型；Badge Rule 复用同一套条件判断器，避免两套规则语法。
- Badge 和 Badge Policy 拆开：徽章定义“是什么、怎么获得”，展示策略定义“是否公开、在哪里展示、怎么展示”，便于把观察期 / 限制发布这类内部状态保持后台可见。
- 直接发布和复核发布都写 `activity.published`，避免低风险开放发布活动在 Trust 上吃亏。

### 设计决策原因

- Activity Confidence 与 Community Trust 必须独立。前者是单次活动判断，后者是长期社区关系记录，不能互相覆盖。
- 社区治理不应走“管理员审核 - 删除 - 封禁”的传统平台逻辑，因此事件时间线和策略解释比单个最终分数更重要。
- 默认策略和默认徽章以 seed 数据存在，不是业务代码常量。管理员后续可以停用、编辑或新增规则。
- 第一版后台仍使用 JSON 条件编辑，是为了先保留完整可配置能力；可视化 Rule Builder 可以在后续独立优化。

### 当前完成情况

- Community Governance 核心模块、API、后台页面和文档更新已完成。
- `npm run test:syntax` 已通过。
- `npm run test:smoke` 已通过，包含 API 和 Playwright 浏览器冒烟。

### 遗留问题

- Trust Policy 调整后尚未提供“一键按历史事件重算所有 Trust”的后台按钮，目前新策略只影响后续事件。
- Rule Builder 仍是 JSON 编辑，缺少可视化条件编辑器、策略 dry-run、策略变更历史和批量回滚。
- Badge 已能授予和展示后台摘要，但公开活动卡 / 活动详情还没有正式渲染公开徽章。
- 报名里程碑目前按每 10 人触发默认策略，未来可继续通过 Trust Policy 做更细粒度的活动质量事件。

### 下一步建议

1. 增加 Trust Policy dry-run 和历史重算能力：管理员调整策略前可以预览哪些身份会改变多少分。
2. 把 Trust Policy / Badge Rule JSON 编辑升级为可视化 Rule Builder，降低配置错误风险。
3. 在活动详情和活动列表中按 Badge Policy 渲染公开正向徽章，后台内部状态继续保持不公开。

## 2026-07-22 - 0.19.1 AI 调用与高风险兜底复核修复

### 任务目标

修复线上匿名发起活动时 AI 未真正介入的问题：管理员已在后台配置 AI Key 且测试连接成功，并把规则置信度阈值设为 100，但活动置信度详情仍显示“AI 未调用或当前已关闭”。同时修复“澳门赌场、发票、投资、成人”等明显高风险测试内容只降低活动分数、没有流转到 AI 或管理员审核的问题。目标是保证发布工作流稳定为：规则引擎先给基准风险分，再按 AI 调用策略决定是否分析，最后由策略引擎决定直接发布、带提示发布或进入管理员兜底复核。

### 具体修改内容

- `lib/community-safety/defaults.js`：新增 `regulated_sensitive_terms` 默认规则，覆盖赌场、发票、投资、成人、贷款、套现、返现等重点风险词；新增 AI 不可用兜底策略 `aiUnavailableAction`、`aiUnavailableReviewMinRisk`、`aiUnavailableReviewWhenAiExpected`。
- `lib/community-safety/rule-engine.js`：敏感词规则支持 `perHitWeight` 和 `maxExtraWeight`，多词命中会逐步提高风险分，避免高风险词堆叠仍只算一次。
- `lib/ai-analysis/service.js`：AI 已启用但缺少可解密 API Key 时返回明确的 `missing-api-key` 元信息并记录用量日志，不再静默表现为普通策略跳过。
- `lib/community-safety/service.js`：把 AI 是否本应调用、是否不可用、不可用原因传入策略引擎，并把 `safetyFallbackReason` 写入活动风险快照。
- `lib/community-safety/policy-engine.js`：当 AI 关闭、缺 Key 或 Provider 调用失败，且本次按策略本应调用 AI、规则风险达到阈值时，活动进入 `admin_review`，并标记 `safetyFallbackReason: ai-unavailable`。
- `lib/app.js`：AI 设置保存支持后端直接接收 `ruleConfidenceMax` 和 `firstActivityCount` 字段，减少前端 JSON 合并异常导致配置不生效的风险。
- `app.js`：活动置信度详情页区分 AI 关闭、缺少 API Key、Provider 不可用、草稿跳过和策略跳过，避免统一显示“AI 未调用或当前已关闭”造成误判。
- `tests/smoke.test.js`：新增本地 OpenAI Compatible stub，覆盖规则置信度阈值设为 100 时真实请求 Provider；新增“API Key 已保存后输入框留空再保存，发布链路仍使用已保存 Key”的回归；新增 AI 关闭时高风险内容进入管理员审核的兜底覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、功能说明、安全说明和静态资源版本号。

### 涉及文件

- `app.js`
- `lib/app.js`
- `lib/ai-analysis/service.js`
- `lib/community-safety/defaults.js`
- `lib/community-safety/policy-engine.js`
- `lib/community-safety/rule-engine.js`
- `lib/community-safety/service.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/dev-log.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 保持 AI 的定位为 Analysis Engine，而不是审核员。AI 仍不直接决定删除、封禁或扣 Community Trust；当 AI 不可用时，是策略引擎根据规则风险和兜底配置决定进入管理员审核。
- “规则置信度阈值 100”明确解释为 `confidenceScore <= 100`，即覆盖所有非草稿活动；该语义已写入 smoke 回归。
- 高风险词命中采用“基础权重 + 多词递增”的方式，而不是把某个词硬编码为一票拒绝，保留开放发布体系的可解释风险评分。
- AI Key 继续加密存储且不回显；测试新增了“留空不覆盖”的回归，贴近后台真实配置操作。

### 设计决策原因

- 线上问题最容易发生在配置链路：测试连接使用表单临时值，发布使用已保存配置。因此必须验证保存后的加密 Key、调用策略和发布链路是同一套配置。
- 如果 AI 不可用仍直接按中风险发布，用户会以为系统已经做了 AI 分析，实际上没有；改为中高风险兜底审核更符合“开放优先但风险逐步收束”的社区治理逻辑。
- 活动置信度详情页必须展示具体 AI 状态，否则管理员无法区分“策略没要求调用”“AI 关闭”“缺 Key”“模型报错”。

### 当前完成情况

- AI 真实调用、配置保存、兜底审核、重点风险词和置信度详情展示均已完成。
- `npm test` 已通过，包含语法检查、API 冒烟和 Playwright 浏览器冒烟。

### 遗留问题

- 当前 AI 不可用兜底阈值仍在规则引擎配置 JSON 中维护，后台可以配置但不够产品化；后续可在 AI 设置页增加独立表单项。
- Provider Adapter 仍以 OpenAI Compatible 为主；Claude / Gemini 当前保留插件入口但需要专用 Adapter 后才能生产启用。
- 线上若更换 `AI_CONFIG_ENCRYPTION_KEY`、`IDENTITY_HASH_SALT` 或 `SESSION_SECRET`，旧 API Key 可能无法解密，需要运维层保持环境变量稳定。

### 下一步建议

1. 在 AI 设置页增加“AI 不可用时兜底审核阈值”和“是否仅本应调用 AI 时兜底”的可视化配置，减少管理员编辑 JSON 的成本。
2. 在活动置信度详情页补一条“本次最终工作流：规则引擎 -> AI 状态 -> 策略结果”的时间线，进一步提升可解释性。
3. 给 `aiUsageLogs` 增加后台列表筛选，方便观察线上 Provider 成功率、耗时和失败原因。

## 2026-07-23 - 0.20.0 异步安全分析与社区举报治理

### 任务目标

按新的开放治理思路优化活动发布系统：匿名发起人提交活动后不应被 AI 响应时间卡在表单页，而应立即提交成功并返回列表；发布与否由后台规则引擎、AI Analysis Engine 和策略引擎继续流转。社区举报需要从活动页拆出独立后台模块，并形成“举报记录 -> 活动重分析 -> 必要时下架进管理员审核 -> 管理员通过后重新上架”的可追溯流程。同时强化 AI 与策略引擎之间的强信号衔接：疑似营销公开但进入管理员关注，明确营销 / 垃圾 / 诈骗 / 违法 / 成人 / 政治敏感内容隐藏并进入管理员兜底审核。

### 具体修改内容

- `lib/app.js`：新增 `analysis_pending` 活动状态、`activityAnalysisJobs` 异步任务执行器、任务 sweep 接口、管理员关注待办合并、举报分析流程和 `/api/reports` 管理接口。
- `lib/community-safety/service.js`：拆分 `prepareActivitySubmissionGate()`，提交前只做身份、Turnstile 和限流；新增活动分析上下文构建和分析事件记录函数。
- `lib/community-safety/policy-engine.js`：新增 AI 强信号策略，支持风险下限、隐藏管理员审核和公开管理员关注。
- `lib/community-safety/defaults.js`：新增 AI 强信号阈值、风险下限配置和举报复核默认策略。
- `lib/ai-analysis/schema/analysis-report.js`、`lib/ai-analysis/service.js`：扩展 AI 统一输出 Schema，新增 `advertisementLevel`、`spamLevel`、`politicalSensitivity`。
- `lib/store.js`：新增 `activityAnalysisJobs` 集合，JSON / CloudBase 双驱动都会自动初始化。
- `app.js`：新增 `analysis_pending` 状态展示、后台社区举报页面逻辑、活动置信度页举报历史、多人举报风险提示，以及活动详情页举报表单独立绑定。
- `admin-reports.html`：新增社区举报后台子页面，支持搜索、状态、原因和日期筛选。
- `script.js`：把社区举报页纳入后台产品界面识别。
- `tests/smoke.test.js`：更新活动创建 helper 等待异步分析完成，新增 AI 明确营销强信号、举报后台列表、置信度页举报历史和新页面移动端覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`package.json`、`package-lock.json`、`*.html`：同步 0.20.0 版本、功能说明、安全说明和静态资源版本号。

### 涉及文件

- `app.js`
- `script.js`
- `admin-reports.html`
- `admin.html`
- `admin-activities.html`
- `admin-ai.html`
- `admin-safety.html`
- `admin-logs.html`
- `admin-activity-confidence.html`
- `lib/app.js`
- `lib/store.js`
- `lib/ai-analysis/schema/analysis-report.js`
- `lib/ai-analysis/service.js`
- `lib/community-safety/defaults.js`
- `lib/community-safety/policy-engine.js`
- `lib/community-safety/service.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/dev-log.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 采用持久化任务表 `activityAnalysisJobs`，而不是只用内存 `setTimeout`。活动提交返回快，同时后台任务可被列表接口或管理员 sweep 唤醒，降低云函数重启导致活动长期卡住的风险。
- 使用 `analysisVersion` 做并发保护。用户撤回或重新编辑会递增版本，旧任务即使跑完也只会标记跳过，不会把旧分析结果重新写回活动。
- AI 仍不是裁判。AI 只输出结构化报告；策略引擎根据 AI 强信号、规则分、配置阈值和举报结果决定公开、提示、隐藏或进入管理员审核。
- 举报不做“一次举报直接删除”。举报理由与分析结果不匹配时只记录；多人举报只增加提示；举报成立或重分析发现强风险时才隐藏并进入管理员兜底审核。

### 设计决策原因

- 用户体验上，AI Provider 响应时间不可控，提交按钮长时间停留“正在提交活动”会让真实发起人以为失败；异步分析能把等待从表单交互中移走。
- 中国大陆线上环境对政治敏感、违法、诈骗和成人内容风险容忍度低，因此这些 AI 强信号被设计为隐藏进管理员兜底，而不是公开带提示。
- 疑似营销仍保留公开，是为了符合“开放优先、自治优先”；但进入管理员关注待办，让社区可以补充判断并清掉或处理关注标记。
- 独立举报页面和置信度页举报历史让社区治理可追溯，避免管理员只看到最终状态却不知道为什么下架。

### 当前完成情况

- 异步提交、后台分析流转、AI 强信号路由、社区举报后台、置信度页举报历史、多人举报提示和相关文档已完成。
- `npm test` 已通过，包含语法检查、API 冒烟和 Playwright 浏览器冒烟。

### 遗留问题

- 当前异步任务由应用进程和列表接口唤醒，生产上更稳的方式是 CloudBase 定时触发器或独立任务队列定期扫 `activityAnalysisJobs`。
- 社区举报目前复用活动 AI 分析结果判断“理由是否相符”，还没有独立的举报分析 Prompt；后续可增加 `analyzeReport()` 专用能力。
- 管理员关注待办目前以 `reviewFlag=admin_attention` 表达，未来可以独立成 `governanceTasks` 集合，支持任务 SLA、领取、备注和关闭原因。

### 下一步建议

1. 给 CloudBase 增加 `yk_activityAnalysisJobs.status + createdAt`、`yk_communityReports.status + createdAt`、`yk_communityReports.activityId + createdAt` 索引，并在 `docs/cloudbase-indexes.md` 记录。
2. 增加独立 Report Analysis Prompt，让 AI 同时分析举报文本与活动内容的匹配度，而不是只通过活动分析结果做启发式判断。
3. 在管理员仪表盘增加举报趋势、分析队列积压数、AI 失败率和管理员关注任务数量。

## 2026-07-27 - 0.20.1 强制重新分析与安全分析队列恢复

### 任务目标

修复两个线上问题：管理员在活动置信度详情页点击「重新分析」时，需要对活动重新执行完整规则引擎、AI Analysis Engine 和策略流转，并且强制调用 AI、跳过缓存、使用当前启用 / 配置的 Prompt；同时排查线上「年度粉丝交流见面会暨会员成长分享活动」长期停留在「安全分析中」的问题，避免 CloudBase 云函数结束后后台分析任务没有继续执行导致活动卡住。

### 具体修改内容

- `lib/ai-analysis/service.js`：新增 `forceAi` 调用路径，管理员手动重新分析会绕过调用策略与 AI 缓存，直接请求当前 Provider；AI 使用的 Prompt 版本写入使用日志和返回结果。
- `lib/community-safety/service.js`：分析报告 `aiMeta` 新增 `forced`、`promptVersion`、`promptName`，方便置信度页和历史报告追溯。
- `lib/app.js`：抽出统一的活动分析结果应用逻辑，后台队列和手动重新分析共用同一套状态流转；手动重新分析会重新套用最新策略，必要时从安全分析中流转到发布或管理员审核。
- `lib/app.js`：分析队列 sweep 新增恢复能力，支持恢复超时 `running` 任务，并为没有任务记录的 `analysis_pending` 活动补建任务。
- `lib/app.js`：我的活动、管理员活动、待办等管理视图会同步处理少量待分析任务，减少 CloudBase serverless 后台 `setTimeout` 不继续运行带来的滞留。
- `app.js`：置信度页重新分析提示改为「已重新分析」，并展示 AI 触发原因、强制调用标记和 Prompt 版本。
- `tests/smoke.test.js`：新增强制重新分析绕过缓存并记录 Prompt 版本的回归测试；新增缺失分析任务时 sweep 可恢复 `analysis_pending` 活动的回归测试。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步 `0.20.1` 版本、说明和静态资源版本号。

### 涉及文件

- `app.js`
- `lib/app.js`
- `lib/ai-analysis/service.js`
- `lib/community-safety/service.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/cloudbase-indexes.md`
- `docs/dev-log.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 手动重新分析采用 `forceAi + bypassCache`，而不是只把调用策略改成 manual。这样管理员改 Prompt 文本或切换 Prompt 后，即使活动内容完全相同，也会得到一次新的 AI 分析结果。
- 重新分析结果复用队列分析的状态流转函数，避免出现“风险分更新了，但活动仍卡在原状态”的割裂。
- 队列恢复采用两层兜底：先恢复超时 `running` 任务，再扫描 `analysis_pending` 活动并补建缺失任务。这样可以覆盖 CloudBase 云函数生命周期中断和历史任务记录缺失两类情况。

### 设计决策原因

- CloudBase 云函数不适合依赖请求返回后的 `setTimeout` 保证后台任务完成；线上活动卡住时，手动 sweep 返回 `processed: 0`，但活动仍是 `analysis_pending`，说明只扫 `pending` 任务不够。
- 强制重新分析是管理员治理动作，目标是得到新的可解释判断，因此应该跳过缓存；缓存仍保留给普通自动分析，以降低 Token 消耗。
- 管理视图同步扫少量任务比首页同步扫更合适：不会拖慢公开首页，同时用户发起活动后通常会进入「我的活动」查看状态，可以自然唤醒队列。

### 当前完成情况

- 代码修复、文档更新和版本升级已完成。
- `npm test` 已通过，包含语法检查、API 冒烟和 Playwright 浏览器冒烟。

### 遗留问题

- 生产上仍建议接入 CloudBase 定时触发器或独立任务队列，定期调用分析队列 sweep，这比依赖用户访问管理页更稳定。
- CloudBase 控制台需新增 `yk_activityAnalysisJobs.status + startedAt` 索引，避免恢复超时 running 任务时随着数据增长变慢。

### 下一步建议

1. 部署后用管理员身份打开线上这条卡住的活动置信度页，或调用分析队列 sweep，确认它从「安全分析中」流转到发布或管理员审核。
2. 在后台增加“分析队列积压数 / running 超时数 / 最近失败原因”卡片，管理员不需要看数据库也能发现队列异常。
3. 接入 CloudBase 定时触发器，每 1-5 分钟自动调用一次队列 sweep。

## 2026-07-27 - 0.20.2 工作台性能与 CloudBase 索引补齐

### 任务目标

优化线上「我的」页面入口卡片加载慢的问题，并在 CloudBase 中尽可能补齐当前查询路径会使用到的索引，降低活动、日志、Community Governance 和 AI 分析数据增长后的列表查询风险。

### 具体修改内容

- `lib/app.js`：`/api/dashboard/me` 不再通过 `ownedActivitiesForRequest()` 拉取最多 1000 条活动后在内存统计，改为按活动状态调用数据库 `count()` 聚合。
- `lib/app.js`：新增登录身份与匿名身份双归属计数的交集扣减逻辑，避免同一活动同时命中 `createdBy` 和 `anonymousIdentityId` 时重复计数。
- `lib/app.js`：`owner=me` 活动列表在单一归属身份时直接使用数据库分页；双归属身份只按当前页拉取候选后合并、排序、去重。
- `lib/app.js`：管理员待办列表不再固定拉取最多 1000 条候选，改为根据当前页大小拉取候选后合并。
- `lib/app.js`：登录时清理过期 Session 改为 `expiresAt < now` 的索引条件删除；退出登录优先按 `tokenHash` 精确删除。
- `tests/smoke.test.js`：新增 `owner=me` 分页总数断言，覆盖同一活动被登录身份和匿名身份同时命中时不能重复计数。
- `README.md`、`CHANGELOG.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步 `0.20.2` 版本、性能说明、索引说明和静态资源缓存版本号。
- CloudBase 生产环境：通过 CLI 创建并验证活动、用户、Session、模块、模板、日志、报名、规则引擎、系统配置、Community Governance、AI Analysis、社区举报和限流相关集合索引。

### 涉及文件

- `lib/app.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/cloudbase-indexes.md`
- `docs/dev-log.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 工作台计数使用数据库 `count()`，而不是把活动列表拉回 Node 内存统计，是因为入口卡片只需要状态数量，不需要完整活动正文、封面和报名信息。
- 双归属身份采用“分别计数后扣减交集”的方式，兼容未登录匿名发起、登录协作员发起，以及同一浏览器登录后继续发起三种场景。
- 索引优先覆盖筛选、排序、详情读取和时间线查询；关键词正则搜索仍适合 MVP 阶段，后续如数据量继续增长，应改成冗余搜索字段或专门搜索服务。

### 设计决策原因

- 「我的」页面慢的根因不只是缺索引，还包括 API 结构中一次性拉取大列表再统计。单纯加索引不能解决响应体和内存统计成本。
- CloudBase 默认 `_id` 索引不能完全覆盖本项目的业务 `id` 字段查询；大量 `findById()` 实际使用业务 `id`，因此本次额外补充了核心集合的 `id` 索引。
- 管理员待办和 owner 列表仍需要处理跨归属 / 跨状态合并，当前实现先压缩候选规模，保留现有业务语义，避免一次性引入更复杂的数据冗余设计。

### 当前完成情况

- 后端查询优化、测试断言、版本和文档更新已完成。
- CloudBase 索引创建完成并抽样验证：`yk_activities`、`yk_logs`、`yk_trustProfiles`、`yk_aiPrompts` 等关键集合均可列出新增索引。

### 遗留问题

- `owner=me` 双归属分页仍需要合并两个查询结果；当某个身份活动超过 1000 条且访问非常靠后的页时，仍建议引入独立 owner 映射表或冗余 `ownerKeys` 字段来实现真正单查询分页。
- CloudBase 索引数量增加会略微增加写入成本，后续如发现某些后台能力长期不用，可根据命中次数清理低价值索引。
- 关键词搜索仍是正则匹配，不适合无限增长的数据量。

### 下一步建议

1. 部署后在线上对 `/api/session`、`/api/dashboard/me`、`/api/activities?owner=me&page=1&pageSize=12` 做冷启动和热启动耗时对比。
2. 为 `/api/dashboard/me` 增加后端分段 timing 日志，拆分 session、owner counts、pending preview 各自耗时。
3. 如果「我的活动」未来超过千级数据，新增 `ownerKeys` 冗余数组字段并建立 `ownerKeys + status + createdAt` 索引，把双归属合并变成单查询。

## 2026-07-27 - 0.21.0 开放报名、最低成团与感兴趣

### 任务目标

把公开活动参与链路从“昵称 + 手机号报名”调整为更轻、更少隐私沉淀的“昵称 + 匿名身份”模型；允许发起人选择是否公示报名昵称；增加最低报名限度和最后报名日期，让活动可以像“投票 + 报名”一样自动判断是否成团；并在近期 / 历史活动列表增加一次性的「感兴趣」表达。

### 具体修改内容

- `lib/app.js`：公开报名接口只校验昵称，使用综合匿名身份生成稳定报名 ID，重复报名刷新确认 token；报名响应、报名表和确认页均不再返回报名手机号。
- `lib/app.js`：新增活动字段 `showRegistrationNames`、`minRegistrationEnabled`、`minRegistrationCount`、`registrationDeadline`、`interestCount`，创建 / 编辑活动时统一解析和校验。
- `lib/app.js`：新增 `not_formed_cancelled` 状态；自动归档 sweep 同时处理结束活动和最低报名未达标活动；报名截止时仍低于最低人数会立即转为「未成团取消」。
- `lib/app.js`：新增 `/api/activities/:id/interests`，按活动 ID + 匿名身份幂等写入 `activityInterests`，同一浏览器身份只能点一次。
- `lib/store.js`：新增 `activityInterests` 集合初始化。
- `lib/community-governance/service.js`：Community Profile 投影增加 `interestCount`，便于后续把兴趣回应接入信用策略。
- `app.js`：活动编辑页支持报名昵称公示开关、最低报名限度开关、最低人数和最后报名日期；最后报名日期默认等于活动开始时间。
- `app.js`：活动详情报名表只保留昵称；报名成功页只展示报名昵称并保留取消报名能力；活动详情按配置展示报名昵称墙。
- `app.js`：近期 / 历史活动卡片展示最低成团信息和「感兴趣」按钮，点击后本地记录并禁用按钮。
- `assets/js/activity-share.js`：分享能力调整为「下载活动邀请函」，邀请函不再包含报名手机号，诚邀昵称字号加大。
- `activity-editor.html`、`styles.css`：补充新表单字段和公开昵称墙、成团信息、感兴趣按钮的样式。
- `tests/smoke.test.js`：新增昵称报名、匿名身份重复报名、报名昵称公示、感兴趣去重、最低报名未成团取消、邀请函不含手机号等覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、变更说明、安全口径和索引建议。

### 涉及文件

- `lib/app.js`
- `lib/store.js`
- `lib/community-governance/service.js`
- `app.js`
- `activity-editor.html`
- `styles.css`
- `assets/js/activity-share.js`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/cloudbase-indexes.md`
- `docs/dev-log.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 报名去重改用匿名身份，而不是手机号，是为了满足“报名只录入昵称”的体验，同时减少公开活动系统保存手机号的必要性。
- 报名确认和取消报名继续依赖一次性确认 token；重复报名会刷新 token，避免单纯知道报名 ID 就能访问确认页。
- 最低报名限度设计为可选开关：不开启时完全沿用普通报名流程；开启时要求填写最低人数和报名截止时间，并校验人数限额必须大于最低报名人数。
- 「感兴趣」只记录一次且不可取消，使用匿名身份幂等写入，降低刷数和误触反复波动。
- 「未成团取消」归入历史活动，而不是删除活动，保留公共记录和后续复盘线索。

### 设计决策原因

- 有空客厅的开放活动发布不适合把报名手机号作为默认必填项；昵称报名更符合低门槛参与，同时确认 token 能维持基本的个人确认页访问保护。
- 最低报名限度本质上是发起人对活动启动条件的声明，不应影响不需要成团判断的普通活动，所以放在显式开关之后。
- 公示报名人昵称需要由发起人主动选择，默认不公开，避免把报名者参与信息意外公开。
- 感兴趣数据未来可以进入推荐、Community Trust 或活动组织判断，但当前只做轻量表达，不引入取消、排行榜或复杂互动。

### 当前完成情况

- 功能开发和文档同步已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- CloudBase 生产环境仍需补充 `yk_activityInterests`、`yk_registrations.activityId + identityId` 和 `yk_activities.status + minRegistrationEnabled + registrationDeadline` 等新索引。
- 匿名身份依赖浏览器本地 UUID、指纹和请求信息；用户更换浏览器或清理本地存储后仍可能重复报名或再次点击感兴趣，这是开放优先架构下的可接受边界。
- 当前最低成团自动取消依赖请求兜底 sweep / 服务端定时轮询；CloudBase 上更稳的方式仍是增加定时触发器。

### 下一步建议

1. 在 CloudBase 控制台补齐 `0.21.0` 新增索引，并观察 `yk_activityInterests` 写入量。
2. 为最低报名活动增加前端倒计时或“距离报名截止”提示，让参与者更容易理解成团状态。
3. 后续如引入微信登录，可把匿名报名记录与实名联系方式做可选绑定，而不是重新把手机号作为公开报名必填项。

## 2026-07-27 - 0.22.0 活动来源、客厅朋友与匿名反馈

### 任务目标

把活动历史从单一「有空客厅」来源扩展为「客厅」与「客厅的朋友们」两类；让管理员可以维护客厅朋友空间；为每场活动增加匿名反馈闭环，支持二维码收集、AI 展示适宜性分析、发起人查看、管理员复核和 CSV 导出；同时在「我的」页面补充当前设备报名记录和活动反馈记录，并明确取消报名后的活动不再展示在我的报名中。

### 具体修改内容

- `lib/store.js`：新增 `livingRoomFriends` 和 `activityFeedbacks` 集合初始化。
- `lib/app.js`：新增客厅朋友 CRUD API、活动来源字段解析 / 校验、历史活动 `sourceType` 筛选、活动反馈提交 / 查询 / 管理 / 复核 / CSV 导出 API。
- `lib/app.js`：活动 payload 增加 `sourceType`、`sourceName`、`friend`、`showFeedbacks` 和 `publicFeedbacks`；旧活动默认归为「客厅」。
- `lib/app.js`：新增 `/api/my/registrations` 和 `/api/my/feedbacks`，按当前浏览器匿名身份展示仍有效报名记录和已提交匿名反馈；取消报名仍采用删除报名记录，因此不会进入我的报名。
- `lib/community-safety/defaults.js`：新增默认 `feedback` Prompt，强调 AI 只做反馈展示适宜性与排序权重分析，不给活动打分。
- `lib/ai-analysis/schema/feedback-report.js`：新增反馈分析标准 Schema，规范 `shouldDisplay`、`feedbackWeight`、风险标记、展示理由和信号数组。
- `lib/ai-analysis/prompts/service.js`、`lib/ai-analysis/service.js`：新增 `buildFeedbackMessages()`、按类型读取 Prompt 版本、`analyzeFeedback()` 统一服务。
- `activity-editor.html`：发起活动页新增发起形式、客厅朋友选择和是否展示活动反馈字段。
- `activities.html`：历史活动页新增「全部历史 / 客厅 / 客厅的朋友们」来源筛选。
- `me.html`：新增我的报名和我的活动反馈两个当前设备记录区。
- `admin.html`：后台入口增加客厅朋友和活动反馈管理。
- `admin-friends.html`：新增客厅朋友管理页面。
- `admin-feedbacks.html`：新增全站活动反馈管理页面。
- `activity-feedback.html`：新增发起人活动反馈页，支持反馈二维码下载和反馈列表。
- `feedback.html`：新增匿名反馈问卷页。
- `app.js`：新增客厅朋友管理、活动来源选择、历史来源筛选、匿名反馈提交、反馈二维码、我的报名、我的反馈、反馈复核和 CSV 下载交互。
- `styles.css`：新增紧凑列表、标签行、反馈卡片、二维码面板和反馈问卷样式。
- `tests/smoke.test.js`：新增客厅朋友维护、来源活动创建、历史来源筛选、取消报名不进入我的报名、匿名反馈 AI 自动展示、重复反馈幂等、反馈管理员复核、反馈 CSV 导出和新增页面移动端无横向溢出覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档、索引建议和静态资源缓存参数。

### 涉及文件

- `lib/app.js`
- `lib/store.js`
- `lib/community-safety/defaults.js`
- `lib/ai-analysis/prompts/service.js`
- `lib/ai-analysis/service.js`
- `lib/ai-analysis/schema/feedback-report.js`
- `app.js`
- `activity-editor.html`
- `activities.html`
- `me.html`
- `admin.html`
- `admin-friends.html`
- `admin-feedbacks.html`
- `activity-feedback.html`
- `feedback.html`
- `styles.css`
- `tests/smoke.test.js`
- `README.md`
- `CHANGELOG.md`
- `docs/security.md`
- `docs/cloudbase-indexes.md`
- `docs/dev-log.md`
- `package.json`
- `package-lock.json`
- `*.html`

### 技术方案选择

- 客厅朋友作为独立集合维护，而不是写死到活动模块里，是因为它描述的是发起来源 / 合作空间，不等同于活动类型。
- 活动来源采用 `sourceType + friendId`，旧活动没有 `sourceType` 时默认视为 `living_room`，避免历史数据迁移阻塞上线。
- 反馈采用匿名身份 + 活动 ID 生成幂等 ID，保持“匿名但可防重复”的开放体验；不填写名称、不评分，避免把反馈系统做成评价平台。
- 反馈 AI 使用独立 Prompt 和 Schema，是因为它分析的是“是否适合公开展示”和“对复盘是否有信息量”，不能复用活动置信度评分。
- 反馈不轻易删除，默认进入 `approved / admin_review / rejected` 三态；活动详情只展示 `approved`，管理员保留复核和导出能力。

### 设计决策原因

- 「取消报名了的活动不展示」应作用在当前设备我的报名列表；报名历史如果未来需要保留，应该作为单独历史记录或审计记录，而不是混在当前有效报名中。
- 历史活动按来源分组可以帮助访客理解哪些活动发生在有空客厅，哪些来自朋友空间，同时不破坏近期活动的简单入口。
- 反馈展示权重只用于同一活动内排序，不跨活动比较，避免形成分数竞赛或排行榜倾向。
- AI 在反馈链路中仍是观察员，不是最终裁判；疑似垃圾或风险反馈进入管理员复核，由管理员决定是否公开展示。

### 当前完成情况

- 功能开发、文档同步和版本号更新已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- CloudBase 生产环境需要补齐 `yk_livingRoomFriends`、`yk_activityFeedbacks` 和活动来源相关索引。
- 当前活动反馈提交会先等待 AI 分析再返回；如果未来反馈量变大，可复用活动异步分析队列，把反馈提交也改成先入库再异步分析。
- 当前 `app.js` 和 `lib/app.js` 继续变大，后续应优先拆分 friends、feedbacks、activities、ai 和 dashboard 模块。

### 下一步建议

1. 部署后在 CloudBase 控制台创建 `yk_activityFeedbacks.activityId + identityId`、`yk_activityFeedbacks.status + createdAt`、`yk_livingRoomFriends.enabled + updatedAt` 等索引。
2. 线上验证一个已开始活动的匿名反馈二维码，确认微信内置浏览器也能提交且同设备重复提交返回已有反馈。
3. 后续可增加反馈异步分析队列和反馈导出字段配置，进一步降低 AI 调用等待和 CSV 字段变更成本。

## 2026-07-28 - 0.23.0 活动反馈治理与后台工作台体验升级

### 任务目标

根据最新反馈，优化活动反馈二维码和活动邀请函下载格式；让 AI 拦截的活动反馈进入管理员审核待办；允许管理员隐藏已展示反馈；修复规则引擎参数文本框视觉不一致；并把 YKadmin 后台从平铺卡片墙调整为更清晰的分组工作地图，同时安装并使用 `lottiefiles/motion-design-skill` 的动效原则。

### 具体修改

- `assets/js/activity-share.js`：活动邀请函导出从 PNG 改为 JPG。
- `app.js`：反馈二维码预览继续使用 SVG，下载时转换为白底 JPG；活动反馈审核按钮支持展示、不展示、隐藏、恢复展示；审核待办支持活动任务和反馈任务分组渲染；管理员工作台入口改为五组信息架构并加入统一 SVG 图标。
- `lib/app.js`：`/api/dashboard/admin` 返回待审核反馈预览，并把活动待办与反馈待办计入管理员待办总数。
- `activity-feedback.html`：反馈二维码下载按钮文案调整为「下载反馈二维码」。
- `review-tasks.html`、`admin.html`：同步活动复核 / 反馈复核和后台分组文案。
- `styles.css`：新增后台分组容器、线性图标、待办分组、规则文本框统一样式和 reduced-motion 降级；规则参数 JSON 文本框与规则说明保持同尺寸同视觉语言。
- `tests/smoke.test.js`：新增管理员待办反馈、反馈展示 / 隐藏 / 恢复展示、活动反馈二维码 JPG 下载、活动邀请函 JPG 下载和规则文本框样式一致性断言。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档和静态缓存参数。

### 技术方案选择

- 反馈复核只进入管理员待办，而不进入协作员待办，是因为匿名反馈会直接影响公开活动详情页展示，属于全站内容兜底治理。
- 反馈内容不删除，而是通过 `approved / admin_review / rejected` 状态切换展示，是为了保留复盘和审计线索，也符合 Community OS “少删除、重提示、可追溯”的治理方向。
- 反馈二维码预览保留 SVG、下载改为 JPG，是为了兼顾页面清晰度和微信 / 相册保存兼容性。
- 后台入口使用内置 SVG 图标而不是外部图标库，避免增加 CSP、网络加载和部署复杂度。
- 动效只使用 transform、opacity 和轻微状态过渡，并提供 `prefers-reduced-motion` 降级，避免后台页面出现装饰性动效。

### 当前完成情况

- 功能开发、文档同步和版本号更新已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- 后台模块继续增加时，后续可以进一步抽出真正的后台侧边栏或命令菜单，减少 `app.js` 中 dashboard 渲染逻辑体积。
- 当前活动反馈审核仍复用展示 / 不展示接口，未来若要更细分「AI 拦截」「管理员隐藏」「发起人不公开」的原因，可增加 `reviewReason` 字段。

### 下一步建议

1. 线上部署后用一个已开始活动验证反馈二维码 JPG 在微信内置浏览器和手机相册里的可保存性。
2. 后续把活动反馈分析改为异步队列，避免反馈提交时等待 AI。
3. 继续拆分 `app.js` 的 admin dashboard、feedbacks、activity share 模块，让前端主文件更轻。

## 2026-07-28 - 0.23.1 motion-design 图标与状态反馈增强

### 任务目标

使用已安装的 `lottiefiles/motion-design-skill` 优化网站图标动效，并顺手审查系统中适合补充动效的区域。目标不是增加装饰动画，而是让状态切换、按钮点击、保存成功、感兴趣、后台入口 hover 等交互更有反馈。

### 具体修改

- `script.js`：主题切换点击时增加 `is-cycling` 短时状态；新增全局 `mountMotionFeedback()`，为按钮、主题切换、一键回首页、工作台卡片、活动卡片和感兴趣按钮添加短时按压反馈类。
- `app.js`：`showToast()`、`setMessage()` 和感兴趣成功后触发短时 confirmation / update / error motion class。
- `styles.css`：覆盖主题切换早期伪元素图标，统一使用 SVG 图标；新增主题切换、工作台图标、一键回首页、按钮按压、活动封面 hover、状态 tag、感兴趣计数、toast 和表单消息的 motion 动效；补齐 `prefers-reduced-motion` 降级。
- `tests/smoke.test.js`：新增主题切换 cycling 状态、后台分组数量、后台入口 SVG 图标数量和图标 transition 挂载断言。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本与静态资源缓存参数到 `0.23.1`。

### 技术方案选择

- 本项目后台属于产品界面，因此选择 Corporate / Premium 动效：150-360ms、低幅度、无夸张弹跳。
- 图标动效只发生在 hover、focus、click 或状态切换时，不做常驻循环，避免后台页面分散注意力。
- 优先使用 transform、opacity、filter 和 box-shadow，不动画布局属性，降低移动端和微信内置浏览器掉帧风险。
- 主题切换使用 SVG 动画层，是因为之前 CSS 伪元素图标历史包袱较重，继续叠加会导致图标不稳定。

### 本次评估出的适合动效区域

- 已完成：主题切换图标、后台入口图标、一键回首页、感兴趣按钮、活动卡片封面、toast、表单成功 / 错误消息。
- 适合后续做：活动安全分析队列可以增加轻量进度状态；活动反馈二维码生成可以增加局部 skeleton；管理员表格批量操作可以增加完成确认；AI 测试连接可以增加连接中状态。
- 暂不建议做：后台列表整页复杂转场、长时间循环装饰动画、活动审核页大幅度动画，因为这些会影响任务型页面效率。

### 当前完成情况

- 功能开发、文档同步和版本号更新已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- 目前动效仍在 `styles.css` 末尾覆盖层维护；后续拆 CSS 时建议把 motion tokens、product motion 和 public motion 拆成独立文件。

### 下一步建议

1. 后续可以把按钮图标体系做成统一组件，让“下载 / 保存 / 删除 / 审核 / 复制”都有一致图标和动效。
2. 如果继续做高级视觉，可优先补活动安全分析、AI 连接测试、二维码生成这三类加载状态。

## 2026-07-28 - 0.23.2 主题切换图标比例修正

### 任务目标

根据反馈，主题切换按钮外圈尺寸刚好，但内部太阳 / 月亮 / 跟随系统图标过大，导致整体不协调。本次只修正图标比例，不改变按钮位置、外圈尺寸和三态切换逻辑。

### 具体修改

- `styles.css`：拆开主题切换 SVG 与后台入口 SVG 的尺寸规则，避免 `.theme-switch-icon svg` 被后续 motion 覆盖层设置为 `100%` 宽高；主题按钮内部 SVG 改为 15px，保留圆形外圈 38px。
- `tests/smoke.test.js`：新增主题按钮尺寸断言，校验外圈宽度保持 36px 以上，内部 SVG 最大宽度不超过 16px。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本与静态资源缓存参数到 `0.23.2`。

### 技术方案选择

- 不改 `script.js` 中的三枚 SVG path，是为了降低功能回归风险；问题主要来自 CSS 覆盖层尺寸，不是图标结构。
- 保留外圈尺寸，是因为当前导航留白和点击热区已经稳定；只缩小内部 glyph，符合用户反馈的真实问题。
- 继续使用 CSS 末尾覆盖层，是为了在暂未拆分 `styles.css` 前快速压住历史样式优先级。

### 当前完成情况

- 代码修复和文档同步已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- `styles.css` 仍存在多个历史主题按钮样式块，后续拆分 CSS 时建议整理为一个主题按钮组件样式，减少覆盖层互相影响。

### 下一步建议

1. 后续如果继续精修导航，可把主题按钮、一键回首页和移动端菜单统一沉淀成独立 navigation 样式分区。
2. 部署后用无痕窗口检查首页、登录页和后台页的主题按钮，确认 CDN 缓存已刷新到 `v=0.23.2`。

## 2026-07-28 - 0.23.3 管理员工作台图标与动效升级

### 任务目标

根据反馈，管理员工作台的图标和动效仍不够高级。本次使用 `motion-design`、`impeccable` 的产品 UI / 动效原则，并参考 Vercel Geist 的克制 product surface、GitHub Primer / Octicons 的图标体系，重新打磨后台入口卡片。

### 具体修改

- `package.json`、`package-lock.json`：新增 `@primer/octicons` 依赖，作为 MIT 授权的 GitHub Octicons 图标参考源。
- `app.js`：`renderWorkspaceCard()` 增加 `data-card-tone`、`data-workspace-icon` 和右侧 cue arrow；`workspaceIconSvg()` 替换为 Octicon 风格实心 SVG，并按业务模块映射不同图标。
- `styles.css`：管理员工作台入口升级为 Primer / Geist inspired command surface：语义 tone、局部指针高光、轻微 sheen、实心图标底座、右侧箭头渐入和分业务图标动效。
- `tests/smoke.test.js`：新增后台入口 Octicon 风格 SVG、tone、右侧箭头和 motion 挂载断言。
- `README.md`、`CHANGELOG.md`、`*.html`：同步版本、文档和静态缓存参数到 `0.23.3`。

### 技术方案选择

- Vercel Geist 作为视觉参考，不直接复制其专有实现；项目仍保持 Vanilla JS + CSS 的低依赖结构。
- GitHub Octicons 以 npm 依赖形式引入，保证图标来源和授权清晰；前端最终仍输出内联 SVG，避免后台页面依赖 CDN。
- 动效选择 Corporate / Premium：150-250ms、无循环、无夸张弹跳。AI、审核、举报、日志等入口只在 hover / focus 时做一次业务语义反馈。
- 卡片使用 `--local-x / --local-y` 复用项目已有指针高光机制，避免新增复杂动画库，同时保留 `prefers-reduced-motion` 降级。

### 当前完成情况

- 代码修复和文档同步已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。
- 本地 Playwright 已截图检查管理员工作台桌面 / 移动端，图标比例、右侧箭头和 hover surface 正常。

### 遗留问题

- `styles.css` 的后台样式仍以版本覆盖层维护；后续可拆成 `admin-dashboard.css`、`motion.css` 和 `theme.css`，减少覆盖成本。
- 当前 Octicon 路径写入 `app.js`，未来如果后台图标继续扩展，可增加一个小型构建脚本从 `@primer/octicons` 自动生成图标映射。

### 下一步建议

1. 如果继续提升后台体验，可以把管理员工作台改成左侧一级模块导航 + 右侧最近任务流，进一步减少卡片墙感。
2. 后续可为 AI 分析、举报处理、反馈审核增加更精细的 skeleton / pending 状态，而不是只在入口卡片做动效。

## 2026-07-28 - 0.23.4 「我的」开放工作台图标与动效统一

### 任务目标

根据反馈，普通用户、活动参与者和活动发起人的「我的」页面也需要像管理员工作台一样拥有更好的设计图标和动效。本次目标是把 `0.23.3` 的 Primer / Geist inspired command surface 扩展到开放工作台，同时保持普通用户页面更轻、更直接。

### 具体修改

- `me.html`：为待办预览、我的报名、我的活动反馈和入口分区增加稳定 `data-me-section` 标记，并为我的报名 / 我的反馈增加页面锚点。
- `app.js`：开放工作台入口增加「我的报名」「我的反馈」两张参与者入口卡片；发起活动、我发起的活动、审核待办和管理后台卡片增加 Octicon 风格图标、语义 tone 和右侧 cue arrow 数据。
- `styles.css`：新增 `0.23.4 open workspace command surface` 样式层，覆盖普通工作台入口卡片、分区 tone、列表行 hover feedback、明暗主题和 reduced-motion 降级。
- `tests/smoke.test.js`：新增未登录 `me.html` 冒烟断言，校验 4 个基础入口、Octicon SVG、tone、cue arrow、锚点和协作待办隐藏状态。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本和静态资源缓存参数到 `0.23.4`。

### 技术方案选择

- 继续沿用管理员工作台的 Octicon / tone / cue arrow 视觉系统，避免普通工作台和后台产生两套不一致的组件语言。
- 普通工作台没有照搬后台分组外壳，只强化入口卡片和列表反馈，保持「我的」页对未登录用户足够轻。
- 动效继续使用 motion-design 的 Corporate / Premium 取向：150-250ms、transform / opacity 优先、无弹跳、无循环，并保留 `prefers-reduced-motion` 降级。
- 「我的报名」「我的反馈」入口使用锚点跳转，是因为这两个内容已经在当前页面上方展示；让卡片成为清晰入口，不额外制造新页面跳转。

### 当前完成情况

- 代码修改、版本号和文档同步已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- `styles.css` 继续通过版本覆盖层维护后台 / 开放工作台样式；后续拆分 CSS 时建议提取 `workspace-card` 组件样式，减少 admin 与 me 两处选择器重复。

### 下一步建议

1. 可以继续把 `workspaceIconSvg()` 从 `app.js` 抽成独立图标模块，避免主逻辑文件继续膨胀。
2. 后续可给「我的报名」和「我的反馈」列表补 skeleton 状态，让读取历史记录时的等待感更稳。

## 2026-07-28 - 0.24.0 后台用户管理与角色权限一期

### 任务目标

根据新的后台信息架构需求，将原「协作员管理」拆成「用户管理」和「角色权限管理」；后台用户先采用单角色模型，角色支持两层权限：模块访问权限和动作权限。取消工作台里的 Community Governance 总入口，保留子模块并重新归入社区治理、安全与智能等对应分组。

### 具体修改

- `lib/permissions.js`：新增 RBAC 权限定义模块，集中维护权限动作、后台模块、默认管理员角色、默认协作员角色、权限归一化和权限判断。
- `lib/store.js`：新增 `roles` 集合；初始化默认角色；将旧 `member` 角色迁移为 `collaborator`；管理员角色保持锁定全权限。
- `lib/app.js`：新增角色公开结构、角色校验、用户角色水合、`requirePermission()` / `requireAnyPermission()`；新增 `/api/roles` CRUD；用户接口改为单角色；后台活动、模块、模板、朋友、反馈、举报、规则、AI、社区信用、徽章、日志等接口逐步改为模块动作权限保护。
- `admin-members.html`：改为「用户管理」，角色筛选和新增用户角色下拉由后端角色列表动态填充。
- `admin-roles.html`：新增角色权限管理页，提供角色搜索、角色列表、角色表单和权限矩阵。
- `admin.html`、`app.js`：后台入口新增「用户与权限」分组；取消 Community Governance 总入口卡片，社区治理子模块直接展示；后台卡片按当前用户权限过滤。
- `script.js`、`styles.css`：将角色权限页纳入产品后台 surface；新增权限矩阵、permission chip、角色列表和禁用按钮样式。
- `tests/smoke.test.js`：新增自定义角色创建、用户分配、允许访问日志、禁止越权访问用户接口，以及 `admin-roles.html` 移动端无横向溢出断言。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档和静态资源缓存参数到 `0.24.0`。

### 技术方案选择

- 先做单角色，不做多角色叠加，降低权限解释成本和误授权风险。
- 两层权限采用模块 + 动作的扁平矩阵，动作包括 `view/create/edit/delete/review/export/configure/reanalyze/cancel/end`，方便后续新增模块或动作。
- `admin` 角色锁定全权限且不可编辑；`collaborator` 作为内置协作角色可编辑权限但不可删除，便于社区后续调整协作员职责。
- 前端页面守卫与后端接口守卫都使用同一套权限字段，避免只在前端隐藏按钮却后端可越权，或后端拦截但前端仍展示入口的割裂体验。

### 当前完成情况

- 代码开发与文档同步已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- 当前 RBAC 仍在 `app.js` / `lib/app.js` 主文件中集成较多，后续拆分路由时建议把 `roles`、`users`、`permissions` 前后端逻辑进一步模块化。
- 角色权限矩阵暂未支持复制角色、权限模板、变更 diff 预览；如果角色数量增加，可以继续补这些运维功能。
- CloudBase 线上已有用户如果存在非内置自定义角色但没有对应角色定义，会在水合时回退到协作员语义；后续如需迁移旧自定义角色，应先在角色权限页补齐角色定义。

### 下一步建议

1. 将后台所有“写操作按钮”的隐藏和禁用状态继续细化到更小动作，例如反馈展示 / 隐藏、活动导出、Prompt 激活等可以在 UI 上展示权限说明。
2. 为角色权限页增加“复制已有角色”能力，降低新增角色配置成本。
3. 后续拆分 `app.js` 和 `lib/app.js` 时，优先抽出 `users`、`roles`、`permissions` 路由与前端模块。

## 2026-07-29 - 0.24.1 角色权限详情页与中文化打磨

### 任务目标

根据反馈修复角色权限矩阵中「查看 / 审核」等动作控件视觉异常的问题；在用户管理页增加「新建角色」入口；将新增角色拆成独立子页面；同时检查后台系统可见文案，尽可能使用中文。

### 具体修改

- `admin-roles.html`：移除右侧内联角色编辑栏，保留搜索、角色列表和「新建角色 / 用户管理 / 回后台」入口。
- `admin-role-editor.html`：新增角色详情页，支持新增和通过 `?id=` 编辑角色，包含角色标识、名称、说明和权限矩阵。
- `admin-members.html`：用户管理工具栏新增「新建角色」按钮，并放在「角色权限」按钮左侧。
- `app.js`：新增 `initAdminRoleEditorPage()`；角色列表编辑按钮改为跳转独立详情页；保存角色后返回角色列表；用户管理页根据当前用户权限隐藏「新建角色」；后台工作台和社区治理旧入口的可见英文标签改为中文。
- `script.js`：将 `admin-role-editor.html` 纳入产品后台页面识别，确保主题和页面 surface 一致。
- `styles.css`：新增角色详情页布局；权限矩阵动作项改为隐藏原生 checkbox 的可访问勾选胶囊控件，统一选中、hover、focus 和禁用状态。
- `admin-ai.html`、`admin-safety.html`、`admin-reports.html`、`admin-trust*.html`、`admin-badges.html`、`admin-badge-policy.html`、`admin-governance.html`：把页面标题、eyebrow 和说明中的主要英文模块名中文化。
- `tests/smoke.test.js`：新增用户管理页按钮顺序、角色详情页移动端无横向溢出和权限胶囊控件视觉状态断言。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档和静态资源缓存参数到 `0.24.1`。

### 技术方案选择

- 角色新增 / 编辑拆到独立详情页，是为了让列表页保持扫描和搜索效率，也为后续增加复制角色、权限 diff、策略说明等字段预留空间。
- 权限控件保留原生 checkbox 作为真实输入，视觉层用 `.permission-chip-check` 呈现勾选状态，兼顾键盘焦点、可访问性和稳定排版。
- 没有新增 `/api/roles/:id` 接口；详情页先复用现有 `/api/roles?page=1&pageSize=100` 获取角色列表并按 `id/key` 查找，降低后端改动面。
- 中文化只改可见文案和文档说明，不改 API 字段、权限 key、Provider、Prompt 等技术标识，避免影响数据兼容。

### 当前完成情况

- 代码开发与文档同步已完成。
- 本地 `npm test` 和 `npm run deploy:dry-run` 已通过。

### 遗留问题

- 角色详情页暂未提供复制已有角色、权限变更 diff 预览和按模块批量勾选能力。
- `app.js` 中角色、用户、后台工作台逻辑仍在同一个大文件里，后续前端拆模块时建议优先抽出 `roles` 和 `permissions`。

### 下一步建议

1. 为角色详情页增加“从已有角色复制”入口，减少新增自定义角色时的勾选成本。
2. 为权限矩阵增加模块分组折叠和搜索，在权限模块继续增长时保持可读。
3. 后续可以把角色详情页权限变更记录展示为保存前 diff，让管理员更清楚本次修改会放开或收回哪些能力。

## 2026-07-29 - 0.25.0 AI 控制台、多模型配置与故障转移

### 任务目标

根据新的 AI 配置体验需求，重构原本反人类的单页 AI 设置表单。目标是让管理员可以像 cc-switch 一样维护多个模型档案、随时切换主模型、按场景选择模型、查看用量健康，并让活动反馈 Prompt 有清晰入口。同时保持 AI 作为 Community Observer / Analysis Engine 的定位，不把 AI 变成传统审核员。

### 具体修改

- `lib/community-safety/defaults.js`：新增默认 AI 模型档案和 AI 设置中的 `activeProfileId`、`fallbackEnabled`、`fallbackProfileIds`、`sceneRouting`。
- `lib/store.js`：新增 `aiModelProfiles` / `yk_aiModelProfiles` 集合；本地和 CloudBase seed 会从旧 `ai_settings` 迁移默认模型档案。
- `lib/ai-analysis/service.js`：重构 AI service，新增模型档案列表、详情、保存、删除、测试连接、用量统计、场景模型解析、主备故障转移和统一 `runAiAnalysis()` 执行器；活动分析和反馈分析都改为通过场景路由解析模型。
- `lib/ai-analysis/cache/store-cache.js`：缓存 key 增加模型档案、场景和 Prompt 版本，避免切换模型或 Prompt 后命中旧缓存。
- `lib/ai-analysis/logger/usage-logger.js`：用量日志增加 `profileId`、`profileName`、`scene`、`attempt`、`fallbackFrom` 和 `promptVersion`。
- `lib/community-safety/service.js`：活动置信度 `aiMeta` 写入本次使用的模型档案和故障转移 attempts，方便置信度详情继续演进。
- `lib/app.js`：新增 `/api/ai/models` CRUD、`/api/ai/models/:id/test`、`/api/ai/usage`、Prompt 单条详情接口、Prompt type 筛选；新增 / 编辑 Prompt 勾选立即启用时同步激活同场景版本。
- `admin-ai.html`：从旧大表单重构为 AI 控制台与场景路由页。
- 新增 `admin-ai-models.html`、`admin-ai-model-editor.html`、`admin-ai-prompts.html`、`admin-ai-prompt-editor.html`、`admin-ai-usage.html`。
- `app.js`：新增 AI 控制台渲染、模型档案列表与编辑、场景路由保存、Prompt 场景筛选与编辑、用量健康渲染。
- `styles.css`：新增 AI 控制台卡片、场景路由、模型档案、用量健康和 fieldset 胶囊控件样式，并补移动端单列布局。
- `tests/smoke.test.js`：新增默认模型档案存在、反馈 Prompt 筛选与启用、主模型 500 失败后自动切到备用模型、用量统计按模型记录成功 / 失败的覆盖。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本与文档到 `0.25.0`。

### 技术方案选择

- AI 模型档案独立成 `aiModelProfiles`，不是继续扩写 `systemConfigs.ai_settings`，因为未来不同场景需要不同模型，也需要记录每个模型的健康状态、优先级和适用范围。
- 场景路由采用 `activity / feedback / report / manual` 四个 scene，第一版覆盖已有业务和近期可预见的举报复核、手动重分析，不把业务代码绑定到具体 Provider。
- 旧 `/api/ai/settings` 保留兼容；当旧接口保存 Provider / Base URL / Model / API Key 时，同步默认模型档案并设回场景主模型，避免旧配置路径和新运行时打架。
- 故障转移在同一个 Prompt 和 Schema 下跨 Provider 尝试，保证业务层只拿标准分析报告；所有失败 attempt 写入用量日志，而不是吞掉。
- 用量统计第一版只做系统 + 模型维度，避免管理员被单条内容日志淹没，也符合这次参考 cc-switch 的“模型管理器”方向。
- Prompt 管理拆成独立列表和详情页，是为了把“活动反馈 Prompt 在哪里改”变成显式入口，而不是要求管理员知道隐藏的 `feedback` 类型。

### 当前完成情况

- 代码开发、版本号和文档同步已完成。
- 本地 `npm test` 通过。
- 本地 `npm run deploy:dry-run` 通过。

### 遗留问题

- AI 用量统计目前读取近 1000 条日志聚合，足够当前体量；后续调用量增加后建议改成 CloudBase 聚合或每日统计快照。
- AI 模型档案尚未实现日调用上限熔断，字段已预留 `dailyLimit`，但运行时没有根据该字段跳过模型。
- Prompt 管理暂未提供样例文本测试 Prompt、版本 diff 和一键复制当前版本创建新版本。
- 场景路由目前只有主模型和备用队列；后续可以增加按低信用身份、举报复核、随机抽检等策略选择不同模型的更细路由。

### 下一步建议

1. 增加 Prompt 测试台：管理员选择场景、输入样例内容，直接查看结构化 JSON、耗时、Token 和使用模型。
2. 给 AI 用量健康增加每日趋势图和 Provider 失败率阈值提醒，发现模型异常时自动提示切换主模型。
3. 拆分 `app.js` 和 `lib/app.js` 中 AI 相关逻辑，优先抽出 `admin-ai` 前端模块和 `lib/routes/ai.js`，降低主文件继续膨胀的维护风险。

## 2026-07-30 - 0.25.1 生产级安全红队加固第一轮

### 任务目标

根据 Community OS 安全红队审计讨论结果，优先加固开放匿名活动发布、管理 token、AI 成本、上传文件、日志和备份这些生产风险点。手机号免密后台登录和社区信用自报名 / 自点感兴趣刷分按产品决策暂不修改，但继续记录为已知风险。

### 具体修改

- `lib/community-safety/identity.js`：新增服务端签名匿名身份 Cookie `yk_anon`，并把服务端匿名 Cookie、本地 UUID、fingerprint、UA、IP 组合为限流 key，降低只改 LocalStorage 绕过限流的风险。
- `lib/community-safety/service.js`：活动管理 token 改为随机值 + hash 存储，新增过期时间、撤销状态和身份绑定校验；默认不再从 query string 读取管理 token。
- `lib/community-safety/rate-limit.js`：发布限流使用综合身份 key，而不是只依赖兼容旧数据的匿名 identity id。
- `lib/app.js`：新增生产密钥启动检查、服务端匿名 Cookie 下发、Session HMAC hash 兼容迁移、上传图片像素上限校验、日志字段控制字符清洗。
- `lib/ai-analysis/service.js`：接入系统每日 AI 调用预算，默认 200 次；模型档案 `dailyLimit` 开始参与运行时熔断，达到上限后可走备用模型。
- `lib/ai-analysis/providers/openai-compatible.js`：CloudBase 生产环境默认拒绝 localhost、内网 IP 和云元数据地址作为 AI Base URL，降低 SSRF 风险。
- `scripts/backup-data.js`：备份默认脱敏 token、API Key、secret、salt、手机号和联系方式，新增 `--include-secrets` 显式开关。
- `admin-ai.html` / `app.js`：AI 控制台新增系统每日调用上限字段；徽章展示策略页改为勾选展示位置；活动置信度举报历史可直接展示 AI 分析报告。
- `tests/security.test.js`：新增安全回归测试，覆盖富文本 XSS、匿名身份签名、管理 token 过期 / 撤销 / 身份绑定、AI SSRF、Prompt Injection 隔离、AI 调用预算和备份脱敏。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/operations.md`、`docs/cloudbase-indexes.md`、`.env.example`、`package.json`、`package-lock.json`、`*.html`：同步版本、安全说明、运维说明、索引建议和静态资源缓存参数到 `0.25.1`。

### 技术方案选择

- 匿名身份保留原本本地 UUID 作为活动归属兼容字段，新增服务端签名 Cookie 主要用于限流和身份信号增强，避免改坏「我的活动」历史查询。
- 管理 token 使用“token 本体只给浏览器、服务端只存 hash”的模式，并绑定至少一个匿名身份信号；这样既保留无需登录的开放发布体验，也让复制 URL 或猜测 token 的成本更高。
- AI 每日预算按 `aiUsageLogs` 计数并排除缓存命中，是为了优先控制真实模型成本；模型级 `dailyLimit` 超限时尝试备用模型，系统级超限时直接跳过 AI 并交给规则和兜底策略。
- AI Base URL 防内网只在 CloudBase 生产默认收紧，同时保留 Ollama / local Provider 本地开发能力。
- 图片像素校验采用轻量 header 解析，不引入 `sharp` 等原生依赖，避免 CloudBase 云函数部署体积和平台兼容风险。

### 当前完成情况

- 代码开发、版本号和文档同步已完成。
- 本地 `npm test` 通过。
- 本地 `npm run deploy:dry-run` 通过。

### 遗留问题

- 手机号白名单免密登录仍是后台最大身份风险，等待登录方案定稿后再升级。
- 当前限流和报名锁仍是应用 / 数据记录级能力，CloudBase 多实例高并发下建议继续接入数据库唯一约束、网关限流或 WAF。
- 社区信用自报名和自点「感兴趣」暂不作为刷分攻击处理；未来让信用度影响更高价值权益前，需要先补关联身份检测和异常行为权重。
- CloudBase 生产部署前必须在控制台配置 `SESSION_SECRET`、`IDENTITY_HASH_SALT`、`AI_CONFIG_ENCRYPTION_KEY` 等真实长随机密钥，否则服务会拒绝启动。

### 下一步建议

1. 补权限接口矩阵安全测试，覆盖普通访客、协作员、自定义角色、管理员对所有 `/api/*` 管理接口的纵向 / 横向越权。
2. 把 AI 调用预算做成用量健康页趋势图，并增加接近上限提醒。
3. 在 CloudBase 控制台补齐 `yk_aiUsageLogs.profileId + createdAt`、`yk_aiUsageLogs.cacheHit + createdAt` 和 `yk_rateEvents.identityId + scope` 索引。

## 2026-07-30 - 0.27.0 共同发起人与编辑协作

### 任务目标

支持一场活动由多人共同发起，同时保持开放匿名发布的低门槛：主发起人可以邀请共同发起人一起维护活动，共同发起人拥有实际运营权限；编辑过程先用软锁和版本号解决并发覆盖，暂不引入腾讯文档式实时协作，避免服务器和状态同步复杂度过高。

### 具体修改

- `lib/store.js`：新增 `activityCoInitiators` 和 `activityCoInitiatorInvites` 存储集合，对应 CloudBase `yk_activityCoInitiators` 和 `yk_activityCoInitiatorInvites`。
- `lib/app.js`：新增共同发起邀请创建、邀请详情、接受邀请、移除共同发起人、活动编辑锁申请 / 续期 / 释放接口；活动权限判断扩展为主发起人、共同发起人、管理员和管理 token 多维校验；活动保存新增 `activityVersion`。
- `app.js`：新增共同发起邀请页初始化、我的活动共同发起人渲染、邀请链接复制、共同发起人移除、编辑锁冲突提示 / 接管、锁自动续期和版本冲突提示。
- `me.html`：公开资料从内嵌表单改成资料摘要入口。
- `profile-editor.html`：新增独立公开资料编辑页。
- `co-initiator-invite.html`：新增共同发起邀请接受页。
- `styles.css`：新增共同发起人 chip、邀请接受卡片和编辑锁提示状态样式。
- `tests/smoke.test.js`：新增共同发起邀请 / 接受、编辑锁冲突与接管、过期版本拦截、共同发起人权限边界、共同发起人查看报名表 / 反馈，以及公开资料编辑页拆分覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档、索引建议和静态资源缓存参数到 `0.27.0`。

### 技术方案选择

- 不做实时多人协同编辑，先采用数据库软锁 + `activityVersion` 乐观锁：进入编辑页先拿锁，提交时校验版本；锁过期或用户选择接管后才能覆盖锁。
- 保存草稿不触发规则引擎和 AI 分析，也不递增 `analysisVersion`；这能避免共同发起人反复修改草稿时消耗 AI 成本，正式提交才进入安全链路。
- 共同发起人可操作活动运营动作：编辑、提交、撤回、取消、结束、查看报名表、查看反馈；新增和移除共同发起人只保留给主发起人、管理员或持管理 token 的原发起人。
- 邀请链接使用一次性随机 token，服务端只保存 hash、状态、过期时间和接受者身份，避免数据库泄露时直接拿到可用邀请链接。

### 当前完成情况

- 代码开发、版本号和文档同步已完成。
- 本地 `npm test` 通过。

### 遗留问题

- 编辑锁是应用层软锁，不是强事务锁；极端并发下仍依赖 `activityVersion` 兜底阻止覆盖。
- 共同发起邀请目前是链接制，任何拿到链接且未过期的人都可以接受；后续如需要更强控制，可增加邀请备注、指定手机号 / 指定 Community ID 或一次性确认。
- 共同发起人角色目前是一种统一权限，不区分“仅编辑”“仅查看报名表”等细分角色；后续如果活动组织变复杂，可以把共同发起权限做成活动内 RBAC。

### 下一步建议

1. 在 CloudBase 控制台补齐 `yk_activityCoInitiators.activityId + status`、`yk_activityCoInitiators.identityId + status`、`yk_activityCoInitiatorInvites.tokenHash` 和 `yk_activityCoInitiatorInvites.activityId + status` 索引。
2. 给共同发起邀请增加过期提醒、重新生成邀请和复制成功 toast 的更完整可视状态。
3. 如果共同发起人数量增多，再考虑活动内角色模板和邀请审计详情页。

## 2026-07-30 - 0.26.0 开放用户体验与发起人主页

### 任务目标

从产品和普通用户视角优化活动参与 / 发起链路：让无需登录的发起人也能维护自己的公开形象，让活动详情和报名成功页更像真实社区活动来源，而不是只是一条匿名表单记录；同时把发起活动页拆成更好理解的分段流程，并在 AI 控制台增加更容易先看懂风险面的社区健康概览。

### 具体修改

- `lib/store.js`：新增 `identityProfiles` 存储集合，对应 CloudBase `yk_identityProfiles`。
- `lib/app.js`：新增匿名公开资料读写 API、公开发起人主页 API、头像上传路径 `profile-avatars/`、公开资料校验和社区健康概览 API；活动列表和详情 payload 增加 `initiatorProfile`。
- `app.js`：新增公开资料表单、头像压缩上传、发起人头像 / 名称 / 资料卡渲染、公开发起人主页初始化、活动编辑页四段式步骤导航和 AI 社区健康概览渲染。
- `me.html`：新增「我的公开资料」编辑卡片和公开主页入口。
- `profile.html`：新增发起人公开主页。
- `activity-editor.html`：把发起活动表单改为基本信息、活动介绍、报名设置、发布与高级设置四段，高级设置用 `details` 折叠。
- `admin-ai.html`：在 AI 控制台顶部加入社区健康概览区域。
- `styles.css`：新增公开资料、发起人卡片、报名成功票据卡、移动端报名 CTA、活动编辑步骤和社区健康概览样式，并补充白天 / 黑夜模式响应。
- `tests/smoke.test.js`：新增公开资料 API、公开发起人主页、活动详情发起人卡片、活动编辑分段步骤和「我的」公开资料表单覆盖。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档、索引建议和静态资源缓存参数到 `0.26.0`。

### 技术方案选择

- 公开资料绑定匿名身份，而不是后台用户账号；这符合开放发起活动的方向，也避免把管理员 / 协作员手机号公开化。
- 公开资料 API 使用 `publicIdentityProfile` 输出最小公开字段，只展示头像、昵称、简介、公开徽章和公开活动摘要，不暴露完整匿名 UUID、管理 token、手机号或 Community Trust 分数。
- 发起活动页仍保持单页提交，不拆成多路由向导；这样可以降低状态同步复杂度，同时通过步骤导航和折叠高级设置解决表单臃肿问题。
- 社区健康概览放在 AI 控制台顶部，是为了让管理员先看到风险面，再决定是否进入模型、Prompt、规则或待办模块处理。

### 当前完成情况

- 代码开发、版本号和文档同步已完成。
- 本地 `npm test` 通过。
- 本地 `npm run deploy:dry-run` 通过。

### 遗留问题

- 公开资料目前只有头像、昵称和简介；后续若要做发起人主页深度经营，可继续增加公开活动分类、联系方式展示策略和发起人空间页。
- 头像上传复用现有图片校验链路，但还没有做裁剪工具；当前由前端压缩并保留原比例。
- 发起人公开主页目前只展示公开活动摘要和近期公开活动；如果活动量增长，建议给 `yk_identityProfiles` 和公开活动查询继续补索引，并为主页活动列表增加分页。

### 下一步建议

1. 把 `app.js` 中 profile / activity detail / editor 相关逻辑继续拆到 `assets/js/` 下，降低主文件维护压力。
2. 给公开发起人主页增加分享卡片和活动来源筛选，让长期发起人更像社区里的真实空间节点。
3. 在 CloudBase 控制台补齐 `yk_identityProfiles.id`、`yk_identityProfiles.communityId` 和 `yk_identityProfiles.updatedAt` 索引。

## 2026-08-04 - 0.28.0 匿名设备身份网络

### 任务目标

把“一个浏览器就是一个人”的临时匿名身份升级成可长期演进的 Identity Network：手机、电脑和未来微信小程序身份都可以归到同一张匿名身份网络里，让用户在不同设备上继续编辑草稿、查看报名、活动反馈和自己发起 / 共同发起的活动，同时不引入传统注册账号。

### 具体修改

- `lib/store.js`：新增 `identityNetworks`、`identityNetworkDevices`、`identitySyncInvites`、`identityMergeEvents` 和预留的 `identityExternalCredentials` 集合。
- `lib/app.js`：新增身份网络上下文、设备同步邀请、合并预览、接受同步、移除设备和历史数据 `identityNetworkId` 打标逻辑；`/api/session`、`/api/profile/me` 和「我的」相关接口返回身份同步上下文。
- `lib/app.js`：我发起的活动、共同发起活动、报名、感兴趣、活动反馈和公开资料读写均改为身份网络优先；未开启同步时继续使用单设备匿名身份。
- `lib/app.js` / `lib/community-safety/service.js`：共同发起人接受 / 移除支持 `identityNetworkId`；社区举报按身份网络优先去重并记录 `identityNetworkId`。
- `me.html`：新增“同步设备”区块，展示身份网络状态、设备列表、二维码 / 同步链接。
- `identity-sync.html`：新增设备同步确认页，支持无 token 的状态说明、有 token 的合并预览、公开资料选择和确认同步。
- `app.js`：新增身份同步 UI、二维码链接复制、设备移除、同步页合并预览；开放工作台新增“同步设备”入口卡片，并把当前设备文案升级为当前身份。
- `styles.css`：新增身份同步卡片、二维码区域、设备列表、合并预览、资料选择和移动端响应式样式。
- `tests/smoke.test.js`：新增两台匿名设备合并流程，覆盖资料选择、跨设备我的活动聚合、我的报名聚合、报名去重和感兴趣去重；浏览器 smoke 覆盖同步入口和 `identity-sync.html` 移动端无横向溢出。
- `README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`、`package.json`、`package-lock.json`、`*.html`：同步版本、文档、索引建议和静态资源缓存参数到 `0.28.0`。

### 技术方案选择

- 不做传统账号注册，先做 Identity Network：单设备匿名身份仍可独立存在，用户主动扫码 / 打开短期同步链接后才合并。
- 合并不删除历史数据，只给活动、报名、感兴趣、反馈、举报和分析记录补充 `identityNetworkId`；“保留原身份 / 当前设备资料”只影响公开资料。
- 同步邀请使用 10 分钟一次性随机 token，服务端只保存 hash；二维码复用 `/api/qr`，不新增前端依赖。
- 未来微信小程序绑定预留在 `identityExternalCredentials`，但本次不接入微信登录、unionid 或小程序端流程。

### 当前完成情况

- 代码开发、版本号和文档同步已完成。
- 本地 `npm test` 通过。

### 遗留问题

- 设备同步邀请目前是链接 / 二维码制，任何拿到链接且未过期的人都可以加入目标身份网络；后续建议增加发起端二次确认、邀请撤销列表和合并审计页。
- 移除设备后，旧设备历史数据仍属于原身份网络；这是“保留历史”的产品选择，但后续如要支持完全拆分身份，需要设计反向迁移流程。
- Community Trust 事件和徽章仍主要按原匿名身份投影；本版只完成业务数据层身份网络聚合，后续可把 Trust Profile 也迁移为网络优先。

### 下一步建议

1. 在 CloudBase 控制台补齐 `yk_identityNetworkDevices.identityId + status`、`yk_identitySyncInvites.tokenHash`、`yk_activities.identityNetworkId + status + createdAt`、`yk_registrations.activityId + identityNetworkId` 等 `0.28.0` 新增索引。
2. 给同步设备增加设备重命名、撤销邀请、合并审计详情和“在原设备确认”二次确认机制。
3. 设计微信小程序 `openid/unionid` 绑定到 Identity Network 的 API 与冲突合并流程。

## 2026-08-07 - 小程序微信身份绑定与视觉统一

### 任务目标

让小程序身份网络支持微信小程序身份锚点，同时修复小程序生成的同步链接在浏览器打开时落到 CloudBase API 域名导致 `INVALID_PATH` 的问题；顺手把首页、活动卡和身份网络页做第一轮视觉统一。

### 具体修改

- `lib/app.js`：新增 `/api/identity-sync/wechat/bind`，小程序提交 `wx.login()` code 后由服务端换取 openid，并仅保存哈希后的外部凭证。
- `lib/app.js`：同步邀请返回的 `url` 改为使用 `PUBLIC_SITE_ORIGIN` 对应的静态站域名，同时保留 `miniPath` 给小程序内使用。
- `miniprogram/pages/identity-sync/*`：新增“绑定微信找回身份”模块；再次绑定同一微信时可自动合并到已有身份网络。
- `miniprogram/app.wxss`、`pages/home/*`、`components/activity-card/*`：统一小程序视觉，弱化重阴影，增强首页行动入口和活动卡信息层级。
- `.env.example`、`README.md`、`CHANGELOG.md`、`docs/security.md`、`docs/cloudbase-indexes.md`：补充微信绑定、公开站点域名和外部凭证索引说明。

### 技术方案选择

- 微信身份不取代匿名身份，只作为 Identity Network 的外部凭证锚点；所有活动发起、报名、反馈仍可匿名完成。
- openid / unionid 不明文落库，统一通过服务端 HMAC 哈希保存；AppSecret 只允许配置在服务端环境变量。
- 微信绑定和扫码同步复用同一套身份网络合并函数，避免数据迁移逻辑出现两套实现。

### 遗留问题

- 需要在 CloudBase 环境变量中配置 `WECHAT_MP_SECRET` 后，真机才能完成微信绑定。
- 后续可以继续把活动详情、编辑页、我的页面按同一套小程序视觉语言再做第二轮 polish。

## 2026-08-04 - 0.28.1 身份网络子页面拆分

### 任务目标

把身份网络从「我的」页面的大块展开区改为与“我的报名”“我的反馈”并列的入口子模块，降低工作台信息密度；所有开启、邀请和设备管理操作集中到独立子页面。

### 具体修改

- `me.html`：移除内嵌身份网络管理区块，为入口模块区增加稳定锚点 `#my-tools`。
- `app.js`：工作台卡片从“同步设备”改为“身份网络”，直接跳转 `identity-sync.html`；保留设备数量和开启状态摘要。
- `identity-sync.html` / `app.js`：无邀请 token 时渲染完整身份网络管理面板，可开启网络、生成同步二维码 / 链接、查看设备和移除设备；有 token 时继续走合并预览与确认流程。
- `app.js`：同步完成、邀请失效和读取失败后的返回路径统一指向身份网络页或「我的」入口区，移除失效的 `me.html#identity-sync` 链接。
- `tests/smoke.test.js`：更新工作台入口标签和跳转断言，新增“工作台无内嵌同步面板”和“身份网络独立页存在管理动作”覆盖。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本和静态资源缓存参数到 `0.28.1`。

### 技术方案选择

- 入口页只负责发现功能，子页面负责执行复杂操作；这样与公开资料编辑、我的活动等现有信息架构一致。
- 继续复用同一套 `renderIdentitySyncSummary()`，避免工作台与独立页产生两套身份网络管理逻辑。
- 邀请链接仍使用 `identity-sync.html?token=...`，因此不需要改变后端 API、二维码内容或既有邀请 token。

### 当前完成情况

- 页面结构、前端逻辑、浏览器冒烟、版本号和文档同步已完成。

### 遗留问题

- 身份网络管理页仍以单张管理面板承载设备列表和邀请二维码；设备数量较多后，可拆为“设备”“邀请”“合并记录”三个页内标签。

## 2026-08-05 - 0.28.2 我的活动反馈子页面

### 任务目标

继续减少「我的」工作台的信息密度，把“我的活动反馈”从页面内联列表拆成独立子页面。工作台只作为入口中心，反馈历史进入专门页面查看。

### 具体修改

- `my-feedbacks.html`：新增我的活动反馈独立页面，展示当前匿名身份写过的全部反馈。
- `app.js`：新增 `initMyFeedbacksPage()`、反馈行渲染和分页加载逻辑；工作台“我的反馈”卡片改为跳转 `my-feedbacks.html`。
- `me.html`：移除内嵌“我的活动反馈”区块，避免工作台同时承担入口和详情列表。
- `tests/smoke.test.js`：断言「我的」页面不再有内嵌反馈列表，并覆盖 `my-feedbacks.html` 打开、计数节点、返回路径和移动端无横向溢出。
- `scripts/visual-snapshots.js`：新增桌面和移动端我的活动反馈页面截图。
- `README.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`*.html`：同步版本和静态资源缓存参数到 `0.28.2`。

### 技术方案选择

- 复用 `/api/my/feedbacks` 的分页能力，子页面支持“加载更多”，而不是只读取前 6 条。
- 「我的」页面不再调用 `renderMyFeedbacks()`，减少开放工作台首屏 API 请求。
- 反馈历史仍按当前匿名身份 / 身份网络聚合，不改变后端数据结构。

## 2026-08-05 - 0.28.3 共同发起和个人侧加载优化

### 任务目标

让新活动在还没有手动保存时也可以开始邀请共同发起人；同时降低「我的」页面和个人侧子页面的加载等待感。

### 具体修改

- `activity-editor.html`：新增“发起协作”按钮和协作邀请结果面板。
- `app.js`：点击“发起协作”时，新活动 / 草稿会自动保存为未公开草稿，随后生成共同发起邀请并复制链接；已存在且非草稿的活动只生成邀请，避免误改活动状态。
- `activity.html` / `app.js`：共同发起团队管理迁移到活动详情页底部，支持生成邀请和移除共同发起人。
- `my-activities.html` / `app.js`：我的活动列表不再堆叠共同发起管理按钮，只展示共同发起人摘要。
- `lib/app.js`：新增 `/api/me/summary`，聚合个人资料、身份网络、工作台概览和报名预览；活动编辑锁改为 `ACTIVITY_EDIT_LOCK_TTL_MINUTES` 配置，默认 360 分钟并由前端自动续期。
- `app.js`：新增浏览器短缓存，覆盖我的工作台、个人资料、身份网络、我的活动、我的报名、我的反馈和活动编辑页基础下拉项；写操作后自动清理缓存。
- `README.md`、`CHANGELOG.md`、`.env.example`、`package.json`、`package-lock.json`、`*.html`：同步版本、环境变量和静态资源参数到 `0.28.3`。

### 技术方案选择

- 新活动发起协作需要有稳定活动 ID，因此采用“自动保存草稿壳”而不是前端临时邀请状态；草稿不公开，也不触发规则引擎或 AI。
- 邀请链接仍有有效期，但接受后共同发起权限长期有效，直到主发起人移除或活动进入终态。
- 编辑冲突继续使用抢占式软锁；取消短时体感限制，但保留后端异常过期，避免浏览器崩溃后永久锁死。
- 个人侧加载使用轻量 `stale-while-revalidate` 思路：先展示 localStorage 缓存，再后台刷新；不缓存管理员敏感列表和审核处理结果。

### 遗留问题

- 共同发起邀请暂未提供“撤销邀请”和“邀请列表”，后续可以补到活动详情页团队管理区。
- 个人侧缓存仍是轻量 localStorage 方案；如果后续离线能力增强，再考虑 Service Worker 或 IndexedDB。
