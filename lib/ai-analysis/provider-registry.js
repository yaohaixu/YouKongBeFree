"use strict";

const openAiCompatible = require("./providers/openai-compatible");

const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  "openai-compatible",
  "openai",
  "deepseek",
  "qwen",
  "openrouter",
  "ollama",
  "local",
]);

function getProviderAdapter(provider = "openai-compatible") {
  const key = String(provider || "openai-compatible").toLowerCase();
  if (OPENAI_COMPATIBLE_PROVIDERS.has(key)) return openAiCompatible;
  if (key === "claude" || key === "anthropic" || key === "gemini") {
    return {
      async chatCompletion() {
        throw new Error(`${provider} 需要新增专用 Provider Adapter 后再启用。当前业务层无需修改，只需补 adapter。`);
      },
      async testConnection() {
        throw new Error(`${provider} 需要新增专用 Provider Adapter 后再启用。`);
      },
    };
  }
  return openAiCompatible;
}

module.exports = {
  getProviderAdapter,
};
