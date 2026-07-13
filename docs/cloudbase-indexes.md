# CloudBase 查询与索引建议

本项目 `0.7.0` 起，活动、成员、模块和操作日志列表通过 `store.query()` 进入存储层查询。JSON 本地模式会模拟同样的筛选、排序和分页语义；CloudBase 模式会使用 `where`、`orderBy`、`skip`、`limit` 和 `count` 下推到数据库查询层。`0.8.0` 起，活动自动结束任务也会按 `status + startsAt` 查询过期待归档活动。`0.9.0` 起，跨天活动可填写 `endsAt`，但 sweep 仍用 `status + startsAt` 缩小候选，再用 `endsAt` 做最终判断，暂不要求新增 `endsAt` 索引。`0.10.0` 起，报名记录新增 `phoneHash` 用于重复报名识别，操作日志手机号改为脱敏保存。`0.13.4` 起，登录态、手机号登录和工作台 dashboard 也使用字段查询与计数接口，建议同步补齐对应索引。`0.13.5` 起，API 慢请求会写入 CloudBase 云函数日志，可用日志中的 `path` 对照本文档补索引。`0.14.0` 起，操作日志页支持操作类型、操作人、角色和日期范围组合筛选，建议补充 `yk_logs` 组合索引。`0.15.0` 起新增活动描述模板集合 `yk_templates`，成员发起活动时会读取模板列表，管理员模板管理页会按更新时间分页和关键词搜索。

## 推荐索引

建议在 CloudBase 控制台为以下集合建立索引，避免数据量增长后列表筛选变慢。

### `yk_activities`

- `status + startsAt`：公开近期 / 历史活动列表、状态筛选和自动结束 sweep。
- `status + createdAt`：管理员审核待办、状态计数和 dashboard 预览。
- `createdBy + createdAt`：成员查看「我发起的活动」。
- `status + collaboratorId + createdAt`：协作员审核待办。
- `moduleId + startsAt`：按模块和活动时间筛选。
- `registrationCount + createdAt`：按报名人数排序。
- `createdAt`：管理员全部活动默认排序。

### `yk_users`

- `id`：保证默认管理员排序和单条更新。
- `roles`：按成员 / 协作员筛选。
- `phone`：登录、成员搜索和手机号白名单校验。
- `nickname`：成员搜索。

### `yk_sessions`

- `tokenHash`：已登录页面读取 `/api/session`、工作台和后台接口时定位当前会话。
- `userId`：后续如需按成员清理会话或查看登录设备，可复用。
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
- `actorRole + createdAt`：按管理员 / 协作员 / 成员 / 访客 / 系统角色排查。
- `actorPhone`：按脱敏手机号追踪操作，不能再用完整手机号精确搜索。
- `actorName`：按操作人昵称搜索。
- `targetName`：按活动 / 模块 / 成员名称搜索。

### `yk_registrations`

- `activityId + createdAt`：活动报名表。
- `activityId + phone`：重复报名识别。
- `activityId + phoneHash`：`0.10.0` 之后新增报名记录的重复报名识别，建议优先使用。

## 仍需注意

- 当前关键词搜索使用正则匹配，适合 MVP 阶段；日志排查应优先使用操作类型、操作人、角色和时间范围等明确筛选条件，再用关键词缩小范围。
- 活动列表里的模块名、发起人名、协作员名仍由 API 聚合补齐；如需完全基于索引搜索这些派生字段，可在活动记录中增加冗余字段并在对应对象更新时同步维护。
- 旧报名记录可能没有 `phoneHash` 字段；代码仍兼容 `phone` 判断。后续如做数据整理，可批量回填 `phoneHash`。
- CloudBase 控制台中的索引变更属于线上数据配置，不提交 Git；每次新增筛选字段后都应同步更新本文档。
