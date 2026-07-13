# 安全说明

本项目当前是社区活动系统 MVP，安全目标是保护后台管理、成员手机号、活动报名数据和上传文件，同时保持轻量可维护。

## 已有安全控制

- API CORS 白名单只允许配置中的站点携带凭据访问，默认只允许 CloudBase Hosting 域名。
- 所有非 GET API 请求必须带 `X-Requested-With: XMLHttpRequest`，降低跨站表单提交带来的 CSRF 风险。
- 登录和写操作有内存级限流：登录按 IP 和手机号双维度限制，报名和普通写操作也按 IP 限制。
- 活动创建、编辑、审核、撤回、取消和结束有成员级细粒度限流，避免单个账号短时间批量写入。
- Session Cookie 使用 `HttpOnly`，CloudBase 环境使用 `Secure` 和 `SameSite=None`；服务端只保存 token 哈希，并设置过期时间。
- 登录和服务启动会清理过期 session，降低旧登录态长期留存在存储中的风险。
- API 和本地 Express 静态服务返回安全响应头：CSP、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`，HTTPS 环境返回 HSTS。
- CloudBase Hosting 静态页补充 HTML `Content-Security-Policy` meta 和 referrer meta，提供基础浏览器侧约束。
- 上传封面只允许 JPG、PNG、WebP、GIF，单文件最大 6MB，拒绝 SVG、HTML 和脚本类文件。
- 富文本正文图片需先在浏览器压缩后上传，原图最大 10MB，服务端只接受压缩后约 1MB 以内的图片，并存储到本地 `uploads/` 或 CloudBase Storage；CloudBase 正文图片通过 `/api/files?fileId=...` 代理生成最新临时地址，避免公开页保存过期临时 URL。
- 手机号、昵称、模块、活动标题、地点、描述、审核意见等字段有格式和长度校验。
- 活动描述和模板内容只保留有限富文本白名单标签；正文图片标签不会计入 50000 字描述上限，避免上传图片后被 base64 或长 URL 误伤校验。
- 公开协作员接口不返回手机号；只有管理员成员管理接口返回成员手机号。
- 操作日志中的手机号脱敏保存，避免长期日志直接沉淀完整手机号。
- 报名写入使用活动维度串行锁、幂等报名 ID 和 `phoneHash`，降低重复提交和同一活动并发超员风险。
- 错误响应避免暴露堆栈；大请求、非法图片和限流会返回明确的 4xx 错误。

## 仍需改进

- 当前登录仍是手机号白名单免密登录，生产环境建议升级为短信验证码、微信登录或密码加二次校验。
- 取消报名和报名成功页仍依赖报名 ID 作为访问凭据，后续可增加一次性确认 token、手机号二次校验或微信身份绑定。
- 当前限流和活动报名锁仍是进程内存级，CloudBase 多实例下不是全局锁；如报名量变大，应接入数据库事务、唯一索引、队列或网关 / WAF 级限流。
- `@cloudbase/node-sdk` 当前最新版本仍包含 audit 报告中的 axios / lodash 传递依赖风险，需要持续关注官方 SDK 更新。
- CloudBase Hosting 静态响应头没有在代码中统一配置；如需静态页也返回 `X-Frame-Options`、HSTS 等 HTTP 头，应在 CloudBase / CDN 控制台继续配置自定义响应头。
- 尚未接入自动化安全测试、依赖审计 CI 和备份恢复演练。

## 安全配置

```env
CORS_ORIGINS=https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com
SESSION_MAX_AGE_DAYS=14
```

`SESSION_MAX_AGE_DAYS` 会被服务端限制在 1 到 30 天之间。
