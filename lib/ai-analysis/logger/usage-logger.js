"use strict";

async function logAiUsage(store, entry = {}) {
  const now = new Date().toISOString();
  const item = {
    id: entry.id || `ai_usage_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    provider: entry.provider || "",
    model: entry.model || "",
    contentType: entry.contentType || "",
    activityId: entry.activityId || "",
    durationMs: Number(entry.durationMs || 0),
    ok: entry.ok !== false,
    error: entry.error || "",
    cacheHit: Boolean(entry.cacheHit),
    tokenUsage: entry.tokenUsage || {},
    createdAt: now,
  };
  await store.insert("aiUsageLogs", item).catch(() => {});
  return item;
}

module.exports = {
  logAiUsage,
};
