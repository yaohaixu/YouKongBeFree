const CLIENT_ID_KEY = "yk_mp_client_id";

function randomPart() {
  return Math.random().toString(16).slice(2, 10);
}

function makeClientId() {
  return `mp_${Date.now().toString(16)}_${randomPart()}${randomPart()}`;
}

function getClientId() {
  let value = "";
  try {
    value = wx.getStorageSync(CLIENT_ID_KEY);
    if (!value) {
      value = makeClientId();
      wx.setStorageSync(CLIENT_ID_KEY, value);
    }
  } catch (error) {
    value = makeClientId();
  }
  return value;
}

function getFingerprint() {
  try {
    const info = wx.getSystemInfoSync();
    return [
      "mp",
      info.brand || "",
      info.model || "",
      info.platform || "",
      info.system || "",
      info.version || "",
      info.SDKVersion || "",
      info.language || ""
    ].join("|");
  } catch (error) {
    return "mp|unknown";
  }
}

module.exports = {
  getClientId,
  getFingerprint
};
