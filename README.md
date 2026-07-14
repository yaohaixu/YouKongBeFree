# YouKongBeFree

有空客厅中文官网与活动管理系统。项目服务于重庆「有空客厅」这个弱中心化社区与共有空间，既承载公开官网内容，也提供成员登录、活动发布、访客报名和 YKadmin 后台管理能力。

## 当前开发状态

当前版本：`0.16.1`

状态：`0.16.1` 增加活动发起人联系方式展示开关，并重做分享海报：完整封面、诚邀昵称、报名手机号、地址日期分行和右下角活动二维码。

## 访问地址

CloudBase 动态线上站点：

- 官网首页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/
- 登录页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/login.html
- 后台：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin.html
- 我的：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/me.html
- 近期活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activities.html
- 历史活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activities.html?view=history
- 发起活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activity-editor.html
- 我的活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/my-activities.html
- 审核待办：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/review-tasks.html
- 全部活动管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-activities.html
- 成员管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-members.html
- 模块管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-modules.html
- 活动模板：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-templates.html
- 新增活动模板：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-template-editor.html
- 报名表：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/registrations.html
- 操作日志：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-logs.html
- API 服务：https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api

GitHub Pages 静态展示：

- https://yaohaixu.github.io/YouKongBeFree/

重要说明：GitHub Pages 只能托管静态页面，不能运行登录、后台、活动发布和报名接口。完整动态功能以 CloudBase 地址为准。

## 核心功能

