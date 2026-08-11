const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cookieParser = require("cookie-parser");
const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");

const { registerLogRoutes } = require("./routes/logs");
const { richTextLengthExcludingImages, sanitizeRichText } = require("./rich-text");
const {
  activityRiskPatch,
  analyzeActivitySafety,
  buildActivityAnalysisContext,
  countPriorIdentityActivities,
  getManageToken,
  getSafetyConfig,
  getSafetyRules,
  issueManageToken,
  prepareActivitySubmissionGate,
  publicIdentity,
  recordActivityAnalysisEvents,
  saveSafetyConfig,
  storeAnalysisReport,
  submitCommunityReport,
  verifyManageToken,
} = require("./community-safety/service");
const {
  ANONYMOUS_ID_COOKIE,
  makeSignedAnonymousId,
  parseSignedAnonymousId,
  requestIdentity,
} = require("./community-safety/identity");
const { checkSimpleLimit } = require("./community-safety/rate-limit");
const {
  badgeFromInput,
  badgePolicyFromInput,
  badgeSummaryForIdentity,
  communityId,
  getCommunityBadges,
  governanceOverview,
  identityDetail,
  recordCommunityEvent,
  trustPolicyFromInput,
  validateBadge,
  validateBadgePolicy,
  validateTrustPolicy,
} = require("./community-governance/service");
const {
  AI_SCENES,
  analyzeFeedback,
  getAiModelProfile,
  getAiSettings,
  getAiUsageStats,
  listAiModelProfiles,
  publicAiModelProfile,
  publicAiSettings,
  removeAiModelProfile,
  saveAiModelProfile,
  saveAiSettings,
  testAiConnection,
  testAiModelProfile,
} = require("./ai-analysis/service");
const { DEFAULT_ACTIVITY_SERIES, cleanPhone, createStore } = require("./store");
const {
  DEFAULT_ROLE_DEFINITIONS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  normalizePermissions,
  normalizeRoleKey,
  roleHasPermission,
} = require("./permissions");

const UPLOAD_DIR = process.env.STORE_DRIVER === "cloudbase"
  ? path.join("/tmp", "youkong-uploads")
  : path.join(__dirname, "..", "uploads");
const SESSION_COOKIE = "yk_session";
const DEFAULT_CORS_ORIGINS = [
  "https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com",
];
const DEFAULT_SESSION_DAYS = 14;
const SESSION_MAX_AGE_DAYS = Math.max(1, Math.min(Number(process.env.SESSION_MAX_AGE_DAYS || DEFAULT_SESSION_DAYS), 30));
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const ANONYMOUS_ID_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const CO_INITIATOR_INVITE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const IDENTITY_SYNC_INVITE_MAX_AGE_MS = 10 * 60 * 1000;
const ACTIVITY_EDIT_LOCK_TTL_MS = Math.max(30, Number(process.env.ACTIVITY_EDIT_LOCK_TTL_MINUTES || 360)) * 60 * 1000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const RICH_IMAGE_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const RICH_IMAGE_COMPRESSED_LIMIT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = Math.max(1_000_000, Number(process.env.MAX_IMAGE_PIXELS || 18_000_000));
const MAX_IMAGE_SIDE = Math.max(1000, Number(process.env.MAX_IMAGE_SIDE || 8000));
const TEXT_LIMITS = {
  nickname: 32,
  moduleName: 32,
  moduleDescription: 120,
  seriesName: 36,
  seriesDescription: 180,
  friendName: 60,
  friendDescription: 500,
  friendAddress: 160,
  friendContact: 60,
  friendContactInfo: 120,
  templateName: 60,
  templateDescription: 160,
  roleName: 32,
  roleDescription: 240,
  title: 80,
  initiator: 32,
  initiatorContact: 80,
  location: 120,
  description: 50000,
  reviewComment: 500,
  reportReason: 40,
  reportDetail: 500,
  feedbackText: 1200,
  profileDisplayName: 32,
  profileBio: 280,
  deviceLabel: 40,
};
const CO_INITIATOR_ROLE = "cohost";
const store = createStore();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function isPlaceholderSecret(value = "") {
  const text = String(value || "").trim();
  return !text || /请替换|placeholder|changeme|change-me|local|test/i.test(text) || text.length < 24;
}

function assertProductionSecrets() {
  const shouldRequire = process.env.REQUIRE_PRODUCTION_SECRETS === "true"
    || (process.env.STORE_DRIVER === "cloudbase" && process.env.REQUIRE_PRODUCTION_SECRETS !== "false");
  if (!shouldRequire) return;
  const required = ["SESSION_SECRET", "IDENTITY_HASH_SALT", "AI_CONFIG_ENCRYPTION_KEY"];
  const missing = required.filter((key) => isPlaceholderSecret(process.env[key]));
  if (missing.length) {
    throw Object.assign(
      new Error(`生产安全密钥未配置或过短：${missing.join(", ")}。请在 CloudBase 控制台配置长随机值后再启动。`),
      { statusCode: 500 }
    );
  }
}

function safeImageExtension(filename = "") {
  const ext = path.extname(filename || "").toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : "";
}

function uploadFileFilter(_req, file, callback) {
  const ext = safeImageExtension(file.originalname);
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype) || !ext) {
    const error = new Error("只支持 JPG、PNG、WebP 或 GIF 图片");
    error.statusCode = 400;
    callback(error);
    return;
  }
  callback(null, true);
}

function detectImageMime(buffer = Buffer.alloc(0)) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) return "image/png";
  if (buffer.length >= 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.slice(0, 6).toString("ascii"))) return "image/gif";
  return "";
}

function readJpegDimensions(buffer = Buffer.alloc(0)) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (!length || offset + 2 + length > buffer.length) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function imageDimensions(buffer = Buffer.alloc(0), mime = "") {
  if (mime === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mime === "image/gif" && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (mime === "image/jpeg") return readJpegDimensions(buffer);
  if (mime === "image/webp" && buffer.length >= 30) {
    const chunk = buffer.slice(12, 16).toString("ascii");
    if (chunk === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8 " && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
  }
  return null;
}

function assertImageDimensions(buffer, mime) {
  const dimensions = imageDimensions(buffer, mime);
  if (!dimensions) return;
  const { width, height } = dimensions;
  if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
    throw Object.assign(new Error("图片尺寸过大，请压缩后再上传"), { statusCode: 400 });
  }
}

async function removeUploadedFile(file) {
  if (file && file.path) {
    await fs.promises.unlink(file.path).catch(() => {});
  }
}

async function assertUploadedImage(file) {
  if (!file) return;
  const buffer = file.buffer || await fs.promises.readFile(file.path);
  const detected = detectImageMime(buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected)) {
    await removeUploadedFile(file);
    throw Object.assign(new Error("图片内容格式不正确，请上传 JPG、PNG、WebP 或 GIF 图片"), { statusCode: 400 });
  }
  if (file.mimetype && file.mimetype !== detected && !(file.mimetype === "image/jpeg" && detected === "image/jpeg")) {
    await removeUploadedFile(file);
    throw Object.assign(new Error("图片扩展名、类型和实际内容不一致，请重新选择图片"), { statusCode: 400 });
  }
  try {
    assertImageDimensions(buffer, detected);
  } catch (error) {
    await removeUploadedFile(file);
    throw error;
  }
}

function localImageUpload(maxSize) {
  return multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const ext = safeImageExtension(file.originalname);
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  fileFilter: uploadFileFilter,
  limits: {
    fileSize: maxSize,
    files: 1,
  },
  });
}

function memoryImageUpload(maxSize) {
  return multer({
  storage: multer.memoryStorage(),
  fileFilter: uploadFileFilter,
  limits: {
    fileSize: maxSize,
    files: 1,
  },
  });
}

function imageUpload(maxSize) {
  return process.env.STORE_DRIVER === "cloudbase" ? memoryImageUpload(maxSize) : localImageUpload(maxSize);
}

const upload = imageUpload(6 * 1024 * 1024);
const richImageUpload = imageUpload(RICH_IMAGE_UPLOAD_LIMIT_BYTES);
const profileAvatarUpload = imageUpload(4 * 1024 * 1024);
const ACTIVITY_STATUS = {
  DRAFT: "draft",
  ANALYSIS_PENDING: "analysis_pending",
  ADMIN_REVIEW: "admin_review",
  COLLABORATOR_REVIEW: "collaborator_review",
  RETURNED: "returned",
  REJECTED: "rejected",
  PUBLISHED: "published",
  FULL: "full",
  CANCELLED: "cancelled",
  NOT_FORMED_CANCELLED: "not_formed_cancelled",
  ENDED: "ended",
};
const PUBLIC_ACTIVITY_STATUSES = [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL, ACTIVITY_STATUS.NOT_FORMED_CANCELLED, ACTIVITY_STATUS.ENDED];
const UPCOMING_ACTIVITY_STATUSES = [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL];
const HISTORY_ACTIVITY_STATUSES = [ACTIVITY_STATUS.NOT_FORMED_CANCELLED, ACTIVITY_STATUS.ENDED];
const AUTO_END_ACTIVITY_STATUSES = [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL];
const REGISTRATION_OPEN_STATUSES = [ACTIVITY_STATUS.PUBLISHED];
const ACTIVITY_SOURCE_TYPES = ["living_room", "friend"];
const FEEDBACK_STATUS = {
  APPROVED: "approved",
  ADMIN_REVIEW: "admin_review",
  REJECTED: "rejected",
};
const REVIEW_ACTIONS = ["approve", "reject", "return"];
const DEFAULT_ACTIVITY_CAPACITY = 99;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
const ACTIVITY_AUTO_END_INTERVAL_MS = Math.max(60 * 1000, Number(process.env.ACTIVITY_AUTO_END_INTERVAL_MS || 15 * 60 * 1000));
const ACTIVITY_AUTO_END_MIN_SWEEP_MS = Math.max(10 * 1000, Number(process.env.ACTIVITY_AUTO_END_MIN_SWEEP_MS || 60 * 1000));
const ACTIVITY_AUTO_END_BATCH_SIZE = 100;
const LOG_RETENTION_DAYS = Math.max(1, Math.min(Number(process.env.LOG_RETENTION_DAYS || 30), 365));
const LOG_RETENTION_SWEEP_MS = Math.max(60 * 1000, Number(process.env.LOG_RETENTION_SWEEP_MS || 6 * 60 * 60 * 1000));
const API_TIMING_LOGS_ENABLED = process.env.API_TIMING_LOGS !== "false";
const API_SLOW_LOG_MS = Math.max(100, Number(process.env.API_SLOW_LOG_MS || 1200));
const LOG_ACTION_LABELS = {
  login: "登录",
  logout: "退出",
  "user.create": "新增用户",
  "user.update": "保存用户",
  "user.delete": "删除用户",
  "role.create": "新增角色",
  "role.update": "保存角色权限",
  "role.delete": "删除角色",
  "module.create": "新增模块",
  "module.update": "保存模块",
  "module.delete": "删除模块",
  "friend.create": "新增客厅朋友",
  "friend.update": "保存客厅朋友",
  "friend.delete": "删除客厅朋友",
  "template.create": "新增模板",
  "template.update": "保存模板",
  "template.delete": "删除模板",
  "activity.create_draft": "保存活动草稿",
  "activity.create_submit": "发起活动",
  "activity.update_draft": "保存活动草稿",
  "activity.update_submit": "重新发起活动",
  "activity.analysis.pending": "活动进入安全分析",
  "activity.analysis.complete": "活动安全分析完成",
  "activity.analysis.failed": "活动安全分析失败",
  "activity.risk_review": "转入社区复核",
  "activity.report": "社区举报",
  "activity.report.review": "举报分析",
  "activity.report.substantiated": "举报成立",
  "activity.report.unsubstantiated": "举报记录",
  "activity.reanalyze": "重新分析活动",
  "activity.withdraw": "撤回活动",
  "activity.coinitiator.invite": "邀请共同发起人",
  "activity.coinitiator.accept": "接受共同发起人邀请",
  "activity.coinitiator.remove": "移除共同发起人",
  "activity.review.approve": "审核通过",
  "activity.review.return": "审核退回",
  "activity.review.reject": "审核拒绝",
  "activity.cancel": "取消活动",
  "activity.not_formed_cancel": "未成团取消",
  "activity.end": "结束活动",
  "activity.auto_end": "自动结束活动",
  "registration.create": "新增报名",
  "registration.delete": "删除报名",
  "registration.cancel": "取消报名",
  "activity.interest": "感兴趣",
  "activity.notification.subscribe": "订阅活动提醒",
  "activity.feedback.create": "提交活动反馈",
  "activity.feedback.review": "审核活动反馈",
  "activity.feedback.export": "导出活动反馈",
  "profile.update": "保存个人资料",
  "safety.rule.create": "新增安全规则",
  "safety.rule.update": "保存安全规则",
  "safety.rule.delete": "删除安全规则",
  "safety.config.update": "保存安全配置",
  "ai.settings.update": "保存 AI 设置",
  "ai.connection.test": "测试 AI 连接",
  "ai.model.create": "新增 AI 模型",
  "ai.model.update": "保存 AI 模型",
  "ai.model.delete": "删除 AI 模型",
  "ai.model.test": "测试 AI 模型",
  "ai.prompt.create": "新增 Prompt",
  "ai.prompt.update": "保存 Prompt",
  "ai.prompt.delete": "删除 Prompt",
  "ai.prompt.activate": "启用 Prompt",
  "governance.trust_policy.create": "新增信用策略",
  "governance.trust_policy.update": "保存信用策略",
  "governance.trust_policy.delete": "删除信用策略",
  "governance.badge.create": "新增社区徽章",
  "governance.badge.update": "保存社区徽章",
  "governance.badge.delete": "删除社区徽章",
  "governance.badge_policy.update": "保存徽章展示策略",
};
let activityAutoEndTimer = null;
let activityAutoEndSweepPromise = null;
let activityAutoEndLastRun = 0;
let logRetentionSweepPromise = null;
let logRetentionLastRun = 0;
let activityAnalysisQueuePromise = null;
const mutationLocks = new Map();
const ACTIVITY_ANALYSIS_MAX_ATTEMPTS = Math.max(1, Math.min(Number(process.env.ACTIVITY_ANALYSIS_MAX_ATTEMPTS || 3), 10));
const ACTIVITY_ANALYSIS_SWEEP_LIMIT = Math.max(1, Math.min(Number(process.env.ACTIVITY_ANALYSIS_SWEEP_LIMIT || 5), 20));
const ACTIVITY_ANALYSIS_STALE_RUNNING_MS = Math.max(30 * 1000, Number(process.env.ACTIVITY_ANALYSIS_STALE_RUNNING_MS || 2 * 60 * 1000));
const ACTIVITY_ANALYSIS_RECOVERY_LIMIT = Math.max(1, Math.min(Number(process.env.ACTIVITY_ANALYSIS_RECOVERY_LIMIT || 10), 50));

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function makeAccessToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function publicUser(user, options = {}) {
  if (!user) return null;
  const roles = normalizeRoles(user);
  const roleDefinition = user.roleDefinition || null;
  const payload = {
    id: user.id,
    nickname: user.nickname,
    role: roles.includes("admin") ? "admin" : roles[0] || "collaborator",
    roles,
    roleName: roleDefinition?.name || (roles.includes("admin") ? "有空管理员" : roles[0] || "协作员"),
  };
  if (roleDefinition?.permissions) {
    payload.permissions = normalizePermissions(roleDefinition.permissions);
  }
  if (options.includePhone) {
    payload.phone = user.phone;
  }
  return payload;
}

function publicRole(role = {}) {
  const key = normalizeRoleKey(role.key || role.id || "collaborator");
  return {
    id: role.id || key,
    key,
    name: role.name || key,
    description: role.description || "",
    builtIn: role.builtIn === true,
    locked: role.locked === true,
    permissions: normalizePermissions(role.permissions || {}),
    createdAt: role.createdAt || "",
    updatedAt: role.updatedAt || "",
  };
}

function defaultRole(roleKey = "collaborator") {
  const key = normalizeRoleKey(roleKey);
  const role = DEFAULT_ROLE_DEFINITIONS.find((item) => item.key === key || item.id === key)
    || DEFAULT_ROLE_DEFINITIONS.find((item) => item.key === "collaborator");
  return publicRole(role);
}

function publicRegistration(registration, options = {}) {
  if (!registration) return null;
  const payload = {
    id: registration.id,
    activityId: registration.activityId,
    nickname: registration.nickname,
    createdAt: registration.createdAt,
  };
  if (options.includePhone && registration.phone) {
    payload.phone = registration.phone;
  }
  if (options.accessToken) {
    payload.accessToken = options.accessToken;
  }
  return payload;
}

function publicFriend(friend = {}) {
  if (!friend) return null;
  return {
    id: friend.id,
    name: friend.name,
    description: friend.description || "",
    logoUrl: friend.logoUrl || "",
    logoFileId: friend.logoFileId || "",
    address: friend.address || "",
    contactName: friend.contactName || "",
    contactInfo: friend.contactInfo || "",
    enabled: friend.enabled !== false,
    createdAt: friend.createdAt || "",
    updatedAt: friend.updatedAt || "",
  };
}

async function publicIdentityProfile(profile = null, options = {}) {
  const identityId = cleanText(profile?.id || options.identityId || "");
  if (!identityId && !profile) return null;
  const avatarUrl = profile?.avatarFileId
    ? await store.getFileUrl(profile.avatarFileId)
    : profile?.avatarUrl || "";
  return {
    id: identityId,
    communityId: communityId(identityId),
    displayName: cleanText(profile?.displayName || options.fallbackName || "") || "有空朋友",
    bio: cleanText(profile?.bio || ""),
    avatarUrl,
    hasProfile: Boolean(profile && (profile.displayName || profile.bio || profile.avatarFileId || profile.avatarUrl)),
    updatedAt: profile?.updatedAt || "",
  };
}

async function identityProfileById(identityId = "", options = {}) {
  const id = cleanText(identityId);
  if (!id) return null;
  const profile = await store.findById("identityProfiles", id);
  return publicIdentityProfile(profile, { ...options, identityId: id });
}

async function identityProfileByPublicId(value = "") {
  const id = cleanText(value);
  if (!id) return null;
  const profile = id.startsWith("anon_")
    ? await store.findById("identityProfiles", id)
    : await store.findByFilters("identityProfiles", [{ field: "communityId", op: "eq", value: id.toUpperCase() }]);
  return profile || (id.startsWith("anon_") ? { id } : null);
}

async function identityProfileMap(identityIds = []) {
  const ids = Array.from(new Set(identityIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const profiles = await loadRecordsByIds("identityProfiles", ids);
  const entries = await Promise.all(ids.map(async (id) => [
    id,
    await publicIdentityProfile(profiles.get(id), { identityId: id }),
  ]));
  return new Map(entries);
}

function coInitiatorIdentityIds(activity = {}) {
  return Array.from(new Set(
    [
      ...(Array.isArray(activity.coInitiatorIdentityIds) ? activity.coInitiatorIdentityIds : []),
      ...(Array.isArray(activity.coInitiatorNetworkIds) ? activity.coInitiatorNetworkIds : []),
    ]
      .map((id) => cleanText(id))
      .filter(Boolean)
      .filter((id) => id !== activity.anonymousIdentityId)
      .filter((id) => id !== activity.identityNetworkId)
  ));
}

function makeCoInitiatorId(activityId = "", identityId = "") {
  return `co_${hashRegistrationIdentity(activityId, `identity:${identityId}`).slice(0, 24)}`;
}

async function activeCoInitiatorsForActivity(activityId = "") {
  const id = cleanText(activityId);
  if (!id) return [];
  const { data } = await store.query("activityCoInitiators", {
    page: 1,
    pageSize: 100,
    maxPageSize: 100,
    filters: [
      { field: "activityId", op: "eq", value: id },
      { field: "status", op: "eq", value: "active" },
    ],
    sort: [{ field: "acceptedAt", direction: "asc" }, { field: "createdAt", direction: "asc" }],
  });
  return data;
}

async function coInitiatorProfilesForActivity(activity = {}, profileMap = null) {
  const records = await activeCoInitiatorsForActivity(activity.id);
  const ids = records.length
    ? records.map((item) => item.identityNetworkId || item.identityId).filter(Boolean)
    : coInitiatorIdentityIds(activity);
  const localProfileMap = profileMap || await identityProfileMap(ids);
  return ids
    .map((identityId) => {
      const profile = localProfileMap.get(identityId);
      if (!profile) return null;
      return {
        ...profile,
        role: CO_INITIATOR_ROLE,
        roleLabel: "共同发起人",
      };
    })
    .filter(Boolean);
}

function parseIdentityProfileInput(body = {}) {
  return {
    displayName: cleanText(body.displayName || body.nickname || ""),
    bio: cleanText(body.bio || ""),
  };
}

function validateIdentityProfileInput(input = {}) {
  return [
    validateTextLength("昵称", input.displayName, TEXT_LIMITS.profileDisplayName),
    validateTextLength("个人简介", input.bio, TEXT_LIMITS.profileBio),
  ].find(Boolean) || "";
}

function normalizeDeviceLabel(value = "", fallback = "") {
  const label = cleanText(value).slice(0, TEXT_LIMITS.deviceLabel);
  return label || fallback || "未命名设备";
}

function deviceLabelFromIdentity(identity = {}) {
  const ua = String(identity.userAgentSample || "");
  if (/MicroMessenger/i.test(ua)) return "微信内置浏览器";
  if (/iPhone|iPad|Android|Mobile/i.test(ua)) return "手机设备";
  if (/Macintosh|Windows|Linux/i.test(ua)) return "电脑设备";
  return "当前设备";
}

function makeIdentityNetworkDeviceId(networkId = "", identityId = "") {
  return `netdev_${hashRegistrationIdentity(networkId, `device:${identityId}`).slice(0, 24)}`;
}

async function activeNetworkDeviceByIdentity(identityId = "") {
  const id = cleanText(identityId);
  if (!id) return null;
  return store.findByFilters("identityNetworkDevices", [
    { field: "identityId", op: "eq", value: id },
    { field: "status", op: "eq", value: "active" },
  ]);
}

async function activeDevicesForNetwork(networkId = "") {
  const id = cleanText(networkId);
  if (!id) return [];
  const { data } = await store.query("identityNetworkDevices", {
    page: 1,
    pageSize: 500,
    maxPageSize: 500,
    filters: [
      { field: "networkId", op: "eq", value: id },
      { field: "status", op: "eq", value: "active" },
    ],
    sort: [{ field: "createdAt", direction: "asc" }],
  });
  return data;
}

async function identityNetworkContextForIdentity(identity = {}) {
  const identityId = cleanText(identity.id || "");
  const membership = await activeNetworkDeviceByIdentity(identityId);
  const network = membership?.networkId ? await store.findById("identityNetworks", membership.networkId) : null;
  const activeNetwork = network && network.status !== "merged" ? network : null;
  const devices = activeNetwork ? await activeDevicesForNetwork(activeNetwork.id) : [];
  const deviceIds = activeNetwork
    ? Array.from(new Set(devices.map((device) => device.identityId).filter(Boolean).concat(identityId)))
    : (identityId ? [identityId] : []);
  return {
    identity,
    network: activeNetwork,
    membership: activeNetwork ? membership : null,
    devices,
    deviceIds,
    effectiveIdentityId: activeNetwork?.id || identityId,
    profileId: activeNetwork?.id || identityId,
  };
}

async function identityNetworkContextForRequest(req) {
  if (req?.ykIdentityContext) return req.ykIdentityContext;
  const context = await identityNetworkContextForIdentity(requestIdentity(req));
  if (req) req.ykIdentityContext = context;
  return context;
}

function requestIdentityIds(req) {
  if (!req?.ykIdentityContext) {
    const identityId = requestIdentityId(req);
    return identityId ? [identityId] : [];
  }
  return req.ykIdentityContext.deviceIds || [];
}

function requestIdentityNetworkId(req) {
  return cleanText(req?.ykIdentityContext?.network?.id || "");
}

function publicIdentityDevice(device = {}, currentIdentityId = "") {
  if (!device) return null;
  return {
    id: device.id,
    identityId: device.identityId,
    label: device.label || "未命名设备",
    deviceType: device.deviceType || "",
    isCurrent: Boolean(currentIdentityId && device.identityId === currentIdentityId),
    status: device.status || "active",
    addedAt: device.addedAt || device.createdAt || "",
    lastSeenAt: device.lastSeenAt || "",
    ipMasked: device.identitySnapshot?.ipMasked || "",
    userAgentSample: device.identitySnapshot?.userAgentSample || "",
  };
}

function publicExternalBinding(credential = {}) {
  if (!credential || credential.status === "revoked") return null;
  const providerLabels = {
    wechat_miniprogram: "微信小程序",
  };
  return {
    id: credential.id,
    provider: credential.provider || "",
    providerLabel: providerLabels[credential.provider] || credential.provider || "外部身份",
    boundAt: credential.boundAt || credential.createdAt || "",
    lastSeenAt: credential.lastSeenAt || "",
  };
}

async function externalBindingsForNetwork(networkId = "") {
  const id = cleanText(networkId);
  if (!id) return [];
  const { data } = await store.query("identityExternalCredentials", {
    page: 1,
    pageSize: 20,
    maxPageSize: 20,
    filters: [
      { field: "identityNetworkId", op: "eq", value: id },
      { field: "status", op: "eq", value: "active" },
    ],
    sort: [{ field: "createdAt", direction: "asc" }],
  });
  return (data || []).map(publicExternalBinding).filter(Boolean);
}

async function publicIdentityNetworkContext(context = {}) {
  const identity = context.identity || {};
  const network = context.network || null;
  const devices = context.devices || [];
  const externalBindings = network ? await externalBindingsForNetwork(network.id) : [];
  return {
    hasNetwork: Boolean(network),
    network: network ? {
      id: network.id,
      communityId: network.communityId || communityId(network.id),
      status: network.status || "active",
      primaryIdentityId: network.primaryIdentityId || "",
      createdAt: network.createdAt || "",
      updatedAt: network.updatedAt || "",
      deviceCount: devices.length,
    } : null,
    currentDevice: network
      ? publicIdentityDevice(devices.find((device) => device.identityId === identity.id) || context.membership, identity.id)
      : {
        id: identity.id,
        identityId: identity.id,
        label: deviceLabelFromIdentity(identity),
        isCurrent: true,
        status: "standalone",
        ipMasked: identity.ipMasked || "",
        userAgentSample: identity.userAgentSample || "",
      },
    devices: devices.map((device) => publicIdentityDevice(device, identity.id)).filter(Boolean),
    externalBindings,
  };
}

async function createNetworkProfileFromIdentity(networkId = "", identityId = "", now = new Date().toISOString()) {
  const existingNetworkProfile = await store.findById("identityProfiles", networkId);
  if (existingNetworkProfile) return existingNetworkProfile;
  const sourceProfile = identityId ? await store.findById("identityProfiles", identityId) : null;
  const profile = {
    ...(sourceProfile || {}),
    id: networkId,
    communityId: communityId(networkId),
    sourceIdentityId: identityId,
    migratedFromIdentityId: identityId,
    createdAt: sourceProfile?.createdAt || now,
    updatedAt: now,
  };
  await store.insert("identityProfiles", profile);
  return profile;
}

async function ensureIdentityNetwork(req, options = {}) {
  const identity = requestIdentity(req);
  const existing = await identityNetworkContextForIdentity(identity);
  if (existing.network) {
    req.ykIdentityContext = existing;
    return existing;
  }
  const now = new Date().toISOString();
  const networkId = makeId("net");
  const network = {
    id: networkId,
    communityId: communityId(networkId),
    status: "active",
    primaryIdentityId: identity.id,
    createdByIdentityId: identity.id,
    createdAt: now,
    updatedAt: now,
  };
  await store.insert("identityNetworks", network);
  const device = {
    id: makeIdentityNetworkDeviceId(networkId, identity.id),
    networkId,
    identityId: identity.id,
    label: normalizeDeviceLabel(options.label, deviceLabelFromIdentity(identity)),
    deviceType: options.deviceType || "",
    identitySnapshot: publicIdentity(identity),
    addedByIdentityId: identity.id,
    addedAt: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  };
  await store.insertUnique("identityNetworkDevices", device, "id");
  await createNetworkProfileFromIdentity(networkId, identity.id, now);
  await stampIdentityNetworkOnExistingData(networkId, [identity.id], now);
  const context = await identityNetworkContextForIdentity(identity);
  req.ykIdentityContext = context;
  return context;
}

async function stampIdentityNetworkOnExistingData(networkId = "", identityIds = [], now = new Date().toISOString()) {
  const ids = Array.from(new Set(identityIds.map(cleanText).filter(Boolean)));
  if (!networkId || !ids.length) return;
  const collections = [
    { name: "activities", field: "anonymousIdentityId" },
    { name: "registrations", field: "identityId" },
    { name: "activityInterests", field: "identityId" },
    { name: "activityFeedbacks", field: "identityId" },
    { name: "communityReports", field: "identityId" },
    { name: "analysisReports", field: "identityId" },
  ];
  await Promise.all(collections.map(async ({ name, field }) => {
    const { data } = await store.query(name, {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      filters: [{ field, op: "in", value: ids }],
    });
    await Promise.all((data || []).map((item) =>
      item.identityNetworkId === networkId
        ? Promise.resolve(item)
        : store.update(name, item.id, { identityNetworkId: networkId, updatedAt: now })));
  }));
}

async function identitySubjectCounts(identityIds = [], networkId = "") {
  const ids = Array.from(new Set(identityIds.map(cleanText).filter(Boolean)));
  const filtersFor = (field) => ids.length ? [{ field, op: "in", value: ids }] : [impossibleFilter()];
  const [activityTotal, registrationTotal, feedbackTotal, reportTotal, interestTotal] = await Promise.all([
    countRecords("activities", networkId ? [{ field: "identityNetworkId", op: "eq", value: networkId }] : filtersFor("anonymousIdentityId")),
    countRecords("registrations", networkId ? [{ field: "identityNetworkId", op: "eq", value: networkId }] : filtersFor("identityId")),
    countRecords("activityFeedbacks", networkId ? [{ field: "identityNetworkId", op: "eq", value: networkId }] : filtersFor("identityId")),
    countRecords("communityReports", networkId ? [{ field: "identityNetworkId", op: "eq", value: networkId }] : filtersFor("identityId")),
    countRecords("activityInterests", networkId ? [{ field: "identityNetworkId", op: "eq", value: networkId }] : filtersFor("identityId")),
  ]);
  return { activities: activityTotal, registrations: registrationTotal, feedbacks: feedbackTotal, reports: reportTotal, interests: interestTotal };
}

async function identitySubjectSummaryForContext(context = {}) {
  const networkId = context.network?.id || "";
  return identitySubjectCounts(context.deviceIds || [], networkId);
}

function selectProfileForMerge(targetProfile = null, sourceProfile = null, choice = "target", custom = {}) {
  if (choice === "source" && sourceProfile) return {
    displayName: sourceProfile.displayName || "",
    bio: sourceProfile.bio || "",
    avatarUrl: sourceProfile.avatarUrl || "",
    avatarFileId: sourceProfile.avatarFileId || "",
  };
  if (choice === "custom") return {
    displayName: cleanText(custom.displayName || targetProfile?.displayName || sourceProfile?.displayName || ""),
    bio: cleanText(custom.bio || targetProfile?.bio || sourceProfile?.bio || ""),
    avatarUrl: targetProfile?.avatarUrl || sourceProfile?.avatarUrl || "",
    avatarFileId: targetProfile?.avatarFileId || sourceProfile?.avatarFileId || "",
  };
  return {
    displayName: targetProfile?.displayName || sourceProfile?.displayName || "",
    bio: targetProfile?.bio || sourceProfile?.bio || "",
    avatarUrl: targetProfile?.avatarUrl || sourceProfile?.avatarUrl || "",
    avatarFileId: targetProfile?.avatarFileId || sourceProfile?.avatarFileId || "",
  };
}

async function identitySyncMergePreview(invite, sourceContext) {
  const targetNetwork = await store.findById("identityNetworks", invite.targetNetworkId);
  if (!targetNetwork || targetNetwork.status === "merged") return null;
  const targetDevices = await activeDevicesForNetwork(targetNetwork.id);
  const sourceNetwork = sourceContext.network || null;
  const sourceDevices = sourceNetwork ? sourceContext.devices : [];
  const sourceIdentityIds = sourceContext.deviceIds || [];
  const [targetCounts, sourceCounts, targetProfile, sourceProfile] = await Promise.all([
    identitySubjectCounts(targetDevices.map((device) => device.identityId), targetNetwork.id),
    identitySubjectCounts(sourceIdentityIds, sourceNetwork?.id || ""),
    store.findById("identityProfiles", targetNetwork.id),
    store.findById("identityProfiles", sourceNetwork?.id || sourceContext.identity?.id),
  ]);
  return {
    target: {
      network: {
        id: targetNetwork.id,
        communityId: targetNetwork.communityId || communityId(targetNetwork.id),
        deviceCount: targetDevices.length,
      },
      profile: await publicIdentityProfile(targetProfile, { identityId: targetNetwork.id }),
      counts: targetCounts,
    },
    source: {
      hasNetwork: Boolean(sourceNetwork),
      network: sourceNetwork ? {
        id: sourceNetwork.id,
        communityId: sourceNetwork.communityId || communityId(sourceNetwork.id),
        deviceCount: sourceDevices.length,
      } : null,
      profile: await publicIdentityProfile(sourceProfile, { identityId: sourceNetwork?.id || sourceContext.identity?.id }),
      counts: sourceCounts,
    },
    merged: {
      counts: Object.fromEntries(["activities", "registrations", "feedbacks", "reports", "interests"].map((key) => [
        key,
        Number(targetCounts[key] || 0) + Number(sourceCounts[key] || 0),
      ])),
      deviceCount: targetDevices.length + (sourceNetwork ? sourceDevices.length : 1),
    },
  };
}

async function mergeIdentityContextIntoNetwork(targetNetwork = {}, sourceContext = {}, options = {}) {
  if (!targetNetwork || targetNetwork.status === "merged") {
    throw Object.assign(new Error("目标身份网络不存在或已经合并"), { statusCode: 404 });
  }
  if (sourceContext.network?.id === targetNetwork.id) {
    return { context: sourceContext, alreadyJoined: true, mergedDeviceIds: [] };
  }
  const now = options.now || new Date().toISOString();
  const sourceNetwork = sourceContext.network || null;
  const sourceDevices = sourceNetwork
    ? sourceContext.devices
    : [{
      identityId: sourceContext.identity.id,
      label: normalizeDeviceLabel(options.label, deviceLabelFromIdentity(sourceContext.identity)),
      identitySnapshot: publicIdentity(sourceContext.identity),
      createdAt: now,
    }];
  const sourceIdentityIds = Array.from(new Set(sourceDevices.map((device) => device.identityId).filter(Boolean)));

  await Promise.all(sourceIdentityIds.map(async (identityId) => {
    const { data: activeMemberships } = await store.query("identityNetworkDevices", {
      page: 1,
      pageSize: 20,
      maxPageSize: 20,
      filters: [
        { field: "identityId", op: "eq", value: identityId },
        { field: "status", op: "eq", value: "active" },
      ],
    });
    await Promise.all((activeMemberships || []).map((membership) => store.update("identityNetworkDevices", membership.id, {
      status: "merged",
      mergedIntoNetworkId: targetNetwork.id,
      updatedAt: now,
    })));
  }));

  await Promise.all(sourceDevices.map((device) => store.insertUnique("identityNetworkDevices", {
    id: makeIdentityNetworkDeviceId(targetNetwork.id, device.identityId),
    networkId: targetNetwork.id,
    identityId: device.identityId,
    label: normalizeDeviceLabel(device.label, device.identityId === sourceContext.identity.id ? deviceLabelFromIdentity(sourceContext.identity) : "已合并设备"),
    deviceType: device.deviceType || "",
    identitySnapshot: device.identitySnapshot || publicIdentity(sourceContext.identity),
    addedByIdentityId: sourceContext.identity.id,
    addedAt: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastSeenAt: device.identityId === sourceContext.identity.id ? now : device.lastSeenAt || "",
    sourceNetworkId: sourceNetwork?.id || "",
  }, "id")));

  if (sourceNetwork) {
    await store.update("identityNetworks", sourceNetwork.id, {
      status: "merged",
      mergedIntoNetworkId: targetNetwork.id,
      mergedAt: now,
      updatedAt: now,
    });
  }
  await stampIdentityNetworkOnExistingData(targetNetwork.id, sourceIdentityIds, now);

  const targetProfile = await store.findById("identityProfiles", targetNetwork.id);
  const sourceProfile = await store.findById("identityProfiles", sourceNetwork?.id || sourceContext.identity.id);
  const profileChoice = cleanText(options.profileSource || "target");
  const selectedProfile = selectProfileForMerge(targetProfile, sourceProfile, profileChoice, options.profile || {});
  const profilePatch = {
    id: targetNetwork.id,
    communityId: communityId(targetNetwork.id),
    ...selectedProfile,
    identityNetworkId: targetNetwork.id,
    mergedProfileSource: profileChoice,
    updatedAt: now,
  };
  if (targetProfile) {
    await store.update("identityProfiles", targetNetwork.id, profilePatch);
  } else {
    await store.insert("identityProfiles", { ...profilePatch, createdAt: now });
  }

  await store.update("identityNetworks", targetNetwork.id, {
    deviceCount: (await activeDevicesForNetwork(targetNetwork.id)).length,
    updatedAt: now,
  });
  await store.insert("identityMergeEvents", {
    id: makeId("merge"),
    targetNetworkId: targetNetwork.id,
    sourceNetworkId: sourceNetwork?.id || "",
    sourceIdentityIds,
    acceptedByIdentityId: sourceContext.identity.id,
    inviteId: options.inviteId || "",
    mergeReason: options.reason || "identity_sync",
    profileSource: profileChoice,
    createdAt: now,
  });
  return {
    context: await identityNetworkContextForIdentity(sourceContext.identity),
    alreadyJoined: false,
    mergedDeviceIds: sourceIdentityIds,
  };
}

function wechatMiniProgramConfig() {
  return {
    appId: cleanText(process.env.WECHAT_MP_APPID || process.env.WX_MP_APPID || process.env.MINIPROGRAM_APPID || "wx5020d6431cfac041"),
    appSecret: cleanText(process.env.WECHAT_MP_SECRET || process.env.WX_MP_SECRET || process.env.MINIPROGRAM_APP_SECRET || ""),
  };
}

function wechatMiniProgramNotificationConfig() {
  const templateIds = String(
    process.env.WECHAT_MP_ACTIVITY_REMINDER_TEMPLATE_IDS
    || process.env.WECHAT_MP_ACTIVITY_REMINDER_TEMPLATE_ID
    || ""
  )
    .split(",")
    .map(cleanText)
    .filter(Boolean);
  return {
    enabled: templateIds.length > 0,
    scenes: {
      activityReminder: {
        key: "activity_reminder",
        title: "活动提醒",
        description: "活动开始前通过微信小程序订阅消息提醒。",
        templateIds,
      },
    },
  };
}

async function wechatMiniProgramSessionFromCode(code = "") {
  const jsCode = cleanText(code);
  const config = wechatMiniProgramConfig();
  if (!config.appSecret) {
    throw Object.assign(new Error("微信绑定暂未配置 AppSecret，请先在 CloudBase 云函数环境变量中配置 WECHAT_MP_SECRET"), {
      statusCode: 503,
      expose: true,
      data: { errorCode: "WECHAT_MP_SECRET_MISSING" },
    });
  }
  if (!config.appId) {
    throw Object.assign(new Error("微信小程序登录暂未配置 AppID"), {
      statusCode: 503,
      expose: true,
      data: { errorCode: "WECHAT_MP_APPID_MISSING" },
    });
  }
  if (!jsCode) {
    throw Object.assign(new Error("缺少微信登录 code"), { statusCode: 400 });
  }
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", config.appId);
  url.searchParams.set("secret", config.appSecret);
  url.searchParams.set("js_code", jsCode);
  url.searchParams.set("grant_type", "authorization_code");
  const startedAt = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errcode) {
    const message = data.errmsg || `微信登录接口异常（${response.status}）`;
    throw Object.assign(new Error(message), { statusCode: response.ok ? 400 : 502, providerResponse: data });
  }
  if (!data.openid) {
    throw Object.assign(new Error("微信登录接口未返回 openid"), { statusCode: 502 });
  }
  return {
    provider: "wechat_miniprogram",
    appId: config.appId,
    openid: data.openid,
    unionid: data.unionid || "",
    responseTimeMs: Date.now() - startedAt,
  };
}

function activitySourcePayload(activity = {}, friend = null) {
  const sourceType = ACTIVITY_SOURCE_TYPES.includes(activity.sourceType) ? activity.sourceType : "living_room";
  if (sourceType === "friend") {
    return {
      sourceType,
      sourceLabel: "客厅的朋友们",
      sourceName: friend?.name || activity.friendName || "客厅的朋友",
      friend: friend ? publicFriend(friend) : null,
    };
  }
  return {
    sourceType: "living_room",
    sourceLabel: "客厅",
    sourceName: "有空客厅",
    friend: null,
  };
}

function publicActivitySeries(series = {}) {
  if (!series) return null;
  return {
    id: cleanText(series.id),
    name: cleanText(series.name),
    description: cleanText(series.description),
    color: /^#[0-9a-f]{6}$/i.test(String(series.color || "")) ? series.color : "#4f6f58",
    order: Number(series.order || 0),
    enabled: series.enabled !== false,
  };
}

async function enabledActivitySeries() {
  const { data } = await store.query("activitySeries", {
    page: 1,
    pageSize: 100,
    maxPageSize: 100,
    filters: [{ field: "enabled", op: "eq", value: true }],
    sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
  });
  const series = data.length ? data : DEFAULT_ACTIVITY_SERIES;
  return series.map(publicActivitySeries).filter(Boolean);
}

function cleanText(value = "") {
  return String(value || "").replace(/\u0000/g, "").trim();
}

function maskPhone(phone = "") {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return "";
  if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}****`;
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-4)}`;
}

