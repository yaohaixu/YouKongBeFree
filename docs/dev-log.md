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
