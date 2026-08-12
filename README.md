# YouKongBeFree

有空客厅中文官网与社区操作系统（Community OS）活动系统。项目服务于重庆「有空客厅」这个弱中心化社区与共有空间，既承载公开官网内容，也提供无需登录的开放活动发布、访客报名、社区反馈、社区信用、规则引擎、AI 分析引擎和管理员 / 协作员兜底治理能力。

## 当前开发状态

当前版本：`0.29.0`

状态：`0.29.0` 后续开发继续补性能速度层：服务端新增可选 Redis / memory / noop cache driver、公开首屏聚合接口和 `X-Cache` / `Server-Timing` 观测头；小程序新增本地 SWR 缓存层，首页、活动列表、活动详情基础信息和身份隔离的「我的」数据可先显示缓存再静默刷新。缓存只负责快，服务器仍负责最终真值。

## 访问地址

CloudBase 动态线上站点：

- 官网首页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/
- 管理员 / 协作员登录页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/login.html
- 后台：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin.html
- 我的：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/me.html
- 我的活动反馈：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/my-feedbacks.html
- 身份网络：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/identity-sync.html
- 编辑公开资料：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/profile-editor.html
- 发起人主页：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/profile.html?id=COMMUNITY_ID
- 近期活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activities.html
- 历史活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activities.html?view=history
- 发起活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/activity-editor.html
- 我的活动：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/my-activities.html
- 审核待办：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/review-tasks.html
- 全部活动管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-activities.html
- 用户管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-members.html
- 角色权限管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-roles.html
- 新建角色：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-role-editor.html
- 模块管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-modules.html
- 活动模板：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-templates.html
- 新增活动模板：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-template-editor.html
- 客厅的朋友们：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-friends.html
- 活动反馈管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-feedbacks.html
- 报名表：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/registrations.html
- 操作日志：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-logs.html
- 社区举报：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-reports.html
- 规则引擎：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-safety.html
- AI 分析：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-ai.html
- AI 模型配置：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-ai-models.html
- AI Prompt 管理：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-ai-prompts.html
- AI 用量健康：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-ai-usage.html
- 社区信用度：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-trust.html
- 社区信用策略：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-trust-policy.html
- 社区徽章：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-badges.html
- 徽章展示策略：https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com/admin-badge-policy.html
- API 服务：https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com/api

GitHub Pages 静态展示：

- https://yaohaixu.github.io/YouKongBeFree/

重要说明：GitHub Pages 只能托管静态页面，不能运行登录、后台、活动发布和报名接口。完整动态功能以 CloudBase 地址为准。

## 核心功能

