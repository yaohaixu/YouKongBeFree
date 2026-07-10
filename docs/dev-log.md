# 开发日志

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
- 修改 `.env.example`，默认管理员改为 `有空管理员 / 13377779999`，补充 CloudBase 配置项。
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
- Playwright 浏览器验证通过：CloudBase 静态登录页输入 `13377779999` 后跳转后台，后台内容可见。
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
