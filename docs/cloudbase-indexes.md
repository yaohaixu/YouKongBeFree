# CloudBase 查询与索引建议

本项目 `0.7.0` 起，活动、协作员、模块和操作日志列表通过 `store.query()` 进入存储层查询。JSON 本地模式会模拟同样的筛选、排序和分页语义；CloudBase 模式会使用 `where`、`orderBy`、`skip`、`limit` 和 `count` 下推到数据库查询层。`0.8.0` 起，活动自动结束任务也会按 `status + startsAt` 查询过期待归档活动。`0.9.0` 起，跨天活动可填写 `endsAt`，但 sweep 仍用 `status + startsAt` 缩小候选，再用 `endsAt` 做最终判断，暂不要求新增 `endsAt` 索引。`0.10.0` 起，报名记录新增 `phoneHash` 用于重复报名识别，操作日志手机号改为脱敏保存。`0.13.4` 起，登录态、手机号登录和工作台 dashboard 也使用字段查询与计数接口，建议同步补齐对应索引。`0.13.5` 起，API 慢请求会写入 CloudBase 云函数日志，可用日志中的 `path` 对照本文档补索引。`0.14.0` 起，操作日志页支持操作类型、操作人、角色和日期范围组合筛选，建议补充 `yk_logs` 组合索引。`0.15.0` 起新增活动描述模板集合 `yk_templates`，发起活动时会读取模板列表，管理员模板管理页会按更新时间分页和关键词搜索。`0.18.0` 起新增 Community OS 安全架构集合，规则引擎、匿名身份、Community Trust、社区反馈、活动置信度和 AI Analysis Engine 均建议按本文补充索引。`0.19.0` 起新增 Community Governance 集合，Trust Policy、Community Badge、Badge Policy 和统一 Community Event 时间线建议按本文补齐索引。`0.20.0` 起活动发布改为异步安全分析，并新增社区举报后台，建议补齐 `yk_activityAnalysisJobs` 和 `yk_communityReports.status + createdAt` 相关索引。

## 推荐索引

建议在 CloudBase 控制台为以下集合建立索引，避免数据量增长后列表筛选变慢。

### `yk_activities`

- `status + startsAt`：公开近期 / 历史活动列表、状态筛选和自动结束 sweep。
- `status + createdAt`：管理员审核待办、状态计数和 dashboard 预览。
- `anonymousIdentityId + createdAt`：未登录用户查看同一浏览器「我发起的活动」。
- `createdBy + createdAt`：兼容旧登录用户或协作员身份发起的活动。
- `status + collaboratorId + createdAt`：协作员审核待办。
- `moduleId + startsAt`：按模块和活动时间筛选。
- `analysisReportId + createdAt`：活动置信度详情和重新分析追踪。
- `riskScore + createdAt`：后台按风险分排查活动，后续做低置信活动队列时可复用。
- `registrationCount + createdAt`：按报名人数排序。
- `createdAt`：管理员全部活动默认排序。

### `yk_users`

- `id`：保证默认管理员排序和单条更新。
- `roles`：按协作员筛选。
- `phone`：管理员 / 协作员登录和手机号白名单校验。
- `nickname`：协作员搜索。

### `yk_sessions`

- `tokenHash`：已登录页面读取 `/api/session`、工作台和后台接口时定位当前会话。
- `userId`：后续如需按治理账号清理会话或查看登录设备，可复用。
- `expiresAt`：过期 session 清理。

### `yk_modules`

- `createdAt`：模块管理默认排序。
- `name`：模块搜索。

### `yk_templates`

- `updatedAt + createdAt`：模板管理默认倒序和发起活动页模板下拉读取。
- `name`：模板名称搜索。
- `createdBy + updatedAt`：后续如需按创建人追踪模板可复用。

### `yk_logs`

- `createdAt`：操作日志默认倒序。
- `action + createdAt`：按操作类型和日期范围排查。
- `actorId + createdAt`：按具体操作人和日期范围排查。
- `actorRole + createdAt`：按管理员 / 协作员 / 访客 / 系统角色排查。
- `actorPhone`：按脱敏手机号追踪操作，不能再用完整手机号精确搜索。
- `actorName`：按操作人昵称搜索。
- `targetName`：按活动 / 模块 / 协作员名称搜索。

### `yk_registrations`

- `activityId + createdAt`：活动报名表。
- `activityId + phone`：重复报名识别。
- `activityId + phoneHash`：`0.10.0` 之后新增报名记录的重复报名识别，建议优先使用。

### `yk_safetyRules`

- `enabled + priority`：按启用状态和执行顺序读取规则引擎规则。
- `type + enabled`：管理员按规则类型筛选和后续分组维护。
- `updatedAt`：规则变更审计和后台列表排序。

### `yk_systemConfigs`

- `key`：读取安全策略、限流、Turnstile、AI 设置和 Community Trust 权重配置。
- `updatedAt`：后续做配置历史或后台排序时复用。

### `yk_anonymousIdentities`