- 中文响应式官网：首页、社区共识、活动与参与、捐赠支持、关于与联系。
- 开放活动发布：任何人无需注册、无需登录即可发起活动；同一浏览器使用本地匿名 UUID 和活动管理 token 继续编辑、撤回、查看报名表。
- 管理员 / 协作员登录：手机号白名单只用于后台治理权限；管理员在用户管理中录入昵称、手机号并选择一个角色后，对方可登录处理被授权的后台模块。
- 角色权限管理：后台采用单角色权限体系（RBAC）。`admin` 是内置锁定超级管理员；`collaborator` 是内置协作角色；管理员可在独立角色详情页新增 / 编辑自定义角色，并按模块访问层和动作层配置 `view/create/edit/delete/review/export/configure/reanalyze/cancel/end` 等权限。
- 社区操作系统安全架构：规则引擎、社区信用、AI 分析引擎、社区举报、风险提示、限流和 Turnstile 彼此解耦，所有阈值和策略配置化。
- 规则引擎：支持敏感词、重点风险词、URL、HTML 标签、Script 注入、Markdown 危险语法、Unicode 混淆、Emoji 比例、重复字符、超长文本、重复内容、异常格式和活动完整度等规则，输出风险分和规则明细，不单条直接拒绝；重点风险词覆盖赌场、发票、投资、成人等明显不适合开放活动发布的内容，并按命中数量加重风险。
- 社区治理：新增统一社区事件、信用策略、社区徽章和徽章展示策略。社区信用不再只是直接分数，而是由活动发布、活动置信度、社区反馈和报名里程碑等事件按策略投影出来；活动置信度评价单次活动，社区信用评价长期匿名身份，两者通过可配置策略映射。
- 社区信用：匿名身份初始 50 分，基于事件流逐步变化；后台可查看 Community ID、社区等级、状态、徽章、活动数、报名回应、举报和完整时间线。
- 社区徽章：后台可配置身份徽章、成就徽章和事件徽章，徽章获得规则使用 JSON Rule Builder；徽章展示策略控制徽章是否公开、展示在哪些位置、是否显示图标 / 名称和悬停说明。
- AI 分析引擎：AI 是社区观察员，不是审核员；新增 AI 控制台、模型档案、场景路由、Prompt 管理和用量健康页。管理员可配置多个模型档案，每个档案包含 Provider、Base URL、Model、加密 API Key、超时、重试、Max Tokens、Temperature、启用状态、优先级和适用场景；活动分析、活动反馈、举报复核和手动重分析可分别绑定主模型与备用模型，主模型失败时按队列自动故障转移；用量健康按系统和模型维度展示调用量、成功率、平均耗时、Token、缓存命中和最近错误。
- 安全与智能概览：AI 控制台顶部新增社区健康概览，汇总待安全分析、管理员复核、社区举报、反馈复核和近 7 天 AI 调用状态，方便管理员先看风险面，再进入具体配置。
- AI 调用策略：支持开关、Prompt 版本、调用策略、能力开关、缓存、重试、测试连接、系统每日调用上限和模型档案日调用上限；AI 介入条件可配置为规则置信度低于 / 等于阈值、匿名身份前 N 场必调 AI、举报后重分析、手动重分析、低信用度、随机抽检或全部分析；系统默认每日最多 200 次真实模型调用，缓存命中不计入预算；规则置信度阈值设为 100 时会覆盖全部活动；AI 关闭、缺少 Key 或不可用时，中高风险活动会进入管理员兜底审核；AI 明确识别营销、垃圾、诈骗、违法、成人和政治敏感内容时，策略引擎会提升风险下限并把高风险活动隐藏后转入管理员审核，疑似营销则保留公开但进入管理员关注待办。
- 社区举报：活动详情页支持社区反馈；每条新举报都会记录并触发活动重分析。举报理由与规则 / AI 分析相符时活动会下架并转入管理员审核，管理员通过后重新公开；举报暂不成立时只留痕不下架；多人举报会给活动增加中立风险提醒。
- 风险提示：低风险活动默认不展示“可信”标签；存在营销或较高风险时显示中立提示，帮助参与者自行判断。
- YKadmin 后台：入口型工作台按待办、活动运营、社区治理、安全与智能、用户与权限、系统维护分组；社区举报、社区信用、信用策略、社区徽章和徽章展示策略直接出现在社区治理分组下，AI 分析仍在安全与智能分组下。
- YKadmin 子页面：用户新增、编辑、删除和角色分配；角色权限新增、编辑、删除和权限矩阵配置；活动模块新增、编辑、删除；活动描述模板新增、编辑、删除；「客厅的朋友们」新增、编辑、停用和删除；活动反馈检索、展示 / 隐藏 / 恢复展示和 CSV 导出；管理员待办审核；按关键词、模块、状态、时间、报名数筛选全部活动。
- YKadmin 活动管理：可查看全部状态活动，可取消或结束活动，可进入独立报名表页面。
- YKadmin 操作日志：记录登录、退出、新增、保存、删除、提交、审核、退回、拒绝、撤回、报名、取消报名、删除报名、取消活动、结束活动和自动归档等关键动作，支持关键词、操作类型、操作人、角色、日期范围筛选和分页加载；日志手机号脱敏保存，仅保留最近 30 天。
- 「我的」开放工作台：无需登录即可进入发起活动、我的活动、当前身份报名记录、我的活动反馈子页面和身份网络子页面；取消报名后的活动不会继续显示在我的报名里；协作员 / 管理员登录后额外看到审核待办和后台入口；入口卡片与管理员工作台共享 Octicon 风格图标、语义 tone、右侧箭头、指针高光和短时状态动效。
- 我的活动反馈：`my-feedbacks.html` 按当前匿名身份列出写过的反馈，支持身份网络合并展示、活动跳转和加载更多；「我的」工作台只保留入口卡片，不再内嵌反馈列表。
- 匿名设备身份网络：「我的」把身份网络作为与“我的报名”“我的反馈”并列的入口模块；进入独立子页面后可开启网络、生成 10 分钟同步二维码 / 链接、查看和移除设备。手机、电脑和未来小程序身份可以合并为同一个匿名身份网络；合并前展示两边活动、报名、反馈、感兴趣和举报统计，确认后历史数据不删除，公开资料可选择保留原身份或当前设备。
- 我的公开资料：每个浏览器匿名身份都可以维护公开头像、昵称和个人简介；「我的」页只展示资料摘要，点击头像或编辑入口进入独立 `profile-editor.html`；资料只展示发起人主动填写的公开内容，不展示手机号、管理 token 或 Community Trust 分数；活动卡片、活动详情和报名成功页可点击进入公开发起人主页。
- 活动共同发起：主发起人可在新活动页直接发起协作，系统会自动保存一个未公开草稿并生成邀请链接；受邀者在同一浏览器匿名身份下接受后成为共同发起人，可编辑、提交、撤回、取消、结束活动，并查看该活动报名表和活动反馈；只有主发起人、管理员或持管理 token 的原发起人可以新增 / 移除共同发起人。
- 活动发起管理：保存活动草稿、可选选择协作员、发布活动、查看自己活动状态、撤回活动、取消 / 结束活动、查看独立报名表和活动反馈；共同发起团队管理集中在活动详情页底部，「我的活动」列表只展示共同发起人摘要，避免按钮挤满列表。共同发起活动也会出现在「我的活动」中。正式提交会先显示「安全分析中」并立即回到我的活动，后台任务完成后再变为已发布、管理员关注或管理员审核。
- 活动编辑并发保护：编辑已有活动时会申请长时软锁并自动续期；其他发起人进入同一活动会看到当前编辑者和接管入口；后端保留异常过期兜底，避免关闭浏览器后永久锁死。提交时带 `activityVersion` 做版本冲突校验，避免两个人同时提交互相覆盖。保存草稿只更新活动内容和版本，不触发规则引擎或 AI 分析；正式提交才进入安全分析链路。
- 个人侧加载优化：「我的」页使用 `/api/me/summary` 一次返回公开资料、身份网络、工作台概览和报名预览；Web 端个人资料、身份网络、我的活动、我的报名、我的反馈和活动编辑页基础下拉项使用浏览器短缓存，先显示缓存再后台刷新，写操作后自动清理缓存。
- 服务端公开读加速：新增 `/api/public/bootstrap` 聚合首页所需模块、活动系列、启用的客厅朋友、小程序配置和近期活动，PC 首页和小程序首页已接入；可选 Redis 速度层缓存公开配置、公开活动列表和公开活动详情 base，并通过版本号失效避免 Redis pattern 删除。
- 小程序启动性能优化：新增 `miniprogram/utils/cache.js` 统一本地缓存层，首页和活动列表先读缓存立即渲染，再后台请求 `/api/public/bootstrap` 或列表接口；活动详情缓存公共 base，报名 / 感兴趣 / 订阅 / 权限等 viewer-specific 状态仍由服务端校准；我的报名、我的反馈、我的页面和身份网络缓存 key 按当前匿名身份短 hash 隔离，报名、反馈、资料、活动编辑和身份同步等写操作会主动清理相关缓存。
- 活动发起流程：发起 / 编辑活动页拆成基本信息、活动介绍、报名设置、发布与高级设置四段，桌面端用步骤导航快速跳转，移动端保持单页顺序阅读；高级设置默认折叠，降低首次发起活动的表单压力。
- 活动发起人联系方式：发起活动页可选择是否展示发起人联系方式；选择展示时默认带出登录手机号，也可改成其他联系方式；公开活动详情页仅在选择展示时显示，并与活动状态 / 报名信息保持清晰间距。
- 活动富文本编辑：发起活动页提供轻量富文本工具栏，支持正文段落、一级/二级/三级标题、加粗、列表、分隔线和正文图片插入；正文图片可选择 10MB 以内原图，浏览器或小程序会压缩处理，压缩后仍需在 10MB 以内；图片保存为稳定代理链接，图片标签不计入 50000 字描述上限；服务端会对白名单标签做二次清洗；活动正文中的超长链接和图片会在移动端自动适配页面宽度。
- 小程序富文本体验：小程序发起活动页基于微信官方 `editor` 组件，工具栏保留正文 / H1 / 加粗 / 斜体 / 下划线 / 列表 / 分隔线 / 撤销 / 重做 / 图片 / 清空等高频能力；编辑区会按文字行数和图片数量动态增高，插入正文图片时自动使用页面宽度，预览区和活动详情页也会给图片增加响应式样式，避免图片撑出手机页面边距。
- 活动描述模板：YKadmin 可维护常用活动描述模板；模板列表页负责搜索、编辑入口和删除，新增 / 编辑进入独立详情页；发起活动时默认「无，自己写」，选择模板只覆盖活动描述，若已有正文会先确认是否覆盖。
- 活动来源：发起活动可选择「客厅」或「客厅的朋友们」；选择朋友来源时需要选择一个已启用的客厅朋友，活动卡片、详情和历史列表会展示对应来源信息。
- 活动系列：系统默认提供日常活动、有空放映、读书讨论、城市漫游、共创工作坊和公益互助等系列；发起活动可选系列，PC 与小程序的活动卡片、活动详情、我的活动和近期 / 历史列表会同步展示，活动列表支持按系列筛选。
- 客厅的朋友们：YKadmin 可维护名称、简介、头像 / Logo、地址、联系人、联系方式和启用状态；已有活动使用的朋友空间不能直接删除，可先停用。
- 普通访客只看到发起活动和同一浏览器自己的活动管理；协作员才会看到自己的审核待办。
- 兜底复核：活动发布先走规则引擎，再按 AI 调用策略决定是否分析，最后由策略引擎决定低风险直接发布、中风险发布并提示、疑似营销公开但进入管理员关注、高风险隐藏并进入管理员兜底复核；任一岗位可退回，拒绝后不可编辑。
- 审核待办详情支持查看活动描述、正文图片、审核记录和上传封面图；审核意见默认「请选择」，审核意见与备注区放在活动详情之后，桌面端统一为对齐审批面板，移动端保持单列排列。
- 活动人数限制：发起活动时人数限额留空默认 99 人，最大 99 人；可选设置最低报名人数和最后报名日期，人数限额必须大于最低报名人数。
- 报名与成团：公开发布活动支持未登录访客只填写昵称报名；重复报名按浏览器匿名身份刷新并返回报名确认 token；报名截止后不再接受新报名，若未达到最低报名人数则自动进入「未成团取消」；草稿和审核中活动不开放报名；同一活动报名写入按活动维度串行化，降低并发超员风险。
- 报名人公示：发起人可选择是否公示报名昵称；选择公示后，活动详情页底部展示已报名人的昵称墙，默认不公开。
- 活动反馈：活动开始后，参与者可通过活动反馈二维码匿名提交「最喜欢 / 可以改进 / 其他想说的」，不填写姓名、不打分；同一浏览器匿名身份每个活动只能提交一次。
- 反馈展示与复核：发起人可选择活动详情是否展示已通过反馈；默认展示权重最高的 3 条通过反馈。反馈使用独立 `feedback` Prompt 走 AI 分析引擎，AI 只判断展示适宜性和排序权重，疑似垃圾、攻击、广告或敏感内容进入管理员复核。
- 活动反馈管理：发起人可进入活动反馈页下载 JPG 格式反馈二维码、查看全部反馈；YKadmin 可在全站反馈管理页筛选、展示 / 隐藏 / 恢复展示反馈，并导出活动 + 反馈 CSV；AI 拦截或 AI 不可用兜底进入复核的反馈会同步出现在管理员审核待办。
- 活动复盘：发起人、共同发起人和管理员可在活动反馈页查看复盘摘要，汇总报名人数、感兴趣人数、反馈总数、已展示 / 待审核 / 不展示反馈、成团状态和权重最高的精选反馈；小程序活动反馈管理页同步展示同一份复盘数据。
- 小程序订阅提醒：微信小程序活动详情页支持活动提醒订阅入口；订阅消息模板 ID 通过 `WECHAT_MP_ACTIVITY_REMINDER_TEMPLATE_IDS` 配置，未配置时会友好提示。PC 端不展示通知按钮，避免出现无法实际触发微信订阅的伪入口。
- 活动详情页：白天模式下地点与时间信息保持高对比度；活动详情支持下载 JPG 活动邀请函、复制报名链接和下载 `.ics` 日历文件。
- 发起人主页：公开展示发起人的头像、昵称、简介、公开徽章和最近公开活动摘要，帮助参与者判断活动来源；页面不公开后台手机号和匿名身份完整 UUID。
- 活动邀请函：完整展示活动封面，不裁切长图；邀请函包含「模块丨标题」、发起人、放大的诚邀昵称、地址、完整日期时间和右下角活动二维码；不展示报名手机号和明文活动网址；地址严格使用活动填写地点，地点为空时默认展示「有空客厅」。报名成功页也可下载带报名人昵称的活动邀请函。
- 活动时间：活动必须填写开始时间，可选填写结束时间；列表、详情、报名确认页会展示起止时间。
- 活动自动结束：系统按北京时间判断活动结束日期；若填写结束时间则以结束时间为准，否则沿用活动日期次日 0 点归档；最低报名活动按最后报名日期自动判断是否「未成团取消」。已发布 / 已满员活动归档或未成团取消后从首页和近期活动列表移除；管理员可手动触发一次归档扫描。
- 独立活动列表页：首页最多读取 3 条近期活动；PC 首页使用与近期活动详情页一致的完整宽度横向活动长条，海报与文字之间保留独立呼吸间距，移动端保持横向滑动活动卡；近期 / 历史活动卡支持记录「感兴趣」，同一浏览器匿名身份只能点一次；`activities.html` 展示所有近期活动，`activities.html?view=history` 展示活动结束和未成团取消活动，历史视图可按「客厅」和「客厅的朋友们」筛选。
- 移动端活动操作按钮：全部活动管理和我的活动列表在手机端使用右侧竖排同宽操作列，避免 3 个以上操作按钮并排或文字被挤压。
- 报名成功页：展示活动和报名人昵称；公开访问必须带本次报名返回的确认 token，并支持访客用该 token 取消报名；白天模式下主说明和信息标签使用深色系统文字，保证白底卡片可读。
- 报名表查看：活动发起人和管理员可在独立页面查看报名者昵称列表、删除报名记录，并导出带公式注入保护且不含手机号的 CSV。
- 动态活动列表：首页读取最多 3 条近期活动，独立活动页支持近期 / 历史视图。
- 筛选与分页：活动、协作员、模块、日志列表只在点击「筛选」后查询，API 按页返回数据，加载更多请求下一页。
- 全站管理操作提供轻提示反馈，删除类操作需要确认弹窗。
- 视觉体验：公开页支持白天 / 黑夜 / 跟随系统主题切换；主题切换按钮保持紧凑圆形外圈和更小的精细 SVG 状态图标；黑夜模式保留艺术网站式深色展场、真实照片主视觉、图片拼贴、公告栏式活动模块、砖红主按钮、指针聚光、图片浮动和滚动入场动效；后台和开放工作台同样支持主题切换，工作台与中间页 Hero 使用统一背景图遮罩；管理员工作台和「我的」开放工作台使用 Primer / Geist inspired command surface、Octicon 风格实心图标、语义 tone、卡片响应反馈和 reduced-motion 降级。
- Motion Design：主题切换图标使用 SVG 状态切换动效；后台入口图标按模块语义做轻量 hover / focus 动效，AI、审核、举报、日志等入口有不同短时反馈；一键回首页、活动卡片图片、感兴趣按钮、toast 和表单消息提供短时状态反馈，减少操作后“不知道有没有生效”的感觉。
- 全站辅助入口：顶部导航栏固定展示，品牌右侧提供单图标三态主题切换键；主题按钮采用 SVG 图标、圆形高质感表面和轻量状态动效；深度滚动后显示浮动「首页」按钮，方便快速回到官网首页且避免遮挡首屏表单。
- 首页主视觉：首页 Hero 背景使用用户提供的新图 `assets/youkong-hero-illustration.png`，右侧内容图继续使用不含旧标识信息的饭桌现场图。
- 内容清理：公开站点已移除旧标识相关文案与图片素材，公开视觉统一使用不含旧标识信息的饭桌现场图。
- 安全加固：API 安全响应头、静态页 HTML CSP、CORS 白名单、非 GET API 安全校验头、登录和写操作限流、活动操作细粒度限流、Session 哈希存储、过期清理、上传图片扩展名 / MIME / 内容魔数校验、匿名身份报名去重、报名确认 token、手机号和文本长度校验、日志手机号脱敏。
- 运维能力：提供 `npm run backup:data` 数据备份脚本；API 慢请求和 5xx 错误会输出到本地 / CloudBase 云函数日志；`npm run deploy:dry-run` 可检查 CloudBase 构建产物，静态构建会自动发现根目录全部 HTML 页面；运维手册集中记录备份、慢接口和索引检查流程。
- CloudBase NoSQL 落库与 CloudBase Storage 活动封面 / 富文本正文图片存储。

