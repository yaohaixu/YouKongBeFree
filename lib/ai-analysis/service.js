"use strict";

const { DEFAULT_AI_MODEL_PROFILES, DEFAULT_AI_SETTINGS } = require("../community-safety/defaults");
const { decryptSecret, encryptSecret, maskSecret } = require("./crypto");
const { cacheKey, getCachedAnalysis, setCachedAnalysis } = require("./cache/store-cache");
const { getProviderAdapter } = require("./provider-registry");
const { logAiUsage } = require("./logger/usage-logger");
const { buildActivityMessages, buildFeedbackMessages, getActivePrompt } = require("./prompts/service");
const { normalizeAnalysisReport } = require("./schema/analysis-report");
const { normalizeFeedbackReport } = require("./schema/feedback-report");
const { withRetry } = require("./retry/with-retry");

const AI_SCENES = ["activity", "feedback", "report", "manual"];
const DEFAULT_PROFILE_ID = "ai_model_default";

const ANALYSIS_SCHEMA_TEXT = JSON.stringify({
  riskScore: "0-100，越高越需要社区谨慎判断",
  confidence: "0-1，AI 对自身分析的置信度",
  riskLevel: "low | medium | high",
  isRealActivity: "boolean",
  isAdvertisement: "boolean",
  advertisementLevel: "none | suspected | clear，营销倾向等级；疑似营销用 suspected，明确推广/引流/销售用 clear",
  isSpam: "boolean",
  spamLevel: "none | suspected | clear，垃圾内容等级",
  isScam: "boolean",
  containsPolitical: "boolean",
  politicalSensitivity: "none | suspected | clear，政治敏感等级；疑似也必须标 suspected",
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

const FEEDBACK_SCHEMA_TEXT = JSON.stringify({
  riskScore: "0-100，越高越不适合直接公开展示",
  confidence: "0-1，AI 对自身分析的置信度",
  riskLevel: "low | medium | high",
  shouldDisplay: "boolean，是否建议公开展示",
  feedbackWeight: "0-100，仅用于公开反馈排序，不是活动评分",
  isSpam: "boolean",
  isAdvertisement: "boolean",
  containsAbuse: "boolean",
  containsPersonalAttack: "boolean",
  containsPolitical: "boolean",
  containsIllegal: "boolean",
  containsAdult: "boolean",
  summary: "反馈摘要",
  riskReason: "风险原因数组",
  positiveSignals: "对社区复盘有帮助的特征数组",
  negativeSignals: "不适合展示或信息量不足的特征数组",
  displayReason: "是否展示和排序权重的简短理由",
}, null, 2);

function uniqueList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)));
}

function normalizeScene(scene = "activity") {
  return AI_SCENES.includes(scene) ? scene : "activity";
}

function defaultSceneRouting() {
  return Object.fromEntries(AI_SCENES.map((scene) => [
    scene,
    { primaryProfileId: DEFAULT_PROFILE_ID, fallbackProfileIds: [] },
  ]));
}

function mergeSceneRouting(value = {}) {
  const merged = defaultSceneRouting();
  for (const scene of AI_SCENES) {
    const route = value?.[scene] || {};
    merged[scene] = {
      primaryProfileId: String(route.primaryProfileId || merged[scene].primaryProfileId || "").trim(),
      fallbackProfileIds: uniqueList(route.fallbackProfileIds || []),
    };
  }
  return merged;
}