- `identityHash`：综合匿名身份登录态、限流和活动归属定位。
- `clientIdHash + updatedAt`：同一浏览器 LocalStorage UUID 的身份查找。
- `fingerprintHash + updatedAt`：浏览器指纹维度排查异常行为。
- `lastSeenAt`：后续清理长期不活跃匿名身份。

### `yk_trustProfiles`

- `identityId`：Community Trust 详情页读取单个匿名身份画像。
- `communityTrust + updatedAt`：后台按社区信用度排序排查。
- `communityId + updatedAt`：后台按短 Community ID 搜索身份。
- `status + updatedAt`：观察期 / 限制发布身份排查。
- `communityLevel + updatedAt`：按社区等级筛选和后续治理统计。
- `lastActivityAt`：查找近期活跃发起者。
- `ipMasked + updatedAt`：管理员按脱敏 IP 线索排查，不保存完整 IP。

### `yk_communityEvents`

- `identityId + createdAt`：Community Trust 详情页按匿名身份读取统一事件时间线。
- `type + createdAt`：按事件类型排查策略触发情况，如 `activity.confidence.evaluated`、`community.report.confirmed`。
- `activityId + createdAt`：按活动追踪置信度、举报、报名和发布事件。
- `source + createdAt`：按活动、举报、报名、系统等来源分组排查。

### `yk_trustEvents`

- `identityId + createdAt`：社区信用度详情页时间线。
- `activityId + createdAt`：按活动追踪信用度变化原因。
- `delta + createdAt`：排查大幅加分 / 降分事件。

### `yk_trustPolicies`

- `eventType + enabled`：按事件类型读取可用 Trust Policy。
- `enabled + order`：后台策略列表和事件评估时按启用状态、排序读取。
- `updatedAt`：策略变更排查。

### `yk_communityBadges`

- `type + enabled`：按身份徽章、成就徽章、事件徽章分组维护。
- `enabled + order`：徽章授予评估和后台列表排序。
- `name`：徽章搜索。

### `yk_identityBadges`

- `identityId + status`：读取某个匿名身份当前生效徽章。
- `badgeId + status`：删除或调整某个徽章时排查授予记录。
- `grantedAt`：徽章时间线排序。

### `yk_badgePolicies`

- `badgeId`：徽章展示策略读取和徽章删除时联动清理。
- `publicVisible + order`：未来公开页筛选可展示徽章。
- `enabled + order`：后台展示策略列表排序。

### `yk_rateEvents`

- `identityId + scope`：匿名身份在不同写操作场景下的限流窗口。
- `identityId + resetAt`：清理已过期限流窗口。
- `resetAt`：全局限流事件清理任务。

### `yk_analysisReports`

- `activityId + createdAt`：活动置信度详情和历史分析记录。
- `identityId + createdAt`：按发起者追踪 AI / 规则分析历史。
- `riskScore + createdAt`：低置信活动排查和后续推荐降权。
- `riskLevel + createdAt`：后台按风险等级筛选。

### `yk_activityAnalysisJobs`

- `status + createdAt`：后台分析队列按待处理状态顺序 sweep。
- `activityId + activityVersion`：定位某条活动当前分析版本，排查旧任务是否被跳过。
- `updatedAt`：排查长期卡在 `pending` / `running` 的任务。

### `yk_communityReports`

- `activityId + createdAt`：活动详情统计举报数量和后台查看举报明细。
- `identityId + activityId`：同一匿名身份对同一活动重复举报控制。
- `status + createdAt`：社区举报后台按已提交、举报成立、已记录等状态筛选。
- `reason + createdAt`：按举报原因排查集中问题。

### `yk_aiPrompts`

- `type + active`：按业务类型读取当前启用 Prompt。
- `type + version`：Prompt 版本切换和回滚。
- `updatedAt`：后台 Prompt 管理排序。

### `yk_aiCache`

- `cacheKey`：相同内容短时间重复分析时读取缓存。
- `expiresAt`：清理过期 AI 分析缓存。

### `yk_aiUsageLogs`

- `provider + createdAt`：按 Provider 统计调用次数和耗时。
- `activityId + createdAt`：查看某个活动触发过哪些 AI 分析。
- `createdAt`：后台用量趋势和保留策略。

## 仍需注意

- 当前关键词搜索使用正则匹配，适合 MVP 阶段；日志排查应优先使用操作类型、操作人、角色和时间范围等明确筛选条件，再用关键词缩小范围。
- 活动列表里的模块名、发起人名、协作员名和匿名身份摘要仍由 API 聚合补齐；如需完全基于索引搜索这些派生字段，可在活动记录中增加冗余字段并在对应对象更新时同步维护。
- 旧报名记录可能没有 `phoneHash` 字段；代码仍兼容 `phone` 判断。后续如做数据整理，可批量回填 `phoneHash`。
- CloudBase 控制台中的索引变更属于线上数据配置，不提交 Git；每次新增筛选字段后都应同步更新本文档。