## 技术栈

- 前端：HTML、CSS、Vanilla JavaScript；富文本编辑器和活动分享能力已拆到 `assets/js/`
- 图标体系：管理员工作台使用 `@primer/octicons` 作为 MIT 授权的图标参考源，前端仍输出内联 SVG，避免额外 CDN 依赖。
- 本地后端：Node.js、Express
- 云端后端：CloudBase 云函数 + `serverless-http`
- 数据存储：本地 JSON 或 CloudBase NoSQL
- 公开缓存：服务端可选 Redis / memory / noop cache driver；Redis 只作为公开读速度层，不作为主数据库
- 小程序本地缓存：统一 `miniprogram/utils/cache.js` 管理 TTL、过期元信息、环境隔离 key、身份隔离 key、stale fallback 和主动失效；禁止把管理员权限、AI 配置、API Key、token 或敏感身份信息写入普通本地缓存
- 查询分页：本地 JSON 模拟查询；CloudBase 使用 `where`、`orderBy`、`skip`、`limit` 和 `count`
- 活动归档：Express 启动定时轮询 + 公开活动列表请求前兜底 sweep；CloudBase 云函数入口按节流策略执行 sweep
- 操作日志：写入和查询时自动清理 30 天前日志，管理员日志页只查询保留期内记录
- 社区操作系统：匿名身份、管理 token、规则引擎、社区治理、社区信用、社区徽章、社区举报、风险提示和策略引擎模块化实现
- AI 分析引擎：Provider Adapter、Prompt、Schema、Parser、Cache、Logger、Retry、Config、Service 分层；业务只调用统一分析服务
- Turnstile：Cloudflare Turnstile 配置化接入，默认关闭，本地可绕过
- API 诊断：慢请求 / 5xx 响应写入服务端日志，默认阈值 1200ms
- API 观测：所有 API 返回 `X-Cache`、`X-Cache-Driver` 和 `Server-Timing`，便于区分缓存、存储和 hydrate 耗时
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
├── login.html              # 管理员 / 协作员登录页面
├── me.html                 # 开放工作台：公开资料、概览和入口卡片
├── identity-sync.html      # 身份网络管理、同步邀请、合并预览和确认
├── profile.html            # 发起人公开主页
├── activity-editor.html    # 发起 / 编辑活动页面
├── my-activities.html      # 我发起的活动：筛选、撤回、报名表
├── my-feedbacks.html       # 我的活动反馈：当前身份反馈历史
├── registrations.html      # 活动报名表详情与 CSV 导出
├── activity-feedback.html  # 发起人活动反馈页：二维码、反馈列表
├── feedback.html           # 匿名活动反馈问卷
├── review-tasks.html       # 管理员 / 协作员审核待办
├── admin.html              # YKadmin 工作台：管理入口
├── admin-activities.html   # 全部活动管理与筛选
├── admin-members.html      # 用户管理
├── admin-roles.html        # 角色权限列表
├── admin-role-editor.html  # 新增 / 编辑角色详情
├── admin-modules.html      # 活动模块管理
├── admin-templates.html    # 活动描述模板管理
├── admin-template-editor.html # 新增 / 编辑活动描述模板
├── admin-friends.html      # 客厅的朋友们管理
├── admin-feedbacks.html    # 活动反馈管理与 CSV 导出
├── admin-logs.html         # 管理员操作日志
├── admin-reports.html      # 社区举报列表与复核结论
├── admin-safety.html       # 规则引擎和策略配置
├── admin-ai.html           # AI 控制台与场景路由
├── admin-ai-models.html    # AI 模型档案列表
├── admin-ai-model-editor.html # 新增 / 编辑 AI 模型档案
├── admin-ai-prompts.html   # AI Prompt 场景化管理
├── admin-ai-prompt-editor.html # 新增 / 编辑 AI Prompt
├── admin-ai-usage.html     # AI 用量健康统计
├── admin-governance.html   # 社区治理兼容旧入口
├── admin-trust.html        # 社区信用列表
├── admin-trust-detail.html # 社区信用详情
├── admin-trust-policy.html # 信用策略配置
├── admin-badges.html       # 社区徽章配置
├── admin-badge-policy.html # 徽章展示策略
├── admin-activity-confidence.html # 活动置信度详情
├── activity.html           # 活动详情与报名页面
├── success.html            # 报名成功 / 确认页面
├── styles.css              # 全站样式
├── script.js               # 官网导航、复制、滚动动效
├── app.js                  # 登录态、活动、报名、后台交互逻辑
├── server.js               # 本地 Express 启动入口
├── lib/
│   ├── app.js              # Express 应用与 API 路由
│   ├── permissions.js      # RBAC 权限模块、动作和默认角色定义
│   ├── rich-text.js        # 活动富文本服务端白名单清洗
│   ├── community-safety/   # 身份、限流、规则、信任、举报、策略和 Turnstile
│   ├── community-governance/ # 社区事件、信用策略、徽章和策略服务
│   ├── ai-analysis/        # 可插拔 AI 分析引擎，含活动 / 反馈分析 Schema
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
YKADMIN_PHONE=请在本地 .env 或 CloudBase 控制台配置
STORE_DRIVER=json
CLOUDBASE_ENV_ID=youkong-d5gh4x0ayc29a2187
CORS_ORIGINS=https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com
PUBLIC_SITE_ORIGIN=https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com
WECHAT_MP_APPID=wx5020d6431cfac041
WECHAT_MP_SECRET=请在 CloudBase 环境变量中配置小程序 AppSecret
WECHAT_MP_ACTIVITY_REMINDER_TEMPLATE_IDS=
SESSION_MAX_AGE_DAYS=14
SESSION_SECRET=请替换为长随机字符串
ACTIVITY_AUTO_END_INTERVAL_MS=900000
ACTIVITY_AUTO_END_MIN_SWEEP_MS=60000
ACTIVITY_EDIT_LOCK_TTL_MINUTES=360
DISABLE_ACTIVITY_AUTO_END=false
API_TIMING_LOGS=true
API_SLOW_LOG_MS=1200
CACHE_DRIVER=noop
REDIS_ENABLED=false
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DATABASE=0
REDIS_KEY_PREFIX=yk:prod:v1
REDIS_CONNECT_TIMEOUT_MS=800
REDIS_CACHE_TIMEOUT_MS=90
PUBLIC_CONFIG_CACHE_TTL_SECONDS=600
PUBLIC_BOOTSTRAP_CACHE_TTL_SECONDS=90
PUBLIC_ACTIVITY_LIST_CACHE_TTL_SECONDS=45
PUBLIC_ACTIVITY_DETAIL_CACHE_TTL_SECONDS=120
PUBLIC_CACHE_STALE_SECONDS=30
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
YK_DB_FILE=
```

注意：

- `.env` 不允许提交到 Git。
- 本地默认使用 `STORE_DRIVER=json`，数据写入 `data/youkong-db.json`。
- 云端使用 `STORE_DRIVER=cloudbase`，数据写入 CloudBase NoSQL 集合：`yk_users`、`yk_roles`、`yk_modules`、`yk_activitySeries`、`yk_templates`、`yk_livingRoomFriends`、`yk_activities`、`yk_registrations`、`yk_activityInterests`、`yk_activityFeedbacks`、`yk_activityNotificationSubscriptions`、`yk_activityCoInitiators`、`yk_activityCoInitiatorInvites`、`yk_identityNetworks`、`yk_identityNetworkDevices`、`yk_identitySyncInvites`、`yk_identityMergeEvents`、`yk_identityExternalCredentials`、`yk_identityProfiles`、`yk_sessions`、`yk_logs`、`yk_safetyRules`、`yk_systemConfigs`、`yk_anonymousIdentities`、`yk_communityEvents`、`yk_trustProfiles`、`yk_trustEvents`、`yk_trustPolicies`、`yk_communityBadges`、`yk_identityBadges`、`yk_badgePolicies`、`yk_rateEvents`、`yk_analysisReports`、`yk_activityAnalysisJobs`、`yk_communityReports`、`yk_aiModelProfiles`、`yk_aiPrompts`、`yk_aiCache`、`yk_aiUsageLogs`。
- `CORS_ORIGINS` 用英文逗号分隔允许跨域访问 API 的前端域名；`PUBLIC_SITE_ORIGIN` 用于 API 生成可在浏览器打开的公开站点链接，例如身份同步链接。
- `WECHAT_MP_APPID` / `WECHAT_MP_SECRET` 用于小程序端 `wx.login()` 后服务端换取 openid；AppSecret 只能放在 `.env` 或 CloudBase 环境变量，不能写入小程序前端代码。
- `WECHAT_MP_ACTIVITY_REMINDER_TEMPLATE_IDS` 用于小程序订阅消息模板 ID，多个模板用英文逗号分隔；未配置时活动详情会提示暂未开启提醒。
- `SESSION_MAX_AGE_DAYS` 会被限制在 1 到 30 天之间。
- `ACTIVITY_AUTO_END_INTERVAL_MS` 控制本地 / 常驻服务的自动结束轮询间隔，默认 15 分钟；`ACTIVITY_AUTO_END_MIN_SWEEP_MS` 控制请求兜底 sweep 的最小间隔；`ACTIVITY_EDIT_LOCK_TTL_MINUTES` 控制活动编辑锁异常兜底过期时间，默认 360 分钟，页面打开时会自动续期；`DISABLE_ACTIVITY_AUTO_END=true` 可关闭后台轮询。
- `API_TIMING_LOGS=false` 可关闭 API 耗时日志；`API_SLOW_LOG_MS` 控制慢请求阈值，默认 1200ms。所有 API 响应会返回 `X-Cache`、`X-Cache-Driver` 和 `Server-Timing`，用于观察缓存、存储和 hydrate 耗时。
- `CACHE_DRIVER` 支持 `noop`、`memory`、`redis`，默认 `noop`；生产启用 Redis 可设置 `REDIS_ENABLED=true` 或 `CACHE_DRIVER=redis`，并配置 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`、`REDIS_DATABASE` 和 `REDIS_KEY_PREFIX`。
- `REDIS_CONNECT_TIMEOUT_MS` 和 `REDIS_CACHE_TIMEOUT_MS` 控制 Redis 短超时，Redis 异常时公开读接口会绕过缓存继续查主存储；`PUBLIC_*_CACHE_TTL_SECONDS` 和 `PUBLIC_CACHE_STALE_SECONDS` 控制公开配置、bootstrap、活动列表、活动详情 base 的 TTL 与短时 stale 回退。
- Redis 一期只缓存公开数据：`/api/public/bootstrap`、公开模块 / 活动系列 / 启用的客厅朋友 / 小程序配置、公开活动列表和公开活动详情 base；不会缓存后台权限、session、身份网络、`/api/me/summary`、报名 token、openid、手机号或管理 token。
- `SESSION_SECRET` 用于登录 session HMAC 哈希；`IDENTITY_HASH_SALT` 用于匿名身份、指纹和管理 token 哈希；`ANONYMOUS_ID_SECRET` 用于服务端匿名身份 Cookie 签名。生产环境必须保持稳定且不提交 Git。
- `TURNSTILE_*` 控制 Cloudflare Turnstile；默认关闭，本地开发可通过 `TURNSTILE_BYPASS_LOCAL=true` 绕过。
- `AI_CONFIG_ENCRYPTION_KEY` 用于加密 AI API Key；生产环境必须配置稳定长随机值，避免重启或部署后无法解密旧配置。
- `AI_CONFIG_ENCRYPTION_KEY_PREVIOUS` 只用于从旧加密 Key 迁移已有模型配置；新环境保持为空，历史模型 Key 重新保存完成后应删除。
- `REQUIRE_PRODUCTION_SECRETS` 控制生产密钥启动检查；CloudBase 模式默认要求 `SESSION_SECRET`、`IDENTITY_HASH_SALT`、`AI_CONFIG_ENCRYPTION_KEY` 都是长随机值。
- `MANAGE_TOKEN_MAX_AGE_DAYS` 控制匿名活动管理 token 有效期，默认 180 天，服务端会限制在 1 到 365 天之间。
- `MAX_IMAGE_PIXELS` 和 `MAX_IMAGE_SIDE` 控制上传图片像素上限，防止超大像素图片消耗内存。
- `ALLOW_PRIVATE_AI_BASE_URL=false` 时，CloudBase 生产环境会拒绝把 AI Base URL 指向 localhost、内网地址和云元数据地址；仅本地 Ollama / local Provider 允许内网地址。
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