- 中文响应式官网：首页、社区共识、活动与参与、捐赠支持、关于与联系。
- 手机号白名单登录：YKadmin 先在后台录入成员昵称和手机号，成员再用手机号登录。
- YKadmin 后台：入口型工作台；全部活动、成员管理、模块管理、审核待办拆分为独立子页面。
- YKadmin 子页面：成员新增、编辑、删除；成员/协作员角色单选；活动模块新增、编辑、删除；活动描述模板新增、编辑、删除；管理员待办审核；按关键词、模块、状态、时间、报名数筛选全部活动。
- YKadmin 活动管理：可查看全部状态活动，可取消或结束活动，可进入独立报名表页面。
- YKadmin 操作日志：记录登录、退出、新增、保存、删除、提交、审核、退回、拒绝、撤回、报名、取消报名、删除报名、取消活动、结束活动和自动归档等关键动作，支持关键词、操作类型、操作人、角色、日期范围筛选和分页加载；日志手机号脱敏保存，仅保留最近 30 天。
- 成员「我的」工作台：待办任务置顶，入口卡片作为主操作区，工作台概览放在底部；概览卡片可点击进入我发起的活动、草稿、审核中和已发布筛选页；发起活动、我的活动、审核待办进入独立页面处理。
- 成员活动管理：保存活动草稿、选择协作员、提交活动审核、查看自己活动状态、撤回活动、查看独立报名表。
- 活动发起人联系方式：发起活动页可选择是否展示发起人联系方式；选择展示时默认带出登录手机号，也可改成其他联系方式；公开活动详情页仅在选择展示时显示。
- 活动富文本编辑：发起活动页提供轻量富文本工具栏，支持正文段落、一级/二级/三级标题、加粗、引用、列表、分隔线和正文图片插入；正文图片可选择 10MB 以内原图，浏览器会压缩到约 1MB 后上传，图片保存为稳定代理链接，图片标签不计入 50000 字描述上限；服务端会对白名单标签做二次清洗。
- 活动描述模板：YKadmin 可维护常用活动描述模板；模板列表页负责搜索、编辑入口和删除，新增 / 编辑进入独立详情页；成员发起活动时默认「无，自己写」，选择模板只覆盖活动描述，若已有正文会先确认是否覆盖。
- 普通成员只看到发起活动和自己活动管理；协作员才会看到自己的审核待办。
- 活动双岗审核：管理员通过后进入协作员审核，协作员通过后公开发布；任一岗位可退回，拒绝后不可编辑。
- 审核待办详情支持查看活动描述、正文图片、审核记录和上传封面图；审核意见默认「请选择」，审核意见与备注区放在活动详情之后，桌面横向排列、移动端单列排列。
- 活动人数限制：发起活动时人数限额留空默认 99 人，最大 99 人。
- 活动详情页：公开发布活动支持未登录访客填写昵称和手机号报名；重复报名会直接返回原报名确认页；草稿和审核中活动不开放报名；同一活动报名写入按活动维度串行化，降低并发超员风险；活动详情支持生成分享海报、复制报名链接和下载 `.ics` 日历文件。
- 分享海报：完整展示活动封面，不裁切长图；海报包含「模块丨标题」、发起人、诚邀昵称、报名手机号、地址、日期和右下角活动二维码；地点为空或仅为「有空客厅」时默认展示「有空客厅|江北劳动一村」。报名成功页也可下载带报名人信息的分享海报。
- 活动时间：活动必须填写开始时间，可选填写结束时间；列表、详情、报名确认页会展示起止时间。
- 活动自动结束：系统按北京时间判断活动结束日期；若填写结束时间则以结束时间为准，否则沿用活动日期次日 0 点归档。已发布 / 已满员活动归档后从首页和近期活动列表移除；管理员可手动触发一次归档扫描。
- 独立活动列表页：首页最多展示 3 条近期活动，并在首页近期活动说明后横向排列；`activities.html` 展示所有近期活动，`activities.html?view=history` 展示历史活动。
- 报名成功页：展示活动和报名人信息，并支持访客取消报名。
- 报名表查看：活动发起人和管理员可在独立页面查看报名者列表、删除报名记录，并导出 CSV。
- 动态活动列表：首页读取最多 3 条近期活动，独立活动页支持近期 / 历史视图。
- 筛选与分页：活动、成员、模块、日志列表只在点击「筛选」后查询，API 按页返回数据，加载更多请求下一页。
- 全站管理操作提供轻提示反馈，删除类操作需要确认弹窗。
- 视觉体验：公开页支持白天 / 黑夜 / 跟随系统主题切换；黑夜模式保留艺术网站式深色展场、真实照片主视觉、图片拼贴、公告栏式活动模块、砖红主按钮、指针聚光、图片浮动和滚动入场动效；后台和成员工作台同样支持主题切换，工作台与中间页 Hero 使用统一背景图遮罩，并保持清晰表单和稳定移动端单列布局。
- 全站辅助入口：顶部导航栏固定展示，品牌右侧提供单图标三态主题切换键；主题按钮采用 SVG 图标、圆形高质感表面和轻量状态动效；深度滚动后显示浮动「首页」按钮，方便快速回到官网首页且避免遮挡首屏表单。
- 首页主视觉：首页 Hero 背景使用用户提供的新图 `assets/youkong-hero-illustration.png`，右侧内容图继续使用不含旧标识信息的饭桌现场图。
- 内容清理：公开站点已移除旧标识相关文案与图片素材，公开视觉统一使用不含旧标识信息的饭桌现场图。
- 安全加固：API 安全响应头、静态页 HTML CSP、CORS 白名单、非 GET API 安全校验头、登录和写操作限流、活动操作细粒度限流、Session 哈希存储、过期清理、上传图片白名单、手机号和文本长度校验、日志手机号脱敏。
- 运维能力：提供 `npm run backup:data` 数据备份脚本；API 慢请求和 5xx 错误会输出到本地 / CloudBase 云函数日志；`npm run deploy:dry-run` 可检查 CloudBase 构建产物；运维手册集中记录备份、慢接口和索引检查流程。
- CloudBase NoSQL 落库与 CloudBase Storage 活动封面 / 富文本正文图片存储。

## 技术栈

