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