管理员账号：

- 昵称：`有空管理员`
- 手机号：不在仓库和公开页面中展示，请在本地 `.env` 或 CloudBase 控制台配置 `YKADMIN_PHONE`

运行自动化测试：

```bash
npm test
```

测试内容包括：

- 语法检查：核心前后端脚本和构建脚本。
- 安全回归：富文本 XSS 清洗、服务端签名匿名身份防篡改、活动管理 token 过期 / 撤销 / 身份绑定、AI Base URL 内网拦截、Prompt Injection 隔离、AI 每日调用预算和备份脱敏。
- API 冒烟：登录安全头、协作员新增、匿名/登录发起活动、规则引擎、活动置信度、AI 设置脱敏、AI stub 真实调用、AI 关闭中高风险兜底审核、匿名公开资料保存 / 读取、匿名设备身份网络创建 / 同步邀请 / 合并预览 / 跨设备活动聚合 / 报名去重 / 感兴趣去重、公开发起人主页资料、社区反馈、社区治理事件流、信用策略、社区徽章、徽章展示策略、社区信用、活动模板增删改、客厅朋友新增与活动来源筛选、正文图片上传和伪图片拒绝、兜底双岗复核、富文本清洗、正文图片不计入描述长度校验、昵称报名、报名确认 token、无 token 访问 / 取消拦截、取消报名不进入当前身份我的报名、重复报名刷新 token、一人名额并发保护、报名昵称公示、感兴趣去重、最低报名未成团取消、历史活动按客厅 / 客厅朋友筛选、匿名活动反馈、反馈 AI 展示判断、反馈管理员待办、反馈展示 / 隐藏 / 恢复展示、反馈 CSV 导出、报名表、删除报名日志、删除协作员日志、取消活动日志、模板日志、日志脱敏、日志字段筛选、报名人数排序、过期活动自动归档、手动归档触发和跨天活动保留。
- Playwright 浏览器冒烟：管理员登录跳转、工作台概览卡片跳转、开放工作台资料摘要与身份网络 / 我的活动反馈子模块入口、身份网络独立管理页动作、我的活动反馈独立页、`identity-sync.html` 与 `my-feedbacks.html` 移动端无横向溢出、活动编辑分段步骤、活动详情发起人卡片和主页链接、公开发起人主页、移动端关键页面无横向溢出、社区治理新页面、客厅朋友 / 活动反馈新后台页面、近期 / 历史活动页、活动反馈二维码 JPG 下载、匿名反馈问卷页、活动编辑页模板下拉和 H1 工具、发起形式和反馈展示字段、富文本 H1 重复点击恢复正文、粘贴文本清洗、活动模板管理页富文本编辑器、活动邀请函 JPG 下载、报名成功页 token 访问、CSV 防公式注入、审核默认「请选择」、反馈审核待办、后台分组图标动效挂载和审核封面图 / 正文图片展示。

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

