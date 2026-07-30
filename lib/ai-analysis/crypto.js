"use strict";

const crypto = require("crypto");

function encryptionKeyFrom(source = "") {
  return crypto.createHash("sha256").update(String(source)).digest();
}

function encryptionKeySource() {
  return process.env.AI_CONFIG_ENCRYPTION_KEY
    || process.env.IDENTITY_HASH_SALT
    || process.env.SESSION_SECRET
    || "youkong-ai-config-local-key";
}

function encryptionKey() {
  return encryptionKeyFrom(encryptionKeySource());
}

function decryptionKeys() {
  const sources = [encryptionKeySource(), process.env.AI_CONFIG_ENCRYPTION_KEY_PREVIOUS]
    .map((source) => String(source || ""))
    .filter(Boolean);
  return [...new Set(sources)].map((source) => encryptionKeyFrom(source));
}

function encryptSecret(value = "") {
  const text = String(value || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value = "") {
  const text = String(value || "");
  if (!text) return "";
  const parts = text.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  const [, ivValue, tagValue, encryptedValue] = parts;
  for (const key of decryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      // Try the configured migration key before treating the encrypted value as unavailable.
    }
  }
  return "";
}

function maskSecret(value = "") {
  return value ? "已保存，可覆盖替换" : "未配置";
}

module.exports = {
  decryptSecret,
  encryptionKeySource,
  encryptSecret,
  maskSecret,
};