function mergeAiSettings(value = {}) {
  const callStrategy = {
    ...(DEFAULT_AI_SETTINGS.callStrategy || {}),
    ...((value || {}).callStrategy || {}),
  };
  callStrategy.dailyCallLimit = Math.max(0, Math.min(100000, Number(callStrategy.dailyCallLimit ?? 200)));
  return {
    ...DEFAULT_AI_SETTINGS,
    ...(value || {}),
    activeProfileId: String((value || {}).activeProfileId || DEFAULT_AI_SETTINGS.activeProfileId || DEFAULT_PROFILE_ID).trim(),
    fallbackEnabled: (value || {}).fallbackEnabled ?? DEFAULT_AI_SETTINGS.fallbackEnabled,
    fallbackProfileIds: uniqueList((value || {}).fallbackProfileIds || DEFAULT_AI_SETTINGS.fallbackProfileIds || []),
    sceneRouting: mergeSceneRouting((value || {}).sceneRouting || DEFAULT_AI_SETTINGS.sceneRouting || {}),
    callStrategy,
    capabilities: {
      ...(DEFAULT_AI_SETTINGS.capabilities || {}),
      ...((value || {}).capabilities || {}),
    },
    promptVersions: {
      ...(DEFAULT_AI_SETTINGS.promptVersions || {}),
      ...((value || {}).promptVersions || {}),
    },
  };
}

