"use strict";

const { richTextLengthExcludingImages } = require("../rich-text");

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u{1f300}-\u{1faff}]/gu;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+|(?:^|\s)(?:www\.)[^\s<>"']+/gi;
const HTML_TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function plainTextFromRichText(value = "") {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, " [图片] ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnicode(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
}

function finding(rule, scoreDelta, reason, evidence = []) {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: rule.type,
    scoreDelta: Number(scoreDelta || 0),
    reason,
    evidence: evidence.slice(0, 8),
  };
}

function countMatches(pattern, text = "") {
  return Array.from(String(text || "").matchAll(pattern)).length;
}

function duplicateRatio(text = "") {
  const chunks = String(text || "")
    .split(/[。！？!?\n；;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
  if (chunks.length < 4) return 0;
  const counts = chunks.reduce((acc, chunk) => {
    acc.set(chunk, (acc.get(chunk) || 0) + 1);
    return acc;
  }, new Map());
  const repeated = Array.from(counts.values()).filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  return repeated / chunks.length;
}

function symbolRatio(text = "") {
  const value = String(text || "");
  if (!value) return 0;
  const symbols = value.match(/[!！?？￥$%#*_=+~`^|\\/<>【】{}[\]（）()]{1}/g) || [];
  return symbols.length / value.length;
}

function runRule(rule = {}, context = {}) {
  const weight = Number(rule.weight || 0);
  const params = rule.params || {};
  const { raw, normalized, text, input } = context;

  if (rule.type === "sensitive_terms") {
    const terms = Array.isArray(params.terms) ? params.terms : [];
    const hits = terms.filter((term) => term && normalized.includes(String(term).toLowerCase()));
    return hits.length ? [finding(rule, weight, `命中 ${hits.length} 个敏感词`, hits)] : [];
  }

  if (rule.type === "url_density") {
    const urls = Array.from(raw.matchAll(URL_PATTERN)).map((match) => match[0].trim());
    if (!urls.length) return [];
    const highDensity = Math.max(1, Number(params.highDensity || 3));
    const delta = urls.length >= highDensity ? weight + Math.min(10, urls.length * 2) : Math.ceil(weight / 2);
    return [finding(rule, delta, `检测到 ${urls.length} 个外链`, urls.slice(0, 5))];
  }

  if (rule.type === "html_tag_filter") {
    const allowedTags = new Set(Array.isArray(params.allowedTags) ? params.allowedTags.map((tag) => String(tag).toLowerCase()) : []);
    const tags = Array.from(raw.matchAll(HTML_TAG_PATTERN)).map((match) => match[1].toLowerCase());
    const disallowed = Array.from(new Set(tags.filter((tag) => !allowedTags.has(tag))));
    return disallowed.length ? [finding(rule, weight, "检测到非白名单 HTML 标签", disallowed)] : [];
  }

  if (rule.type === "script_injection") {
    const hits = [];
    if (/<script[\s>]/i.test(raw)) hits.push("script 标签");
    if (/\son[a-z]+\s*=/i.test(raw)) hits.push("事件属性");
    if (/javascript\s*:/i.test(raw)) hits.push("javascript: 链接");
    if (/<iframe|<object|<embed/i.test(raw)) hits.push("iframe/object/embed");
    return hits.length ? [finding(rule, weight, "检测到脚本注入痕迹", hits)] : [];
  }

  if (rule.type === "markdown_dangerous") {
    const hits = [];
    if (/\[[^\]]+\]\(\s*javascript:/i.test(raw)) hits.push("Markdown javascript 链接");
    if (/<iframe|<object|<embed|<form/i.test(raw)) hits.push("危险 HTML 片段");
    return hits.length ? [finding(rule, weight, "Markdown 或 HTML 中包含危险语法", hits)] : [];
  }

  if (rule.type === "unicode_confusable") {
    const invisible = (String(raw).match(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g) || []).length;
    const normalizedDiff = raw.length - normalizeUnicode(raw).length;
    const suspicious = invisible + Math.max(0, normalizedDiff);
    return suspicious > Number(params.maxSuspiciousChars || 8)
      ? [finding(rule, weight, `检测到 ${suspicious} 个疑似混淆或不可见字符`, [])]
      : [];
  }

  if (rule.type === "emoji_ratio") {
    const emojis = countMatches(EMOJI_PATTERN, text);
    const ratio = text.length ? emojis / text.length : 0;
    return ratio > Number(params.maxRatio || 0.18)
      ? [finding(rule, weight, `Emoji 比例偏高（${Math.round(ratio * 100)}%）`, [])]
      : [];
  }

  if (rule.type === "repeated_chars") {
    const repeatLength = Math.max(4, Number(params.repeatLength || 6));
    const pattern = new RegExp(`(.)\\1{${repeatLength - 1},}`, "u");
    const match = text.match(pattern);
    return match ? [finding(rule, weight, "检测到重复字符或刷屏式表达", [match[0].slice(0, 20)])] : [];
  }

  if (rule.type === "long_text") {
    const length = richTextLengthExcludingImages(raw);
    const maxSoftLength = Number(params.maxSoftLength || 12000);
    return length > maxSoftLength
      ? [finding(rule, weight, `正文长度 ${length}，明显高于普通活动描述`, [])]
      : [];
  }

  if (rule.type === "duplicate_content") {
    const ratio = duplicateRatio(text);
    return ratio > Number(params.maxDuplicateRatio || 0.35)
      ? [finding(rule, weight, `重复段落比例偏高（${Math.round(ratio * 100)}%）`, [])]
      : [];
  }

  if (rule.type === "abnormal_format") {
    const ratio = symbolRatio(text);
    const contactLike = countMatches(/(?:微信|加我|扫码|私信|vx|v信|招商|代理|优惠|折扣)/gi, text);
    const hits = [];
    if (ratio > Number(params.maxSymbolRatio || 0.28)) hits.push(`符号比例 ${Math.round(ratio * 100)}%`);
    if (contactLike >= 4) hits.push(`营销/联系方式词 ${contactLike} 个`);
    return hits.length ? [finding(rule, weight, "格式或营销表达异常", hits)] : [];
  }

  if (rule.type === "activity_completeness") {
    const positives = [];
    if (input.title) positives.push("有标题");
    if (input.startsAt) positives.push("有时间");
    if (input.location) positives.push("有地点");
    if (input.initiator) positives.push("有发起人");
    if (text.length >= 80) positives.push("描述较完整");
    if (positives.length >= 4) {
      return [finding(rule, weight, "活动信息较完整，降低风险分", positives)];
    }
  }

  return [];
}

function analyzeRules(input = {}, rules = [], config = {}) {
  const raw = [
    input.title,
    input.initiator,
    input.location,
    input.description,
    input.initiatorContact,
  ].filter(Boolean).join("\n");
  const normalized = normalizeUnicode(raw).toLowerCase();
  const text = plainTextFromRichText(raw);
  const enabledRules = rules.filter((rule) => rule && rule.enabled !== false);
  const findings = enabledRules.flatMap((rule) => runRule(rule, { raw, normalized, text, input }));
  const scoreDelta = findings.reduce((sum, item) => sum + Number(item.scoreDelta || 0), 0);
  const baseRiskScore = Number(config.baseRiskScore ?? 8);
  const riskScore = clampScore(baseRiskScore + scoreDelta);
  const confidenceScore = 100 - riskScore;
  const riskLevel = riskScore >= 70 ? "high" : riskScore >= 30 ? "medium" : "low";
  return {
    baseRiskScore,
    riskScore,
    confidenceScore,
    riskLevel,
    findings,
    normalizedPreview: text.slice(0, 500),
  };
}

module.exports = {
  analyzeRules,
  clampScore,
  normalizeUnicode,
  plainTextFromRichText,
};
