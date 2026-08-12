"use strict";

const crypto = require("crypto");

let redisClientPromise = null;

function nowMs() {
  return Date.now();
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function withTimeout(promise, timeoutMs, label = "cache") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function queryHash(value = {}) {
  return crypto.createHash("sha1").update(stableStringify(value)).digest("hex").slice(0, 16);
}

function jitterSeconds(ttlSeconds, jitterRatio = 0.12) {
  const ttl = Math.max(1, Number(ttlSeconds || 1));
  const jitter = Math.floor(ttl * jitterRatio);
  if (!jitter) return ttl;
  return Math.max(1, ttl + Math.floor(Math.random() * (jitter * 2 + 1)) - jitter);
}

async function loadRedisClient(config) {
  if (redisClientPromise) return redisClientPromise;
  redisClientPromise = (async () => {
    const { createClient } = require("redis");
    const socket = {
      host: config.host,
      port: config.port,
      connectTimeout: config.connectTimeoutMs,
      reconnectStrategy: (retries) => Math.min(retries * 100, 1000),
    };
    const client = createClient({
      socket,
      password: config.password || undefined,
      database: config.database,
    });
    client.on("error", () => {});
    await withTimeout(client.connect(), config.connectTimeoutMs, "redis connect");
    return client;
  })().catch((error) => {
    redisClientPromise = null;
    throw error;
  });
  return redisClientPromise;
}

function createMemoryDriver() {
  const map = new Map();
  return {
    name: "memory",
    async get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= nowMs()) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      map.set(key, { value, expiresAt: nowMs() + ttlSeconds * 1000 });
      return true;
    },
    async del(key) {
      map.delete(key);
    },
    async increment(key, ttlSeconds) {
      const current = Number(await this.get(key) || 0) + 1;
      await this.set(key, String(current), ttlSeconds);
      return current;
    },
  };
}

function createNoopDriver() {
  return {
    name: "noop",
    async get() { return null; },
    async set() { return false; },
    async del() {},
    async increment() { return 0; },
  };
}

function createRedisDriver(config) {
  return {
    name: "redis",
    async get(key) {
      const client = await loadRedisClient(config);
      return withTimeout(client.get(key), config.cacheTimeoutMs, "redis get");
    },
    async set(key, value, ttlSeconds) {
      const client = await loadRedisClient(config);
      await withTimeout(client.set(key, value, { EX: ttlSeconds }), config.cacheTimeoutMs, "redis set");
      return true;
    },
    async del(key) {
      const client = await loadRedisClient(config);
      await withTimeout(client.del(key), config.cacheTimeoutMs, "redis del");
    },
    async increment(key, ttlSeconds) {
      const client = await loadRedisClient(config);
      const multi = client.multi().incr(key).expire(key, ttlSeconds, "NX");
      const results = await withTimeout(multi.exec(), config.cacheTimeoutMs, "redis incr");
      return Number(Array.isArray(results) ? results[0] : results || 0);
    },
  };
}

function parseCachedValue(cached) {
  try {
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === "object" && parsed.__ykCacheEnvelope === 1) {
      return {
        ok: true,
        value: parsed.value,
        softExpiresAt: Number(parsed.softExpiresAt || 0),
      };
    }
    return { ok: true, value: parsed, softExpiresAt: Number.POSITIVE_INFINITY };
  } catch {
    return { ok: false };
  }
}

