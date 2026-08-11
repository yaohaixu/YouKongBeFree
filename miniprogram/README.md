# 有空客厅微信小程序

这是有空客厅 Community OS 的原生微信小程序前端。首版复用现有 CloudBase API，优先迁移普通用户、活动参与者和活动发起人的核心流程。

## 导入微信开发者工具

1. 打开微信开发者工具。
2. 选择「导入项目」。
3. 项目目录选择：`/Users/yaohaixu/Documents/有空客厅/miniprogram`。
4. 当前 AppID 已配置为：`wx5020d6431cfac041`。
5. 第一次本地联调时，如果尚未配置合法域名，可以在「详情」里临时勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。上线前必须关闭，并在微信公众平台配置合法域名。

## 需要配置的合法域名

- request 合法域名：`https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com`
- uploadFile 合法域名：`https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com`
- downloadFile 合法域名：活动封面所在的 CloudBase 临时文件域名；本地调试可先关闭合法域名校验，上线前按 `getTempFileURL` 返回域名补齐

## 当前页面

- 首页：`pages/home/home`
- 活动列表：`pages/activities/activities`，已接入近期/历史活动，历史活动可按「客厅 / 客厅的朋友们」筛选，近期和历史都可按活动系列筛选，活动卡片展示活动系列、最低成团人数和报名截止信息
- 活动详情：`pages/activity-detail/activity-detail`，已接入报名昵称、感兴趣、活动提醒订阅、复制链接、活动二维码 JPG、活动邀请函 JPG、活动举报、公开报名昵称展示、最低成团规则、报名截止提示、共同发起人入口和发起人管理入口
- 报名成功页：`pages/registration-success/registration-success`，报名后展示确认信息，可下载活动邀请函 JPG、复制活动链接、取消报名或回到「我的报名」
- 发起活动：`pages/activity-editor/activity-editor`，已接入封面上传、活动系列、活动描述模板、客厅朋友主体、富文本编辑器、正文图片插入、草稿保存、编辑已有活动、提交安全分析、公开报名昵称、展示反馈、最低报名限度和共同发起人邀请；富文本编辑区会随内容动态增高，正文图片预览和活动详情展示会自动适配手机页面宽度
- 活动反馈：`pages/feedback/feedback`，已接入匿名反馈提交，复用现有反馈 AI 分析和管理员兜底流程
- 我的：`pages/me/me`，已接入公开资料入口、发起活动、我的报名、我的活动、我的反馈、同步设备入口
- 我的报名：`pages/registrations/registrations`，已接入当前设备报名取消
- 我的活动：`pages/my-activities/my-activities`，已接入编辑活动、查看报名表、撤回为草稿、取消活动、结束活动
- 我的反馈：`pages/my-feedbacks/my-feedbacks`
- 同步设备：`pages/identity-sync/identity-sync`，已接入开启身份网络、生成同步链接、扫码/粘贴同步、合并预览，并支持可选绑定微信小程序身份用于换设备找回
- 编辑公开资料：`pages/profile-editor/profile-editor`，已接入头像、昵称、个人简介保存
- 公开资料页：`pages/profile/profile`，已接入头像昵称简介、徽章、活动和基础统计
- 共同发起邀请：`pages/co-invite/co-invite`，已接入邀请读取、资料校验和接受邀请
- 活动报名表：`pages/activity-registrations/activity-registrations`，已接入发起人查看和删除报名记录，并展示报名限额、剩余名额和成团规则
- 活动反馈管理：`pages/activity-feedbacks/activity-feedbacks`，已接入发起人查看活动匿名反馈明细、活动复盘摘要、按展示状态筛选、下载反馈二维码 JPG、复制反馈文本，并支持发起人隐藏已展示反馈或恢复自己隐藏过的反馈
- 活动公开反馈：活动详情页展示后台已通过的精选匿名反馈
- 手机日历：活动详情页可调用微信 `addPhoneCalendar` 加到系统日历
- 小程序通知：活动提醒订阅模板 ID 通过服务端 `WECHAT_MP_ACTIVITY_REMINDER_TEMPLATE_IDS` 配置；未配置时详情页会提示暂未开启提醒

## 后续优先级

1. 为小程序补一套不依赖 Turnstile 的轻量风控兜底。
2. 继续补邀请函预览和更完整的相册授权引导。
3. 再考虑审核待办等轻后台能力；AI、规则引擎、角色权限等配置模块仍保留在 Web 后台。

## 富文本编辑说明

- 小程序发起活动页使用微信官方 `editor` 组件，不额外引入重型编辑器依赖。
- 工具栏保留正文、H1、加粗、斜体、下划线、项目列表、编号列表、分隔线、撤销、重做、插入图片和清空。
- 正文图片选择后会先走微信压缩能力，再按压缩后的临时文件实际大小校验；压缩后需在 10MB 以内。
- 插入正文图片时会写入页面宽度约束；编辑预览和活动详情会再次对 `<img>` 做响应式展示兜底，避免图片撑出页面。
