"use strict";

function isLocalRequest(req) {
  const host = String(req.get("host") || "");
  return host.includes("127.0.0.1") || host.includes("localhost");
}

async function verifyTurnstile(req, config = {}) {
  const enabled = config.enabled === true || process.env.TURNSTILE_ENABLED === "true";
  if (!enabled) return { ok: true, skipped: true, reason: "disabled" };
  if (config.bypassLocal !== false && process.env.TURNSTILE_BYPASS_LOCAL !== "false" && isLocalRequest(req)) {
    return { ok: true, skipped: true, reason: "local-bypass" };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY || config.secretKey || "";
  const token = req.get("X-Turnstile-Token") || req.body?.turnstileToken || req.body?.["cf-turnstile-response"] || "";
  if (!secret) {
    return { ok: false, error: "Turnstile 未配置 Secret Key，请联系管理员。" };
  }
  if (!token) {
    return { ok: false, error: "没有完成人机验证，请刷新页面后重试。" };
  }

  const formData = new URLSearchParams();
  formData.set("secret", secret);
  formData.set("response", token);
  const ip = req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.ip || "";
  if (ip) formData.set("remoteip", String(ip));

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (data.success) return { ok: true, provider: "cloudflare", data };
    return {
      ok: false,
      error: "人机验证暂时没有通过，请刷新页面后再试。",
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: "人机验证服务暂时不可用，请稍后再试。",
      detail: error.message,
    };
  }
}

module.exports = {
  verifyTurnstile,
};
