"use strict";

const { parseAnalysisJson } = require("../parser/json");

function providerDefaults(provider = "openai-compatible") {
  return {
    openai: "https://api.openai.com/v1",
    "openai-compatible": "",
    deepseek: "https://api.deepseek.com/v1",
    qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    openrouter: "https://openrouter.ai/api/v1",
    ollama: "http://127.0.0.1:11434/v1",
  }[provider] || "";
}

function isPrivateHostname(hostname = "") {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (["localhost", "0.0.0.0", "::", "::1", "metadata.tencentyun.com", "metadata.google.internal"].includes(host)) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d{1,2})\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  if (/^(fc|fd|fe80):/i.test(host)) return true;
  return false;
}

function normalizeBaseUrl(settings = {}) {
  const baseUrl = String(settings.baseUrl || providerDefaults(settings.provider)).replace(/\/+$/, "");
  if (!baseUrl) return "";
  const parsed = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("AI Provider Base URL 只允许 http 或 https");
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_AI_BASE_URL === "true"
    || process.env.STORE_DRIVER !== "cloudbase"
    || ["ollama", "local"].includes(String(settings.provider || "").toLowerCase());
  if (!allowPrivate && isPrivateHostname(parsed.hostname)) {
    throw new Error("生产环境不允许 AI Base URL 指向本机、内网或云元数据地址");
  }
  return baseUrl;
}

async function chatCompletion(settings, messages) {
  const baseUrl = normalizeBaseUrl(settings);
  const apiKey = settings.apiKey || "";
  const model = settings.model || settings.modelName || "";
  if (!baseUrl || !model) {
    throw new Error("AI Provider 缺少 Base URL 或 Model Name");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(settings.requestTimeoutMs || 15000));
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Number(settings.temperature ?? 0.2),
        max_tokens: Number(settings.maxTokens || 1200),
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || `AI 请求失败：${response.status}`);
    }
    const content = data.choices?.[0]?.message?.content || "";
    return {
      report: parseAnalysisJson(content, settings.provider || "openai-compatible"),
      raw: data,
      usage: data.usage || {},
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function testConnection(settings) {
  const startedAt = Date.now();
  const result = await chatCompletion({ ...settings, maxTokens: 120 }, [
    { role: "system", content: "只输出 JSON。" },
    { role: "user", content: "{\"riskScore\":0,\"confidence\":1,\"riskLevel\":\"low\",\"summary\":\"连接测试\"}" },
  ]);
  return {
    ok: true,
    provider: settings.provider || "openai-compatible",
    model: settings.model || "",
    durationMs: Date.now() - startedAt,
    sample: result.report,
  };
}

module.exports = {
  chatCompletion,
  normalizeBaseUrl,
  providerDefaults,
  testConnection,
};