function sanitizeLogValue(value = "", max = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isValidPhone(phone = "") {
  return /^\d{8,20}$/.test(phone);
}

function truthyFormValue(value) {
  return ["1", "true", "yes", "on", "是"].includes(String(value || "").trim().toLowerCase());
}

function validateTextLength(label, value, max) {
  return String(value || "").length > max ? `${label}不能超过 ${max} 个字符` : "";
}

function validateRichTextLength(label, value, max) {
  return richTextLengthExcludingImages(value) > max ? `${label}不能超过 ${max} 个字符（正文图片不计入）` : "";
}

function roleFromInput(body = {}, existing = null) {
  const key = existing?.key || normalizeRoleKey(body.key || body.id || body.name);
  const name = cleanText(body.name);
  const description = cleanText(body.description);
  const permissions = normalizePermissions(body.permissions || {});
  return {
    key,
    name,
    description,
    permissions,
  };
}

function validateRoleInput(input = {}, options = {}) {
  if (!input.key || !/^[a-zA-Z][a-zA-Z0-9_-]{1,39}$/.test(input.key)) {
    return "角色标识需以字母开头，只能包含字母、数字、下划线或短横线，长度 2-40";
  }
  if (!input.name) return "角色名称不能为空";
  if (options.creating && ["admin", "member"].includes(input.key)) {
    return "这个角色标识为系统保留值";
  }
  return [
    validateTextLength("角色名称", input.name, TEXT_LIMITS.roleName),
    validateTextLength("角色说明", input.description, TEXT_LIMITS.roleDescription),
  ].find(Boolean) || "";
}

function escapeCsvCell(value = "") {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvResponse(res, filename, rows = []) {
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(csv);
}

function parseActivityInput(body, fallbackInitiator = "", fallbackContact = "") {
  const title = cleanText(body.title);
  const moduleId = cleanText(body.moduleId);
  const startsAt = cleanText(body.startsAt);
  const endsAt = cleanText(body.endsAt);
  const location = cleanText(body.location);
  const initiator = cleanText(body.initiator || fallbackInitiator);
  const showInitiatorContact = truthyFormValue(body.showInitiatorContact);
  const initiatorContact = showInitiatorContact ? cleanText(body.initiatorContact || fallbackContact) : "";
  const capacityValue = cleanText(body.capacity);
  const showRegistrationNames = truthyFormValue(body.showRegistrationNames);
  const showFeedbacks = body.showFeedbacks === undefined ? true : truthyFormValue(body.showFeedbacks);
  const sourceType = ACTIVITY_SOURCE_TYPES.includes(cleanText(body.sourceType)) ? cleanText(body.sourceType) : "living_room";
  const friendId = sourceType === "friend" ? cleanText(body.friendId) : "";
  const seriesId = cleanText(body.seriesId);
  const minRegistrationEnabled = truthyFormValue(body.minRegistrationEnabled);
  const minRegistrationCountValue = cleanText(body.minRegistrationCount);
  const registrationDeadline = cleanText(body.registrationDeadline || startsAt);
  const description = sanitizeRichText(body.description);
  const collaboratorId = cleanText(body.collaboratorId);

  const capacity = capacityValue ? Number(capacityValue) : DEFAULT_ACTIVITY_CAPACITY;
  const minRegistrationCount = minRegistrationEnabled ? Number(minRegistrationCountValue) : 0;
  return {
    title,
    moduleId,
    startsAt,
    endsAt,
    location,
    initiator,
    showInitiatorContact,
    initiatorContact,
    capacity,
    capacityValue,
    showRegistrationNames,
    showFeedbacks,
    sourceType,
    friendId,
    seriesId,
    minRegistrationEnabled,
    minRegistrationCount,
    minRegistrationCountValue,
    registrationDeadline,
    description,
    collaboratorId,
  };
}

function parseTemplateInput(body = {}) {
  return {
    name: cleanText(body.name),
    description: cleanText(body.description),
    content: sanitizeRichText(body.content),
  };
}

function validateTemplateInput(input) {
  if (!input.name || !input.content) {
    return "模板名称和模板内容都需要填写";
  }
  return [
    validateTextLength("模板名称", input.name, TEXT_LIMITS.templateName),
    validateTextLength("模板说明", input.description, TEXT_LIMITS.templateDescription),
    validateRichTextLength("模板内容", input.content, TEXT_LIMITS.description),
  ].find(Boolean) || "";
}

function normalizeRoles(userOrBody = {}) {
  const raw = Array.isArray(userOrBody.roles)
    ? userOrBody.roles
    : typeof userOrBody.roles === "string"
      ? userOrBody.roles.split(",")
      : userOrBody.role
        ? [userOrBody.role]
        : [];
  const roles = raw.map((role) => normalizeRoleKey(role)).filter(Boolean);
  if (roles.includes("admin")) return ["admin"];
  return [roles[0] || "collaborator"];
}

function hasRole(user, role) {
  return normalizeRoles(user).includes(role);
}

function isAdmin(user) {
  return hasRole(user, "admin") || user.id === "admin";
}

function isCollaborator(user) {
  return hasRole(user, "collaborator");
}

async function resolveRole(roleKey = "collaborator") {
  const key = normalizeRoleKey(roleKey);
  const role = await store.findById("roles", key)
    || await store.findByFilters("roles", [{ field: "key", op: "eq", value: key }]);
  return publicRole(role || defaultRole(key));
}

async function hydrateUserRole(user) {
  if (!user) return null;
  const roles = normalizeRoles(user);
  const role = roles.includes("admin") ? "admin" : roles[0] || "collaborator";
  const roleDefinition = await resolveRole(role);
  return {
    ...user,
    role,
    roles: [role],
    roleDefinition,
  };
}

function userCan(user, moduleKey, action = "view") {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return roleHasPermission(user.roleDefinition || defaultRole(user.role), moduleKey, action);
}

function userHasAnyManagedPermission(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return PERMISSION_MODULES.some((module) => userCan(user, module.key, "view"));
}

function requirePermission(moduleKey, action = "view") {
  return async (req, res, next) => {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "请先登录" });
      return;
    }
    if (!userCan(user, moduleKey, action)) {
      res.status(403).json({ error: "当前角色没有访问这个模块的权限" });
      return;
    }
    req.currentUser = user;
    next();
  };
}

function requireAnyPermission(pairs = []) {
  return async (req, res, next) => {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "请先登录" });
      return;
    }
    if (!pairs.some(([moduleKey, action = "view"]) => userCan(user, moduleKey, action))) {
      res.status(403).json({ error: "当前角色没有访问这个模块的权限" });
      return;
    }
    req.currentUser = user;
    next();
  };
}

function normalizeActivity(activity) {
  if (!activity) return null;
  const status = activity.status || ACTIVITY_STATUS.PUBLISHED;
  const reviewStep = activity.reviewStep || (
    status === ACTIVITY_STATUS.ADMIN_REVIEW
      ? "admin"
      : status === ACTIVITY_STATUS.COLLABORATOR_REVIEW
        ? "collaborator"
        : ""
  );
  return {
    ...activity,
    status,
    reviewStep,
    reviewLogs: Array.isArray(activity.reviewLogs) ? activity.reviewLogs : [],
  };
}

function statusLabel(status) {
  return {
    [ACTIVITY_STATUS.DRAFT]: "草稿",
    [ACTIVITY_STATUS.ANALYSIS_PENDING]: "安全分析中",
    [ACTIVITY_STATUS.ADMIN_REVIEW]: "审核中",
    [ACTIVITY_STATUS.COLLABORATOR_REVIEW]: "审核中",
    [ACTIVITY_STATUS.RETURNED]: "退回",
    [ACTIVITY_STATUS.REJECTED]: "拒绝",
    [ACTIVITY_STATUS.PUBLISHED]: "活动发布",
    [ACTIVITY_STATUS.FULL]: "活动人满",
    [ACTIVITY_STATUS.CANCELLED]: "活动取消",
    [ACTIVITY_STATUS.NOT_FORMED_CANCELLED]: "未成团取消",
    [ACTIVITY_STATUS.ENDED]: "活动结束",
  }[status] || "活动发布";
}

function reviewStepLabel(activity) {
  const item = normalizeActivity(activity);
  if (item.status === ACTIVITY_STATUS.ADMIN_REVIEW) return "管理员审核";
  if (item.status === ACTIVITY_STATUS.COLLABORATOR_REVIEW) return "协作员审核";
  if (item.status === ACTIVITY_STATUS.ANALYSIS_PENDING) return "安全分析中";
  if (item.status === ACTIVITY_STATUS.RETURNED) return "已退回发起人";
  if (item.status === ACTIVITY_STATUS.REJECTED) return "已拒绝";
  if (item.status === ACTIVITY_STATUS.DRAFT) return "草稿";
  return statusLabel(item.status);
}

async function validateActivityInput(input, activityId = "", options = {}) {
  const asDraft = options.asDraft === true;
  const requireCollaborator = options.requireCollaborator === true;
  if (!input.title || !input.moduleId || (!asDraft && (!input.startsAt || !input.location || !input.initiator || !input.description || (requireCollaborator && !input.collaboratorId)))) {
    return requireCollaborator
      ? "请填写标题、模块、协作员、发起人、时间、地点和活动描述"
      : "请填写标题、模块、发起人、时间、地点和活动描述";
  }

  const lengthError = [
    validateTextLength("活动标题", input.title, TEXT_LIMITS.title),
    validateTextLength("发起人", input.initiator, TEXT_LIMITS.initiator),
    validateTextLength("发起人联系方式", input.initiatorContact, TEXT_LIMITS.initiatorContact),
    validateTextLength("地点", input.location, TEXT_LIMITS.location),
    validateRichTextLength("活动描述", input.description, TEXT_LIMITS.description),
  ].find(Boolean);
  if (lengthError) return lengthError;

  if (input.showInitiatorContact && !input.initiatorContact) {
    return "选择展示发起人联系方式时，请填写联系方式";
  }

  if (input.startsAt && Number.isNaN(new Date(input.startsAt).getTime())) {
    return "活动时间格式不正确";
  }

  if (input.endsAt && Number.isNaN(new Date(input.endsAt).getTime())) {
    return "结束时间格式不正确";
  }

  if (input.startsAt && input.endsAt && new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
    return "结束时间不能早于开始时间";
  }

  if (!Number.isFinite(input.capacity) || input.capacity <= 0 || input.capacity > DEFAULT_ACTIVITY_CAPACITY) {
    return `人数限额需要是 1-${DEFAULT_ACTIVITY_CAPACITY} 之间的数字，留空默认 ${DEFAULT_ACTIVITY_CAPACITY} 人`;
  }

  if (input.minRegistrationEnabled) {
    if (!Number.isFinite(input.minRegistrationCount) || input.minRegistrationCount < 1 || input.minRegistrationCount >= DEFAULT_ACTIVITY_CAPACITY) {
      return `最低报名人数需要是 1-${DEFAULT_ACTIVITY_CAPACITY - 1} 之间的数字`;
    }
    if (input.capacity <= input.minRegistrationCount) {
      return "人数限额需要大于最低报名人数";
    }
    if (!asDraft && !input.registrationDeadline) {
      return "设置最低报名限度时，请填写最后报名日期";
    }
    if (input.registrationDeadline && Number.isNaN(new Date(input.registrationDeadline).getTime())) {
      return "最后报名日期格式不正确";
    }
    if (input.startsAt && input.registrationDeadline && new Date(input.registrationDeadline).getTime() > new Date(input.startsAt).getTime()) {
      return "最后报名日期不能晚于活动开始时间";
    }
  }

  if (!(await store.findById("modules", input.moduleId))) {
    return "请选择有效模块";
  }

  if (input.sourceType === "friend") {
    if (!input.friendId) return "请选择客厅的朋友主体";
    const friend = await store.findById("livingRoomFriends", input.friendId);
    if (!friend || friend.enabled === false) return "请选择已启用的客厅朋友主体";
  }

  if (input.seriesId) {
    const series = await store.findById("activitySeries", input.seriesId);
    if (!series || series.enabled === false) return "请选择有效活动系列";
  }

  if (input.collaboratorId) {
    const collaborator = await hydrateUserRole(await store.findById("users", input.collaboratorId));
    if (!collaborator || !userCan(collaborator, "reviewTasks", "review")) {
      return "请选择有效协作员";
    }
  }

  if (activityId && input.capacity !== null) {
    const registrations = await getActivityRegistrations(activityId);
    if (input.capacity < registrations.length) {
      return `当前已有 ${registrations.length} 人报名，人数限额不能小于已报名人数`;
    }
  }

  return "";
}

function legacyHashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashToken(token) {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) return legacyHashToken(token);
  return crypto.createHmac("sha256", secret).update(String(token)).digest("hex");
}

function hashRegistrationAccessToken(token) {
  return hashToken(`registration-access:${token}`);
}

function hashCoInitiatorInviteToken(token) {
  return hashToken(`co-initiator-invite:${token}`);
}

function hashIdentitySyncInviteToken(token) {
  return hashToken(`identity-sync-invite:${token}`);
}

function hashExternalCredential(provider = "", value = "") {
  return hashToken(`external-credential:${provider}:${value}`);
}

function makeExternalCredentialId(provider = "", credentialHash = "") {
  return `extcred_${hashRegistrationIdentity(provider, credentialHash).slice(0, 24)}`;
}

function hashActivityEditLockToken(activityId, token) {
  return hashToken(`activity-edit-lock:${activityId}:${token}`);
}

function safeEqualHash(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left), "hex");
  const rightBuffer = Buffer.from(String(right), "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyRegistrationAccess(registration, token = "") {
  if (!registration || !registration.accessTokenHash || !token) return false;
  return safeEqualHash(registration.accessTokenHash, hashRegistrationAccessToken(token));
}

function registrationOwnedByContext(registration = {}, context = {}) {
  if (!registration) return false;
  if (context.network?.id && registration.identityNetworkId && registration.identityNetworkId === context.network.id) {
    return true;
  }
  if (context.identity?.id && registration.identityId && registration.identityId === context.identity.id) {
    return true;
  }
  if (Array.isArray(context.deviceIds) && context.deviceIds.length && registration.identityId && context.deviceIds.includes(registration.identityId)) {
    return true;
  }
  return false;
}

function hashRegistrationIdentity(activityId, identityValue = "") {
  return crypto.createHash("sha256").update(`${activityId}:${String(identityValue || "").trim()}`).digest("hex");
}

function makeRegistrationId(activityId, identityValue = "") {
  return `reg_${hashRegistrationIdentity(activityId, identityValue).slice(0, 24)}`;
}

async function refreshRegistrationAccess(registration) {
  const accessToken = makeAccessToken();
  const now = new Date().toISOString();
  const patch = {
    accessTokenHash: hashRegistrationAccessToken(accessToken),
    accessTokenUpdatedAt: now,
  };
  const updated = await store.update("registrations", registration.id, patch);
  return {
    registration: updated || { ...registration, ...patch },
    accessToken,
  };
}

function getRegistrationAccessToken(req) {
  return cleanText(req.query.token || req.body?.token || "");
}

async function findRegistration(activityId, registrationId) {
  return store.findByFilters("registrations", [
    { field: "id", op: "eq", value: registrationId },
    { field: "activityId", op: "eq", value: activityId },
  ]);
}

async function findExistingRegistration(activityId, identity = {}) {
  const checks = [
    identity.id ? [{ field: "id", op: "eq", value: identity.id }, { field: "activityId", op: "eq", value: activityId }] : null,
    identity.identityId ? [{ field: "identityId", op: "eq", value: identity.identityId }, { field: "activityId", op: "eq", value: activityId }] : null,
    identity.phoneHash ? [{ field: "phoneHash", op: "eq", value: identity.phoneHash }, { field: "activityId", op: "eq", value: activityId }] : null,
    identity.phone ? [{ field: "phone", op: "eq", value: identity.phone }, { field: "activityId", op: "eq", value: activityId }] : null,
  ].filter(Boolean);
  for (const filters of checks) {
    const item = await store.findByFilters("registrations", filters);
    if (item) return item;
  }
  return null;
}

function identitySubjectKey(context = {}) {
  const networkId = context.network?.id || "";
  const identityId = context.identity?.id || "";
  return networkId ? `network:${networkId}` : `identity:${identityId}`;
}

async function findExistingRegistrationForContext(activityId, context = {}) {
  const checks = [];
  const networkId = context.network?.id || "";
  if (networkId) {
    checks.push([{ field: "identityNetworkId", op: "eq", value: networkId }, { field: "activityId", op: "eq", value: activityId }]);
  }
  if (Array.isArray(context.deviceIds) && context.deviceIds.length) {
    checks.push([{ field: "identityId", op: "in", value: context.deviceIds }, { field: "activityId", op: "eq", value: activityId }]);
  }
  if (context.identity?.id) {
    checks.push([{ field: "identityId", op: "eq", value: context.identity.id }, { field: "activityId", op: "eq", value: activityId }]);
  }
  for (const filters of checks) {
    const item = await store.findByFilters("registrations", filters);
    if (item) return item;
  }
  return null;
}

async function findExistingIdentityScopedRecord(collection, activityId, context = {}) {
  const checks = [];
  const networkId = context.network?.id || "";
  if (networkId) {
    checks.push([{ field: "identityNetworkId", op: "eq", value: networkId }, { field: "activityId", op: "eq", value: activityId }]);
  }
  if (Array.isArray(context.deviceIds) && context.deviceIds.length) {
    checks.push([{ field: "identityId", op: "in", value: context.deviceIds }, { field: "activityId", op: "eq", value: activityId }]);
  }
  if (context.identity?.id) {
    checks.push([{ field: "identityId", op: "eq", value: context.identity.id }, { field: "activityId", op: "eq", value: activityId }]);
  }
  for (const filters of checks) {
    const item = await store.findByFilters(collection, filters);
    if (item) return item;
  }
  return null;
}

function getRequestToken(req) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return req.cookies[SESSION_COOKIE] || bearer;
}

function isSessionExpired(session) {
  const expiresAt = session.expiresAt
    ? new Date(session.expiresAt).getTime()
    : session.createdAt
      ? new Date(session.createdAt).getTime() + SESSION_MAX_AGE_MS
      : 0;
  return !expiresAt || expiresAt <= Date.now();
}

async function cleanupExpiredSessions() {
  if (typeof store.removeWhere === "function") {
    return store.removeWhere("sessions", [{ field: "expiresAt", op: "lt", value: new Date().toISOString() }]);
  }
  return store.remove("sessions", (session) => isSessionExpired(session));
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.STORE_DRIVER === "cloudbase" ? "none" : "lax",
    secure: process.env.STORE_DRIVER === "cloudbase",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  };
}

function anonymousCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.STORE_DRIVER === "cloudbase" ? "none" : "lax",
    secure: process.env.STORE_DRIVER === "cloudbase",
    maxAge: ANONYMOUS_ID_MAX_AGE_MS,
    path: "/",
  };
}

function clearSessionCookieOptions() {
  const { maxAge, ...options } = sessionCookieOptions();
  return options;
}

function ensureAnonymousIdentityCookie(req, res, next) {
  const existing = parseSignedAnonymousId(req.cookies?.[ANONYMOUS_ID_COOKIE] || "");
  if (existing) {
    req.ykAnonymousId = existing;
    next();
    return;
  }
  const signed = makeSignedAnonymousId();
  req.ykAnonymousId = parseSignedAnonymousId(signed);
  res.cookie(ANONYMOUS_ID_COOKIE, signed, anonymousCookieOptions());
  next();
}

async function hydrateIdentityNetworkContext(req, _res, next) {
  if (!req.path.startsWith("/api")) {
    next();
    return;
  }
  try {
    req.ykIdentityContext = await identityNetworkContextForIdentity(requestIdentity(req));
    next();
  } catch (error) {
    next(error);
  }
}

async function getCurrentUser(req) {
  const token = getRequestToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  let session = await store.findByFilters("sessions", [{ field: "tokenHash", op: "eq", value: tokenHash }]);
  if (!session && process.env.SESSION_SECRET) {
    session = await store.findByFilters("sessions", [{ field: "tokenHash", op: "eq", value: legacyHashToken(token) }]);
  }
  if (!session) {
    session = await store.findByFilters("sessions", [{ field: "token", op: "eq", value: token }]);
  }
  if (!session) return null;
  if (isSessionExpired(session)) {
    await store.removeWhere("sessions", [{ field: "id", op: "eq", value: session.id }]);
    return null;
  }
  return hydrateUserRole(await store.findByFilters("users", [{ field: "id", op: "eq", value: session.userId }]));
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function requireLogin(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "请先登录" });
    return;
  }
  req.currentUser = user;
  next();
}

async function requireAdmin(req, res, next) {
  const user = await getCurrentUser(req);
  if (!user || !isAdmin(user)) {
    res.status(403).json({ error: "仅 YKadmin 管理员可操作" });
    return;
  }
  req.currentUser = user;
  next();
}

async function withCoverUrl(activity) {
  const coverUrl = await store.getFileUrl(activity.coverFileId || activity.coverUrl || "");
  return {
    ...activity,
    coverUrl,
  };
}

function apiPublicBaseUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function requestOrigin(req) {
  const origin = req.get("origin") || "";
  return /^https?:\/\//.test(origin) ? origin.replace(/\/$/, "") : apiPublicBaseUrl(req).replace(/\/$/, "");
}

