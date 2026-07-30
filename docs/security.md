# 安全说明

本项目当前是 Community OS 风格的社区活动系统，安全目标是保护后台治理、匿名身份、活动报名数据和上传文件，同时保持开放优先、自治优先、信任优先、最少中心化干预。

## 已有安全控制

- API CORS 白名单只允许配置中的站点携带凭据访问，默认只允许 CloudBase Hosting 域名。
- 所有非 GET API 请求必须带 `X-Requested-With: XMLHttpRequest`，降低跨站表单提交带来的 CSRF 风险。
- 登录和写操作有基础限流：登录按 IP 和手机号双维度限制，报名和普通写操作按 IP / 匿名身份维度限制。
- 活动创建、编辑、审核、撤回、取消和结束有细粒度限流；公开发布主要按综合匿名身份限流，治理操作按登录账号限流，避免单个身份短时间批量写入。
- 活动发布前可按配置启用 Cloudflare Turnstile；本地开发可绕过，生产需填写 Site Key 和 Secret Key。
- 活动发布、富文本图片上传和社区反馈采用综合匿名身份：本地 UUID、浏览器 fingerprint、UA 和 IP 摘要共同参与限流和社区治理事件归属。
- 服务端会下发 `HttpOnly` 签名匿名身份 Cookie `yk_anon`，并与本地 UUID、浏览器 fingerprint、UA、IP 摘要组合成限流 key；单纯清空或篡改 LocalStorage 不能完全重置服务端识别信号。
- 活动发起后的管理 token 使用随机值 + hash 存储，默认 180 天过期，并绑定本地 UUID、服务端匿名 Cookie 和 fingerprint 中至少一个身份信号；撤回、编辑、查看报名表等管理操作会校验 token、过期时间和身份绑定。默认不再接受 query string 中的管理 token，避免链接外泄。
- 活动发布链路接入规则引擎，违规或异常内容不会被单条规则直接一票否决，而是累计风险分并由策略引擎决定是否直接发布、带提示发布、公开但管理员关注或隐藏进入兜底复核。
- 活动正式提交先写入 `analysis_pending` 并立即返回，后台 `activityAnalysisJobs` 再执行规则、AI 和策略流转；任务带 `analysisVersion`，撤回或重新编辑后旧任务不会覆盖新内容；队列 sweep 会恢复超时 `running` 任务，并为缺失任务记录的 `analysis_pending` 活动补建任务。
- 默认规则包含重点风险词检测，覆盖赌场、发票、投资、成人、贷款、套现等高风险内容，并会按命中数量加重风险分。
- AI 仅作为分析引擎，不直接删除内容、不直接处罚、不直接修改社区信用度；活动风险合并以规则引擎分数为基准，默认 AI 不能降低规则风险，只能按配置有限提高风险；明确营销、明确垃圾、诈骗、违法、成人和政治敏感等 AI 强信号会被策略引擎映射为风险下限与管理员兜底审核；API Key 采用加密存储，后台不能再查看明文。
- AI 模型配置采用独立模型档案 `aiModelProfiles`，每个模型档案只公开脱敏 Key 状态；活动分析、活动反馈、举报复核和手动重分析按场景路由选择主模型和备用模型，主模型失败、超时、429、5xx 或达到模型日调用上限时按备用队列故障转移，并把每次 attempt 写入用量日志。
- AI 控制台支持系统每日调用上限，默认 200 次真实模型调用，缓存命中不计入预算；达到系统预算后跳过 AI 并按规则引擎和兜底策略处理，避免被恶意长文本或批量提交消耗模型成本。
- AI Provider Base URL 在 CloudBase 生产环境默认拒绝 localhost、内网 IP 和云元数据地址，避免 SSRF；仅 `ollama` / `local` Provider 或显式 `ALLOW_PRIVATE_AI_BASE_URL=true` 才允许私有地址。
- AI 缓存 key 包含模型档案、场景和 Prompt 版本，避免切换模型或 Prompt 后复用旧分析结果。
- AI 关闭、缺少 API Key 或调用失败时，策略引擎会按 `aiUnavailableAction`、`aiUnavailableReviewMinRisk` 等配置把中高风险活动送入管理员兜底审核，避免“只降分不复核”；管理员手动重新分析会强制调用 AI、跳过缓存，并记录当前 Prompt 版本。
- 社区信用采用事件驱动投影：活动提交、置信度评估、活动发布、社区举报和报名里程碑先写入 `communityEvents`，再由 `trustPolicies` 配置计算信任变化；当前值缓存到 `trustProfiles`，便于查询但不作为唯一来源。
- 社区徽章与徽章展示策略独立于分数本身；徽章获得和展示策略均可配置，负向或观察类内部状态可以只在后台可见，避免公开污名化。
- Session Cookie 使用 `HttpOnly`，CloudBase 环境使用 `Secure` 和 `SameSite=None`；服务端只保存 token 哈希，并设置过期时间。
- Session token hash 优先使用 `SESSION_SECRET` 做 HMAC；旧 SHA256 hash 只作为兼容读取和退出清理路径保留。
- CloudBase 生产启动默认要求配置长随机 `SESSION_SECRET`、`IDENTITY_HASH_SALT` 和 `AI_CONFIG_ENCRYPTION_KEY`，避免线上继续使用本地 fallback 密钥。
- 登录和服务启动会清理过期 session，降低旧登录态长期留存在存储中的风险。
- API 和本地 Express 静态服务返回安全响应头：CSP、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`，HTTPS 环境返回 HSTS。
- CloudBase Hosting 静态页补充 HTML `Content-Security-Policy` meta 和 referrer meta，提供基础浏览器侧约束。
- 上传封面只允许 JPG、PNG、WebP、GIF，单文件最大 6MB，并同时校验扩展名、MIME、文件内容魔数和图片像素尺寸，拒绝 SVG、HTML、脚本类伪图片和小体积超大像素图片。
- 富文本正文图片需先在浏览器压缩后上传，原图最大 10MB，服务端会校验图片内容魔数并只接受压缩后约 1MB 以内的图片，文件存储到本地 `uploads/` 或 CloudBase Storage；CloudBase 正文图片通过 `/api/files?fileId=...` 代理生成最新临时地址，避免公开页保存过期临时 URL。
- 手机号、昵称、模块、活动标题、地点、描述、审核意见等字段有格式和长度校验。
- 活动描述和模板内容只保留有限富文本白名单标签；正文图片标签不会计入 50000 字描述上限，避免上传图片后被 base64 或长 URL 误伤校验。
- 公开协作员接口不返回手机号；只有管理员成员管理接口返回成员手机号。
- 操作日志中的手机号脱敏保存，写入前会去除控制字符、折叠换行并限制字段长度，避免日志注入和日志污染。
- 活动发起后的管理 token 只在浏览器本地保存为哈希映射，服务端保存 hash，不返回明文 token 哈希。
- 社区举报只记录举报原因和补充说明，不作为传统封禁按钮；每条新举报都会触发活动重分析，举报理由与分析结果相符或复核发现强风险时活动隐藏并进入管理员审核，举报暂不成立只留痕，多人举报会增加中立风险提示。
- 报名写入使用活动维度串行锁、匿名身份维度幂等报名 ID 和确认 token，降低重复提交、隐私数据沉淀和同一活动并发超员风险。
- 报名成功页和公开取消报名需要报名时返回的确认 token；服务端只保存 token 哈希，公开响应不返回 token 哈希，报名表与公开响应默认不再返回报名手机号。
- 匿名活动反馈只在活动开始后开放；同一活动 + 同一匿名身份只能提交一次，不收集姓名和手机号，不做评分；发起人可查看本活动全部反馈，公开页只展示已通过反馈。
- 活动反馈使用独立 `feedback` Prompt 和反馈分析 Schema，AI 只输出展示适宜性、风险原因和排序权重；垃圾、攻击、广告或敏感反馈进入管理员复核，不直接公开。
- 活动反馈复核仅 YKadmin 可处理，协作员不处理反馈展示决策；管理员可将待审核反馈展示 / 不展示，也可隐藏已展示反馈或恢复已隐藏反馈，系统保留状态和日志，不直接删除内容。
- 报名表和活动反馈 CSV 导出会对 `= + - @` 开头的单元格加保护前缀，降低公式注入风险。
- 数据备份脚本默认排除 `sessions`，并脱敏 token、API Key、secret、salt、手机号和联系方式；只有在加密离线应急归档场景下才建议使用 `--include-secrets`。
- 真实管理员手机号不写入公开页面、README、`.env.example` 或 `cloudbaserc.json`，应通过本地 `.env` 或 CloudBase 控制台配置。
- 错误响应避免暴露堆栈；大请求、非法图片和限流会返回明确的 4xx 错误。

## 仍需改进

- 当前登录仍是手机号白名单免密登录，生产环境建议升级为短信验证码、微信登录或密码加二次校验；按当前产品决策，手机号免密后台登录本轮暂不修改，但它仍是后台最大身份风险。
- 当前管理员 / 协作员登录只作为治理入口，公开活动发起不再依赖登录，但匿名管理 token 和本地浏览器身份依然应视作敏感控制面。
- 管理 token 已增加过期和身份绑定，但如果用户导出浏览器数据、复制本地 UUID / fingerprint 或共享设备，仍可能把管理能力带给他人；更强方案需要后续接入短期一次性管理链接或微信 / 短信身份绑定。
- 报名确认 token 目前会在同一匿名身份重复报名时刷新旧 token，但仍建议后续接入微信身份绑定或一次性短链接策略，进一步降低确认链接转发风险。
- 当前限流和活动报名锁仍是进程内存级，CloudBase 多实例下不是全局锁；如报名量变大，应接入数据库事务、唯一索引、队列或网关 / WAF 级限流。
- 当前匿名反馈的一次性提交依赖匿名身份和存储层幂等写入；用户清理浏览器本地数据或更换设备后仍可能再次提交，这是开放优先体验下的已知边界。
- 当前反馈 AI 分析是提交时同步执行；如线上反馈量增加，建议改为异步反馈分析队列，先记录反馈再更新展示状态，避免模型响应影响提交体验。
- 社区信用不是黑名单，但它仍然是重要安全信号；若未来扩展更高价值操作，建议通过信用策略和可解释事件时间线把高风险操作与信任度联动起来。
- 按当前产品决策，自报名和自点「感兴趣」暂不作为刷信用攻击处理；后续如要让 Community Trust 影响更高价值权益，应先加入关联身份检测、时间衰减、异常行为权重和人工兜底复核。
- 当前信用策略 / 徽章规则使用 JSON 条件配置，管理员应避免配置过大或无法解释的规则；后续可增加策略变更预览和历史重算 dry-run。
- AI 分析引擎默认关闭；生产启用前请做好 Provider、Prompt、缓存和失败兜底策略的灰度验证。
- 异步分析队列目前仍依赖用户访问管理视图或管理员手动 sweep 唤醒；代码已支持恢复超时 `running` 和补建缺失任务，但生产上更稳的方式仍是接入 CloudBase 定时触发器或独立任务队列。
- `@cloudbase/node-sdk` 当前最新版本仍包含 audit 报告中的 axios / lodash 传递依赖风险，需要持续关注官方 SDK 更新。
- CloudBase Hosting 静态响应头没有在代码中统一配置；如需静态页也返回 `X-Frame-Options`、HSTS 等 HTTP 头，应在 CloudBase / CDN 控制台继续配置自定义响应头。
- 已新增基础自动化安全测试，但还未覆盖完整红队链路中的 CSRF Origin 校验、权限接口矩阵、上传真实图片解码、CloudBase 多实例限流和举报女巫攻击；依赖审计 CI 和备份恢复演练仍需继续补齐。

## 依赖审计记录

- 2026-07-15 执行 `npm_config_registry=https://registry.npmjs.org npm audit --omit=dev --json`，结果仍为 5 个生产依赖风险：4 high、1 moderate。
- 风险来源限定在 `@cloudbase/node-sdk@3.18.3` 的传递依赖：`axios@0.27.2`、`@cloudbase/database@1.4.3`、`lodash.set@4.3.2`、`lodash.unset@4.5.2`。
- 已检查 `@cloudbase/node-sdk@3.18.4` 和 `@cloudbase/node-sdk@4.0.3`，仍依赖 `axios@0.27.2`；当前不做 npm override，避免破坏 CloudBase 云函数 SDK 行为。
- 后续建议持续关注 CloudBase SDK 官方版本，或在独立分支验证 SDK 升级 / 替换方案。

