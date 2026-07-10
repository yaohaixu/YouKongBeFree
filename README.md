# YouKongBeFree

有空客厅中文官网与活动管理系统。项目服务于重庆「有空客厅」这个弱中心化社区与共有空间，既承载公开官网内容，也提供成员登录、活动发布、访客报名和 YKadmin 后台管理能力。

## 当前开发状态

当前版本：`0.5.0`

状态：`0.5.0` 已完成开发、本地验证与 CloudBase 线上部署。本版本将「我的」和 YKadmin 后台从长列表重构为入口型工作台，并把活动、成员、模块、审核等高增长数据拆到独立子页面管理。

## 访问地址

CloudBase 动态线上站点：

- 官网首页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/
- 登录页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/login.html
- 后台：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin.html
- 我的：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/me.html
- 发起活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activity-editor.html
- 我的活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/my-activities.html
- 审核待办：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/review-tasks.html
- 全部活动管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-activities.html
- 成员管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-members.html
- 模块管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-modules.html
- API 服务：https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api

GitHub Pages 静态展示：

- https://yaohaixu.github.io/YouKongBeFree/

重要说明：GitHub Pages 只能托管静态页面，不能运行登录、后台、活动发布和报名接口。完整动态功能以 CloudBase 地址为准。

## 核心功能

- 中文响应式官网：首页、社区共识、活动与参与、捐赠支持、关于与联系。
- 手机号白名单登录：YKadmin 先在后台录入成员昵称和手机号，成员再用手机号登录。
- YKadmin 后台：入口型工作台；全部活动、成员管理、模块管理、审核待办拆分为独立子页面。
- YKadmin 子页面：成员新增、编辑、删除；成员/协作员角色多选；活动模块新增、编辑、删除；管理员待办审核；按关键词、模块、状态、时间、报名数筛选全部活动。
- 成员「我的」工作台：只保留概览和入口卡片，发起活动、我的活动、审核待办进入独立页面处理。
- 成员活动管理：保存活动草稿、选择协作员、提交活动审核、查看自己活动状态、撤回活动、查看报名表。
- 普通成员只看到发起活动和自己活动管理；协作员才会看到自己的审核待办。
- 活动双岗审核：管理员通过后进入协作员审核，协作员通过后公开发布；任一岗位可退回，拒绝后不可编辑。
- 审核待办详情支持查看活动描述、审核记录和上传封面图。
- 活动详情页：公开发布活动支持未登录访客填写昵称和手机号报名；重复报名会直接返回原报名确认页；草稿和审核中活动不开放报名。
- 报名成功页：展示活动和报名人信息，并支持访客取消报名。
- 报名表查看：活动发起人和管理员可查看报名者列表。
- 动态活动列表：首页和活动页读取已发布活动。
- 全站管理操作提供轻提示反馈，删除类操作需要确认弹窗。
- 视觉体验：Apple 风格浅色系统界面、玻璃导航、统一圆角卡片、Apple 蓝主按钮、1200px 左右内容最大宽度、自适应左右留白、移动端单列布局、卡片 hover 和动态内容进入动效。
- 安全加固：API 安全响应头、静态页 HTML CSP、CORS 白名单、非 GET API 安全校验头、登录和写操作限流、Session 哈希存储和过期、上传图片白名单、手机号和文本长度校验。
- CloudBase NoSQL 落库与 CloudBase Storage 活动封面存储。

## 技术栈

- 前端：HTML、CSS、Vanilla JavaScript
- 本地后端：Node.js、Express
- 云端后端：CloudBase 云函数 + `serverless-http`
- 数据存储：本地 JSON 或 CloudBase NoSQL
- 文件上传：Multer；线上封面上传至 CloudBase Storage
- 登录态：HTTP-only Cookie Session + 前端 Bearer token 兜底，改善移动端跨域 Cookie 兼容性
- 配置：dotenv、CloudBase CLI、`cloudbaserc.json`
- 测试验证：curl API 冒烟、Playwright 浏览器登录验证

## 项目目录结构

```text
.
├── index.html              # 官网首页
├── whitepaper.html         # 社区共识 / 白皮书页面
├── participate.html        # 活动与参与页面
├── donate.html             # 捐赠支持页面
├── about.html              # 关于与联系页面
├── login.html              # 成员登录页面
├── me.html                 # 成员工作台：概览和入口卡片
├── activity-editor.html    # 发起 / 编辑活动页面
├── my-activities.html      # 我发起的活动：筛选、撤回、报名表
├── review-tasks.html       # 管理员 / 协作员审核待办
├── admin.html              # YKadmin 工作台：管理入口
├── admin-activities.html   # 全部活动管理与筛选
├── admin-members.html      # 成员管理
├── admin-modules.html      # 活动模块管理
├── activity.html           # 活动详情与报名页面
├── styles.css              # 全站样式
├── script.js               # 官网导航、复制、滚动动效
├── app.js                  # 登录态、活动、报名、后台交互逻辑
├── server.js               # 本地 Express 启动入口
├── lib/
│   ├── app.js              # Express 应用与 API 路由
│   └── store.js            # JSON / CloudBase 双存储实现
├── scripts/
│   ├── build-static.js     # 生成 CloudBase Hosting 静态目录
│   └── build-function.js   # 生成 CloudBase 云函数部署包
├── assets/                 # 官网图片与图标
├── data/
│   └── example-db.json     # 示例数据结构，真实运行数据不提交 Git
├── uploads/
│   └── .gitkeep            # 本地上传目录占位，真实上传文件不提交 Git
├── docs/
│   ├── dev-log.md          # 开发日志
│   └── security.md         # 安全控制和遗留风险说明
├── cloudbaserc.json        # CloudBase 环境与云函数配置
├── package.json
├── package-lock.json
├── .env.example
└── .gitignore
```

