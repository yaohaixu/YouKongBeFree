const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cloudbase = require("@cloudbase/node-sdk");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = process.env.YK_DB_FILE
  ? path.resolve(process.env.YK_DB_FILE)
  : path.join(DATA_DIR, "youkong-db.json");
const COLLECTIONS = ["users", "modules", "activities", "registrations", "sessions"];
const DEFAULT_MODULES = [
  { id: "screening", name: "有空放映", description: "电影、纪录片、影像讨论" },
  { id: "canteen", name: "有空食堂", description: "一起做饭、饭桌与附近小店探索" },
  { id: "salon", name: "公共议题", description: "讨论、共识辩论和公共生活实践" },
  { id: "walk", name: "城市漫游", description: "上山下江、菜市场和街区探索" },
];

function cleanPhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function createDefaultDb() {
  const now = new Date().toISOString();
  const adminPhone = cleanPhone(process.env.YKADMIN_PHONE || "13377779999");
  const adminNickname = String(process.env.YKADMIN_NICKNAME || "有空管理员").trim() || "有空管理员";
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
    modules: DEFAULT_MODULES.map((item) => ({ ...item, createdAt: now })),
    activities: [],
    registrations: [],
    sessions: [],
  };
}

class JsonStore {
  constructor() {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      this.write(createDefaultDb());
    }
  }

  read() {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }

  write(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }

  async all(collection) {
    return this.read()[collection] || [];
  }

  async find(collection, predicate) {
    return (await this.all(collection)).find(predicate) || null;
  }

  async insert(collection, item) {
    const db = this.read();
    db[collection] = db[collection] || [];
    db[collection].push(item);
    this.write(db);
    return item;
  }

  async update(collection, id, patch) {
    const db = this.read();
    const items = db[collection] || [];
    const item = items.find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    this.write(db);
    return item;
  }

  async remove(collection, predicate) {
    const db = this.read();
    const items = db[collection] || [];
    const before = items.length;
    db[collection] = items.filter((item) => !predicate(item));
    this.write(db);
    return before - db[collection].length;
  }

  async ensureSeed() {
    return this.read();
  }

  async saveUpload(file) {
    return {
      fileId: "",
      url: file ? `/uploads/${file.filename}` : "",
    };
  }

  async getFileUrl(fileIdOrUrl) {
    return fileIdOrUrl || "";
  }
}

class CloudBaseStore {
  constructor() {
    const env = process.env.CLOUDBASE_ENV_ID || process.env.CBR_ENV_ID || process.env.TCB_ENV_ID || process.env.SCF_NAMESPACE;
    this.app = cloudbase.init(env ? { env } : {});
    this.db = this.app.database();
  }

  collection(name) {
    return this.db.collection(`yk_${name}`);
  }

  normalize(record) {
    if (!record) return null;
    const { _id, ...rest } = record;
    return rest.id ? rest : { ...rest, id: _id };
  }

  async all(collection) {
    const result = await this.collection(collection).limit(1000).get();
    return (result.data || []).map((item) => this.normalize(item));
  }

  async find(collection, predicate) {
    return (await this.all(collection)).find(predicate) || null;
  }

  async insert(collection, item) {
    await this.collection(collection).add(item);
    return item;
  }

  async update(collection, id, patch) {
    await this.collection(collection).where({ id }).update(patch);
    const updated = await this.find(collection, (item) => item.id === id);
    return updated;
  }

  async remove(collection, predicate) {
    const items = await this.all(collection);
    const matched = items.filter(predicate);
    await Promise.all(matched.map((item) => this.collection(collection).where({ id: item.id }).remove()));
    return matched.length;
  }

  async ensureCollections() {
    for (const collection of COLLECTIONS) {
      try {
        await this.db.createCollection(`yk_${collection}`);
      } catch {
        // Collection already exists or the platform created it lazily.
      }
    }
  }

  async saveUpload(file) {
    if (!file || !file.buffer) {
      return { fileId: "", url: "" };
    }

    const ext = path.extname(file.originalname || "").toLowerCase();
    const cloudPath = `activity-covers/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const result = await this.app.uploadFile({
      cloudPath,
      fileContent: file.buffer,
    });
    const fileId = result.fileID || "";
    return {
      fileId,
      url: await this.getFileUrl(fileId),
    };
  }

  async getFileUrl(fileIdOrUrl) {
    if (!fileIdOrUrl) return "";
    if (/^https?:\/\//.test(fileIdOrUrl) || fileIdOrUrl.startsWith("/")) return fileIdOrUrl;

    try {
      const result = await this.app.getTempFileURL({ fileList: [fileIdOrUrl] });
      const file = (result.fileList || [])[0];
      return file && file.tempFileURL ? file.tempFileURL : "";
    } catch {
      return "";
    }
  }

  async ensureSeed() {
    await this.ensureCollections();
    const now = new Date().toISOString();
    const adminPhone = cleanPhone(process.env.YKADMIN_PHONE || "13377779999");
    const adminNickname = String(process.env.YKADMIN_NICKNAME || "有空管理员").trim() || "有空管理员";
    const users = await this.all("users");
    if (!users.some((user) => user.id === "admin")) {
      await this.insert("users", {
        id: "admin",
        nickname: adminNickname,
        phone: adminPhone,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
    }

    const modules = await this.all("modules");
    for (const module of DEFAULT_MODULES) {
      if (!modules.some((item) => item.id === module.id)) {
        await this.insert("modules", { ...module, createdAt: now });
      }
    }
  }
}

function createStore() {
  if (process.env.STORE_DRIVER === "cloudbase") {
    return new CloudBaseStore();
  }
  return new JsonStore();
}

module.exports = {
  COLLECTIONS,
  DEFAULT_MODULES,
  cleanPhone,
  createDefaultDb,
  createStore,
};
