"use strict";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value || 0))));
}

function makeTrustProfile(identity, config = {}) {
  const now = new Date().toISOString();
  const initial = Number(config.initial ?? 50);
  return {
    id: identity.id,
    communityTrust: clamp(initial, config.min, config.max),
    identityId: identity.id,
    ipMasked: identity.ipMasked || "",
    userAgentSample: identity.userAgentSample || "",
    hasClientId: Boolean(identity.hasClientId),
    hasFingerprint: Boolean(identity.hasFingerprint),
    activityCount: 0,
    reportConfirmedCount: 0,
    lastActivityAt: "",
    createdAt: now,
    updatedAt: now,
  };
}

async function getOrCreateTrustProfile(store, identity, config = {}) {
  let profile = await store.findById("trustProfiles", identity.id);
  if (profile) {
    const patch = {
      ipMasked: identity.ipMasked || profile.ipMasked || "",
      userAgentSample: identity.userAgentSample || profile.userAgentSample || "",
      hasClientId: Boolean(identity.hasClientId || profile.hasClientId),
      hasFingerprint: Boolean(identity.hasFingerprint || profile.hasFingerprint),
      updatedAt: new Date().toISOString(),
    };
    profile = await store.update("trustProfiles", profile.id, patch) || { ...profile, ...patch };
    return profile;
  }
  profile = makeTrustProfile(identity, config);
  await store.insert("trustProfiles", profile);
  return profile;
}

async function recordTrustEvent(store, profile, event = {}, config = {}) {
  if (!profile) return null;
  const min = Number(config.min ?? 0);
  const max = Number(config.max ?? 100);
  const before = Number(profile.communityTrust ?? config.initial ?? 50);
  const delta = Number(event.delta || 0);
  const after = clamp(before + delta, min, max);
  const now = new Date().toISOString();
  const trustEvent = {
    id: event.id || `trust_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    identityId: profile.id,
    activityId: event.activityId || "",
    type: event.type || "trust.adjust",
    reason: event.reason || "",
    delta,
    before,
    after,
    metadata: event.metadata || {},
    createdAt: now,
  };
  await store.insert("trustEvents", trustEvent);
  const updated = await store.update("trustProfiles", profile.id, {
    communityTrust: after,
    activityCount: Number(profile.activityCount || 0) + Number(event.activityIncrement || 0),
    reportConfirmedCount: Number(profile.reportConfirmedCount || 0) + Number(event.reportConfirmedIncrement || 0),
    lastActivityAt: event.activityId ? now : profile.lastActivityAt || "",
    updatedAt: now,
  });
  return { profile: updated || { ...profile, communityTrust: after }, event: trustEvent };
}

function trustTier(profile = {}, config = {}) {
  const score = Number(profile.communityTrust ?? config.initial ?? 50);
  if (score >= Number(config.highTrustThreshold ?? 75)) return "high";
  if (score <= Number(config.lowTrustThreshold ?? 25)) return "low";
  return "normal";
}

module.exports = {
  getOrCreateTrustProfile,
  makeTrustProfile,
  recordTrustEvent,
  trustTier,
};
