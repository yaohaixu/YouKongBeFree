# Changelog

所有重要变更都会记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循语义化版本思路。

## [0.3.0] - 2026-07-09

### Added

- 新增腾讯云 CloudBase 动态部署能力。
- 新增 CloudBase Hosting 静态站点部署脚本。
- 新增 CloudBase 云函数 `youkongApi` 部署脚本，通过 HTTP 访问服务 `/api` 提供动态接口。
- 新增 JSON / CloudBase NoSQL 双存储层 `lib/store.js`。
- 新增共享 Express 应用入口 `lib/app.js`，本地服务和云函数共用同一套路由。
- 新增 CloudBase Storage 活动封面上传能力。
- 新增构建脚本 `scripts/build-static.js` 和 `scripts/build-function.js`。
- 新增 CloudBase 配置文件 `cloudbaserc.json`。
- 新增 `serverless-http` 和 `ws` 依赖。

### Changed

- 项目版本升级至 `0.3.0`。
- 默认网站管理员调整为昵称 `有空管理员`、手机号 `13377779999`。
- 前端在 CloudBase 静态域名下自动调用 CloudBase API 服务域名。
- 云端 Cookie 使用 `SameSite=None; Secure`，支持静态域名跨域调用 API。
- README 更新为 CloudBase 动态线上版本说明。

### Fixed

- 修复云函数只读目录中创建 `uploads/` 失败的问题，云端临时目录改为 `/tmp/youkong-uploads`。
- 修复 CloudBase HTTP 访问服务会剥离 `/api` 前缀导致 Express 路由 404 的问题。
- 修复部署脚本误用 `--httpFn` 导致函数类型不匹配的问题。

### Removed

- 无。


## [0.2.1] - 2026-07-08

### Added

- 开启 GitHub Pages 静态托管说明。
- README 新增 GitHub Pages 外网访问地址。

### Changed

- README 区分 GitHub Pages 静态访问地址和本地 Node 动态功能地址。
- package 版本升级至 `0.2.1`。

### Fixed

- 明确说明 GitHub Pages 不能运行 Express 后端，避免误以为外网静态地址支持登录、后台和报名接口。

### Removed

- 无。

## [0.2.0] - 2026-07-08

### Added

- 新增 Node.js + Express 后端服务。
- 新增手机号白名单登录功能。
- 新增 YKadmin 后台，可管理成员昵称、手机号和角色。
- 新增活动模块管理功能。
- 新增成员「我的」页面，可发布活动并查看自己活动报名表。
- 新增活动详情页，支持未登录访客报名。
- 新增首页和活动页动态活动列表。
- 新增本地 JSON 数据持久化与上传目录。
- 新增环境变量配置示例 `.env.example`。
- 新增 `.gitignore`，排除依赖、环境变量、运行时数据和上传文件。
- 新增 README、CHANGELOG 和开发日志。

### Changed

- 登录后根据角色跳转：管理员进入后台，普通成员进入「我的」。
- 左上角圆形「有空」按钮改为登录/我的入口。
- 服务启动时可通过环境变量初始化默认管理员。

### Fixed

- 修复登录页面可能因 session 请求失败而无法绑定登录表单的问题。
- 修复活动描述中 `\\n` 字符不能正确换行展示的问题。

### Removed

- 无。

## [0.1.0] - 2026-07-08

### Added

- 初版有空客厅中文官网。
- 首页、社区共识、活动与参与、捐赠支持、关于与联系页面。
- 响应式黑白克制视觉风格。
- 滚动 reveal、按钮 hover、照片 hover 等轻量动效。

### Changed

- 将早期纸张感视觉调整为更接近 Vercel / Linear 的清爽布局。

### Fixed

- 修复 PC 和移动端标题过大、排版混乱、首屏动画白屏感等问题。

### Removed

- 无。
