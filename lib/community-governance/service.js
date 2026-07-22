"use strict";

const crypto = require("crypto");

const { recordTrustEvent } = require("../community-safety/trust-engine");
const { DEFAULT_BADGE_POLICIES, DEFAULT_COMMUNITY_BADGES, DEFAULT_TRUST_POLICIES } = require("./defaults");
const { evaluateRule } = require("./rule-builder");

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "是"].includes(String(value).trim().toLowerCase());
}

function parseJsonLike(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function communityLevel(score = 50) {
  const value = Number(score || 0);
  if (value >= 85) return "core_contributor";
  if (value >= 70) return "trusted_partner";
  if (value >= 45) return "normal";
  if (value >= 25) return "watch";
  return "restricted";
}

function communityStatus(score = 50) {
  const value = Number(score || 0);
  if (value < 25) return "restricted";
  if (value < 45) return "watch";
  return "normal";
}

function communityId(identityId = "") {
  const cleaned = String(identityId || "").replace(/^anon_/, "");
  if (!cleaned) return "";
  return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`.toUpperCase();
}

function eventMatchesPolicy(policy = {}, event = {}) {
  return policy.enabled !== false && (!policy.eventType || policy.eventType === "*" || policy.eventType === event.type);
}

async function getTrustPolicies(store, options = {}) {
  const { data } = await store.query("trustPolicies", {
    page: 1,
    pageSize: 500,
    maxPageSize: 500,
    sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
  });
  const policies = data.length ? data : DEFAULT_TRUST_POLICIES;
  return options.includeDisabled ? policies : policies.filter((policy) => policy.enabled !== false);
}

async function getCommunityBadges(store, options = {}) {
  const { data } = await store.query("communityBadges", {
    page: 1,
    pageSize: 500,
    maxPageSize: 500,
    sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
  });
  const badges = data.length ? data : DEFAULT_COMMUNITY_BADGES;
  return options.includeDisabled ? badges : badges.filter((badge) => badge.enabled !== false);
}

async function getBadgePolicies(store, options = {}) {
  const { data } = await store.query("badgePolicies", {
    page: 1,
    pageSize: 500,
    maxPageSize: 500,
    sort: [{ field: "order", direction: "asc" }, { field: "createdAt", direction: "asc" }],
  });
  const policies = data.length ? data : DEFAULT_BADGE_POLICIES;
  return options.includeDisabled ? policies : policies.filter((policy) => policy.enabled !== false);
}

function trustPolicyFromInput(body = {}, existing = {}) {
  return {
    name: String(body.name || existing.name || "").trim(),
    eventType: String(body.eventType || existing.eventType || "").trim(),
    enabled: normalizeBoolean(body.enabled, existing.enabled !== false),
    order: Number(body.order ?? existing.order ?? 100) || 100,
    description: String(body.description || existing.description || "").trim().slice(0, 500),
    conditionMode: String(body.conditionMode || existing.conditionMode || "all").trim() === "any" ? "any" : "all",
    conditions: parseJsonLike(body.conditions, existing.conditions || []),
    effect: parseJsonLike(body.effect, existing.effect || { trustDelta: 0 }),
  };
}

function badgeFromInput(body = {}, existing = {}) {
  return {
    name: String(body.name || existing.name || "").trim(),
    description: String(body.description || existing.description || "").trim().slice(0, 500),
    icon: String(body.icon || existing.icon || "spark").trim().slice(0, 40),
    color: String(body.color || existing.color || "#6f7f63").trim().slice(0, 40),
    type: ["identity", "achievement", "event"].includes(String(body.type || existing.type)) ? String(body.type || existing.type) : "achievement",
    enabled: normalizeBoolean(body.enabled, existing.enabled !== false),
    order: Number(body.order ?? existing.order ?? 100) || 100,
    rule: parseJsonLike(body.rule, existing.rule || { mode: "all", conditions: [] }),
  };
}

function badgePolicyFromInput(body = {}, existing = {}) {
  return {
    badgeId: String(body.badgeId || existing.badgeId || "").trim(),
    enabled: normalizeBoolean(body.enabled, existing.enabled !== false),
    publicVisible: normalizeBoolean(body.publicVisible, existing.publicVisible === true),
    displayLocations: parseJsonLike(body.displayLocations, existing.displayLocations || {}),
    showIcon: normalizeBoolean(body.showIcon, existing.showIcon !== false),
    showName: normalizeBoolean(body.showName, existing.showName !== false),
    tooltip: String(body.tooltip || existing.tooltip || "").trim().slice(0, 240),
    order: Number(body.order ?? existing.order ?? 100) || 100,
  };
}

function validateTrustPolicy(policy) {
  if (!policy.name || !policy.eventType) return "策略名称和事件类型都需要填写";
  if (!Array.isArray(policy.conditions)) return "条件需要是 JSON 数组";
  if (!policy.effect || typeof policy.effect !== "object" || Array.isArray(policy.effect)) return "效果需要是 JSON 对象";
  const delta = Number(policy.effect.trustDelta || 0);
  if (!Number.isFinite(delta) || delta < -100 || delta > 100) return "Community Trust 变化值需要在 -100 到 100 之间";
  return "";
}

function validateBadge(badge) {
  if (!badge.name) return "徽章名称需要填写";
  if (!badge.rule || typeof badge.rule !== "object" || Array.isArray(badge.rule)) return "徽章获得规则需要是 JSON 对象";
  return "";
}

function validateBadgePolicy(policy) {
  if (!policy.badgeId) return "徽章展示策略需要绑定徽章";
  if (!policy.displayLocations || typeof policy.displayLocations !== "object" || Array.isArray(policy.displayLocations)) return "展示位置需要是 JSON 对象";
  return "";
}

function policyResult(policy = {}, context = {}) {
  if (!evaluateRule(context, policy)) return null;
  const delta = Number(policy.effect?.trustDelta || 0);
  return {
    policyId: policy.id,
    policyName: policy.name,
    delta,
    description: policy.description || "",
  };
}

async function activeIdentityBadges(store, identityId) {
  const { data } = await store.query("identityBadges", {
    page: 1,
    pageSize: 200,
    maxPageSize: 500,
    filters: [
      { field: "identityId", op: "eq", value: identityId },
      { field: "status", op: "eq", value: "active" },
    ],
    sort: [{ field: "grantedAt", direction: "desc" }],
  });
  return data;
}

async function badgeSummaryForIdentity(store, identityId) {
  const [assignments, badges, displayPolicies] = await Promise.all([
    activeIdentityBadges(store, identityId),
    getCommunityBadges(store, { includeDisabled: true }),
    getBadgePolicies(store, { includeDisabled: true }),
  ]);
  const badgeMap = new Map(badges.map((badge) => [badge.id, badge]));
  const displayMap = new Map(displayPolicies.map((policy) => [policy.badgeId, policy]));
  return assignments
    .map((assignment) => {
      const badge = badgeMap.get(assignment.badgeId);
      if (!badge || badge.enabled === false) return null;
      const display = displayMap.get(badge.id) || {};
      return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        color: badge.color,
        type: badge.type,
        publicVisible: display.publicVisible === true,
        displayLocations: display.displayLocations || {},
        showIcon: display.showIcon !== false,
        showName: display.showName !== false,
        tooltip: display.tooltip || badge.description || "",
        grantedAt: assignment.grantedAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number((badgeMap.get(left.id) || {}).order || 0) - Number((badgeMap.get(right.id) || {}).order || 0));
}

async function refreshIdentityBadges(store, profile = {}) {
  if (!profile?.id) return [];
  const [badges, activeAssignments] = await Promise.all([
    getCommunityBadges(store),
    activeIdentityBadges(store, profile.id),
  ]);
  const context = {
    profile,
    stats: {
      activityCount: Number(profile.activityCount || 0),
      registrationCount: Number(profile.registrationCount || 0),
      reportCount: Number(profile.reportCount || 0),
      reportConfirmedCount: Number(profile.reportConfirmedCount || 0),
    },
  };
  const matched = badges
    .filter((badge) => evaluateRule(context, badge.rule || {}))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const activeByBadge = new Map(activeAssignments.map((item) => [item.badgeId, item]));
  const now = nowIso();
  const matchedIdentity = matched.filter((badge) => badge.type === "identity").at(-1) || null;
  const targetBadgeIds = new Set(matched.filter((badge) => badge.type !== "identity").map((badge) => badge.id));
  if (matchedIdentity) targetBadgeIds.add(matchedIdentity.id);

  await Promise.all(activeAssignments.map((assignment) => {
    const activeBadge = badges.find((badge) => badge.id === assignment.badgeId);
    const shouldExpire = !targetBadgeIds.has(assignment.badgeId) || (activeBadge?.type === "identity" && assignment.badgeId !== matchedIdentity?.id);
    return shouldExpire
      ? store.update("identityBadges", assignment.id, { status: "expired", expiredAt: now, updatedAt: now })
      : null;
  }).filter(Boolean));

  for (const badgeId of targetBadgeIds) {
    if (!activeByBadge.has(badgeId)) {
      await store.insert("identityBadges", {
        id: makeId("identity_badge"),
        identityId: profile.id,
        badgeId,
        status: "active",
        source: "policy",
        grantedAt: now,
        updatedAt: now,
      });
    }
  }
  const summary = await badgeSummaryForIdentity(store, profile.id);
  await store.update("trustProfiles", profile.id, {
    badges: summary.map((badge) => ({
      id: badge.id,
      name: badge.name,
      type: badge.type,
      icon: badge.icon,
      color: badge.color,
      publicVisible: badge.publicVisible,
    })),
    updatedAt: now,
  });
  return summary;
}

async function updateTrustProjection(store, profile = {}, patch = {}) {
  const latest = await store.findById("trustProfiles", profile.id) || profile;
  const nextTrust = clamp(latest.communityTrust, patch.min, patch.max);
  const updated = await store.update("trustProfiles", profile.id, {
    ...patch.extra,
    communityTrust: nextTrust,
    communityLevel: communityLevel(nextTrust),
    status: communityStatus(nextTrust),
    communityId: communityId(profile.id),
    updatedAt: nowIso(),
  });
  return updated || latest;
}

async function recordCommunityEvent(store, profile, event = {}, trustConfig = {}) {
  if (!profile?.id || !event.type) return null;
  const policies = await getTrustPolicies(store);
  const context = {
    profile,
    event,
    payload: event.payload || {},
  };
  const policyResults = policies
    .filter((policy) => eventMatchesPolicy(policy, event))
    .map((policy) => policyResult(policy, context))
    .filter(Boolean);
  const totalTrustDelta = policyResults.reduce((sum, result) => sum + Number(result.delta || 0), 0);
  const now = nowIso();
  const communityEvent = {
    id: event.id || makeId("community_event"),
    identityId: profile.id,
    type: event.type,
    source: event.source || "system",
    activityId: event.activityId || "",
    actorId: event.actorId || "",
    reason: event.reason || "",
    payload: event.payload || {},
    policyResults,
    effects: {
      trustDelta: totalTrustDelta,
    },
    createdAt: now,
  };
  await store.insert("communityEvents", communityEvent);
  await recordTrustEvent(store, profile, {
    type: event.type,
    reason: event.reason || policyResults.map((result) => result.policyName).join("；") || event.type,
    delta: totalTrustDelta,
    activityIncrement: event.activityIncrement || 0,
    reportConfirmedIncrement: event.reportConfirmedIncrement || 0,
    activityId: event.activityId || "",
    metadata: {
      ...(event.metadata || {}),
      communityEventId: communityEvent.id,
      policyResults,
      payload: event.payload || {},
    },
  }, trustConfig);
  const latest = await store.findById("trustProfiles", profile.id) || profile;
  const extra = {};
  if (event.reportIncrement) extra.reportCount = Number(latest.reportCount || 0) + Number(event.reportIncrement || 0);
  if (event.registrationIncrement) extra.registrationCount = Number(latest.registrationCount || 0) + Number(event.registrationIncrement || 0);
  const projected = await updateTrustProjection(store, latest, {
    min: trustConfig.min,
    max: trustConfig.max,
    extra,
  });
  const badges = await refreshIdentityBadges(store, projected);
  return {
    event: communityEvent,
    profile: await store.findById("trustProfiles", profile.id) || projected,
    policyResults,
    badges,
  };
}

async function identityDetail(store, identityId) {
  const profile = await store.findById("trustProfiles", identityId);
  if (!profile) return null;
  const [{ data: communityEvents }, { data: trustEvents }, { data: badgeAssignments }, badges] = await Promise.all([
    store.query("communityEvents", {
      page: 1,
      pageSize: 150,
      maxPageSize: 200,
      filters: [{ field: "identityId", op: "eq", value: identityId }],
      sort: [{ field: "createdAt", direction: "desc" }],
    }),
    store.query("trustEvents", {
      page: 1,
      pageSize: 150,
      maxPageSize: 200,
      filters: [{ field: "identityId", op: "eq", value: identityId }],
      sort: [{ field: "createdAt", direction: "desc" }],
    }),
    store.query("identityBadges", {
      page: 1,
      pageSize: 100,
      maxPageSize: 200,
      filters: [{ field: "identityId", op: "eq", value: identityId }],
      sort: [{ field: "grantedAt", direction: "desc" }, { field: "updatedAt", direction: "desc" }],
    }),
    getCommunityBadges(store, { includeDisabled: true }),
  ]);
  const badgeMap = new Map(badges.map((badge) => [badge.id, badge]));
  return {
    profile: {
      ...profile,
      communityId: profile.communityId || communityId(profile.id),
      communityLevel: profile.communityLevel || communityLevel(profile.communityTrust),
      status: profile.status || communityStatus(profile.communityTrust),
    },
    communityEvents,
    trustEvents,
    badges: badgeAssignments.map((assignment) => ({
      ...assignment,
      badge: badgeMap.get(assignment.badgeId) || null,
    })),
  };
}

async function governanceOverview(store) {
  const [identityCount, policyCount, badgeCount, eventCount] = await Promise.all([
    store.count("trustProfiles"),
    store.count("trustPolicies"),
    store.count("communityBadges"),
    store.count("communityEvents"),
  ]);
  return {
    identities: { total: identityCount },
    trustPolicies: { total: policyCount },
    badges: { total: badgeCount },
    events: { total: eventCount },
  };
}

module.exports = {
  badgeFromInput,
  badgePolicyFromInput,
  badgeSummaryForIdentity,
  communityId,
  communityLevel,
  communityStatus,
  getBadgePolicies,
  getCommunityBadges,
  getTrustPolicies,
  governanceOverview,
  identityDetail,
  recordCommunityEvent,
  refreshIdentityBadges,
  trustPolicyFromInput,
  validateBadge,
  validateBadgePolicy,
  validateTrustPolicy,
};
