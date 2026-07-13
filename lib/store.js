const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cloudbase = require("@cloudbase/node-sdk");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = process.env.YK_DB_FILE
  ? path.resolve(process.env.YK_DB_FILE)
  : path.join(DATA_DIR, "youkong-db.json");
const COLLECTIONS = ["users", "modules", "activities", "registrations", "sessions", "logs"];
const DEFAULT_MODULES = [
  { id: "screening", name: "有空放映", description: "电影、纪录片、影像讨论" },
  { id: "canteen", name: "有空食堂", description: "一起做饭、饭桌与附近小店探索" },
  { id: "salon", name: "公共议题", description: "讨论、共识辩论和公共生活实践" },
  { id: "walk", name: "城市漫游", description: "上山下江、菜市场和街区探索" },
];
const DEFAULT_USER_ROLES = ["member"];

function cleanPhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePageOptions(options = {}) {
  const page = Math.max(1, Number.parseInt(options.page || "1", 10) || 1);
  const requestedSize = Number.parseInt(options.pageSize || options.limit || "12", 10) || 12;
  const pageSize = Math.max(1, Math.min(requestedSize, Number(options.maxPageSize || 100)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function makePageInfo(total, page, pageSize, visible) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    hasMore: (page - 1) * pageSize + visible < total,
  };
}

function getFieldValue(item, field) {
  return String(field || "")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), item);
}

function compareValues(a, b, direction = "asc") {
  const desc = direction === "desc";
  const left = a === undefined || a === null ? "" : a;
  const right = b === undefined || b === null ? "" : b;
  if (left === right) return 0;
  if (left > right) return desc ? -1 : 1;
  return desc ? 1 : -1;
}

function localMatchesFilter(item, filter) {
  const value = getFieldValue(item, filter.field);
  if (filter.op === "in") {
    return Array.isArray(filter.value) && filter.value.includes(value);
  }
  if (filter.op === "gte") {
    return value >= filter.value;
  }
  if (filter.op === "lte") {
    return value <= filter.value;
  }
  if (filter.op === "lt") {
    return value < filter.value;
  }
  if (filter.op === "contains") {
    return Array.isArray(value) ? value.includes(filter.value) : value === filter.value;
  }
  return value === filter.value;
}

function localMatchesKeyword(item, keyword, fields = []) {
  const text = String(keyword || "").trim().toLowerCase();
  if (!text) return true;
  return fields.some((field) => {
    const value = getFieldValue(item, field);
    if (Array.isArray(value)) return value.join(" ").toLowerCase().includes(text);
    return String(value || "").toLowerCase().includes(text);
  });
}