`dist/`、`tmp/` 和 `output/` 是构建或本地验证产物，已被 `.gitignore` 忽略，不提交 Git。

## 安装方式

```bash
npm install
```

## 环境变量配置

复制环境变量示例：

```bash
cp .env.example .env
```

可配置项：

```env
PORT=8080
YKADMIN_NICKNAME=有空管理员
YKADMIN_PHONE=13377779999
STORE_DRIVER=json
CLOUDBASE_ENV_ID=youkong-d5gh4x0ayc29a2187
CORS_ORIGINS=https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com
SESSION_MAX_AGE_DAYS=14
YK_DB_FILE=
```

注意：

- `.env` 不允许提交到 Git。
- 本地默认使用 `STORE_DRIVER=json`，数据写入 `data/youkong-db.json`。
- 云端使用 `STORE_DRIVER=cloudbase`，数据写入 CloudBase NoSQL 集合：`yk_users`、`yk_modules`、`yk_activities`、`yk_registrations`、`yk_sessions`。
- `CORS_ORIGINS` 用英文逗号分隔允许跨域访问 API 的前端域名；`SESSION_MAX_AGE_DAYS` 会被限制在 1 到 30 天之间。
- 如果数据不存在，服务会初始化默认管理员和默认活动模块。

## 运行方式

本地运行：

```bash
npm start
```

本地默认访问：

- 官网首页：http://127.0.0.1:8080/
- 登录页：http://127.0.0.1:8080/login.html
- 后台：http://127.0.0.1:8080/admin.html
- 我的：http://127.0.0.1:8080/me.html

默认管理员：

- 昵称：`有空管理员`
- 手机号：`13377779999`

## CloudBase 部署

当前 CloudBase 环境：`youkong-d5gh4x0ayc29a2187`

构建静态站点和云函数包：

```bash
npm run build:cloudbase
```

部署静态站点：

```bash
npm run deploy:static
```

部署动态 API 云函数：

```bash
npm run deploy:function
```

完整部署：

```bash
npm run deploy:cloudbase
```

部署结构：

- 静态页面通过 CloudBase Hosting 托管。
- 动态接口通过 HTTP 访问服务 `/api` 绑定云函数 `youkongApi`。
- 云函数使用 `serverless-http` 复用 Express API。
- 活动封面在云端写入 CloudBase Storage，本地仍写入 `uploads/`。

## 已完成功能

- 官网五个公开页面及 Apple 风格响应式视觉设计。
- 登录入口：右上角「有空」和左上角圆形「有空」均可进入登录/我的入口。
- 管理员登录后自动进入后台。
- 成员登录后自动进入「我的」。
- YKadmin 工作台入口卡片。
- YKadmin 全部活动独立管理页，支持关键词、模块、状态、时间和排序筛选。
- YKadmin 成员管理独立页。
- YKadmin 活动模块管理独立页。
- 成员工作台入口卡片。
- 发起活动独立编辑页。
- 我发起的活动独立管理页，支持筛选、撤回和报名表查看。
- 审核待办独立页，管理员和协作员按自己的待办进入。
- 成员活动草稿、提审、编辑退回活动。
- 双岗审核流：管理员审核、协作员审核、通过/退回/拒绝。
- 发起人查看审核状态：草稿、审核中、退回、拒绝、活动发布、活动人满、活动取消、活动结束。
- 发起人可撤回审核中、已发布、已满员活动，撤回后回到草稿。
- 活动详情页和访客报名。
- 重复报名自动进入已有报名确认页。
- 报名成功后进入确认页，展示活动信息、报名昵称和手机号，并可取消报名。
- 发起人查看自己活动报名表，并可删除报名记录。
- 管理员查看系统内所有人、所有状态活动。
- 首页和活动页动态读取活动列表。
- CloudBase 动态部署、NoSQL 落库和 Storage 封面上传。
- 基础安全加固：CSP 等响应头、请求意图校验、限流、Session 哈希、上传白名单、输入校验和最小化手机号返回。
- 基础工程规范：`.gitignore`、环境变量示例、README、CHANGELOG、开发日志。

## 已验证

