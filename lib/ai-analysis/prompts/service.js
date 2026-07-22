"use strict";

const { DEFAULT_AI_PROMPTS } = require("../../community-safety/defaults");

async function getActivePrompt(store, type = "activity", version = "") {
  let prompt = null;
  if (version) {
    prompt = await store.findByFilters("aiPrompts", [
      { field: "type", op: "eq", value: type },
      { field: "version", op: "eq", value: version },
    ]);
  }
  if (!prompt) {
    prompt = await store.findByFilters("aiPrompts", [
      { field: "type", op: "eq", value: type },
      { field: "active", op: "eq", value: true },
    ]);
  }
  return prompt || DEFAULT_AI_PROMPTS.find((item) => item.type === type) || DEFAULT_AI_PROMPTS[0];
}

function buildActivityMessages(prompt, payload = {}, schemaText = "") {
  const system = [
    prompt.systemPrompt || "",
    schemaText ? `统一 JSON Schema：\n${schemaText}` : "",
  ].filter(Boolean).join("\n\n");
  const user = [
    prompt.userPrompt || "",
    "活动内容：",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

module.exports = {
  buildActivityMessages,
  getActivePrompt,
};