function createCacheService(options = {}) {
  const env = options.env || process.env;
  const enabled = String(env.REDIS_ENABLED || "false") === "true" || String(env.CACHE_DRIVER || "").toLowerCase() === "redis";
  const driverName = String(env.CACHE_DRIVER || (enabled ? "redis" : "noop")).toLowerCase();
  const keyPrefix = String(env.REDIS_KEY_PREFIX || env.CACHE_KEY_PREFIX || "yk:local:v1").replace(/:+$/g, "");
  const config = {
    host: env.REDIS_HOST || "127.0.0.1",
    port: positiveNumber(env.REDIS_PORT, 6379),
    password: env.REDIS_PASSWORD || "",
    database: Math.max(0, Number(env.REDIS_DATABASE || 0)),
    connectTimeoutMs: positiveNumber(env.REDIS_CONNECT_TIMEOUT_MS, 800),
    cacheTimeoutMs: positiveNumber(env.REDIS_CACHE_TIMEOUT_MS, 90),
  };
  const driver = driverName === "redis"
    ? createRedisDriver(config)
    : driverName === "noop"
      ? createNoopDriver()
      : createMemoryDriver();
  const inflight = new Map();

  function key(parts = []) {
    return [keyPrefix].concat(parts.filter((part) => part !== undefined && part !== null && part !== "").map(String)).join(":");
  }

  async function getRaw(cacheKey, context) {
    const started = nowMs();
    try {
      const value = await driver.get(cacheKey);
      if (context) context.cacheDurationMs = (context.cacheDurationMs || 0) + nowMs() - started;
      return value;
    } catch (error) {
      if (context) {
        context.cacheStatus = "BYPASS";
        context.cacheError = error.message;
        context.cacheDurationMs = (context.cacheDurationMs || 0) + nowMs() - started;
      }
      return null;
    }
  }

  async function setRaw(cacheKey, value, ttlSeconds, context) {
    const started = nowMs();
    try {
      await driver.set(cacheKey, value, jitterSeconds(ttlSeconds));
      if (context) context.cacheDurationMs = (context.cacheDurationMs || 0) + nowMs() - started;
    } catch (error) {
      if (context) {
        context.cacheStatus = "BYPASS";
        context.cacheError = error.message;
        context.cacheDurationMs = (context.cacheDurationMs || 0) + nowMs() - started;
      }
    }
  }

  async function remember(cacheKey, ttlSeconds, loader, context = {}, options = {}) {
    if (driver.name === "noop") {
      context.cacheStatus = "BYPASS";
      return loader();
    }
    const staleSeconds = Math.max(0, Number(options.staleSeconds || 0));
    const cached = await getRaw(cacheKey, context);
    if (cached !== null && cached !== undefined) {
      const entry = parseCachedValue(cached);
      if (entry.ok && (entry.softExpiresAt > nowMs() || !staleSeconds)) {
        if (!context.cacheError) context.cacheStatus = "HIT";
        return entry.value;
      }
      if (entry.ok && staleSeconds) {
        if (!context.cacheError) context.cacheStatus = "STALE";
        if (!inflight.has(cacheKey)) {
          const refreshPromise = Promise.resolve()
            .then(loader)
            .then((value) => setRaw(cacheKey, JSON.stringify({
              __ykCacheEnvelope: 1,
              softExpiresAt: nowMs() + Math.max(1, Number(ttlSeconds || 1)) * 1000,
              value,
            }), Math.max(1, Number(ttlSeconds || 1)) + staleSeconds, {}))
            .catch(() => null)
            .finally(() => inflight.delete(cacheKey));
          inflight.set(cacheKey, refreshPromise);
        }
        return entry.value;
      }
    }
    if (!context.cacheError) context.cacheStatus = "MISS";

    if (inflight.has(cacheKey)) return inflight.get(cacheKey);
    const promise = Promise.resolve()
      .then(loader)
      .then(async (value) => {
        const payload = staleSeconds
          ? {
            __ykCacheEnvelope: 1,
            softExpiresAt: nowMs() + Math.max(1, Number(ttlSeconds || 1)) * 1000,
            value,
          }
          : value;
        await setRaw(cacheKey, JSON.stringify(payload), Math.max(1, Number(ttlSeconds || 1)) + staleSeconds, context);
        return value;
      })
      .finally(() => inflight.delete(cacheKey));
    inflight.set(cacheKey, promise);
    return promise;
  }

  async function bumpVersion(name) {
    const versionKey = key(["version", name]);
    try {
      return await driver.increment(versionKey, 365 * 24 * 60 * 60);
    } catch {
      return 0;
    }
  }

  async function version(name, context) {
    const value = await getRaw(key(["version", name]), context);
    const number = Number(value || 0);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  return {
    driverName: driver.name,
    key,
    queryHash,
    remember,
    bumpVersion,
    version,
  };
}

module.exports = {
  createCacheService,
  queryHash,
};
