const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const cloudbase = require("@cloudbase/node-sdk");
const {
  DEFAULT_AI_MODEL_PROFILES,
  DEFAULT_AI_PROMPTS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_SAFETY_CONFIG,
  DEFAULT_SAFETY_RULES,
} = require("./community-safety/defaults");
const {
  DEFAULT_BADGE_POLICIES,
  DEFAULT_COMMUNITY_BADGES,
  DEFAULT_TRUST_POLICIES,
} = require("./community-governance/defaults");
const { DEFAULT_ROLE_DEFINITIONS, normalizeRoleKey } = require("./permissions");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = process.env.YK_DB_FILE
  ? path.resolve(process.env.YK_DB_FILE)
  : path.join(DATA_DIR, "youkong-db.json");
const COLLECTIONS = [
  "users",
  "roles",
  "modules",
  "livingRoomFriends",
  "activitySeries",
  "templates",
  "activities",
  "registrations",
  "activityInterests",
  "activityFeedbacks",
  "activityNotificationSubscriptions",
  "roomDutyLogs",
  "activityCoInitiators",
  "activityCoInitiatorInvites",
  "identityNetworks",
  "identityNetworkDevices",
  "identitySyncInvites",
  "identityMergeEvents",
  "identityExternalCredentials",
  "identityProfiles",
  "sessions",
  "logs",
  "safetyRules",
  "systemConfigs",
  "anonymousIdentities",
  "communityEvents",
  "trustProfiles",
  "trustEvents",
  "trustPolicies",
  "communityBadges",
  "identityBadges",
  "badgePolicies",
  "rateEvents",
  "analysisReports",
  "activityAnalysisJobs",
  "communityReports",
  "aiModelProfiles",
  "aiPrompts",
  "aiCache",
  "aiUsageLogs",
];
const DEFAULT_MODULES = [
  { id: "screening", name: "有空放映", description: "电影、纪录片、影像讨论" },
  { id: "canteen", name: "有空食堂", description: "一起做饭、饭桌与附近小店探索" },
  { id: "salon", name: "公共议题", description: "讨论、共识辩论和公共生活实践" },
  { id: "walk", name: "城市漫游", description: "上山下江、菜市场和街区探索" },
];
const DEFAULT_ACTIVITY_SERIES = [
  { id: "daily", name: "日常活动", description: "不固定栏目，但适合被持续回看的一次活动", color: "#4f6f58", order: 1, enabled: true },
  { id: "screening", name: "有空放映", description: "电影、纪录片、影像讨论和放映后的闲聊", color: "#8d4637", order: 2, enabled: true },
  { id: "reading", name: "读书讨论", description: "阅读、文本、共同讨论和知识分享", color: "#3d6470", order: 3, enabled: true },
  { id: "city-walk", name: "城市漫游", description: "街区、山水、市场和城市观察", color: "#6f5b2e", order: 4, enabled: true },
  { id: "workshop", name: "共创工作坊", description: "一起做东西、写东西、试验一个小项目", color: "#6b5a83", order: 5, enabled: true },
  { id: "mutual-aid", name: "公益互助", description: "志愿行动、互助支持和附近生活实践", color: "#8c4d5b", order: 6, enabled: true },
];
const DEFAULT_USER_ROLES = ["collaborator"];

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
  const adminPhone = cleanPhone(process.env.YKADMIN_PHONE || "18800000000");
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
    roles: DEFAULT_ROLE_DEFINITIONS.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    modules: DEFAULT_MODULES.map((item) => ({ ...item, createdAt: now })),
    livingRoomFriends: [],
    activitySeries: DEFAULT_ACTIVITY_SERIES.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    templates: [],
    activities: [],
    registrations: [],
    activityInterests: [],
    activityFeedbacks: [],
    activityNotificationSubscriptions: [],
    roomDutyLogs: [],
    activityCoInitiators: [],
    activityCoInitiatorInvites: [],
    identityNetworks: [],
    identityNetworkDevices: [],
    identitySyncInvites: [],
    identityMergeEvents: [],
    identityExternalCredentials: [],
    identityProfiles: [],
    sessions: [],
    logs: [],
    safetyRules: DEFAULT_SAFETY_RULES.map((item, index) => ({ ...item, order: index + 1, createdAt: now, updatedAt: now })),
    systemConfigs: [
      { id: "safety_config", value: DEFAULT_SAFETY_CONFIG, createdAt: now, updatedAt: now },
      { id: "ai_settings", value: DEFAULT_AI_SETTINGS, createdAt: now, updatedAt: now },
    ],
    anonymousIdentities: [],
    communityEvents: [],
    trustProfiles: [],
    trustEvents: [],
    trustPolicies: DEFAULT_TRUST_POLICIES.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    communityBadges: DEFAULT_COMMUNITY_BADGES.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    identityBadges: [],
    badgePolicies: DEFAULT_BADGE_POLICIES.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    rateEvents: [],
    analysisReports: [],
    activityAnalysisJobs: [],
    communityReports: [],
    aiModelProfiles: DEFAULT_AI_MODEL_PROFILES.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    aiPrompts: DEFAULT_AI_PROMPTS.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
    aiCache: [],
    aiUsageLogs: [],
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

  async findById(collection, id) {
    return this.findByFilters(collection, [{ field: "id", op: "eq", value: id }]);
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

  async insertUnique(collection, item, uniqueField = "id") {
    const db = this.read();
    db[collection] = db[collection] || [];
    const existing = db[collection].find((entry) => entry[uniqueField] === item[uniqueField]);
    if (existing) return { inserted: false, item: existing };
    db[collection].push(item);
    this.write(db);
    return { inserted: true, item };
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
    const db = this.read();
    const now = new Date().toISOString();
    for (const collection of COLLECTIONS) {
      db[collection] = db[collection] || [];
    }
    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      const existing = db.roles.find((item) => item.id === role.id || item.key === role.key);
      if (existing) {
        if (role.id === "admin") {
          Object.assign(existing, {
            ...role,
            permissions: role.permissions,
            updatedAt: existing.updatedAt || now,
          });
        } else {
          Object.assign(existing, {
            key: existing.key || role.key,
            name: existing.name || role.name,
            description: existing.description || role.description,
            builtIn: true,
            locked: false,
            permissions: existing.permissions || role.permissions,
            updatedAt: existing.updatedAt || now,
          });
        }
      } else {
        db.roles.push({ ...role, createdAt: now, updatedAt: now });
      }
    }
    db.users = (db.users || []).map((user) => {
      if (user.id === "admin" || user.role === "admin" || (user.roles || []).includes("admin")) {
        return { ...user, role: "admin", roles: ["admin"] };
      }
      const role = normalizeRoleKey(user.role || (user.roles || [])[0] || "collaborator");
      return { ...user, role, roles: [role], updatedAt: user.updatedAt || now };
    });
    for (const series of DEFAULT_ACTIVITY_SERIES) {
      const existing = db.activitySeries.find((item) => item.id === series.id);
      if (existing) {
        Object.assign(existing, {
          name: existing.name || series.name,
          description: existing.description || series.description,
          color: existing.color || series.color,
          order: existing.order || series.order,
          enabled: existing.enabled !== false,
          updatedAt: existing.updatedAt || now,
        });
      } else {
        db.activitySeries.push({ ...series, createdAt: now, updatedAt: now });
      }
    }
    for (const rule of DEFAULT_SAFETY_RULES) {
      if (!db.safetyRules.some((item) => item.id === rule.id)) {
        db.safetyRules.push({ ...rule, order: db.safetyRules.length + 1, createdAt: now, updatedAt: now });
      }
    }
    if (!db.systemConfigs.some((item) => item.id === "safety_config")) {
      db.systemConfigs.push({ id: "safety_config", value: DEFAULT_SAFETY_CONFIG, createdAt: now, updatedAt: now });
    }
    if (!db.systemConfigs.some((item) => item.id === "ai_settings")) {
      db.systemConfigs.push({ id: "ai_settings", value: DEFAULT_AI_SETTINGS, createdAt: now, updatedAt: now });
    }
    const aiSettings = (db.systemConfigs.find((item) => item.id === "ai_settings") || {}).value || DEFAULT_AI_SETTINGS;
    for (const profile of DEFAULT_AI_MODEL_PROFILES) {
      const existing = db.aiModelProfiles.find((item) => item.id === profile.id);
      const seededProfile = {
        ...profile,
        provider: aiSettings.provider || profile.provider,
        baseUrl: aiSettings.baseUrl || profile.baseUrl,
        model: aiSettings.model || profile.model,
        apiKeyEncrypted: aiSettings.apiKeyEncrypted || profile.apiKeyEncrypted,
        apiKeyUpdatedAt: aiSettings.apiKeyUpdatedAt || profile.apiKeyUpdatedAt,
        requestTimeoutMs: aiSettings.requestTimeoutMs || profile.requestTimeoutMs,
        temperature: aiSettings.temperature ?? profile.temperature,
        maxTokens: aiSettings.maxTokens || profile.maxTokens,
        retryCount: aiSettings.retryCount ?? profile.retryCount,
      };
      if (existing) {
        Object.assign(existing, {
          ...seededProfile,
          provider: existing.provider || seededProfile.provider,
          baseUrl: existing.baseUrl || seededProfile.baseUrl,
          model: existing.model || seededProfile.model,
          apiKeyEncrypted: existing.apiKeyEncrypted || seededProfile.apiKeyEncrypted,
          apiKeyUpdatedAt: existing.apiKeyUpdatedAt || seededProfile.apiKeyUpdatedAt,
          requestTimeoutMs: existing.requestTimeoutMs || seededProfile.requestTimeoutMs,
          temperature: existing.temperature ?? seededProfile.temperature,
          maxTokens: existing.maxTokens || seededProfile.maxTokens,
          retryCount: existing.retryCount ?? seededProfile.retryCount,
          name: existing.name || seededProfile.name,
          enabled: existing.enabled !== false,
          priority: existing.priority || seededProfile.priority,
          sceneScopes: Array.isArray(existing.sceneScopes) && existing.sceneScopes.length ? existing.sceneScopes : seededProfile.sceneScopes,
          healthStatus: existing.healthStatus || "unknown",
          lastTestAt: existing.lastTestAt || "",
          lastDurationMs: existing.lastDurationMs || 0,
          lastError: existing.lastError || "",
          updatedAt: existing.updatedAt || now,
        });
      } else {
        db.aiModelProfiles.push({ ...seededProfile, createdAt: now, updatedAt: now });
      }
    }
    for (const prompt of DEFAULT_AI_PROMPTS) {
      if (!db.aiPrompts.some((item) => item.id === prompt.id)) {
        db.aiPrompts.push({ ...prompt, createdAt: now, updatedAt: now });
      }
    }
    for (const policy of DEFAULT_TRUST_POLICIES) {
      if (!db.trustPolicies.some((item) => item.id === policy.id)) {
        db.trustPolicies.push({ ...policy, createdAt: now, updatedAt: now });
      }
    }
    for (const badge of DEFAULT_COMMUNITY_BADGES) {
      if (!db.communityBadges.some((item) => item.id === badge.id)) {
        db.communityBadges.push({ ...badge, createdAt: now, updatedAt: now });
      }
    }
    for (const policy of DEFAULT_BADGE_POLICIES) {
      if (!db.badgePolicies.some((item) => item.id === policy.id)) {
        db.badgePolicies.push({ ...policy, createdAt: now, updatedAt: now });
      }
    }
    this.write(db);
    return db;
  }

  async saveUpload(file, _options = {}) {
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

  async findById(collection, id) {
    return this.findByFilters(collection, [{ field: "id", op: "eq", value: id }]);
  }

  async find(collection, predicate) {
    return (await this.all(collection)).find(predicate) || null;
  }

  async insert(collection, item) {
    await this.collection(collection).add(item);
    return item;
  }

  async insertUnique(collection, item, uniqueField = "id") {
    const existing = await this.findByFilters(collection, [{ field: uniqueField, op: "eq", value: item[uniqueField] }]);
    if (existing) return { inserted: false, item: existing };
    try {
      await this.collection(collection).add(item.id ? { _id: item.id, ...item } : item);
      return { inserted: true, item };
    } catch (error) {
      const duplicate = await this.findByFilters(collection, [{ field: uniqueField, op: "eq", value: item[uniqueField] }]);
      if (duplicate) return { inserted: false, item: duplicate };
      throw error;
    }
  }

  async update(collection, id, patch) {
    await this.collection(collection).where({ id }).update(patch);
    const updated = await this.findById(collection, id);
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

  async saveUpload(file, options = {}) {
    if (!file || !file.buffer) {
      return { fileId: "", url: "" };
    }

    const ext = path.extname(file.originalname || "").toLowerCase();
    const directory = String(options.directory || "activity-covers").replace(/^\/+|\/+$/g, "") || "activity-covers";
    const cloudPath = `${directory}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
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
    const adminPhone = cleanPhone(process.env.YKADMIN_PHONE || "18800000000");
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

    const roles = await this.all("roles");
    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      const existing = roles.find((item) => item.id === role.id || item.key === role.key);
      if (existing) {
        if (role.id === "admin") {
          await this.update("roles", existing.id, {
            ...role,
            permissions: role.permissions,
            updatedAt: existing.updatedAt || now,
          });
        } else {
          await this.update("roles", existing.id, {
            key: existing.key || role.key,
            name: existing.name || role.name,
            description: existing.description || role.description,
            builtIn: true,
            locked: false,
            permissions: existing.permissions || role.permissions,
            updatedAt: existing.updatedAt || now,
          });
        }
      } else {
        await this.insert("roles", { ...role, createdAt: now, updatedAt: now });
      }
    }

    const modules = await this.all("modules");
    for (const module of DEFAULT_MODULES) {
      if (!modules.some((item) => item.id === module.id)) {
        await this.insert("modules", { ...module, createdAt: now });
      }
    }

    const activitySeries = await this.all("activitySeries");
    for (const series of DEFAULT_ACTIVITY_SERIES) {
      const existing = activitySeries.find((item) => item.id === series.id);
      if (existing) {
        await this.update("activitySeries", existing.id, {
          name: existing.name || series.name,
          description: existing.description || series.description,
          color: existing.color || series.color,
          order: existing.order || series.order,
          enabled: existing.enabled !== false,
          updatedAt: existing.updatedAt || now,
        });
      } else {
        await this.insert("activitySeries", { ...series, createdAt: now, updatedAt: now });
      }
    }

    for (const user of users) {
      if (user.id === "admin") {
        await this.update("users", user.id, {
          role: "admin",
          roles: ["admin"],
          updatedAt: user.updatedAt || now,
        });
      } else if (user.role === "member" || (user.roles || []).includes("member")) {
        await this.update("users", user.id, {
          role: "collaborator",
          roles: ["collaborator"],
          updatedAt: now,
        });
      } else {
        const role = normalizeRoleKey(user.role || (user.roles || [])[0] || "collaborator");
        await this.update("users", user.id, {
          role,
          roles: [role],
          updatedAt: user.updatedAt || now,
        });
      }
    }

    const safetyRules = await this.all("safetyRules");
    for (const rule of DEFAULT_SAFETY_RULES) {
      if (!safetyRules.some((item) => item.id === rule.id)) {
        await this.insert("safetyRules", { ...rule, order: safetyRules.length + 1, createdAt: now, updatedAt: now });
      }
    }

    if (!(await this.findById("systemConfigs", "safety_config"))) {
      await this.insert("systemConfigs", { id: "safety_config", value: DEFAULT_SAFETY_CONFIG, createdAt: now, updatedAt: now });
    }
    if (!(await this.findById("systemConfigs", "ai_settings"))) {
      await this.insert("systemConfigs", { id: "ai_settings", value: DEFAULT_AI_SETTINGS, createdAt: now, updatedAt: now });
    }
    const aiSettings = ((await this.findById("systemConfigs", "ai_settings")) || {}).value || DEFAULT_AI_SETTINGS;
    const aiModelProfiles = await this.all("aiModelProfiles");
    for (const profile of DEFAULT_AI_MODEL_PROFILES) {
      const existing = aiModelProfiles.find((item) => item.id === profile.id);
      const seededProfile = {
        ...profile,
        provider: aiSettings.provider || profile.provider,
        baseUrl: aiSettings.baseUrl || profile.baseUrl,
        model: aiSettings.model || profile.model,
        apiKeyEncrypted: aiSettings.apiKeyEncrypted || profile.apiKeyEncrypted,
        apiKeyUpdatedAt: aiSettings.apiKeyUpdatedAt || profile.apiKeyUpdatedAt,
        requestTimeoutMs: aiSettings.requestTimeoutMs || profile.requestTimeoutMs,
        temperature: aiSettings.temperature ?? profile.temperature,
        maxTokens: aiSettings.maxTokens || profile.maxTokens,
        retryCount: aiSettings.retryCount ?? profile.retryCount,
      };
      if (existing) {
        await this.update("aiModelProfiles", existing.id, {
          ...seededProfile,
          provider: existing.provider || seededProfile.provider,
          baseUrl: existing.baseUrl || seededProfile.baseUrl,
          model: existing.model || seededProfile.model,
          apiKeyEncrypted: existing.apiKeyEncrypted || seededProfile.apiKeyEncrypted,
          apiKeyUpdatedAt: existing.apiKeyUpdatedAt || seededProfile.apiKeyUpdatedAt,
          requestTimeoutMs: existing.requestTimeoutMs || seededProfile.requestTimeoutMs,
          temperature: existing.temperature ?? seededProfile.temperature,
          maxTokens: existing.maxTokens || seededProfile.maxTokens,
          retryCount: existing.retryCount ?? seededProfile.retryCount,
          name: existing.name || seededProfile.name,
          enabled: existing.enabled !== false,
          priority: existing.priority || seededProfile.priority,
          sceneScopes: Array.isArray(existing.sceneScopes) && existing.sceneScopes.length ? existing.sceneScopes : seededProfile.sceneScopes,
          healthStatus: existing.healthStatus || "unknown",
          lastTestAt: existing.lastTestAt || "",
          lastDurationMs: existing.lastDurationMs || 0,
          lastError: existing.lastError || "",
          updatedAt: existing.updatedAt || now,
        });
      } else {
        await this.insert("aiModelProfiles", { ...seededProfile, createdAt: now, updatedAt: now });
      }
    }

    const prompts = await this.all("aiPrompts");
    for (const prompt of DEFAULT_AI_PROMPTS) {
      if (!prompts.some((item) => item.id === prompt.id)) {
        await this.insert("aiPrompts", { ...prompt, createdAt: now, updatedAt: now });
      }
    }

    const trustPolicies = await this.all("trustPolicies");
    for (const policy of DEFAULT_TRUST_POLICIES) {
      if (!trustPolicies.some((item) => item.id === policy.id)) {
        await this.insert("trustPolicies", { ...policy, createdAt: now, updatedAt: now });
      }
    }

    const communityBadges = await this.all("communityBadges");
    for (const badge of DEFAULT_COMMUNITY_BADGES) {
      if (!communityBadges.some((item) => item.id === badge.id)) {
        await this.insert("communityBadges", { ...badge, createdAt: now, updatedAt: now });
      }
    }

    const badgePolicies = await this.all("badgePolicies");
    for (const policy of DEFAULT_BADGE_POLICIES) {
      if (!badgePolicies.some((item) => item.id === policy.id)) {
        await this.insert("badgePolicies", { ...policy, createdAt: now, updatedAt: now });
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
  DEFAULT_ACTIVITY_SERIES,
  DEFAULT_MODULES,
  DEFAULT_USER_ROLES,
  cleanPhone,
  createDefaultDb,
  createStore,
};
