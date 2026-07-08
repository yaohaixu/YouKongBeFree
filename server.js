const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const cookieParser = require("cookie-parser");
const express = require("express");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "youkong-db.json");
const SESSION_COOKIE = "yk_session";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
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

function createDefaultDb() {
  const now = new Date().toISOString();
  const adminPhone = cleanPhone(process.env.YKADMIN_PHONE || "18800000000");
  const adminNickname = String(process.env.YKADMIN_NICKNAME || "YKadmin").trim() || "YKadmin";
  return {
    users: [
      {
        id: "admin",
        nickname: adminNickname,
        phone: adminPhone,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
    ],
    modules: [
      { id: "screening", name: "有空放映", description: "电影、纪录片、影像讨论", createdAt: now },
      { id: "canteen", name: "有空食堂", description: "一起做饭、饭桌与附近小店探索", createdAt: now },
      { id: "salon", name: "公共议题", description: "讨论、共识辩论和公共生活实践", createdAt: now },
      { id: "walk", name: "城市漫游", description: "上山下江、菜市场和街区探索", createdAt: now },
    ],
    activities: [],
    registrations: [],
    sessions: [],
  };
}

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    writeDb(createDefaultDb());
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function cleanPhone(phone = "") {
  return String(phone).replace(/\D/g, "");
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

function getCurrentUser(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const db = readDb();
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireLogin(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "请先登录" });
    return;
  }
  req.currentUser = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "仅 YKadmin 管理员可操作" });
    return;
  }
  req.currentUser = user;
  next();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function toActivityPayload(activity, db) {
  const module = db.modules.find((item) => item.id === activity.moduleId);
  const owner = db.users.find((item) => item.id === activity.createdBy);
  const registrations = db.registrations.filter((item) => item.activityId === activity.id);
  return {
    ...activity,
    moduleName: module ? module.name : "未归类",
    creatorName: owner ? owner.nickname : activity.initiator,
    registrationCount: registrations.length,
    spotsLeft: activity.capacity ? Math.max(activity.capacity - registrations.length, 0) : null,
  };
}

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(__dirname, { extensions: ["html"] }));

app.get("/api/session", (req, res) => {
  res.json({ user: publicUser(getCurrentUser(req)) });
});