- 前端：HTML、CSS、Vanilla JavaScript；富文本编辑器和活动分享能力已拆到 `assets/js/`
- 本地后端：Node.js、Express
- 云端后端：CloudBase 云函数 + `serverless-http`
- 数据存储：本地 JSON 或 CloudBase NoSQL
- 查询分页：本地 JSON 模拟查询；CloudBase 使用 `where`、`orderBy`、`skip`、`limit` 和 `count`
- 活动归档：Express 启动定时轮询 + 公开活动列表请求前兜底 sweep；CloudBase 云函数入口按节流策略执行 sweep
- 操作日志：写入和查询时自动清理 30 天前日志，管理员日志页只查询保留期内记录
- API 诊断：慢请求 / 5xx 响应写入服务端日志，默认阈值 1200ms
- 数据备份：`scripts/backup-data.js` 导出 JSON 备份，默认不导出 sessions
- 报名一致性：活动维度写入锁 + 幂等报名 ID + 报名数统一同步函数
- 文件上传：Multer；线上封面和正文图片上传至 CloudBase Storage，正文图片通过 `/api/files?fileId=...` 代理获取最新临时访问地址
- 登录态：HTTP-only Cookie Session + 前端 Bearer token 兜底，改善移动端跨域 Cookie 兼容性
- 配置：dotenv、CloudBase CLI、`cloudbaserc.json`
- 测试验证：`npm test` 自动运行语法检查、Node API 冒烟和 Playwright 浏览器布局 / 流程验证；`npm run test:visual` 生成关键页面视觉截图
- CI：GitHub Actions 在 `dev` / `main` push 和 PR 时运行 `npm ci`、`npm test`、`npm run deploy:dry-run` 和视觉截图 artifact 上传
- 依赖锁定：`package-lock.json` 使用官方 npm registry 的 tarball 地址，并避免锁定不存在的依赖版本

## 项目目录结构

```text
.
├── index.html              # 官网首页
├── whitepaper.html         # 社区共识 / 白皮书页面
├── activities.html         # 近期 / 历史活动列表页面
├── participate.html        # 活动与参与页面
├── donate.html             # 捐赠支持页面
├── about.html              # 关于与联系页面
├── login.html              # 成员登录页面
├── me.html                 # 成员工作台：概览和入口卡片
├── activity-editor.html    # 发起 / 编辑活动页面
├── my-activities.html      # 我发起的活动：筛选、撤回、报名表
├── registrations.html      # 活动报名表详情与 CSV 导出
├── review-tasks.html       # 管理员 / 协作员审核待办
├── admin.html              # YKadmin 工作台：管理入口
├── admin-activities.html   # 全部活动管理与筛选
├── admin-members.html      # 成员管理
├── admin-modules.html      # 活动模块管理
├── admin-templates.html    # 活动描述模板管理
├── admin-template-editor.html # 新增 / 编辑活动描述模板
├── admin-logs.html         # 管理员操作日志
├── activity.html           # 活动详情与报名页面
├── success.html            # 报名成功 / 确认页面
├── styles.css              # 全站样式
├── script.js               # 官网导航、复制、滚动动效
├── app.js                  # 登录态、活动、报名、后台交互逻辑
├── server.js               # 本地 Express 启动入口
├── lib/
│   ├── app.js              # Express 应用与 API 路由
│   ├── rich-text.js        # 活动富文本服务端白名单清洗
│   ├── routes/
│   │   └── logs.js         # 操作日志 API 路由
│   └── store.js            # JSON / CloudBase 双存储实现
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions 测试与构建流程
├── tests/
│   └── smoke.test.js       # API + Playwright 浏览器冒烟测试
├── scripts/
│   ├── build-static.js     # 生成 CloudBase Hosting 静态目录
│   ├── build-function.js   # 生成 CloudBase 云函数部署包
│   ├── backup-data.js      # 导出本地 / CloudBase 数据备份
│   ├── verify-cloudbase-package.js # CloudBase dry-run 产物检查
│   └── visual-snapshots.js # Playwright 关键页面视觉截图
├── assets/                 # 官网图片、图标和前端功能模块
│   └── js/
│       ├── rich-editor.js  # 活动富文本编辑器
│       └── activity-share.js # 活动详情分享、海报和日历
├── data/
│   └── example-db.json     # 示例数据结构，真实运行数据不提交 Git
├── uploads/
│   └── .gitkeep            # 本地上传目录占位，真实上传文件不提交 Git
├── docs/
│   ├── dev-log.md          # 开发日志
│   ├── cloudbase-indexes.md # CloudBase 查询字段和推荐索引
│   ├── operations.md       # 备份、慢请求日志和索引检查运维手册
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
ACTIVITY_AUTO_END_INTERVAL_MS=900000
ACTIVITY_AUTO_END_MIN_SWEEP_MS=60000
DISABLE_ACTIVITY_AUTO_END=false
API_TIMING_LOGS=true
API_SLOW_LOG_MS=1200
YK_DB_FILE=
```