function publicSiteOrigin() {
  const configured = process.env.PUBLIC_SITE_ORIGIN || process.env.SITE_ORIGIN || process.env.WEB_BASE_URL || "";
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
  const corsOrigin = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .find((item) => /^https?:\/\//.test(item) && !/\.service\.tcloudbase\./.test(item));
  if (corsOrigin) return corsOrigin.replace(/\/$/, "");
  return "https://youkong-d5gh4x0ayc29a2187-1441855189.tcloudbaseapp.com";
}

function richImagePublicUrl(req, uploaded = {}) {
  if (uploaded.fileId) {
    return `${apiPublicBaseUrl(req)}/api/files?fileId=${encodeURIComponent(uploaded.fileId)}`;
  }
  return uploaded.url || "";
}

function isAllowedStoredFileId(fileId = "") {
  const value = cleanText(fileId);
  return Boolean(value)
    && value.length <= 800
    && !value.includes("\0")
    && !value.includes("\\")
    && /(^|\/)(activity-covers|rich-images|profile-avatars)\//.test(value);
}

function effectiveCapacity(activity) {
  const capacity = Number(activity?.capacity || DEFAULT_ACTIVITY_CAPACITY);
  if (!Number.isFinite(capacity) || capacity <= 0) return DEFAULT_ACTIVITY_CAPACITY;
  return Math.min(capacity, DEFAULT_ACTIVITY_CAPACITY);
}

async function withMutationLock(key, handler) {
  const lockKey = cleanText(key) || "global";
  const previous = mutationLocks.get(lockKey) || Promise.resolve();
  const run = previous.catch(() => {}).then(handler);
  const tail = run.catch(() => {}).finally(() => {
    if (mutationLocks.get(lockKey) === tail) mutationLocks.delete(lockKey);
  });
  mutationLocks.set(lockKey, tail);
  return run;
}

function normalizeActivityVersion(activity = {}) {
  const version = Number(activity.activityVersion || activity.analysisVersion || 1);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

function activeEditLock(activity = {}) {
  const lock = activity.editLock || null;
  if (!lock?.tokenHash || !lock.expiresAt) return null;
  if (new Date(lock.expiresAt).getTime() <= Date.now()) return null;
  return lock;
}

function publicEditLock(lock = null) {
  if (!lock) return null;
  return {
    lockedByIdentityId: lock.lockedByIdentityId || "",
    lockedByName: lock.lockedByName || "另一位共同发起人",
    lockedAt: lock.lockedAt || "",
    expiresAt: lock.expiresAt || "",
  };
}

function getEditLockToken(req) {
  return cleanText(req.get("X-YK-Edit-Lock-Token") || req.body?.editLockToken || "");
}

function editLockMatches(activity = {}, token = "") {
  const lock = activeEditLock(activity);
  if (!lock || !token) return false;
  return safeEqualHash(lock.tokenHash, hashActivityEditLockToken(activity.id, token));
}

async function editLockActorName(req, user, activity = {}) {
  const identityId = requestIdentityId(req);
  const profile = identityId ? await identityProfileById(identityId, { fallbackName: user?.nickname || activity.initiator }) : null;
  return profile?.displayName || user?.nickname || activity.initiator || "共同发起人";
}

async function issueActivityEditLock(activity, req, user) {
  const token = makeAccessToken();
  const now = new Date();
  const identityId = requestIdentityId(req);
  const lock = {
    tokenHash: hashActivityEditLockToken(activity.id, token),
    lockedByIdentityId: identityId,
    lockedByUserId: user?.id || "",
    lockedByName: await editLockActorName(req, user, activity),
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ACTIVITY_EDIT_LOCK_TTL_MS).toISOString(),
  };
  return { token, lock };
}

function assertActivityEditLock(activity, req, user) {
  if (user && userCan(user, "activities", "edit")) return;
  const expectedVersion = Number(req.body?.activityVersion || 0);
  if (expectedVersion && expectedVersion !== normalizeActivityVersion(activity)) {
    throw Object.assign(new Error("活动已经被其他人更新，请刷新后再继续编辑。"), { statusCode: 409 });
  }
  const lock = activeEditLock(activity);
  if (!lock) {
    throw Object.assign(new Error("请先打开编辑页获取编辑权限。"), { statusCode: 428 });
  }
  if (!editLockMatches(activity, getEditLockToken(req))) {
    throw Object.assign(new Error(`${lock.lockedByName || "另一位共同发起人"} 正在编辑这个活动。`), {
      statusCode: 423,
      data: { lock: publicEditLock(lock) },
    });
  }
}

async function getActivityRegistrations(activityId) {
  const { data } = await store.query("registrations", {
    page: 1,
    pageSize: 1000,
    maxPageSize: 1000,
    filters: [{ field: "activityId", op: "eq", value: activityId }],
    sort: [{ field: "createdAt", direction: "asc" }],
  });
  return data;
}

function publicRegistrationNames(registrations = []) {
  return registrations
    .filter((item) => item && item.nickname)
    .map((item) => ({
      id: item.id,
      nickname: item.nickname,
      createdAt: item.createdAt,
    }));
}

function shanghaiLocalDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function normalizedRegistrationDeadline(activity) {
  return cleanText(activity?.registrationDeadline || activity?.startsAt || "");
}

function hasMinimumRegistrationRequirement(activity) {
  return Boolean(activity?.minRegistrationEnabled) && Number(activity?.minRegistrationCount || 0) > 0;
}

function shouldCancelNotFormedActivity(activity, nowLocal = shanghaiLocalDateTime()) {
  const item = normalizeActivity(activity);
  if (!hasMinimumRegistrationRequirement(item)) return false;
  if (!AUTO_END_ACTIVITY_STATUSES.includes(item.status)) return false;
  const deadline = normalizedRegistrationDeadline(item);
  if (!deadline || deadline > nowLocal) return false;
  return Number(item.registrationCount || 0) < Number(item.minRegistrationCount || 0);
}

async function syncActivityRegistrationCount(activity, registrationCount) {
  const capacity = effectiveCapacity(activity);
  let status = activity.status;
  if (status === ACTIVITY_STATUS.PUBLISHED && registrationCount >= capacity) {
    status = ACTIVITY_STATUS.FULL;
  } else if (status === ACTIVITY_STATUS.FULL && registrationCount < capacity) {
    status = ACTIVITY_STATUS.PUBLISHED;
  }
  return store.update("activities", activity.id, {
    registrationCount,
    status,
    updatedAt: new Date().toISOString(),
  });
}

async function getActivityInterestCount(activityId) {
  return countRecords("activityInterests", [{ field: "activityId", op: "eq", value: activityId }]);
}

function makeActivityInterestId(activityId, identityId) {
  return `interest_${hashRegistrationIdentity(activityId, `identity:${identityId}`).slice(0, 24)}`;
}

function makeActivityNotificationSubscriptionId(activityId, identityKey = "", scene = "activity_reminder") {
  return `notify_${hashRegistrationIdentity(activityId, `${scene}:${identityKey}`).slice(0, 24)}`;
}

async function interestMapForActivities(activityIds = [], req = null) {
  const ids = Array.from(new Set(activityIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const context = req ? await identityNetworkContextForRequest(req) : null;
  const networkId = context?.network?.id || "";
  const deviceIds = context?.deviceIds || [];
  const myInterestFilters = networkId
    ? [{ field: "identityNetworkId", op: "eq", value: networkId }]
    : (deviceIds.length ? [{ field: "identityId", op: "in", value: deviceIds }] : []);
  const [{ data: interests }, myInterests] = await Promise.all([
    store.query("activityInterests", {
      page: 1,
      pageSize: Math.min(Math.max(ids.length * 10, 1), 1000),
      maxPageSize: 1000,
      filters: [{ field: "activityId", op: "in", value: ids }],
    }),
    myInterestFilters.length
      ? store.query("activityInterests", {
        page: 1,
        pageSize: Math.min(Math.max(ids.length * 4, 1), 1000),
        maxPageSize: 1000,
        filters: [
          { field: "activityId", op: "in", value: ids },
          ...myInterestFilters,
        ],
      })
      : Promise.resolve({ data: [] }),
  ]);
  const map = new Map(ids.map((id) => [id, { count: 0, interestedByMe: false }]));
  interests.forEach((item) => {
    const state = map.get(item.activityId);
    if (state) state.count += 1;
  });
  (myInterests.data || []).forEach((item) => {
    const state = map.get(item.activityId);
    if (state) state.interestedByMe = true;
  });
  return map;
}

function parseFriendInput(body = {}) {
  return {
    name: cleanText(body.name),
    description: cleanText(body.description),
    logoUrl: cleanText(body.logoUrl),
    address: cleanText(body.address),
    contactName: cleanText(body.contactName),
    contactInfo: cleanText(body.contactInfo),
    enabled: body.enabled === undefined ? true : truthyFormValue(body.enabled),
  };
}

function validateFriendInput(input = {}) {
  if (!input.name) return "名称不能为空";
  return [
    validateTextLength("名称", input.name, TEXT_LIMITS.friendName),
    validateTextLength("简介", input.description, TEXT_LIMITS.friendDescription),
    validateTextLength("地址", input.address, TEXT_LIMITS.friendAddress),
    validateTextLength("联系人", input.contactName, TEXT_LIMITS.friendContact),
    validateTextLength("联系人联系方式", input.contactInfo, TEXT_LIMITS.friendContactInfo),
  ].find(Boolean) || "";
}

function parseActivityFeedbackInput(body = {}) {
  return {
    favorite: cleanText(body.favorite),
    improvement: cleanText(body.improvement),
    other: cleanText(body.other),
  };
}

function validateActivityFeedbackInput(input = {}) {
  if (!input.favorite && !input.improvement && !input.other) {
    return "至少写一点活动反馈";
  }
  return [
    validateTextLength("最喜欢的地方", input.favorite, TEXT_LIMITS.feedbackText),
    validateTextLength("可以改进的地方", input.improvement, TEXT_LIMITS.feedbackText),
    validateTextLength("其他想说的", input.other, TEXT_LIMITS.feedbackText),
  ].find(Boolean) || "";
}

function feedbackStatusLabel(status = "") {
  return {
    [FEEDBACK_STATUS.APPROVED]: "已展示",
    [FEEDBACK_STATUS.ADMIN_REVIEW]: "待管理员审核",
    [FEEDBACK_STATUS.REJECTED]: "不展示",
  }[status] || "待管理员审核";
}

function makeActivityFeedbackId(activityId, identityId) {
  return `feedback_${hashRegistrationIdentity(activityId, `identity:${identityId}`).slice(0, 24)}`;
}

function hasActivityStarted(activity = {}, now = new Date()) {
  const startsAt = activity.startsAt ? new Date(activity.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return false;
  return startsAt.getTime() <= now.getTime();
}

function publicActivityFeedback(feedback = {}, options = {}) {
  const payload = {
    id: feedback.id,
    activityId: feedback.activityId,
    favorite: feedback.favorite || "",
    improvement: feedback.improvement || "",
    other: feedback.other || "",
    status: feedback.status || FEEDBACK_STATUS.ADMIN_REVIEW,
    statusLabel: feedbackStatusLabel(feedback.status),
    feedbackWeight: Number(feedback.feedbackWeight || 0),
    createdAt: feedback.createdAt || "",
  };
  if (options.includeAnalysis) {
    payload.aiStatus = feedback.aiStatus || "";
    payload.aiReason = feedback.aiReason || "";
    payload.aiReport = feedback.aiReport || null;
    payload.identityId = feedback.identityId || "";
    payload.ownerHiddenPreviousStatus = feedback.ownerHiddenPreviousStatus || "";
    payload.activityTitle = feedback.activityTitle || "";
  }
  return payload;
}

async function publicFeedbacksForActivity(activity = {}) {
  if (!activity?.id || activity.showFeedbacks === false) return [];
  const { data } = await store.query("activityFeedbacks", {
    page: 1,
    pageSize: 3,
    maxPageSize: 3,
    filters: [
      { field: "activityId", op: "eq", value: activity.id },
      { field: "status", op: "eq", value: FEEDBACK_STATUS.APPROVED },
    ],
    sort: [{ field: "feedbackWeight", direction: "desc" }, { field: "createdAt", direction: "desc" }],
  });
  return data.map((item) => publicActivityFeedback(item));
}

function publicActivityNotificationSubscription(subscription = {}) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    activityId: subscription.activityId || "",
    scene: subscription.scene || "activity_reminder",
    status: subscription.status || "pending",
    source: subscription.source || "wechat_miniprogram",
    templateIds: Array.isArray(subscription.templateIds) ? subscription.templateIds : [],
    createdAt: subscription.createdAt || "",
    updatedAt: subscription.updatedAt || "",
  };
}

function activityRecapStatus(activity = {}, registrationCount = 0) {
  const min = Number(activity.minRegistrationCount || 0);
  if (!activity.minRegistrationEnabled || !min) {
    return {
      key: "no_minimum",
      label: "不设最低成团人数",
      text: "这个活动不设置最低报名限度，可以按现有节奏发起。",
    };
  }
  if (activity.status === ACTIVITY_STATUS.NOT_FORMED_CANCELLED) {
    return {
      key: "not_formed",
      label: "未成团取消",
      text: `最低 ${min} 人成团，实际 ${registrationCount} 人报名，活动已自动取消。`,
    };
  }
  if (registrationCount >= min) {
    return {
      key: "formed",
      label: "已达到成团人数",
      text: `最低 ${min} 人成团，目前 ${registrationCount} 人报名。`,
    };
  }
  return {
    key: "forming",
    label: "等待成团",
    text: `最低 ${min} 人成团，目前还差 ${Math.max(min - registrationCount, 0)} 人。`,
  };
}

function buildActivityRecapSummary(activity = {}, metrics = {}, topFeedbacks = []) {
  const pieces = [
    `${activity.title || "这场活动"}目前有 ${Number(metrics.registrationCount || 0)} 人报名`,
    `${Number(metrics.interestCount || 0)} 人点了感兴趣`,
    `${Number(metrics.feedbackCount || 0)} 条活动反馈`,
  ];
  if (metrics.formation?.label) pieces.push(metrics.formation.label);
  const feedbackLine = topFeedbacks[0]
    ? `精选反馈提到：“${topFeedbacks[0].favorite || topFeedbacks[0].improvement || topFeedbacks[0].other || "活动体验已记录"}”`
    : "还没有可公开展示的精选反馈";
  return `${pieces.join("，")}。${feedbackLine}。`;
}

async function activityRecapPayload(activity, options = {}) {
  activity = normalizeActivity(activity);
  const [
    registrations,
    interestCount,
    feedbackCount,
    approvedFeedbackCount,
    adminReviewFeedbackCount,
    rejectedFeedbackCount,
    topFeedbackResult,
  ] = await Promise.all([
    getActivityRegistrations(activity.id),
    getActivityInterestCount(activity.id),
    countRecords("activityFeedbacks", [{ field: "activityId", op: "eq", value: activity.id }]),
    countRecords("activityFeedbacks", [
      { field: "activityId", op: "eq", value: activity.id },
      { field: "status", op: "eq", value: FEEDBACK_STATUS.APPROVED },
    ]),
    countRecords("activityFeedbacks", [
      { field: "activityId", op: "eq", value: activity.id },
      { field: "status", op: "eq", value: FEEDBACK_STATUS.ADMIN_REVIEW },
    ]),
    countRecords("activityFeedbacks", [
      { field: "activityId", op: "eq", value: activity.id },
      { field: "status", op: "eq", value: FEEDBACK_STATUS.REJECTED },
    ]),
    store.query("activityFeedbacks", {
      page: 1,
      pageSize: 3,
      maxPageSize: 3,
      filters: [
        { field: "activityId", op: "eq", value: activity.id },
        { field: "status", op: "eq", value: FEEDBACK_STATUS.APPROVED },
      ],
      sort: [{ field: "feedbackWeight", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    }),
  ]);
  const registrationCount = registrations.length;
  const metrics = {
    registrationCount,
    interestCount,
    feedbackCount,
    approvedFeedbackCount,
    adminReviewFeedbackCount,
    rejectedFeedbackCount,
    capacity: effectiveCapacity(activity),
    formation: activityRecapStatus(activity, registrationCount),
  };
  const topFeedbacks = (topFeedbackResult.data || []).map((item) => publicActivityFeedback(item, { includeAnalysis: true }));
  return {
    activity: await toActivityPayload(activity, options),
    metrics,
    topFeedbacks,
    summaryText: buildActivityRecapSummary(activity, metrics, topFeedbacks),
  };
}

function feedbackNeedsAdminReview(report = null) {
  if (!report) return true;
  if (report.shouldDisplay === false) return true;
  if (Number(report.riskScore || 0) >= 60) return true;
  if (report.riskLevel === "high") return true;
  return Boolean(
    report.isSpam
    || report.isAdvertisement
    || report.containsAbuse
    || report.containsPersonalAttack
    || report.containsPolitical
    || report.containsIllegal
    || report.containsAdult
  );
}

async function analyzeAndClassifyFeedback(activity, feedback, moduleName = "") {
  const analysis = await analyzeFeedback(store, {
    activityTitle: activity.title,
    activityModule: moduleName,
    activitySource: activity.sourceName || "",
    favorite: feedback.favorite,
    improvement: feedback.improvement,
    other: feedback.other,
  }, {
    activityId: activity.id,
    feedbackId: feedback.id,
  });
  if (analysis.report && !feedbackNeedsAdminReview(analysis.report)) {
    return {
      status: FEEDBACK_STATUS.APPROVED,
      feedbackWeight: Number(analysis.report.feedbackWeight || 50),
      aiStatus: "completed",
      aiReason: analysis.report.displayReason || "AI 判断适合展示",
      aiReport: analysis.report,
      promptVersion: analysis.prompt?.version || "",
    };
  }
  if (analysis.report) {
    return {
      status: FEEDBACK_STATUS.ADMIN_REVIEW,
      feedbackWeight: Number(analysis.report.feedbackWeight || 30),
      aiStatus: "completed",
      aiReason: analysis.report.displayReason || (analysis.report.riskReason || []).join("；") || "AI 建议管理员确认后再展示",
      aiReport: analysis.report,
      promptVersion: analysis.prompt?.version || "",
    };
  }
  return {
    status: FEEDBACK_STATUS.ADMIN_REVIEW,
    feedbackWeight: 0,
    aiStatus: analysis.reason || "skipped",
    aiReason: analysis.error || "AI 未启用或暂时不可用，已进入管理员审核",
    aiReport: null,
    promptVersion: analysis.prompt?.version || "",
  };
}

async function syncActivityFeedbackCounts(activityId) {
  const [total, approved] = await Promise.all([
    countRecords("activityFeedbacks", [{ field: "activityId", op: "eq", value: activityId }]),
    countRecords("activityFeedbacks", [
      { field: "activityId", op: "eq", value: activityId },
      { field: "status", op: "eq", value: FEEDBACK_STATUS.APPROVED },
    ]),
  ]);
  await store.update("activities", activityId, {
    feedbackCount: total,
    approvedFeedbackCount: approved,
    updatedAt: new Date().toISOString(),
  });
  return { total, approved };
}

async function loadRecordsByIds(collection, ids = []) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map();
  const { data } = await store.query(collection, {
    page: 1,
    pageSize: uniqueIds.length,
    maxPageSize: Math.max(uniqueIds.length, 1),
    filters: [{ field: "id", op: "in", value: uniqueIds }],
  });
  return new Map(data.map((item) => [item.id, item]));
}

function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const requestedSize = Number.parseInt(query.pageSize || query.limit || DEFAULT_PAGE_SIZE, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.max(1, Math.min(requestedSize, MAX_PAGE_SIZE));
  return { page, pageSize };
}

function pageQueryOptions(query = {}) {
  const { page, pageSize } = parsePagination(query);
  return { page, pageSize, maxPageSize: MAX_PAGE_SIZE };
}

async function countRecords(collection, filters = [], options = {}) {
  if (typeof store.count === "function") {
    return store.count(collection, { ...options, filters });
  }
  const { pageInfo } = await store.query(collection, {
    page: 1,
    pageSize: 1,
    filters,
    keyword: options.keyword,
    keywordFields: options.keywordFields,
  });
  return pageInfo.total;
}

async function activityStatusCounts(baseFilters = []) {
  const entries = await Promise.all(
    Object.values(ACTIVITY_STATUS).map(async (status) => [
      status,
      await countRecords("activities", [...baseFilters, { field: "status", op: "eq", value: status }]),
    ])
  );
  return Object.fromEntries(entries);
}

function summarizeActivityCounts(byStatus = {}) {
  const total = Object.values(byStatus).reduce((sum, value) => sum + Number(value || 0), 0);
  return {
    total,
    byStatus,
    reviewing: Number(byStatus[ACTIVITY_STATUS.ANALYSIS_PENDING] || 0)
      + Number(byStatus[ACTIVITY_STATUS.ADMIN_REVIEW] || 0)
      + Number(byStatus[ACTIVITY_STATUS.COLLABORATOR_REVIEW] || 0),
    published: Number(byStatus[ACTIVITY_STATUS.PUBLISHED] || 0)
      + Number(byStatus[ACTIVITY_STATUS.FULL] || 0),
  };
}

function pendingFiltersForUser(user) {
  if (userCan(user, "activities", "review")) {
    return [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW }];
  }
  if (userCan(user, "reviewTasks", "review")) {
    return [
      { field: "status", op: "eq", value: ACTIVITY_STATUS.COLLABORATOR_REVIEW },
      { field: "collaboratorId", op: "eq", value: user.id },
    ];
  }
  return [impossibleFilter()];
}

async function pendingPreviewForUser(user, limit = 3) {
  if (!userCan(user, "activities", "review") && !userCan(user, "reviewTasks", "review")) {
    return { total: 0, activities: [] };
  }
  if (userCan(user, "activities", "review")) {
    const [reviewing, attention] = await Promise.all([
      store.query("activities", {
        page: 1,
        pageSize: limit,
        maxPageSize: limit,
        filters: [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW }],
        sort: activitySortRules("created-desc"),
      }),
      store.query("activities", {
        page: 1,
        pageSize: limit,
        maxPageSize: limit,
        filters: [
          { field: "status", op: "eq", value: ACTIVITY_STATUS.PUBLISHED },
          { field: "reviewFlag", op: "eq", value: "admin_attention" },
        ],
        sort: activitySortRules("created-desc"),
      }),
    ]);
    const merged = dedupeById([...(reviewing.data || []), ...(attention.data || [])])
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
      .slice(0, limit);
    return {
      total: Number(reviewing.pageInfo?.total || 0) + Number(attention.pageInfo?.total || 0),
      activities: await toActivityListPayload(merged),
    };
  }
  const { data, pageInfo } = await store.query("activities", {
    page: 1,
    pageSize: limit,
    maxPageSize: limit,
    filters: pendingFiltersForUser(user),
    sort: activitySortRules("created-desc"),
  });
  return {
    total: pageInfo.total,
    activities: await toActivityListPayload(data),
  };
}

function dedupeById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function ownerFilterSetsForRequest(req, user = null) {
  const identity = requestIdentity(req);
  const context = req?.ykIdentityContext || null;
  const networkId = requestIdentityNetworkId(req);
  const deviceIds = requestIdentityIds(req);
  const ownerFilterSets = [];
  if (user) ownerFilterSets.push([{ field: "createdBy", op: "eq", value: user.id }]);
  if (networkId) {
    ownerFilterSets.push([{ field: "identityNetworkId", op: "eq", value: networkId }]);
    if (deviceIds.length) ownerFilterSets.push([{ field: "anonymousIdentityId", op: "in", value: deviceIds }]);
  } else if (identity.id || context?.identity?.id) {
    ownerFilterSets.push([{ field: "anonymousIdentityId", op: "eq", value: identity.id || context.identity.id }]);
  }
  return ownerFilterSets;
}

async function coInitiatedActivityIdsForRequest(req) {
  const identityIds = requestIdentityIds(req);
  const networkId = requestIdentityNetworkId(req);
  if (!identityIds.length && !networkId) return [];
  const queries = [];
  if (identityIds.length) {
    queries.push(store.query("activityCoInitiators", {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      filters: [
        { field: "identityId", op: "in", value: identityIds },
        { field: "status", op: "eq", value: "active" },
      ],
      sort: [{ field: "acceptedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    }));
  }
  if (networkId) {
    queries.push(store.query("activityCoInitiators", {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      filters: [
        { field: "identityNetworkId", op: "eq", value: networkId },
        { field: "status", op: "eq", value: "active" },
      ],
      sort: [{ field: "acceptedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    }));
  }
  const results = await Promise.all(queries);
  return Array.from(new Set(results.flatMap((result) => (result.data || []).map((item) => item.activityId).filter(Boolean))));
}

async function activityCoInitiatorMatchesRequest(activity, req) {
  const ids = requestIdentityIds(req);
  if (!ids.length && !requestIdentityNetworkId(req)) return false;
  const { data } = await store.query("activityCoInitiators", {
    page: 1,
    pageSize: 1,
    maxPageSize: 1,
    filters: [
      { field: "activityId", op: "eq", value: activity.id },
      { field: "status", op: "eq", value: "active" },
    ],
  });
  return data.some((item) =>
    ids.includes(item.identityId) || (requestIdentityNetworkId(req) && item.identityNetworkId === requestIdentityNetworkId(req)));
}

async function countOwnedActivitiesForRequest(req, user = null, filters = [], options = {}) {
  const ownerFilterSets = ownerFilterSetsForRequest(req, user);
  const coActivityIds = await coInitiatedActivityIdsForRequest(req);
  if (!ownerFilterSets.length && !coActivityIds.length) return 0;
  const ids = new Set();
  const queryOptions = {
    page: 1,
    pageSize: 1000,
    maxPageSize: 1000,
    keyword: options.keyword,
    keywordFields: options.keywordFields,
    sort: activitySortRules("created-desc"),
  };
  const queries = [
    ...ownerFilterSets.map((ownerFilters) =>
      store.query("activities", { ...queryOptions, filters: [...filters, ...ownerFilters] })),
    ...(coActivityIds.length ? [
      store.query("activities", {
        ...queryOptions,
        filters: [...filters, { field: "id", op: "in", value: coActivityIds }],
      }),
    ] : []),
  ];
  const results = await Promise.all(queries);
  results.forEach((result) => (result.data || []).forEach((activity) => activity?.id && ids.add(activity.id)));
  return ids.size;
}

function activityPageInfo(total, page, pageSize, visible) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    hasMore: (page - 1) * pageSize + visible < total,
  };
}

async function ownedActivityPageForRequest(req, user = null, options = {}) {
  const ownerFilterSets = ownerFilterSetsForRequest(req, user);
  const coActivityIds = await coInitiatedActivityIdsForRequest(req);
  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.max(1, Math.min(Number(options.pageSize || 12), MAX_PAGE_SIZE));
  if (!ownerFilterSets.length && !coActivityIds.length) return { data: [], pageInfo: activityPageInfo(0, page, pageSize, 0) };
  const candidateLimit = Math.min(Math.max(page * pageSize, pageSize), 1000);
  const filters = Array.isArray(options.filters) ? options.filters : [];
  const sort = Array.isArray(options.sort) ? options.sort : activitySortRules("created-desc");
  const keyword = options.keyword;
  const keywordFields = options.keywordFields;
  if (ownerFilterSets.length === 1 && !coActivityIds.length) {
    return store.query("activities", {
      page,
      pageSize,
      maxPageSize: pageSize,
      filters: [...filters, ...ownerFilterSets[0]],
      keyword,
      keywordFields,
      sort,
    });
  }
  const queryOptions = {
    page: 1,
    pageSize: candidateLimit,
    maxPageSize: candidateLimit,
    filters,
    keyword,
    keywordFields,
    sort,
  };
  const queries = ownerFilterSets.map((ownerFilters) =>
    store.query("activities", { ...queryOptions, filters: [...filters, ...ownerFilters] }));
  if (coActivityIds.length) {
    queries.push(store.query("activities", {
      ...queryOptions,
      filters: [...filters, { field: "id", op: "in", value: coActivityIds }],
    }));
  }
  const results = await Promise.all(queries);
  const merged = dedupeById(results.flatMap((result) => result.data || []))
    .sort((a, b) => {
      for (const rule of sort) {
        const left = a?.[rule.field] || "";
        const right = b?.[rule.field] || "";
        if (left === right) continue;
        return rule.direction === "asc"
          ? String(left).localeCompare(String(right))
          : String(right).localeCompare(String(left));
      }
      return 0;
    });
  const total = merged.length < candidateLimit
    ? merged.length
    : await countOwnedActivitiesForRequest(req, user, filters, { keyword, keywordFields });
  const start = (page - 1) * pageSize;
  const data = merged.slice(start, start + pageSize);
  return {
    data,
    pageInfo: activityPageInfo(total, page, pageSize, data.length),
  };
}

async function identityOwnedRecordPage(collection, identityField, req, options = {}) {
  const context = await identityNetworkContextForRequest(req);
  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.max(1, Math.min(Number(options.pageSize || 12), MAX_PAGE_SIZE));
  const sort = Array.isArray(options.sort) ? options.sort : [{ field: "createdAt", direction: "desc" }];
  const baseFilters = Array.isArray(options.filters) ? options.filters : [];
  const candidateLimit = Math.min(Math.max(page * pageSize, pageSize), 1000);
  const filterSets = [];
  if (context.network?.id) {
    filterSets.push([{ field: "identityNetworkId", op: "eq", value: context.network.id }]);
    if (context.deviceIds.length) filterSets.push([{ field: identityField, op: "in", value: context.deviceIds }]);
  } else if (context.identity?.id) {
    filterSets.push([{ field: identityField, op: "eq", value: context.identity.id }]);
  }
  if (!filterSets.length) return { data: [], pageInfo: activityPageInfo(0, page, pageSize, 0) };
  const results = await Promise.all(filterSets.map((filters) => store.query(collection, {
    page: 1,
    pageSize: candidateLimit,
    maxPageSize: candidateLimit,
    filters: [...baseFilters, ...filters],
    sort,
  })));
  const merged = dedupeById(results.flatMap((result) => result.data || []))
    .sort((a, b) => {
      for (const rule of sort) {
        const left = a?.[rule.field] || "";
        const right = b?.[rule.field] || "";
        if (left === right) continue;
        return rule.direction === "asc"
          ? String(left).localeCompare(String(right))
          : String(right).localeCompare(String(left));
      }
      return 0;
    });
  const total = merged.length < candidateLimit
    ? merged.length
    : dedupeById((await Promise.all(filterSets.map((filters) => store.query(collection, {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      filters: [...baseFilters, ...filters],
    })))).flatMap((result) => result.data || [])).length;
  const start = (page - 1) * pageSize;
  const data = merged.slice(start, start + pageSize);
  return { data, pageInfo: activityPageInfo(total, page, pageSize, data.length) };
}

async function memberDashboardPayload(req, user = null) {
  const [statusEntries, pending] = await Promise.all([
    Promise.all(Object.values(ACTIVITY_STATUS).map(async (status) => [
      status,
      await countOwnedActivitiesForRequest(req, user, [{ field: "status", op: "eq", value: status }]),
    ])),
    user ? pendingPreviewForUser(user, 3) : { total: 0, activities: [] },
  ]);
  const byStatus = Object.fromEntries(statusEntries);
  return {
    summary: summarizeActivityCounts(byStatus),
    pending,
  };
}

async function adminDashboardPayload(user) {
  const canViewFeedbacks = userCan(user, "feedbacks", "view");
  const [byStatus, usersTotal, rolesTotal, modulesTotal, templatesTotal, friendsTotal, feedbackReviewTotal, pending, feedbackPreview] = await Promise.all([
    activityStatusCounts(),
    countRecords("users"),
    countRecords("roles"),
    countRecords("modules"),
    countRecords("templates"),
    countRecords("livingRoomFriends"),
    canViewFeedbacks ? countRecords("activityFeedbacks", [{ field: "status", op: "eq", value: FEEDBACK_STATUS.ADMIN_REVIEW }]) : Promise.resolve(0),
    pendingPreviewForUser(user, 4),
    canViewFeedbacks ? store.query("activityFeedbacks", {
      page: 1,
      pageSize: 4,
      maxPageSize: 4,
      filters: [{ field: "status", op: "eq", value: FEEDBACK_STATUS.ADMIN_REVIEW }],
      sort: [{ field: "createdAt", direction: "desc" }],
    }) : Promise.resolve({ data: [] }),
  ]);
  const feedbacks = await toFeedbackListPayload(feedbackPreview.data || []);
  const pendingTotal = Number(pending.total || 0) + Number(feedbackReviewTotal || 0);
  return {
    activities: summarizeActivityCounts(byStatus),
    users: { total: usersTotal },
    roles: { total: rolesTotal },
    modules: { total: modulesTotal },
    templates: { total: templatesTotal },
    friends: { total: friendsTotal },
    feedbacks: { pendingReview: feedbackReviewTotal },
    pending: {
      ...pending,
      total: pendingTotal,
      activityTotal: pending.total || 0,
      feedbackTotal: feedbackReviewTotal,
      feedbacks,
    },
  };
}

async function safetyHealthPayload() {
  const [settings, usageToday, usageWeek, pendingAnalysis, queuedJobs, adminReview, hiddenReview, feedbackReview, reportWarnings, highRiskActivities, recentReports] = await Promise.all([
    getAiSettings(store),
    getAiUsageStats(store, { days: 1 }),
    getAiUsageStats(store, { days: 7 }),
    countRecords("activities", [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ANALYSIS_PENDING }]),
    countRecords("activityAnalysisJobs", [{ field: "status", op: "in", value: ["pending", "running"] }]),
    countRecords("activities", [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW }]),
    countRecords("activities", [
      { field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW },
      { field: "isHidden", op: "eq", value: true },
    ]),
    countRecords("activityFeedbacks", [{ field: "status", op: "eq", value: FEEDBACK_STATUS.ADMIN_REVIEW }]),
    countRecords("activities", [{ field: "reportWarning", op: "eq", value: true }]),
    countRecords("activities", [{ field: "riskScore", op: "gte", value: 70 }]),
    store.query("communityReports", {
      page: 1,
      pageSize: 5,
      maxPageSize: 5,
      sort: [{ field: "createdAt", direction: "desc" }],
    }),
  ]);
  const dailyLimit = Number(settings.callStrategy?.dailyCallLimit || 0);
  return {
    ai: {
      enabled: settings.enabled === true,
      dailyLimit,
      todayCalls: Number(usageToday.totalCalls || 0),
      remainingToday: dailyLimit > 0 ? Math.max(dailyLimit - Number(usageToday.totalCalls || 0), 0) : null,
      successRate7d: Number(usageWeek.successRate || 0),
      averageDurationMs7d: Number(usageWeek.averageDurationMs || 0),
      recentErrors: usageWeek.recentErrors || [],
    },
    queue: {
      pendingAnalysis,
      queuedJobs,
      adminReview,
      hiddenReview,
      feedbackReview,
    },
    risk: {
      reportWarnings,
      highRiskActivities,
      recentReports: recentReports.data || [],
    },
  };
}

async function hydrateTrustProfiles(profiles = []) {
  return Promise.all(profiles.map(async (profile) => {
    const { data: activities } = await store.query("activities", {
      page: 1,
      pageSize: 1,
      maxPageSize: 1,
      filters: [{ field: "anonymousIdentityId", op: "eq", value: profile.id }],
      sort: activitySortRules("created-desc"),
    });
    const latestActivity = activities[0] || null;
    const badges = await badgeSummaryForIdentity(store, profile.id);
    return {
      ...profile,
      communityId: profile.communityId || communityId(profile.id),
      communityLevel: profile.communityLevel || "normal",
      status: profile.status || "normal",
      badges,
      latestInitiator: latestActivity?.initiator || "",
      latestActivityTitle: latestActivity?.title || "",
    };
  }));
}

async function publicProfileActivities(identityId = "", req = null) {
  const profileId = cleanText(identityId);
  if (profileId.startsWith("net_")) {
    const devices = await activeDevicesForNetwork(profileId);
    const deviceIds = devices.map((device) => device.identityId).filter(Boolean);
    const [networkOwned, legacyOwned, coRows] = await Promise.all([
      store.query("activities", {
        page: 1,
        pageSize: 24,
        maxPageSize: 24,
        filters: [
          { field: "identityNetworkId", op: "eq", value: profileId },
          { field: "status", op: "in", value: PUBLIC_ACTIVITY_STATUSES },
        ],
        sort: activitySortRules("created-desc"),
      }),
      deviceIds.length ? store.query("activities", {
        page: 1,
        pageSize: 24,
        maxPageSize: 24,
        filters: [
          { field: "anonymousIdentityId", op: "in", value: deviceIds },
          { field: "status", op: "in", value: PUBLIC_ACTIVITY_STATUSES },
        ],
        sort: activitySortRules("created-desc"),
      }) : Promise.resolve({ data: [] }),
      deviceIds.length ? store.query("activityCoInitiators", {
        page: 1,
        pageSize: 100,
        maxPageSize: 100,
        filters: [
          { field: "identityId", op: "in", value: deviceIds },
          { field: "status", op: "eq", value: "active" },
        ],
        sort: [{ field: "acceptedAt", direction: "desc" }],
      }) : Promise.resolve({ data: [] }),
    ]);
    const coIds = (coRows.data || []).map((item) => item.activityId).filter(Boolean);
    const coResult = coIds.length ? await store.query("activities", {
      page: 1,
      pageSize: 24,
      maxPageSize: 24,
      filters: [
        { field: "id", op: "in", value: coIds },
        { field: "status", op: "in", value: PUBLIC_ACTIVITY_STATUSES },
      ],
      sort: activitySortRules("created-desc"),
    }) : { data: [] };
    const visible = dedupeById([...(networkOwned.data || []), ...(legacyOwned.data || []), ...(coResult.data || [])])
      .filter((activity) => !activity.isHidden)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 24);
    return toActivityListPayload(visible, { req });
  }
  const [ownedResult, coIds] = await Promise.all([
    store.query("activities", {
      page: 1,
      pageSize: 24,
      maxPageSize: 24,
      filters: [
        { field: "anonymousIdentityId", op: "eq", value: identityId },
        { field: "status", op: "in", value: PUBLIC_ACTIVITY_STATUSES },
      ],
      sort: activitySortRules("created-desc"),
    }),
    (async () => {
      const { data } = await store.query("activityCoInitiators", {
        page: 1,
        pageSize: 100,
        maxPageSize: 100,
        filters: [
          { field: "identityId", op: "eq", value: identityId },
          { field: "status", op: "eq", value: "active" },
        ],
        sort: [{ field: "acceptedAt", direction: "desc" }],
      });
      return data.map((item) => item.activityId).filter(Boolean);
    })(),
  ]);
  const coResult = coIds.length ? await store.query("activities", {
    page: 1,
    pageSize: 24,
    maxPageSize: 24,
    filters: [
      { field: "id", op: "in", value: coIds },
      { field: "status", op: "in", value: PUBLIC_ACTIVITY_STATUSES },
    ],
    sort: activitySortRules("created-desc"),
  }) : { data: [] };
  const visible = dedupeById([...(ownedResult.data || []), ...(coResult.data || [])])
    .filter((activity) => !activity.isHidden)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 24);
  return toActivityListPayload(visible, { req });
}

function summarizePublicProfileActivities(activities = []) {
  return activities.reduce((summary, activity) => {
    summary.total += 1;
    if (activity.status === ACTIVITY_STATUS.PUBLISHED || activity.status === ACTIVITY_STATUS.FULL) summary.upcoming += 1;
    if (activity.status === ACTIVITY_STATUS.ENDED || activity.status === ACTIVITY_STATUS.NOT_FORMED_CANCELLED) summary.history += 1;
    summary.registrations += Number(activity.registrationCount || 0);
    summary.interests += Number(activity.interestCount || 0);
    return summary;
  }, { total: 0, upcoming: 0, history: 0, registrations: 0, interests: 0 });
}

async function emitActivityPublishedEvent(activity, profile, reason = "") {
  if (!activity?.id || !profile?.id) return null;
  const safetyConfig = await getSafetyConfig(store);
  return recordCommunityEvent(store, profile, {
    type: "activity.published",
    source: "activity",
    reason: reason || `活动发布：${activity.title}`,
    activityId: activity.id,
    payload: {
      title: activity.title,
      status: activity.status,
      confidenceScore: activity.confidenceScore,
      riskScore: activity.riskScore,
    },
  }, safetyConfig.trust);
}

function fallbackAnalysisNotice(reason = "") {
  return {
    level: "high",
    text: reason
      ? `系统分析暂时失败，已先转入管理员兜底审核：${reason}`
      : "系统分析暂时失败，已先转入管理员兜底审核。",
    visible: true,
  };
}

function activityAnalysisStatusPatch(activity = {}, analysis = {}, riskPatch = {}, completedAt = new Date().toISOString()) {
  const policy = analysis.policy || {};
  if ([ACTIVITY_STATUS.CANCELLED, ACTIVITY_STATUS.NOT_FORMED_CANCELLED, ACTIVITY_STATUS.ENDED, ACTIVITY_STATUS.REJECTED].includes(activity.status)) {
    return {
      status: activity.status,
      reviewStep: activity.reviewStep || "",
      reviewMode: activity.reviewMode || "",
      isHidden: Boolean(activity.isHidden),
      publishedAt: activity.publishedAt || "",
    };
  }
  if (activity.status === ACTIVITY_STATUS.DRAFT) {
    return {
      status: ACTIVITY_STATUS.DRAFT,
      reviewStep: "",
      reviewMode: "",
      isHidden: false,
      publishedAt: activity.publishedAt || "",
    };
  }
  let nextStatus = policy.status || ACTIVITY_STATUS.ADMIN_REVIEW;
  if (activity.status === ACTIVITY_STATUS.FULL && nextStatus === ACTIVITY_STATUS.PUBLISHED) {
    nextStatus = ACTIVITY_STATUS.FULL;
  }
  const nextReviewStep = policy.reviewStep || (nextStatus === ACTIVITY_STATUS.ADMIN_REVIEW ? "admin" : "");
  return {
    status: nextStatus,
    reviewStep: nextReviewStep,
    reviewMode: riskPatch.reviewMode || policy.reviewMode || "",
    isHidden: Boolean(riskPatch.isHidden),
    publishedAt: [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(nextStatus)
      ? (activity.publishedAt || completedAt)
      : activity.publishedAt || "",
  };
}

async function applyActivityAnalysisResult(activity, analysis, analysisReport, context = {}, options = {}) {
  const completedAt = options.completedAt || new Date().toISOString();
  const riskPatch = activityRiskPatch(analysisReport, { ...context, activity });
  const statusPatch = activityAnalysisStatusPatch(activity, analysis, riskPatch, completedAt);
  const updated = await store.update("activities", activity.id, {
    ...riskPatch,
    ...statusPatch,
    analysisStatus: "completed",
    analysisJobId: options.jobId || activity.analysisJobId || "",
    analysisCompletedAt: completedAt,
    updatedAt: completedAt,
  });
  return { updated: updated || activity, riskPatch, statusPatch };
}

async function createActivityAnalysisJob(activity, trigger = "submit") {
  if (!activity?.id || activity.status === ACTIVITY_STATUS.DRAFT) return null;
  const now = new Date().toISOString();
  const job = {
    id: makeId("analysis_job"),
    activityId: activity.id,
    activityVersion: Number(activity.analysisVersion || 1),
    trigger,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await store.insert("activityAnalysisJobs", job);
  return job;
}

async function enqueueActivityAnalysis(activity, trigger = "submit") {
  const job = await createActivityAnalysisJob(activity, trigger);
  if (!job) return null;
  kickActivityAnalysisQueue(trigger);
  return job;
}

async function markActivityAnalysisFailed(job, activity, error) {
  const now = new Date().toISOString();
  const message = cleanText(error?.message || error || "analysis failed").slice(0, 300);
  await store.update("activityAnalysisJobs", job.id, {
    status: "failed",
    error: message,
    updatedAt: now,
    finishedAt: now,
  });
  if (
    activity
    && activity.status === ACTIVITY_STATUS.ANALYSIS_PENDING
    && Number(activity.analysisVersion || 1) === Number(job.activityVersion || 1)
  ) {
    await store.update("activities", activity.id, {
      status: ACTIVITY_STATUS.ADMIN_REVIEW,
      reviewStep: "admin",
      reviewMode: "admin_only",
      isHidden: true,
      reviewFlag: "analysis_failed",
      analysisStatus: "failed",
      analysisError: message,
      riskNotice: fallbackAnalysisNotice(message),
      safetyFallbackReason: "analysis-job-failed",
      updatedAt: now,
    });
    await writeSystemLog("activity.analysis.failed", {
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `活动安全分析失败并进入管理员兜底：${activity.title}（${message}）`,
    });
  }
}

async function runActivityAnalysisJob(job) {
  return withMutationLock(`activity-analysis:${job.id}`, async () => {
    const currentJob = await store.findById("activityAnalysisJobs", job.id);
    if (!currentJob || !["pending", "failed"].includes(currentJob.status)) return null;
    if (Number(currentJob.attempts || 0) >= ACTIVITY_ANALYSIS_MAX_ATTEMPTS && currentJob.status === "failed") return null;
    const now = new Date().toISOString();
    await store.update("activityAnalysisJobs", currentJob.id, {
      status: "running",
      attempts: Number(currentJob.attempts || 0) + 1,
      startedAt: now,
      updatedAt: now,
    });

    const activity = normalizeActivity(await store.findById("activities", currentJob.activityId));
    if (!activity) {
      await store.update("activityAnalysisJobs", currentJob.id, {
        status: "done",
        skipped: true,
        skipReason: "activity-not-found",
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
      return null;
    }
    if (
      activity.status !== ACTIVITY_STATUS.ANALYSIS_PENDING
      || Number(activity.analysisVersion || 1) !== Number(currentJob.activityVersion || 1)
    ) {
      await store.update("activityAnalysisJobs", currentJob.id, {
        status: "done",
        skipped: true,
        skipReason: "activity-version-changed",
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
      return activity;
    }

    try {
      const context = await buildActivityAnalysisContext(store, activity, {
        intent: "submit",
        activityId: activity.id,
        reported: currentJob.trigger === "report",
      });
      const analysis = await analyzeActivitySafety(store, activity, context);
      const analysisReport = await storeAnalysisReport(store, activity.id, analysis, context);
      const completedAt = new Date().toISOString();
      const { updated } = await applyActivityAnalysisResult(activity, analysis, analysisReport, context, {
        jobId: currentJob.id,
        completedAt,
      });

      context.trustProfile = await recordActivityAnalysisEvents(store, updated, analysis, context, {
        source: currentJob.trigger === "report" ? "report" : "activity",
        reason: currentJob.trigger === "report"
          ? `举报后重新评估活动置信度：${updated.title}`
          : `活动置信度评估：${updated.title}`,
      }) || context.trustProfile;

      if (updated.status === ACTIVITY_STATUS.PUBLISHED && !updated.isHidden) {
        await emitActivityPublishedEvent(updated, context.trustProfile, `活动完成安全分析并发布：${updated.title}`);
      }
      if (updated.status === ACTIVITY_STATUS.ADMIN_REVIEW) {
        await writeSystemLog("activity.risk_review", {
          targetType: "activity",
          targetId: updated.id,
          targetName: updated.title,
          detail: `活动进入管理员兜底审核：${updated.title}（风险分 ${updated.riskScore}，原因 ${updated.safetyDecisionReason || updated.safetyFallbackReason || updated.policyAction || "规则策略"}）`,
        });
      }
      await writeSystemLog("activity.analysis.complete", {
        targetType: "activity",
        targetId: updated.id,
        targetName: updated.title,
        detail: `活动安全分析完成：${updated.title}（状态 ${statusLabel(updated.status)}，风险分 ${updated.riskScore}）`,
      });
      await store.update("activityAnalysisJobs", currentJob.id, {
        status: "done",
        resultStatus: updated.status,
        riskScore: Number(updated.riskScore || 0),
        confidenceScore: Number(updated.confidenceScore || 0),
        updatedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
      return updated;
    } catch (error) {
      await markActivityAnalysisFailed(currentJob, activity, error);
      return null;
    }
  });
}

async function processPendingActivityAnalysisJobs(options = {}) {
  const recovered = await recoverMissingActivityAnalysisJobs(options);
  const staleBefore = new Date(Date.now() - ACTIVITY_ANALYSIS_STALE_RUNNING_MS).toISOString();
  const [pendingResult, staleRunningResult] = await Promise.all([
    store.query("activityAnalysisJobs", {
      page: 1,
      pageSize: options.limit || ACTIVITY_ANALYSIS_SWEEP_LIMIT,
      maxPageSize: ACTIVITY_ANALYSIS_SWEEP_LIMIT,
      filters: [{ field: "status", op: "eq", value: "pending" }],
      sort: [{ field: "createdAt", direction: "asc" }],
    }),
    store.query("activityAnalysisJobs", {
      page: 1,
      pageSize: options.limit || ACTIVITY_ANALYSIS_SWEEP_LIMIT,
      maxPageSize: ACTIVITY_ANALYSIS_SWEEP_LIMIT,
      filters: [
        { field: "status", op: "eq", value: "running" },
        { field: "startedAt", op: "lte", value: staleBefore },
      ],
      sort: [{ field: "startedAt", direction: "asc" }],
    }),
  ]);
  const staleJobs = [];
  for (const staleJob of staleRunningResult.data || []) {
    const reset = await store.update("activityAnalysisJobs", staleJob.id, {
      status: "pending",
      staleRecoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (reset) staleJobs.push(reset);
  }
  const jobs = dedupeById([...(pendingResult.data || []), ...staleJobs])
    .slice(0, options.limit || ACTIVITY_ANALYSIS_SWEEP_LIMIT);
  for (const job of jobs) {
    await runActivityAnalysisJob(job);
  }
  return { processed: jobs.length, recovered, retriedStale: staleJobs.length };
}

async function recoverMissingActivityAnalysisJobs(options = {}) {
  const staleBefore = new Date(Date.now() - ACTIVITY_ANALYSIS_STALE_RUNNING_MS).toISOString();
  const { data: activities } = await store.query("activities", {
    page: 1,
    pageSize: options.recoveryLimit || ACTIVITY_ANALYSIS_RECOVERY_LIMIT,
    maxPageSize: ACTIVITY_ANALYSIS_RECOVERY_LIMIT,
    filters: [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ANALYSIS_PENDING }],
    sort: [{ field: "createdAt", direction: "asc" }],
  });
  let recovered = 0;
  for (const activity of activities || []) {
    const version = Number(activity.analysisVersion || 1);
    const { data: activeJobs } = await store.query("activityAnalysisJobs", {
      page: 1,
      pageSize: 1,
      maxPageSize: 1,
      filters: [
        { field: "activityId", op: "eq", value: activity.id },
        { field: "activityVersion", op: "eq", value: version },
        { field: "status", op: "in", value: ["pending", "running"] },
      ],
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    const activeJob = activeJobs[0];
    if (activeJob?.status === "pending") continue;
    if (activeJob?.status === "running") {
      if (!activeJob.startedAt || activeJob.startedAt <= staleBefore) {
        await store.update("activityAnalysisJobs", activeJob.id, {
          status: "pending",
          staleRecoveredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        recovered += 1;
      }
      continue;
    }
    await createActivityAnalysisJob(activity, options.reason === "manual" ? "manual-recovery" : "recovery");
    recovered += 1;
  }
  return recovered;
}

function kickActivityAnalysisQueue(reason = "background") {
  if (activityAnalysisQueuePromise) return activityAnalysisQueuePromise;
  const run = () => {
    activityAnalysisQueuePromise = processPendingActivityAnalysisJobs({ reason })
      .catch((error) => {
        console.error("activity analysis queue failed", error);
        return { error: error.message };
      })
      .finally(() => {
        activityAnalysisQueuePromise = null;
      });
    return activityAnalysisQueuePromise;
  };
  const timer = setTimeout(run, 0);
  if (typeof timer.unref === "function") timer.unref();
  return null;
}

function reportTextFromAnalysis(analysisReport = {}, riskPatch = {}) {
  const ai = analysisReport.aiReport || {};
  const findings = analysisReport.ruleReport?.findings || riskPatch.ruleFindings || [];
  return [
    ai.summary,
    ...(Array.isArray(ai.riskReason) ? ai.riskReason : []),
    ...(Array.isArray(ai.negativeSignals) ? ai.negativeSignals : []),
    ...(Array.isArray(ai.explanation) ? ai.explanation : []),
    riskPatch.safetyDecisionReason,
    riskPatch.reviewFlag,
    ...findings.map((item) => `${item.ruleId || ""} ${item.ruleName || ""} ${item.reason || ""}`),
  ].join(" ").toLowerCase();
}

function textHasAny(text = "", words = []) {
  const value = String(text || "").toLowerCase();
  return words.some((word) => value.includes(String(word).toLowerCase()));
}

function evaluateReportSubstantiation(reason = "", analysisReport = {}, riskPatch = {}, safetyConfig = {}) {
  const ai = analysisReport.aiReport || {};
  const text = reportTextFromAnalysis(analysisReport, riskPatch);
  const riskScore = Number(riskPatch.riskScore ?? analysisReport.policy?.riskScore ?? analysisReport.ruleReport?.riskScore ?? 0);
  const highRisk = riskScore >= Number(safetyConfig.report?.substantiatedMinRisk ?? safetyConfig.report?.highRiskThreshold ?? 70);
  const checks = {
    "广告营销": Boolean(ai.isAdvertisement || ai.isSpam || ["admin_attention", "clear_advertisement", "clear_spam"].includes(riskPatch.reviewFlag))
      || textHasAny(text, ["广告", "营销", "推广", "引流", "招商", "代理", "返利", "销售", "垃圾内容"]),
    "虚假活动": ai.isRealActivity === false || textHasAny(text, ["虚假", "不像真实活动", "不是真实活动", "缺少明确时间", "缺少明确地点"]),
    "违法违规": Boolean(ai.containsIllegal || ai.isScam || ai.containsAdult || ai.containsPolitical)
      || textHasAny(text, ["违法", "政治", "敏感", "诈骗", "成人", "色情", "博彩", "赌场", "发票", "洗钱"]),
    "人身攻击": Boolean(ai.containsViolence) || textHasAny(text, ["攻击", "辱骂", "暴力", "威胁", "人身攻击"]),
    "其他": highRisk,
  };
  const matched = Boolean(checks[reason] || (reason !== "其他" && highRisk && textHasAny(text, [reason])));
  return {
    matched,
    highRisk,
    riskScore,
    reason: matched ? "report-matches-analysis" : "report-not-supported-by-analysis",
  };
}

async function analyzeCommunityReport(activity, report, context = {}) {
  const safetyConfig = context.safetyConfig || await getSafetyConfig(store);
  const trustProfile = activity.anonymousIdentityId ? await store.findById("trustProfiles", activity.anonymousIdentityId) : null;
  const analysisContext = await buildActivityAnalysisContext(store, activity, {
    ...context,
    identity: { ...(context.identity || {}), id: activity.anonymousIdentityId || context.identity?.id || "" },
    trustProfile,
    safetyConfig,
    intent: "submit",
    reported: true,
    activityId: activity.id,
  });
  const analysis = await analyzeActivitySafety(store, activity, analysisContext);
  const analysisReport = await storeAnalysisReport(store, activity.id, analysis, analysisContext);
  const riskPatch = activityRiskPatch(analysisReport, { ...analysisContext, activity });
  const substantiation = evaluateReportSubstantiation(report.reason, analysisReport, riskPatch, safetyConfig);
  const now = new Date().toISOString();
  const updatedReport = await store.update("communityReports", report.id, {
    status: substantiation.matched ? "substantiated" : "unsubstantiated",
    analysisReportId: analysisReport.id,
    reportReview: substantiation,
    reviewedAt: now,
    updatedAt: now,
  }) || report;

  const reportCount = await countRecords("communityReports", [{ field: "activityId", op: "eq", value: activity.id }]);
  const reportWarning = reportCount >= Number(safetyConfig.report?.warningThreshold || safetyConfig.report?.threshold || 3);
  const activityPatch = {
    ...riskPatch,
    status: activity.status,
    reviewStep: activity.reviewStep || "",
    reviewMode: activity.reviewMode || "",
    isHidden: activity.isHidden || false,
    reviewFlag: riskPatch.reviewFlag || activity.reviewFlag || "",
    reportCount,
    reportWarning,
    reportWarningText: reportWarning ? "这个活动被多人举报，参与前可以多看一眼活动说明和风险提示。" : "",
    updatedAt: now,
  };

  const safetyRequiresHiddenReview = Boolean(riskPatch.forceHiddenReview)
    || ["political_sensitive", "scam", "illegal", "adult", "clear_spam", "clear_advertisement"].includes(riskPatch.reviewFlag);
  const shouldTakeDownForReview = substantiation.matched || safetyRequiresHiddenReview;
  if (shouldTakeDownForReview && safetyConfig.report?.requireAdminReviewOnSubstantiated !== false) {
    Object.assign(activityPatch, {
      status: ACTIVITY_STATUS.ADMIN_REVIEW,
      reviewStep: "admin",
      reviewMode: "admin_only",
      isHidden: true,
      reviewFlag: substantiation.matched ? "report_substantiated" : riskPatch.reviewFlag || "report_safety_review",
      reportReviewStatus: substantiation.matched ? "substantiated_pending_admin" : "safety_review_pending_admin",
      publishedAt: activity.publishedAt || "",
    });
  } else if (reportWarning) {
    Object.assign(activityPatch, {
      reportReviewStatus: "multiple_reports_warning",
    });
  }

  const updatedActivity = await store.update("activities", activity.id, activityPatch) || activity;
  if (shouldTakeDownForReview && trustProfile) {
    await recordCommunityEvent(store, trustProfile, {
      type: "community.report.confirmed",
      source: "report",
      reason: substantiation.matched
        ? `社区举报成立并转入管理员审核：${activity.title}`
        : `举报后安全复核触发管理员审核：${activity.title}`,
      reportConfirmedIncrement: 1,
      activityId: activity.id,
      payload: {
        reportId: report.id,
        reason: report.reason,
        riskScore: riskPatch.riskScore,
        confidenceScore: riskPatch.confidenceScore,
        reportCount,
      },
    }, safetyConfig.trust);
  }
  await writeSystemLog(shouldTakeDownForReview ? "activity.report.substantiated" : "activity.report.unsubstantiated", {
    targetType: "activity",
    targetId: activity.id,
    targetName: activity.title,
    detail: shouldTakeDownForReview
      ? `${substantiation.matched ? "举报成立" : "安全复核触发"}，活动已下架并进入管理员审核：${activity.title} / ${report.reason}`
      : `举报已记录，分析暂不支持下架：${activity.title} / ${report.reason}`,
  });
  return { report: updatedReport, activity: updatedActivity, analysis: analysisReport, substantiation, reportCount, shouldTakeDownForReview };
}

function activitySortRules(sort = "created-desc") {
  if (sort === "start-asc") return [{ field: "startsAt", direction: "asc" }, { field: "createdAt", direction: "desc" }];
  if (sort === "start-desc") return [{ field: "startsAt", direction: "desc" }, { field: "createdAt", direction: "desc" }];
  if (sort === "registrations-desc") return [{ field: "registrationCount", direction: "desc" }, { field: "createdAt", direction: "desc" }];
  return [{ field: "createdAt", direction: "desc" }];
}

function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function activityDateKey(startsAt = "") {
  const value = cleanText(startsAt);
  const localDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (localDate) return localDate[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : shanghaiDateKey(parsed);
}

function shouldAutoEndActivity(activity, todayKey = shanghaiDateKey()) {
  const item = normalizeActivity(activity);
  const dateKey = activityDateKey(item.endsAt || item.startsAt);
  return Boolean(dateKey)
    && AUTO_END_ACTIVITY_STATUSES.includes(item.status)
    && dateKey < todayKey;
}

function activityDateFilters(query = {}) {
  const filters = [];
  if (query.from) {
    filters.push({ field: "startsAt", op: "gte", value: `${String(query.from)}T00:00` });
  }
  if (query.to) {
    filters.push({ field: "startsAt", op: "lte", value: `${String(query.to)}T23:59:59.999` });
  }
  return filters;
}

function logFilters(query = {}) {
  const filters = [{ field: "createdAt", op: "gte", value: logRetentionCutoffIso() }];
  const action = cleanText(query.action);
  const actorId = cleanText(query.actorId);
  const actorRole = cleanText(query.actorRole);
  const from = cleanText(query.from);
  const to = cleanText(query.to);

  if (action) filters.push({ field: "action", op: "eq", value: action });
  if (actorId) filters.push({ field: "actorId", op: "eq", value: actorId });
  if (actorRole) filters.push({ field: "actorRole", op: "eq", value: actorRole });
  if (from) filters.push({ field: "createdAt", op: "gte", value: `${from}T00:00:00.000` });
  if (to) filters.push({ field: "createdAt", op: "lte", value: `${to}T23:59:59.999` });
  return filters;
}

function reportFilters(query = {}) {
  const filters = [];
  const status = cleanText(query.status);
  const reason = cleanText(query.reason);
  const activityId = cleanText(query.activityId);
  const from = cleanText(query.from);
  const to = cleanText(query.to);
  if (status) filters.push({ field: "status", op: "eq", value: status });
  if (reason) filters.push({ field: "reason", op: "eq", value: reason });
  if (activityId) filters.push({ field: "activityId", op: "eq", value: activityId });
  if (from) filters.push({ field: "createdAt", op: "gte", value: `${from}T00:00:00.000` });
  if (to) filters.push({ field: "createdAt", op: "lte", value: `${to}T23:59:59.999` });
  return filters;
}

function feedbackFilters(query = {}) {
  const filters = [];
  const status = cleanText(query.status);
  const activityId = cleanText(query.activityId);
  const from = cleanText(query.from);
  const to = cleanText(query.to);
  if (status) filters.push({ field: "status", op: "eq", value: status });
  if (activityId) filters.push({ field: "activityId", op: "eq", value: activityId });
  if (from) filters.push({ field: "createdAt", op: "gte", value: `${from}T00:00:00.000` });
  if (to) filters.push({ field: "createdAt", op: "lte", value: `${to}T23:59:59.999` });
  return filters;
}

function impossibleFilter() {
  return { field: "id", op: "eq", value: "__none__" };
}

function logRetentionCutoffIso(now = new Date()) {
  return new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function pruneOldLogs(options = {}) {
  const now = Date.now();
  if (!options.force && now - logRetentionLastRun < LOG_RETENTION_SWEEP_MS) return 0;
  if (logRetentionSweepPromise) return logRetentionSweepPromise;
  logRetentionLastRun = now;
  const cutoff = options.cutoff || logRetentionCutoffIso(new Date(now));
  logRetentionSweepPromise = (async () => {
    try {
      if (typeof store.removeWhere === "function") {
        return await store.removeWhere("logs", [{ field: "createdAt", op: "lt", value: cutoff }]);
      }
      return await store.remove("logs", (item) => !item.createdAt || item.createdAt < cutoff);
    } catch (error) {
      console.error("prune old operation logs failed", error);
      return 0;
    } finally {
      logRetentionSweepPromise = null;
    }
  })();
  return logRetentionSweepPromise;
}

async function writeSystemLog(action, options = {}) {
  try {
    await pruneOldLogs();
    await store.insert("logs", {
      id: makeId("log"),
      action: sanitizeLogValue(action, 80),
      actionLabel: sanitizeLogValue(LOG_ACTION_LABELS[action] || action, 80),
      actorId: "system",
      actorName: "系统",
      actorRole: "system",
      actorPhone: "",
      targetType: sanitizeLogValue(options.targetType, 80),
      targetId: sanitizeLogValue(options.targetId, 120),
      targetName: sanitizeLogValue(options.targetName, 160),
      detail: sanitizeLogValue(options.detail, 1000),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("write system operation log failed", error);
  }
}

async function writeLog(req, action, options = {}) {
  try {
    await pruneOldLogs();
    const currentUser = options.user || req.currentUser || await getCurrentUser(req);
    const now = new Date().toISOString();
    await store.insert("logs", {
      id: makeId("log"),
      action: sanitizeLogValue(action, 80),
      actionLabel: sanitizeLogValue(LOG_ACTION_LABELS[action] || action, 80),
      actorId: sanitizeLogValue(currentUser ? currentUser.id : "", 120),
      actorName: sanitizeLogValue(options.actorName || (currentUser ? currentUser.nickname : "访客"), 120),
      actorRole: currentUser ? (publicUser(currentUser).role || "member") : "guest",
      actorPhone: maskPhone(options.actorPhone || (currentUser ? currentUser.phone || "" : "")),
      targetType: sanitizeLogValue(options.targetType, 80),
      targetId: sanitizeLogValue(options.targetId, 120),
      targetName: sanitizeLogValue(options.targetName, 160),
      detail: sanitizeLogValue(options.detail, 1000),
      createdAt: now,
    });
  } catch (error) {
    console.error("write operation log failed", error);
  }
}

async function closeExpiredActivities(options = {}) {
  const todayKey = options.todayKey || shanghaiDateKey();
  const cutoff = `${todayKey}T00:00`;
  const nowLocal = options.nowLocal || shanghaiLocalDateTime();
  const notFormed = [];
  const ended = [];

  const { data: minRegistrationCandidates } = await store.query("activities", {
    page: 1,
    pageSize: 1000,
    maxPageSize: 1000,
    filters: [
      { field: "status", op: "in", value: AUTO_END_ACTIVITY_STATUSES },
      { field: "minRegistrationEnabled", op: "eq", value: true },
      { field: "registrationDeadline", op: "lte", value: nowLocal },
    ],
    sort: [{ field: "registrationDeadline", direction: "asc" }, { field: "createdAt", direction: "asc" }],
  });
  const notFormedExpired = minRegistrationCandidates.filter((activity) => shouldCancelNotFormedActivity(activity, nowLocal));
  for (const activity of notFormedExpired) {
    const now = new Date().toISOString();
    const updated = await store.update("activities", activity.id, {
      status: ACTIVITY_STATUS.NOT_FORMED_CANCELLED,
      reviewStep: "",
      notFormedCancelledAt: now,
      notFormedReason: options.reason || "scheduler",
      activityVersion: normalizeActivityVersion(activity) + 1,
      editLock: null,
      updatedAt: now,
    });
    const finalActivity = updated || activity;
    notFormed.push(finalActivity);
    await writeSystemLog("activity.not_formed_cancel", {
      targetType: "activity",
      targetId: finalActivity.id,
      targetName: finalActivity.title,
      detail: `未达到最低报名人数，自动取消活动：${finalActivity.title}（${Number(finalActivity.registrationCount || 0)}/${Number(finalActivity.minRegistrationCount || 0)}，来源 ${options.reason || "scheduler"}）`,
    });
  }

  for (let batch = 0; batch < 20; batch += 1) {
    const { data: candidates } = await store.query("activities", {
      page: 1,
      pageSize: ACTIVITY_AUTO_END_BATCH_SIZE,
      maxPageSize: ACTIVITY_AUTO_END_BATCH_SIZE,
      filters: [
        { field: "status", op: "in", value: AUTO_END_ACTIVITY_STATUSES },
        { field: "startsAt", op: "lte", value: cutoff },
      ],
      sort: activitySortRules("start-asc"),
    });
    const expired = candidates.filter((activity) => shouldAutoEndActivity(activity, todayKey));
    if (!expired.length) break;

    for (const activity of expired) {
      const now = new Date().toISOString();
      const updated = await store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.ENDED,
        reviewStep: "",
        autoEndedAt: now,
        autoEndReason: options.reason || "scheduler",
        activityVersion: normalizeActivityVersion(activity) + 1,
        editLock: null,
        updatedAt: now,
      });
      const finalActivity = updated || activity;
      ended.push(finalActivity);
      await writeSystemLog("activity.auto_end", {
        targetType: "activity",
        targetId: finalActivity.id,
        targetName: finalActivity.title,
        detail: `自动结束活动：${finalActivity.title}（归档日期 ${todayKey}，来源 ${options.reason || "scheduler"}）`,
      });
    }

    if (expired.length < candidates.length) break;
  }

  return {
    todayKey,
    notFormedCancelledCount: notFormed.length,
    notFormedCancelledIds: notFormed.map((activity) => activity.id),
    endedCount: ended.length,
    endedIds: ended.map((activity) => activity.id),
  };
}

async function sweepExpiredActivities(options = {}) {
  const now = Date.now();
  if (!options.force && now - activityAutoEndLastRun < ACTIVITY_AUTO_END_MIN_SWEEP_MS) {
    return { skipped: true, reason: "throttled" };
  }
  if (activityAutoEndSweepPromise) return activityAutoEndSweepPromise;
  activityAutoEndLastRun = now;
  activityAutoEndSweepPromise = closeExpiredActivities(options)
    .catch((error) => {
      console.error("activity auto end sweep failed", error);
      return { error: error.message };
    })
    .finally(() => {
      activityAutoEndSweepPromise = null;
    });
  return activityAutoEndSweepPromise;
}

function startActivityAutoEndScheduler(options = {}) {
  if (options.enabled === false || process.env.DISABLE_ACTIVITY_AUTO_END === "true") return null;
  if (activityAutoEndTimer) return activityAutoEndTimer;
  activityAutoEndTimer = setInterval(() => {
    sweepExpiredActivities({ reason: "interval" }).catch((error) => {
      console.error("activity auto end interval failed", error);
    });
  }, ACTIVITY_AUTO_END_INTERVAL_MS);
  if (typeof activityAutoEndTimer.unref === "function") activityAutoEndTimer.unref();
  return activityAutoEndTimer;
}

async function toActivityPayload(activity, options = {}) {
  activity = normalizeActivity(activity);
  const coIds = coInitiatorIdentityIds(activity);
  const initiatorProfileId = activity.identityNetworkId || activity.anonymousIdentityId;
  const [module, owner, collaborator, friend, series, initiatorProfile, coProfileMap, activityRegistrations, interestMap] = await Promise.all([
    activity.moduleId ? store.findById("modules", activity.moduleId) : null,
    activity.createdBy ? store.findById("users", activity.createdBy) : null,
    activity.collaboratorId ? store.findById("users", activity.collaboratorId) : null,
    activity.friendId ? store.findById("livingRoomFriends", activity.friendId) : null,
    activity.seriesId ? store.findById("activitySeries", activity.seriesId) : null,
    initiatorProfileId ? identityProfileById(initiatorProfileId, { fallbackName: activity.initiator }) : null,
    identityProfileMap(coIds),
    getActivityRegistrations(activity.id),
    interestMapForActivities([activity.id], options.req || null),
  ]);
  const coInitiators = await coInitiatorProfilesForActivity(activity, coProfileMap);
  const capacity = effectiveCapacity(activity);
  const derivedStatus = capacity && activityRegistrations.length >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
    ? ACTIVITY_STATUS.FULL
    : activity.status;
  const interestState = interestMap.get(activity.id) || {};
  const interestCount = Math.max(Number(activity.interestCount || 0), Number(interestState.count || 0));
  const registrationDeadline = normalizedRegistrationDeadline(activity);
  const registrationDeadlinePassed = hasMinimumRegistrationRequirement(activity) && registrationDeadline && registrationDeadline <= shanghaiLocalDateTime();
  const source = activitySourcePayload(activity, friend);
  const publicFeedbacks = await publicFeedbacksForActivity(activity);
  const identityContext = options.req ? await identityNetworkContextForRequest(options.req) : null;
  const myRegistration = identityContext
    ? activityRegistrations.find((registration) => registrationOwnedByContext(registration, identityContext))
    : null;
  return withCoverUrl({
    ...activity,
    ...source,
    capacity,
    status: derivedStatus,
    showInitiatorContact: Boolean(activity.showInitiatorContact),
    initiatorContact: activity.showInitiatorContact ? activity.initiatorContact || "" : "",
    showRegistrationNames: Boolean(activity.showRegistrationNames),
    minRegistrationEnabled: Boolean(activity.minRegistrationEnabled),
    minRegistrationCount: Math.max(0, Number(activity.minRegistrationCount || 0)),
    registrationDeadline,
    registrationDeadlinePassed: Boolean(registrationDeadlinePassed),
    statusLabel: statusLabel(derivedStatus),
    reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
    moduleName: module ? module.name : "未归类",
    series: series ? publicActivitySeries(series) : null,
    seriesName: series?.name || "",
    seriesColor: series?.color || "",
    creatorName: owner ? owner.nickname : activity.initiator,
    collaboratorName: collaborator ? collaborator.nickname : "",
    initiatorProfile,
    coInitiators,
    permissions: options.req ? activityPermissionPayload(activity, options.user || null, options.req) : {},
    registrationCount: activityRegistrations.length,
    spotsLeft: Math.max(capacity - activityRegistrations.length, 0),
    interestCount,
    interestedByMe: Boolean(interestState.interestedByMe),
    myRegistration: myRegistration ? publicRegistration(myRegistration) : null,
    hasMyRegistration: Boolean(myRegistration),
    publicRegistrations: activity.showRegistrationNames ? publicRegistrationNames(activityRegistrations) : [],
    showFeedbacks: activity.showFeedbacks !== false,
    publicFeedbacks,
  });
}

async function toActivityListPayload(activities, options = {}) {
  const normalizedActivities = activities.map((source) => normalizeActivity(source));
  const identityIds = normalizedActivities.flatMap((activity) => [activity.identityNetworkId || activity.anonymousIdentityId, ...coInitiatorIdentityIds(activity)]);
  const [moduleMap, userMap, friendMap, seriesMap, profileMap, interestMap] = await Promise.all([
    loadRecordsByIds("modules", normalizedActivities.map((activity) => activity.moduleId)),
    loadRecordsByIds("users", normalizedActivities.flatMap((activity) => [activity.createdBy, activity.collaboratorId])),
    loadRecordsByIds("livingRoomFriends", normalizedActivities.map((activity) => activity.friendId)),
    loadRecordsByIds("activitySeries", normalizedActivities.map((activity) => activity.seriesId)),
    identityProfileMap(identityIds),
    interestMapForActivities(normalizedActivities.map((activity) => activity.id), options.req || null),
  ]);
  return Promise.all(normalizedActivities.map((activity) => {
    const module = moduleMap.get(activity.moduleId);
    const owner = userMap.get(activity.createdBy);
    const collaborator = userMap.get(activity.collaboratorId);
    const friend = friendMap.get(activity.friendId);
    const series = seriesMap.get(activity.seriesId);
    const initiatorProfile = profileMap.get(activity.identityNetworkId || activity.anonymousIdentityId) || null;
    const coInitiators = coInitiatorIdentityIds(activity).map((identityId) => {
      const profile = profileMap.get(identityId);
      return profile ? { ...profile, role: CO_INITIATOR_ROLE, roleLabel: "共同发起人" } : null;
    }).filter(Boolean);
    const capacity = effectiveCapacity(activity);
    const registrationCount = Math.max(0, Number(activity.registrationCount || 0));
    const derivedStatus = capacity && registrationCount >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
      ? ACTIVITY_STATUS.FULL
      : activity.status;
    const interestState = interestMap.get(activity.id) || {};
    const interestCount = Math.max(Number(activity.interestCount || 0), Number(interestState.count || 0));
    const registrationDeadline = normalizedRegistrationDeadline(activity);
    const registrationDeadlinePassed = hasMinimumRegistrationRequirement(activity) && registrationDeadline && registrationDeadline <= shanghaiLocalDateTime();
    const source = activitySourcePayload(activity, friend);
    return withCoverUrl({
      ...activity,
      ...source,
      capacity,
      status: derivedStatus,
      showInitiatorContact: Boolean(activity.showInitiatorContact),
      initiatorContact: activity.showInitiatorContact ? activity.initiatorContact || "" : "",
      showRegistrationNames: Boolean(activity.showRegistrationNames),
      minRegistrationEnabled: Boolean(activity.minRegistrationEnabled),
      minRegistrationCount: Math.max(0, Number(activity.minRegistrationCount || 0)),
      registrationDeadline,
      registrationDeadlinePassed: Boolean(registrationDeadlinePassed),
      statusLabel: statusLabel(derivedStatus),
      reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
      moduleName: module ? module.name : "未归类",
      series: series ? publicActivitySeries(series) : null,
      seriesName: series?.name || "",
      seriesColor: series?.color || "",
      creatorName: owner ? owner.nickname : activity.initiator,
      collaboratorName: collaborator ? collaborator.nickname : "",
      initiatorProfile: initiatorProfile
        ? { ...initiatorProfile, displayName: initiatorProfile.displayName || activity.initiator || "有空朋友" }
        : null,
      coInitiators,
      permissions: options.req ? activityPermissionPayload(activity, options.user || null, options.req) : {},
      registrationCount,
      spotsLeft: Math.max(capacity - registrationCount, 0),
      interestCount,
      interestedByMe: Boolean(interestState.interestedByMe),
      showFeedbacks: activity.showFeedbacks !== false,
    });
  }));
}

async function toReportListPayload(reports = []) {
  const activityMap = await loadRecordsByIds("activities", reports.map((report) => report.activityId));
  return reports.map((report) => {
    const activity = activityMap.get(report.activityId);
    return {
      ...report,
      activityTitle: report.activityTitle || activity?.title || "",
      activityStatus: activity?.status || report.activityStatus || "",
      activityStatusLabel: activity ? statusLabel(activity.status) : "",
      activityRiskScore: activity?.riskScore ?? null,
      activityConfidenceScore: activity?.confidenceScore ?? null,
      activityHidden: Boolean(activity?.isHidden),
    };
  });
}

async function toFeedbackListPayload(feedbacks = [], options = {}) {
  const activityMap = await loadRecordsByIds("activities", feedbacks.map((feedback) => feedback.activityId));
  return Promise.all(feedbacks.map(async (feedback) => {
    const activity = activityMap.get(feedback.activityId);
    const activityPayload = activity ? await toActivityPayload(activity, options) : null;
    return {
      ...publicActivityFeedback(feedback, { includeAnalysis: true }),
      activityTitle: activity?.title || feedback.activityTitle || "",
      activityLocation: activity?.location || "",
      activityStartsAt: activity?.startsAt || "",
      activityEndsAt: activity?.endsAt || "",
      activityStatus: activity?.status || "",
      activityStatusLabel: activity ? statusLabel(activity.status) : "",
      activity: activityPayload,
    };
  }));
}

function requestIdentityId(req) {
  return req ? cleanText(requestIdentity(req).id) : "";
}

function isActivityTerminal(activity = {}) {
  const status = normalizeActivity(activity)?.status;
  return [ACTIVITY_STATUS.CANCELLED, ACTIVITY_STATUS.NOT_FORMED_CANCELLED, ACTIVITY_STATUS.ENDED, ACTIVITY_STATUS.REJECTED].includes(status);
}

function hasActivityManageToken(activity, req) {
  if (!req) return false;
  return verifyManageToken(activity, getManageToken(req), req ? requestIdentity(req) : {});
}

function isMainActivityInitiator(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!activity) return false;
  if (user && activity.createdBy && activity.createdBy === user.id) return true;
  const identityIds = requestIdentityIds(req);
  const networkId = requestIdentityNetworkId(req);
  if (networkId && activity.identityNetworkId === networkId) return true;
  if (activity.anonymousIdentityId && identityIds.includes(activity.anonymousIdentityId)) return true;
  return hasActivityManageToken(activity, req);
}

function isActivityCoInitiator(activity, req) {
  const identityIds = requestIdentityIds(req);
  const networkId = requestIdentityNetworkId(req);
  return Boolean(
    (identityIds.length && coInitiatorIdentityIds(activity).some((id) => identityIds.includes(id)))
    || (networkId && coInitiatorIdentityIds(activity).includes(networkId))
  );
}

function canManageActivity(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!activity) return false;
  if (user && userCan(user, "activities", "view")) return true;
  if (isMainActivityInitiator(activity, user, req)) return true;
  return isActivityCoInitiator(activity, req);
}

function canSeeActivity(activity, user, req) {
  activity = normalizeActivity(activity);
  if (PUBLIC_ACTIVITY_STATUSES.includes(activity.status) && !activity.isHidden) return true;
  if (!user && !req) return false;
  return canManageActivity(activity, user, req) || (user && activity.collaboratorId === user.id);
}

function canEditActivity(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!canManageActivity(activity, user, req)) return false;
  if (user && userCan(user, "activities", "edit")) return activity.status !== ACTIVITY_STATUS.REJECTED;
  return !isActivityTerminal(activity);
}

function canWithdrawActivity(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!canManageActivity(activity, user, req)) return false;
  return [ACTIVITY_STATUS.ANALYSIS_PENDING, ACTIVITY_STATUS.ADMIN_REVIEW, ACTIVITY_STATUS.COLLABORATOR_REVIEW, ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status);
}

function canLifecycleActivity(activity, user, req, action = "cancel") {
  activity = normalizeActivity(activity);
  if (!activity) return false;
  if (action === "end" && ![ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status)) return false;
  if (action === "cancel" && isActivityTerminal(activity)) return false;
  if (user && userCan(user, "activities", action)) return true;
  return isMainActivityInitiator(activity, user, req) || isActivityCoInitiator(activity, req);
}

function canManageCoInitiators(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!activity) return false;
  if (user && userCan(user, "activities", "edit")) return true;
  return isMainActivityInitiator(activity, user, req);
}

function activityPermissionPayload(activity, user, req) {
  return {
    canEdit: canEditActivity(activity, user, req),
    canWithdraw: canWithdrawActivity(activity, user, req),
    canCancel: canLifecycleActivity(activity, user, req, "cancel"),
    canEnd: canLifecycleActivity(activity, user, req, "end"),
    canManageCoInitiators: canManageCoInitiators(activity, user, req),
    isCoInitiator: isActivityCoInitiator(activity, req),
    isMainInitiator: isMainActivityInitiator(activity, user, req),
  };
}

function pendingForUser(activity, user) {
  activity = normalizeActivity(activity);
  if (!user) return false;
  if (userCan(user, "activities", "review") && activity.reviewFlag === "admin_attention" && activity.status === ACTIVITY_STATUS.PUBLISHED) return true;
  if (activity.status === ACTIVITY_STATUS.ADMIN_REVIEW) return userCan(user, "activities", "review");
  if (activity.status === ACTIVITY_STATUS.COLLABORATOR_REVIEW) return activity.collaboratorId === user.id && userCan(user, "reviewTasks", "review");
  return false;
}

async function reviewActivity(activity, user, action, comment = "") {
  activity = normalizeActivity(activity);
  if (!REVIEW_ACTIONS.includes(action)) {
    throw Object.assign(new Error("审核意见无效"), { statusCode: 400 });
  }
  if (!pendingForUser(activity, user)) {
    throw Object.assign(new Error("你没有这条审核任务"), { statusCode: 403 });
  }

  const now = new Date().toISOString();
  const reviewComment = cleanText(comment);
  const commentError = validateTextLength("审核说明", reviewComment, TEXT_LIMITS.reviewComment);
  if (commentError) {
    throw Object.assign(new Error(commentError), { statusCode: 400 });
  }
  const publicAdminAttention = activity.status === ACTIVITY_STATUS.PUBLISHED && activity.reviewFlag === "admin_attention";
  const actorRole = publicAdminAttention || activity.status === ACTIVITY_STATUS.ADMIN_REVIEW ? "admin" : "collaborator";
  let nextStatus = activity.status;
  let nextStep = activity.reviewStep;
  let clearReviewFlag = false;
  let nextHidden = activity.isHidden || false;
  if (action === "approve" && publicAdminAttention) {
    nextStatus = ACTIVITY_STATUS.PUBLISHED;
    nextStep = "";
    nextHidden = false;
    clearReviewFlag = true;
  } else if (action === "approve" && activity.status === ACTIVITY_STATUS.ADMIN_REVIEW) {
    if (activity.reviewMode === "two_step" && activity.collaboratorId) {
      nextStatus = ACTIVITY_STATUS.COLLABORATOR_REVIEW;
      nextStep = "collaborator";
    } else {
      nextStatus = ACTIVITY_STATUS.PUBLISHED;
      nextStep = "";
      nextHidden = false;
      clearReviewFlag = true;
    }
  } else if (action === "approve" && activity.status === ACTIVITY_STATUS.COLLABORATOR_REVIEW) {
    nextStatus = ACTIVITY_STATUS.PUBLISHED;
    nextStep = "";
    nextHidden = false;
    clearReviewFlag = true;
  } else if (action === "return") {
    nextStatus = ACTIVITY_STATUS.RETURNED;
    nextStep = "";
    nextHidden = true;
    clearReviewFlag = true;
  } else if (action === "reject") {
    nextStatus = ACTIVITY_STATUS.REJECTED;
    nextStep = "";
    nextHidden = true;
    clearReviewFlag = true;
  }

  return store.update("activities", activity.id, {
    status: nextStatus,
    reviewStep: nextStep,
    isHidden: nextHidden,
    reviewFlag: clearReviewFlag ? "" : activity.reviewFlag || "",
    safetyDecisionReason: clearReviewFlag ? "" : activity.safetyDecisionReason || "",
    reportReviewStatus: clearReviewFlag && nextStatus === ACTIVITY_STATUS.PUBLISHED ? "admin_approved" : activity.reportReviewStatus || "",
    activityVersion: normalizeActivityVersion(activity) + 1,
    reviewLogs: [
      ...activity.reviewLogs,
      {
        id: makeId("review"),
        action,
        comment: reviewComment,
        actorId: user.id,
        actorName: user.nickname,
        actorRole,
        createdAt: now,
      },
    ],
    updatedAt: now,
    publishedAt: nextStatus === ACTIVITY_STATUS.PUBLISHED ? now : activity.publishedAt,
  });
}

function getClientIp(req) {
  const ip = req.ip || req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
  return String(ip).replace(/^::ffff:/, "");
}

function createRateLimiter({ windowMs, max, keyGenerator, message }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets.entries()) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(max - bucket.count, 0)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      res.status(429).json({ error: message || "操作太频繁，请稍后再试" });
      return;
    }
    next();
  };
}

const writeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 180,
  keyGenerator: (req) => `write:${getClientIp(req)}`,
  message: "操作太频繁，请稍后再试",
});

const loginRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => `login:${getClientIp(req)}:${cleanPhone(req.body?.phone || "")}`,
  message: "登录尝试太频繁，请十分钟后再试",
});

const loginIpRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 40,
  keyGenerator: (req) => `login-ip:${getClientIp(req)}`,
  message: "登录尝试太频繁，请十分钟后再试",
});

const registrationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 24,
  keyGenerator: (req) => `register:${getClientIp(req)}:${req.params.id || "activity"}`,
  message: "报名操作太频繁，请稍后再试",
});

const activityMutationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 45,
  keyGenerator: (req) => `activity-mutation:${req.currentUser?.id || getClientIp(req)}`,
  message: "活动操作太频繁，请稍后再试",
});

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "form-action 'self'",
    ].join("; ")
  );
  if (req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.STORE_DRIVER === "cloudbase") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