- `node --check` 通过：`app.js`、`script.js`、`server.js`、`lib/app.js`、`lib/store.js`、构建脚本。
- `npm run build:cloudbase` 通过，CloudBase 静态站点和云函数均可构建。
- 本地浏览器回归通过：`0.5.0` 管理员工作台、成员工作台、发起活动、我的活动、审核待办、全部活动、成员管理、模块管理均可打开，控制台无错误。
- 本地浏览器流程通过：普通成员不展示审核待办；发起活动提交管理员审核；管理员可查看审核详情封面并通过；协作员完成第二岗审核后活动发布；报名、重复报名找回确认页、取消报名均可用。
- 本地移动端 390px 验证通过：工作台卡片、全部活动筛选、列表和导航自然换行，无隐藏控件外露。
- 本地 JSON 模式 API 冒烟通过：草稿和审核中活动报名返回 `400`，已发布活动报名返回 `200`，满员/结束活动仍支持已报名手机号找回确认页。
- 本地 JSON 模式 API 冒烟通过：管理员登录、成员/协作员新增、草稿保存、活动提审、管理员审核、协作员审核、访客报名、重复报名、取消报名、撤回活动。
- 本地浏览器回归通过：普通成员不展示待办任务区，管理员审核待办可展开查看封面图，草稿详情页不展示报名表，保存操作出现“保存成功”轻提示。
- 本地浏览器视觉检查通过：PC 后台审核卡片、移动端活动详情报名表、移动端「我的」页面表单和按钮单列展示，无明显挤压错乱。
- CloudBase 线上 API 冒烟通过：成员/协作员新增、活动草稿、提交审核、管理员审核、协作员审核、重复报名、取消报名。
- CloudBase 静态页移动端浏览器验证通过：登录页输入 `13377779999` 后跳转 `admin.html`，后台待办区和协作员角色控件可见。
- 本地浏览器视觉检查通过：`0.4.2` 首页、社区共识、登录页、后台页 PC / 移动端布局可用，Apple 风格样式层生效，无明显内容重叠或横向溢出。
- CloudBase `0.4.2` 线上部署通过：静态页已引用 `styles.css?v=0.4.2`、`script.js?v=0.4.2`、`app.js?v=0.4.2`，线上 CSS 可查到 `--accent: #0071e3`、Apple 风格样式层和非阻塞 reveal 动效。
- CloudBase `0.4.3` 安全加固部署通过：线上静态页已引用 `v=0.4.3` 并包含 HTML CSP；线上 API 返回安全响应头；缺少安全校验头的 POST 返回 `403`。
- CloudBase `0.5.0` 工作台拆页版本部署通过：线上静态页已引用 `v=0.5.0`，新增管理子页面已进入 CloudBase Hosting 构建清单。
- 线上冒烟产生的测试成员、活动和报名记录已清理。
- GitHub 状态：`0.5.0` 按双分支流程维护，最新提交请以 `git log --oneline --decorate --graph --all` 为准。

## 正在开发 / 待完善

- 生产级身份验证：短信验证码、密码或微信登录，替代当前手机号白名单免密登录。
- 活动删除、手动取消、手动结束。
- 报名导出 CSV。
- 富文本编辑器和图片排版能力。
- 管理员仪表盘统计。
- 自动化测试脚本与 CI。
- CloudBase 数据备份、恢复和权限策略文档。
- 自定义域名和同源 API 路由，减少跨域 Cookie 运维复杂度。

## 未来规划

- 支持审核通知、审核超时提醒和更细权限模型。
- 支持 Notion / 飞书表格同步活动日历。
- 增加财务公示模块和捐赠记录管理。
- 建立 CI 流程，在 dev 合并 main 前自动检查语法、测试和敏感文件。
- 为 CloudBase NoSQL 增加数据导出和定期备份脚本。

## Git 分支规范

本项目采用双分支模式：

- `main`：稳定发布分支，只放经过测试、验证可靠的代码。
- `dev`：日常开发分支，新功能、优化、Bug 修复和实验性修改都先进入该分支。

开发流程：

1. 新任务开始前先执行 `git status --short --branch`。
2. 默认在 `dev` 分支开发。
3. 修改完成后检查 Git 状态，确认没有提交 `node_modules/`、`.env`、真实上传文件、隐私数据和临时文件。
4. 更新 README、CHANGELOG、`docs/dev-log.md`。
5. 使用规范化提交信息提交：`type(scope): description`。
6. 测试通过后，将 `dev` 合并到 `main`。
7. 推送 `dev` 和 `main` 到 GitHub。

Commit 类型：`feat`、`fix`、`refactor`、`style`、`docs`、`test`、`chore`。

## 新 Agent 接手须知

接手项目前必须先阅读：

1. `README.md`
2. `CHANGELOG.md`
3. `docs/dev-log.md`
4. `git log --oneline --decorate --graph --all`

然后再开始修改代码。修改前后都必须检查 Git 状态，避免污染稳定分支或提交运行时数据。
