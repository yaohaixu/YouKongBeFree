const { getClientId } = require("./identity");

const ROOT = "yk:mp";
const SCHEMA_VERSION = 1;
const DEFAULT_TTL = 5 * 60 * 1000;

function now() {
  return Date.now();
}

function getEnvironment() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const envVersion = info && info.miniProgram && info.miniProgram.envVersion;
    if (envVersion === "release") return "prod";
    return envVersion || "prod";
  } catch (error) {
    return "prod";
  }
}

function key(parts = []) {
  return [ROOT, getEnvironment()].concat(parts).map((part) => String(part || "default")).join(":");
}

function hashPart(value = "") {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function currentIdentityPart() {
  return hashPart(getClientId());
}

function isCacheRecord(value) {
  return value
    && typeof value === "object"
    && Object.prototype.hasOwnProperty.call(value, "data")
    && typeof value.cachedAt === "number"
    && typeof value.expiresAt === "number";
}

function readRecord(cacheKey) {
  try {
    const value = wx.getStorageSync(cacheKey);
    if (!value) return null;
    if (!isCacheRecord(value)) {
      wx.removeStorageSync(cacheKey);
      return null;
    }
    return value;
  } catch (error) {
    return null;
  }
}

function getWithMeta(cacheKey) {
  const record = readRecord(cacheKey);
  if (!record) {
    return {
      exists: false,
      expired: true,
      data: null,
      cachedAt: 0,
      expiresAt: 0,
      version: SCHEMA_VERSION
    };
  }
  const expired = record.expiresAt <= now();
  return {
    exists: true,
    expired,
    data: record.data,
    cachedAt: record.cachedAt,
    expiresAt: record.expiresAt,
    version: record.version || SCHEMA_VERSION
  };
}

function get(cacheKey, options = {}) {
  const meta = getWithMeta(cacheKey);
  if (!meta.exists) return null;
  if (meta.expired && !options.allowExpired) return null;
  return meta.data;
}

function set(cacheKey, value, ttl = DEFAULT_TTL, options = {}) {
  const cachedAt = now();
  const expiresAt = cachedAt + Math.max(0, Number(ttl || 0));
  const record = {
    data: value,
    cachedAt,
    expiresAt,
    version: options.version || SCHEMA_VERSION
  };
  try {
    wx.setStorageSync(cacheKey, record);
  } catch (error) {
    // 本地缓存只是速度层，写失败不能影响业务流程。
  }
  return record;
}

function remove(cacheKey) {
  try {
    wx.removeStorageSync(cacheKey);
  } catch (error) {
    // 忽略缓存清理失败。
  }
}

function removeByPrefix(prefix) {
  try {
    const info = wx.getStorageInfoSync();
    const normalizedPrefix = String(prefix || "");
    const prefixWithSeparator = normalizedPrefix.endsWith(":") ? normalizedPrefix : `${normalizedPrefix}:`;
    (info.keys || []).forEach((item) => {
      const cacheKey = String(item || "");
      if (cacheKey === normalizedPrefix || cacheKey.startsWith(prefixWithSeparator)) {
        wx.removeStorageSync(item);
      }
    });
  } catch (error) {
    // 忽略缓存清理失败。
  }
}

function clear() {
  removeByPrefix(`${ROOT}:`);
}

function isExpired(cacheKey) {
  return getWithMeta(cacheKey).expired;
}

function sameData(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (error) {
    return false;
  }
}

function publicActivityData(activity = {}) {
  if (!activity || typeof activity !== "object") return {};
  const {
    permissions,
    myRegistration,
    hasMyRegistration,
    accessToken,
    managementToken,
    editLock,
    editLockToken,
    interestedByMe,
    reminderSubscribed,
    ...publicActivity
  } = activity;
  return publicActivity;
}

function publicBootstrapData(data = {}) {
  return {
    ...data,
    upcomingActivities: (data.upcomingActivities || []).map(publicActivityData)
  };
}

const keys = {
  publicBootstrap() {
    return key(["public", "bootstrap", "v1"]);
  },
  publicActivityPrefix() {
    return key(["public", "activity"]);
  },
  publicActivity(activityId) {
    return key(["public", "activity", activityId, "v1"]);
  },
  publicActivityListPrefix() {
    return key(["public", "activities"]);
  },
  publicActivityList(queryKey) {
    return key(["public", "activities", queryKey, "v1"]);
  },
  miniprogramConfig() {
    return key(["public", "miniprogram-config", "v1"]);
  },
  userPrefix(identityPart) {
    return key(["user", identityPart]);
  },
  meSummary(identityPart) {
    return key(["user", identityPart, "me-summary", "v1"]);
  },
  registrations(identityPart, page, pageSize) {
    return key(["user", identityPart, "registrations", `p${page}`, `s${pageSize}`, "v1"]);
  },
  feedbacks(identityPart, page, pageSize) {
    return key(["user", identityPart, "feedbacks", `p${page}`, `s${pageSize}`, "v1"]);
  },
  identitySync(identityPart) {
    return key(["user", identityPart, "identity-sync", "v1"]);
  }
};

function invalidatePublicActivities(activityId) {
  remove(keys.publicBootstrap());
  removeByPrefix(keys.publicActivityListPrefix());
  if (activityId) remove(keys.publicActivity(activityId));
}

module.exports = {
  DEFAULT_TTL,
  key,
  keys,
  hashPart,
  currentIdentityPart,
  get,
  set,
  remove,
  removeByPrefix,
  clear,
  isExpired,
  getWithMeta,
  sameData,
  publicActivityData,
  publicBootstrapData,
  invalidatePublicActivities
};
