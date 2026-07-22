"use strict";

const crypto = require("crypto");

const { analyzeActivity: analyzeActivityWithAi } = require("../ai-analysis/service");
const { recordCommunityEvent } = require("../community-governance/service");
const { DEFAULT_SAFETY_CONFIG, DEFAULT_SAFETY_RULES } = require("./defaults");
const { requestIdentity, publicIdentity, hashValue } = require("./identity");
const { checkActivityPublishLimit, checkSimpleLimit, pruneExpiredRateEvents } = require("./rate-limit");
const { analyzeRules } = require("./rule-engine");
const { decideActivityPolicy, riskNoticeFor } = require("./policy-engine");
const { getOrCreateTrustProfile } = require("./trust-engine");
const { verifyTurnstile } = require("./turnstile");

function nowIso() {
  return new Date().toISOString();
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch === undefined ? base : patch;
  const output = { ...(base || {}) };
  Object.entries(patch).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

async function getSafetyConfig(store) {
  const config = await store.findById("systemConfigs", "safety_config");
  return deepMerge(DEFAULT_SAFETY_CONFIG, config?.value || {});
}

async function saveSafetyConfig(store, patch = {}) {
  const current = await getSafetyConfig(store);
  const next = deepMerge(current, patch);
  const item = {
    id: "safety_config",
    value: next,
    updatedAt: nowIso(),
  };
  const existing = await store.findById("systemConfigs", item.id);
  if (existing) await store.update("systemConfigs", item.id, item);
  else await store.insert("systemConfigs", { ...item, createdAt: item.updatedAt });
  return next;
}

async function getSafetyRules(store, options = {}) {
  const { data } = await store.query("safetyRules", {
    page: 1,
    pageSize: 200,
    maxPageSize: 500,
    sort: [{ field: "createdAt", direction: "asc" }],
  });
  const rules = data.length ? data : DEFAULT_SAFETY_RULES;
  return options.includeDisabled ? rules : rules.filter((rule) => rule.enabled !== false);
}

function makeManageToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashManageToken(activityId, token) {
  return hashValue(`activity-manage:${activityId}:${token}`, process.env.IDENTITY_HASH_SALT || process.env.SESSION_SECRET || "youkong-local");
}

function getManageToken(req) {
  return String(req.get("X-YK-Manage-Token") || req.query.manageToken || req.body?.manageToken || "").trim();
}

function verifyManageToken(activity, token = "") {
  if (!activity?.manageTokenHash || !token) return false;
  const expected = hashManageToken(activity.id, token);
  const left = Buffer.from(String(activity.manageTokenHash), "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function requestOwnerContext(store, req) {
  const identity = requestIdentity(req);
  const config = await getSafetyConfig(store);
  const trustProfile = await getOrCreateTrustProfile(store, identity, config.trust);
  return { identity, trustProfile, safetyConfig: config };
}

async function countPriorIdentityActivities(store, identityId = "", activityId = "") {
  if (!identityId) return 0;
  const total = await store.count("activities", {
    filters: [{ field: "anonymousIdentityId", op: "eq", value: identityId }],
  });
  if (!activityId) return total;
  const current = await store.findById("activities", activityId);
  return current?.anonymousIdentityId === identityId ? Math.max(0, total - 1) : total;
}

async function analyzeActivitySafety(store, input, context = {}) {
  const safetyConfig = context.safetyConfig || await getSafetyConfig(store);
  const rules = await getSafetyRules(store);
  const ruleReport = analyzeRules(input, rules, safetyConfig.ruleEngine || {});
  const aiResult = await analyzeActivityWithAi(store, input, {
    ruleReport,
    trustProfile: context.trustProfile,
    manual: context.manual,
    reported: context.reported,
    intent: context.intent,
    identityActivityCount: context.identityActivityCount,
    activityNumber: context.activityNumber,
    activityId: context.activityId,
  });
  const aiReport = aiResult.report || null;
  const aiDecisionReason = aiResult.decision?.reason || aiResult.reason || "";
  const aiExpected = aiResult.decision?.call === true
    || ["disabled", "missing-api-key", "ai-unavailable"].includes(aiResult.reason || "");
  const aiUnavailable = !aiReport && ["disabled", "missing-api-key", "ai-unavailable"].includes(aiResult.reason || "");
  const policy = decideActivityPolicy({
    intent: context.intent || "submit",
    ruleReport,
    aiReport,
    trustProfile: context.trustProfile,
    config: {
      ...(safetyConfig.policy || {}),
      aiUnavailable,
      aiExpected,
      aiDecisionReason,
    },
  });
  return {
    ruleReport,
    aiResult,
    aiReport,
    policy,
  };
}

async function prepareActivitySubmission(store, req, input, options = {}) {
  const context = await requestOwnerContext(store, req);
  await pruneExpiredRateEvents(store).catch(() => {});
  const intent = options.intent === "draft" ? "draft" : "submit";
  context.identityActivityCount = await countPriorIdentityActivities(store, context.identity.id, options.activityId || "");
  context.activityNumber = context.identityActivityCount + 1;

  if (intent !== "draft") {
    const turnstileConfig = context.safetyConfig.turnstile || {};
    const trust = Number(context.trustProfile.communityTrust ?? 50);
    const mustVerify = turnstileConfig.enabled === true
      && (!turnstileConfig.requiredBelowTrust || trust <= Number(turnstileConfig.requiredBelowTrust));
    if (mustVerify) {
      const turnstile = await verifyTurnstile(req, turnstileConfig);
      if (!turnstile.ok) {
        return { ok: false, statusCode: 400, error: turnstile.error || "请先完成人机验证", context };
      }
    }
  }

  const limit = await checkActivityPublishLimit(
    store,
    context.identity,
    context.trustProfile,
    context.safetyConfig.rateLimit || {},
    { intent }
  );
  if (!limit.allowed) {
    return { ok: false, statusCode: 429, error: limit.message, context, limit };
  }

  const analysis = await analyzeActivitySafety(store, input, {
    ...context,
    intent,
    activityId: options.activityId,
  });
  if (intent !== "draft") {
    await recordCommunityEvent(store, context.trustProfile, {
      type: "activity.submitted",
      source: "activity",
      reason: `提交活动：${input.title || "未命名活动"}`,
      activityIncrement: 1,
      activityId: options.activityId || "",
      payload: {
        intent,
        title: input.title || "",
        riskScore: analysis.policy.riskScore,
        confidenceScore: analysis.policy.confidenceScore,
        riskLevel: analysis.policy.riskLevel,
        policyAction: analysis.policy.action,
      },
    }, context.safetyConfig.trust);
    context.trustProfile = await store.findById("trustProfiles", context.trustProfile.id) || context.trustProfile;
    await recordCommunityEvent(store, context.trustProfile, {
      type: "activity.confidence.evaluated",
      source: "activity",
      reason: `活动置信度评估：${input.title || "未命名活动"}`,
      activityId: options.activityId || "",
      payload: {
        riskScore: analysis.policy.riskScore,
        confidenceScore: analysis.policy.confidenceScore,
        sourceRiskScore: analysis.policy.sourceRiskScore,
        aiRiskScore: analysis.policy.aiRiskScore,
        aiAdjustment: analysis.policy.aiAdjustment,
        riskLevel: analysis.policy.riskLevel,
        policyAction: analysis.policy.action,
        activityNumber: context.activityNumber,
      },
    }, context.safetyConfig.trust);
    context.trustProfile = await store.findById("trustProfiles", context.trustProfile.id) || context.trustProfile;
  }

  return {
    ok: true,
    context,
    analysis,
    limit,
  };
}

async function storeAnalysisReport(store, activityId, analysis, context = {}) {
  const now = nowIso();
  const report = {
    id: `analysis_${activityId}_${Date.now()}`,
    activityId,
    identityId: context.identity?.id || "",
    ruleReport: analysis.ruleReport,
    aiReport: analysis.aiReport,
    aiMeta: {
      skipped: Boolean(analysis.aiResult?.skipped),
      reason: analysis.aiResult?.reason || "",
      triggerReason: analysis.aiResult?.decision?.reason || analysis.aiResult?.reason || "",
      error: analysis.aiResult?.error || "",
      cacheHit: Boolean(analysis.aiResult?.cacheHit),
      identityActivityCount: Number(context.identityActivityCount ?? 0),
      activityNumber: Number(context.activityNumber ?? 0),
    },
    policy: analysis.policy,
    createdAt: now,
  };
  await store.insert("analysisReports", report);
  return report;
}

function activityRiskPatch(report, context = {}) {
  const policy = report.policy || {};
  return {
    riskScore: Number(policy.riskScore || 0),
    confidenceScore: Number(policy.confidenceScore ?? (100 - Number(policy.riskScore || 0))),
    riskLevel: policy.riskLevel || "low",
    riskNotice: policy.riskNotice || riskNoticeFor("none"),
    policyAction: policy.action || "",
    safetyFallbackReason: policy.safetyFallbackReason || "",
    recommendationWeight: Number(policy.recommendationWeight || 0),
    sourceRiskScore: Number(policy.sourceRiskScore ?? policy.riskScore ?? 0),
    aiRiskScore: policy.aiRiskScore === undefined ? null : Number(policy.aiRiskScore),
    aiAdjustment: Number(policy.aiAdjustment || 0),
    analysisReportId: report.id,
    ruleFindings: report.ruleReport?.findings || [],
    aiReport: report.aiReport || null,
    trustSnapshot: context.trustProfile ? {
      identityId: context.trustProfile.id,
      communityTrust: context.trustProfile.communityTrust,
    } : null,
  };
}

async function submitCommunityReport(store, req, activity, reason, detail = "") {
  const context = await requestOwnerContext(store, req);
  const config = context.safetyConfig;
  const limit = await checkSimpleLimit(
    store,
    context.identity,
    "community-report:day",
    Number(config.rateLimit?.reportDayMax || 12),
    24 * 60 * 60 * 1000,
    { activityId: activity.id }
  );
  if (!limit.allowed) {
    return { ok: false, statusCode: 429, error: "今天提交的反馈有点多了，可以晚些再来。" };
  }
  const existing = await store.findByFilters("communityReports", [
    { field: "activityId", op: "eq", value: activity.id },
    { field: "identityId", op: "eq", value: context.identity.id },
  ]);
  if (existing) {
    return { ok: true, existing: true, report: existing, context };
  }
  const now = nowIso();
  const report = {
    id: `report_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
    activityId: activity.id,
    identityId: context.identity.id,
    reason,
    detail: String(detail || "").slice(0, 500),
    status: "submitted",
    createdAt: now,
  };
  await store.insert("communityReports", report);
  await recordCommunityEvent(store, context.trustProfile, {
    type: "community.report.submitted",
    source: "report",
    reason: `提交活动举报：${reason}`,
    activityId: activity.id,
    reportIncrement: 1,
    payload: {
      reason,
      detailLength: String(detail || "").length,
    },
  }, config.trust);
  return { ok: true, report, context };
}

module.exports = {
  activityRiskPatch,
  analyzeActivitySafety,
  getManageToken,
  getSafetyConfig,
  getSafetyRules,
  hashManageToken,
  makeManageToken,
  prepareActivitySubmission,
  publicIdentity,
  requestOwnerContext,
  saveSafetyConfig,
  storeAnalysisReport,
  submitCommunityReport,
  verifyManageToken,
};
