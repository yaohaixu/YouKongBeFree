# YouKongBeFree

有空客厅中文官网与活动管理系统。项目服务于重庆「有空客厅」这个弱中心化社区与共有空间，既承载公开官网内容，也提供成员登录、活动发布、访客报名和 YKadmin 后台管理能力。

## 当前开发状态

当前版本：`0.2.1`

状态：MVP 已完成，可本地运行和演示。当前实现使用 Node.js + Express + 本地 JSON 文件持久化，适合内部试用、功能验证和后续迁移到正式数据库前的产品打磨。

## 访问地址

GitHub Pages 静态官网：

- 官网首页：https://yaohaixu.github.io/YouKongBeFree/
- 登录页：https://yaohaixu.github.io/YouKongBeFree/login.html
- 后台页面：https://yaohaixu.github.io/YouKongBeFree/admin.html
- 我的页面：https://yaohaixu.github.io/YouKongBeFree/me.html

本地完整动态功能：

- 官网首页：http://127.0.0.1:8080/
- 登录页：http://127.0.0.1:8080/login.html
- 后台：http://127.0.0.1:8080/admin.html
- 我的：http://127.0.0.1:8080/me.html

重要说明：GitHub Pages 只能托管静态页面，不能运行 `server.js`。因此 GitHub Pages 上可以访问页面外观和静态内容，但登录、后台、活动发布、报名、上传图片等动态功能需要通过 `npm start` 启动 Node 服务，或部署到支持 Node.js 的平台后才能完整使用。

## 核心功能

- 中文响应式官网：首页、社区共识、活动与参与、捐赠支持、关于与联系。
- 手机号白名单登录：YKadmin 先在后台录入成员昵称和手机号，成员再用手机号登录。
- YKadmin 后台：成员新增、编辑、删除；活动模块新增、编辑、删除。
- 成员「我的」页面：发布活动、选择模块、填写标题/发起人/时间/地点/人数限额、上传封面、编写长文本活动描述。
- 活动详情页：未登录访客可填写昵称和手机号报名。
- 报名表查看：活动发起人和管理员可查看报名者列表。
- 动态活动列表：首页和活动页读取已发布活动。

## 技术栈

- 前端：HTML、CSS、Vanilla JavaScript
- 后端：Node.js、Express
- 文件上传：Multer
- 登录态：HTTP-only Cookie Session
- 配置：dotenv
- 当前数据存储：本地 JSON 文件 `data/youkong-db.json`
- 测试验证：Playwright / `@playwright/test`

## 项目目录结构

```text
.
├── index.html              # 官网首页
├── whitepaper.html         # 社区共识 / 白皮书页面
├── participate.html        # 活动与参与页面
├── donate.html             # 捐赠支持页面
├── about.html              # 关于与联系页面
├── login.html              # 成员登录页面
├── me.html                 # 成员我的页面：发布活动、查看报名表
├── admin.html              # YKadmin 后台
├── activity.html           # 活动详情与报名页面
├── styles.css              # 全站样式
├── script.js               # 官网导航、复制、滚动动效
├── app.js                  # 登录态、活动、报名、后台交互逻辑
├── server.js               # Express API 与静态资源服务
├── assets/                 # 官网图片与图标
├── data/
│   └── example-db.json     # 示例数据结构，真实运行数据不提交 Git
├── uploads/
│   └── .gitkeep            # 上传目录占位，真实上传文件不提交 Git
├── docs/
│   └── dev-log.md          # 开发日志
├── package.json
├── package-lock.json
├── .env.example
└── .gitignore
```

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
YKADMIN_NICKNAME=YKadmin
YKADMIN_PHONE=18800000000
```

注意：

- `.env` 不允许提交到 Git。
- 如果 `data/youkong-db.json` 不存在，服务启动时会根据环境变量创建默认管理员和默认模块。
- 真实成员手机号、报名记录、活动数据都存放在 `data/youkong-db.json`，该文件已被 `.gitignore` 忽略。

## 运行方式

```bash
npm start
```

本地默认访问：

- 官网首页：http://127.0.0.1:8080/
- 登录页：http://127.0.0.1:8080/login.html
- 后台：http://127.0.0.1:8080/admin.html
- 我的：http://127.0.0.1:8080/me.html

默认管理员：

- 昵称：`YKadmin`
- 手机号：`18800000000`

## 已完成功能

- 官网五个公开页面及响应式视觉设计。
- 登录入口：右上角「有空」和左上角圆形「有空」均可进入登录/我的入口。
- 管理员登录后自动进入后台。
- 成员登录后自动进入「我的」。
- YKadmin 成员管理。
- YKadmin 活动模块管理。
- 成员活动发布。
- 活动详情页和访客报名。
- 发起人查看自己活动报名表。
- 首页和活动页动态读取活动列表。
- 基础工程规范：`.gitignore`、环境变量示例、README、CHANGELOG、开发日志。

## 正在开发 / 待完善

- 生产级数据库迁移：SQLite、PostgreSQL、Supabase 或其他托管数据库。
- 短信验证码或密码机制，替代当前手机号白名单免密登录。
- 活动编辑、下架、取消、删除。
- 报名取消、报名导出 CSV。
- 富文本编辑器和图片排版能力。
- 管理员仪表盘统计。
- 自动化测试脚本与 CI。
- 部署流程与线上备份策略。

## 未来规划

- 引入正式身份验证，支持验证码、密码或微信登录。
- 将本地 JSON 存储迁移到数据库，补充数据迁移脚本。
- 支持活动审核流和更细权限模型。
- 支持 Notion / 飞书表格同步活动日历。
- 增加财务公示模块和捐赠记录管理。
- 建立 CI 流程，在 dev 合并 main 前自动检查语法、测试和敏感文件。

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

Commit 类型：

- `feat`：新增功能
- `fix`：修复问题
- `refactor`：代码重构
- `style`：样式调整
- `docs`：文档修改
- `test`：测试相关
- `chore`：工程配置修改

## 新 Agent 接手须知

接手项目前必须先阅读：

1. `README.md`
2. `CHANGELOG.md`
3. `docs/dev-log.md`
4. `git log --oneline --decorate --graph --all`

然后再开始修改代码。修改前后都必须检查 Git 状态，避免污染稳定分支或提交运行时数据。