function requireRequestIntent(req, res, next) {
  if (!req.path.startsWith("/api") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  if (req.get("X-Requested-With") === "XMLHttpRequest") {
    next();
    return;
  }
  res.status(403).json({ error: "请求缺少安全校验头，请刷新页面后重试" });
}

function limitWrites(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  writeRateLimiter(req, res, next);
}

function apiTimingLogger(req, res, next) {
  if (!API_TIMING_LOGS_ENABLED || !req.path.startsWith("/api")) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (durationMs < API_SLOW_LOG_MS && res.statusCode < 500) return;

    const payload = {
      event: res.statusCode >= 500 ? "api_error" : "api_slow",
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      thresholdMs: API_SLOW_LOG_MS,
      storeDriver: process.env.STORE_DRIVER || "json",
    };
    const line = `[youkong-api] ${JSON.stringify(payload)}`;
    if (res.statusCode >= 500) {
      console.error(line);
    } else {
      console.warn(line);
    }
  });
  next();
}

function parseJsonLike(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function parseListLike(value = []) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  const text = cleanText(value);
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    const parsed = parseJsonLike(text, []);
    if (Array.isArray(parsed)) return parsed.map(cleanText).filter(Boolean);
  }
  return text.split(",").map(cleanText).filter(Boolean);
}