备份默认输出到 `output/backups/`，该目录不提交 Git；默认不导出 `sessions`，且会脱敏 token、API Key、手机号、联系方式等敏感字段。需要排查登录态时可使用 `npm run backup:data -- --include-sessions`；只有在加密离线应急归档场景才使用 `npm run backup:data -- --include-secrets`。

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
- 管理员和具备后台权限的角色登录后会进入第一个可访问的后台页面；普通协作员仍进入「我的」并看到自己的审核待办。
- YKadmin 工作台入口卡片。
- YKadmin / 开放工作台性能优化：入口卡片使用轻量 dashboard API 返回计数和待办预览；`0.20.2` 起「我的」工作台改为数据库计数聚合，避免首屏拉取完整活动列表。
- YKadmin 全部活动独立管理页，支持关键词、模块、状态、时间和排序筛选。
- YKadmin 用户管理独立页，支持关键词 / 角色筛选、新增用户、编辑昵称 / 手机号、分配单一角色和删除用户。
- YKadmin 角色权限列表页支持搜索、删除未使用自定义角色和进入编辑；新增 / 编辑角色进入独立详情页，并通过权限矩阵配置模块访问和动作权限。
- YKadmin 活动模块管理独立页。
- YKadmin 活动描述模板管理独立页，支持模板搜索、新增、编辑、删除和富文本正文维护。
- YKadmin 客厅的朋友们独立页，支持维护名称、简介、Logo、地址、联系人、联系方式和启用状态。
- YKadmin 活动反馈独立页，支持关键词 / 状态 / 活动 / 日期筛选、展示 / 不展示复核，以及活动 + 反馈 CSV 导出。
- YKadmin 操作日志独立页，支持关键词、操作类型、操作人、角色、日期范围筛选和分页加载，并仅保留最近 30 天日志。
- YKadmin 社区举报独立页，支持关键词、处理状态、举报原因和日期范围筛选，列表展示举报理由、活动状态、复核结论并可跳转活动和置信度详情。
- YKadmin 规则引擎页面，支持查看、新增、保存、删除风险规则，并通过 JSON 调整限流、Turnstile、举报阈值、风险分流策略和社区信用权重。
- YKadmin AI 控制台，支持查看 AI 总开关、当前主模型、备用模型数量、近 7 天调用、Prompt 当前版本，并在同页配置活动分析、活动反馈、举报复核、手动重分析的主模型 / 备用模型场景路由和系统每日调用上限。
- YKadmin AI 控制台新增社区健康概览，汇总安全分析队列、管理员复核、社区举报、反馈复核和近 7 天 AI 调用健康状态。
- YKadmin AI 模型配置，支持新增、编辑、删除、测试多个模型档案；模型档案包含 Provider、Base URL、Model、加密 API Key、超时、温度、Token、重试、启用状态、优先级和适用场景；可一键设为全部场景主模型，主模型失败时支持跨 Provider 故障转移。
- YKadmin AI Prompt 管理，支持按活动分析、活动反馈、举报复核场景筛选、新增、编辑、启用和删除 Prompt 版本；活动反馈 Prompt 不再需要手填隐藏 `feedback` 类型。
- YKadmin AI 用量健康，支持按整个系统和模型维度查看调用量、成功率、平均耗时、Token、缓存命中、失败次数和最近错误。
- YKadmin 社区治理旧总入口保留为兼容页面；正式工作台已取消总入口，把社区信用、信用策略、社区徽章和徽章展示策略直接放入社区治理分组，AI 分析和规则引擎放入安全与智能分组。
- YKadmin 信用策略页面，支持新增、编辑、删除事件驱动信用策略；策略由事件类型、条件 JSON、条件模式和 `trustDelta` 组成。
- YKadmin 社区徽章页面，支持新增、编辑、删除身份徽章、成就徽章和事件徽章；徽章获得规则通过 JSON Rule Builder 配置。
- YKadmin 徽章展示策略页面，支持配置徽章公开可见性、展示位置、图标 / 名称显示、悬停说明和排序。
- YKadmin 社区信用度页面，支持查看匿名身份社区信用列表、Community ID、社区等级、状态、徽章、脱敏 IP / UA、最近活动、信用度详情、社区时间线、策略命中、徽章授予记录和关联活动。
- YKadmin 活动置信度详情页，支持查看活动风险分、置信分、规则引擎明细、AI 分析报告、Prompt 版本、社区举报历史和强制重新分析。
- YKadmin 可取消或结束活动。
- 开放工作台入口卡片，工作台概览位于所有入口模块之后。
- 开放工作台新增「我的公开资料」，支持当前浏览器匿名身份维护头像、昵称和个人简介，并可进入自己的公开主页。
- 开放工作台新增「我的报名」和「我的活动反馈」，按当前浏览器匿名身份展示仍有效报名记录和已提交匿名反馈；取消报名后的活动不会展示在我的报名列表。
- 发起活动独立编辑页，按基本信息、活动介绍、报名设置、发布与高级设置分段，并把高级设置默认折叠。
- 我发起的活动独立管理页，支持筛选、撤回和报名表查看。
- 活动、协作员、模块和日志列表使用 API 分页；搜索条件只在点击「筛选」时生效。
- CloudBase 模式下列表查询通过存储层 `where/orderBy/skip/limit/count` 执行，避免云函数读取集合全量后再分页。
- CloudBase 模式下登录态、手机号登录和工作台概览使用字段级查询与计数，降低已登录页面首屏等待时间。
- 数据备份脚本支持本地 JSON 和 CloudBase NoSQL，默认导出协作员、模块、活动模板、活动、报名、操作日志和 Community OS / Governance 相关集合，并默认脱敏 token、API Key、手机号、联系方式等敏感字段；只有显式追加 `--include-secrets` 才会导出原始敏感字段。
- API 慢请求日志支持通过 `API_SLOW_LOG_MS` 调节阈值，便于定位缺索引和慢接口。
- `npm test` 自动化冒烟流程，覆盖 API 主链路和关键移动端浏览器布局。
- 审核待办独立页，管理员和协作员按自己的待办进入。
- 活动草稿、异步安全分析、直接发布、风险分流复核、编辑退回活动。
- 活动富文本编辑器：支持一级/二级/三级标题、加粗、引用、列表、分隔线和正文图片；正文图片 10MB 内可选，浏览器压缩后上传，服务端白名单清洗后保存。
- 发起活动页支持选择活动描述模板，默认不套用；已有正文时选择模板会弹窗确认是否覆盖当前描述。
- 发起活动页支持选择活动来源：默认「客厅」，也可选择已启用的「客厅的朋友们」。
- 发起活动页支持选择是否在活动详情展示通过后的匿名反馈，默认展示。
- 双岗审核流：管理员审核、协作员审核、通过/退回/拒绝。
- 发起人查看审核状态：草稿、审核中、退回、拒绝、活动发布、活动人满、活动取消、活动结束。
- 工作台概览卡片可点击跳转：全部、草稿、审核中、已发布分别进入对应活动筛选页。
- 发起人可撤回审核中、已发布、已满员活动，撤回后回到草稿。
- 活动详情页和访客报名。
- 活动详情页、报名成功页和公开活动卡支持展示发起人资料卡，可点击进入 `profile.html?id=...` 发起人公开主页。
- 活动提交异步分析队列：正式提交先进入 `analysis_pending` 并立即返回，后台任务完成后写入分析报告、风险快照、Community Event 和最终状态；撤回或重新编辑会递增 `analysisVersion`，旧分析任务不会覆盖新内容；CloudBase 线上队列支持恢复超时 `running` 任务和补建缺失任务。
- AI 强信号策略：明确营销、垃圾、诈骗、违法、成人和政治敏感内容会设置风险下限并隐藏转管理员审核；疑似营销保留公开但进入管理员关注待办。
- 社区举报复核：每条新举报都会触发活动重分析；举报成立或安全复核发现强风险时活动下架进入管理员审核，举报暂不成立只记录，达到多人举报阈值时展示中立风险提示。
- 活动详情页分享能力：下载活动邀请函、复制报名链接、下载 `.ics` 日历文件。
- 活动可选结束时间：支持跨天活动更精确归档，结束时间不能早于开始时间。
- 重复报名按浏览器匿名身份自动进入已有报名确认页。
- 报名成功后进入确认页，展示活动信息和报名昵称，并可取消报名。
- 发起人查看自己活动独立报名表，可删除报名记录并导出不含手机号的 CSV。
- 发起人可进入独立活动反馈页，下载反馈二维码并查看该活动的匿名反馈明细。
- 报名名额保护：活动报名、删除报名和取消报名统一维护报名数；满员活动删除报名后自动释放名额并回到可报名状态。
- 报名确认保护：公开报名成功页和公开取消报名必须携带报名时返回的确认 token，重复报名会刷新 token；后端不再向公开响应返回报名手机号、`phoneHash` 或访问令牌哈希。
- 文件与导出保护：上传图片会校验扩展名、MIME、文件内容魔数和图片像素上限，降低伪图片和解压炸弹风险；报名表 CSV 导出会为 `= + - @` 开头的单元格加保护前缀。
- 管理员查看系统内所有人、所有状态活动。
- 管理员查看操作日志。
- 首页和活动页动态读取活动列表。
- 首页近期活动区前移到「我们是谁」之前，最多展示 3 条，并在首页文案后横向排列活动纸条；首页「参加活动」和「查看所有近期活动」进入 `activities.html`。
- 独立近期 / 历史活动列表页：近期活动只展示未结束活动，历史活动展示自动归档后的「活动结束」和「未成团取消」活动，并可按「客厅」和「客厅的朋友们」筛选历史来源。
- 活动自动结束任务：发布 / 满员活动按结束时间或活动日期自动改为「活动结束」；设置最低报名限度的活动在最后报名日期后若未达最低人数会自动改为「未成团取消」；两类自动流转都会写入系统操作日志，并从首页和近期活动列表移除；管理员可手动触发补扫。
- CloudBase 动态部署、NoSQL 落库和 Storage 封面上传。
- 基础安全加固：CSP 等响应头、请求意图校验、综合匿名身份限流、服务端签名匿名 Cookie、管理 token 哈希存储 / 过期 / 撤销 / 身份绑定、Session HMAC 哈希、上传白名单、输入校验、过期 session 清理、日志脱敏和最小化手机号返回。
- 基础工程规范：`.gitignore`、环境变量示例、README、CHANGELOG、开发日志和 GitHub Actions CI。
- 前端功能模块拆分：富文本编辑器和活动分享能力已从主 `app.js` 拆到 `assets/js/`。
- 后端路由拆分起步：操作日志路由已拆到 `lib/routes/logs.js`。
- CI 增强：CloudBase dry-run 产物检查和 Playwright 视觉截图 artifact。
- CloudBase 静态构建自动发现根目录 HTML 页面，dry-run 校验所有页面都进入 `dist/`。
- CloudBase 查询和索引建议文档：`docs/cloudbase-indexes.md`。

