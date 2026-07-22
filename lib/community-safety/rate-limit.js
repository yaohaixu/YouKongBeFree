"use strict";

function nowIso() {
  return new Date().toISOString();
}

function windowId(scope, identityId, windowMs, now = Date.now()) {
  const bucket = Math.floor(now / windowMs);
  return `rate_${scope}_${identityId}_${bucket}`;
}

function adjustedMax(baseMax, trustProfile = {}, config = {}) {
  const trust = Number(trustProfile.communityTrust ?? 50);
  let max = Number(baseMax || 1);
  if (trust >= 75) max += Number(config.highTrustBonus || 0);
  if (trust <= 25) max = Math.max(1, max - Number(config.lowTrustPenalty || 0));
  return max;
}

async function incrementWindow(store, { identityId, scope, windowMs, max, metadata = {} }) {
  const now = Date.now();
  const id = windowId(scope, identityId, windowMs, now);
  const resetAt = new Date((Math.floor(now / windowMs) + 1) * windowMs).toISOString();
  const existing = await store.findById("rateEvents", id);
  if (!existing) {
    const item = {
      id,
      identityId,
      scope,
      count: 1,
      limit: max,
      resetAt,
      metadata,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await store.insert("rateEvents", item);
    return { allowed: true, count: 1, max, resetAt };
  }
  const count = Number(existing.count || 0) + 1;
  await store.update("rateEvents", id, {
    count,
    limit: max,
    resetAt,
    metadata: { ...(existing.metadata || {}), ...metadata },
    updatedAt: nowIso(),
  });
  return {
    allowed: count <= max,
    count,
    max,
    resetAt: existing.resetAt || resetAt,
  };
}

async function checkActivityPublishLimit(store, identity, trustProfile, config = {}, options = {}) {
  const scope = options.intent === "draft" ? "activity-draft" : "activity-publish";
  const minuteMax = options.intent === "draft"
    ? Number(config.draftMinuteMax || 8)
    : adjustedMax(config.publishMinuteMax || 2, trustProfile, config);
  const dayMax = options.intent === "draft"
    ? Math.max(20, Number(config.publishDayMax || 5) * 4)
    : adjustedMax(config.publishDayMax || 5, trustProfile, config);
  const minute = await incrementWindow(store, {
    identityId: identity.id,
    scope: `${scope}:minute`,
    windowMs: Number(config.publishMinuteWindowMs || 60 * 1000),
    max: minuteMax,
  });
  if (!minute.allowed) {
    return {
      allowed: false,
      reason: "minute",
      message: `你刚刚发起得有点快，可以先休息一下，${new Date(minute.resetAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 后再试。`,
      detail: minute,
    };
  }
  const day = await incrementWindow(store, {
    identityId: identity.id,
    scope: `${scope}:day`,
    windowMs: Number(config.publishDayWindowMs || 24 * 60 * 60 * 1000),
    max: dayMax,
  });
  if (!day.allowed) {
    return {
      allowed: false,
      reason: "day",
      message: "今天已经发起过几次活动了。为了保护社区免受批量垃圾内容影响，可以明天再试，或联系有空协作员一起处理。",
      detail: day,
    };
  }
  return { allowed: true, minute, day };
}

async function checkSimpleLimit(store, identity, scope, max, windowMs, metadata = {}) {
  return incrementWindow(store, {
    identityId: identity.id,
    scope,
    windowMs,
    max,
    metadata,
  });
}

async function pruneExpiredRateEvents(store) {
  const cutoff = nowIso();
  if (typeof store.removeWhere === "function") {
    return store.removeWhere("rateEvents", [{ field: "resetAt", op: "lt", value: cutoff }]);
  }
  return store.remove("rateEvents", (item) => !item.resetAt || item.resetAt < cutoff);
}

module.exports = {
  checkActivityPublishLimit,
  checkSimpleLimit,
  pruneExpiredRateEvents,
};
