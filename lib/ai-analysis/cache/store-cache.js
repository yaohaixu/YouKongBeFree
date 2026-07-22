"use strict";

const crypto = require("crypto");

function cacheKey(payload = {}, settings = {}) {
  return `ai_cache_${crypto
    .createHash("sha256")
    .update(JSON.stringify({
      payload,
      provider: settings.provider,
      model: settings.model,
      promptVersion: settings.promptVersion,
      capabilities: settings.capabilities,
    }))
    .digest("hex")
    .slice(0, 40)}`;
}

async function getCachedAnalysis(store, key) {
  const cached = await store.findById("aiCache", key);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt <= new Date().toISOString()) return null;
  return cached.report || null;
}

async function setCachedAnalysis(store, key, report, ttlSeconds = 86400) {
  const now = new Date();
  const item = {
    id: key,
    report,
    expiresAt: new Date(now.getTime() + Number(ttlSeconds || 86400) * 1000).toISOString(),
    updatedAt: now.toISOString(),
  };
  const existing = await store.findById("aiCache", key);
  if (existing) return store.update("aiCache", key, item);
  await store.insert("aiCache", { ...item, createdAt: now.toISOString() });
  return item;
}

module.exports = {
  cacheKey,
  getCachedAnalysis,
  setCachedAnalysis,
};
