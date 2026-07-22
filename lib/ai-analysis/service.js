"use strict";

const { DEFAULT_AI_SETTINGS } = require("../community-safety/defaults");
const { decryptSecret, encryptSecret, maskSecret } = require("./crypto");
const { cacheKey, getCachedAnalysis, setCachedAnalysis } = require("./cache/store-cache");
const { getProviderAdapter } = require("./provider-registry");
const { logAiUsage } = require("./logger/usage-logger");
const { buildActivityMessages, getActivePrompt } = require("./prompts/service");
const { normalizeAnalysisReport } = require("./schema/analysis-report");
const { withRetry } = require("./retry/with-retry");

const ANALYSIS_SCHEMA_TEXT = JSON.stringify({
  riskScore: "0-100，越高越需要社区谨慎判断",
  confidence: "0-1，AI 对自身分析的置信度",
  riskLevel: "low | medium | high",
  isRealActivity: "boolean",
  isAdvertisement: "boolean",
  isSpam: "boolean",
  isScam: "boolean",
  containsPolitical: "boolean",
  containsIllegal: "boolean",
  containsAdult: "boolean",
  containsViolence: "boolean",
  summary: "活动摘要",
  category: "活动分类",
  tags: "标签数组",
  location: "地点",
  time: "时间",
  peopleLimit: "人数限制",
  titleSuggestion: "建议标题",
  riskReason: "风险原因数组",
  positiveSignals: "可信特征数组",
  negativeSignals: "风险特征数组",
  improvementSuggestions: "内容优化建议数组",
  explanation: "逐条解释风险分如何形成",
}, null, 2);

async function getAiSettings(store) {
  const config = await store.findById("systemConfigs", "ai_settings");
  return {
    ...DEFAULT_AI_SETTINGS,
    ...(config?.value || {}),
  };
}

function publicAiSettings(settings = {}) {
  const { apiKeyEncrypted, apiKey, ...rest } = settings;
  return {
    ...rest,
    apiKeyStatus: maskSecret(apiKeyEncrypted || apiKey),
  };
}

async function saveAiSettings(store, patch = {}) {
  const current = await getAiSettings(store);
  const next = {
    ...current,
    ...patch,
    callStrategy: { ...(current.callStrategy || {}), ...(patch.callStrategy || {}) },
    capabilities: { ...(current.capabilities || {}), ...(patch.capabilities || {}) },
  };
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    next.apiKeyEncrypted = patch.apiKey ? encryptSecret(patch.apiKey) : current.apiKeyEncrypted || "";
    next.apiKeyUpdatedAt = patch.apiKey ? new Date().toISOString() : current.apiKeyUpdatedAt || "";
    delete next.apiKey;
  }
  const item = {
    id: "ai_settings",
    value: next,
    updatedAt: new Date().toISOString(),
  };
  const existing = await store.findById("systemConfigs", item.id);
  if (existing) {
    await store.update("systemConfigs", item.id, item);
  } else {
    await store.insert("systemConfigs", { ...item, createdAt: item.updatedAt });
  }
  return next;
}

function shouldCallAi(settings = {}, context = {}) {
  if (!settings.enabled) return { call: false, reason: "disabled" };
  const strategy = settings.callStrategy || {};
  if (context.manual) return { call: strategy.manualReanalysis !== false, reason: "manual" };
  if (context.reported) return { call: strategy.reportedContent !== false, reason: "reported" };
  if (strategy.allContent) return { call: true, reason: "all-content" };
  const riskScore = Number(context.ruleReport?.riskScore || 0);
  if (strategy.mediumRiskOnly !== false) {
    const min = Number(strategy.mediumRiskMin ?? 30);
    const max = Number(strategy.mediumRiskMax ?? 70);
    if (riskScore >= min && riskScore <= max) return { call: true, reason: "medium-risk" };
  }
  if (strategy.lowTrustOnly && Number(context.trustProfile?.communityTrust ?? 50) <= Number(strategy.lowTrustThreshold ?? 35)) {
    return { call: true, reason: "low-trust" };
  }
  if (Number(strategy.randomSampleRate || 0) > 0 && Math.random() < Number(strategy.randomSampleRate)) {
    return { call: true, reason: "random-sample" };
  }
  return { call: false, reason: "strategy-skip" };
}

function activityPayload(input = {}) {
  return {
    title: input.title || "",
    moduleId: input.moduleId || "",
    initiator: input.initiator || "",
    startsAt: input.startsAt || "",
    endsAt: input.endsAt || "",
    location: input.location || "",
    capacity: input.capacity || "",
    description: input.description || "",
    showInitiatorContact: Boolean(input.showInitiatorContact),
    hasContact: Boolean(input.initiatorContact),
  };
}

async function analyzeActivity(store, input = {}, context = {}) {
  const settings = await getAiSettings(store);
  const decision = shouldCallAi(settings, context);
  if (!decision.call) return { skipped: true, reason: decision.reason, report: null };
  const payload = activityPayload(input);
  const key = cacheKey(payload, settings);
  const startedAt = Date.now();
  const cached = await getCachedAnalysis(store, key);
  if (cached) {
    await logAiUsage(store, {
      provider: settings.provider,
      model: settings.model,
      contentType: "activity",
      activityId: context.activityId,
      durationMs: Date.now() - startedAt,
      cacheHit: true,
    });
    return { skipped: false, reason: "cache", report: normalizeAnalysisReport(cached), cacheHit: true };
  }

  let apiKey = "";
  try {
    apiKey = decryptSecret(settings.apiKeyEncrypted || "");
  } catch {
    apiKey = "";
  }
  const prompt = await getActivePrompt(store, "activity", settings.promptVersion);
  const messages = buildActivityMessages(prompt, payload, ANALYSIS_SCHEMA_TEXT);
  const adapter = getProviderAdapter(settings.provider);
  try {
    const result = await withRetry(
      () => adapter.chatCompletion({ ...settings, apiKey }, messages),
      { retryCount: settings.retryCount, delayMs: 350 }
    );
    const report = normalizeAnalysisReport(result.report);
    await setCachedAnalysis(store, key, report, settings.cacheTtlSeconds);
    await logAiUsage(store, {
      provider: settings.provider,
      model: settings.model,
      contentType: "activity",
      activityId: context.activityId,
      durationMs: Date.now() - startedAt,
      ok: true,
      tokenUsage: result.usage || {},
    });
    return { skipped: false, reason: decision.reason, report, raw: result.raw };
  } catch (error) {
    await logAiUsage(store, {
      provider: settings.provider,
      model: settings.model,
      contentType: "activity",
      activityId: context.activityId,
      durationMs: Date.now() - startedAt,
      ok: false,
      error: error.message,
    });
    return {
      skipped: true,
      reason: "ai-unavailable",
      error: error.message,
      report: null,
    };
  }
}

async function testAiConnection(store, override = {}) {
  const settings = { ...(await getAiSettings(store)), ...override };
  let apiKey = override.apiKey || "";
  if (!apiKey) {
    try {
      apiKey = decryptSecret(settings.apiKeyEncrypted || "");
    } catch {
      apiKey = "";
    }
  }
  const adapter = getProviderAdapter(settings.provider);
  const startedAt = Date.now();
  try {
    const result = await adapter.testConnection({ ...settings, apiKey });
    return { ...result, durationMs: result.durationMs || Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      provider: settings.provider || "",
      model: settings.model || "",
      durationMs: Date.now() - startedAt,
      error: error.message,
    };
  }
}

module.exports = {
  analyzeActivity,
  getAiSettings,
  publicAiSettings,
  saveAiSettings,
  shouldCallAi,
  testAiConnection,
};