## 已验证

- `Unreleased` 本地验证通过：`npm run miniprogram:check`、`npm test`、`npm run deploy:dry-run` 通过；新增服务端公开缓存响应头、`/api/public/bootstrap`、公开活动列表缓存命中、公开活动详情 base 缓存命中，以及小程序本地 SWR 缓存层。
- `0.29.0` 本地验证通过：`npm run miniprogram:check`、`npm test`、`npm run deploy:dry-run` 通过；新增覆盖活动系列默认数据、系列筛选、活动复盘接口、小程序通知配置和订阅偏好；PC 与小程序活动系列 / 复盘展示同步。
- `0.28.2` 本地验证通过：`my-feedbacks.html` 新增为独立子页面；「我的」工作台不再内嵌活动反馈列表，入口卡片直接跳转；冒烟覆盖页面打开、计数节点、返回路径和移动端无横向溢出。
- `0.28.1` 本地验证通过：工作台不再内嵌身份网络管理面板，“身份网络”入口跳转独立子页面；浏览器冒烟覆盖子页面开启 / 邀请动作入口和返回路径。
- `0.28.0` 本地验证通过：`npm test` 通过；新增覆盖匿名设备身份网络创建、同步邀请预览、跨设备合并、公开资料保留选择、身份网络下我的活动聚合、报名 / 感兴趣去重和 `identity-sync.html` 移动端无横向溢出。
- `0.27.0` 本地验证通过：`npm test` 通过；新增覆盖共同发起邀请 / 接受、编辑锁冲突与接管、过期版本提交拦截、共同发起人权限边界、共同发起人查看报名表 / 活动反馈，以及公开资料编辑页拆分。
- `0.26.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖匿名公开资料 API、公开发起人主页、活动卡 / 详情 / 成功页发起人展示、活动编辑分段步骤和 AI 控制台社区健康概览。
- `0.25.1` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖富文本 XSS、服务端签名匿名身份、管理 token 过期 / 撤销 / 身份绑定、AI Base URL SSRF、Prompt Injection 隔离、AI 每日调用预算、备份脱敏，以及新安全加固后的 CloudBase 构建检查。
- `0.25.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖 AI 模型档案默认迁移、活动反馈 Prompt 场景筛选与启用、主模型 500 失败后自动切换备用模型、模型维度用量统计和新 AI 页面静态构建。
- `0.24.1` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖用户管理页「新建角色」入口顺序、`admin-role-editor.html` 移动端无横向溢出和权限胶囊控件视觉状态。
- `0.24.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖角色权限 API、自定义角色分配、日志查看角色越权拦截、后台卡片权限过滤和 `admin-roles.html` 移动端无横向溢出。
- `0.23.4` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖未登录「我的」开放工作台 4 个基础入口、Octicon 风格图标、语义 tone、右侧箭头、锚点入口和待办区隐藏状态。
- `0.23.3` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖管理员工作台 Octicon 风格图标、语义 tone、右侧箭头和图标动效挂载。
- `0.23.2` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖主题按钮外圈尺寸保持、内部 SVG 图标不超过 16px，避免图标再次被后续覆盖层放大。
- `0.23.1` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖主题切换 cycling 状态、后台分组 SVG 图标动效挂载，以及 motion-design 图标 / 按钮 / 消息反馈层。
- `0.23.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖活动反馈二维码 JPG 下载、活动邀请函 JPG 下载、管理员反馈待办、反馈展示 / 隐藏 / 恢复展示、规则引擎参数文本框样式一致性和后台分组入口。
- `0.22.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖客厅朋友维护、活动来源筛选、历史活动按客厅 / 客厅朋友筛选、取消报名不进入当前设备我的报名、匿名活动反馈、反馈 AI 展示判断、反馈管理员复核、反馈 CSV 导出，以及新反馈页面移动端无横向溢出。
- `0.21.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 通过；新增覆盖昵称报名、匿名身份重复报名、报名昵称公示、感兴趣去重、最低报名未成团取消和活动邀请函不含手机号。
- `0.20.2` 本地验证通过：`npm test` 与 `npm run deploy:dry-run` 通过；新增覆盖登录身份与匿名身份同时命中同一活动时，工作台和我发起的活动列表不会重复计数。
- `0.20.2` CloudBase 索引已通过 CLI 创建并抽样验证，覆盖 `yk_activities`、`yk_logs`、`yk_trustProfiles`、`yk_aiPrompts` 等关键集合；详见 `docs/cloudbase-indexes.md`。
- `0.20.1` 本地验证通过：`npm test` 通过，新增覆盖置信度页强制重新分析会绕过 AI 缓存、记录当前 Prompt 版本，以及 `analysis_pending` 活动在分析任务缺失时可被 sweep 恢复。
- `0.20.0` 本地验证通过：`npm test` 通过，包含语法检查、API 冒烟和 Playwright 浏览器冒烟；新增覆盖异步活动安全分析、AI 明确营销强信号转隐藏管理员审核、社区举报后台列表、活动置信度页举报历史和新后台举报页面移动端无横向溢出。
- `0.19.1` 本地验证通过：`npm run test:syntax` 和 `npm run test:smoke` 均通过；新增覆盖规则置信度阈值 100 触发真实 AI 请求、AI 关闭时中高风险活动进入管理员审核、AI 不可用兜底原因写入活动置信度详情、重点风险词命中规则。
- `0.19.0` 本地验证通过：`npm run test:syntax` 和 `npm run test:smoke` 均通过；新增覆盖 Community Governance 默认策略、身份详情事件流、Trust Policy 增删改、Community Badge 增删、Badge Policy 保存，以及新后台页面移动端无横向溢出。
- `0.18.1` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 均通过；新增覆盖 AI 规则置信度阈值、匿名身份前 N 场必调 AI、AI 设置深合并和规则权重变更后的活动重新分析回归。
- `0.18.0` 本地验证通过：`npm run test:syntax`、`npm run test:smoke`、`npm test` 和 `npm run deploy:dry-run` 均通过。
- `0.18.0` API 冒烟新增覆盖：匿名发起活动、匿名管理 token、低风险直接发布、高风险进入兜底双岗复核、规则引擎配置、活动置信度详情、AI 设置脱敏与测试连接、社区反馈、Community Trust 列表 / 详情和活动重新分析。
- `0.18.0` Playwright 冒烟新增覆盖：开放工作台未登录可进入、发起活动页无需登录、活动详情风险提示与举报入口、新增规则引擎 / AI 分析 / 社区信用度 / 置信度页面移动端无横向溢出。
- `0.17.4` 本地验证通过：`npm test` 通过；白天模式公开页白底 / 近白底文字对比度扫描结果为 0 个低对比项，报名成功页主说明和信息标签已纳入冒烟断言。
- `0.17.3` 本地验证通过：`npm test` 通过；冒烟测试强制切换到白天模式，确认活动详情页地点 / 时间文字颜色为更深墨色且字重提升。
- `0.17.2` 本地验证通过：`npm test` 通过；新增移动端活动详情长腾讯会议链接不横向溢出断言，并检查发起人联系方式与上方活动元信息之间的计算间距。
- `0.17.1` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 均通过；Playwright 计算样式抽检确认 1440px 首页近期活动海报与文字间距为 `36px`，390px 移动端仍保持上下堆叠。
- `0.17.0` 本地验证通过：`npm test` 和 `npm run deploy:dry-run` 均通过。
- `0.17.0` 冒烟测试新增覆盖：伪图片上传拒绝、报名确认 token、无 token 访问 / 取消拦截、重复报名刷新 token、CSV 防公式注入和报名成功页 token 访问。
- `0.17.0` 安全审计已执行：`npm audit --omit=dev` 仍报告 CloudBase SDK 传递依赖 `axios@0.27.2`、`lodash.set@4.3.2`、`lodash.unset@4.5.2` 风险；当前记录为上游 SDK 遗留风险，不做破坏性 override。
- `0.16.5` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.16.5` 视觉抽检通过：`desktop-home.png` 首页近期活动已铺满内容区，呈现为完整宽度横向活动长条；`mobile-admin-activities.png` 活动操作按钮为右侧竖排同宽按钮列。
- `0.16.4` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.16.4` 视觉抽检通过：`desktop-home.png` 首页近期活动为两条横向活动行；`mobile-admin-activities.png` 多操作按钮为稳定两列等宽布局。
- `0.16.3` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 均通过。
- `0.16.3` Playwright 冒烟新增覆盖：分享海报文字预览断言标题和值不含 `【】`，日期格式为完整年月日时间，二维码标题存在且不展示明文 URL。
- `0.16.2` 本地验证通过：`npm run test:syntax`、`npm test`、`npm run deploy:dry-run` 和 `npm run test:visual` 均通过。
- `0.16.2` 视觉抽检通过：`desktop-review-tasks.png` 中审核意见、备注和提交按钮已在 PC 端统一对齐；`mobile-review-tasks.png` 保持原有单列布局。
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
- 本地 JSON 模式 API 冒烟通过：草稿和审核中活动报名返回 `400`，已发布活动昵称报名返回 `200`，重复匿名身份可刷新报名确认页，满员 / 结束活动不接受新报名。
- 本地 JSON 模式 API 冒烟通过：管理员登录、成员/协作员新增、草稿保存、活动提审、管理员审核、协作员审核、访客报名、重复报名、取消报名、撤回活动。
- 本地浏览器回归通过：普通成员不展示待办任务区，管理员审核待办可展开查看封面图，草稿详情页不展示报名表，保存操作出现“保存成功”轻提示。
- 本地浏览器视觉检查通过：PC 后台审核卡片、移动端活动详情报名表、移动端「我的」页面表单和按钮单列展示，无明显挤压错乱。
- 本地 JSON 模式 API 冒烟通过：默认人数 99、服务端分页、两岗审核、重复报名找回确认页、独立报名表、操作日志搜索、管理员结束活动。
- 本地 Playwright 移动端验证通过：390px 下发起活动时间字段、全部活动开始/结束日期筛选、成员管理角色下拉、报名表和操作日志页面均无横向溢出。
- 本地 Playwright 审核待办验证通过：审核意见默认「请选择」，上传封面图可在待办详情中查看。
- CloudBase 线上 API 冒烟通过：成员/协作员新增、活动草稿、提交审核、管理员审核、协作员审核、重复报名、取消报名。
- CloudBase 静态页移动端浏览器验证通过：登录页输入 `已隐藏` 后跳转 `admin.html`，后台待办区和协作员角色控件可见。
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
- 生产启用 Turnstile：在 Cloudflare 获取 Site Key / Secret Key 后写入 CloudBase 环境变量，并在规则引擎页开启策略。
- 生产启用 AI 分析引擎：先在 AI 模型配置中创建主模型和备用模型，进入 AI 控制台配置活动分析 / 活动反馈 / 举报复核场景路由，再在 Prompt 管理中确认当前启用版本，并用用量健康页观察成功率和错误。
- `0.22.0` 新增「客厅的朋友们」和匿名活动反馈集合，CloudBase 需要补充 `yk_livingRoomFriends`、`yk_activityFeedbacks` 以及 `yk_activities.sourceType / friendId` 相关索引，详见 `docs/cloudbase-indexes.md`。
- 管理员仪表盘统计：增加风险分布、举报趋势、AI 调用量、信用度变化和活动发布转化概览。
- CloudBase 恢复演练和权限策略文档。
- 自定义域名和同源 API 路由，减少跨域 Cookie 运维复杂度。
- 继续拆分前后端大文件：优先迁移 auth、activities、safety、ai、trust、reports 路由，以及前端活动 / 后台 / 主题页面控制器，并逐步补 JSDoc / TypeScript 类型边界。
- 如报名量继续增大，需要把当前进程内活动报名锁升级为数据库事务、唯一索引或队列型全局锁。

## 未来规划

- 支持审核通知、审核超时提醒和更细权限模型。
- 支持 Notion / 飞书表格同步活动日历。
- 增加财务公示模块和捐赠记录管理。
- 基于社区信用继续扩展志愿者体系、活动推荐权重和社区自治提案能力。
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
