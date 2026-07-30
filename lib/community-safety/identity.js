"use strict";

const crypto = require("crypto");

const ANONYMOUS_ID_COOKIE = "yk_anon";
const SIGNED_ID_PREFIX = "v1";

function cleanHeader(value = "", max = 300) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function hashValue(value = "", salt = "") {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${String(value || "")}`)
    .digest("hex");
}

function getClientIp(req) {
  const forwarded = cleanHeader(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
  return String(ip).replace(/^::ffff:/, "");
}

function maskIp(ip = "") {
  const value = String(ip || "");
  if (value.includes(":")) {
    return value.split(":").slice(0, 3).join(":") + ":*";
  }
  const parts = value.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  return value ? "masked" : "";
}

function getIdentitySalt() {
  return process.env.IDENTITY_HASH_SALT || process.env.SESSION_SECRET || "youkong-community-os-local-salt";
}

function anonymousSigningSecret() {
  return process.env.ANONYMOUS_ID_SECRET || process.env.IDENTITY_HASH_SALT || process.env.SESSION_SECRET || "youkong-community-os-local-anon";
}

function signAnonymousId(id = "") {
  return crypto
    .createHmac("sha256", anonymousSigningSecret())
    .update(String(id || ""))
    .digest("base64url");
}

function makeSignedAnonymousId() {
  const id = crypto.randomBytes(24).toString("base64url");
  return `${SIGNED_ID_PREFIX}.${id}.${signAnonymousId(id)}`;
}

function parseSignedAnonymousId(value = "") {
  const [version, id, signature] = String(value || "").split(".");
  if (version !== SIGNED_ID_PREFIX || !id || !signature) return "";
  if (!/^[a-zA-Z0-9_-]{24,128}$/.test(id)) return "";
  const expected = signAnonymousId(id);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return "";
  return id;
}

function normalizeClientId(value = "") {
  const cleaned = cleanHeader(value, 128);
  if (/^[a-zA-Z0-9_-]{16,128}$/.test(cleaned)) return cleaned;
  return "";
}

function requestIdentity(req) {
  const salt = getIdentitySalt();
  const ip = getClientIp(req);
  const userAgent = cleanHeader(req.headers["user-agent"] || "", 500);
  const clientId = normalizeClientId(req.headers["x-yk-client-id"] || req.body?.clientId || req.query?.clientId || "");
  const fingerprint = cleanHeader(req.headers["x-yk-fingerprint"] || req.body?.fingerprint || "", 256);
  const signedAnonymousId = cleanHeader(req.ykAnonymousId || parseSignedAnonymousId(req.cookies?.[ANONYMOUS_ID_COOKIE] || ""), 128);
  const serverIdHash = signedAnonymousId ? hashValue(`server:${signedAnonymousId}`, salt) : "";
  const clientIdHash = clientId ? hashValue(`client:${clientId}`, salt) : "";
  const fingerprintHash = fingerprint ? hashValue(`fp:${fingerprint}`, salt) : "";
  const uaHash = hashValue(`ua:${userAgent}`, salt);
  const ipHash = hashValue(`ip:${ip}`, salt);
  const base = clientIdHash || serverIdHash || fingerprintHash || hashValue(`fallback:${ip}:${userAgent}`, salt);
  const compositeHash = hashValue([base, serverIdHash, fingerprintHash, uaHash, ipHash].filter(Boolean).join(":"), salt);

  return {
    id: `anon_${base.slice(0, 32)}`,
    compositeHash,
    rateLimitKey: compositeHash,
    serverIdHash,
    clientIdHash,
    fingerprintHash,
    uaHash,
    ipHash,
    ipMasked: maskIp(ip),
    userAgentSample: userAgent.slice(0, 120),
    hasServerIdentity: Boolean(serverIdHash),
    hasClientId: Boolean(clientId),
    hasFingerprint: Boolean(fingerprint),
  };
}

function publicIdentity(identity = {}) {
  return {
    id: identity.id,
    ipMasked: identity.ipMasked || "",
    userAgentSample: identity.userAgentSample || "",
    hasServerIdentity: Boolean(identity.hasServerIdentity),
    hasClientId: Boolean(identity.hasClientId),
    hasFingerprint: Boolean(identity.hasFingerprint),
  };
}

module.exports = {
  ANONYMOUS_ID_COOKIE,
  getClientIp,
  hashValue,
  makeSignedAnonymousId,
  parseSignedAnonymousId,
  publicIdentity,
  requestIdentity,
};
