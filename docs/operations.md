# 运维手册

本文档记录有空客厅线上运行需要定期执行或检查的事项。

## 数据备份

本地 JSON 数据备份：

```bash
npm run backup:data
```

CloudBase 线上数据备份：

```bash
STORE_DRIVER=cloudbase CLOUDBASE_ENV_ID=youkong-d5gh4x0ayc29a2187 npm run backup:data
```

默认输出目录为 `output/backups/`，该目录已被 Git 忽略。备份默认导出：

- `users`
- `modules`
- `templates`
- `activities`
- `registrations`
- `logs`

默认不导出 `sessions`，避免把 session hash 写入备份文件。如确需完整排查登录态，可追加：

```bash
npm run backup:data -- --include-sessions
```

建议频率：

- 每次重要上线前备份一次。
- 每周至少备份一次线上数据。
- 删除成员、模块或大量活动前先备份。

## API 慢请求日志

后端会记录慢 API 和 5xx 错误到本地控制台或 CloudBase 云函数日志。

相关环境变量：

```env
API_TIMING_LOGS=true
API_SLOW_LOG_MS=1200
```

日志格式示例：

```text
[youkong-api] {"event":"api_slow","method":"GET","path":"/api/dashboard/admin","statusCode":200,"durationMs":1602,"thresholdMs":1200,"storeDriver":"cloudbase"}
```

判断方式：

- `event=api_slow`：接口超过阈值，需要看是否缺索引或响应体过大。
- `event=api_error`：接口返回 5xx，需要优先排查。
- `path`：慢接口路径，不记录 query 和 body，避免泄露手机号等输入内容。

## CloudBase 索引检查

索引建议见 `docs/cloudbase-indexes.md`。当前最需要确认的是：

- `yk_sessions`: `tokenHash`
- `yk_users`: `phone`
- `yk_activities`: `createdBy + createdAt`
- `yk_activities`: `status + collaboratorId + createdAt`
- `yk_activities`: `status + startsAt`
- `yk_templates`: `updatedAt + createdAt`
- `yk_registrations`: `activityId + createdAt`
- `yk_registrations`: `activityId + phoneHash`
- `yk_logs`: `createdAt`
- `yk_logs`: `action + createdAt`
- `yk_logs`: `actorId + createdAt`
- `yk_logs`: `actorRole + createdAt`

新增筛选条件后，需要同步更新 `docs/cloudbase-indexes.md` 和本文件。

## 部署前检查

每次准备发布前先执行：

```bash
npm run deploy:dry-run
```

该命令会重新构建 CloudBase Hosting 静态目录和云函数包，并检查关键文件是否存在、是否误打包 `.env`、`node_modules` 或真实数据文件。

## 视觉截图

需要人工查看关键页面视觉状态时执行：

```bash
npm run test:visual
```

截图输出到 `test-results/visual/`，本地不会提交 Git。GitHub Actions 会在 CI 中生成同样截图并上传为 artifact，便于发版前对比首页、登录、后台、活动编辑页和活动模板管理页。
