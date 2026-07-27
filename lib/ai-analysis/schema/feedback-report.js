"use strict";

const DEFAULT_FEEDBACK_REPORT = {
  riskScore: 0,
  confidence: 0,
  riskLevel: "low",
  shouldDisplay: true,
  feedbackWeight: 50,
  isSpam: false,
  isAdvertisement: false,
  containsAbuse: false,
  containsPersonalAttack: false,
  containsPolitical: false,
  containsIllegal: false,
  containsAdult: false,
  summary: "",
  riskReason: [],
  positiveSignals: [],
  negativeSignals: [],
  displayReason: "",
  rawProvider: "",
};

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeFeedbackReport(value = {}) {
  const report = { ...DEFAULT_FEEDBACK_REPORT, ...(value || {}) };
  report.riskScore = clampScore(report.riskScore);
  report.feedbackWeight = clampScore(report.feedbackWeight ?? 50);
  report.confidence = Math.max(0, Math.min(1, Number(report.confidence || 0)));
  report.riskLevel = ["low", "medium", "high"].includes(String(report.riskLevel).toLowerCase())
    ? String(report.riskLevel).toLowerCase()
    : report.riskScore >= 70 ? "high" : report.riskScore >= 30 ? "medium" : "low";
  [
    "shouldDisplay",
    "isSpam",
    "isAdvertisement",
    "containsAbuse",
    "containsPersonalAttack",
    "containsPolitical",
    "containsIllegal",
    "containsAdult",
  ].forEach((key) => {
    report[key] = normalizeBoolean(report[key]);
  });
  ["riskReason", "positiveSignals", "negativeSignals"].forEach((key) => {
    report[key] = normalizeArray(report[key]);
  });
  ["summary", "displayReason", "rawProvider"].forEach((key) => {
    report[key] = String(report[key] || "").slice(0, key === "summary" ? 600 : 240);
  });
  return report;
}

module.exports = {
  DEFAULT_FEEDBACK_REPORT,
  normalizeFeedbackReport,
};
