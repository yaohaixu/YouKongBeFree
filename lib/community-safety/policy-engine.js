"use strict";

function riskNoticeFor(level, analysis = {}) {
  if (level === "medium") {
    if (analysis.isAdvertisement) {
      return {
        level: "medium",
        text: "社区 AI 提示：本活动包含一定营销内容，请参与者自行判断。",
      };
    }
    return {
      level: "medium",
      text: "社区提示：这条活动有一些需要自行判断的信息，参与前可以多确认时间、地点和发起人。",
    };
  }
  if (level === "high") {
    return {
      level: "high",
      text: "社区 AI 提示：本活动存在一定风险，请谨慎参与，并优先与发起人确认细节。",
    };
  }
  return {
    level: "none",
    text: "",
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function normalizedLevel(value = "") {
  const text = String(value || "").trim().toLowerCase();
  if (["clear", "high", "明确", "严重"].includes(text)) return "clear";
  if (["suspected", "medium", "疑似", "可能"].includes(text)) return "suspected";
  return "none";
}

function textIncludesAny(value = "", words = []) {
  const text = String(value || "").toLowerCase();
  return words.some((word) => text.includes(String(word).toLowerCase()));
}

function aiSignalPolicy(aiReport = null, config = {}) {
  if (!aiReport) return { riskFloor: 0, reviewFlag: "", forceHiddenReview: false, reason: "" };
  const reasons = [
    ...(Array.isArray(aiReport.riskReason) ? aiReport.riskReason : []),
    ...(Array.isArray(aiReport.negativeSignals) ? aiReport.negativeSignals : []),
    aiReport.summary || "",
  ].join(" ");
  const confidence = Number(aiReport.confidence || 0);
  const aiScore = Number(aiReport.riskScore || 0);
  const floors = config.aiSignalRiskFloors || {};
  const clearConfidence = Number(config.clearSignalConfidence ?? 0.72);
  const suspectedConfidence = Number(config.suspectedSignalConfidence ?? 0.45);
  const advertisementLevel = normalizedLevel(aiReport.advertisementLevel);
  const spamLevel = normalizedLevel(aiReport.spamLevel);
  const politicalLevel = normalizedLevel(aiReport.politicalSensitivity || aiReport.politicalLevel);
  const explicitMarketingWords = ["明确营销", "广告营销", "招商", "代理", "返利", "优惠", "推广", "引流", "销售", "课程销售"];
  const suspectedMarketingWords = ["营销", "广告", "商业推广", "联系方式", "外链", "引导添加"];

  if (aiReport.containsPolitical || politicalLevel !== "none") {
    return {
      riskFloor: Number(floors.political ?? 95),
      forceHiddenReview: true,
      reviewFlag: "political_sensitive",
      reason: "political-sensitive",
    };
  }
  if (aiReport.isScam) {
    return {
      riskFloor: Number(floors.scam ?? 92),
      forceHiddenReview: true,
      reviewFlag: "scam",
      reason: "scam-risk",
    };
  }
  if (aiReport.containsIllegal) {
    return {
      riskFloor: Number(floors.illegal ?? 90),
      forceHiddenReview: true,
      reviewFlag: "illegal",
      reason: "illegal-risk",
    };
  }
  if (aiReport.containsAdult) {
    return {
      riskFloor: Number(floors.adult ?? 90),
      forceHiddenReview: true,
      reviewFlag: "adult",
      reason: "adult-risk",
    };
  }
  const clearSpam = aiReport.isSpam && (spamLevel === "clear" || aiScore >= Number(config.clearSpamMinRisk ?? 75) || confidence >= clearConfidence);
  if (clearSpam) {
    return {
      riskFloor: Number(floors.clearSpam ?? 80),
      forceHiddenReview: true,
      reviewFlag: "clear_spam",
      reason: "clear-spam",
    };
  }
  const clearAdvertisement = aiReport.isAdvertisement
    && (
      advertisementLevel === "clear"
      || aiScore >= Number(config.clearAdvertisementMinRisk ?? 75)
      || (confidence >= clearConfidence && textIncludesAny(reasons, explicitMarketingWords))
    );
  if (clearAdvertisement) {
    return {
      riskFloor: Number(floors.clearAdvertisement ?? 75),
      forceHiddenReview: true,
      reviewFlag: "clear_advertisement",
      reason: "clear-advertisement",
    };
  }
  const suspectedAdvertisement = aiReport.isAdvertisement
    || advertisementLevel === "suspected"
    || (confidence >= suspectedConfidence && textIncludesAny(reasons, suspectedMarketingWords));
  if (suspectedAdvertisement) {
    return {
      riskFloor: Number(floors.suspectedAdvertisement ?? 40),
      forceHiddenReview: false,
      reviewFlag: "admin_attention",
      reason: "suspected-advertisement",
    };
  }
  return { riskFloor: 0, reviewFlag: "", forceHiddenReview: false, reason: "" };
}

function mergeRisk(ruleReport = {}, aiReport = null, config = {}) {
  const ruleScore = Number(ruleReport.riskScore || 0);
  if (!aiReport) {
    return {
      riskScore: ruleScore,
      confidenceScore: 100 - ruleScore,
      riskLevel: ruleReport.riskLevel || (ruleScore >= 70 ? "high" : ruleScore >= 30 ? "medium" : "low"),
      sourceRiskScore: ruleScore,
      aiAdjustment: 0,
    };
  }
  const aiScore = Number(aiReport.riskScore || 0);
  const aiConfidence = Math.max(0.1, Math.min(1, Number(aiReport.confidence || 0.6)));
  const influence = Math.max(0, Math.min(1, Number(config.aiRiskInfluence ?? 0.5)));
  const maxDecrease = Math.max(0, Number(config.aiMaxRiskDecrease ?? 0));
  const maxIncrease = Math.max(0, Number(config.aiMaxRiskIncrease ?? 45));
  const rawAdjustment = Math.round((aiScore - ruleScore) * influence * aiConfidence);
  const aiAdjustment = Math.max(-maxDecrease, Math.min(maxIncrease, rawAdjustment));
  const signal = aiSignalPolicy(aiReport, config);
  const riskScore = clampScore(Math.max(ruleScore + aiAdjustment, signal.riskFloor || 0));
  return {
    riskScore,
    confidenceScore: 100 - riskScore,
    riskLevel: riskScore >= 70 ? "high" : riskScore >= 30 ? "medium" : "low",
    sourceRiskScore: ruleScore,
    aiRiskScore: Math.max(0, Math.min(100, Math.round(aiScore))),
    aiAdjustment,
    signalRiskFloor: signal.riskFloor || 0,
    safetyDecisionReason: signal.reason || "",
    reviewFlag: signal.reviewFlag || "",
    forceHiddenReview: Boolean(signal.forceHiddenReview),
  };
}

function decideActivityPolicy({ intent = "submit", ruleReport = {}, aiReport = null, trustProfile = {}, config = {} }) {
  if (intent === "draft") {
    return {
      action: "draft",
      status: "draft",
      reviewStep: "",
      riskNotice: riskNoticeFor("none"),
      recommendationWeight: 0,
    };
  }

  const merged = mergeRisk(ruleReport, aiReport, config);
  const highRiskAction = config.highRiskAction || "review";
  const publishDirectMaxRisk = Number(config.publishDirectMaxRisk ?? 29);
  const publishWithNoticeMaxRisk = Number(config.publishWithNoticeMaxRisk ?? 59);
  const rejectMinRisk = Number(config.rejectMinRisk ?? 96);
  const trust = Number(trustProfile.communityTrust ?? 50);
  const trustLowRiskPenalty = trust < 25 ? 8 : 0;
  const adjustedRisk = Math.max(0, Math.min(100, merged.riskScore + trustLowRiskPenalty));
  const adjustedLevel = adjustedRisk >= 70 ? "high" : adjustedRisk >= 30 ? "medium" : "low";
  if (merged.forceHiddenReview) {
    return {
      ...merged,
      riskScore: adjustedRisk,
      confidenceScore: 100 - adjustedRisk,
      riskLevel: adjustedLevel,
      action: "hidden_review",
      status: "admin_review",
      reviewStep: "admin",
      reviewMode: "admin_only",
      isHidden: true,
      riskNotice: riskNoticeFor("high", aiReport || {}),
      recommendationWeight: 0,
    };
  }
  if (merged.reviewFlag === "admin_attention" && adjustedRisk <= publishWithNoticeMaxRisk) {
    return {
      ...merged,
      riskScore: adjustedRisk,
      confidenceScore: 100 - adjustedRisk,
      riskLevel: "medium",
      action: "publish_with_admin_attention",
      status: "published",
      reviewStep: "",
      reviewMode: "admin_only",
      isHidden: false,
      riskNotice: riskNoticeFor("medium", aiReport || {}),
      recommendationWeight: 35,
    };
  }
  const aiUnavailable = config.aiUnavailable === true;
  const aiExpected = config.aiExpected === true;
  const aiUnavailableAction = config.aiUnavailableAction || "review";
  const shouldFallbackForAi = aiUnavailable
    && aiUnavailableAction === "review"
    && adjustedRisk >= Number(config.aiUnavailableReviewMinRisk ?? config.fallbackReviewMinRisk ?? 60)
    && (config.aiUnavailableReviewWhenAiExpected === false || aiExpected);

  if (shouldFallbackForAi) {
    return {
      ...merged,
      riskScore: adjustedRisk,
      confidenceScore: 100 - adjustedRisk,
      riskLevel: adjustedLevel,
      action: "review",
      status: "admin_review",
      reviewStep: "admin",
      reviewMode: "admin_only",
      riskNotice: riskNoticeFor(adjustedLevel, aiReport || {}),
      recommendationWeight: 0,
      safetyFallbackReason: "ai-unavailable",
    };
  }

  if (adjustedRisk >= rejectMinRisk && highRiskAction === "reject") {
    return {
      ...merged,
      riskScore: adjustedRisk,
      confidenceScore: 100 - adjustedRisk,
      riskLevel: "high",
      action: "reject",
      status: "rejected",
      reviewStep: "",
      riskNotice: riskNoticeFor("high", aiReport || {}),
      recommendationWeight: 0,
    };
  }

  if (adjustedRisk > publishWithNoticeMaxRisk) {
    return {
      ...merged,
      riskScore: adjustedRisk,
      confidenceScore: 100 - adjustedRisk,
      riskLevel: adjustedLevel,
      action: highRiskAction === "allow" ? "publish_with_notice" : "review",
      status: highRiskAction === "allow" ? "published" : "admin_review",
      reviewStep: highRiskAction === "allow" ? "" : "admin",
      reviewMode: highRiskAction === "allow" ? "" : (config.reviewNeedsCollaborator ? "two_step" : "admin_only"),
      riskNotice: riskNoticeFor(adjustedLevel, aiReport || {}),
      recommendationWeight: highRiskAction === "allow" ? 30 : 0,
    };
  }

  if (adjustedRisk > publishDirectMaxRisk) {
    return {
      ...merged,
      riskScore: adjustedRisk,
      confidenceScore: 100 - adjustedRisk,
      riskLevel: "medium",
      action: "publish_with_notice",
      status: "published",
      reviewStep: "",
      riskNotice: config.mediumRiskNotice === false ? riskNoticeFor("none") : riskNoticeFor("medium", aiReport || {}),
      recommendationWeight: 70,
    };
  }

  return {
    ...merged,
    riskScore: adjustedRisk,
    confidenceScore: 100 - adjustedRisk,
    riskLevel: "low",
    action: "publish",
    status: "published",
    reviewStep: "",
    riskNotice: riskNoticeFor("none"),
    recommendationWeight: trust >= 75 ? 115 : 100,
  };
}

module.exports = {
  decideActivityPolicy,
  mergeRisk,
  riskNoticeFor,
};
