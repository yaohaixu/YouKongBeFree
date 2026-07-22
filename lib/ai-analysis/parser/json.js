"use strict";

const { normalizeAnalysisReport } = require("../schema/analysis-report");

function extractJson(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(source);
  } catch {
    const first = source.indexOf("{");
    const last = source.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(source.slice(first, last + 1));
    }
    throw new Error("AI 返回不是可解析的 JSON");
  }
}

function parseAnalysisJson(text = "", provider = "") {
  const parsed = extractJson(text);
  return normalizeAnalysisReport({ ...parsed, rawProvider: provider });
}

module.exports = {
  extractJson,
  parseAnalysisJson,
};
