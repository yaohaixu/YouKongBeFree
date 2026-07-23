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
  hashManageToken,
  makeManageToken,
  prepareActivitySubmission,
  prepareActivitySubmissionGate,
  publicIdentity,
  recordActivityAnalysisEvents,
  saveSafetyConfig,
  storeAnalysisReport,
  submitCommunityReport,
  verifyManageToken,
} = require("./community-safety/service");
const { requestIdentity } = require("./community-safety/identity");
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
const { getAiSettings, publicAiSettings, saveAiSettings, testAiConnection } = require("./ai-analysis/service");
const { cleanPhone, createStore } = require("./store");

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
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const RICH_IMAGE_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const RICH_IMAGE_COMPRESSED_LIMIT_BYTES = 1.1 * 1024 * 1024;
const TEXT_LIMITS = {
  nickname: 32,
  moduleName: 32,
  moduleDescription: 120,
  templateName: 60,
  templateDescription: 160,
  title: 80,
  initiator: 32,
  initiatorContact: 80,
  location: 120,
  description: 50000,
  reviewComment: 500,
  reportReason: 40,
  reportDetail: 500,
};
const store = createStore();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
  ENDED: "ended",
};
const PUBLIC_ACTIVITY_STATUSES = [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL, ACTIVITY_STATUS.ENDED];
const UPCOMING_ACTIVITY_STATUSES = [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL];
const AUTO_END_ACTIVITY_STATUSES = [ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL];
const REGISTRATION_OPEN_STATUSES = [ACTIVITY_STATUS.PUBLISHED];
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
  "user.create": "新增协作员",
  "user.update": "保存协作员",
  "user.delete": "删除协作员",
  "module.create": "新增模块",
  "module.update": "保存模块",
  "module.delete": "删除模块",
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
  "activity.review.approve": "审核通过",
  "activity.review.return": "审核退回",
  "activity.review.reject": "审核拒绝",
  "activity.cancel": "取消活动",
  "activity.end": "结束活动",
  "activity.auto_end": "自动结束活动",
  "registration.create": "新增报名",
  "registration.delete": "删除报名",
  "registration.cancel": "取消报名",
  "safety.rule.create": "新增安全规则",
  "safety.rule.update": "保存安全规则",
  "safety.rule.delete": "删除安全规则",
  "safety.config.update": "保存安全配置",
  "ai.settings.update": "保存 AI 设置",
  "ai.connection.test": "测试 AI 连接",
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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function makeAccessToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function publicUser(user, options = {}) {
  if (!user) return null;
  const roles = normalizeRoles(user);
  const payload = {
    id: user.id,
    nickname: user.nickname,
    role: roles.includes("admin") ? "admin" : roles[0] || "collaborator",
    roles,
  };
  if (options.includePhone) {
    payload.phone = user.phone;
  }
  return payload;
}