function localQueryItems(items, options = {}) {
  const filters = Array.isArray(options.filters) ? options.filters.filter((item) => item && item.field) : [];
  const keyword = String(options.keyword || "").trim();
  const keywordFields = Array.isArray(options.keywordFields) ? options.keywordFields : [];
  const sort = Array.isArray(options.sort) ? options.sort : [];
  const { page, pageSize, skip } = normalizePageOptions(options);
  const filtered = items
    .filter((item) => filters.every((filter) => localMatchesFilter(item, filter)))
    .filter((item) => localMatchesKeyword(item, keyword, keywordFields));
  const sorted = sort.length
    ? filtered.slice().sort((a, b) => {
      for (const rule of sort) {
        const result = compareValues(getFieldValue(a, rule.field), getFieldValue(b, rule.field), rule.direction);
        if (result !== 0) return result;
      }
      return 0;
    })
    : filtered;
  const data = sorted.slice(skip, skip + pageSize);
  return { data, pageInfo: makePageInfo(filtered.length, page, pageSize, data.length) };
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
        roles: ["admin"],
        createdAt: now,
        updatedAt: now,
      },
    ],
    modules: DEFAULT_MODULES.map((item) => ({ ...item, createdAt: now })),
    activities: [],
    registrations: [],
    sessions: [],
    logs: [],
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

  async query(collection, options = {}) {
    return localQueryItems(await this.all(collection), options);
  }

  async count(collection, options = {}) {
    const { pageInfo } = localQueryItems(await this.all(collection), {
      ...options,
      page: 1,
      pageSize: 1,
    });
    return pageInfo.total;
  }

  async findByFilters(collection, filters = []) {
    const items = await this.all(collection);
    return items.find((item) => filters.every((filter) => localMatchesFilter(item, filter))) || null;
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

  async removeWhere(collection, filters = []) {
    return this.remove(collection, (item) => filters.every((filter) => localMatchesFilter(item, filter)));
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
    const item = rest.id ? rest : { ...rest, id: _id };
    if (item.role && !item.roles) {
      item.roles = item.role === "admin" ? ["admin"] : [item.role];
    }
    return item;
  }

  async all(collection) {
    const result = await this.collection(collection).limit(1000).get();
    return (result.data || []).map((item) => this.normalize(item));
  }

  buildQueryFilter(options = {}) {
    const filters = Array.isArray(options.filters) ? options.filters.filter((item) => item && item.field) : [];
    const conditions = [];
    const ranges = new Map();
    const command = this.db.command;

    for (const filter of filters) {
      if (filter.value === undefined || filter.value === null || filter.value === "") continue;
      if (filter.op === "gte" || filter.op === "lte") {
        const range = ranges.get(filter.field) || {};
        range[filter.op] = filter.value;
        ranges.set(filter.field, range);
      } else if (filter.op === "lt") {
        conditions.push({ [filter.field]: command.lt(filter.value) });
      } else if (filter.op === "in") {
        const list = Array.isArray(filter.value) ? filter.value.filter((item) => item !== undefined && item !== null && item !== "") : [];
        if (list.length) conditions.push({ [filter.field]: command.in(list) });
      } else {
        conditions.push({ [filter.field]: filter.value });
      }
    }

    for (const [field, range] of ranges.entries()) {
      let query = null;
      if (range.gte !== undefined) query = command.gte(range.gte);
      if (range.lte !== undefined) query = query ? query.and(command.lte(range.lte)) : command.lte(range.lte);
      if (query) conditions.push({ [field]: query });
    }

    const keyword = String(options.keyword || "").trim();
    const keywordFields = Array.isArray(options.keywordFields) ? options.keywordFields.filter(Boolean) : [];
    if (keyword && keywordFields.length) {
      const regexp = this.db.RegExp({ regexp: escapeRegExp(keyword), options: "i" });
      conditions.push(command.or(keywordFields.map((field) => ({ [field]: regexp }))));
    }

    if (!conditions.length) return null;
    if (conditions.length === 1) return conditions[0];
    return command.and(conditions);
  }

  async query(collection, options = {}) {
    const { page, pageSize, skip } = normalizePageOptions(options);
    const filter = this.buildQueryFilter(options);
    const sort = Array.isArray(options.sort) ? options.sort.filter((item) => item && item.field) : [];
    let query = this.collection(collection);
    if (filter) query = query.where(filter);
    for (const rule of sort) {
      query = query.orderBy(rule.field, rule.direction === "desc" ? "desc" : "asc");
    }
    const countResult = await query.count();
    const total = Number(countResult.total || 0);
    const result = await query.skip(skip).limit(pageSize).get();
    const data = (result.data || []).map((item) => this.normalize(item));
    return { data, pageInfo: makePageInfo(total, page, pageSize, data.length) };
  }

  async count(collection, options = {}) {
    const filter = this.buildQueryFilter(options);
    let query = this.collection(collection);
    if (filter) query = query.where(filter);
    const result = await query.count();
    return Number(result.total || 0);
  }

  async findByFilters(collection, filters = []) {
    const filter = this.buildQueryFilter({ filters });
    let query = this.collection(collection);
    if (filter) query = query.where(filter);
    const result = await query.limit(1).get();
    return this.normalize((result.data || [])[0]);
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

  async removeWhere(collection, filters = []) {
    const filter = this.buildQueryFilter({ filters });
    if (!filter) return 0;
    const query = this.collection(collection).where(filter);
    const countResult = await query.count();
    await query.remove();
    return Number(countResult.total || 0);
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
        roles: ["admin"],
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
  DEFAULT_USER_ROLES,
  cleanPhone,
  createDefaultDb,
  createStore,
};