注意：

- `.env` 不允许提交到 Git。
- 本地默认使用 `STORE_DRIVER=json`，数据写入 `data/youkong-db.json`。
- 云端使用 `STORE_DRIVER=cloudbase`，数据写入 CloudBase NoSQL 集合：`yk_users`、`yk_modules`、`yk_templates`、`yk_activities`、`yk_registrations`、`yk_sessions`、`yk_logs`。
- `CORS_ORIGINS` 用英文逗号分隔允许跨域访问 API 的前端域名；`SESSION_MAX_AGE_DAYS` 会被限制在 1 到 30 天之间。
- `ACTIVITY_AUTO_END_INTERVAL_MS` 控制本地 / 常驻服务的自动结束轮询间隔，默认 15 分钟；`ACTIVITY_AUTO_END_MIN_SWEEP_MS` 控制请求兜底 sweep 的最小间隔；`DISABLE_ACTIVITY_AUTO_END=true` 可关闭后台轮询。
- `API_TIMING_LOGS=false` 可关闭 API 耗时日志；`API_SLOW_LOG_MS` 控制慢请求阈值，默认 1200ms。
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

运行自动化测试：

```bash
npm test
```

测试内容包括：

- 语法检查：核心前后端脚本和构建脚本。
- API 冒烟：登录安全头、成员/协作员新增、活动模板增删改、正文图片上传、活动提审、双岗审核、富文本清洗、正文图片不计入描述长度校验、报名、重复报名、一人名额并发保护、报名表、删除报名日志、删除成员日志、取消活动日志、模板日志、日志脱敏、日志字段筛选、报名人数排序、过期活动自动归档、手动归档触发和跨天活动保留。
- Playwright 浏览器冒烟：管理员登录跳转、工作台概览卡片跳转、移动端关键页面无横向溢出、近期 / 历史活动页、活动编辑页模板下拉和 H1 工具、富文本 H1 重复点击恢复正文、粘贴文本清洗、活动模板管理页富文本编辑器、活动分享按钮、审核默认「请选择」和审核封面图 / 正文图片展示。

CloudBase 部署 dry-run：

```bash
npm run deploy:dry-run
```

生成视觉截图：

```bash
npm run test:visual
```

截图输出到 `test-results/visual/`，该目录不提交 Git；GitHub Actions 会把截图作为 artifact 上传。

数据备份：

```bash
npm run backup:data
STORE_DRIVER=cloudbase CLOUDBASE_ENV_ID=youkong-d5gh4x0ayc29a2187 npm run backup:data
```

备份默认输出到 `output/backups/`，该目录不提交 Git；默认不导出 `sessions`，需要完整排查时可使用 `npm run backup:data -- --include-sessions`。

## CloudBase 部署

当前 CloudBase 环境：`youkong-d5gh4x0ayc29a2187`

构建静态站点和云函数包：

```bash
npm run build:cloudbase
```

部署前 dry-run 检查：

