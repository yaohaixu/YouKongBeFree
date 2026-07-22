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

function mergeRisk(ruleReport = {}, aiReport = null) {
  const ruleScore = Number(ruleReport.riskScore || 0);
  if (!aiReport) {
    return {
      riskScore: ruleScore,
      confidenceScore: 100 - ruleScore,
      riskLevel: ruleReport.riskLevel || (ruleScore >= 70 ? "high" : ruleScore >= 30 ? "medium" : "low"),
    };
  }
  const aiScore = Number(aiReport.riskScore || 0);
  const aiConfidence = Math.max(0.1, Math.min(1, Number(aiReport.confidence || 0.6)));
  const riskScore = Math.round(ruleScore * 0.55 + aiScore * 0.45 * aiConfidence + aiScore * 0.15 * (1 - aiConfidence));
  return {
    riskScore: Math.max(0, Math.min(100, riskScore)),
    confidenceScore: Math.max(0, Math.min(100, 100 - riskScore)),
    riskLevel: riskScore >= 70 ? "high" : riskScore >= 30 ? "medium" : "low",
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

  const merged = mergeRisk(ruleReport, aiReport);
  const highRiskAction = config.highRiskAction || "review";
  const publishDirectMaxRisk = Number(config.publishDirectMaxRisk ?? 29);
  const publishWithNoticeMaxRisk = Number(config.publishWithNoticeMaxRisk ?? 59);
  const rejectMinRisk = Number(config.rejectMinRisk ?? 96);
  const trust = Number(trustProfile.communityTrust ?? 50);
  const trustLowRiskPenalty = trust < 25 ? 8 : 0;
  const adjustedRisk = Math.max(0, Math.min(100, merged.riskScore + trustLowRiskPenalty));
  const adjustedLevel = adjustedRisk >= 70 ? "high" : adjustedRisk >= 30 ? "medium" : "low";

  if (adjustedRisk >= rejectMinRisk && highRiskAction === "reject") {
    return {
      ...merged,
      riskScore: adjustedRisk,
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
      riskLevel: adjustedLevel,
      action: highRiskAction === "allow" ? "publish_with_notice" : "review",
      status: highRiskAction === "allow" ? "published" : "admin_review",
      reviewStep: highRiskAction === "allow" ? "" : "admin",
      riskNotice: riskNoticeFor(adjustedLevel, aiReport || {}),
      recommendationWeight: highRiskAction === "allow" ? 30 : 0,
    };
  }

  if (adjustedRisk > publishDirectMaxRisk) {
    return {
      ...merged,
      riskScore: adjustedRisk,
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