function dayStartIso(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function countAiProviderCallsToday(store, filters = []) {
  return store.count("aiUsageLogs", {
    filters: [
      { field: "createdAt", op: "gte", value: dayStartIso() },
      { field: "cacheHit", op: "eq", value: false },
      ...filters,
    ],
  });
}

async function checkAiDailyBudget(store, settings = {}, profile = {}) {
  const globalLimit = Math.max(0, Number(settings.callStrategy?.dailyCallLimit || 0));
  if (globalLimit > 0) {
    const globalCalls = await countAiProviderCallsToday(store);
    if (globalCalls >= globalLimit) {
      return {
        allowed: false,
        scope: "global",
        limit: globalLimit,
        count: globalCalls,
        error: `AI 今日全站调用已达到 ${globalLimit} 次上限`,
      };
    }
  }
  const profileLimit = Math.max(0, Number(profile.dailyLimit || 0));
  if (profileLimit > 0 && profile.id) {
    const profileCalls = await countAiProviderCallsToday(store, [{ field: "profileId", op: "eq", value: profile.id }]);
    if (profileCalls >= profileLimit) {
      return {
        allowed: false,
        scope: "profile",
        limit: profileLimit,
        count: profileCalls,
        error: `模型「${profile.name || profile.model || profile.id}」今日调用已达到 ${profileLimit} 次上限`,
      };
    }
  }
  return { allowed: true };
}

async function getAiSettings(store) {
  const config = await store.findById("systemConfigs", "ai_settings");
  return mergeAiSettings(config?.value || {});
}

function publicAiSettings(settings = {}) {
  const { apiKeyEncrypted, apiKey, ...rest } = settings;
  return {
    ...rest,
    apiKeyStatus: maskSecret(apiKeyEncrypted || apiKey),
  };
}

function legacyProfileFromSettings(settings = {}) {
  const defaults = DEFAULT_AI_MODEL_PROFILES[0];
  return {
    ...defaults,
    provider: settings.provider || defaults.provider,
    baseUrl: settings.baseUrl || defaults.baseUrl,
    model: settings.model || defaults.model,
    apiKeyEncrypted: settings.apiKeyEncrypted || defaults.apiKeyEncrypted,
    apiKeyUpdatedAt: settings.apiKeyUpdatedAt || defaults.apiKeyUpdatedAt,
    requestTimeoutMs: settings.requestTimeoutMs || defaults.requestTimeoutMs,
    temperature: settings.temperature ?? defaults.temperature,
    maxTokens: settings.maxTokens || defaults.maxTokens,
    retryCount: settings.retryCount ?? defaults.retryCount,
  };
}

function normalizeModelProfile(profile = {}) {
  const defaults = DEFAULT_AI_MODEL_PROFILES[0];
  return {
    ...defaults,
    ...(profile || {}),
    id: String(profile.id || defaults.id).trim(),
    name: String(profile.name || defaults.name || "默认模型").trim(),
    provider: String(profile.provider || defaults.provider || "openai-compatible").trim(),
    baseUrl: String(profile.baseUrl || "").trim(),
    model: String(profile.model || "").trim(),
    apiKeyEncrypted: profile.apiKeyEncrypted || "",
    apiKeyUpdatedAt: profile.apiKeyUpdatedAt || "",
    enabled: profile.enabled !== false,
    priority: Math.max(1, Number(profile.priority || defaults.priority || 1)),
    sceneScopes: uniqueList(profile.sceneScopes && profile.sceneScopes.length ? profile.sceneScopes : defaults.sceneScopes),
    requestTimeoutMs: Math.max(1000, Number(profile.requestTimeoutMs || defaults.requestTimeoutMs || 15000)),
    temperature: Math.max(0, Math.min(2, Number(profile.temperature ?? defaults.temperature ?? 0.2))),
    maxTokens: Math.max(1, Number(profile.maxTokens || defaults.maxTokens || 1200)),
    retryCount: Math.max(0, Math.min(5, Number(profile.retryCount ?? defaults.retryCount ?? 1))),
    dailyLimit: Math.max(0, Number(profile.dailyLimit || 0)),
    healthStatus: String(profile.healthStatus || "unknown"),
    lastTestAt: profile.lastTestAt || "",
    lastDurationMs: Number(profile.lastDurationMs || 0),
    lastError: profile.lastError || "",
  };
}

function publicAiModelProfile(profile = {}) {
  const normalized = normalizeModelProfile(profile);
  const { apiKeyEncrypted, apiKey, ...rest } = normalized;
  return {
    ...rest,
    apiKeyStatus: maskSecret(apiKeyEncrypted || apiKey),
  };
}

async function ensureAiModelProfiles(store, settings = null) {
  const effectiveSettings = settings || await getAiSettings(store);
  const { data } = await store.query("aiModelProfiles", {
    page: 1,
    pageSize: 500,
    maxPageSize: 500,
    sort: [{ field: "priority", direction: "asc" }, { field: "updatedAt", direction: "desc" }],
  });
  let profiles = data.map(normalizeModelProfile);
  const existingDefault = profiles.find((item) => item.id === DEFAULT_PROFILE_ID);
  if (!existingDefault) {
    const now = new Date().toISOString();
    const profile = { ...legacyProfileFromSettings(effectiveSettings), createdAt: now, updatedAt: now };
    await store.insert("aiModelProfiles", profile);
    profiles.push(normalizeModelProfile(profile));
  } else if (!existingDefault.model && effectiveSettings.model) {
    const patch = {
      provider: existingDefault.provider || effectiveSettings.provider || "openai-compatible",
      baseUrl: existingDefault.baseUrl || effectiveSettings.baseUrl || "",
      model: effectiveSettings.model,
      apiKeyEncrypted: existingDefault.apiKeyEncrypted || effectiveSettings.apiKeyEncrypted || "",
      apiKeyUpdatedAt: existingDefault.apiKeyUpdatedAt || effectiveSettings.apiKeyUpdatedAt || "",
      updatedAt: new Date().toISOString(),
    };
    const updated = await store.update("aiModelProfiles", existingDefault.id, patch);
    profiles = profiles.map((item) => item.id === existingDefault.id ? normalizeModelProfile(updated || { ...item, ...patch }) : item);
  }
  return profiles.sort((a, b) => Number(a.priority || 1) - Number(b.priority || 1));
}

async function listAiModelProfiles(store) {
  const settings = await getAiSettings(store);
  const profiles = await ensureAiModelProfiles(store, settings);
  return profiles.map(publicAiModelProfile);
}

async function getAiModelProfile(store, id) {
  const settings = await getAiSettings(store);
  await ensureAiModelProfiles(store, settings);
  const profile = await store.findById("aiModelProfiles", id);
  return profile ? normalizeModelProfile(profile) : null;
}

async function saveAiModelProfile(store, input = {}, existing = null) {
  const now = new Date().toISOString();
  const current = existing ? normalizeModelProfile(existing) : null;
  const base = current || DEFAULT_AI_MODEL_PROFILES[0];
  const next = normalizeModelProfile({
    ...base,
    ...input,
    id: input.id || current?.id || `ai_model_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  });
  if (Object.prototype.hasOwnProperty.call(input, "apiKey")) {
    next.apiKeyEncrypted = input.apiKey ? encryptSecret(input.apiKey) : current?.apiKeyEncrypted || "";
    next.apiKeyUpdatedAt = input.apiKey ? now : current?.apiKeyUpdatedAt || "";
    delete next.apiKey;
  } else {
    next.apiKeyEncrypted = current?.apiKeyEncrypted || input.apiKeyEncrypted || "";
    next.apiKeyUpdatedAt = current?.apiKeyUpdatedAt || input.apiKeyUpdatedAt || "";
  }
  if (current) {
    return normalizeModelProfile(await store.update("aiModelProfiles", current.id, next) || next);
  }
  await store.insert("aiModelProfiles", next);
  return next;
}

async function removeAiModelProfile(store, id) {
  if (id === DEFAULT_PROFILE_ID) {
    throw new Error("默认模型档案不能删除，可以关闭或改名。");
  }
  await store.remove("aiModelProfiles", (item) => item.id === id);
}

async function saveAiSettings(store, patch = {}) {
  const current = await getAiSettings(store);
  const legacyModelKeys = ["provider", "baseUrl", "model", "apiKey", "requestTimeoutMs", "temperature", "maxTokens", "retryCount"];
  const hasLegacyModelPatch = legacyModelKeys.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
  const next = mergeAiSettings({
    ...current,
    ...patch,
    callStrategy: { ...(current.callStrategy || {}), ...(patch.callStrategy || {}) },
    capabilities: { ...(current.capabilities || {}), ...(patch.capabilities || {}) },
    promptVersions: { ...(current.promptVersions || {}), ...(patch.promptVersions || {}) },
    sceneRouting: { ...(current.sceneRouting || {}), ...(patch.sceneRouting || {}) },
  });
  if (hasLegacyModelPatch && !Object.prototype.hasOwnProperty.call(patch, "sceneRouting")) {
    next.activeProfileId = DEFAULT_PROFILE_ID;
    next.sceneRouting = Object.fromEntries(AI_SCENES.map((scene) => [
      scene,
      { primaryProfileId: DEFAULT_PROFILE_ID, fallbackProfileIds: [] },
    ]));
    next.fallbackProfileIds = [];
  }
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
  if (hasLegacyModelPatch) {
    const defaultProfile = await store.findById("aiModelProfiles", DEFAULT_PROFILE_ID);
    const profilePatch = {
      id: DEFAULT_PROFILE_ID,
      name: "默认模型",
      provider: next.provider,
      baseUrl: next.baseUrl,
      model: next.model,
      apiKey: Object.prototype.hasOwnProperty.call(patch, "apiKey") ? patch.apiKey : undefined,
      requestTimeoutMs: next.requestTimeoutMs,
      temperature: next.temperature,
      maxTokens: next.maxTokens,
      retryCount: next.retryCount,
    };
    await saveAiModelProfile(store, profilePatch, defaultProfile || null);
  }
  return next;
}

function shouldCallAi(settings = {}, context = {}) {
  if (context.forceAi) return { call: true, reason: "manual-forced" };
  if (!settings.enabled) return { call: false, reason: "disabled" };
  const strategy = settings.callStrategy || {};
  if (context.manual) return { call: strategy.manualReanalysis !== false, reason: "manual" };
  if (context.reported) return { call: strategy.reportedContent !== false, reason: "reported" };
  if (context.intent === "draft") return { call: false, reason: "draft" };
  if (strategy.allContent) return { call: true, reason: "all-content" };
  const riskScore = Number(context.ruleReport?.riskScore || 0);
  const confidenceScore = Number.isFinite(Number(context.ruleReport?.confidenceScore))
    ? Number(context.ruleReport.confidenceScore)
    : Math.max(0, Math.min(100, 100 - riskScore));
  const firstActivityCount = Math.max(0, Number(strategy.firstActivityCount ?? 0));
  if (
    strategy.firstActivitiesAlways !== false
    && firstActivityCount > 0
    && Number(context.identityActivityCount ?? Number.POSITIVE_INFINITY) < firstActivityCount
  ) {
    return { call: true, reason: "new-identity-first-activities" };
  }
  if (strategy.lowConfidenceOnly !== false) {
    const maxConfidence = Number(strategy.ruleConfidenceMax ?? 70);
    if (confidenceScore <= maxConfidence) return { call: true, reason: "low-rule-confidence" };
  }
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

function feedbackPayload(input = {}) {
  return {
    activityTitle: input.activityTitle || "",
    activityModule: input.activityModule || "",
    activitySource: input.activitySource || "",
    favorite: input.favorite || "",
    improvement: input.improvement || "",
    other: input.other || "",
  };
}

function promptVersionFor(settings = {}, type = "activity") {
  if (settings.promptVersions?.[type]) return settings.promptVersions[type];
  if (type === "activity") return settings.promptVersion || "activity-default-v1";
  return `${type}-default-v1`;
}

function profileSupportsScene(profile = {}, scene = "activity") {
  const scopes = uniqueList(profile.sceneScopes || []);
  return !scopes.length || scopes.includes(scene) || scopes.includes("all");
}

function profileSettings(settings = {}, profile = {}, promptVersion = "", scene = "activity") {
  return {
    ...settings,
    provider: profile.provider || settings.provider,
    baseUrl: profile.baseUrl || settings.baseUrl,
    model: profile.model || settings.model,
    apiKeyEncrypted: profile.apiKeyEncrypted || settings.apiKeyEncrypted,
    requestTimeoutMs: profile.requestTimeoutMs || settings.requestTimeoutMs,
    temperature: profile.temperature ?? settings.temperature,
    maxTokens: profile.maxTokens || settings.maxTokens,
    retryCount: profile.retryCount ?? settings.retryCount,
    profileId: profile.id || "",
    profileName: profile.name || "",
    scene,
    promptVersion,
  };
}

async function resolveProfilesForScene(store, settings = {}, scene = "activity") {
  const normalizedScene = normalizeScene(scene);
  const profiles = await ensureAiModelProfiles(store, settings);
  const enabledProfiles = profiles.filter((profile) => profile.enabled !== false);
  const byId = new Map(enabledProfiles.map((profile) => [profile.id, profile]));
  const route = settings.sceneRouting?.[normalizedScene] || {};
  const ids = uniqueList([
    route.primaryProfileId,
    settings.activeProfileId,
    ...(route.fallbackProfileIds || []),
    ...(settings.fallbackProfileIds || []),
  ]);
  const ordered = [];
  for (const id of ids) {
    const profile = byId.get(id);
    if (profile && profileSupportsScene(profile, normalizedScene) && !ordered.some((item) => item.id === profile.id)) {
      ordered.push(profile);
    }
  }
  const scoped = enabledProfiles
    .filter((profile) => profileSupportsScene(profile, normalizedScene))
    .sort((a, b) => Number(a.priority || 1) - Number(b.priority || 1));
  for (const profile of scoped) {
    if (!ordered.some((item) => item.id === profile.id)) ordered.push(profile);
  }
  return settings.fallbackEnabled === false ? ordered.slice(0, 1) : ordered;
}

function decryptProfileKey(settings = {}) {
  try {
    return decryptSecret(settings.apiKeyEncrypted || "");
  } catch {
    return "";
  }
}

async function markProfileHealth(store, profile = {}, patch = {}) {
  if (!profile.id) return;
  await store.update("aiModelProfiles", profile.id, {
    ...patch,
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
}

async function runAiAnalysis(store, options = {}) {
  const {
    settings,
    scene,
    contentType,
    activityId,
    payload,
    prompt,
    messages,
    normalizer,
    decision,
    context = {},
  } = options;
  const promptVersion = prompt.version || promptVersionFor(settings, contentType);
  const profiles = await resolveProfilesForScene(store, settings, scene || contentType);
  const bypassCache = Boolean(context.forceAi || context.bypassCache);
  const attempts = [];
  const startedAt = Date.now();
  if (!profiles.length) {
    return {
      skipped: true,
      reason: "missing-profile",
      decision,
      error: "AI 已启用但没有可用模型档案",
      report: null,
      prompt,
      attempts,
    };
  }

  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index];
    const attemptStartedAt = Date.now();
    const effectiveSettings = profileSettings(settings, profile, promptVersion, scene || contentType);
    const key = cacheKey({ type: contentType, ...payload }, effectiveSettings);
    const fallbackFrom = attempts.length ? attempts[attempts.length - 1].profileId || "" : "";
    const usageBase = {
      profileId: profile.id,
      profileName: profile.name,
      scene: scene || contentType,
      provider: effectiveSettings.provider,
      model: effectiveSettings.model,
      contentType,
      activityId,
      attempt: index + 1,
      fallbackFrom,
      promptVersion,
    };
    const cached = bypassCache ? null : await getCachedAnalysis(store, key);
    if (cached) {
      await logAiUsage(store, {
        ...usageBase,
        durationMs: Date.now() - attemptStartedAt,
        cacheHit: true,
      });
      attempts.push({ profileId: profile.id, profileName: profile.name, ok: true, cacheHit: true });
      return {
        skipped: false,
        reason: decision.reason,
        decision,
        report: normalizer(cached),
        cacheHit: true,
        prompt,
        profile: publicAiModelProfile(profile),
        attempts,
      };
    }

    const apiKey = decryptProfileKey(effectiveSettings);
    const budget = await checkAiDailyBudget(store, settings, profile);
    if (!budget.allowed) {
      attempts.push({
        profileId: profile.id,
        profileName: profile.name,
        ok: false,
        error: "daily-limit-exceeded",
        scope: budget.scope,
        limit: budget.limit,
        count: budget.count,
      });
      if (budget.scope === "global") {
        return {
          skipped: true,
          reason: "daily-limit-exceeded",
          decision,
          error: budget.error,
          report: null,
          prompt,
          attempts,
          durationMs: Date.now() - startedAt,
        };
      }
      continue;
    }
    if (!apiKey && effectiveSettings.provider !== "ollama" && effectiveSettings.provider !== "local") {
      const error = "missing-api-key";
      await logAiUsage(store, {
        ...usageBase,
        durationMs: Date.now() - attemptStartedAt,
        ok: false,
        error,
      });
      await markProfileHealth(store, profile, {
        healthStatus: "error",
        lastTestAt: new Date().toISOString(),
        lastDurationMs: Date.now() - attemptStartedAt,
        lastError: "缺少 API Key",
      });
      attempts.push({ profileId: profile.id, profileName: profile.name, ok: false, error });
      continue;
    }

    const adapter = getProviderAdapter(effectiveSettings.provider);
    try {
      const result = await withRetry(
        () => adapter.chatCompletion({ ...effectiveSettings, apiKey }, messages),
        { retryCount: effectiveSettings.retryCount, delayMs: 350 }
      );
      const report = normalizer(result.report);
      await setCachedAnalysis(store, key, report, effectiveSettings.cacheTtlSeconds);
      await logAiUsage(store, {
        ...usageBase,
        durationMs: Date.now() - attemptStartedAt,
        ok: true,
        tokenUsage: result.usage || {},
      });
      await markProfileHealth(store, profile, {
        healthStatus: "ok",
        lastTestAt: new Date().toISOString(),
        lastDurationMs: Date.now() - attemptStartedAt,
        lastError: "",
      });
      attempts.push({ profileId: profile.id, profileName: profile.name, ok: true });
      return {
        skipped: false,
        reason: decision.reason,
        decision,
        report,
        raw: result.raw,
        prompt,
        profile: publicAiModelProfile(profile),
        attempts,
      };
    } catch (error) {
      await logAiUsage(store, {
        ...usageBase,
        durationMs: Date.now() - attemptStartedAt,
        ok: false,
        error: error.message,
      });
      await markProfileHealth(store, profile, {
        healthStatus: "error",
        lastTestAt: new Date().toISOString(),
        lastDurationMs: Date.now() - attemptStartedAt,
        lastError: error.message,
      });
      attempts.push({ profileId: profile.id, profileName: profile.name, ok: false, error: error.message });
    }
  }

  const lastError = attempts[attempts.length - 1]?.error || "AI 暂时不可用";
  return {
    skipped: true,
    reason: attempts.some((item) => item.error === "missing-api-key") ? "missing-api-key" : "ai-unavailable",
    decision,
    error: lastError,
    report: null,
    prompt,
    attempts,
    durationMs: Date.now() - startedAt,
  };
}

async function analyzeActivity(store, input = {}, context = {}) {
  const settings = await getAiSettings(store);
  const decision = shouldCallAi(settings, context);
  if (!decision.call) return { skipped: true, reason: decision.reason, decision, report: null };
  const payload = activityPayload(input);
  const prompt = await getActivePrompt(store, "activity", promptVersionFor(settings, "activity"));
  return runAiAnalysis(store, {
    settings,
    scene: context.reported ? "report" : "activity",
    contentType: "activity",
    activityId: context.activityId,
    payload,
    prompt,
    messages: buildActivityMessages(prompt, payload, ANALYSIS_SCHEMA_TEXT),
    normalizer: normalizeAnalysisReport,
    decision,
    context,
  });
}

async function analyzeFeedback(store, input = {}, context = {}) {
  const settings = await getAiSettings(store);
  if (!settings.enabled && !context.forceAi) {
    return { skipped: true, reason: "disabled", decision: { call: false, reason: "disabled" }, report: null };
  }
  const payload = feedbackPayload(input);
  const prompt = await getActivePrompt(store, "feedback", promptVersionFor(settings, "feedback"));
  return runAiAnalysis(store, {
    settings,
    scene: "feedback",
    contentType: "feedback",
    activityId: context.activityId,
    payload,
    prompt,
    messages: buildFeedbackMessages(prompt, payload, FEEDBACK_SCHEMA_TEXT),
    normalizer: normalizeFeedbackReport,
    decision: { call: true, reason: "feedback" },
    context,
  });
}

async function testAiConnectionWithSettings(store, settings = {}, override = {}) {
  const effectiveSettings = {
    ...settings,
    ...override,
    apiKeyEncrypted: override.apiKey ? encryptSecret(override.apiKey) : settings.apiKeyEncrypted,
  };
  const apiKey = override.apiKey || decryptProfileKey(effectiveSettings);
  const adapter = getProviderAdapter(effectiveSettings.provider);
  const startedAt = Date.now();
  try {
    const result = await adapter.testConnection({ ...effectiveSettings, apiKey });
    return { ...result, durationMs: result.durationMs || Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      provider: effectiveSettings.provider || "",
      model: effectiveSettings.model || "",
      durationMs: Date.now() - startedAt,
      error: error.message,
    };
  }
}

async function testAiConnection(store, override = {}) {
  const settings = await getAiSettings(store);
  if (override.profileId) {
    const profile = await getAiModelProfile(store, override.profileId);
    if (!profile) {
      return { ok: false, provider: "", model: "", durationMs: 0, error: "找不到该模型档案" };
    }
    return testAiModelProfile(store, profile.id, override);
  }
  return testAiConnectionWithSettings(store, { ...settings, ...override }, override);
}

async function testAiModelProfile(store, id, override = {}) {
  const settings = await getAiSettings(store);
  const profile = typeof id === "object" ? normalizeModelProfile(id) : await getAiModelProfile(store, id);
  if (!profile) return { ok: false, provider: "", model: "", durationMs: 0, error: "找不到该模型档案" };
  const effectiveSettings = profileSettings(settings, { ...profile, ...override }, "", normalizeScene(override.scene || "manual"));
  const result = await testAiConnectionWithSettings(store, effectiveSettings, override);
  await markProfileHealth(store, profile, {
    healthStatus: result.ok ? "ok" : "error",
    lastTestAt: new Date().toISOString(),
    lastDurationMs: result.durationMs || 0,
    lastError: result.ok ? "" : result.error || "连接失败",
  });
  await logAiUsage(store, {
    profileId: profile.id,
    profileName: profile.name,
    scene: "manual",
    provider: effectiveSettings.provider,
    model: effectiveSettings.model,
    contentType: "connection-test",
    durationMs: result.durationMs || 0,
    ok: Boolean(result.ok),
    error: result.ok ? "" : result.error || "",
  });
  return { ...result, profile: publicAiModelProfile(profile) };
}

function emptyUsageStats(days = 7) {
  return {
    days,
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    cacheHits: 0,
    totalTokens: 0,
    averageDurationMs: 0,
    successRate: 0,
    models: [],
    recentErrors: [],
  };
}

async function getAiUsageStats(store, options = {}) {
  const days = Math.max(1, Math.min(90, Number(options.days || 7)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await store.query("aiUsageLogs", {
    page: 1,
    pageSize: 1000,
    maxPageSize: 1000,
    filters: [{ field: "createdAt", op: "gte", value: since }],
    sort: [{ field: "createdAt", direction: "desc" }],
  });
  if (!data.length) return emptyUsageStats(days);
  const stats = emptyUsageStats(days);
  const modelMap = new Map();
  for (const entry of data) {
    const totalTokens = Number(entry.tokenUsage?.total_tokens || entry.tokenUsage?.totalTokens || 0);
    const durationMs = Number(entry.durationMs || 0);
    stats.totalCalls += 1;
    stats.totalTokens += totalTokens;
    stats.cacheHits += entry.cacheHit ? 1 : 0;
    if (entry.ok !== false) stats.successCalls += 1;
    else stats.failedCalls += 1;
    if (entry.ok === false && stats.recentErrors.length < 8) {
      stats.recentErrors.push({
        profileId: entry.profileId || "",
        profileName: entry.profileName || "",
        provider: entry.provider || "",
        model: entry.model || "",
        scene: entry.scene || entry.contentType || "",
        error: entry.error || "调用失败",
        createdAt: entry.createdAt || "",
      });
    }
    const key = entry.profileId || `${entry.provider || "provider"}:${entry.model || "model"}`;
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        profileId: entry.profileId || "",
        profileName: entry.profileName || entry.model || entry.provider || "未命名模型",
        provider: entry.provider || "",
        model: entry.model || "",
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        cacheHits: 0,
        totalTokens: 0,
        totalDurationMs: 0,
        averageDurationMs: 0,
        successRate: 0,
      });
    }
    const item = modelMap.get(key);
    item.totalCalls += 1;
    item.totalTokens += totalTokens;
    item.totalDurationMs += durationMs;
    item.cacheHits += entry.cacheHit ? 1 : 0;
    if (entry.ok !== false) item.successCalls += 1;
    else item.failedCalls += 1;
  }
  const totalDuration = data.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0);
  stats.averageDurationMs = Math.round(totalDuration / stats.totalCalls);
  stats.successRate = Math.round((stats.successCalls / stats.totalCalls) * 1000) / 10;
  stats.models = Array.from(modelMap.values()).map((item) => {
    const { totalDurationMs, ...rest } = item;
    return {
      ...rest,
      averageDurationMs: item.totalCalls ? Math.round(totalDurationMs / item.totalCalls) : 0,
      successRate: item.totalCalls ? Math.round((item.successCalls / item.totalCalls) * 1000) / 10 : 0,
    };
  });
  return stats;
}

module.exports = {
  analyzeFeedback,
  analyzeActivity,
  checkAiDailyBudget,
  getAiSettings,
  publicAiSettings,
  saveAiSettings,
  shouldCallAi,
  testAiConnection,
  testAiModelProfile,
  listAiModelProfiles,
  getAiModelProfile,
  publicAiModelProfile,
  saveAiModelProfile,
  removeAiModelProfile,
  getAiUsageStats,
  AI_SCENES,
};
