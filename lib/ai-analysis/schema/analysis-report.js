"use strict";

const DEFAULT_ANALYSIS_REPORT = {
  riskScore: 0,
  confidence: 0,
  riskLevel: "low",
  isRealActivity: true,
  isAdvertisement: false,
  isSpam: false,
  isScam: false,
  containsPolitical: false,
  containsIllegal: false,
  containsAdult: false,
  containsViolence: false,
  summary: "",
  category: "",
  tags: [],
  location: "",
  time: "",
  peopleLimit: "",
  titleSuggestion: "",
  riskReason: [],
  positiveSignals: [],
  negativeSignals: [],
  improvementSuggestions: [],
  explanation: [],
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

function normalizeAnalysisReport(value = {}) {
  const report = { ...DEFAULT_ANALYSIS_REPORT, ...(value || {}) };
  report.riskScore = clampScore(report.riskScore);
  report.confidence = Math.max(0, Math.min(1, Number(report.confidence || 0)));
  report.riskLevel = ["low", "medium", "high"].includes(String(report.riskLevel).toLowerCase())
    ? String(report.riskLevel).toLowerCase()
    : report.riskScore >= 70 ? "high" : report.riskScore >= 30 ? "medium" : "low";
  [
    "isRealActivity",
    "isAdvertisement",
    "isSpam",
    "isScam",
    "containsPolitical",
    "containsIllegal",
    "containsAdult",
    "containsViolence",
  ].forEach((key) => {
    report[key] = normalizeBoolean(report[key]);
  });
  [
    "tags",
    "riskReason",
    "positiveSignals",
    "negativeSignals",
    "improvementSuggestions",
    "explanation",
  ].forEach((key) => {
    report[key] = normalizeArray(report[key]);
  });
  [
    "summary",
    "category",
    "location",
    "time",
    "peopleLimit",
    "titleSuggestion",
    "rawProvider",
  ].forEach((key) => {
    report[key] = String(report[key] || "").slice(0, key === "summary" ? 600 : 160);
  });
  return report;
}

module.exports = {
  DEFAULT_ANALYSIS_REPORT,
  normalizeAnalysisReport,
};