function publicRegistration(registration, options = {}) {
  if (!registration) return null;
  const payload = {
    id: registration.id,
    activityId: registration.activityId,
    nickname: registration.nickname,
    phone: registration.phone,
    createdAt: registration.createdAt,
  };
  if (options.accessToken) {
    payload.accessToken = options.accessToken;
  }
  return payload;
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
  const description = sanitizeRichText(body.description);
  const collaboratorId = cleanText(body.collaboratorId);

  const capacity = capacityValue ? Number(capacityValue) : DEFAULT_ACTIVITY_CAPACITY;
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
  const roles = raw
    .map((role) => String(role || "").trim())
    .map((role) => (role === "member" ? "collaborator" : role))
    .filter((role) => ["admin", "collaborator"].includes(role));
  if (roles.includes("admin")) return ["admin"];
  if (roles.includes("collaborator")) return ["collaborator"];
  return ["collaborator"];
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

  if (!(await store.findById("modules", input.moduleId))) {
    return "请选择有效模块";
  }

  if (input.collaboratorId) {
    const collaborator = await store.findById("users", input.collaboratorId);
    if (!collaborator || !isCollaborator(collaborator)) {
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

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashRegistrationAccessToken(token) {
  return hashToken(`registration-access:${token}`);
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

function hashRegistrationIdentity(activityId, phone) {
  return crypto.createHash("sha256").update(`${activityId}:${cleanPhone(phone)}`).digest("hex");
}

function makeRegistrationId(activityId, phone) {
  return `reg_${hashRegistrationIdentity(activityId, phone).slice(0, 24)}`;
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
    identity.phoneHash ? [{ field: "phoneHash", op: "eq", value: identity.phoneHash }, { field: "activityId", op: "eq", value: activityId }] : null,
    identity.phone ? [{ field: "phone", op: "eq", value: identity.phone }, { field: "activityId", op: "eq", value: activityId }] : null,
  ].filter(Boolean);
  for (const filters of checks) {
    const item = await store.findByFilters("registrations", filters);
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

function clearSessionCookieOptions() {
  const { maxAge, ...options } = sessionCookieOptions();
  return options;
}

async function getCurrentUser(req) {
  const token = getRequestToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  let session = await store.findByFilters("sessions", [{ field: "tokenHash", op: "eq", value: tokenHash }]);
  if (!session) {
    session = await store.findByFilters("sessions", [{ field: "token", op: "eq", value: token }]);
  }
  if (!session) return null;
  if (isSessionExpired(session)) {
    await store.remove("sessions", (item) => item.id === session.id || item.tokenHash === tokenHash || item.token === token);
    return null;
  }
  return store.findByFilters("users", [{ field: "id", op: "eq", value: session.userId }]);
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
    && /(^|\/)(activity-covers|rich-images)\//.test(value);
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

async function countRecords(collection, filters = []) {
  if (typeof store.count === "function") {
    return store.count(collection, { filters });
  }
  const { pageInfo } = await store.query(collection, {
    page: 1,
    pageSize: 1,
    filters,
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
  if (isAdmin(user)) {
    return [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW }];
  }
  if (isCollaborator(user)) {
    return [
      { field: "status", op: "eq", value: ACTIVITY_STATUS.COLLABORATOR_REVIEW },
      { field: "collaboratorId", op: "eq", value: user.id },
    ];
  }
  return [impossibleFilter()];
}

async function pendingPreviewForUser(user, limit = 3) {
  if (!isAdmin(user) && !isCollaborator(user)) {
    return { total: 0, activities: [] };
  }
  if (isAdmin(user)) {
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

async function ownedActivitiesForRequest(req, user = null, options = {}) {
  const identity = requestIdentity(req);
  const queries = [];
  if (user) {
    queries.push(store.query("activities", {
      page: 1,
      pageSize: options.pageSize || 1000,
      maxPageSize: options.pageSize || 1000,
      filters: [{ field: "createdBy", op: "eq", value: user.id }],
      sort: activitySortRules("created-desc"),
    }));
  }
  if (identity.id) {
    queries.push(store.query("activities", {
      page: 1,
      pageSize: options.pageSize || 1000,
      maxPageSize: options.pageSize || 1000,
      filters: [{ field: "anonymousIdentityId", op: "eq", value: identity.id }],
      sort: activitySortRules("created-desc"),
    }));
  }
  if (!queries.length) return [];
  const results = await Promise.all(queries);
  return dedupeById(results.flatMap((result) => result.data || []));
}

function activityCountsFromItems(items = []) {
  const byStatus = Object.fromEntries(Object.values(ACTIVITY_STATUS).map((status) => [status, 0]));
  items.forEach((item) => {
    const status = normalizeActivity(item).status;
    byStatus[status] = Number(byStatus[status] || 0) + 1;
  });
  return byStatus;
}

async function memberDashboardPayload(req, user = null) {
  const ownedActivities = await ownedActivitiesForRequest(req, user);
  const byStatus = activityCountsFromItems(ownedActivities);
  const pending = user ? await pendingPreviewForUser(user, 3) : { total: 0, activities: [] };
  return {
    summary: summarizeActivityCounts(byStatus),
    pending,
  };
}

async function adminDashboardPayload(user) {
  const [byStatus, usersTotal, modulesTotal, templatesTotal, pending] = await Promise.all([
    activityStatusCounts(),
    countRecords("users"),
    countRecords("modules"),
    countRecords("templates"),
    pendingPreviewForUser(user, 4),
  ]);
  return {
    activities: summarizeActivityCounts(byStatus),
    users: { total: usersTotal },
    modules: { total: modulesTotal },
    templates: { total: templatesTotal },
    pending,
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

async function enqueueActivityAnalysis(activity, trigger = "submit") {
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
      const riskPatch = activityRiskPatch(analysisReport, { ...context, activity });
      const policy = analysis.policy || {};
      const nextStatus = policy.status || ACTIVITY_STATUS.ADMIN_REVIEW;
      const nextReviewStep = policy.reviewStep || (nextStatus === ACTIVITY_STATUS.ADMIN_REVIEW ? "admin" : "");
      const completedAt = new Date().toISOString();
      const updated = await store.update("activities", activity.id, {
        ...riskPatch,
        status: nextStatus,
        reviewStep: nextReviewStep,
        reviewMode: riskPatch.reviewMode || policy.reviewMode || "",
        isHidden: Boolean(riskPatch.isHidden),
        analysisStatus: "completed",
        analysisJobId: currentJob.id,
        analysisCompletedAt: completedAt,
        publishedAt: nextStatus === ACTIVITY_STATUS.PUBLISHED ? (activity.publishedAt || completedAt) : activity.publishedAt || "",
        updatedAt: completedAt,
      }) || activity;

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
  const { data: jobs } = await store.query("activityAnalysisJobs", {
    page: 1,
    pageSize: options.limit || ACTIVITY_ANALYSIS_SWEEP_LIMIT,
    maxPageSize: ACTIVITY_ANALYSIS_SWEEP_LIMIT,
    filters: [{ field: "status", op: "eq", value: "pending" }],
    sort: [{ field: "createdAt", direction: "asc" }],
  });
  for (const job of jobs) {
    await runActivityAnalysisJob(job);
  }
  return { processed: jobs.length };
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
      action,
      actionLabel: LOG_ACTION_LABELS[action] || action,
      actorId: "system",
      actorName: "系统",
      actorRole: "system",
      actorPhone: "",
      targetType: options.targetType || "",
      targetId: options.targetId || "",
      targetName: options.targetName || "",
      detail: options.detail || "",
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
      action,
      actionLabel: LOG_ACTION_LABELS[action] || action,
      actorId: currentUser ? currentUser.id : "",
      actorName: options.actorName || (currentUser ? currentUser.nickname : "访客"),
      actorRole: currentUser ? (publicUser(currentUser).role || "member") : "guest",
      actorPhone: maskPhone(options.actorPhone || (currentUser ? currentUser.phone || "" : "")),
      targetType: options.targetType || "",
      targetId: options.targetId || "",
      targetName: options.targetName || "",
      detail: options.detail || "",
      createdAt: now,
    });
  } catch (error) {
    console.error("write operation log failed", error);
  }
}

async function closeExpiredActivities(options = {}) {
  const todayKey = options.todayKey || shanghaiDateKey();
  const cutoff = `${todayKey}T00:00`;
  const ended = [];

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

async function toActivityPayload(activity) {
  activity = normalizeActivity(activity);
  const [module, owner, collaborator, activityRegistrations] = await Promise.all([
    activity.moduleId ? store.findById("modules", activity.moduleId) : null,
    activity.createdBy ? store.findById("users", activity.createdBy) : null,
    activity.collaboratorId ? store.findById("users", activity.collaboratorId) : null,
    getActivityRegistrations(activity.id),
  ]);
  const capacity = effectiveCapacity(activity);
  const derivedStatus = capacity && activityRegistrations.length >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
    ? ACTIVITY_STATUS.FULL
    : activity.status;
  return withCoverUrl({
    ...activity,
    capacity,
    status: derivedStatus,
    showInitiatorContact: Boolean(activity.showInitiatorContact),
    initiatorContact: activity.showInitiatorContact ? activity.initiatorContact || "" : "",
    statusLabel: statusLabel(derivedStatus),
    reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
    moduleName: module ? module.name : "未归类",
    creatorName: owner ? owner.nickname : activity.initiator,
    collaboratorName: collaborator ? collaborator.nickname : "",
    registrationCount: activityRegistrations.length,
    spotsLeft: Math.max(capacity - activityRegistrations.length, 0),
  });
}

async function toActivityListPayload(activities) {
  const normalizedActivities = activities.map((source) => normalizeActivity(source));
  const [moduleMap, userMap] = await Promise.all([
    loadRecordsByIds("modules", normalizedActivities.map((activity) => activity.moduleId)),
    loadRecordsByIds("users", normalizedActivities.flatMap((activity) => [activity.createdBy, activity.collaboratorId])),
  ]);
  return Promise.all(normalizedActivities.map((activity) => {
    const module = moduleMap.get(activity.moduleId);
    const owner = userMap.get(activity.createdBy);
    const collaborator = userMap.get(activity.collaboratorId);
    const capacity = effectiveCapacity(activity);
    const registrationCount = Math.max(0, Number(activity.registrationCount || 0));
    const derivedStatus = capacity && registrationCount >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
      ? ACTIVITY_STATUS.FULL
      : activity.status;
    return withCoverUrl({
      ...activity,
      capacity,
      status: derivedStatus,
      showInitiatorContact: Boolean(activity.showInitiatorContact),
      initiatorContact: activity.showInitiatorContact ? activity.initiatorContact || "" : "",
      statusLabel: statusLabel(derivedStatus),
      reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
      moduleName: module ? module.name : "未归类",
      creatorName: owner ? owner.nickname : activity.initiator,
      collaboratorName: collaborator ? collaborator.nickname : "",
      registrationCount,
      spotsLeft: Math.max(capacity - registrationCount, 0),
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

function canManageActivity(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!activity) return false;
  if (user && (isAdmin(user) || activity.createdBy === user.id)) return true;
  return verifyManageToken(activity, getManageToken(req));
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
  if (user && isAdmin(user)) return activity.status !== ACTIVITY_STATUS.REJECTED;
  return [ACTIVITY_STATUS.DRAFT, ACTIVITY_STATUS.RETURNED].includes(activity.status);
}

function canWithdrawActivity(activity, user, req) {
  activity = normalizeActivity(activity);
  if (!canManageActivity(activity, user, req)) return false;
  return [ACTIVITY_STATUS.ANALYSIS_PENDING, ACTIVITY_STATUS.ADMIN_REVIEW, ACTIVITY_STATUS.COLLABORATOR_REVIEW, ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status);
}

function pendingForUser(activity, user) {
  activity = normalizeActivity(activity);
  if (!user) return false;
  if (isAdmin(user) && activity.reviewFlag === "admin_attention" && activity.status === ACTIVITY_STATUS.PUBLISHED) return true;
  if (activity.status === ACTIVITY_STATUS.ADMIN_REVIEW) return isAdmin(user);
  if (activity.status === ACTIVITY_STATUS.COLLABORATOR_REVIEW) return activity.collaboratorId === user.id && isCollaborator(user);
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
  if (Object.prototype.hasOwnProperty.call(body, "apiKey")) patch.apiKey = cleanText(body.apiKey);
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
  if (Object.prototype.hasOwnProperty.call(body, "capabilities")) patch.capabilities = parseJsonLike(body.capabilities, {});
  return patch;
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

function createApp(options = {}) {
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
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (corsOrigins.includes("*") || corsOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-YK-Client-Id, X-YK-Fingerprint, X-YK-Manage-Token, X-Turnstile-Token");
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
  app.use("/api", limitWrites);
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "64kb", parameterLimit: 100 }));

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

  app.get("/api/session", asyncRoute(async (req, res) => {
    res.json({
      user: publicUser(await getCurrentUser(req), { includePhone: true }),
      anonymous: publicIdentity(requestIdentity(req)),
    });
  }));

  app.post("/api/login", loginIpRateLimiter, loginRateLimiter, asyncRoute(async (req, res) => {
    const phone = cleanPhone(req.body.phone);
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "请输入有效手机号" });
      return;
    }
    const user = await store.findByFilters("users", [{ field: "phone", op: "eq", value: phone }]);

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
      await store.remove("sessions", (item) => item.tokenHash === tokenHash || item.token === token);
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

  app.get("/api/dashboard/admin", requireAdmin, asyncRoute(async (req, res) => {
    await sweepExpiredActivities({ reason: "dashboard-admin" });
    res.json(await adminDashboardPayload(req.currentUser));
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

  app.get("/api/safety/config", requireAdmin, asyncRoute(async (_req, res) => {
    res.json({ config: await getSafetyConfig(store) });
  }));

  app.put("/api/safety/config", requireAdmin, asyncRoute(async (req, res) => {
    const config = await saveSafetyConfig(store, parseJsonLike(req.body.config, req.body));
    await writeLog(req, "safety.config.update", {
      targetType: "system",
      targetId: "safety_config",
      targetName: "规则与策略配置",
      detail: "保存规则引擎、限流、举报、策略配置",
    });
    res.json({ config });
  }));

  app.get("/api/safety/rules", requireAdmin, asyncRoute(async (_req, res) => {
    const rules = await getSafetyRules(store, { includeDisabled: true });
    res.json({ rules: rules.map(publicSafetyRule) });
  }));

  app.post("/api/safety/rules", requireAdmin, asyncRoute(async (req, res) => {
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

  app.put("/api/safety/rules/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.delete("/api/safety/rules/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.get("/api/ai/settings", requireAdmin, asyncRoute(async (_req, res) => {
    res.json({ settings: publicAiSettings(await getAiSettings(store)) });
  }));

  app.put("/api/ai/settings", requireAdmin, asyncRoute(async (req, res) => {
    const settings = await saveAiSettings(store, parseAiSettingsInput(req.body));
    await writeLog(req, "ai.settings.update", {
      targetType: "system",
      targetId: "ai_settings",
      targetName: "AI Analysis Engine",
      detail: "保存 AI 分析引擎设置",
    });
    res.json({ settings: publicAiSettings(settings) });
  }));

  app.post("/api/ai/test-connection", requireAdmin, asyncRoute(async (req, res) => {
    const result = await testAiConnection(store, parseAiSettingsInput(req.body));
    await writeLog(req, "ai.connection.test", {
      targetType: "system",
      targetId: "ai_settings",
      targetName: "AI Analysis Engine",
      detail: result.ok ? `AI 连接测试成功：${result.provider}/${result.model}` : `AI 连接测试失败：${result.error}`,
    });
    res.json(result);
  }));

  app.get("/api/ai/prompts", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("aiPrompts", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "version", "systemPrompt", "userPrompt"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ prompts: data, pageInfo });
  }));

  app.post("/api/ai/prompts", requireAdmin, asyncRoute(async (req, res) => {
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
    await writeLog(req, "ai.prompt.create", {
      targetType: "aiPrompt",
      targetId: prompt.id,
      targetName: prompt.name,
      detail: `新增 Prompt：${prompt.name}`,
    });
    res.json({ prompt });
  }));

  app.put("/api/ai/prompts/:id", requireAdmin, asyncRoute(async (req, res) => {
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
    await writeLog(req, "ai.prompt.update", {
      targetType: "aiPrompt",
      targetId: updated.id,
      targetName: updated.name,
      detail: `保存 Prompt：${updated.name}`,
    });
    res.json({ prompt: updated });
  }));

  app.post("/api/ai/prompts/:id/activate", requireAdmin, asyncRoute(async (req, res) => {
    const prompt = await store.findById("aiPrompts", req.params.id);
    if (!prompt) {
      res.status(404).json({ error: "找不到该 Prompt" });
      return;
    }
    const { data: prompts } = await store.query("aiPrompts", {
      page: 1,
      pageSize: 500,
      maxPageSize: 500,
      filters: [{ field: "type", op: "eq", value: prompt.type }],
    });
    await Promise.all(prompts.map((item) => store.update("aiPrompts", item.id, { active: item.id === prompt.id, updatedAt: new Date().toISOString() })));
    const settings = await saveAiSettings(store, { promptVersion: prompt.version });
    await writeLog(req, "ai.prompt.activate", {
      targetType: "aiPrompt",
      targetId: prompt.id,
      targetName: prompt.name,
      detail: `启用 Prompt：${prompt.name}`,
    });
    res.json({ prompt: { ...prompt, active: true }, settings: publicAiSettings(settings) });
  }));

  app.delete("/api/ai/prompts/:id", requireAdmin, asyncRoute(async (req, res) => {
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
      res.status(400).json({ error: "图片压缩后仍超过 1MB，请换一张图片或重新压缩" });
      return;
    }
    const uploaded = await store.saveUpload(req.file, { directory: "rich-images" });
    res.json({ url: richImagePublicUrl(req, uploaded), fileId: uploaded.fileId || "" });
  }));

  app.get("/api/users", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const role = cleanText(req.query.role);
    const filters = role ? [{ field: "roles", op: "contains", value: role }] : [];
    const { data, pageInfo } = await store.query("users", {
      ...pageQueryOptions(req.query),
      filters,
      keyword,
      keywordFields: ["nickname", "phone", "role"],
      sort: [{ field: "id", direction: "asc" }],
    });
    res.json({ users: data.map((user) => publicUser(user, { includePhone: true })), pageInfo });
  }));

  app.get("/api/collaborators", asyncRoute(async (_req, res) => {
    const { data: users } = await store.query("users", {
      page: 1,
      pageSize: 100,
      maxPageSize: 500,
      filters: [{ field: "roles", op: "contains", value: "collaborator" }],
      sort: [{ field: "nickname", direction: "asc" }],
    });
    res.json({
      collaborators: users.map(publicUser),
    });
  }));

  app.post("/api/users", requireAdmin, asyncRoute(async (req, res) => {
    const nickname = cleanText(req.body.nickname);
    const phone = cleanPhone(req.body.phone);
    const roles = normalizeRoles(req.body).filter((role) => role !== "admin");
    const finalRoles = roles.length ? [roles[0]] : ["collaborator"];
    const role = finalRoles[0];

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
      detail: `新增协作员：${user.nickname}`,
    });
    res.json({ user: publicUser(user, { includePhone: true }) });
  }));

  app.put("/api/users/:id", requireAdmin, asyncRoute(async (req, res) => {
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
      detail: `保存协作员：${updated.nickname}`,
    });
    res.json({ user: publicUser(updated, { includePhone: true }) });
  }));

  app.delete("/api/users/:id", requireAdmin, asyncRoute(async (req, res) => {
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
      detail: `删除协作员：${user ? `${user.nickname}（${maskPhone(user.phone)}）` : req.params.id}`,
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

  app.post("/api/modules", requireAdmin, asyncRoute(async (req, res) => {
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

  app.put("/api/modules/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.delete("/api/modules/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.post("/api/templates", requireAdmin, asyncRoute(async (req, res) => {
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

  app.put("/api/templates/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.delete("/api/templates/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.get("/api/governance/overview", requireAdmin, asyncRoute(async (_req, res) => {
    res.json({ overview: await governanceOverview(store) });
  }));

  app.get("/api/governance/identities", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("trustProfiles", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["id", "communityId", "ipMasked", "userAgentSample", "status", "communityLevel"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ profiles: await hydrateTrustProfiles(data), pageInfo });
  }));

  app.get("/api/governance/identities/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.get("/api/governance/trust-policies", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("trustPolicies", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "eventType", "description"],
      sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
    });
    res.json({ policies: data, pageInfo });
  }));

  app.post("/api/governance/trust-policies", requireAdmin, asyncRoute(async (req, res) => {
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

  app.put("/api/governance/trust-policies/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.delete("/api/governance/trust-policies/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.get("/api/governance/badges", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("communityBadges", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["name", "description", "type"],
      sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
    });
    res.json({ badges: data, pageInfo });
  }));

  app.post("/api/governance/badges", requireAdmin, asyncRoute(async (req, res) => {
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

  app.put("/api/governance/badges/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.delete("/api/governance/badges/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.get("/api/governance/badge-policies", requireAdmin, asyncRoute(async (req, res) => {
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

  app.put("/api/governance/badge-policies/:id", requireAdmin, asyncRoute(async (req, res) => {
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

  app.get("/api/trust-profiles", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q);
    const { data, pageInfo } = await store.query("trustProfiles", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: ["id", "ipMasked", "userAgentSample"],
      sort: [{ field: "updatedAt", direction: "desc" }, { field: "createdAt", direction: "desc" }],
    });
    res.json({ profiles: await hydrateTrustProfiles(data), pageInfo });
  }));

  app.get("/api/trust-profiles/:id", requireAdmin, asyncRoute(async (req, res) => {
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
    kickActivityAnalysisQueue("activity-list");
    await sweepExpiredActivities({ force: !owner && !pending && all !== "true", reason: "activity-list" });
    const user = await getCurrentUser(req);
    const filters = [];
    const ownerMode = owner === "me";
    const adminPendingMode = pending === "me" && user && isAdmin(user);
    if (ownerMode) {
      // Owner filters are applied after shared filters because anonymous and logged-in ownership are an OR query.
    } else if (pending === "me") {
      if (!user) {
        filters.push(impossibleFilter());
      } else if (isAdmin(user)) {
        // Admin pending merges hidden admin review tasks and public admin-attention tasks below.
      } else if (isCollaborator(user)) {
        filters.push({ field: "status", op: "eq", value: ACTIVITY_STATUS.COLLABORATOR_REVIEW });
        filters.push({ field: "collaboratorId", op: "eq", value: user.id });
      } else {
        filters.push(impossibleFilter());
      }
    } else if (all === "true") {
      if (!user || !isAdmin(user)) {
        res.status(403).json({ error: "仅 YKadmin 管理员可查看全部活动" });
        return;
      }
    } else {
      const view = cleanText(req.query.view || (req.query.history === "true" ? "history" : "upcoming"));
      filters.push({
        field: "status",
        op: "in",
        value: view === "history" ? [ACTIVITY_STATUS.ENDED] : UPCOMING_ACTIVITY_STATUSES,
      });
    }

    const keyword = cleanText(req.query.q).toLowerCase();
    const status = cleanText(req.query.status);
    const moduleId = cleanText(req.query.moduleId);
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
    filters.push(...activityDateFilters(req.query));

    if (adminPendingMode) {
      const pendingFilterSets = [
        [{ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW }],
        [
          { field: "status", op: "eq", value: ACTIVITY_STATUS.PUBLISHED },
          { field: "reviewFlag", op: "eq", value: "admin_attention" },
        ],
      ];
      const pendingResults = await Promise.all(pendingFilterSets.map((pendingFilters) => store.query("activities", {
        page: 1,
        pageSize: 1000,
        maxPageSize: 1000,
        filters: [...filters, ...pendingFilters],
        keyword,
        keywordFields: ["title", "initiator", "location", "description"],
        sort: activitySortRules(req.query.sort || defaultSort),
      })));
      const merged = dedupeById(pendingResults.flatMap((result) => result.data || []))
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
      const { page, pageSize } = parsePagination(req.query);
      const start = (page - 1) * pageSize;
      const visible = merged.slice(start, start + pageSize);
      res.json({
        activities: await toActivityListPayload(visible),
        pageInfo: {
          page,
          pageSize,
          total: merged.length,
          totalPages: Math.max(Math.ceil(merged.length / pageSize), 1),
          hasMore: start + visible.length < merged.length,
        },
      });
      return;
    }

    if (ownerMode) {
      const identity = requestIdentity(req);
      const ownerFilterSets = [];
      if (user) ownerFilterSets.push([{ field: "createdBy", op: "eq", value: user.id }]);
      if (identity.id) ownerFilterSets.push([{ field: "anonymousIdentityId", op: "eq", value: identity.id }]);
      if (!ownerFilterSets.length) ownerFilterSets.push([impossibleFilter()]);
      const ownerResults = await Promise.all(ownerFilterSets.map((ownerFilters) => store.query("activities", {
        page: 1,
        pageSize: 1000,
        maxPageSize: 1000,
        filters: [...filters, ...ownerFilters],
        keyword,
        keywordFields: ["title", "initiator", "location", "description"],
        sort: activitySortRules(req.query.sort || defaultSort),
      })));
      const merged = dedupeById(ownerResults.flatMap((result) => result.data || []))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      const { page, pageSize } = parsePagination(req.query);
      const start = (page - 1) * pageSize;
      const visible = merged.slice(start, start + pageSize);
      res.json({
        activities: await toActivityListPayload(visible),
        pageInfo: {
          page,
          pageSize,
          total: merged.length,
          totalPages: Math.max(Math.ceil(merged.length / pageSize), 1),
          hasMore: start + visible.length < merged.length,
        },
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
    const visibleActivities = (!owner && !pending && all !== "true")
      ? activities.filter((activity) => !activity.isHidden)
      : activities;
    res.json({ activities: await toActivityListPayload(visibleActivities), pageInfo });
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
    res.json({ activity: await toActivityPayload(activity) });
  }));

  app.get("/api/activities/:id/confidence", requireAdmin, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.findById("activities", req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
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
    const trustProfile = activity.anonymousIdentityId ? await store.findById("trustProfiles", activity.anonymousIdentityId) : null;
    res.json({
      activity: await toActivityPayload(activity),
      trustProfile,
      reports,
      analyses,
      latestAnalysis: analyses[0] || null,
    });
  }));

  app.get("/api/reports", requireAdmin, asyncRoute(async (req, res) => {
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

  app.post("/api/activities/:id/reanalyze", requireAdmin, asyncRoute(async (req, res) => {
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
    const analysis = await analyzeActivitySafety(store, activity, {
      identity,
      trustProfile,
      safetyConfig,
      intent: "submit",
      manual: true,
      activityId: activity.id,
      identityActivityCount: Math.max(0, identityActivityTotal - 1),
      activityNumber: Math.max(1, identityActivityTotal),
    });
    const analysisReport = await storeAnalysisReport(store, activity.id, analysis, { identity, trustProfile });
    const updated = await store.update("activities", activity.id, {
      ...activityRiskPatch(analysisReport, { identity, trustProfile, activity }),
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "activity.reanalyze", {
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `重新分析活动置信度：${activity.title}（风险分 ${updated.riskScore}）`,
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
    const manageToken = makeManageToken();
    const prepared = await prepareActivitySubmissionGate(store, req, input, { intent, activityId });
    if (!prepared.ok) {
      await removeUploadedFile(req.file);
      res.status(prepared.statusCode || 400).json({ error: prepared.error || "活动暂时不能发布，请稍后再试" });
      return;
    }
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
      description: input.description,
      collaboratorId: input.collaboratorId,
      coverUrl,
      coverFileId,
      registrationCount: 0,
      status: asDraft ? ACTIVITY_STATUS.DRAFT : ACTIVITY_STATUS.ANALYSIS_PENDING,
      reviewStep: asDraft ? "" : "analysis",
      reviewLogs: [],
      createdBy: currentUser?.id || "",
      createdByType: currentUser ? "user" : "anonymous",
      anonymousIdentityId: prepared.context.identity.id,
      manageTokenHash: hashManageToken(activityId, manageToken),
      analysisStatus: asDraft ? "draft" : "pending",
      analysisVersion: 1,
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
      activity: await toActivityPayload(activity),
      manageToken,
      policy: { action: asDraft ? "draft" : "analysis_pending", status: activity.status, reviewStep: activity.reviewStep },
    });
  }));

  app.put("/api/activities/:id", activityMutationRateLimiter, upload.single("cover"), asyncRoute(async (req, res) => {
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

    const input = parseActivityInput(req.body, activity.initiator, currentUser?.phone || activity.initiatorContact || "");
    const intent = req.body.intent === "draft" ? "draft" : "submit";
    const asDraft = intent === "draft";
    const error = await validateActivityInput(input, activity.id, { asDraft });
    if (error) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error });
      return;
    }
    const prepared = await prepareActivitySubmissionGate(store, req, input, { intent, activityId: activity.id });
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
      analysisVersion: Number(activity.analysisVersion || 1) + 1,
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
    res.json({ activity: await toActivityPayload(finalUpdated), policy: { action: asDraft ? "draft" : "analysis_pending", status: finalUpdated.status, reviewStep: finalUpdated.reviewStep } });
  }));

  app.post("/api/activities/:id/review", requireLogin, activityMutationRateLimiter, asyncRoute(async (req, res) => {
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
        reviewLogs: [
          ...activity.reviewLogs,
          {
            id: makeId("review"),
            action: "withdraw",
            comment: "发起人撤回活动",
            actorId: currentUser?.id || activity.anonymousIdentityId || "",
            actorName: currentUser?.nickname || activity.initiator || "匿名发起人",
            actorRole: currentUser ? (isAdmin(currentUser) ? "admin" : "collaborator") : "guest",
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

  app.post("/api/activities/:id/cancel", requireAdmin, activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const updated = await withMutationLock(`activity:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if ([ACTIVITY_STATUS.CANCELLED, ACTIVITY_STATUS.ENDED, ACTIVITY_STATUS.REJECTED].includes(activity.status)) {
        throw Object.assign(new Error("当前状态不能取消活动"), { statusCode: 400 });
      }
      return store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.CANCELLED,
        reviewStep: "",
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

  app.post("/api/activities/:id/end", requireAdmin, activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const updated = await withMutationLock(`activity:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      if (![ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status)) {
        throw Object.assign(new Error("只有已发布或已满员活动可以结束"), { statusCode: 400 });
      }
      return store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.ENDED,
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

  app.post("/api/system/auto-end", requireAdmin, activityMutationRateLimiter, asyncRoute(async (req, res) => {
    const result = await sweepExpiredActivities({ force: true, reason: "manual" });
    await writeLog(req, "activity.auto_end", {
      targetType: "system",
      targetId: "activity-auto-end",
      targetName: "活动自动归档",
      detail: `手动触发活动归档，结束 ${result.endedCount || 0} 个活动`,
    });
    res.json(result);
  }));

  app.post("/api/system/analysis-jobs/sweep", requireAdmin, activityMutationRateLimiter, asyncRoute(async (req, res) => {
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
    const phone = cleanPhone(req.body.phone);
    if (!nickname || !phone) {
      res.status(400).json({ error: "请填写昵称和手机号" });
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

    const result = await withMutationLock(`registration:${req.params.id}`, async () => {
      const activity = normalizeActivity(await store.findById("activities", req.params.id));
      if (!activity) {
        throw Object.assign(new Error("找不到该活动"), { statusCode: 404 });
      }
      const registrations = await getActivityRegistrations(activity.id);
      const registrationId = makeRegistrationId(activity.id, phone);
      const phoneHash = hashRegistrationIdentity(activity.id, phone);
      const existing = await findExistingRegistration(activity.id, { id: registrationId, phoneHash, phone });
      if (existing && PUBLIC_ACTIVITY_STATUSES.includes(activity.status)) {
        const refreshed = await refreshRegistrationAccess(existing);
        return { registration: refreshed.registration, accessToken: refreshed.accessToken, activity, existing: true };
      }
      if (!REGISTRATION_OPEN_STATUSES.includes(activity.status)) {
        throw Object.assign(new Error("这个活动还没有开放报名"), { statusCode: 400 });
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
        phone,
        phoneHash,
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
        actorPhone: phone,
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
      activity: await toActivityPayload(result.activity),
      existing: result.existing,
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
    if (!verifyRegistrationAccess(registration, getRegistrationAccessToken(req))) {
      res.status(403).json({ error: "报名确认链接缺少或已失效，请重新输入手机号获取确认页。" });
      return;
    }
    res.json({ registration: publicRegistration(registration), activity: await toActivityPayload(activity) });
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
      detail: `删除报名记录：${activity.title} / ${removedRegistration.nickname}（${maskPhone(removedRegistration.phone)}）`,
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
      if (!verifyRegistrationAccess(registration, getRegistrationAccessToken(req))) {
        throw Object.assign(new Error("报名确认链接缺少或已失效，请重新输入手机号获取确认页。"), { statusCode: 403 });
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
      actorPhone: registration.phone,
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
    requireAdmin,
    store,
  });

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || error.status || (error.code === "LIMIT_FILE_SIZE" ? 400 : 500);
    if (status >= 500) {
      console.error(error);
    }
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "图片大小超过限制"
      : status === 413
        ? "请求内容过大"
        : status < 500 && error.message
          ? error.message
          : "服务器出了点问题，请稍后再试。";
    res.status(status).json({ error: message });
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