```bash
npm run deploy:dry-run
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
- 活动封面和富文本正文图片在云端写入 CloudBase Storage，本地仍写入 `uploads/`。

## 已完成功能

- 官网五个公开页面及艺术化社区公共客厅风格响应式视觉设计。
- 登录入口：右上角「有空」和左上角圆形「有空」均可进入登录/我的入口。
- 管理员登录后自动进入后台。
- 成员登录后自动进入「我的」。
- YKadmin 工作台入口卡片。
- YKadmin / 成员工作台性能优化：入口卡片使用轻量 dashboard API 返回计数和待办预览，避免工作台首屏拉取完整列表。
- YKadmin 全部活动独立管理页，支持关键词、模块、状态、时间和排序筛选。
- YKadmin 成员管理独立页。
- YKadmin 活动模块管理独立页。
- YKadmin 活动描述模板管理独立页，支持模板搜索、新增、编辑、删除和富文本正文维护。
- YKadmin 操作日志独立页，支持关键词、操作类型、操作人、角色、日期范围筛选和分页加载，并仅保留最近 30 天日志。
- YKadmin 可取消或结束活动。
- 成员工作台入口卡片，工作台概览位于所有入口模块之后。
- 发起活动独立编辑页。
- 我发起的活动独立管理页，支持筛选、撤回和报名表查看。
- 活动、成员、模块和日志列表使用 API 分页；搜索条件只在点击「筛选」时生效。
- CloudBase 模式下列表查询通过存储层 `where/orderBy/skip/limit/count` 执行，避免云函数读取集合全量后再分页。
- CloudBase 模式下登录态、手机号登录和工作台概览使用字段级查询与计数，降低已登录页面首屏等待时间。
- 数据备份脚本支持本地 JSON 和 CloudBase NoSQL，默认导出成员、模块、活动模板、活动、报名和操作日志。
- API 慢请求日志支持通过 `API_SLOW_LOG_MS` 调节阈值，便于定位缺索引和慢接口。
- `npm test` 自动化冒烟流程，覆盖 API 主链路和关键移动端浏览器布局。
- 审核待办独立页，管理员和协作员按自己的待办进入。
- 成员活动草稿、提审、编辑退回活动。
- 活动富文本编辑器：支持一级/二级/三级标题、加粗、引用、列表、分隔线和正文图片；正文图片 10MB 内可选，浏览器压缩后上传，服务端白名单清洗后保存。
- 发起活动页支持选择活动描述模板，默认不套用；已有正文时选择模板会弹窗确认是否覆盖当前描述。
- 双岗审核流：管理员审核、协作员审核、通过/退回/拒绝。
- 发起人查看审核状态：草稿、审核中、退回、拒绝、活动发布、活动人满、活动取消、活动结束。
- 工作台概览卡片可点击跳转：全部、草稿、审核中、已发布分别进入对应活动筛选页。
- 发起人可撤回审核中、已发布、已满员活动，撤回后回到草稿。
- 活动详情页和访客报名。
- 活动详情页分享能力：生成分享海报、复制报名链接、下载 `.ics` 日历文件。
- 活动可选结束时间：支持跨天活动更精确归档，结束时间不能早于开始时间。
- 重复报名自动进入已有报名确认页。
- 报名成功后进入确认页，展示活动信息、报名昵称和手机号，并可取消报名。
- 发起人查看自己活动独立报名表，可删除报名记录并导出 CSV。
- 报名名额保护：活动报名、删除报名和取消报名统一维护报名数；满员活动删除报名后自动释放名额并回到可报名状态。
- 管理员查看系统内所有人、所有状态活动。
- 管理员查看操作日志。
- 首页和活动页动态读取活动列表。
- 首页近期活动区前移到「我们是谁」之前，最多展示 3 条，并在首页文案后横向排列活动纸条；首页「参加活动」和「查看所有近期活动」进入 `activities.html`。
- 独立近期 / 历史活动列表页：近期活动只展示未结束活动，历史活动展示自动归档后的「活动结束」活动。
- 活动自动结束任务：发布 / 满员活动按结束时间或活动日期自动改为「活动结束」，写入系统操作日志，并从首页和近期活动列表移除；管理员可手动触发补扫。
- CloudBase 动态部署、NoSQL 落库和 Storage 封面上传。
- 基础安全加固：CSP 等响应头、请求意图校验、限流、Session 哈希、上传白名单、输入校验、过期 session 清理、日志手机号脱敏和最小化手机号返回。
- 基础工程规范：`.gitignore`、环境变量示例、README、CHANGELOG、开发日志和 GitHub Actions CI。
- 前端功能模块拆分：富文本编辑器和活动分享能力已从主 `app.js` 拆到 `assets/js/`。
- 后端路由拆分起步：操作日志路由已拆到 `lib/routes/logs.js`。
- CI 增强：CloudBase dry-run 产物检查和 Playwright 视觉截图 artifact。
- CloudBase 查询和索引建议文档：`docs/cloudbase-indexes.md`。

## 已验证

- `0.16.1` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.16.1` Playwright 冒烟新增覆盖：发起活动页联系方式开关、公开活动详情页发起人联系方式、报名成功页下载分享海报入口、真实海报 PNG 下载和 `/api/qr` SVG 返回。
- `0.16.0` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.16.0` Playwright 冒烟覆盖：工作台概览卡片跳转筛选页、富文本 H1 开关、移动端粘贴文本清洗、活动详情正文图片、审核待办正文图片、审核意见默认「请选择」。
- `0.16.0` 移动端无横向溢出覆盖：首页、社区共识、关于与联系、工作台、我的活动筛选、发起活动、近期 / 历史活动、后台活动、成员、模板、日志和报名表。
- `0.16.0` 视觉截图通过：桌面 / 移动端首页、社区共识、关于与联系、登录、工作台、后台、审核待办、活动编辑页和活动模板页面已生成截图到 `test-results/visual/`，人工抽查无明显错位。
- `0.15.2` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.15.2` Playwright 冒烟覆盖：主题按钮必须渲染三枚 SVG 图标，默认跟随系统，单击可切换到黑夜模式。
- `0.15.2` 视觉截图通过：桌面 / 移动端首页、登录、后台和活动模板页面已生成截图到 `test-results/visual/`，主题按钮在导航栏品牌右侧稳定显示。
- `0.15.1` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.15.1` API / 浏览器冒烟覆盖：模板列表页不再内嵌新增表单，新增 / 编辑详情页富文本编辑器可挂载，活动详情页和审核待办均能渲染正文上传图片。
- `0.15.1` 视觉截图通过：桌面 / 移动端活动模板列表页和详情页已生成截图到 `test-results/visual/`，移动端详情页无明显错位或横向溢出。
- `0.15.0` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.15.0` API 冒烟覆盖：活动模板新增 / 编辑 / 删除、模板日志、正文图片上传、H1 富文本清洗、正文图片不计入 50000 字描述校验、成员读取模板和管理员 dashboard 模板计数。
- `0.15.0` Playwright 冒烟覆盖：活动编辑页模板下拉、H1 工具、活动模板管理页富文本编辑器挂载、移动端活动模板页无横向溢出。
- `0.15.0` 视觉截图通过：桌面 / 移动端活动模板管理页已生成截图到 `test-results/visual/`，人工抽查无明显错位或输入框越界。
- `node --check` 通过：`app.js`、`assets/js/rich-editor.js`、`assets/js/activity-share.js`、`script.js`、`server.js`、`lib/app.js`、`lib/store.js`、`lib/rich-text.js`、`lib/routes/logs.js`、构建脚本、备份脚本、dry-run 脚本和视觉截图脚本。
- `npm test` 通过：语法检查、隔离 JSON 数据库 API 冒烟和 Playwright 浏览器冒烟；覆盖 30 天前操作日志自动清理、工作台 dashboard 计数、富文本清洗、日志字段筛选、删除报名日志、删除成员日志、取消活动日志、活动分享按钮和待办预览。
- `npm run deploy:dry-run` 通过，CloudBase 静态站点和云函数包均可构建，并通过产物完整性和敏感文件检查。
- `npm run test:visual` 通过，已生成桌面 / 移动端首页、登录、后台和活动编辑页截图到 `test-results/visual/`。
- 本地浏览器视觉检查通过：`0.11.0` 首页、登录页、活动页、管理员工作台在 1440px 和 390px 视口下无横向溢出；登录页输入框与按钮间距正常；后台入口卡片、待办区和活动公告列表排版稳定。
- 本地浏览器视觉检查通过：`0.12.0` 首页桌面 / 手机、活动页手机、登录页手机、管理员工作台手机均无横向溢出；公开页识别为 `public-surface`，后台识别为 `product-surface`；活动页标签对比度、登录页移动端重叠、后台按钮和顶部标签可读性已修正。
- 本地浏览器视觉检查通过：`0.13.3` 首页白天 / 黑夜 / 跟随系统切换正常，顶部导航滚动到底部仍固定可见，主题切换键在首页、社区共识、活动与参与、捐赠支持、关于与联系、登录和我的页面均稳定出现在品牌右侧；白天模式 Hero 数字条、捐赠说明、联系方式、模块管理表单和按钮文字可读。
- 本地 Playwright 检查通过：`0.13.3` 成员工作台「工作台概览」位于所有入口模块之后，390px 移动端主题按钮保持可见且不会随导航重绘消失。
- 本地 Playwright 检查通过：`0.13.3` 主题按钮在系统、黑夜、白天三种模式下仅显示当前图标，图标居中且无上一状态残影。
- 本地 API 冒烟通过：`0.13.4` 新增 `/api/dashboard/me` 和 `/api/dashboard/admin`，可返回工作台计数、待办总数和少量待办预览，成员工作台不再依赖完整活动列表加载入口卡片。
- 本地 CI 依赖安装验证通过：`npm ci --registry=https://registry.npmjs.org` 可成功安装依赖，避免 GitHub Actions 因不存在的 `retry@0.13.3` tarball 失败。
- 本地数据备份验证通过：`npm run backup:data -- --out tmp/backup-test.json --include-sessions` 可生成 JSON 备份。
- 本地浏览器回归通过：`0.6.0` 管理员工作台、成员工作台、发起活动、我的活动、审核待办、全部活动、成员管理、模块管理、报名表、操作日志均可打开，控制台无错误。
- 本地浏览器流程通过：普通成员不展示审核待办；发起活动提交管理员审核；管理员可查看审核详情封面并通过；协作员完成第二岗审核后活动发布；报名、重复报名找回确认页、取消报名均可用。
- 本地移动端 390px 验证通过：工作台卡片、全部活动筛选、列表和导航自然换行，无隐藏控件外露。
- 本地 JSON 模式 API 冒烟通过：草稿和审核中活动报名返回 `400`，已发布活动报名返回 `200`，满员/结束活动仍支持已报名手机号找回确认页。
- 本地 JSON 模式 API 冒烟通过：管理员登录、成员/协作员新增、草稿保存、活动提审、管理员审核、协作员审核、访客报名、重复报名、取消报名、撤回活动。
- 本地浏览器回归通过：普通成员不展示待办任务区，管理员审核待办可展开查看封面图，草稿详情页不展示报名表，保存操作出现“保存成功”轻提示。
- 本地浏览器视觉检查通过：PC 后台审核卡片、移动端活动详情报名表、移动端「我的」页面表单和按钮单列展示，无明显挤压错乱。
- 本地 JSON 模式 API 冒烟通过：默认人数 99、服务端分页、两岗审核、重复报名找回确认页、独立报名表、操作日志搜索、管理员结束活动。
- 本地 Playwright 移动端验证通过：390px 下发起活动时间字段、全部活动开始/结束日期筛选、成员管理角色下拉、报名表和操作日志页面均无横向溢出。
- 本地 Playwright 审核待办验证通过：审核意见默认「请选择」，上传封面图可在待办详情中查看。
- CloudBase 线上 API 冒烟通过：成员/协作员新增、活动草稿、提交审核、管理员审核、协作员审核、重复报名、取消报名。
- CloudBase 静态页移动端浏览器验证通过：登录页输入 `13377779999` 后跳转 `admin.html`，后台待办区和协作员角色控件可见。
- 本地浏览器视觉检查通过：`0.4.2` 首页、社区共识、登录页、后台页 PC / 移动端布局可用，Apple 风格样式层生效，无明显内容重叠或横向溢出。
- CloudBase `0.4.2` 线上部署通过：静态页已引用 `styles.css?v=0.4.2`、`script.js?v=0.4.2`、`app.js?v=0.4.2`，线上 CSS 可查到 `--accent: #0071e3`、Apple 风格样式层和非阻塞 reveal 动效。
- CloudBase `0.4.3` 安全加固部署通过：线上静态页已引用 `v=0.4.3` 并包含 HTML CSP；线上 API 返回安全响应头；缺少安全校验头的 POST 返回 `403`。
- CloudBase `0.5.0` 工作台拆页版本部署通过：线上静态页已引用 `v=0.5.0`，新增管理子页面已进入 CloudBase Hosting 构建清单。
- CloudBase `0.6.0` 报名表与操作日志版本部署通过：静态托管上传 28 个文件，`registrations.html` 和 `admin-logs.html` 可访问，线上 HTML / JS / CSS 已引用 `v=0.6.0`，线上 `/api/session` 返回 `200` 和安全响应头。
- CloudBase `0.7.0` 查询层与测试版本部署通过：静态托管上传 28 个文件，云函数 `youkongApi` 部署成功；线上成员、模块、活动、日志分页查询均返回正确 `pageInfo`。
- CloudBase `0.8.0` 活动归档与列表页版本部署通过：静态托管上传 29 个文件，`activities.html` 可访问，首页和活动页已引用 `v=0.8.0`；线上 `/api/activities?view=upcoming` 和 `/api/activities?view=history` 均返回正确 `pageInfo`。
- CloudBase `0.9.0` 结束时间与 CI 版本部署通过：静态托管上传 29 个文件，云函数 `youkongApi` 部署成功；线上 `activity-editor.html` 已引用 `v=0.9.0` 并包含 `endsAt` 字段，线上 `app.js` 已包含 `formatActivityTime` 和 `activity.endsAt` 逻辑，线上近期活动 API 返回正确 `pageInfo`。
- CloudBase `0.10.0` 报名保护与安全日志版本部署通过：静态托管上传 29 个文件，云函数 `youkongApi` 部署成功；线上 `index.html` 已引用 `v=0.10.0`，近期活动 API 返回正确 `pageInfo`，手动归档接口未登录返回 `403`。
- CloudBase `0.13.4` 工作台性能优化版本部署通过：静态托管上传 28 个文件，云函数 `youkongApi` 部署成功；线上 `index.html` 已引用 `v=0.13.4`，线上 `app.js` 已包含 `/api/dashboard/me` 调用，管理员 dashboard API 返回活动、成员、模块和待办计数。
- CloudBase `0.13.5` 运维增强版本部署通过：静态托管上传 28 个文件，云函数 `youkongApi` 部署成功；线上 `/api/session`、管理员登录和 `/api/dashboard/admin` 冒烟通过。
- CloudBase `0.14.0` 活动运营增强版本部署通过：静态托管上传 30 个文件，云函数 `youkongApi` 部署成功；线上 `activity-editor.html` 已引用 `rich-editor.js?v=0.14.0`，`activity.html` 已引用 `activity-share.js?v=0.14.0`，线上 `/api/session`、管理员登录、`/api/dashboard/admin` 和 `/api/logs?action=login` 冒烟通过。
- CloudBase `0.15.0` 活动模板版本部署通过：静态托管上传 31 个文件，云函数 `youkongApi` 部署成功；线上 `activity-editor.html` 已引用 `rich-editor.js?v=0.15.0` 并包含活动描述模板下拉，`admin-templates.html` 可访问，线上 `/api/session`、管理员登录、`/api/dashboard/admin` 模板计数和 `/api/templates?page=1&pageSize=1` 冒烟通过。
- CloudBase `0.15.1` 模板详情页与正文图修复版本部署通过：静态托管上传 32 个文件，云函数 `youkongApi` 部署成功；线上 `admin-templates.html` 已只保留列表和新增入口，`admin-template-editor.html` 可访问且引用 `v=0.15.1`；线上正文图片上传返回 `/api/files?fileId=...` 稳定代理链接，代理链接返回 302 到 CloudBase 临时图片地址；线上测试模板已创建后删除。
- 线上冒烟产生的测试成员、活动和报名记录已清理。
- GitHub 状态：项目按 `dev` / `main` 双分支维护；最新提交和分支状态请以 `git status --short --branch` 与 `git log --oneline --decorate --graph --all` 为准。

## 正在开发 / 待完善

- 生产级身份验证：短信验证码、密码或微信登录，替代当前手机号白名单免密登录。
- 管理员仪表盘统计。
- CloudBase 恢复演练和权限策略文档。
- CloudBase 控制台建议补充 `yk_sessions.tokenHash`、`yk_users.phone`、`yk_templates.updatedAt + createdAt`、`yk_logs.action + createdAt`、`yk_logs.actorId + createdAt` 等字段索引，保证登录态、工作台、模板管理和日志筛选随数据量增长仍保持稳定。
- 自定义域名和同源 API 路由，减少跨域 Cookie 运维复杂度。
- 继续拆分后端路由：优先迁移 auth、activities、users、modules，并逐步补 JSDoc / TypeScript 类型边界。
- 如报名量继续增大，需要把当前进程内活动报名锁升级为数据库事务、唯一索引或队列型全局锁。

## 未来规划

- 支持审核通知、审核超时提醒和更细权限模型。
- 支持 Notion / 飞书表格同步活动日历。
- 增加财务公示模块和捐赠记录管理。
- 为 CloudBase NoSQL 增加受控恢复脚本和定期备份自动化。

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
