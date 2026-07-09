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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    nickname: user.nickname,
    phone: user.phone,
    role: user.role,
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
  };
}

async function validateActivityInput(input, activityId = "") {
  if (!input.title || !input.moduleId || !input.startsAt || !input.location || !input.initiator || !input.description) {
    return "请填写标题、模块、发起人、时间、地点和活动描述";
  }

  if (input.capacity !== null && (!Number.isFinite(input.capacity) || input.capacity <= 0)) {
    return "人数限额需要是正数，或留空表示无上限";
  }

  if (!(await store.find("modules", (item) => item.id === input.moduleId))) {
    return "请选择有效模块";
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
  const token = req.cookies[SESSION_COOKIE];
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
  if (!user || user.role !== "admin") {
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
  const [modules, users, registrations] = await Promise.all([
    store.all("modules"),
    store.all("users"),
    store.all("registrations"),
  ]);
  const module = modules.find((item) => item.id === activity.moduleId);
  const owner = users.find((item) => item.id === activity.createdBy);
  const activityRegistrations = registrations.filter((item) => item.activityId === activity.id);
  return withCoverUrl({
    ...activity,
    moduleName: module ? module.name : "未归类",
    creatorName: owner ? owner.nickname : activity.initiator,
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
  return Promise.all(activities.map((activity) => {
    const module = modules.find((item) => item.id === activity.moduleId);
    const owner = users.find((item) => item.id === activity.createdBy);
    const activityRegistrations = registrations.filter((item) => item.activityId === activity.id);
    return withCoverUrl({
      ...activity,
      moduleName: module ? module.name : "未归类",
      creatorName: owner ? owner.nickname : activity.initiator,
      registrationCount: activityRegistrations.length,
      spotsLeft: activity.capacity ? Math.max(activity.capacity - activityRegistrations.length, 0) : null,
    });
  }));
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
    res.json({ user: publicUser(user) });
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

  app.post("/api/users", requireAdmin, asyncRoute(async (req, res) => {
    const nickname = String(req.body.nickname || "").trim();
    const phone = cleanPhone(req.body.phone);
    const role = req.body.role === "admin" ? "admin" : "member";

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
    const role = req.body.role === "admin" ? "admin" : "member";

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
    let activities = await store.all("activities");
    if (owner === "me") {
      const user = await getCurrentUser(req);
      activities = user ? activities.filter((item) => item.createdBy === user.id) : [];
    }
    activities = activities.slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    res.json({ activities: await toActivityListPayload(activities) });
  }));

  app.get("/api/activities/:id", asyncRoute(async (req, res) => {
    const activity = await store.find("activities", (item) => item.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    res.json({ activity: await toActivityPayload(activity) });
  }));

  app.post("/api/activities", requireLogin, upload.single("cover"), asyncRoute(async (req, res) => {
    const input = parseActivityInput(req.body, req.currentUser.nickname);
    const error = await validateActivityInput(input);
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
      coverUrl,
      coverFileId,
      createdBy: req.currentUser.id,
      createdAt: now,
      updatedAt: now,
    };
    await store.insert("activities", activity);
    res.json({ activity: await toActivityPayload(activity) });
  }));

  app.put("/api/activities/:id", requireLogin, upload.single("cover"), asyncRoute(async (req, res) => {
    const activity = await store.find("activities", (item) => item.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (req.currentUser.role !== "admin" && activity.createdBy !== req.currentUser.id) {
      res.status(403).json({ error: "只有活动发起人或管理员可以编辑活动" });
      return;
    }

    const input = parseActivityInput(req.body, activity.initiator);
    const error = await validateActivityInput(input, activity.id);
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
      coverUrl,
      coverFileId,
      updatedAt: new Date().toISOString(),
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

    const activity = await store.find("activities", (item) => item.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }

    const registrations = (await store.all("registrations")).filter((item) => item.activityId === activity.id);
    if (activity.capacity && registrations.length >= activity.capacity) {
      res.status(400).json({ error: "这个活动名额已经满了" });
      return;
    }
    if (registrations.some((item) => item.phone === phone)) {
      res.status(409).json({ error: "这个手机号已经报名过该活动" });
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
    if (req.currentUser.role !== "admin" && activity.createdBy !== req.currentUser.id) {
      res.status(403).json({ error: "只有活动发起人或管理员可以查看报名表" });
      return;
    }
    const registrations = (await store.all("registrations")).filter((item) => item.activityId === activity.id);
    res.json({ registrations });
  }));

  app.delete("/api/activities/:id/registrations/:registrationId", requireLogin, asyncRoute(async (req, res) => {
    const activity = await store.find("activities", (item) => item.id === req.params.id);
    if (!activity) {
      res.status(404).json({ error: "找不到该活动" });
      return;
    }
    if (req.currentUser.role !== "admin" && activity.createdBy !== req.currentUser.id) {
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