function parseSafetyRuleInput(body = {}) {
  return {
    name: cleanText(body.name),
    type: cleanText(body.type),
    description: cleanText(body.description),
    enabled: body.enabled === undefined ? true : truthyFormValue(body.enabled),
    weight: Number(body.weight || 0),
    params: parseJsonLike(body.params, {}),
  };
}

function publicSafetyRule(rule = {}) {
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    description: rule.description || "",
    enabled: rule.enabled !== false,
    weight: Number(rule.weight || 0),
    params: rule.params || {},
    updatedAt: rule.updatedAt || rule.createdAt || "",
  };
}

function parseAiSettingsInput(body = {}) {
  const patch = {};
  [
    "activeProfileId",
    "provider",
    "baseUrl",
    "model",
    "promptVersion",
    "systemPrompt",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = cleanText(body[key]);
  });
  [
    "requestTimeoutMs",
    "temperature",
    "maxTokens",
    "retryCount",
    "cacheTtlSeconds",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = Number(body[key]);
  });
  if (Object.prototype.hasOwnProperty.call(body, "enabled")) patch.enabled = truthyFormValue(body.enabled);
  if (Object.prototype.hasOwnProperty.call(body, "fallbackEnabled")) patch.fallbackEnabled = truthyFormValue(body.fallbackEnabled);
  if (Object.prototype.hasOwnProperty.call(body, "apiKey")) patch.apiKey = cleanText(body.apiKey);
  if (Object.prototype.hasOwnProperty.call(body, "fallbackProfileIds")) patch.fallbackProfileIds = parseListLike(body.fallbackProfileIds);
  if (Object.prototype.hasOwnProperty.call(body, "sceneRouting")) patch.sceneRouting = parseJsonLike(body.sceneRouting, {});
  if (Object.prototype.hasOwnProperty.call(body, "callStrategy")) patch.callStrategy = parseJsonLike(body.callStrategy, {});
  if (Object.prototype.hasOwnProperty.call(body, "ruleConfidenceMax")) {
    patch.callStrategy = {
      ...(patch.callStrategy || {}),
      lowConfidenceOnly: true,
      ruleConfidenceMax: Math.max(0, Math.min(100, Number(body.ruleConfidenceMax || 0))),
    };
  }
  if (Object.prototype.hasOwnProperty.call(body, "firstActivityCount")) {
    const firstActivityCount = Math.max(0, Math.min(50, Number(body.firstActivityCount || 0)));
    patch.callStrategy = {
      ...(patch.callStrategy || {}),
      firstActivitiesAlways: firstActivityCount > 0,
      firstActivityCount,
    };
  }
  if (Object.prototype.hasOwnProperty.call(body, "dailyCallLimit")) {
    patch.callStrategy = {
      ...(patch.callStrategy || {}),
      dailyCallLimit: Math.max(0, Math.min(100000, Number(body.dailyCallLimit || 0))),
    };
  }
  if (Object.prototype.hasOwnProperty.call(body, "capabilities")) patch.capabilities = parseJsonLike(body.capabilities, {});
  if (Object.prototype.hasOwnProperty.call(body, "promptVersions")) patch.promptVersions = parseJsonLike(body.promptVersions, {});
  return patch;
}

function parseAiModelProfileInput(body = {}) {
  const input = {};
  [
    "name",
    "provider",
    "baseUrl",
    "model",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) input[key] = cleanText(body[key]);
  });
  [
    "priority",
    "requestTimeoutMs",
    "temperature",
    "maxTokens",
    "retryCount",
    "dailyLimit",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) input[key] = Number(body[key]);
  });
  if (Object.prototype.hasOwnProperty.call(body, "enabled")) input.enabled = truthyFormValue(body.enabled);
  if (Object.prototype.hasOwnProperty.call(body, "apiKey")) input.apiKey = cleanText(body.apiKey);
  if (Object.prototype.hasOwnProperty.call(body, "sceneScopes")) input.sceneScopes = parseListLike(body.sceneScopes)
    .filter((scene) => AI_SCENES.includes(scene) || scene === "all");
  return input;
}

function parsePromptInput(body = {}) {
  return {
    type: cleanText(body.type || "activity"),
    version: cleanText(body.version),
    name: cleanText(body.name),
    systemPrompt: cleanText(body.systemPrompt),
    userPrompt: cleanText(body.userPrompt),
    active: body.active === undefined ? false : truthyFormValue(body.active),
  };
}

async function activateAiPrompt(prompt = {}) {
  if (!prompt.id || !prompt.type) return null;
  const { data: prompts } = await store.query("aiPrompts", {
    page: 1,
    pageSize: 500,
    maxPageSize: 500,
    filters: [{ field: "type", op: "eq", value: prompt.type }],
  });
  await Promise.all(prompts.map((item) => store.update("aiPrompts", item.id, {
    active: item.id === prompt.id,
    updatedAt: new Date().toISOString(),
  })));
  const currentSettings = await getAiSettings(store);
  const settingsPatch = {
    promptVersions: {
      ...(currentSettings.promptVersions || {}),
      [prompt.type]: prompt.version,
    },
  };
  if (prompt.type === "activity") {
    settingsPatch.promptVersion = prompt.version;
  }
  return saveAiSettings(store, settingsPatch);
}

