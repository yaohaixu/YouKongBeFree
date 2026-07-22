"use strict";

function getByPath(source = {}, path = "") {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), source);
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

function evaluateCondition(context = {}, condition = {}) {
  const actual = getByPath(context, condition.field);
  const expected = condition.value;
  const op = condition.op || "eq";

  if (op === "exists") return actual !== undefined && actual !== null && actual !== "";
  if (op === "empty") return actual === undefined || actual === null || actual === "";
  if (op === "eq") return actual === expected;
  if (op === "neq") return actual !== expected;
  if (op === "gt") return asNumber(actual) > asNumber(expected);
  if (op === "gte") return asNumber(actual) >= asNumber(expected);
  if (op === "lt") return asNumber(actual) < asNumber(expected);
  if (op === "lte") return asNumber(actual) <= asNumber(expected);
  if (op === "between") {
    const [min, max] = Array.isArray(expected) ? expected : [0, 0];
    const value = asNumber(actual);
    return value >= asNumber(min) && value <= asNumber(max);
  }
  if (op === "includes") {
    if (Array.isArray(actual)) return actual.includes(expected);
    return normalizeText(actual).includes(normalizeText(expected));
  }
  if (op === "in") {
    return Array.isArray(expected) && expected.includes(actual);
  }
  if (op === "regex") {
    try {
      return new RegExp(String(expected), "i").test(String(actual ?? ""));
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeRule(rule = {}) {
  if (Array.isArray(rule.conditions)) {
    return {
      mode: rule.conditionMode || rule.mode || "all",
      conditions: rule.conditions,
    };
  }
  if (rule.rule && Array.isArray(rule.rule.conditions)) {
    return normalizeRule(rule.rule);
  }
  return {
    mode: rule.mode || "all",
    conditions: [],
  };
}

function evaluateRule(context = {}, rule = {}) {
  const normalized = normalizeRule(rule);
  const conditions = normalized.conditions.filter((condition) => condition && condition.field);
  if (!conditions.length) return true;
  if (normalized.mode === "any") {
    return conditions.some((condition) => evaluateCondition(context, condition));
  }
  return conditions.every((condition) => evaluateCondition(context, condition));
}

module.exports = {
  evaluateCondition,
  evaluateRule,
  getByPath,
};
