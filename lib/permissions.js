const PERMISSION_ACTIONS = [
  { key: "view", label: "查看" },
  { key: "create", label: "新增" },
  { key: "edit", label: "编辑" },
  { key: "delete", label: "删除" },
  { key: "review", label: "审核" },
  { key: "export", label: "导出" },
  { key: "configure", label: "配置" },
  { key: "reanalyze", label: "重新分析" },
  { key: "cancel", label: "取消活动" },
  { key: "end", label: "结束活动" },
];

const PERMISSION_MODULES = [
  {
    key: "dashboard",
    label: "后台工作台",
    group: "系统维护",
    description: "进入后台工作台和查看管理入口。",
    actions: ["view"],
  },
  {
    key: "reviewTasks",
    label: "审核待办",
    group: "待办",
    description: "处理活动和反馈的兜底复核任务。",
    actions: ["view", "review"],
  },
  {
    key: "activities",
    label: "全部活动",
    group: "活动运营",
    description: "查看、复核、取消、结束和重新分析所有活动。",
    actions: ["view", "review", "reanalyze", "cancel", "end", "export"],
  },
  {
    key: "modules",
    label: "模块管理",
    group: "活动运营",
    description: "维护活动分类模块。",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "templates",
    label: "活动模板",
    group: "活动运营",
    description: "维护活动描述模板。",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "friends",
    label: "客厅的朋友们",
    group: "活动运营",
    description: "维护朋友主体、Logo、地址和联系方式。",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "feedbacks",
    label: "活动反馈",
    group: "活动运营",
    description: "查看、复核、展示 / 隐藏和导出活动反馈。",
    actions: ["view", "review", "edit", "export"],
  },
  {
    key: "reports",
    label: "社区举报",
    group: "社区治理",
    description: "查看社区举报、举报复核和活动下架原因。",
    actions: ["view", "review"],
  },
  {
    key: "trust",
    label: "社区信用",
    group: "社区治理",
    description: "查看匿名身份、社区信用度和成长时间线。",
    actions: ["view"],
  },
  {
    key: "trustPolicy",
    label: "社区信用策略",
    group: "社区治理",
    description: "配置活动置信度、社区事件和信用变化之间的关系。",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  {
    key: "badges",
    label: "社区徽章",
    group: "社区治理",
    description: "维护身份徽章、成就徽章和事件徽章。",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  {
    key: "badgePolicy",
    label: "徽章展示策略",
    group: "社区治理",
    description: "配置徽章展示位置、名称、图标和公开策略。",
    actions: ["view", "edit", "configure"],
  },
  {
    key: "safety",
    label: "规则引擎",
    group: "安全与智能",
    description: "配置开放发布风险规则和兜底策略。",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  {
    key: "ai",
    label: "AI 分析",
    group: "安全与智能",
    description: "配置 AI Provider、Prompt、能力和调用策略。",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  {
    key: "users",
    label: "用户管理",
    group: "用户与权限",
    description: "维护可登录后台的用户、手机号和角色。",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "roles",
    label: "角色权限管理",
    group: "用户与权限",
    description: "新增角色，并配置每个角色可以访问的模块和动作。",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  {
    key: "logs",
    label: "操作日志",
    group: "系统维护",
    description: "查看系统关键操作留痕。",
    actions: ["view", "export"],
  },
];

function fullPermissions() {
  return Object.fromEntries(PERMISSION_MODULES.map((module) => [module.key, [...module.actions]]));
}

const COLLABORATOR_PERMISSIONS = {
  reviewTasks: ["view", "review"],
};

const DEFAULT_ROLE_DEFINITIONS = [
  {
    id: "admin",
    key: "admin",
    name: "有空管理员",
    description: "系统内置超级管理员，拥有全部模块和动作权限，不能删除或降权。",
    builtIn: true,
    locked: true,
    permissions: fullPermissions(),
  },
  {
    id: "collaborator",
    key: "collaborator",
    name: "协作员",
    description: "系统内置协作角色，默认只处理分配给自己的活动复核待办。",
    builtIn: true,
    locked: false,
    permissions: COLLABORATOR_PERMISSIONS,
  },
];

function normalizeRoleKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/^member$/, "collaborator")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40) || "collaborator";
}

function normalizePermissions(permissions = {}) {
  const moduleMap = new Map(PERMISSION_MODULES.map((module) => [module.key, module]));
  const normalized = {};
  for (const [moduleKey, actions] of Object.entries(permissions || {})) {
    const module = moduleMap.get(moduleKey);
    if (!module || !Array.isArray(actions)) continue;
    const allowed = actions.filter((action) => module.actions.includes(action));
    if (allowed.length) normalized[moduleKey] = [...new Set(allowed)];
  }
  return normalized;
}

function roleHasPermission(role = {}, moduleKey, action = "view") {
  if (role.key === "admin" || role.id === "admin") return true;
  const permissions = normalizePermissions(role.permissions || {});
  return Array.isArray(permissions[moduleKey]) && permissions[moduleKey].includes(action);
}

module.exports = {
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  normalizePermissions,
  normalizeRoleKey,
  roleHasPermission,
};