## 安全配置

```env
CORS_ORIGINS=https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com
SESSION_SECRET=请替换为长随机字符串
SESSION_MAX_AGE_DAYS=14
IDENTITY_HASH_SALT=请替换为长随机字符串
ANONYMOUS_ID_SECRET=请替换为长随机字符串
TURNSTILE_ENABLED=false
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_BYPASS_LOCAL=true
AI_CONFIG_ENCRYPTION_KEY=请替换为长随机字符串
AI_CONFIG_ENCRYPTION_KEY_PREVIOUS=
REQUIRE_PRODUCTION_SECRETS=true
MANAGE_TOKEN_MAX_AGE_DAYS=180
MAX_IMAGE_PIXELS=18000000
MAX_IMAGE_SIDE=8000
ALLOW_PRIVATE_AI_BASE_URL=false
```

`SESSION_MAX_AGE_DAYS` 会被服务端限制在 1 到 30 天之间。

`SESSION_SECRET`、`IDENTITY_HASH_SALT`、`ANONYMOUS_ID_SECRET` 和 `AI_CONFIG_ENCRYPTION_KEY` 必须在生产环境保持稳定；更换后旧登录态、旧匿名身份、管理 token 或 AI Key 解密可能失效。`AI_CONFIG_ENCRYPTION_KEY_PREVIOUS` 仅用于迁移历史 AI Key，加密迁移完成后应移除。CloudBase 模式默认会检查其中关键密钥是否为长随机值，部署前请先在 CloudBase 控制台配置真实密钥。