app.post("/api/login", (req, res) => {
  const phone = cleanPhone(req.body.phone);
  const db = readDb();
  const user = db.users.find((item) => item.phone === phone);

  if (!user) {
    res.status(401).json({ error: "这个手机号还没有被 YKadmin 添加，暂时不能登录。" });
    return;
  }

  const token = crypto.randomBytes(24).toString("hex");
  db.sessions.push({
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    const db = readDb();
    db.sessions = db.sessions.filter((item) => item.token !== token);
    writeDb(db);
  }
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get("/api/users", requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({ users: db.users.map(publicUser) });
});

app.post("/api/users", requireAdmin, (req, res) => {
  const nickname = String(req.body.nickname || "").trim();
  const phone = cleanPhone(req.body.phone);
  const role = req.body.role === "admin" ? "admin" : "member";

  if (!nickname || !phone) {
    res.status(400).json({ error: "昵称和手机号都需要填写" });
    return;
  }

  const db = readDb();
  if (db.users.some((item) => item.phone === phone)) {
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
  db.users.push(user);
  writeDb(db);
  res.json({ user: publicUser(user) });
});

app.put("/api/users/:id", requireAdmin, (req, res) => {
  const db = readDb();
  const user = db.users.find((item) => item.id === req.params.id);
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

  if (db.users.some((item) => item.id !== user.id && item.phone === phone)) {
    res.status(409).json({ error: "这个手机号已经被其他成员使用" });
    return;
  }

  user.nickname = nickname;
  user.phone = phone;
  user.role = role;
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ user: publicUser(user) });
});

app.delete("/api/users/:id", requireAdmin, (req, res) => {
  if (req.params.id === "admin") {
    res.status(400).json({ error: "默认 YKadmin 不能删除" });
    return;
  }
  const db = readDb();
  db.users = db.users.filter((item) => item.id !== req.params.id);
  db.sessions = db.sessions.filter((item) => item.userId !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

app.get("/api/modules", (_req, res) => {
  const db = readDb();
  res.json({ modules: db.modules });
});

app.post("/api/modules", requireAdmin, (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  if (!name) {
    res.status(400).json({ error: "模块名称不能为空" });
    return;
  }
  const db = readDb();
  const module = {
    id: makeId("module"),
    name,
    description,
    createdAt: new Date().toISOString(),
  };
  db.modules.push(module);
  writeDb(db);
  res.json({ module });
});

app.put("/api/modules/:id", requireAdmin, (req, res) => {
  const db = readDb();
  const module = db.modules.find((item) => item.id === req.params.id);
  if (!module) {
    res.status(404).json({ error: "找不到该模块" });
    return;
  }
  module.name = String(req.body.name || "").trim();
  module.description = String(req.body.description || "").trim();
  writeDb(db);
  res.json({ module });
});

app.delete("/api/modules/:id", requireAdmin, (req, res) => {
  const db = readDb();
  if (db.activities.some((item) => item.moduleId === req.params.id)) {
    res.status(400).json({ error: "已有活动使用该模块，暂时不能删除" });
    return;
  }
  db.modules = db.modules.filter((item) => item.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

app.get("/api/activities", (req, res) => {
  const db = readDb();
  const owner = req.query.owner;
  let activities = db.activities;
  if (owner === "me") {
    const user = getCurrentUser(req);
    activities = user ? activities.filter((item) => item.createdBy === user.id) : [];
  }
  activities = activities
    .slice()
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .map((item) => toActivityPayload(item, db));
  res.json({ activities });
});

app.get("/api/activities/:id", (req, res) => {
  const db = readDb();
  const activity = db.activities.find((item) => item.id === req.params.id);
  if (!activity) {
    res.status(404).json({ error: "找不到该活动" });
    return;
  }
  res.json({ activity: toActivityPayload(activity, db) });
});

app.post("/api/activities", requireLogin, upload.single("cover"), (req, res) => {
  const title = String(req.body.title || "").trim();
  const moduleId = String(req.body.moduleId || "").trim();
  const startsAt = String(req.body.startsAt || "").trim();
  const location = String(req.body.location || "").trim();
  const initiator = String(req.body.initiator || req.currentUser.nickname).trim();
  const capacityValue = String(req.body.capacity || "").trim();
  const description = String(req.body.description || "").trim();

  if (!title || !moduleId || !startsAt || !location || !initiator || !description) {
    res.status(400).json({ error: "请填写标题、模块、发起人、时间、地点和活动描述" });
    return;
  }

  const capacity = capacityValue ? Number(capacityValue) : null;
  if (capacity !== null && (!Number.isFinite(capacity) || capacity <= 0)) {
    res.status(400).json({ error: "人数限额需要是正数，或留空表示无上限" });
    return;
  }

  const db = readDb();
  if (!db.modules.some((item) => item.id === moduleId)) {
    res.status(400).json({ error: "请选择有效模块" });
    return;
  }

  const now = new Date().toISOString();
  const activity = {
    id: makeId("activity"),
    title,
    moduleId,
    initiator,
    startsAt,
    location,
    capacity,
    description,
    coverUrl: req.file ? `/uploads/${req.file.filename}` : "",
    createdBy: req.currentUser.id,
    createdAt: now,
    updatedAt: now,
  };
  db.activities.push(activity);
  writeDb(db);
  res.json({ activity: toActivityPayload(activity, db) });
});

app.post("/api/activities/:id/register", (req, res) => {
  const nickname = String(req.body.nickname || "").trim();
  const phone = cleanPhone(req.body.phone);
  if (!nickname || !phone) {
    res.status(400).json({ error: "请填写昵称和手机号" });
    return;
  }

  const db = readDb();
  const activity = db.activities.find((item) => item.id === req.params.id);
  if (!activity) {
    res.status(404).json({ error: "找不到该活动" });
    return;
  }

  const registrations = db.registrations.filter((item) => item.activityId === activity.id);
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
  db.registrations.push(registration);
  writeDb(db);
  res.json({ registration });
});

app.get("/api/activities/:id/registrations", requireLogin, (req, res) => {
  const db = readDb();
  const activity = db.activities.find((item) => item.id === req.params.id);
  if (!activity) {
    res.status(404).json({ error: "找不到该活动" });
    return;
  }
  if (req.currentUser.role !== "admin" && activity.createdBy !== req.currentUser.id) {
    res.status(403).json({ error: "只有活动发起人或管理员可以查看报名表" });
    return;
  }
  const registrations = db.registrations.filter((item) => item.activityId === activity.id);
  res.json({ registrations });
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`有空客厅正在运行：http://127.0.0.1:${PORT}`);
  console.log("默认管理员：YKadmin / 手机号 18800000000");
});
