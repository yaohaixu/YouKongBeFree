const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cookieParser = require("cookie-parser");
const express = require("express");
const multer = require("multer");

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
const TEXT_LIMITS = {
  nickname: 32,
  moduleName: 32,
  moduleDescription: 120,
  title: 80,
  initiator: 32,
  location: 120,
  description: 5000,
  reviewComment: 500,
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
    const error = new Error("只支持 JPG、PNG、WebP 或 GIF 图片，单张不超过 6MB");
    error.statusCode = 400;
    callback(error);
    return;
  }
  callback(null, true);
}

const localUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const ext = safeImageExtension(file.originalname);
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  fileFilter: uploadFileFilter,
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 1,
  },
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: uploadFileFilter,
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 1,
  },
});

const upload = process.env.STORE_DRIVER === "cloudbase" ? memoryUpload : localUpload;
const ACTIVITY_STATUS = {
  DRAFT: "draft",
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
const REGISTRATION_OPEN_STATUSES = [ACTIVITY_STATUS.PUBLISHED];
const REVIEW_ACTIONS = ["approve", "reject", "return"];
const DEFAULT_ACTIVITY_CAPACITY = 99;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
const LOG_ACTION_LABELS = {
  login: "登录",
  logout: "退出",
  "user.create": "新增成员",
  "user.update": "保存成员",
  "user.delete": "删除成员",
  "module.create": "新增模块",
  "module.update": "保存模块",
  "module.delete": "删除模块",
  "activity.create_draft": "保存活动草稿",
  "activity.create_submit": "提交活动审核",
  "activity.update_draft": "保存活动草稿",
  "activity.update_submit": "重新提交活动审核",
  "activity.withdraw": "撤回活动",
  "activity.review.approve": "审核通过",
  "activity.review.return": "审核退回",
  "activity.review.reject": "审核拒绝",
  "activity.cancel": "取消活动",
  "activity.end": "结束活动",
  "registration.create": "新增报名",
  "registration.delete": "删除报名",
  "registration.cancel": "取消报名",
};

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function publicUser(user, options = {}) {
  if (!user) return null;
  const roles = normalizeRoles(user);
  const payload = {
    id: user.id,
    nickname: user.nickname,
    role: roles.includes("admin") ? "admin" : roles[0] || "member",
    roles,
  };
  if (options.includePhone) {
    payload.phone = user.phone;
  }
  return payload;
}

function cleanText(value = "") {
  return String(value || "").replace(/\u0000/g, "").trim();
}

function isValidPhone(phone = "") {
  return /^\d{8,20}$/.test(phone);
}

function validateTextLength(label, value, max) {
  return String(value || "").length > max ? `${label}不能超过 ${max} 个字符` : "";
}

function parseActivityInput(body, fallbackInitiator = "") {
  const title = cleanText(body.title);
  const moduleId = cleanText(body.moduleId);
  const startsAt = cleanText(body.startsAt);
  const location = cleanText(body.location);
  const initiator = cleanText(body.initiator || fallbackInitiator);
  const capacityValue = cleanText(body.capacity);
  const description = cleanText(body.description);
  const collaboratorId = cleanText(body.collaboratorId);

  const capacity = capacityValue ? Number(capacityValue) : DEFAULT_ACTIVITY_CAPACITY;
  return {
    title,
    moduleId,
    startsAt,
    location,
    initiator,
    capacity,
    capacityValue,
    description,
    collaboratorId,
  };
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
    .filter((role) => ["admin", "member", "collaborator"].includes(role));
  if (roles.includes("admin")) return ["admin"];
  if (roles.includes("collaborator")) return ["collaborator"];
  return ["member"];
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
  if (item.status === ACTIVITY_STATUS.RETURNED) return "已退回发起人";
  if (item.status === ACTIVITY_STATUS.REJECTED) return "已拒绝";
  if (item.status === ACTIVITY_STATUS.DRAFT) return "草稿";
  return statusLabel(item.status);
}

async function validateActivityInput(input, activityId = "", options = {}) {
  const asDraft = options.asDraft === true;
  if (!input.title || !input.moduleId || (!asDraft && (!input.startsAt || !input.location || !input.initiator || !input.description || !input.collaboratorId))) {
    return "请填写标题、模块、协作员、发起人、时间、地点和活动描述";
  }

  const lengthError = [
    validateTextLength("活动标题", input.title, TEXT_LIMITS.title),
    validateTextLength("发起人", input.initiator, TEXT_LIMITS.initiator),
    validateTextLength("地点", input.location, TEXT_LIMITS.location),
    validateTextLength("活动描述", input.description, TEXT_LIMITS.description),
  ].find(Boolean);
  if (lengthError) return lengthError;

  if (input.startsAt && Number.isNaN(new Date(input.startsAt).getTime())) {
    return "活动时间格式不正确";
  }

  if (!Number.isFinite(input.capacity) || input.capacity <= 0 || input.capacity > DEFAULT_ACTIVITY_CAPACITY) {
    return `人数限额需要是 1-${DEFAULT_ACTIVITY_CAPACITY} 之间的数字，留空默认 ${DEFAULT_ACTIVITY_CAPACITY} 人`;
  }

  if (!(await store.find("modules", (item) => item.id === input.moduleId))) {
    return "请选择有效模块";
  }

  if (input.collaboratorId) {
    const collaborator = await store.find("users", (item) => item.id === input.collaboratorId);
    if (!collaborator || !isCollaborator(collaborator)) {
      return "请选择有效协作员";
    }
  }

  if (activityId && input.capacity !== null) {
    const registrations = (await store.all("registrations")).filter((item) => item.activityId === activityId);
    if (input.capacity < registrations.length) {
      return `当前已有 ${registrations.length} 人报名，人数限额不能小于已报名人数`;
    }
  }

  return "";
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
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
  const session = await store.find("sessions", (item) => item.tokenHash === tokenHash || item.token === token);
  if (!session) return null;
  if (isSessionExpired(session)) {
    await store.remove("sessions", (item) => item.id === session.id || item.tokenHash === tokenHash || item.token === token);
    return null;
  }
  return store.find("users", (user) => user.id === session.userId);
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

function effectiveCapacity(activity) {
  const capacity = Number(activity?.capacity || DEFAULT_ACTIVITY_CAPACITY);
  if (!Number.isFinite(capacity) || capacity <= 0) return DEFAULT_ACTIVITY_CAPACITY;
  return Math.min(capacity, DEFAULT_ACTIVITY_CAPACITY);
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

function activitySortRules(sort = "created-desc") {
  if (sort === "start-asc") return [{ field: "startsAt", direction: "asc" }, { field: "createdAt", direction: "desc" }];
  if (sort === "start-desc") return [{ field: "startsAt", direction: "desc" }, { field: "createdAt", direction: "desc" }];
  if (sort === "registrations-desc") return [{ field: "registrationCount", direction: "desc" }, { field: "createdAt", direction: "desc" }];
  return [{ field: "createdAt", direction: "desc" }];
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

function impossibleFilter() {
  return { field: "id", op: "eq", value: "__none__" };
}

async function writeLog(req, action, options = {}) {
  try {
    const currentUser = options.user || req.currentUser || await getCurrentUser(req);
    const now = new Date().toISOString();
    await store.insert("logs", {
      id: makeId("log"),
      action,
      actionLabel: LOG_ACTION_LABELS[action] || action,
      actorId: currentUser ? currentUser.id : "",
      actorName: options.actorName || (currentUser ? currentUser.nickname : "访客"),
      actorRole: currentUser ? (publicUser(currentUser).role || "member") : "guest",
      actorPhone: options.actorPhone || (currentUser ? currentUser.phone || "" : ""),
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

async function toActivityPayload(activity) {
  activity = normalizeActivity(activity);
  const [modules, users, registrations] = await Promise.all([
    store.all("modules"),
    store.all("users"),
    store.all("registrations"),
  ]);
  const module = modules.find((item) => item.id === activity.moduleId);
  const owner = users.find((item) => item.id === activity.createdBy);
  const collaborator = users.find((item) => item.id === activity.collaboratorId);
  const activityRegistrations = registrations.filter((item) => item.activityId === activity.id);
  const capacity = effectiveCapacity(activity);
  const derivedStatus = capacity && activityRegistrations.length >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
    ? ACTIVITY_STATUS.FULL
    : activity.status;
  return withCoverUrl({
    ...activity,
    capacity,
    status: derivedStatus,
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
  const [modules, users, registrations] = await Promise.all([
    store.all("modules"),
    store.all("users"),
    store.all("registrations"),
  ]);
  return Promise.all(activities.map((source) => {
    const activity = normalizeActivity(source);
    const module = modules.find((item) => item.id === activity.moduleId);
    const owner = users.find((item) => item.id === activity.createdBy);
    const collaborator = users.find((item) => item.id === activity.collaboratorId);
    const activityRegistrations = registrations.filter((item) => item.activityId === activity.id);
    const capacity = effectiveCapacity(activity);
    const derivedStatus = capacity && activityRegistrations.length >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
      ? ACTIVITY_STATUS.FULL
      : activity.status;
    return withCoverUrl({
      ...activity,
      capacity,
      status: derivedStatus,
      statusLabel: statusLabel(derivedStatus),
      reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
      moduleName: module ? module.name : "未归类",
      creatorName: owner ? owner.nickname : activity.initiator,
      collaboratorName: collaborator ? collaborator.nickname : "",
      registrationCount: activityRegistrations.length,
      spotsLeft: Math.max(capacity - activityRegistrations.length, 0),
    });
  }));
}

function canSeeActivity(activity, user) {
  activity = normalizeActivity(activity);
  if (PUBLIC_ACTIVITY_STATUSES.includes(activity.status)) return true;
  if (!user) return false;
  return isAdmin(user) || activity.createdBy === user.id || activity.collaboratorId === user.id;
}

function canEditActivity(activity, user) {
  activity = normalizeActivity(activity);
  if (!user) return false;
  if (isAdmin(user)) return activity.status !== ACTIVITY_STATUS.REJECTED;
  if (activity.createdBy !== user.id) return false;
  return [ACTIVITY_STATUS.DRAFT, ACTIVITY_STATUS.RETURNED].includes(activity.status);
}

function canWithdrawActivity(activity, user) {
  activity = normalizeActivity(activity);
  if (!user) return false;
  if (!isAdmin(user) && activity.createdBy !== user.id) return false;
  return [ACTIVITY_STATUS.ADMIN_REVIEW, ACTIVITY_STATUS.COLLABORATOR_REVIEW, ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status);
}

function pendingForUser(activity, user) {
  activity = normalizeActivity(activity);
  if (!user) return false;
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
  const actorRole = activity.status === ACTIVITY_STATUS.ADMIN_REVIEW ? "admin" : "collaborator";
  let nextStatus = activity.status;
  let nextStep = activity.reviewStep;
  if (action === "approve" && activity.status === ACTIVITY_STATUS.ADMIN_REVIEW) {
    nextStatus = ACTIVITY_STATUS.COLLABORATOR_REVIEW;
    nextStep = "collaborator";
  } else if (action === "approve" && activity.status === ACTIVITY_STATUS.COLLABORATOR_REVIEW) {
    nextStatus = ACTIVITY_STATUS.PUBLISHED;
    nextStep = "";
  } else if (action === "return") {
    nextStatus = ACTIVITY_STATUS.RETURNED;
    nextStep = "";
  } else if (action === "reject") {
    nextStatus = ACTIVITY_STATUS.REJECTED;
    nextStep = "";
  }

  return store.update("activities", activity.id, {
    status: nextStatus,
    reviewStep: nextStep,
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
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
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
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://youkong-d5gh4x0ayc29a2187.service.tcloudbase.com",
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
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(securityHeaders);
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

  app.get("/api/session", asyncRoute(async (req, res) => {
    res.json({ user: publicUser(await getCurrentUser(req)) });
  }));

  app.post("/api/login", loginIpRateLimiter, loginRateLimiter, asyncRoute(async (req, res) => {
    const phone = cleanPhone(req.body.phone);
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: "请输入有效手机号" });
      return;
    }
    const user = await store.find("users", (item) => item.phone === phone);

    if (!user) {
      res.status(401).json({ error: "手机号暂时不能登录，请确认已由 YKadmin 添加。" });
      return;
    }

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
      detail: "成员登录系统",
    });
    res.json({ user: publicUser(user), token });
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
        detail: "成员退出系统",
      });
    }
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
    res.json({ ok: true });
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

  app.get("/api/collaborators", requireLogin, asyncRoute(async (_req, res) => {
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
    const finalRoles = roles.length ? [roles[0]] : ["member"];
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

    if (await store.find("users", (item) => item.phone === phone)) {
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
      detail: `新增${role === "collaborator" ? "协作员" : "成员"}：${user.nickname}`,
    });
    res.json({ user: publicUser(user, { includePhone: true }) });
  }));

  app.put("/api/users/:id", requireAdmin, asyncRoute(async (req, res) => {
    const user = await store.find("users", (item) => item.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: "找不到该成员" });
      return;
    }

    const nickname = cleanText(req.body.nickname);
    const phone = cleanPhone(req.body.phone);
    const roles = user.id === "admin"
      ? ["admin"]
      : normalizeRoles(req.body).filter((role) => role !== "admin");
    const finalRoles = roles.length ? [roles[0]] : ["member"];
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

    const duplicated = await store.find("users", (item) => item.id !== user.id && item.phone === phone);
    if (duplicated) {
      res.status(409).json({ error: "这个手机号已经被其他成员使用" });
      return;
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
      detail: `保存成员：${updated.nickname}`,
    });
    res.json({ user: publicUser(updated, { includePhone: true }) });
  }));

  app.delete("/api/users/:id", requireAdmin, asyncRoute(async (req, res) => {
    if (req.params.id === "admin") {
      res.status(400).json({ error: "默认 YKadmin 不能删除" });
      return;
    }
    const user = await store.find("users", (item) => item.id === req.params.id);
    await store.remove("users", (item) => item.id === req.params.id);
    await store.remove("sessions", (item) => item.userId === req.params.id);
    await writeLog(req, "user.delete", {
      targetType: "user",
      targetId: req.params.id,
      targetName: user ? user.nickname : req.params.id,
      detail: `删除成员：${user ? user.nickname : req.params.id}`,
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
    const module = await store.find("modules", (item) => item.id === req.params.id);
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
    const activity = await store.find("activities", (item) => item.moduleId === req.params.id);
    if (activity) {
      res.status(400).json({ error: "已有活动使用该模块，暂时不能删除" });
      return;
    }
    const module = await store.find("modules", (item) => item.id === req.params.id);
    await store.remove("modules", (item) => item.id === req.params.id);
    await writeLog(req, "module.delete", {
      targetType: "module",
      targetId: req.params.id,
      targetName: module ? module.name : req.params.id,
      detail: `删除活动模块：${module ? module.name : req.params.id}`,
    });
    res.json({ ok: true });
  }));

  app.get("/api/activities", asyncRoute(async (req, res) => {
    const owner = req.query.owner;
    const pending = req.query.pending;
    const all = req.query.all;
    const user = await getCurrentUser(req);
    const filters = [];
    if (owner === "me") {
      filters.push(user ? { field: "createdBy", op: "eq", value: user.id } : impossibleFilter());
    } else if (pending === "me") {
      if (!user) {
        filters.push(impossibleFilter());
      } else if (isAdmin(user)) {
        filters.push({ field: "status", op: "eq", value: ACTIVITY_STATUS.ADMIN_REVIEW });
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
      filters.push({ field: "status", op: "in", value: PUBLIC_ACTIVITY_STATUSES });
    }

    const keyword = cleanText(req.query.q).toLowerCase();
    const status = cleanText(req.query.status);
    const moduleId = cleanText(req.query.moduleId);
    if (status) filters.push({ field: "status", op: "eq", value: status });
    if (moduleId) filters.push({ field: "moduleId", op: "eq", value: moduleId });
    filters.push(...activityDateFilters(req.query));

    const { data: activities, pageInfo } = await store.query("activities", {
      ...pageQueryOptions(req.query),
      filters,
      keyword,
      keywordFields: ["title", "initiator", "location", "description"],
      sort: activitySortRules(req.query.sort || (owner || pending || all ? "created-desc" : "start-asc")),
    });
    res.json({ activities: await toActivityListPayload(activities), pageInfo });
  }));

  app.get("/api/activities/:id", asyncRoute(async (req, res) => {
    const user = await getCurrentUser(req);
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canSeeActivity(activity, user)) {
      res.status(403).json({ error: "这个活动还没有公开发布" });
      return;
    }
    res.json({ activity: await toActivityPayload(activity) });
  }));

  app.post("/api/activities", requireLogin, upload.single("cover"), asyncRoute(async (req, res) => {
    const input = parseActivityInput(req.body, req.currentUser.nickname);
    const intent = req.body.intent === "draft" ? "draft" : "submit";
    const asDraft = intent === "draft";
    const error = await validateActivityInput(input, "", { asDraft });
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const now = new Date().toISOString();
    let coverUrl = "";
    let coverFileId = "";
    if (req.file) {
      const uploaded = await store.saveUpload(req.file);
      coverUrl = uploaded.url;
      coverFileId = uploaded.fileId;
    }

    const activity = {
      id: makeId("activity"),
      title: input.title,
      moduleId: input.moduleId,
      initiator: input.initiator,
      startsAt: input.startsAt,
      location: input.location,
      capacity: input.capacity,
      description: input.description,
      collaboratorId: input.collaboratorId,
      coverUrl,
      coverFileId,
      registrationCount: 0,
      status: asDraft ? ACTIVITY_STATUS.DRAFT : ACTIVITY_STATUS.ADMIN_REVIEW,
      reviewStep: asDraft ? "" : "admin",
      reviewLogs: [],
      createdBy: req.currentUser.id,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("activities", activity);
    await writeLog(req, asDraft ? "activity.create_draft" : "activity.create_submit", {
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: asDraft ? `保存活动草稿：${activity.title}` : `提交活动审核：${activity.title}`,
    });
    res.json({ activity: await toActivityPayload(activity) });
  }));

  app.put("/api/activities/:id", requireLogin, upload.single("cover"), asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canEditActivity(activity, req.currentUser)) {
      res.status(403).json({ error: "当前状态下不能编辑这个活动" });
      return;
    }

    const input = parseActivityInput(req.body, activity.initiator);
    const intent = req.body.intent === "draft" ? "draft" : "submit";
    const asDraft = intent === "draft";
    const error = await validateActivityInput(input, activity.id, { asDraft });
    if (error) {
      res.status(400).json({ error });
      return;
    }

    let coverUrl = activity.coverUrl || "";
    let coverFileId = activity.coverFileId || "";
    if (req.file) {
      const uploaded = await store.saveUpload(req.file);
      coverUrl = uploaded.url;
      coverFileId = uploaded.fileId;
    }

    const updated = await store.update("activities", activity.id, {
      title: input.title,
      moduleId: input.moduleId,
      initiator: input.initiator,
      startsAt: input.startsAt,
      location: input.location,
      capacity: input.capacity,
      description: input.description,
      collaboratorId: input.collaboratorId,
      coverUrl,
      coverFileId,
      status: asDraft ? ACTIVITY_STATUS.DRAFT : ACTIVITY_STATUS.ADMIN_REVIEW,
      reviewStep: asDraft ? "" : "admin",
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, asDraft ? "activity.update_draft" : "activity.update_submit", {
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: asDraft ? `保存活动草稿：${updated.title}` : `重新提交活动审核：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/activities/:id/review", requireLogin, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    try {
      const updated = await reviewActivity(activity, req.currentUser, req.body.action, req.body.comment);
      await writeLog(req, `activity.review.${req.body.action}`, {
        targetType: "activity",
        targetId: updated.id,
        targetName: updated.title,
        detail: `${LOG_ACTION_LABELS[`activity.review.${req.body.action}`] || "审核活动"}：${updated.title}`,
      });
      res.json({ activity: await toActivityPayload(updated) });
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
    }
  }));

  app.post("/api/activities/:id/withdraw", requireLogin, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!canWithdrawActivity(activity, req.currentUser)) {
      res.status(403).json({ error: "当前状态不能撤回" });
      return;
    }
    const now = new Date().toISOString();
    const updated = await store.update("activities", activity.id, {
      status: ACTIVITY_STATUS.DRAFT,
      reviewStep: "",
      reviewLogs: [
        ...activity.reviewLogs,
        {
          id: makeId("review"),
          action: "withdraw",
          comment: "发起人撤回活动",
          actorId: req.currentUser.id,
          actorName: req.currentUser.nickname,
          actorRole: isAdmin(req.currentUser) ? "admin" : "member",
          createdAt: now,
        },
      ],
      updatedAt: now,
    });
    await writeLog(req, "activity.withdraw", {
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `撤回活动：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/activities/:id/cancel", requireAdmin, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if ([ACTIVITY_STATUS.CANCELLED, ACTIVITY_STATUS.ENDED, ACTIVITY_STATUS.REJECTED].includes(activity.status)) {
      res.status(400).json({ error: "当前状态不能取消活动" });
      return;
    }
    const updated = await store.update("activities", activity.id, {
      status: ACTIVITY_STATUS.CANCELLED,
      reviewStep: "",
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "activity.cancel", {
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `取消活动：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/activities/:id/end", requireAdmin, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (![ACTIVITY_STATUS.PUBLISHED, ACTIVITY_STATUS.FULL].includes(activity.status)) {
      res.status(400).json({ error: "只有已发布或已满员活动可以结束" });
      return;
    }
    const updated = await store.update("activities", activity.id, {
      status: ACTIVITY_STATUS.ENDED,
      updatedAt: new Date().toISOString(),
    });
    await writeLog(req, "activity.end", {
      targetType: "activity",
      targetId: updated.id,
      targetName: updated.title,
      detail: `结束活动：${updated.title}`,
    });
    res.json({ activity: await toActivityPayload(updated) });
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

    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    const registrations = (await store.all("registrations")).filter((item) => item.activityId === activity.id);
    const existing = registrations.find((item) => item.phone === phone);
    if (existing && PUBLIC_ACTIVITY_STATUSES.includes(activity.status)) {
      res.json({ registration: existing, activity: await toActivityPayload(activity), existing: true });
      return;
    }
    if (!REGISTRATION_OPEN_STATUSES.includes(activity.status)) {
      res.status(400).json({ error: "这个活动还没有开放报名" });
      return;
    }
    const capacity = effectiveCapacity(activity);
    if (registrations.length >= capacity) {
      res.status(400).json({ error: "这个活动名额已经满了" });
      return;
    }

    const registration = {
      id: makeId("reg"),
      activityId: activity.id,
      nickname,
      phone,
      createdAt: new Date().toISOString(),
    };
    await store.insert("registrations", registration);
    await writeLog(req, "registration.create", {
      actorName: nickname,
      actorPhone: phone,
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `报名活动：${activity.title}`,
    });
    const nextRegistrationCount = registrations.length + 1;
    if (registrations.length + 1 >= capacity && activity.status === ACTIVITY_STATUS.PUBLISHED) {
      await store.update("activities", activity.id, {
        registrationCount: nextRegistrationCount,
        status: ACTIVITY_STATUS.FULL,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await store.update("activities", activity.id, {
        registrationCount: nextRegistrationCount,
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({ registration, activity: await toActivityPayload(activity) });
  }));

  app.get("/api/activities/:id/registrations/:registrationId", asyncRoute(async (req, res) => {
    const activity = await store.find("activities", (item) => item.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    const registration = await store.find(
      "registrations",
      (item) => item.id === req.params.registrationId && item.activityId === activity.id
    );
    if (!registration) {
      res.status(404).json({ error: "找不到该报名记录" });
      return;
    }
    res.json({ registration, activity: await toActivityPayload(activity) });
  }));

  app.get("/api/activities/:id/registrations", requireLogin, asyncRoute(async (req, res) => {
    const activity = await store.find("activities", (item) => item.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!isAdmin(req.currentUser) && activity.createdBy !== req.currentUser.id) {
      res.status(403).json({ error: "只有活动发起人或管理员可以查看报名表" });
      return;
    }
    const registrations = (await store.all("registrations")).filter((item) => item.activityId === activity.id);
    res.json({ registrations });
  }));

  app.delete("/api/activities/:id/registrations/:registrationId", requireLogin, asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!isAdmin(req.currentUser) && activity.createdBy !== req.currentUser.id) {
      res.status(403).json({ error: "只有活动发起人或管理员可以删除报名记录" });
      return;
    }
    const removed = await store.remove(
      "registrations",
      (item) => item.id === req.params.registrationId && item.activityId === activity.id
    );
    if (!removed) {
      res.status(404).json({ error: "找不到该报名记录" });
      return;
    }
    const remainingCount = (await store.all("registrations")).filter((item) => item.activityId === activity.id).length;
    if (activity.status === ACTIVITY_STATUS.FULL) {
      await store.update("activities", activity.id, {
        registrationCount: remainingCount,
        status: ACTIVITY_STATUS.PUBLISHED,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await store.update("activities", activity.id, {
        registrationCount: remainingCount,
        updatedAt: new Date().toISOString(),
      });
    }
    await writeLog(req, "registration.delete", {
      targetType: "activity",
      targetId: activity.id,
      targetName: activity.title,
      detail: `删除报名记录：${activity.title}`,
    });
    res.json({ ok: true });
  }));

  app.post("/api/activities/:id/registrations/:registrationId/cancel", asyncRoute(async (req, res) => {
    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    const registration = await store.find(
      "registrations",
      (item) => item.id === req.params.registrationId && item.activityId === activity.id
    );
    if (!registration) {
      res.status(404).json({ error: "找不到该报名记录" });
      return;
    }
    await store.remove(
      "registrations",
      (item) => item.id === registration.id && item.activityId === activity.id
    );
    const remainingCount = (await store.all("registrations")).filter((item) => item.activityId === activity.id).length;
    if (activity.status === ACTIVITY_STATUS.FULL) {
      await store.update("activities", activity.id, {
        registrationCount: remainingCount,
        status: ACTIVITY_STATUS.PUBLISHED,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await store.update("activities", activity.id, {
        registrationCount: remainingCount,
        updatedAt: new Date().toISOString(),
      });
    }
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

  app.get("/api/logs", requireAdmin, asyncRoute(async (req, res) => {
    const keyword = cleanText(req.query.q).toLowerCase();
    const { data, pageInfo } = await store.query("logs", {
      ...pageQueryOptions(req.query),
      keyword,
      keywordFields: [
        "action",
        "actionLabel",
        "actorName",
        "actorPhone",
        "actorRole",
        "targetType",
        "targetId",
        "targetName",
        "detail",
      ],
      sort: [{ field: "createdAt", direction: "desc" }],
    });
    res.json({ logs: data, pageInfo });
  }));

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || error.status || (error.code === "LIMIT_FILE_SIZE" ? 400 : 500);
    if (status >= 500) {
      console.error(error);
    }
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "图片不能超过 6MB"
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
  const app = createApp(options);
  return app.listen(port, options.host || "0.0.0.0", () => {
    console.log(`有空客厅正在运行：http://127.0.0.1:${port}`);
    console.log(`数据驱动：${process.env.STORE_DRIVER || "json"}`);
  });
}

module.exports = {
  createApp,
  startServer,
  store,
};
