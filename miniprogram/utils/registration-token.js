const KEY = "yk_mp_registration_tokens";

function all() {
  try {
    return wx.getStorageSync(KEY) || {};
  } catch (error) {
    return {};
  }
}

function save(registration, accessToken) {
  if (!registration || !registration.id || !accessToken) return;
  try {
    const tokens = all();
    tokens[registration.id] = {
      activityId: registration.activityId,
      accessToken,
      nickname: registration.nickname || "",
      savedAt: new Date().toISOString(),
    };
    wx.setStorageSync(KEY, tokens);
  } catch (error) {
    // 报名已经成功，本地凭证保存失败时不打断用户。
  }
}

function get(registrationId) {
  const tokens = all();
  return tokens[registrationId] || {};
}

function forget(registrationId) {
  try {
    const tokens = all();
    delete tokens[registrationId];
    wx.setStorageSync(KEY, tokens);
  } catch (error) {
    // 取消报名已完成时，本地清理失败不打断用户。
  }
}

module.exports = {
  all,
  save,
  get,
  forget,
};