function createApp(options = {}) {
  assertProductionSecrets();
  const app = express();
  const serveStatic = options.serveStatic !== false;
  const staticRoot = options.staticRoot || path.join(__dirname, "..");
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  if (!serveStatic) {
    app.use((req, _res, next) => {
      if (!req.url.startsWith("/api")) {
        req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
      }
      next();
    });
  }

  const corsOrigins = (process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.STORE_DRIVER === "cloudbase" && corsOrigins.includes("*") && process.env.ALLOW_WILDCARD_CORS !== "true") {
    throw new Error("生产环境不允许 CORS_ORIGINS=*，请配置明确的前端域名白名单。");
  }
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (corsOrigins.includes("*") || corsOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-YK-Client-Id, X-YK-Fingerprint, X-YK-Manage-Token, X-YK-Edit-Lock-Token, X-Turnstile-Token");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(securityHeaders);
  app.use(apiTimingLogger);
  app.use(requireRequestIntent);
  app.use(cookieParser());
  app.use(ensureAnonymousIdentityCookie);
  app.use("/api", limitWrites);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "64kb", parameterLimit: 100 }));
  app.use(hydrateIdentityNetworkContext);

  if (serveStatic) {
    app.use("/uploads", express.static(UPLOAD_DIR, {
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "public, max-age=86400");
      },
    }));
    app.use(express.static(staticRoot, { extensions: ["html"] }));
  }

  app.get("/api/qr", asyncRoute(async (req, res) => {
    const text = cleanText(req.query.text || req.query.url || "");
    if (!text || text.length > 2048) {
      res.status(400).json({ error: "二维码内容不能为空，且不能超过 2048 个字符" });
      return;
    }
    const svg = await QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
      color: {
        dark: "#17231f",
        light: "#ffffff",
      },
    });
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(svg);
  }));

  app.get("/api/qr-data", asyncRoute(async (req, res) => {
    const text = cleanText(req.query.text || req.query.url || "");
    if (!text || text.length > 2048) {
      res.status(400).json({ error: "二维码内容不能为空，且不能超过 2048 个字符" });
      return;
    }
    const qr = QRCode.create(text, {
      errorCorrectionLevel: "M",
    });
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({
      size: qr.modules.size,
      data: Array.from(qr.modules.data || []),
      margin: 2,
    });
  }));

  app.get("/api/miniprogram/config", asyncRoute(async (_req, res) => {
    const wechat = wechatMiniProgramConfig();
    res.json({
      appId: wechat.appId,
      notifications: wechatMiniProgramNotificationConfig(),
    });
  }));

  app.get("/api/session", asyncRoute(async (req, res) => {
    const identityContext = await identityNetworkContextForRequest(req);
    res.json({
      user: publicUser(await getCurrentUser(req), { includePhone: true }),
      anonymous: publicIdentity(requestIdentity(req)),
      identitySync: await publicIdentityNetworkContext(identityContext),
    });
  }));

  app.get("/api/profile/me", asyncRoute(async (req, res) => {
    const identityContext = await identityNetworkContextForRequest(req);
    const identity = identityContext.identity;
    const profileId = identityContext.profileId || identity.id;
    const profile = await identityProfileById(profileId);
    res.json({
      profile: profile || await publicIdentityProfile(null, { identityId: profileId }),
      anonymous: publicIdentity(identity),
      identitySync: await publicIdentityNetworkContext(identityContext),
    });
  }));

  const saveMyProfileHandler = asyncRoute(async (req, res) => {
    const identityContext = await identityNetworkContextForRequest(req);
    const identity = identityContext.identity;
    const profileId = identityContext.profileId || identity.id;
    const input = parseIdentityProfileInput(req.body);
    const error = validateIdentityProfileInput(input);
    if (error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error });
      return;
    }
    const existing = await store.findById("identityProfiles", profileId);
    let avatarUrl = existing?.avatarUrl || "";
    let avatarFileId = existing?.avatarFileId || "";
    if (req.file) {
      await assertUploadedImage(req.file);
      const uploaded = await store.saveUpload(req.file, { directory: "profile-avatars" });
      avatarUrl = uploaded.url || avatarUrl;
      avatarFileId = uploaded.fileId || avatarFileId;
    }
    const now = new Date().toISOString();
    const patch = {
      id: profileId,
      communityId: communityId(profileId),
      displayName: input.displayName,
      bio: input.bio,
      avatarUrl,
      avatarFileId,
      identitySnapshot: publicIdentity(identity),
      identityNetworkId: identityContext.network?.id || "",
      sourceIdentityId: identity.id,
      updatedAt: now,
    };
    let saved;
    if (existing) {
      saved = await store.update("identityProfiles", profileId, patch);
    } else {
      saved = {
        ...patch,
        createdAt: now,
      };
      await store.insert("identityProfiles", saved);
    }
    await writeLog(req, "profile.update", {
      actorName: input.displayName || "匿名资料",
      targetType: "identityProfile",
      targetId: profileId,
      targetName: input.displayName || communityId(profileId),
      detail: "保存我的公开资料",
    });
    res.json({
      profile: await publicIdentityProfile(saved, { identityId: profileId }),
      identitySync: await publicIdentityNetworkContext(identityContext),
    });
  });
  app.put("/api/profile/me", profileAvatarUpload.single("avatar"), saveMyProfileHandler);
  app.post("/api/profile/me", profileAvatarUpload.single("avatar"), saveMyProfileHandler);

  app.get("/api/identity-sync/me", asyncRoute(async (req, res) => {
    const context = await identityNetworkContextForRequest(req);
    res.json({
      identitySync: await publicIdentityNetworkContext(context),
      counts: await identitySubjectSummaryForContext(context),
    });
  }));

  app.post("/api/identity-sync/create", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const context = await ensureIdentityNetwork(req, { label: req.body?.label });
    await writeLog(req, "identity_sync.create", {
      actorName: "匿名设备",
      targetType: "identityNetwork",
      targetId: context.network?.id || "",
      targetName: context.network?.communityId || communityId(context.network?.id || ""),
      detail: "创建设备同步身份网络",
    });
    res.json({
      identitySync: await publicIdentityNetworkContext(context),
      counts: await identitySubjectSummaryForContext(context),
    });
  }));

  app.post("/api/identity-sync/wechat/bind", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const session = await wechatMiniProgramSessionFromCode(req.body?.code || "");
    const provider = session.provider;
    const credentialHash = hashExternalCredential(provider, `${session.appId}:${session.openid}`);
    const unionIdHash = session.unionid ? hashExternalCredential("wechat_unionid", session.unionid) : "";
    const credentialId = makeExternalCredentialId(provider, credentialHash);
    const result = await withMutationLock(`external-credential:${credentialHash}`, async () => {
      const now = new Date().toISOString();
      const sourceContext = await ensureIdentityNetwork(req, { label: req.body?.label || "微信小程序" });
      let credential = await store.findByFilters("identityExternalCredentials", [
        { field: "provider", op: "eq", value: provider },
        { field: "credentialHash", op: "eq", value: credentialHash },
      ]);
      let nextContext = sourceContext;
      let merged = false;
      if (credential?.status === "active" && credential.identityNetworkId) {
        const targetNetwork = await store.findById("identityNetworks", credential.identityNetworkId);
        if (targetNetwork && targetNetwork.status !== "merged") {
          const mergeResult = await mergeIdentityContextIntoNetwork(targetNetwork, sourceContext, {
            now,
            label: req.body?.label || "微信小程序",
            profileSource: "target",
            reason: "wechat_miniprogram_bind",
          });
          nextContext = mergeResult.context;
          merged = !mergeResult.alreadyJoined;
        }
      }
      const identityNetworkId = nextContext.network?.id || sourceContext.network?.id || "";
      const patch = {
        id: credential?.id || credentialId,
        provider,
        appId: session.appId,
        credentialHash,
        unionIdHash,
        identityNetworkId,
        firstIdentityId: credential?.firstIdentityId || sourceContext.identity.id,
        lastIdentityId: sourceContext.identity.id,
        status: "active",
        lastSeenAt: now,
        responseTimeMs: session.responseTimeMs,
        updatedAt: now,
      };
      if (credential) {
        credential = await store.update("identityExternalCredentials", credential.id, patch);
      } else {
        credential = {
          ...patch,
          id: credentialId,
          boundAt: now,
          createdAt: now,
        };
        await store.insertUnique("identityExternalCredentials", credential, "id");
      }
      return {
        context: nextContext,
        credential,
        merged,
      };
    });
    req.ykIdentityContext = result.context;
    await writeLog(req, "identity_sync.wechat.bind", {
      actorName: "匿名设备",
      targetType: "identityNetwork",
      targetId: result.context.network?.id || "",
      targetName: result.context.network?.communityId || communityId(result.context.network?.id || ""),
      detail: result.merged ? "绑定微信小程序身份并合并设备" : "绑定微信小程序身份",
    });
    res.json({
      ok: true,
      merged: result.merged,
      binding: publicExternalBinding(result.credential),
      identitySync: await publicIdentityNetworkContext(result.context),
      counts: await identitySubjectSummaryForContext(result.context),
    });
  }));

  app.post("/api/identity-sync/invites", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const context = await ensureIdentityNetwork(req, { label: req.body?.label });
    const token = makeAccessToken();
    const now = new Date().toISOString();
    const invite = {
      id: makeId("sync_invite"),
      tokenHash: hashIdentitySyncInviteToken(token),
      targetNetworkId: context.network.id,
      createdByIdentityId: context.identity.id,
      createdByNetworkId: context.network.id,
      status: "pending",
      expiresAt: new Date(Date.now() + IDENTITY_SYNC_INVITE_MAX_AGE_MS).toISOString(),
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("identitySyncInvites", invite);
    const invitePath = `identity-sync.html?token=${encodeURIComponent(token)}`;
    const miniPath = `/pages/identity-sync/identity-sync?token=${encodeURIComponent(token)}`;
    const inviteUrl = `${publicSiteOrigin()}/${invitePath}`;
    await writeLog(req, "identity_sync.invite.create", {
      actorName: "匿名设备",
      targetType: "identityNetwork",
      targetId: context.network.id,
      targetName: context.network.communityId || communityId(context.network.id),
      detail: "生成设备同步邀请",
    });
    res.json({
      invite: {
        id: invite.id,
        url: inviteUrl,
        path: invitePath,
        miniPath,
        expiresAt: invite.expiresAt,
      },
      identitySync: await publicIdentityNetworkContext(context),
    });
  }));

  app.get("/api/identity-sync/invites/:token", asyncRoute(async (req, res) => {
    const token = cleanText(req.params.token);
    const invite = await store.findByFilters("identitySyncInvites", [{ field: "tokenHash", op: "eq", value: hashIdentitySyncInviteToken(token) }]);
    if (!invite || invite.status !== "pending") {
      res.status(404).json({ error: "同步邀请不存在或已经失效" });
      return;
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
      await store.update("identitySyncInvites", invite.id, { status: "expired", updatedAt: new Date().toISOString() });
      res.status(410).json({ error: "同步邀请已过期，请重新生成" });
      return;
    }
    const sourceContext = await identityNetworkContextForRequest(req);
    const targetNetwork = await store.findById("identityNetworks", invite.targetNetworkId);
    if (!targetNetwork || targetNetwork.status === "merged") {
      res.status(404).json({ error: "目标身份网络不存在或已经合并" });
      return;
    }
    const alreadyJoined = sourceContext.network?.id === targetNetwork.id;
    const preview = alreadyJoined ? null : await identitySyncMergePreview(invite, sourceContext);
    res.json({
      invite: {
        id: invite.id,
        expiresAt: invite.expiresAt,
        targetNetworkId: invite.targetNetworkId,
      },
      alreadyJoined,
      preview,
      identitySync: await publicIdentityNetworkContext(sourceContext),
    });
  }));

  app.post("/api/identity-sync/invites/:token/accept", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const token = cleanText(req.params.token);
    const result = await withMutationLock(`identity-sync:${hashIdentitySyncInviteToken(token)}`, async () => {
      const now = new Date().toISOString();
      const invite = await store.findByFilters("identitySyncInvites", [{ field: "tokenHash", op: "eq", value: hashIdentitySyncInviteToken(token) }]);
      if (!invite || invite.status !== "pending") {
        throw Object.assign(new Error("同步邀请不存在或已经失效"), { statusCode: 404 });
      }
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
        await store.update("identitySyncInvites", invite.id, { status: "expired", updatedAt: now });
        throw Object.assign(new Error("同步邀请已过期，请重新生成"), { statusCode: 410 });
      }
      const targetNetwork = await store.findById("identityNetworks", invite.targetNetworkId);
      if (!targetNetwork || targetNetwork.status === "merged") {
        throw Object.assign(new Error("目标身份网络不存在或已经合并"), { statusCode: 404 });
      }
      const sourceContext = await identityNetworkContextForIdentity(requestIdentity(req));
      const mergeResult = await mergeIdentityContextIntoNetwork(targetNetwork, sourceContext, {
        now,
        label: req.body?.label,
        profileSource: req.body?.profileSource,
        profile: req.body?.profile,
        inviteId: invite.id,
        reason: "identity_sync_invite",
      });
      await store.update("identitySyncInvites", invite.id, {
        status: "accepted",
        acceptedByIdentityId: sourceContext.identity.id,
        acceptedNetworkId: targetNetwork.id,
        acceptedAt: now,
        updatedAt: now,
      });
      return mergeResult;
    });
    req.ykIdentityContext = result.context;
    await writeLog(req, "identity_sync.invite.accept", {
      actorName: "匿名设备",
      targetType: "identityNetwork",
      targetId: result.context.network?.id || "",
      targetName: result.context.network?.communityId || communityId(result.context.network?.id || ""),
      detail: result.alreadyJoined ? "当前设备已经在身份网络中" : `接受设备同步邀请，合并 ${result.mergedDeviceIds.length} 个设备身份`,
    });
    res.json({
      ok: true,
      alreadyJoined: result.alreadyJoined,
      identitySync: await publicIdentityNetworkContext(result.context),
      counts: await identitySubjectSummaryForContext(result.context),
    });
  }));

  app.delete("/api/identity-sync/devices/:deviceId", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const context = await identityNetworkContextForRequest(req);
    if (!context.network) {
      res.status(400).json({ error: "当前设备还没有开启同步" });
      return;
    }
    const device = await store.findById("identityNetworkDevices", req.params.deviceId);
    if (!device || device.networkId !== context.network.id || device.status !== "active") {
      res.status(404).json({ error: "找不到这个同步设备" });
      return;
    }
    if (device.identityId === context.identity.id) {
      res.status(400).json({ error: "不能在当前设备移除自己，可以在其他已同步设备上操作" });
      return;
    }
    const activeDevices = await activeDevicesForNetwork(context.network.id);
    if (activeDevices.length <= 1) {
      res.status(400).json({ error: "至少需要保留一个同步设备" });
      return;
    }
    const now = new Date().toISOString();
    await store.update("identityNetworkDevices", device.id, {
      status: "revoked",
      revokedByIdentityId: context.identity.id,
      revokedAt: now,
      updatedAt: now,
    });
    const nextContext = await identityNetworkContextForIdentity(context.identity);
    req.ykIdentityContext = nextContext;
    await writeLog(req, "identity_sync.device.revoke", {
      actorName: "匿名设备",
      targetType: "identityNetworkDevice",
      targetId: device.id,
      targetName: device.label || device.identityId,
      detail: `移除同步设备：${device.label || device.identityId}`,
    });
    res.json({
      ok: true,
      identitySync: await publicIdentityNetworkContext(nextContext),
    });
  }));

  app.get("/api/profiles/:id", asyncRoute(async (req, res) => {
    const publicId = cleanText(req.params.id);
    if (!publicId) {
      res.status(400).json({ error: "缺少发起人标识" });
      return;
    }
    const profileRecord = await identityProfileByPublicId(publicId);
    const identityId = profileRecord?.id || publicId;
    const activities = await publicProfileActivities(identityId, req);
    const fallbackName = activities[0]?.initiator || activities[0]?.creatorName || "";
    const profile = await publicIdentityProfile(profileRecord, { identityId, fallbackName });
    const badges = await badgeSummaryForIdentity(store, identityId);
    res.json({
      profile: profile || await publicIdentityProfile(null, { identityId, fallbackName }),
      badges,
      summary: summarizePublicProfileActivities(activities),
      activities,
    });
  }));

  app.post("/api/login", loginIpRateLimiter, loginRateLimiter, asyncRoute(async (req, res) => {
    const phone = cleanPhone(req.body.phone);
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "请输入有效手机号" });
      return;
    }
    const user = await hydrateUserRole(await store.findByFilters("users", [{ field: "phone", op: "eq", value: phone }]));

    if (!user) {
      res.status(401).json({ error: "手机号暂时不能登录，请确认已由有空管理员加入协作名单。" });
      return;
    }

    await cleanupExpiredSessions();
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    await store.insert("sessions", {
      id: makeId("session"),
      tokenHash: hashToken(token),
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS).toISOString(),
    });

    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    await writeLog(req, "login", {
      user,
      targetType: "user",
      targetId: user.id,
      targetName: user.nickname,
      detail: "管理员或协作员登录系统",
    });
    res.json({ user: publicUser(user, { includePhone: true }), token });
  }));

  app.post("/api/logout", asyncRoute(async (req, res) => {
    const token = getRequestToken(req);
    const user = await getCurrentUser(req);
    if (token) {
      const tokenHash = hashToken(token);
      const removed = await store.removeWhere("sessions", [{ field: "tokenHash", op: "eq", value: tokenHash }]);
      if (!removed) {
        const legacyHash = legacyHashToken(token);
        await store.removeWhere("sessions", [{ field: "tokenHash", op: "eq", value: legacyHash }]);
        await store.removeWhere("sessions", [{ field: "token", op: "eq", value: token }]);
      }
    }
    if (user) {
      await writeLog(req, "logout", {
        user,
        targetType: "user",
        targetId: user.id,
        targetName: user.nickname,
        detail: "管理员或协作员退出系统",
      });
    }
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
    res.json({ ok: true });
  }));

  app.get("/api/dashboard/me", asyncRoute(async (req, res) => {
    await sweepExpiredActivities({ reason: "dashboard-me" });
    const user = await getCurrentUser(req);
    res.json(await memberDashboardPayload(req, user));
  }));

  app.get("/api/me/summary", asyncRoute(async (req, res) => {
    await sweepExpiredActivities({ reason: "me-summary" });
    const user = await getCurrentUser(req);
    const identityContext = await identityNetworkContextForRequest(req);
    const identity = identityContext.identity;
    const profileId = identityContext.profileId || identity.id;
    const [{ data: registrationRows, pageInfo }, dashboard, profile] = await Promise.all([
      identityOwnedRecordPage("registrations", "identityId", req, {
        page: 1,
        pageSize: 6,
        maxPageSize: 6,
        sort: [{ field: "createdAt", direction: "desc" }],
      }),
      memberDashboardPayload(req, user),
      identityProfileById(profileId),
    ]);
    const activityMap = await loadRecordsByIds("activities", registrationRows.map((item) => item.activityId));
    const registrations = registrationRows
      .map((registration) => {
        const activity = activityMap.get(registration.activityId);
        if (!activity) return null;
        return {
          ...publicRegistration(registration),
          activity: {
            id: activity.id,
            title: activity.title,
            location: activity.location,
            startsAt: activity.startsAt,
            endsAt: activity.endsAt,
            status: activity.status,
            statusLabel: statusLabel(activity.status),
            moduleId: activity.moduleId,
          },
        };
      })
      .filter(Boolean);
    res.json({
      user,
      profile: profile || await publicIdentityProfile(null, { identityId: profileId }),
      anonymous: publicIdentity(identity),
      identitySync: await publicIdentityNetworkContext(identityContext),
      dashboard,
      registrations,
      registrationsPageInfo: pageInfo,
    });
  }));

  app.get("/api/dashboard/admin", requirePermission("dashboard", "view"), asyncRoute(async (req, res) => {
    await sweepExpiredActivities({ reason: "dashboard-admin" });
    res.json(await adminDashboardPayload(req.currentUser));
  }));

  app.get("/api/safety/health", requireAnyPermission([["ai", "view"], ["safety", "view"], ["dashboard", "view"]]), asyncRoute(async (_req, res) => {
    res.json({ health: await safetyHealthPayload() });
  }));

  app.get("/api/safety/client-config", asyncRoute(async (_req, res) => {
    const config = await getSafetyConfig(store);
    res.json({
      turnstile: {
        enabled: config.turnstile?.enabled === true,
        siteKey: config.turnstile?.siteKey || process.env.TURNSTILE_SITE_KEY || "",
        requiredBelowTrust: config.turnstile?.requiredBelowTrust ?? 35,
      },
      policy: {
        publishDirectMaxRisk: config.policy?.publishDirectMaxRisk,
        publishWithNoticeMaxRisk: config.policy?.publishWithNoticeMaxRisk,
      },
    });
  }));

  app.get("/api/safety/config", requirePermission("safety", "view"), asyncRoute(async (_req, res) => {
    res.json({ config: await getSafetyConfig(store) });
  }));

  app.put("/api/safety/config", requirePermission("safety", "configure"), asyncRoute(async (req, res) => {
    const config = await saveSafetyConfig(store, parseJsonLike(req.body.config, req.body));
    await writeLog(req, "safety.config.update", {
      targetType: "system",
      targetId: "safety_config",
      targetName: "规则与策略配置",
      detail: "保存规则引擎、限流、举报、策略配置",
    });
    res.json({ config });
  }));

  app.get("/api/safety/rules", requirePermission("safety", "view"), asyncRoute(async (_req, res) => {
    const rules = await getSafetyRules(store, { includeDisabled: true });
    res.json({ rules: rules.map(publicSafetyRule) });
  }));

  app.post("/api/safety/rules", requirePermission("safety", "create"), asyncRoute(async (req, res) => {
    const input = parseSafetyRuleInput(req.body);
    if (!input.name || !input.type) {
      res.status(400).json({ error: "规则名称和类型都需要填写" });
      return;
    }
    if (!Number.isFinite(input.weight) || input.weight < -100 || input.weight > 100) {
      res.status(400).json({ error: "风险分值需要在 -100 到 100 之间" });
      return;
    }
    const now = new Date().toISOString();
    const rule = {
      id: makeId("rule"),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("safetyRules", rule);
    await writeLog(req, "safety.rule.create", {
      targetType: "safetyRule",
      targetId: rule.id,
      targetName: rule.name,
      detail: `新增规则：${rule.name}`,
    });
    res.json({ rule: publicSafetyRule(rule) });
  }));

  app.put("/api/safety/rules/:id", requirePermission("safety", "edit"), asyncRoute(async (req, res) => {
    const existing = await store.findById("safetyRules", req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该规则" });
      return;
    }
    const input = parseSafetyRuleInput(req.body);
    if (!input.name || !input.type) {
      res.status(400).json({ error: "规则名称和类型都需要填写" });
      return;
    }
    if (!Number.isFinite(input.weight) || input.weight < -100 || input.weight > 100) {
      res.status(400).json({ error: "风险分值需要在 -100 到 100 之间" });
      return;
    }
    const updated = await store.update("safetyRules", existing.id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "safety.rule.update", {
      targetType: "safetyRule",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存规则：${updated.name}`,
    });
    res.json({ rule: publicSafetyRule(updated) });
  }));

  app.delete("/api/safety/rules/:id", requirePermission("safety", "delete"), asyncRoute(async (req, res) => {
    const rule = await store.findById("safetyRules", req.params.id);
    await store.remove("safetyRules", (item) => item.id === req.params.id);
    await writeLog(req, "safety.rule.delete", {
      targetType: "safetyRule",
      targetId: req.params.id,
      targetName: rule ? rule.name : req.params.id,
      detail: `删除规则：${rule ? rule.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/ai/settings", requirePermission("ai", "view"), asyncRoute(async (_req, res) => {
    res.json({ settings: publicAiSettings(await getAiSettings(store)) });
  }));

  app.put("/api/ai/settings", requirePermission("ai", "configure"), asyncRoute(async (req, res) => {
    const settings = await saveAiSettings(store, parseAiSettingsInput(req.body));
    await writeLog(req, "ai.settings.update", {
      targetType: "system",
      targetId: "ai_settings",
      targetName: "AI Analysis Engine",
      detail: "保存 AI 分析引擎设置",
    });
    res.json({ settings: publicAiSettings(settings) });
  }));

  app.post("/api/ai/test-connection", requirePermission("ai", "configure"), asyncRoute(async (req, res) => {
    const result = await testAiConnection(store, parseAiSettingsInput(req.body));
    await writeLog(req, "ai.connection.test", {
      targetType: "system",
      targetId: "ai_settings",
      targetName: "AI Analysis Engine",
      detail: result.ok ? `AI 连接测试成功：${result.provider}/${result.model}` : `AI 连接测试失败：${result.error}`,
    });
    res.json(result);
  }));

  app.get("/api/ai/models", requirePermission("ai", "view"), asyncRoute(async (_req, res) => {
    res.json({ models: await listAiModelProfiles(store) });
  }));

  app.get("/api/ai/models/:id", requirePermission("ai", "view"), asyncRoute(async (req, res) => {
    const profile = await getAiModelProfile(store, req.params.id);
    if (!profile) {
      res.status(404).json({ error: "找不到该模型档案" });
      return;
    }
    res.json({ model: publicAiModelProfile(profile) });
  }));

  app.post("/api/ai/models", requirePermission("ai", "create"), asyncRoute(async (req, res) => {
    const input = parseAiModelProfileInput(req.body);
    if (!input.name || !input.provider || !input.model) {
      res.status(400).json({ error: "模型名称、Provider 和 Model Name 都需要填写" });
      return;
    }
    const profile = await saveAiModelProfile(store, input);
    await writeLog(req, "ai.model.create", {
      targetType: "aiModelProfile",
      targetId: profile.id,
      targetName: profile.name,
      detail: `新增 AI 模型：${profile.name}`,
    });
    res.json({ model: publicAiModelProfile(profile) });
  }));

  app.put("/api/ai/models/:id", requirePermission("ai", "edit"), asyncRoute(async (req, res) => {
    const existing = await getAiModelProfile(store, req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该模型档案" });
      return;
    }
    const input = parseAiModelProfileInput(req.body);
    if (!input.name || !input.provider || !input.model) {
      res.status(400).json({ error: "模型名称、Provider 和 Model Name 都需要填写" });
      return;
    }
    const profile = await saveAiModelProfile(store, input, existing);
    await writeLog(req, "ai.model.update", {
      targetType: "aiModelProfile",
      targetId: profile.id,
      targetName: profile.name,
      detail: `保存 AI 模型：${profile.name}`,
    });
    res.json({ model: publicAiModelProfile(profile) });
  }));

  app.delete("/api/ai/models/:id", requirePermission("ai", "delete"), asyncRoute(async (req, res) => {
    const profile = await getAiModelProfile(store, req.params.id);
    if (!profile) {
      res.status(404).json({ error: "找不到该模型档案" });
      return;
    }
    await removeAiModelProfile(store, profile.id);
    await writeLog(req, "ai.model.delete", {
      targetType: "aiModelProfile",
      targetId: profile.id,
      targetName: profile.name,
      detail: `删除 AI 模型：${profile.name}`,
    });
    res.json({ ok: true });
  }));

  app.post("/api/ai/models/:id/test", requirePermission("ai", "configure"), asyncRoute(async (req, res) => {
    const result = await testAiModelProfile(store, req.params.id, parseAiModelProfileInput(req.body));
    await writeLog(req, "ai.model.test", {
      targetType: "aiModelProfile",
      targetId: req.params.id,
      targetName: result.profile?.name || req.params.id,
      detail: result.ok ? `AI 模型连接测试成功：${result.provider}/${result.model}` : `AI 模型连接测试失败：${result.error}`,
    });
    res.json(result);
  }));

  app.get("/api/ai/usage", requirePermission("ai", "view"), asyncRoute(async (req, res) => {
    res.json({ usage: await getAiUsageStats(store, { days: req.query.days }) });
  }));

  app.get("/api/ai/prompts", requirePermission("ai", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const type = cleanText(req.query.type);
    const { data, pageInfo } = await store.query("aiPrompts", {
      ...pageQueryOptions(req.query),
      filters: type ? [{ field: "type", op: "eq", value: type }] : [],
      keyword,
      keywordFields: ["name", "version", "systemPrompt", "userPrompt"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ prompts: data, pageInfo });
  }));

  app.get("/api/ai/prompts/:id", requirePermission("ai", "view"), asyncRoute(async (req, res) => {
    const prompt = await store.findById("aiPrompts", req.params.id);
    if (!prompt) {
      res.status(404).json({ error: "找不到该 Prompt" });
      return;
    }
    res.json({ prompt });
  }));

  app.post("/api/ai/prompts", requirePermission("ai", "create"), asyncRoute(async (req, res) => {
    const input = parsePromptInput(req.body);
    if (!input.name || !input.version || !input.systemPrompt || !input.userPrompt) {
      res.status(400).json({ error: "Prompt 名称、版本、System Prompt 和 User Prompt 都需要填写" });
      return;
    }
    const now = new Date().toISOString();
    const prompt = {
      id: makeId("prompt"),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("aiPrompts", prompt);
    let settings = null;
    if (prompt.active) {
      settings = await activateAiPrompt(prompt);
    }
    await writeLog(req, "ai.prompt.create", {
      targetType: "aiPrompt",
      targetId: prompt.id,
      targetName: prompt.name,
      detail: `新增 Prompt：${prompt.name}`,
    });
    res.json({ prompt: { ...prompt, active: Boolean(prompt.active) }, settings: settings ? publicAiSettings(settings) : undefined });
  }));

  app.put("/api/ai/prompts/:id", requirePermission("ai", "edit"), asyncRoute(async (req, res) => {
    const existing = await store.findById("aiPrompts", req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该 Prompt" });
      return;
    }
    const input = parsePromptInput(req.body);
    if (!input.name || !input.version || !input.systemPrompt || !input.userPrompt) {
      res.status(400).json({ error: "Prompt 名称、版本、System Prompt 和 User Prompt 都需要填写" });
      return;
    }
    const updated = await store.update("aiPrompts", existing.id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
    let settings = null;
    if (updated.active) {
      settings = await activateAiPrompt(updated);
    }
    await writeLog(req, "ai.prompt.update", {
      targetType: "aiPrompt",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存 Prompt：${updated.name}`,
    });
    res.json({ prompt: updated, settings: settings ? publicAiSettings(settings) : undefined });
  }));

  app.post("/api/ai/prompts/:id/activate", requirePermission("ai", "configure"), asyncRoute(async (req, res) => {
    const prompt = await store.findById("aiPrompts", req.params.id);
    if (!prompt) {
      res.status(404).json({ error: "找不到该 Prompt" });
      return;
    }
    const settings = await activateAiPrompt(prompt);
    await writeLog(req, "ai.prompt.activate", {
      targetType: "aiPrompt",
      targetId: prompt.id,
      targetName: prompt.name,
      detail: `启用 Prompt：${prompt.name}`,
    });
    res.json({ prompt: { ...prompt, active: true }, settings: publicAiSettings(settings) });
  }));

  app.delete("/api/ai/prompts/:id", requirePermission("ai", "delete"), asyncRoute(async (req, res) => {
    const prompt = await store.findById("aiPrompts", req.params.id);
    await store.remove("aiPrompts", (item) => item.id === req.params.id);
    await writeLog(req, "ai.prompt.delete", {
      targetType: "aiPrompt",
      targetId: req.params.id,
      targetName: prompt ? prompt.name : req.params.id,
      detail: `删除 Prompt：${prompt ? prompt.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/files", asyncRoute(async (req, res) => {
    const fileId = cleanText(req.query.fileId);
    if (!isAllowedStoredFileId(fileId)) {
      res.status(400).send("缺少文件标识");
      return;
    }
    const url = await store.getFileUrl(fileId);
    if (!url) {
      res.status(404).send("文件不存在或暂时无法访问");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, url);
  }));

  app.post("/api/uploads/rich-image", richImageUpload.single("image"), asyncRoute(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "请选择要插入正文的图片" });
      return;
    }
    const identity = requestIdentity(req);
    const safetyConfig = await getSafetyConfig(store);
    const uploadLimit = await checkSimpleLimit(
      store,
      identity,
      "rich-image-upload:minute",
      Number(safetyConfig.rateLimit?.uploadMinuteMax || 12),
      60 * 1000
    );
    if (!uploadLimit.allowed) {
      await removeUploadedFile(req.file);
      res.status(429).json({ error: "图片上传有点频繁，可以稍后再继续编辑。" });
      return;
    }
    await assertUploadedImage(req.file);
    if (Number(req.file.size || 0) > RICH_IMAGE_COMPRESSED_LIMIT_BYTES) {
      if (req.file.path) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(400).json({ error: "图片压缩后仍超过 10MB，请换一张图片或重新压缩" });
      return;
    }
    const uploaded = await store.saveUpload(req.file, { directory: "rich-images" });
    res.json({ url: richImagePublicUrl(req, uploaded), fileId: uploaded.fileId || "" });
  }));

  app.get("/api/roles", requireAnyPermission([["roles", "view"], ["users", "view"]]), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data, pageInfo } = await store.query("roles", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "key", "description"],
      sort: [{ field: "id", direction: "asc" }],
    });
    res.json({
      roles: data.map(publicRole),
      modules: PERMISSION_MODULES,
      actions: PERMISSION_ACTIONS,
      pageInfo,
    });
  }));

  app.post("/api/roles", requirePermission("roles", "create"), asyncRoute(async (req, res) => {
    const input = roleFromInput(req.body, null);
    const error = validateRoleInput(input, { creating: true });
    if (error) {
      res.status(400).json({ error });
      return;
    }
    if (await store.findById("roles", input.key) || await store.findByFilters("roles", [{ field: "key", op: "eq", value: input.key }])) {
      res.status(409).json({ error: "这个角色标识已经存在" });
      return;
    }
    const now = new Date().toISOString();
    const role = {
      id: input.key,
      key: input.key,
      name: input.name,
      description: input.description,
      builtIn: false,
      locked: false,
      permissions: input.permissions,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("roles", role);
    await writeLog(req, "role.create", {
      targetType: "role",
      targetId: role.id,
      targetName: role.name,
      detail: `新增角色：${role.name}`,
    });
    res.json({ role: publicRole(role) });
  }));

  app.put("/api/roles/:id", requirePermission("roles", "edit"), asyncRoute(async (req, res) => {
    const existing = await store.findById("roles", req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该角色" });
      return;
    }
    if (existing.locked || existing.key === "admin" || existing.id === "admin") {
      res.status(400).json({ error: "有空管理员角色不能修改权限" });
      return;
    }
    const input = roleFromInput(req.body, existing);
    const error = validateRoleInput(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const updated = await store.update("roles", existing.id, {
      name: input.name,
      description: input.description,
      permissions: input.permissions,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "role.update", {
      targetType: "role",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存角色权限：${updated.name}`,
    });
    res.json({ role: publicRole(updated) });
  }));

  app.delete("/api/roles/:id", requirePermission("roles", "delete"), asyncRoute(async (req, res) => {
    const role = await store.findById("roles", req.params.id);
    if (!role) {
      res.status(404).json({ error: "找不到该角色" });
      return;
    }
    if (role.builtIn || role.locked || role.key === "admin" || role.key === "collaborator") {
      res.status(400).json({ error: "内置角色不能删除" });
      return;
    }
    const assignedUser = await store.findByFilters("users", [{ field: "role", op: "eq", value: role.key }]);
    if (assignedUser) {
      res.status(409).json({ error: "仍有用户使用这个角色，请先调整用户角色" });
      return;
    }
    await store.remove("roles", (item) => item.id === role.id);
    await writeLog(req, "role.delete", {
      targetType: "role",
      targetId: role.id,
      targetName: role.name,
      detail: `删除角色：${role.name}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/users", requirePermission("users", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const role = cleanText(req.query.role);
    const filters = role ? [{ field: "role", op: "eq", value: normalizeRoleKey(role) }] : [];
    const { data, pageInfo } = await store.query("users", {
      ...pageQueryOptions(req.query),
      filters,
      keyword,
      keywordFields: ["nickname", "phone", "role"],
      sort: [{ field: "id", direction: "asc" }],
    });
    const users = await Promise.all(data.map((user) => hydrateUserRole(user)));
    res.json({ users: users.map((user) => publicUser(user, { includePhone: true })), pageInfo });
  }));

  app.get("/api/collaborators", asyncRoute(async (_req, res) => {
    const { data } = await store.query("users", {
      page: 1,
      pageSize: 100,
      maxPageSize: 500,
      sort: [{ field: "nickname", direction: "asc" }],
    });
    const users = await Promise.all(data.map((user) => hydrateUserRole(user)));
    res.json({
      collaborators: users.filter((user) => userCan(user, "reviewTasks", "review")).map(publicUser),
    });
  }));

  app.post("/api/users", requirePermission("users", "create"), asyncRoute(async (req, res) => {
    const nickname = cleanText(req.body.nickname);
    const phone = cleanPhone(req.body.phone);
    const role = normalizeRoles(req.body).find((item) => item !== "admin") || "collaborator";
    const finalRoles = [role];

    if (!nickname || !phone) {
      res.status(400).json({ error: "昵称和手机号都需要填写" });
      return;
    }
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "请输入有效手机号" });
      return;
    }
    const nicknameError = validateTextLength("昵称", nickname, TEXT_LIMITS.nickname);
    if (nicknameError) {
      res.status(400).json({ error: nicknameError });
      return;
    }
    if (role === "admin" || !(await store.findById("roles", role))) {
      res.status(400).json({ error: "请选择有效角色" });
      return;
    }

    if (await store.findByFilters("users", [{ field: "phone", op: "eq", value: phone }])) {
      res.status(409).json({ error: "这个手机号已经存在" });
      return;
    }

    const now = new Date().toISOString();
    const user = {
      id: makeId("user"),
      nickname,
      phone,
      role,
      roles: finalRoles,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("users", user);
    await writeLog(req, "user.create", {
      targetType: "user",
      targetId: user.id,
      targetName: user.nickname,
      detail: `新增用户：${user.nickname}`,
    });
    res.json({ user: publicUser(await hydrateUserRole(user), { includePhone: true }) });
  }));

  app.put("/api/users/:id", requirePermission("users", "edit"), asyncRoute(async (req, res) => {
    const user = await store.findById("users", req.params.id);
    if (!user) {
      res.status(404).json({ error: "找不到该成员" });
      return;
    }

    const nickname = cleanText(req.body.nickname);
    const phone = cleanPhone(req.body.phone);
    const roles = user.id === "admin"
      ? ["admin"]
      : normalizeRoles(req.body).filter((role) => role !== "admin");
    const finalRoles = roles.length ? [roles[0]] : ["collaborator"];
    const role = finalRoles.includes("admin") ? "admin" : finalRoles[0];

    if (!nickname || !phone) {
      res.status(400).json({ error: "昵称和手机号都需要填写" });
      return;
    }
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "请输入有效手机号" });
      return;
    }
    const nicknameError = validateTextLength("昵称", nickname, TEXT_LIMITS.nickname);
    if (nicknameError) {
      res.status(400).json({ error: nicknameError });
      return;
    }
    if (user.id !== "admin" && !(await store.findById("roles", role))) {
      res.status(400).json({ error: "请选择有效角色" });
      return;
    }

    const duplicated = await store.findByFilters("users", [{ field: "phone", op: "eq", value: phone }]);
    if (duplicated) {
      if (duplicated.id !== user.id) {
        res.status(409).json({ error: "这个手机号已经被其他成员使用" });
        return;
      }
    }

    const updated = await store.update("users", user.id, {
      nickname,
      phone,
      role,
      roles: finalRoles,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "user.update", {
      targetType: "user",
      targetId: updated.id,
      targetName: updated.nickname,
      detail: `保存用户：${updated.nickname}`,
    });
    res.json({ user: publicUser(await hydrateUserRole(updated), { includePhone: true }) });
  }));

  app.delete("/api/users/:id", requirePermission("users", "delete"), asyncRoute(async (req, res) => {
    if (req.params.id === "admin") {
      res.status(400).json({ error: "默认 YKadmin 不能删除" });
      return;
    }
    const user = await store.findById("users", req.params.id);
    await store.remove("users", (item) => item.id === req.params.id);
    await store.remove("sessions", (item) => item.userId === req.params.id);
    await writeLog(req, "user.delete", {
      targetType: "user",
      targetId: req.params.id,
      targetName: user ? user.nickname : req.params.id,
      detail: `删除用户：${user ? `${user.nickname}（${maskPhone(user.phone)}）` : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/modules", asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    if (req.query.paged === "true") {
      const { data, pageInfo } = await store.query("modules", {
        ...pageQueryOptions(req.query),
        keyword,
        keywordFields: ["name", "description"],
        sort: [{ field: "createdAt", direction: "asc" }],
      });
      res.json({ modules: data, pageInfo });
      return;
    }
    const { data } = await store.query("modules", {
      page: 1,
      pageSize: 100,
      maxPageSize: 500,
      keyword,
      keywordFields: ["name", "description"],
      sort: [{ field: "createdAt", direction: "asc" }],
    });
    res.json({ modules: data });
  }));

  app.get("/api/activity-series", asyncRoute(async (_req, res) => {
    res.json({ series: await enabledActivitySeries() });
  }));

  app.post("/api/modules", requirePermission("modules", "create"), asyncRoute(async (req, res) => {
    const name = cleanText(req.body.name);
    const description = cleanText(req.body.description);
    if (!name) {
      res.status(400).json({ error: "模块名称不能为空" });
      return;
    }
    const lengthError = validateTextLength("模块名称", name, TEXT_LIMITS.moduleName)
      || validateTextLength("模块说明", description, TEXT_LIMITS.moduleDescription);
    if (lengthError) {
      res.status(400).json({ error: lengthError });
      return;
    }
    const module = {
      id: makeId("module"),
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    await store.insert("modules", module);
    await writeLog(req, "module.create", {
      targetType: "module",
      targetId: module.id,
      targetName: module.name,
      detail: `新增活动模块：${module.name}`,
    });
    res.json({ module });
  }));

  app.put("/api/modules/:id", requirePermission("modules", "edit"), asyncRoute(async (req, res) => {
    const module = await store.findById("modules", req.params.id);
    if (!module) {
      res.status(404).json({ error: "找不到该模块" });
      return;
    }
    const name = cleanText(req.body.name);
    const description = cleanText(req.body.description);
    if (!name) {
      res.status(400).json({ error: "模块名称不能为空" });
      return;
    }
    const lengthError = validateTextLength("模块名称", name, TEXT_LIMITS.moduleName)
      || validateTextLength("模块说明", description, TEXT_LIMITS.moduleDescription);
    if (lengthError) {
      res.status(400).json({ error: lengthError });
      return;
    }
    const updated = await store.update("modules", module.id, {
      name,
      description,
    });
    await writeLog(req, "module.update", {
      targetType: "module",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存活动模块：${updated.name}`,
    });
    res.json({ module: updated });
  }));

  app.delete("/api/modules/:id", requirePermission("modules", "delete"), asyncRoute(async (req, res) => {
    const activity = await store.findByFilters("activities", [{ field: "moduleId", op: "eq", value: req.params.id }]);
    if (activity) {
      res.status(400).json({ error: "已有活动使用该模块，暂时不能删除" });
      return;
    }
    const module = await store.findById("modules", req.params.id);
    await store.remove("modules", (item) => item.id === req.params.id);
    await writeLog(req, "module.delete", {
      targetType: "module",
      targetId: req.params.id,
      targetName: module ? module.name : req.params.id,
      detail: `删除活动模块：${module ? module.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/living-room-friends", asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const filters = [];
    if (req.query.enabled === "true") filters.push({ field: "enabled", op: "eq", value: true });
    const { data, pageInfo } = await store.query("livingRoomFriends", {
      ...pageQueryOptions(req.query),
      filters,
      keyword,
      keywordFields: ["name", "description", "address", "contactName", "contactInfo"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ friends: data.map(publicFriend), pageInfo });
  }));

  app.post("/api/living-room-friends", requirePermission("friends", "create"), upload.single("logo"), asyncRoute(async (req, res) => {
    const input = parseFriendInput(req.body);
    const error = validateFriendInput(input);
    if (error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error });
      return;
    }
    let logoUrl = input.logoUrl;
    let logoFileId = "";
    if (req.file) {
      await assertUploadedImage(req.file);
      const uploaded = await store.saveUpload(req.file, { directory: "friend-logos" });
      logoUrl = uploaded.url;
      logoFileId = uploaded.fileId || "";
    }
    const now = new Date().toISOString();
    const friend = {
      id: makeId("friend"),
      ...input,
      logoUrl,
      logoFileId,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("livingRoomFriends", friend);
    await writeLog(req, "friend.create", {
      targetType: "livingRoomFriend",
      targetId: friend.id,
      targetName: friend.name,
      detail: `新增客厅朋友：${friend.name}`,
    });
    res.json({ friend: publicFriend(friend) });
  }));

  app.put("/api/living-room-friends/:id", requirePermission("friends", "edit"), upload.single("logo"), asyncRoute(async (req, res) => {
    const friend = await store.findById("livingRoomFriends", req.params.id);
    if (!friend) {
      await removeUploadedFile(req.file);
      res.status(404).json({ error: "找不到该客厅朋友" });
      return;
    }
    const input = parseFriendInput(req.body);
    const error = validateFriendInput(input);
    if (error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error });
      return;
    }
    let logoUrl = input.logoUrl || friend.logoUrl || "";
    let logoFileId = friend.logoFileId || "";
    if (req.file) {
      await assertUploadedImage(req.file);
      const uploaded = await store.saveUpload(req.file, { directory: "friend-logos" });
      logoUrl = uploaded.url;
      logoFileId = uploaded.fileId || "";
    }
    const updated = await store.update("livingRoomFriends", friend.id, {
      ...input,
      logoUrl,
      logoFileId,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "friend.update", {
      targetType: "livingRoomFriend",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存客厅朋友：${updated.name}`,
    });
    res.json({ friend: publicFriend(updated) });
  }));

  app.delete("/api/living-room-friends/:id", requirePermission("friends", "delete"), asyncRoute(async (req, res) => {
    const activity = await store.findByFilters("activities", [{ field: "friendId", op: "eq", value: req.params.id }]);
    if (activity) {
      res.status(400).json({ error: "已有活动使用该客厅朋友，暂时不能删除，可以先停用" });
      return;
    }
    const friend = await store.findById("livingRoomFriends", req.params.id);
    await store.remove("livingRoomFriends", (item) => item.id === req.params.id);
    await writeLog(req, "friend.delete", {
      targetType: "livingRoomFriend",
      targetId: req.params.id,
      targetName: friend ? friend.name : req.params.id,
      detail: `删除客厅朋友：${friend ? friend.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/templates", asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data, pageInfo } = await store.query("templates", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "description", "content"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ templates: data, pageInfo });
  }));

  app.get("/api/templates/:id", asyncRoute(async (req, res) => {
    const template = await store.findById("templates", req.params.id);
    if (!template) {
      res.status(404).json({ error: "找不到该活动模板" });
      return;
    }
    res.json({ template });
  }));

  app.post("/api/templates", requirePermission("templates", "create"), asyncRoute(async (req, res) => {
    const input = parseTemplateInput(req.body);
    const error = validateTemplateInput(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const now = new Date().toISOString();
    const template = {
      id: makeId("template"),
      name: input.name,
      description: input.description,
      content: input.content,
      createdBy: req.currentUser.id,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("templates", template);
    await writeLog(req, "template.create", {
      targetType: "template",
      targetId: template.id,
      targetName: template.name,
      detail: `新增活动模板：${template.name}`,
    });
    res.json({ template });
  }));

  app.put("/api/templates/:id", requirePermission("templates", "edit"), asyncRoute(async (req, res) => {
    const template = await store.findById("templates", req.params.id);
    if (!template) {
      res.status(404).json({ error: "找不到该活动模板" });
      return;
    }
    const input = parseTemplateInput(req.body);
    const error = validateTemplateInput(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const updated = await store.update("templates", template.id, {
      name: input.name,
      description: input.description,
      content: input.content,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "template.update", {
      targetType: "template",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存活动模板：${updated.name}`,
    });
    res.json({ template: updated });
  }));

  app.delete("/api/templates/:id", requirePermission("templates", "delete"), asyncRoute(async (req, res) => {
    const template = await store.findById("templates", req.params.id);
    await store.remove("templates", (item) => item.id === req.params.id);
    await writeLog(req, "template.delete", {
      targetType: "template",
      targetId: req.params.id,
      targetName: template ? template.name : req.params.id,
      detail: `删除活动模板：${template ? template.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/governance/overview", requirePermission("trust", "view"), asyncRoute(async (_req, res) => {
    res.json({ overview: await governanceOverview(store) });
  }));

  app.get("/api/governance/identities", requirePermission("trust", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("trustProfiles", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["id", "communityId", "ipMasked", "userAgentSample", "status", "communityLevel"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ profiles: await hydrateTrustProfiles(data), pageInfo });
  }));

  app.get("/api/governance/identities/:id", requirePermission("trust", "view"), asyncRoute(async (req, res) => {
    const detail = await identityDetail(store, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "找不到该社区身份" });
      return;
    }
    const { data: activities } = await store.query("activities", {
      page: 1,
      pageSize: 80,
      maxPageSize: 100,
      filters: [{ field: "anonymousIdentityId", op: "eq", value: detail.profile.id }],
      sort: activitySortRules("created-desc"),
    });
    res.json({ ...detail, activities: await toActivityListPayload(activities) });
  }));

  app.get("/api/governance/trust-policies", requirePermission("trustPolicy", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("trustPolicies", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "eventType", "description"],
      sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
    });
    res.json({ policies: data, pageInfo });
  }));

  app.post("/api/governance/trust-policies", requirePermission("trustPolicy", "create"), asyncRoute(async (req, res) => {
    const input = trustPolicyFromInput(req.body);
    const error = validateTrustPolicy(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const now = new Date().toISOString();
    const policy = {
      id: makeId("trust_policy"),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("trustPolicies", policy);
    await writeLog(req, "governance.trust_policy.create", {
      targetType: "trustPolicy",
      targetId: policy.id,
      targetName: policy.name,
      detail: `新增社区信用策略：${policy.name}`,
    });
    res.json({ policy });
  }));

  app.put("/api/governance/trust-policies/:id", requirePermission("trustPolicy", "edit"), asyncRoute(async (req, res) => {
    const existing = await store.findById("trustPolicies", req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该社区信用策略" });
      return;
    }
    const input = trustPolicyFromInput(req.body, existing);
    const error = validateTrustPolicy(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const updated = await store.update("trustPolicies", existing.id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "governance.trust_policy.update", {
      targetType: "trustPolicy",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存社区信用策略：${updated.name}`,
    });
    res.json({ policy: updated });
  }));

  app.delete("/api/governance/trust-policies/:id", requirePermission("trustPolicy", "delete"), asyncRoute(async (req, res) => {
    const policy = await store.findById("trustPolicies", req.params.id);
    await store.remove("trustPolicies", (item) => item.id === req.params.id);
    await writeLog(req, "governance.trust_policy.delete", {
      targetType: "trustPolicy",
      targetId: req.params.id,
      targetName: policy ? policy.name : req.params.id,
      detail: `删除社区信用策略：${policy ? policy.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/governance/badges", requirePermission("badges", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("communityBadges", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "description", "type"],
      sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
    });
    res.json({ badges: data, pageInfo });
  }));

  app.post("/api/governance/badges", requirePermission("badges", "create"), asyncRoute(async (req, res) => {
    const input = badgeFromInput(req.body);
    const error = validateBadge(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const now = new Date().toISOString();
    const badge = {
      id: makeId("badge"),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("communityBadges", badge);
    await store.insert("badgePolicies", {
      id: makeId("badge_policy"),
      badgeId: badge.id,
      enabled: true,
      publicVisible: false,
      displayLocations: { adminOnly: true },
      showIcon: true,
      showName: true,
      tooltip: badge.description || "",
      order: badge.order,
      createdAt: now,
      updatedAt: now,
    });
    await writeLog(req, "governance.badge.create", {
      targetType: "communityBadge",
      targetId: badge.id,
      targetName: badge.name,
      detail: `新增社区徽章：${badge.name}`,
    });
    res.json({ badge });
  }));

  app.put("/api/governance/badges/:id", requirePermission("badges", "edit"), asyncRoute(async (req, res) => {
    const existing = await store.findById("communityBadges", req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该社区徽章" });
      return;
    }
    const input = badgeFromInput(req.body, existing);
    const error = validateBadge(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const updated = await store.update("communityBadges", existing.id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "governance.badge.update", {
      targetType: "communityBadge",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存社区徽章：${updated.name}`,
    });
    res.json({ badge: updated });
  }));

  app.delete("/api/governance/badges/:id", requirePermission("badges", "delete"), asyncRoute(async (req, res) => {
    const badge = await store.findById("communityBadges", req.params.id);
    await store.remove("communityBadges", (item) => item.id === req.params.id);
    await store.remove("identityBadges", (item) => item.badgeId === req.params.id);
    await store.remove("badgePolicies", (item) => item.badgeId === req.params.id);
    await writeLog(req, "governance.badge.delete", {
      targetType: "communityBadge",
      targetId: req.params.id,
      targetName: badge ? badge.name : req.params.id,
      detail: `删除社区徽章：${badge ? badge.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/governance/badge-policies", requirePermission("badgePolicy", "view"), asyncRoute(async (req, res) => {
    const [badges, { data, pageInfo }] = await Promise.all([
      getCommunityBadges(store, { includeDisabled: true }),
      store.query("badgePolicies", {
        ...pageQueryOptions(req.query),
        sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
      }),
    ]);
    const badgeMap = new Map(badges.map((badge) => [badge.id, badge]));
    res.json({
      policies: data.map((policy) => ({
        ...policy,
        badge: badgeMap.get(policy.badgeId) || null,
      })),
      pageInfo,
    });
  }));

  app.put("/api/governance/badge-policies/:id", requirePermission("badgePolicy", "edit"), asyncRoute(async (req, res) => {
    const existing = await store.findById("badgePolicies", req.params.id);
    if (!existing) {
      res.status(404).json({ error: "找不到该徽章展示策略" });
      return;
    }
    const input = badgePolicyFromInput(req.body, existing);
    const error = validateBadgePolicy(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const updated = await store.update("badgePolicies", existing.id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "governance.badge_policy.update", {
      targetType: "badgePolicy",
      targetId: updated.id,
      targetName: updated.badgeId,
      detail: `保存徽章展示策略：${updated.badgeId}`,
    });
    res.json({ policy: updated });
  }));

  app.get("/api/trust-profiles", requirePermission("trust", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("trustProfiles", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["id", "ipMasked", "userAgentSample"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ profiles: await hydrateTrustProfiles(data), pageInfo });
  }));

  app.get("/api/trust-profiles/:id", requirePermission("trust", "view"), asyncRoute(async (req, res) => {
    const detail = await identityDetail(store, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "找不到该匿名身份" });
      return;
    }
    const [{ data: events }, { data: activities }] = await Promise.all([
      store.query("trustEvents", {
        page: 1,
        pageSize: 100,
        maxPageSize: 100,
        filters: [{ field: "identityId", op: "eq", value: detail.profile.id }],
        sort: [{ field: "createdAt", direction: "desc" }],
      }),
      store.query("activities", {
        page: 1,
        pageSize: 50,
        maxPageSize: 100,
        filters: [{ field: "anonymousIdentityId", op: "eq", value: detail.profile.id }],
        sort: activitySortRules("created-desc"),
      }),
    ]);
    res.json({
      profile: detail.profile,
      events,
      communityEvents: detail.communityEvents,
      badges: detail.badges,
      activities: await toActivityListPayload(activities),
    });
  }));

  app.get("/api/activities", asyncRoute(async (req, res) => {
    const owner = req.query.owner;
    const pending = req.query.pending;
    const all = req.query.all;
    const requestedStatus = cleanText(req.query.status);
    const shouldRunInlineAnalysis = owner === "me"
      || pending === "me"
      || all === "true"
      || requestedStatus === ACTIVITY_STATUS.ANALYSIS_PENDING
      || requestedStatus === "reviewing";
    if (shouldRunInlineAnalysis) {
      await processPendingActivityAnalysisJobs({ limit: 1, reason: "activity-list-inline" });
    } else {
      kickActivityAnalysisQueue("activity-list");
    }
    await sweepExpiredActivities({ force: !owner && !pending && all !== "true", reason: "activity-list" });
    const user = await getCurrentUser(req);
    const filters = [];
    const ownerMode = owner === "me";
    const adminPendingMode = pending === "me" && user && userCan(user, "activities", "review");
    if (ownerMode) {
      // Owner filters are applied after shared filters because anonymous and logged-in ownership are an OR query.
    } else if (pending === "me") {
      if (!user) {
        filters.push(impossibleFilter());
      } else if (userCan(user, "activities", "review")) {
        // Admin pending merges hidden admin review tasks and public admin-attention tasks below.
      } else if (userCan(user, "reviewTasks", "review")) {
        filters.push({ field: "status", op: "eq", value: ACTIVITY_STATUS.COLLABORATOR_REVIEW });
        filters.push({ field: "collaboratorId", op: "eq", value: user.id });
      } else {
        filters.push(impossibleFilter());
      }
    } else if (all === "true") {
      if (!user || !userCan(user, "activities", "view")) {
        res.status(403).json({ error: "当前角色没有查看全部活动的权限" });
        return;
      }
    } else {
      const view = cleanText(req.query.view || (req.query.history === "true" ? "history" : "upcoming"));
      filters.push({
        field: "status",
        op: "in",
        value: view === "history" ? HISTORY_ACTIVITY_STATUSES : UPCOMING_ACTIVITY_STATUSES,
      });
    }

    const keyword = cleanText(req.query.q).toLowerCase();
    const status = requestedStatus;
    const moduleId = cleanText(req.query.moduleId);
    const seriesId = cleanText(req.query.seriesId);
    const sourceType = cleanText(req.query.sourceType);
    const publicView = cleanText(req.query.view || (req.query.history === "true" ? "history" : "upcoming"));
    const defaultSort = owner || pending || all
      ? "created-desc"
      : publicView === "history"
        ? "start-desc"
        : "start-asc";
    if (status === "reviewing") {
      filters.push({ field: "status", op: "in", value: [ACTIVITY_STATUS.ANALYSIS_PENDING, ACTIVITY_STATUS.ADMIN_REVIEW, ACTIVITY_STATUS.COLLABORATOR_REVIEW] });
    } else if (status === "published_group") {
      filters.push({ field: "status", op: "in", value: [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL] });
    } else if (status) {
      filters.push({ field: "status", op: "eq", value: status });
    }
    if (moduleId) filters.push({ field: "moduleId", op: "eq", value: moduleId });
    if (seriesId) filters.push({ field: "seriesId", op: "eq", value: seriesId });
    const sourceTypePostFilter = sourceType === "living_room" ? "living_room" : "";
    if (sourceType === "friend") filters.push({ field: "sourceType", op: "eq", value: "friend" });
    filters.push(...activityDateFilters(req.query));

    if (adminPendingMode) {
      const { page, pageSize } = parsePagination(req.query);
      const candidateLimit = Math.min(Math.max(page * pageSize, pageSize), 1000);
      const pendingFilterSets = [
        [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW }],
        [
          { field: "status", op: "eq", value: ACTIVITY_STATUS.PUBLISHED },
          { field: "reviewFlag", op: "eq", value: "admin_attention" },
        ],
      ];
      const pendingResults = await Promise.all(pendingFilterSets.map((pendingFilters) => store.query("activities", {
        page: 1,
        pageSize: candidateLimit,
        maxPageSize: candidateLimit,
        filters: [...filters, ...pendingFilters],
        keyword,
        keywordFields: ["title", "initiator", "location", "description"],
        sort: activitySortRules(req.query.sort || defaultSort),
      })));
      const merged = dedupeById(pendingResults.flatMap((result) => result.data || []))
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
      const total = pendingResults.reduce((sum, result) => sum + Number(result.pageInfo?.total || 0), 0);
      const start = (page - 1) * pageSize;
      const visible = merged.slice(start, start + pageSize);
      res.json({
        activities: await toActivityListPayload(visible, { req, user }),
        pageInfo: {
          page,
          pageSize,
          total,
          totalPages: Math.max(Math.ceil(total / pageSize), 1),
          hasMore: start + visible.length < total,
        },
      });
      return;
    }

    if (ownerMode) {
      const { page, pageSize } = parsePagination(req.query);
      const sort = activitySortRules(req.query.sort || defaultSort);
      const listOptions = {
        page,
        pageSize,
        keyword,
        keywordFields: ["title", "initiator", "location", "description"],
        sort,
        filters,
      };
      const { data: visible, pageInfo } = await ownedActivityPageForRequest(req, user, listOptions);
      res.json({
        activities: await toActivityListPayload(visible, { req, user }),
        pageInfo,
      });
      return;
    }

    const { data: activities, pageInfo } = await store.query("activities", {
      ...pageQueryOptions(req.query),
      filters,
      keyword,
      keywordFields: ["title", "initiator", "location", "description"],
      sort: activitySortRules(req.query.sort || defaultSort),
    });
    const sourceFilteredActivities = sourceTypePostFilter
      ? activities.filter((activity) => !activity.sourceType || activity.sourceType === "living_room")
      : activities;
    const visibleActivities = (!owner && !pending && all !== "true")
      ? sourceFilteredActivities.filter((activity) => !activity.isHidden)
      : sourceFilteredActivities;
    res.json({ activities: await toActivityListPayload(visibleActivities, { req, user }), pageInfo });
  }));

  app.get("/api/activities/:id", asyncRoute(async (req, res) => {
    await sweepExpiredActivities({ reason: "activity-detail" });
    const user = await getCurrentUser(req);
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canSeeActivity(activity, user, req)) {
      res.status(403).json({ error: "这个活动还没有公开发布" });
      return;
    }
    res.json({ activity: await toActivityPayload(activity, { req, user }) });
  }));

  app.get("/api/activities/:id/recap", asyncRoute(async (req, res) => {
    const user = await getCurrentUser(req);
    req.currentUser = user;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canManageActivity(activity, user, req)) {
      res.status(403).json({ error: "只有活动发起人、共同发起人或管理员可以查看活动复盘" });
      return;
    }
    res.json(await activityRecapPayload(activity, { req, user }));
  }));

  app.get("/api/activities/:id/confidence", requirePermission("activities", "view"), asyncRoute(async (req, res) => {
    let activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (activity.status === ACTIVITY_STATUS.ANALYSIS_PENDING) {
      await processPendingActivityAnalysisJobs({ limit: 1, reason: "confidence-view" });
      activity = normalizeActivity(await store.findById("activities", req.params.id)) || activity;
    }
    const [{ data: reports }, { data: analyses }] = await Promise.all([
      store.query("communityReports", {
        page: 1,
        pageSize: 100,
        maxPageSize: 100,
        filters: [{ field: "activityId", op: "eq", value: activity.id }],
        sort: [{ field: "createdAt", direction: "desc" }],
      }),
      store.query("analysisReports", {
        page: 1,
        pageSize: 20,
        maxPageSize: 50,
        filters: [{ field: "activityId", op: "eq", value: activity.id }],
        sort: [{ field: "createdAt", direction: "desc" }],
      }),
    ]);
    const reportAnalysisMap = await loadRecordsByIds("analysisReports", reports.map((report) => report.analysisReportId));
    const reportsWithAnalysis = reports.map((report) => ({
      ...report,
      analysisReport: reportAnalysisMap.get(report.analysisReportId) || null,
    }));
    const trustProfile = activity.anonymousIdentityId ? await store.findById("trustProfiles", activity.anonymousIdentityId) : null;
    res.json({
      activity: await toActivityPayload(activity, { req }),
      trustProfile,
      reports: reportsWithAnalysis,
      analyses,
      latestAnalysis: analyses[0] || null,
    });
  }));

  app.get("/api/reports", requirePermission("reports", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data, pageInfo } = await store.query("communityReports", {
      ...pageQueryOptions(req.query),
      filters: reportFilters(req.query),
      keyword,
      keywordFields: ["reason", "detail", "status", "activityId", "activityTitle", "identityId"],
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    res.json({ reports: await toReportListPayload(data), pageInfo });
  }));

  app.get("/api/my/registrations", asyncRoute(async (req, res) => {
    const { data, pageInfo } = await identityOwnedRecordPage("registrations", "identityId", req, {
      ...pageQueryOptions(req.query),
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    const activityMap = await loadRecordsByIds("activities", data.map((item) => item.activityId));
    const registrations = data
      .map((registration) => {
        const activity = activityMap.get(registration.activityId);
        if (!activity) return null;
        return {
          ...publicRegistration(registration),
          activity: {
            id: activity.id,
            title: activity.title,
            location: activity.location,
            startsAt: activity.startsAt,
            endsAt: activity.endsAt,
            status: activity.status,
            statusLabel: statusLabel(activity.status),
            moduleId: activity.moduleId,
          },
        };
      })
      .filter(Boolean);
    res.json({ registrations, pageInfo });
  }));

  app.get("/api/my/feedbacks", asyncRoute(async (req, res) => {
    const { data, pageInfo } = await identityOwnedRecordPage("activityFeedbacks", "identityId", req, {
      ...pageQueryOptions(req.query),
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    res.json({ feedbacks: await toFeedbackListPayload(data, { req }), pageInfo });
  }));

  app.get("/api/feedbacks/export", requirePermission("feedbacks", "export"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data } = await store.query("activityFeedbacks", {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      filters: feedbackFilters(req.query),
      keyword,
      keywordFields: ["favorite", "improvement", "other", "activityTitle", "status", "aiReason"],
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    const feedbacks = await toFeedbackListPayload(data, { req });
    const rows = [
      ["活动标题", "活动状态", "反馈状态", "最喜欢的地方", "可以改进的地方", "其他想说的", "AI 状态", "AI 说明", "展示权重", "提交时间"],
      ...feedbacks.map((feedback) => [
        feedback.activityTitle,
        feedback.activityStatusLabel,
        feedback.statusLabel,
        feedback.favorite,
        feedback.improvement,
        feedback.other,
        feedback.aiStatus,
        feedback.aiReason,
        feedback.feedbackWeight,
        feedback.createdAt,
      ]),
    ];
    await writeLog(req, "activity.feedback.export", {
      targetType: "activityFeedback",
      targetId: "feedback-export",
      targetName: "活动反馈导出",
      detail: `导出活动反馈 CSV：${feedbacks.length} 条`,
    });
    csvResponse(res, `youkong-activity-feedbacks-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }));

  app.get("/api/feedbacks", requirePermission("feedbacks", "view"), asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data, pageInfo } = await store.query("activityFeedbacks", {
      ...pageQueryOptions(req.query),
      filters: feedbackFilters(req.query),
      keyword,
      keywordFields: ["favorite", "improvement", "other", "activityTitle", "status", "aiReason", "identityId"],
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    res.json({ feedbacks: await toFeedbackListPayload(data, { req }), pageInfo });
  }));

  app.post("/api/feedbacks/:id/review", requirePermission("feedbacks", "review"), asyncRoute(async (req, res) => {
    const feedback = await store.findById("activityFeedbacks", req.params.id);
    if (!feedback) {
      res.status(404).json({ error: "找不到该活动反馈" });
      return;
    }
    const action = cleanText(req.body.action);
    if (!["approve", "reject"].includes(action)) {
      res.status(400).json({ error: "请选择展示或不展示" });
      return;
    }
    const now = new Date().toISOString();
    const updated = await store.update("activityFeedbacks", feedback.id, {
      status: action === "approve" ? FEEDBACK_STATUS.APPROVED : FEEDBACK_STATUS.REJECTED,
      reviewedAt: now,
      reviewedBy: req.currentUser.id,
      updatedAt: now,
    });
    await syncActivityFeedbackCounts(feedback.activityId);
    await writeLog(req, "activity.feedback.review", {
      targetType: "activityFeedback",
      targetId: feedback.id,
      targetName: feedback.activityTitle || feedback.activityId,
      detail: `${action === "approve" ? "展示" : "不展示"}活动反馈：${feedback.activityTitle || feedback.activityId}`,
    });
    res.json({ feedback: publicActivityFeedback(updated, { includeAnalysis: true }) });
  }));

  app.post("/api/activities/:id/feedbacks/:feedbackId/review", asyncRoute(async (req, res) => {
    const user = await getCurrentUser(req);
    req.currentUser = user;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canManageActivity(activity, user, req)) {
      res.status(403).json({ error: "只有活动发起人或管理员可以处理活动反馈" });
      return;
    }
    const feedback = await store.findById("activityFeedbacks", req.params.feedbackId);
    if (!feedback || feedback.activityId !== activity.id) {
      res.status(404).json({ error: "找不到该活动反馈" });
      return;
    }
    const action = cleanText(req.body.action);
    if (!["approve", "reject"].includes(action)) {
      res.status(400).json({ error: "请选择展示或不展示" });
      return;
    }
    const canAdminReviewFeedback = userCan(user, "feedbacks", "review");
    if (action === "approve" && !canAdminReviewFeedback && (
      feedback.status !== FEEDBACK_STATUS.REJECTED
      || feedback.ownerHiddenPreviousStatus !== FEEDBACK_STATUS.APPROVED
    )) {
      res.status(403).json({ error: "待审核反馈需要管理员复核后才能展示" });
      return;
    }
    const now = new Date().toISOString();
    const updated = await store.update("activityFeedbacks", feedback.id, {
      status: action === "approve" ? FEEDBACK_STATUS.APPROVED : FEEDBACK_STATUS.REJECTED,
      ownerHiddenPreviousStatus: action === "reject" ? feedback.status || "" : "",
      reviewedAt: now,
      reviewedBy: user?.id || activity.id,
      updatedAt: now,
    });
    await syncActivityFeedbackCounts(feedback.activityId);
    await writeLog(req, "activity.feedback.review", {
      actorName: user?.nickname || activity.initiator || "活动发起人",
      targetType: "activityFeedback",
      targetId: feedback.id,
      targetName: feedback.activityTitle || activity.title,
      detail: `${action === "approve" ? "恢复展示" : "隐藏"}活动反馈：${feedback.activityTitle || activity.title}`,
    });
    res.json({
      feedback: publicActivityFeedback(updated, { includeAnalysis: true }),
      activity: await toActivityPayload(activity, { req, user }),
    });
  }));

  app.get("/api/activities/:id/feedbacks", asyncRoute(async (req, res) => {
    const user = await getCurrentUser(req);
    req.currentUser = user;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    const manage = req.query.manage === "true";
    if (manage && !canManageActivity(activity, user, req)) {
      res.status(403).json({ error: "只有活动发起人或管理员可以查看反馈详情" });
      return;
    }
    if (!manage && !canSeeActivity(activity, user, req)) {
      res.status(403).json({ error: "这个活动还没有公开发布" });
      return;
    }
    const { data, pageInfo } = await store.query("activityFeedbacks", {
      ...pageQueryOptions(req.query),
      filters: manage
        ? [{ field: "activityId", op: "eq", value: activity.id }]
        : [
          { field: "activityId", op: "eq", value: activity.id },
          { field: "status", op: "eq", value: FEEDBACK_STATUS.APPROVED },
        ],
      sort: [{ field: "feedbackWeight", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({
      activity: await toActivityPayload(activity, { req }),
      feedbacks: manage
        ? await toFeedbackListPayload(data, { req })
        : data.map((item) => publicActivityFeedback(item)),
      pageInfo,
    });
  }));

  app.post("/api/activities/:id/feedbacks", registrationRateLimiter, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!PUBLIC_ACTIVITY_STATUSES.includes(activity.status) || activity.isHidden) {
      res.status(400).json({ error: "活动公开后才可以提交活动反馈" });
      return;
    }
    if (!hasActivityStarted(activity)) {
      res.status(400).json({ error: "活动开始后再来写反馈，会更像真实经历。" });
      return;
    }
    const input = parseActivityFeedbackInput(req.body);
    const error = validateActivityFeedbackInput(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const context = await identityNetworkContextForRequest(req);
    const identity = context.identity;
    const feedbackId = makeActivityFeedbackId(activity.id, identitySubjectKey(context));
    const existing = await findExistingIdentityScopedRecord("activityFeedbacks", activity.id, context)
      || await store.findById("activityFeedbacks", feedbackId);
    if (existing) {
      res.json({ ok: true, existing: true, feedback: publicActivityFeedback(existing) });
      return;
    }
    const module = activity.moduleId ? await store.findById("modules", activity.moduleId) : null;
    const friend = activity.friendId ? await store.findById("livingRoomFriends", activity.friendId) : null;
    const source = activitySourcePayload(activity, friend);
    const now = new Date().toISOString();
    const feedback = {
      id: feedbackId,
      activityId: activity.id,
      activityTitle: activity.title,
      identityId: identity.id,
      identityNetworkId: context.network?.id || "",
      identitySnapshot: publicIdentity(identity),
      favorite: input.favorite,
      improvement: input.improvement,
      other: input.other,
      status: FEEDBACK_STATUS.ADMIN_REVIEW,
      feedbackWeight: 0,
      sourceType: source.sourceType,
      sourceName: source.sourceName,
      aiStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const classified = await analyzeAndClassifyFeedback({ ...activity, ...source }, feedback, module?.name || "");
    const finalFeedback = {
      ...feedback,
      ...classified,
      updatedAt: new Date().toISOString(),
    };
    const inserted = await store.insertUnique("activityFeedbacks", finalFeedback, "id");
    if (!inserted.inserted) {
      res.json({ ok: true, existing: true, feedback: publicActivityFeedback(inserted.item) });
      return;
    }
    await syncActivityFeedbackCounts(activity.id);
    await writeLog(req, "activity.feedback.create", {
      actorName: "匿名反馈",
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `提交活动反馈：${activity.title}（${feedbackStatusLabel(finalFeedback.status)}）`,
    });
    res.json({
      ok: true,
      existing: false,
      feedback: publicActivityFeedback(finalFeedback),
      activity: await toActivityPayload(activity, { req }),
    });
  }));

  app.post("/api/activities/:id/reanalyze", requirePermission("activities", "reanalyze"), asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    const identity = activity.anonymousIdentityId
      ? { id: activity.anonymousIdentityId, ipMasked: activity.trustSnapshot?.ipMasked || "", userAgentSample: "" }
      : requestIdentity(req);
    const safetyConfig = await getSafetyConfig(store);
    const trustProfile = activity.anonymousIdentityId
      ? await store.findById("trustProfiles", activity.anonymousIdentityId)
      : null;
    const identityActivityTotal = activity.anonymousIdentityId
      ? await countRecords("activities", [{ field: "anonymousIdentityId", op: "eq", value: activity.anonymousIdentityId }])
      : 0;
    const context = await buildActivityAnalysisContext(store, activity, {
      identity,
      trustProfile,
      safetyConfig,
      intent: "submit",
      manual: true,
      forceAi: true,
      bypassCache: true,
      activityId: activity.id,
      identityActivityCount: Math.max(0, identityActivityTotal - 1),
      activityNumber: Math.max(1, identityActivityTotal),
    });
    const analysis = await analyzeActivitySafety(store, activity, context);
    const analysisReport = await storeAnalysisReport(store, activity.id, analysis, context);
    const { updated } = await applyActivityAnalysisResult(activity, analysis, analysisReport, context);
    await writeLog(req, "activity.reanalyze", {
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `强制重新分析活动置信度：${activity.title}（风险分 ${updated.riskScore}，AI ${analysis.aiReport ? "已调用" : "未返回结果"}）`,
    });
    res.json({ activity: await toActivityPayload(updated), analysis: analysisReport });
  }));

  app.post("/api/activities/:id/reports", asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!PUBLIC_ACTIVITY_STATUSES.includes(activity.status) || activity.isHidden) {
      res.status(400).json({ error: "活动公开后才可以提交社区反馈" });
      return;
    }
    const reason = cleanText(req.body.reason);
    const detail = cleanText(req.body.detail);
    const allowedReasons = new Set(["广告营销", "虚假活动", "违法违规", "人身攻击", "其他"]);
    if (!allowedReasons.has(reason)) {
      res.status(400).json({ error: "请选择有效的举报原因" });
      return;
    }
    const lengthError = validateTextLength("举报原因", reason, TEXT_LIMITS.reportReason)
      || validateTextLength("补充说明", detail, TEXT_LIMITS.reportDetail);
    if (lengthError) {
      res.status(400).json({ error: lengthError });
      return;
    }
    const submitted = await submitCommunityReport(store, req, activity, reason, detail);
    if (!submitted.ok) {
      res.status(submitted.statusCode || 400).json({ error: submitted.error || "暂时不能提交反馈" });
      return;
    }
    const reportCount = await countRecords("communityReports", [{ field: "activityId", op: "eq", value: activity.id }]);
    const reportSafetyConfig = submitted.context?.safetyConfig || await getSafetyConfig(store);
    let updated = await store.update("activities", activity.id, {
      reportCount,
      reportWarning: reportCount >= Number(reportSafetyConfig.report?.warningThreshold || 2),
      updatedAt: new Date().toISOString(),
    }) || activity;
    let reportReview = null;
    if (!submitted.existing) {
      reportReview = await analyzeCommunityReport(activity, submitted.report, submitted.context || {});
      updated = reportReview.activity || updated;
    }
    await writeLog(req, "activity.report", {
      actorName: "社区访客",
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `社区反馈：${activity.title} / ${reason}`,
    });
    res.json({
      ok: true,
      existing: Boolean(submitted.existing),
      reportCount,
      report: reportReview?.report || submitted.report,
      reportReview: reportReview?.substantiation || null,
      activity: await toActivityPayload(updated),
    });
  }));

  app.get("/api/co-initiator-invites/:token", asyncRoute(async (req, res) => {
    const token = cleanText(req.params.token);
    const tokenHash = hashCoInitiatorInviteToken(token);
    const invite = await store.findByFilters("activityCoInitiatorInvites", [{ field: "tokenHash", op: "eq", value: tokenHash }]);
    if (!invite) {
      res.status(404).json({ error: "邀请链接不存在或已经失效" });
      return;
    }
    if (invite.status !== "pending" || (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now())) {
      if (invite.status === "pending") {
        await store.update("activityCoInitiatorInvites", invite.id, { status: "expired", updatedAt: new Date().toISOString() });
      }
      res.status(410).json({ error: "邀请链接已经失效，请让主发起人重新生成" });
      return;
    }
    const activity = normalizeActivity(await store.findById("activities", invite.activityId));
    if (!activity) {
      res.status(404).json({ error: "邀请对应的活动不存在" });
      return;
    }
    const context = await identityNetworkContextForRequest(req);
    const inviterProfileId = invite.createdByNetworkId || invite.createdByIdentityId || "";
    const inviterProfile = inviterProfileId
      ? await identityProfileById(inviterProfileId, { fallbackName: activity.initiator })
      : null;
    const myProfile = await identityProfileById(context.profileId || context.identity.id);
    res.json({
      invite: {
        id: invite.id,
        role: invite.role || CO_INITIATOR_ROLE,
        roleLabel: "共同发起人",
        expiresAt: invite.expiresAt,
      },
      inviterProfile,
      myProfile,
      activity: await toActivityPayload(activity, { req }),
    });
  }));

  app.post("/api/co-initiator-invites/:token/accept", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const token = cleanText(req.params.token);
    const tokenHash = hashCoInitiatorInviteToken(token);
    const context = await identityNetworkContextForRequest(req);
    const identity = context.identity;
    const coProfileId = context.profileId || identity.id;
    const profileRecord = await store.findById("identityProfiles", coProfileId);
    if (!profileRecord?.displayName) {
      res.status(400).json({
        code: "profile_required",
        error: "接受共同发起人邀请前，请先完善公开资料昵称。",
      });
      return;
    }
    const updated = await withMutationLock(`co-invite:${tokenHash}`, async () => {
      const invite = await store.findByFilters("activityCoInitiatorInvites", [{ field: "tokenHash", op: "eq", value: tokenHash }]);
      if (!invite) {
        throw Object.assign(new Error("邀请链接不存在或已经失效"), { statusCode: 404 });
      }
      if (invite.status !== "pending" || (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now())) {
        if (invite.status === "pending") {
          await store.update("activityCoInitiatorInvites", invite.id, { status: "expired", updatedAt: new Date().toISOString() });
        }
        throw Object.assign(new Error("邀请链接已经失效，请让主发起人重新生成"), { statusCode: 410 });
      }
      const activity = normalizeActivity(await store.findById("activities", invite.activityId));
      if (!activity) {
        throw Object.assign(new Error("邀请对应的活动不存在"), { statusCode: 404 });
      }
      if (activity.anonymousIdentityId === identity.id || (context.network?.id && activity.identityNetworkId === context.network.id)) {
        throw Object.assign(new Error("主发起人不需要接受自己的共同发起人邀请"), { statusCode: 400 });
      }
      const now = new Date().toISOString();
      const coSubjectId = context.network?.id || identity.id;
      const coRecord = {
        id: makeCoInitiatorId(activity.id, coSubjectId),
        activityId: activity.id,
        identityId: identity.id,
        identityNetworkId: context.network?.id || "",
        role: invite.role || CO_INITIATOR_ROLE,
        status: "active",
        invitedByIdentityId: invite.createdByIdentityId || "",
        inviteId: invite.id,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const existingCoRecord = (context.network?.id
        ? await store.findByFilters("activityCoInitiators", [
          { field: "activityId", op: "eq", value: activity.id },
          { field: "identityNetworkId", op: "eq", value: context.network.id },
          { field: "status", op: "eq", value: "active" },
        ])
        : null) || await store.findById("activityCoInitiators", coRecord.id);
      if (existingCoRecord) {
        await store.update("activityCoInitiators", existingCoRecord.id, {
          ...coRecord,
          createdAt: existingCoRecord.createdAt || now,
        });
      } else {
        await store.insert("activityCoInitiators", coRecord);
      }
      const ids = Array.from(new Set([
        ...(Array.isArray(activity.coInitiatorIdentityIds) ? activity.coInitiatorIdentityIds : []),
        identity.id,
      ].map(cleanText).filter(Boolean)));
      const networkIds = Array.from(new Set([
        ...(Array.isArray(activity.coInitiatorNetworkIds) ? activity.coInitiatorNetworkIds : []),
        ...(context.network?.id ? [context.network.id] : []),
      ].map(cleanText).filter(Boolean)));
      const savedActivity = await store.update("activities", activity.id, {
        coInitiatorIdentityIds: ids,
        coInitiatorNetworkIds: networkIds,
        activityVersion: normalizeActivityVersion(activity) + 1,
        updatedAt: now,
      }) || { ...activity, coInitiatorIdentityIds: ids, coInitiatorNetworkIds: networkIds };
      await store.update("activityCoInitiatorInvites", invite.id, {
        status: "accepted",
        acceptedByIdentityId: identity.id,
        acceptedAt: now,
        updatedAt: now,
      });
      return savedActivity;
    });
    await writeLog(req, "activity.coinitiator.accept", {
      actorName: profileRecord.displayName,
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `${profileRecord.displayName} 接受共同发起人邀请：${updated.title}`,
    });
    res.json({ ok: true, activity: await toActivityPayload(updated, { req }) });
  }));

  app.post("/api/activities/:id/co-initiator-invites", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const context = await identityNetworkContextForRequest(req);
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canManageCoInitiators(activity, currentUser, req)) {
      res.status(403).json({ error: "只有主发起人可以邀请共同发起人" });
      return;
    }
    if (isActivityTerminal(activity)) {
      res.status(400).json({ error: "已结束、取消或拒绝的活动不能再邀请共同发起人" });
      return;
    }
    const token = makeAccessToken();
    const now = new Date();
    const invite = {
      id: makeId("co_invite"),
      activityId: activity.id,
      tokenHash: hashCoInitiatorInviteToken(token),
      role: CO_INITIATOR_ROLE,
      status: "pending",
      createdByIdentityId: context.identity.id,
      createdByNetworkId: context.network?.id || "",
      createdByUserId: currentUser?.id || "",
      expiresAt: new Date(now.getTime() + CO_INITIATOR_INVITE_MAX_AGE_MS).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await store.insert("activityCoInitiatorInvites", invite);
    const origin = /^https?:\/\//.test(req.get("origin") || "") ? req.get("origin") : apiPublicBaseUrl(req);
    const invitePath = `co-initiator-invite.html?token=${encodeURIComponent(token)}`;
    await writeLog(req, "activity.coinitiator.invite", {
      actorName: currentUser?.nickname || activity.initiator || "主发起人",
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `生成共同发起人邀请：${activity.title}`,
    });
    res.json({
      invite: {
        id: invite.id,
        expiresAt: invite.expiresAt,
        invitePath,
        inviteUrl: `${origin.replace(/\/$/, "")}/${invitePath}`,
      },
    });
  }));

  app.delete("/api/activities/:id/co-initiators/:identityId", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canManageCoInitiators(activity, currentUser, req)) {
      res.status(403).json({ error: "只有主发起人可以移除共同发起人" });
      return;
    }
    const identityId = cleanText(req.params.identityId);
    const activeRecords = await activeCoInitiatorsForActivity(activity.id);
    const record = activeRecords.find((item) =>
      item.identityId === identityId || (item.identityNetworkId && item.identityNetworkId === identityId));
    const hasLegacyArrayEntry = coInitiatorIdentityIds(activity).includes(identityId);
    if (!record && !hasLegacyArrayEntry) {
      res.status(404).json({ error: "找不到该共同发起人" });
      return;
    }
    const now = new Date().toISOString();
    if (record) {
      await store.update("activityCoInitiators", record.id, {
        status: "removed",
        removedByIdentityId: requestIdentityId(req),
        removedByUserId: currentUser?.id || "",
        removedAt: now,
        updatedAt: now,
      });
    }
    const removedIdentityIds = new Set([identityId, record?.identityId].filter(Boolean));
    const removedNetworkIds = new Set([identityId, record?.identityNetworkId].filter(Boolean));
    const ids = (Array.isArray(activity.coInitiatorIdentityIds) ? activity.coInitiatorIdentityIds : [])
      .filter((id) => !removedIdentityIds.has(id));
    const networkIds = (Array.isArray(activity.coInitiatorNetworkIds) ? activity.coInitiatorNetworkIds : [])
      .filter((id) => !removedNetworkIds.has(id));
    const updated = await store.update("activities", activity.id, {
      coInitiatorIdentityIds: ids,
      coInitiatorNetworkIds: networkIds,
      activityVersion: normalizeActivityVersion(activity) + 1,
      updatedAt: now,
    }) || { ...activity, coInitiatorIdentityIds: ids, coInitiatorNetworkIds: networkIds };
    await writeLog(req, "activity.coinitiator.remove", {
      actorName: currentUser?.nickname || activity.initiator || "主发起人",
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `移除共同发起人：${activity.title}`,
    });
    res.json({ activity: await toActivityPayload(updated, { req, user: currentUser }) });
  }));

  app.post("/api/activities/:id/edit-lock", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const updated = await withMutationLock(`activity-lock:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if (!canEditActivity(activity, currentUser, req)) {
        throw Object.assign(new Error("当前状态下不能编辑这个活动"), { statusCode: 403 });
      }
      const lock = activeEditLock(activity);
      const identityId = requestIdentityId(req);
      const sameEditor = lock && identityId && lock.lockedByIdentityId === identityId;
      if (lock && !sameEditor && req.body?.takeover !== true && req.body?.takeover !== "true") {
        throw Object.assign(new Error(`${lock.lockedByName || "另一位共同发起人"} 正在编辑这个活动。`), {
          statusCode: 423,
          data: { lock: publicEditLock(lock) },
        });
      }
      const issued = await issueActivityEditLock(activity, req, currentUser);
      const saved = await store.update("activities", activity.id, {
        editLock: issued.lock,
      }) || { ...activity, editLock: issued.lock };
      return { activity: saved, token: issued.token, lock: issued.lock };
    });
    res.json({
      editLockToken: updated.token,
      lock: publicEditLock(updated.lock),
      activityVersion: normalizeActivityVersion(updated.activity),
    });
  }));

  app.post("/api/activities/:id/edit-lock/refresh", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canEditActivity(activity, currentUser, req)) {
      res.status(403).json({ error: "当前状态下不能编辑这个活动" });
      return;
    }
    if (!editLockMatches(activity, getEditLockToken(req))) {
      const lock = activeEditLock(activity);
      res.status(423).json({ error: `${lock?.lockedByName || "另一位共同发起人"} 正在编辑这个活动。`, lock: publicEditLock(lock) });
      return;
    }
    const lock = {
      ...activity.editLock,
      expiresAt: new Date(Date.now() + ACTIVITY_EDIT_LOCK_TTL_MS).toISOString(),
    };
    await store.update("activities", activity.id, { editLock: lock });
    res.json({ lock: publicEditLock(lock), activityVersion: normalizeActivityVersion(activity) });
  }));

  app.delete("/api/activities/:id/edit-lock", asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!activeEditLock(activity)) {
      res.json({ ok: true });
      return;
    }
    if (!(currentUser && userCan(currentUser, "activities", "edit")) && !editLockMatches(activity, getEditLockToken(req))) {
      res.status(423).json({ error: "不能释放其他人的编辑锁", lock: publicEditLock(activeEditLock(activity)) });
      return;
    }
    await store.update("activities", activity.id, { editLock: null });
    res.json({ ok: true });
  }));

  app.post("/api/activities", activityMutationRateLimiter, upload.single("cover"), asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const input = parseActivityInput(req.body, currentUser?.nickname || "", currentUser?.phone || "");
    const intent = req.body.intent === "draft" ? "draft" : "submit";
    const asDraft = intent === "draft";
    const error = await validateActivityInput(input, "", { asDraft });
    if (error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error });
      return;
    }

    const now = new Date().toISOString();
    const activityId = makeId("activity");
    const identityContext = await identityNetworkContextForRequest(req);
    const prepared = asDraft
      ? { ok: true, context: { identity: identityContext.identity } }
      : await prepareActivitySubmissionGate(store, req, input, { intent, activityId });
    if (!prepared.ok) {
      await removeUploadedFile(req.file);
      res.status(prepared.statusCode || 400).json({ error: prepared.error || "活动暂时不能发布，请稍后再试" });
      return;
    }
    const issuedManageToken = issueManageToken(activityId, prepared.context.identity);
    const manageToken = issuedManageToken.token;
    let coverUrl = "";
    let coverFileId = "";
    if (req.file) {
      await assertUploadedImage(req.file);
      const uploaded = await store.saveUpload(req.file);
      coverUrl = uploaded.url;
      coverFileId = uploaded.fileId;
    }

    const activity = {
      id: activityId,
      title: input.title,
      moduleId: input.moduleId,
      initiator: input.initiator,
      showInitiatorContact: input.showInitiatorContact,
      initiatorContact: input.initiatorContact,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location,
      capacity: input.capacity,
      showRegistrationNames: input.showRegistrationNames,
      showFeedbacks: input.showFeedbacks,
      sourceType: input.sourceType,
      friendId: input.friendId,
      seriesId: input.seriesId,
      minRegistrationEnabled: input.minRegistrationEnabled,
      minRegistrationCount: input.minRegistrationEnabled ? input.minRegistrationCount : 0,
      registrationDeadline: input.minRegistrationEnabled ? input.registrationDeadline : input.startsAt,
      description: input.description,
      collaboratorId: input.collaboratorId,
      coverUrl,
      coverFileId,
      registrationCount: 0,
      interestCount: 0,
      status: asDraft ? ACTIVITY_STATUS.DRAFT : ACTIVITY_STATUS.ANALYSIS_PENDING,
      reviewStep: asDraft ? "" : "analysis",
      reviewLogs: [],
      createdBy: currentUser?.id || "",
      createdByType: currentUser ? "user" : "anonymous",
      anonymousIdentityId: prepared.context.identity.id,
      identityNetworkId: identityContext.network?.id || "",
      coInitiatorIdentityIds: [],
      manageTokenHash: issuedManageToken.manageTokenHash,
      manageTokenCreatedAt: issuedManageToken.manageTokenCreatedAt,
      manageTokenExpiresAt: issuedManageToken.manageTokenExpiresAt,
      manageTokenClientIdHash: issuedManageToken.manageTokenClientIdHash,
      manageTokenServerIdHash: issuedManageToken.manageTokenServerIdHash,
      manageTokenFingerprintHash: issuedManageToken.manageTokenFingerprintHash,
      analysisStatus: asDraft ? "draft" : "pending",
      analysisVersion: 1,
      activityVersion: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: "",
    };
    await store.insert("activities", activity);
    if (!asDraft) {
      await enqueueActivityAnalysis(activity, "submit");
    }
    const submitAction = asDraft ? "activity.create_draft" : "activity.create_submit";
    await writeLog(req, submitAction, {
      actorName: currentUser?.nickname || input.initiator || "匿名发起人",
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: asDraft
        ? `保存活动草稿：${activity.title}`
        : `发起活动：${activity.title}（已进入安全分析）`,
    });
    if (!asDraft) {
      await writeSystemLog("activity.analysis.pending", {
        targetType: "activity",
        targetId: activity.id,
        targetName: activity.title,
        detail: `活动进入安全分析队列：${activity.title}`,
      });
    }
    res.json({
      activity: await toActivityPayload(activity, { req, user: currentUser }),
      manageToken,
      policy: { action: asDraft ? "draft" : "analysis_pending", status: activity.status, reviewStep: activity.reviewStep },
    });
  }));

  const updateActivityHandler = asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      await removeUploadedFile(req.file);
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canEditActivity(activity, currentUser, req)) {
      await removeUploadedFile(req.file);
      res.status(403).json({ error: "当前状态下不能编辑这个活动" });
      return;
    }
    try {
      assertActivityEditLock(activity, req, currentUser);
    } catch (error) {
      await removeUploadedFile(req.file);
      throw error;
    }

    const input = parseActivityInput(req.body, activity.initiator, currentUser?.phone || activity.initiatorContact || "");
    const intent = req.body.intent === "draft" ? "draft" : "submit";
    const asDraft = intent === "draft";
    const error = await validateActivityInput(input, activity.id, { asDraft });
    if (error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error });
      return;
    }
    const prepared = asDraft
      ? { ok: true }
      : await prepareActivitySubmissionGate(store, req, input, { intent, activityId: activity.id });
    if (!prepared.ok) {
      await removeUploadedFile(req.file);
      res.status(prepared.statusCode || 400).json({ error: prepared.error || "活动暂时不能发布，请稍后再试" });
      return;
    }

    let coverUrl = activity.coverUrl || "";
    let coverFileId = activity.coverFileId || "";
    if (req.file) {
      await assertUploadedImage(req.file);
      const uploaded = await store.saveUpload(req.file);
      coverUrl = uploaded.url;
      coverFileId = uploaded.fileId;
    }

    const nextActivityVersion = normalizeActivityVersion(activity) + 1;
    const nextAnalysisVersion = asDraft ? Number(activity.analysisVersion || 1) : Number(activity.analysisVersion || 1) + 1;
    const requestNetworkId = requestIdentityNetworkId(req);
    const updated = await store.update("activities", activity.id, {
      title: input.title,
      moduleId: input.moduleId,
      initiator: input.initiator,
      showInitiatorContact: input.showInitiatorContact,
      initiatorContact: input.initiatorContact,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location,
      capacity: input.capacity,
      showRegistrationNames: input.showRegistrationNames,
      showFeedbacks: input.showFeedbacks,
      sourceType: input.sourceType,
      friendId: input.friendId,
      seriesId: input.seriesId,
      minRegistrationEnabled: input.minRegistrationEnabled,
      minRegistrationCount: input.minRegistrationEnabled ? input.minRegistrationCount : 0,
      registrationDeadline: input.minRegistrationEnabled ? input.registrationDeadline : input.startsAt,
      description: input.description,
      collaboratorId: input.collaboratorId,
      coverUrl,
      coverFileId,
      status: asDraft ? ACTIVITY_STATUS.DRAFT : ACTIVITY_STATUS.ANALYSIS_PENDING,
      reviewStep: asDraft ? "" : "analysis",
      reviewMode: "",
      isHidden: false,
      reviewFlag: "",
      analysisStatus: asDraft ? "draft" : "pending",
      analysisVersion: nextAnalysisVersion,
      activityVersion: nextActivityVersion,
      identityNetworkId: activity.identityNetworkId || requestNetworkId || "",
      editLock: null,
      publishedAt: activity.publishedAt || "",
      updatedAt: new Date().toISOString(),
    });
    const finalUpdated = updated;
    if (!asDraft) {
      await enqueueActivityAnalysis(finalUpdated, "update_submit");
    }
    await writeLog(req, asDraft ? "activity.update_draft" : "activity.update_submit", {
      actorName: currentUser?.nickname || input.initiator || "匿名发起人",
      targetType: "activity",
      targetId: finalUpdated.id,
      targetName: finalUpdated.title,
      detail: asDraft
        ? `保存活动草稿：${finalUpdated.title}`
        : `重新发起活动：${finalUpdated.title}（已进入安全分析）`,
    });
    res.json({ activity: await toActivityPayload(finalUpdated, { req, user: currentUser }), policy: { action: asDraft ? "draft" : "analysis_pending", status: finalUpdated.status, reviewStep: finalUpdated.reviewStep } });
  });
  app.put("/api/activities/:id", activityMutationRateLimiter, upload.single("cover"), updateActivityHandler);
  app.post("/api/activities/:id", activityMutationRateLimiter, upload.single("cover"), updateActivityHandler);

  app.post("/api/activities/:id/review", requireAnyPermission([["activities", "review"], ["reviewTasks", "review"]]), activityMutationRateLimiter, asyncRoute(async (req, res) => {
    try {
      let beforeReview = null;
      const updated = await withMutationLock(`activity:${req.params.id}`, async () => {
        const activity = normalizeActivity(await store.findById("activities", req.params.id));
        if (!activity) {
          throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
        }
        beforeReview = activity;
        return reviewActivity(activity, req.currentUser, req.body.action, req.body.comment);
      });
      await writeLog(req, `activity.review.${req.body.action}`, {
        targetType: "activity",
        targetId: updated.id,
        targetName: updated.title,
        detail: `${LOG_ACTION_LABELS[`activity.review.${req.body.action}`] || "审核活动"}：${updated.title}`,
      });
      if (
        updated.status === ACTIVITY_STATUS.PUBLISHED
        && updated.anonymousIdentityId
        && (!beforeReview || beforeReview.status !== ACTIVITY_STATUS.PUBLISHED || beforeReview.isHidden)
      ) {
        const profile = await store.findById("trustProfiles", updated.anonymousIdentityId);
        if (profile) {
          await emitActivityPublishedEvent(updated, profile, `活动通过社区复核并发布：${updated.title}`);
        }
      }
      res.json({ activity: await toActivityPayload(updated) });
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }));

  app.post("/api/activities/:id/withdraw", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const updated = await withMutationLock(`activity:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if (!canWithdrawActivity(activity, currentUser, req)) {
        throw Object.assign(new Error("当前状态不能撤回"), { statusCode: 403 });
      }
      const now = new Date().toISOString();
      return store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.DRAFT,
        reviewStep: "",
        reviewMode: "",
        isHidden: false,
        reviewFlag: "",
        analysisStatus: "draft",
        analysisVersion: Number(activity.analysisVersion || 1) + 1,
        activityVersion: normalizeActivityVersion(activity) + 1,
        editLock: null,
        reviewLogs: [
          ...activity.reviewLogs,
          {
            id: makeId("review"),
            action: "withdraw",
            comment: "发起人撤回活动",
            actorId: currentUser?.id || activity.anonymousIdentityId || "",
            actorName: currentUser?.nickname || activity.initiator || "匿名发起人",
            actorRole: currentUser ? (userCan(currentUser, "activities", "review") ? "admin" : "collaborator") : "guest",
            createdAt: now,
          },
        ],
        updatedAt: now,
      });
    });
    await writeLog(req, "activity.withdraw", {
      actorName: currentUser?.nickname || updated.initiator || "匿名发起人",
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `撤回活动：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/activities/:id/cancel", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const updated = await withMutationLock(`activity:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if (!canLifecycleActivity(activity, currentUser, req, "cancel")) {
        throw Object.assign(new Error("当前角色不能取消这个活动"), { statusCode: 403 });
      }
      if ([ACTIVITY_STATUS.CANCELLED, ACTIVITY_STATUS.NOT_FORMED_CANCELLED, ACTIVITY_STATUS.ENDED, ACTIVITY_STATUS.REJECTED].includes(activity.status)) {
        throw Object.assign(new Error("当前状态不能取消活动"), { statusCode: 400 });
      }
      return store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.CANCELLED,
        reviewStep: "",
        activityVersion: normalizeActivityVersion(activity) + 1,
        editLock: null,
        updatedAt: new Date().toISOString(),
      });
    });
    await writeLog(req, "activity.cancel", {
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `取消活动：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/activities/:id/end", activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const updated = await withMutationLock(`activity:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if (!canLifecycleActivity(activity, currentUser, req, "end")) {
        throw Object.assign(new Error("当前角色不能结束这个活动"), { statusCode: 403 });
      }
      if (![ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status)) {
        throw Object.assign(new Error("只有已发布或已满员活动可以结束"), { statusCode: 400 });
      }
      return store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.ENDED,
        activityVersion: normalizeActivityVersion(activity) + 1,
        editLock: null,
        updatedAt: new Date().toISOString(),
      });
    });
    await writeLog(req, "activity.end", {
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `结束活动：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/system/auto-end", requirePermission("activities", "end"), activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const result = await sweepExpiredActivities({ force: true, reason: "manual" });
    await writeLog(req, "activity.auto_end", {
      targetType: "system",
      targetId: "activity-auto-end",
      targetName: "活动自动归档",
      detail: `手动触发活动归档，结束 ${result.endedCount || 0} 个活动，未成团取消 ${result.notFormedCancelledCount || 0} 个活动`,
    });
    res.json(result);
  }));

  app.post("/api/system/analysis-jobs/sweep", requirePermission("activities", "reanalyze"), activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const result = await processPendingActivityAnalysisJobs({ limit: ACTIVITY_ANALYSIS_SWEEP_LIMIT, reason: "manual" });
    await writeLog(req, "activity.analysis.complete", {
      targetType: "system",
      targetId: "activity-analysis-jobs",
      targetName: "活动安全分析队列",
      detail: `手动触发活动分析队列，处理 ${result.processed || 0} 个任务`,
    });
    res.json(result);
  }));

  app.post("/api/activities/:id/register", registrationRateLimiter, asyncRoute(async (req, res) => {
    const nickname = cleanText(req.body.nickname);
    if (!nickname) {
      res.status(400).json({ error: "请填写昵称" });
      return;
    }
    const nicknameError = validateTextLength("昵称", nickname, TEXT_LIMITS.nickname);
    if (nicknameError) {
      res.status(400).json({ error: nicknameError });
      return;
    }
    const context = await identityNetworkContextForRequest(req);
    const identity = context.identity;

    const result = await withMutationLock(`registration:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      const registrations = await getActivityRegistrations(activity.id);
      const registrationId = makeRegistrationId(activity.id, identitySubjectKey(context));
      const existing = await findExistingRegistrationForContext(activity.id, context)
        || await findExistingRegistration(activity.id, { id: registrationId, identityId: identity.id });
      if (existing && PUBLIC_ACTIVITY_STATUSES.includes(activity.status)) {
        const refreshed = await refreshRegistrationAccess(existing);
        return { registration: refreshed.registration, accessToken: refreshed.accessToken, activity, existing: true };
      }
      if (!REGISTRATION_OPEN_STATUSES.includes(activity.status)) {
        throw Object.assign(new Error("这个活动还没有开放报名"), { statusCode: 400 });
      }
      const registrationDeadline = normalizedRegistrationDeadline(activity);
      if (hasMinimumRegistrationRequirement(activity) && registrationDeadline && registrationDeadline <= shanghaiLocalDateTime()) {
        if (registrations.length < Number(activity.minRegistrationCount || 0)) {
          const now = new Date().toISOString();
          const updatedNotFormed = await store.update("activities", activity.id, {
            status: ACTIVITY_STATUS.NOT_FORMED_CANCELLED,
            reviewStep: "",
            notFormedCancelledAt: now,
            notFormedReason: "registration-deadline",
            updatedAt: now,
          });
          await writeSystemLog("activity.not_formed_cancel", {
            targetType: "activity",
            targetId: activity.id,
            targetName: activity.title,
            detail: `报名截止时未达到最低报名人数，自动取消活动：${activity.title}（${registrations.length}/${Number(activity.minRegistrationCount || 0)}）`,
          });
          throw Object.assign(new Error("这个活动未达到最低报名人数，已自动取消"), {
            statusCode: 400,
            activity: updatedNotFormed || activity,
          });
        }
        throw Object.assign(new Error("这个活动报名已经截止"), { statusCode: 400 });
      }
      const capacity = effectiveCapacity(activity);
      if (registrations.length >= capacity) {
        const updatedFull = await syncActivityRegistrationCount(activity, registrations.length);
        throw Object.assign(new Error("这个活动名额已经满了"), {
          statusCode: 400,
          activity: updatedFull || activity,
        });
      }

      const now = new Date().toISOString();
      const accessToken = makeAccessToken();
      const registration = {
        id: registrationId,
        activityId: activity.id,
        nickname,
        identityId: identity.id,
        identityNetworkId: context.network?.id || "",
        identitySnapshot: publicIdentity(identity),
        accessTokenHash: hashRegistrationAccessToken(accessToken),
        accessTokenCreatedAt: now,
        accessTokenUpdatedAt: now,
        createdAt: now,
      };
      const inserted = await store.insertUnique("registrations", registration, "id");
      if (!inserted.inserted) {
        const refreshed = await refreshRegistrationAccess(inserted.item);
        return { registration: refreshed.registration, accessToken: refreshed.accessToken, activity, existing: true };
      }
      const updated = await syncActivityRegistrationCount(activity, registrations.length + 1);
      if (activity.anonymousIdentityId) {
        const profile = await store.findById("trustProfiles", activity.anonymousIdentityId);
        if (profile) {
          const safetyConfig = await getSafetyConfig(store);
          const nextCount = registrations.length + 1;
          await recordCommunityEvent(store, profile, {
            type: "activity.registration.created",
            source: "registration",
            reason: `活动收到报名：${activity.title}`,
            activityId: activity.id,
            registrationIncrement: 1,
            payload: {
              registrationCount: nextCount,
            },
          }, safetyConfig.trust);
          if (nextCount > 0 && nextCount % 10 === 0) {
            const latestProfile = await store.findById("trustProfiles", activity.anonymousIdentityId) || profile;
            await recordCommunityEvent(store, latestProfile, {
              type: "activity.registration.milestone",
              source: "registration",
              reason: `活动报名达到 ${nextCount} 人：${activity.title}`,
              activityId: activity.id,
              payload: {
                milestone: nextCount,
                registrationCount: nextCount,
              },
            }, safetyConfig.trust);
          }
        }
      }
      await writeLog(req, "registration.create", {
        actorName: nickname,
        targetType: "activity",
        targetId: activity.id,
        targetName: activity.title,
        detail: `报名活动：${activity.title}`,
      });
      return { registration, accessToken, activity: updated || activity, existing: false };
    });
    res.json({
      registration: publicRegistration(result.registration, { accessToken: result.accessToken }),
      accessToken: result.accessToken,
      activity: await toActivityPayload(result.activity, { req }),
      existing: result.existing,
    });
  }));

  app.post("/api/activities/:id/interests", registrationRateLimiter, asyncRoute(async (req, res) => {
    const context = await identityNetworkContextForRequest(req);
    const identity = context.identity;
    const result = await withMutationLock(`interest:${req.params.id}:${identitySubjectKey(context)}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if (!PUBLIC_ACTIVITY_STATUSES.includes(activity.status) || activity.isHidden) {
        throw Object.assign(new Error("活动公开后才可以标记感兴趣"), { statusCode: 400 });
      }
      const now = new Date().toISOString();
      const existing = await findExistingIdentityScopedRecord("activityInterests", activity.id, context);
      if (existing) {
        const interestCount = await getActivityInterestCount(activity.id);
        return { activity, interestCount, existing: true };
      }
      const interest = {
        id: makeActivityInterestId(activity.id, identitySubjectKey(context)),
        activityId: activity.id,
        identityId: identity.id,
        identityNetworkId: context.network?.id || "",
        identitySnapshot: publicIdentity(identity),
        createdAt: now,
      };
      const inserted = await store.insertUnique("activityInterests", interest, "id");
      const interestCount = await getActivityInterestCount(activity.id);
      const updatedActivity = await store.update("activities", activity.id, {
        interestCount,
        updatedAt: now,
      }) || activity;
      if (inserted.inserted && activity.anonymousIdentityId) {
        const profile = await store.findById("trustProfiles", activity.anonymousIdentityId);
        if (profile) {
          const safetyConfig = await getSafetyConfig(store);
          await recordCommunityEvent(store, profile, {
            type: "activity.interest.created",
            source: "interest",
            reason: `活动收到感兴趣：${activity.title}`,
            activityId: activity.id,
            interestIncrement: 1,
            payload: {
              interestCount,
            },
          }, safetyConfig.trust);
        }
      }
      if (inserted.inserted) {
        await writeLog(req, "activity.interest", {
          actorName: "社区访客",
          targetType: "activity",
          targetId: activity.id,
          targetName: activity.title,
          detail: `标记感兴趣：${activity.title}`,
        });
      }
      return { activity: updatedActivity, interestCount, existing: !inserted.inserted };
    });
    res.json({
      ok: true,
      existing: result.existing,
      interestCount: result.interestCount,
      activity: await toActivityPayload(result.activity, { req }),
    });
  }));

  app.post("/api/activities/:id/notification-subscriptions", registrationRateLimiter, asyncRoute(async (req, res) => {
    const config = wechatMiniProgramNotificationConfig();
    const scene = cleanText(req.body?.scene || "activity_reminder");
    const sceneConfig = Object.values(config.scenes || {}).find((item) => item.key === scene);
    const configuredTemplateIds = sceneConfig?.templateIds || [];
    const templateIds = (Array.isArray(req.body?.templateIds) ? req.body.templateIds : [req.body?.templateId])
      .map(cleanText)
      .filter(Boolean)
      .filter((id) => configuredTemplateIds.includes(id));
    if (!sceneConfig || !configuredTemplateIds.length) {
      res.status(503).json({ error: "小程序订阅模板暂未配置，请先在后台或云环境配置模板 ID" });
      return;
    }
    if (!templateIds.length) {
      res.status(400).json({ error: "缺少有效订阅模板" });
      return;
    }
    const user = await getCurrentUser(req);
    const context = await identityNetworkContextForRequest(req);
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canSeeActivity(activity, user, req)) {
      res.status(403).json({ error: "这个活动还没有公开发布" });
      return;
    }
    const authorization = req.body?.authorization && typeof req.body.authorization === "object" ? req.body.authorization : {};
    const accepted = templateIds.some((id) => authorization[id] === "accept");
    const status = accepted ? "accepted" : "rejected";
    const now = new Date().toISOString();
    const subscription = {
      id: makeActivityNotificationSubscriptionId(activity.id, identitySubjectKey(context), scene),
      activityId: activity.id,
      activityTitle: activity.title,
      scene,
      source: cleanText(req.body?.source || "wechat_miniprogram"),
      status,
      templateIds,
      authorization,
      identityId: context.identity?.id || "",
      identityNetworkId: context.network?.id || "",
      identitySnapshot: publicIdentity(context.identity),
      updatedAt: now,
    };
    const existing = await store.findById("activityNotificationSubscriptions", subscription.id);
    const saved = existing
      ? await store.update("activityNotificationSubscriptions", existing.id, subscription)
      : await store.insert("activityNotificationSubscriptions", { ...subscription, createdAt: now });
    if (status === "accepted") {
      await writeLog(req, "activity.notification.subscribe", {
        actorName: "小程序访客",
        targetType: "activity",
        targetId: activity.id,
        targetName: activity.title,
        detail: `订阅活动提醒：${activity.title}`,
      });
    }
    res.json({
      ok: true,
      subscription: publicActivityNotificationSubscription(saved),
      notification: {
        status,
        text: status === "accepted" ? "已记录活动提醒订阅" : "你暂未授权活动提醒",
      },
    });
  }));

  app.get("/api/activities/:id/registrations/:registrationId", asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    const registration = await findRegistration(activity.id, req.params.registrationId);
    if (!registration) {
      res.status(404).json({ error: "找不到该报名记录" });
      return;
    }
    const accessToken = getRegistrationAccessToken(req);
    const context = await identityNetworkContextForRequest(req);
    if (!verifyRegistrationAccess(registration, accessToken) && !registrationOwnedByContext(registration, context)) {
      res.status(403).json({ error: "报名确认链接缺少或已失效，请重新报名获取确认页。" });
      return;
    }
    res.json({ registration: publicRegistration(registration), activity: await toActivityPayload(activity, { req }) });
  }));

  app.get("/api/activities/:id/registrations", asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const activity = await store.findById("activities", req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canManageActivity(activity, currentUser, req)) {
      res.status(403).json({ error: "只有活动发起人或管理员可以查看报名表" });
      return;
    }
    const registrations = await getActivityRegistrations(activity.id);
    res.json({ registrations: registrations.map((item) => publicRegistration(item)) });
  }));

  app.delete("/api/activities/:id/registrations/:registrationId", asyncRoute(async (req, res) => {
    const currentUser = await getCurrentUser(req);
    req.currentUser = currentUser;
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canManageActivity(activity, currentUser, req)) {
      res.status(403).json({ error: "只有活动发起人或管理员可以删除报名记录" });
      return;
    }
    let removedRegistration = null;
    await withMutationLock(`registration:${req.params.id}`, async () => {
      removedRegistration = await findRegistration(activity.id, req.params.registrationId);
      if (!removedRegistration) {
        throw Object.assign(new Error("找不到该报名记录"), { statusCode: 404 });
      }
      const removed = await store.removeWhere("registrations", [
        { field: "id", op: "eq", value: req.params.registrationId },
        { field: "activityId", op: "eq", value: activity.id },
      ]);
      if (!removed) {
        throw Object.assign(new Error("找不到该报名记录"), { statusCode: 404 });
      }
      const remainingCount = (await getActivityRegistrations(activity.id)).length;
      await syncActivityRegistrationCount(activity, remainingCount);
    });
    await writeLog(req, "registration.delete", {
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `删除报名记录：${activity.title} / ${removedRegistration.nickname}`,
    });
    res.json({ ok: true });
  }));

  app.post("/api/activities/:id/registrations/:registrationId/cancel", asyncRoute(async (req, res) => {
    let activity = null;
    let registration = null;
    await withMutationLock(`registration:${req.params.id}`, async () => {
      activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      registration = await findRegistration(activity.id, req.params.registrationId);
      if (!registration) {
        throw Object.assign(new Error("找不到该报名记录"), { statusCode: 404 });
      }
      const accessToken = getRegistrationAccessToken(req);
      const context = await identityNetworkContextForRequest(req);
      if (!verifyRegistrationAccess(registration, accessToken) && !registrationOwnedByContext(registration, context)) {
        throw Object.assign(new Error("报名确认链接缺少或已失效，请重新报名获取确认页。"), { statusCode: 403 });
      }
      const removed = await store.removeWhere("registrations", [
        { field: "id", op: "eq", value: registration.id },
        { field: "activityId", op: "eq", value: activity.id },
      ]);
      if (!removed) {
        throw Object.assign(new Error("找不到该报名记录"), { statusCode: 404 });
      }
      const remainingCount = (await getActivityRegistrations(activity.id)).length;
      await syncActivityRegistrationCount(activity, remainingCount);
    });
    await writeLog(req, "registration.cancel", {
      actorName: registration.nickname,
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `取消报名：${activity.title}`,
    });
    res.json({ ok: true });
  }));

  registerLogRoutes(app, {
    asyncRoute,
    cleanText,
    logFilters,
    pageQueryOptions,
    pruneOldLogs,
    requireAdmin: requirePermission("logs", "view"),
    store,
  });

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || error.status || (error.code === "LIMIT_FILE_SIZE" ? 400 : 500);
    if (status >= 500 && !error.expose) {
      console.error(error);
    }
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "图片大小超过限制"
      : status === 413
        ? "请求内容过大"
        : (status < 500 || error.expose) && error.message
          ? error.message
          : "服务器出了点问题，请稍后再试。";
    res.status(status).json({ error: message, ...(error.data && typeof error.data === "object" ? error.data : {}) });
  });

  if (serveStatic) {
    app.use((_req, res) => {
      res.status(404).sendFile(path.join(staticRoot, "index.html"));
    });
  } else {
    app.use((_req, res) => {
      res.status(404).json({ error: "接口不存在" });
    });
  }

  return app;
}

async function startServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 8080);
  await store.ensureSeed();
  await cleanupExpiredSessions();
  await sweepExpiredActivities({ force: true, reason: "server-start" });
  startActivityAutoEndScheduler({ enabled: options.enableActivityAutoEnd !== false });
  kickActivityAnalysisQueue("server-start");
  const app = createApp(options);
  return app.listen(port, options.host || "0.0.0.0", () => {
    console.log(`有空客厅正在运行：http://127.0.0.1:${port}`);
    console.log(`数据驱动：${process.env.STORE_DRIVER || "json"}`);
  });
}

module.exports = {
  createApp,
  closeExpiredActivities,
  sweepExpiredActivities,
  startActivityAutoEndScheduler,
  startServer,
  store,
};
