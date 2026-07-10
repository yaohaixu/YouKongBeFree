# CloudBase 查询与索引建议

本项目 `0.7.0` 起，活动、成员、模块和操作日志列表通过 `store.query()` 进入存储层查询。JSON 本地模式会模拟同样的筛选、排序和分页语义；CloudBase 模式会使用 `where`、`orderBy`、`skip`、`limit` 和 `count` 下推到数据库查询层。

## 推荐索引

建议在 CloudBase 控制台为以下集合建立索引，避免数据量增长后列表筛选变慢。

### `yk_activities`

- `status + startsAt`：公开活动列表和状态筛选。
- `createdBy + createdAt`：成员查看「我发起的活动」。
- `status + collaboratorId + createdAt`：协作员审核待办。
- `moduleId + startsAt`：按模块和活动时间筛选。
- `registrationCount + createdAt`：按报名人数排序。
- `createdAt`：管理员全部活动默认排序。

### `yk_users`

- `id`：保证默认管理员排序和单条更新。
- `roles`：按成员 / 协作员筛选。
- `phone`：登录和成员搜索。
- `nickname`：成员搜索。

### `yk_modules`

- `createdAt`：模块管理默认排序。
- `name`：模块搜索。

### `yk_logs`

- `createdAt`：操作日志默认倒序。
- `action`：按操作类型排查。
- `actorPhone`：按手机号追踪操作。
- `targetName`：按活动 / 模块 / 成员名称搜索。

### `yk_registrations`

- `activityId + createdAt`：活动报名表。
- `activityId + phone`：重复报名识别。

## 仍需注意

- 当前关键词搜索使用正则匹配，适合 MVP 阶段；如果日志或活动数量继续增长，建议增加更明确的筛选条件，例如操作类型、操作人、时间范围，而不是依赖宽泛关键词。
- 活动列表里的模块名、发起人名、协作员名仍由 API 聚合补齐；如需完全基于索引搜索这些派生字段，可在活动记录中增加冗余字段并在对应对象更新时同步维护。
- CloudBase 控制台中的索引变更属于线上数据配置，不提交 Git；每次新增筛选字段后都应同步更新本文档。
