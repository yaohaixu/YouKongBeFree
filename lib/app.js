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
const store = createStore();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const localUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
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
const REVIEW_ACTIONS = ["approve", "reject", "return"];

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function publicUser(user) {
  if (!user) return null;
  const roles = normalizeRoles(user);
  return {
    id: user.id,
    nickname: user.nickname,
    phone: user.phone,
    role: roles.includes("admin") ? "admin" : roles[0] || "member",
    roles,
  };
}

function parseActivityInput(body, fallbackInitiator = "") {
  const title = String(body.title || "").trim();
  const moduleId = String(body.moduleId || "").trim();
  const startsAt = String(body.startsAt || "").trim();
  const location = String(body.location || "").trim();
  const initiator = String(body.initiator || fallbackInitiator).trim();
  const capacityValue = String(body.capacity || "").trim();
  const description = String(body.description || "").trim();
  const collaboratorId = String(body.collaboratorId || "").trim();

  const capacity = capacityValue ? Number(capacityValue) : null;
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
  return Array.from(new Set(roles.length ? roles : ["member"]));
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

  if (input.capacity !== null && (!Number.isFinite(input.capacity) || input.capacity <= 0)) {
    return "人数限额需要是正数，或留空表示无上限";
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

async function getCurrentUser(req) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const token = req.cookies[SESSION_COOKIE] || bearer;
  if (!token) return null;
  const session = await store.find("sessions", (item) => item.token === token);
  if (!session) return null;
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
  const derivedStatus = activity.capacity && activityRegistrations.length >= activity.capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
    ? ACTIVITY_STATUS.FULL
    : activity.status;
  return withCoverUrl({
    ...activity,
    status: derivedStatus,
    statusLabel: statusLabel(derivedStatus),
    reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
    moduleName: module ? module.name : "未归类",
    creatorName: owner ? owner.nickname : activity.initiator,
    collaboratorName: collaborator ? collaborator.nickname : "",
    registrationCount: activityRegistrations.length,
    spotsLeft: activity.capacity ? Math.max(activity.capacity - activityRegistrations.length, 0) : null,
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
    const derivedStatus = activity.capacity && activityRegistrations.length >= activity.capacity && activity.status === ACTIVITY_STATUS.PUBLISHED
      ? ACTIVITY_STATUS.FULL
      : activity.status;
    return withCoverUrl({
      ...activity,
      status: derivedStatus,
      statusLabel: statusLabel(derivedStatus),
      reviewStepLabel: reviewStepLabel({ ...activity, status: derivedStatus }),
      moduleName: module ? module.name : "未归类",
      creatorName: owner ? owner.nickname : activity.initiator,
      collaboratorName: collaborator ? collaborator.nickname : "",
      registrationCount: activityRegistrations.length,
      spotsLeft: activity.capacity ? Math.max(activity.capacity - activityRegistrations.length, 0) : null,
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
        comment: String(comment || "").trim(),
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

function createApp(options = {}) {
  const app = express();
  const serveStatic = options.serveStatic !== false;
  const staticRoot = options.staticRoot || path.join(__dirname, "..");

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
      res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (serveStatic) {
    app.use("/uploads", express.static(UPLOAD_DIR));
    app.use(express.static(staticRoot, { extensions: ["html"] }));
  }

  app.get("/api/session", asyncRoute(async (req, res) => {
    res.json({ user: publicUser(await getCurrentUser(req)) });
  }));

  app.post("/api/login", asyncRoute(async (req, res) => {
    const phone = cleanPhone(req.body.phone);
    const user = await store.find("users", (item) => item.phone === phone);

    if (!user) {
      res.status(401).json({ error: "这个手机号还没有被 YKadmin 添加，暂时不能登录。" });
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    await store.insert("sessions", {
      id: makeId("session"),
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
    });

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: process.env.STORE_DRIVER === "cloudbase" ? "none" : "lax",
      secure: process.env.STORE_DRIVER === "cloudbase",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    res.json({ user: publicUser(user), token });
  }));

  app.post("/api/logout", asyncRoute(async (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      await store.remove("sessions", (item) => item.token === token);
    }
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  }));

  app.get("/api/users", requireAdmin, asyncRoute(async (_req, res) => {
    const users = await store.all("users");
    res.json({ users: users.map(publicUser) });
  }));

  app.get("/api/collaborators", requireLogin, asyncRoute(async (_req, res) => {
    const users = await store.all("users");
    res.json({
      collaborators: users
        .filter((user) => isCollaborator(user))
        .map(publicUser),
    });
  }));

  app.post("/api/users", requireAdmin, asyncRoute(async (req, res) => {
    const nickname = String(req.body.nickname || "").trim();
    const phone = cleanPhone(req.body.phone);
    const roles = normalizeRoles(req.body).filter((role) => role !== "admin");
    const finalRoles = roles.length ? roles : ["member"];
    const role = finalRoles[0];

    if (!nickname || !phone) {
      res.status(400).json({ error: "昵称和手机号都需要填写" });
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
    res.json({ user: publicUser(user) });
  }));

  app.put("/api/users/:id", requireAdmin, asyncRoute(async (req, res) => {
    const user = await store.find("users", (item) => item.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: "找不到该成员" });
      return;
    }

    const nickname = String(req.body.nickname || "").trim();
    const phone = cleanPhone(req.body.phone);
    const roles = user.id === "admin"
      ? ["admin"]
      : normalizeRoles(req.body).filter((role) => role !== "admin");
    const finalRoles = roles.length ? roles : ["member"];
    const role = finalRoles.includes("admin") ? "admin" : finalRoles[0];

    if (!nickname || !phone) {
      res.status(400).json({ error: "昵称和手机号都需要填写" });
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
    res.json({ user: publicUser(updated) });
  }));

  app.delete("/api/users/:id", requireAdmin, asyncRoute(async (req, res) => {
    if (req.params.id === "admin") {
      res.status(400).json({ error: "默认 YKadmin 不能删除" });
      return;
    }
    await store.remove("users", (item) => item.id === req.params.id);
    await store.remove("sessions", (item) => item.userId === req.params.id);
    res.json({ ok: true });
  }));

  app.get("/api/modules", asyncRoute(async (_req, res) => {
    res.json({ modules: await store.all("modules") });
  }));

  app.post("/api/modules", requireAdmin, asyncRoute(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    if (!name) {
      res.status(400).json({ error: "模块名称不能为空" });
      return;
    }
    const module = {
      id: makeId("module"),
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    await store.insert("modules", module);
    res.json({ module });
  }));

  app.put("/api/modules/:id", requireAdmin, asyncRoute(async (req, res) => {
    const module = await store.find("modules", (item) => item.id === req.params.id);
    if (!module) {
      res.status(404).json({ error: "找不到该模块" });
      return;
    }
    const updated = await store.update("modules", module.id, {
      name: String(req.body.name || "").trim(),
      description: String(req.body.description || "").trim(),
    });
    res.json({ module: updated });
  }));

  app.delete("/api/modules/:id", requireAdmin, asyncRoute(async (req, res) => {
    const activity = await store.find("activities", (item) => item.moduleId === req.params.id);
    if (activity) {
      res.status(400).json({ error: "已有活动使用该模块，暂时不能删除" });
      return;
    }
    await store.remove("modules", (item) => item.id === req.params.id);
    res.json({ ok: true });
  }));

  app.get("/api/activities", asyncRoute(async (req, res) => {
    const owner = req.query.owner;
    const pending = req.query.pending;
    const all = req.query.all;
    const user = await getCurrentUser(req);
    let activities = await store.all("activities");
    if (owner === "me") {
      activities = user ? activities.filter((item) => item.createdBy === user.id) : [];
    } else if (pending === "me") {
      activities = user ? activities.filter((item) => pendingForUser(item, user)) : [];
    } else if (all === "true") {
      if (!user || !isAdmin(user)) {
        res.status(403).json({ error: "仅 YKadmin 管理员可查看全部活动" });
        return;
      }
    } else {
      activities = activities.filter((item) => PUBLIC_ACTIVITY_STATUSES.includes(normalizeActivity(item).status));
    }
    activities = activities.slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    res.json({ activities: await toActivityListPayload(activities) });
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
      status: asDraft ? ACTIVITY_STATUS.DRAFT : ACTIVITY_STATUS.ADMIN_REVIEW,
      reviewStep: asDraft ? "" : "admin",
      reviewLogs: [],
      createdBy: req.currentUser.id,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("activities", activity);
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
    res.json({ activity: await toActivityPayload(updated) });
  }));

  app.post("/api/activities/:id/register", asyncRoute(async (req, res) => {
    const nickname = String(req.body.nickname || "").trim();
    const phone = cleanPhone(req.body.phone);
    if (!nickname || !phone) {
      res.status(400).json({ error: "请填写昵称和手机号" });
      return;
    }

    const activity = normalizeActivity(await store.find("activities", (item) => item.id === req.params.id));
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (!PUBLIC_ACTIVITY_STATUSES.includes(activity.status)) {
      res.status(400).json({ error: "这个活动还没有开放报名" });
      return;
    }

    const registrations = (await store.all("registrations")).filter((item) => item.activityId === activity.id);
    const existing = registrations.find((item) => item.phone === phone);
    if (existing) {
      res.json({ registration: existing, activity: await toActivityPayload(activity), existing: true });
      return;
    }
    if (activity.capacity && registrations.length >= activity.capacity) {
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
    if (activity.capacity && registrations.length + 1 >= activity.capacity && activity.status === ACTIVITY_STATUS.PUBLISHED) {
      await store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.FULL,
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
    if (activity.status === ACTIVITY_STATUS.FULL) {
      await store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.PUBLISHED,
        updatedAt: new Date().toISOString(),
      });
    }
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
    if (activity.status === ACTIVITY_STATUS.FULL) {
      await store.update("activities", activity.id, {
        status: ACTIVITY_STATUS.PUBLISHED,
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({ ok: true });
  }));

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "服务器出了点问题，请稍后再试。" });
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
