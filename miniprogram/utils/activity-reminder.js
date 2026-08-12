const api = require("./api");
const cache = require("./cache");

const CONFIG_CACHE_KEY = cache.keys.miniprogramConfig();
const CONFIG_TTL = 60 * 60 * 1000;

async function loadReminderConfig() {
  const cached = cache.get(CONFIG_CACHE_KEY, { allowExpired: true });
  if (cached && cached.notifications) {
    api.get("/api/miniprogram/config")
      .then((data) => cache.set(CONFIG_CACHE_KEY, data, CONFIG_TTL))
      .catch(() => {});
    return cached.notifications || null;
  }
  const data = await api.get("/api/miniprogram/config").catch(() => ({ notifications: null }));
  cache.set(CONFIG_CACHE_KEY, data, CONFIG_TTL);
  return data.notifications || null;
}

function reminderTemplateIds(notificationConfig = {}) {
  const scene = notificationConfig
    && notificationConfig.scenes
    && notificationConfig.scenes.activityReminder;
  return scene && Array.isArray(scene.templateIds) ? scene.templateIds.filter(Boolean) : [];
}

async function subscribeActivityReminder(activityId, notificationConfig = {}) {
  const templateIds = reminderTemplateIds(notificationConfig);
  if (!templateIds.length) {
    throw new Error("活动提醒模板暂未配置");
  }
  if (!wx.requestSubscribeMessage) {
    throw new Error("当前微信版本不支持订阅提醒");
  }
  const authorization = await new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success: resolve,
      fail: reject,
    });
  });
  return api.post(`/api/activities/${encodeURIComponent(activityId)}/notification-subscriptions`, {
    source: "wechat_miniprogram",
    scene: "activity_reminder",
    templateIds,
    authorization,
  });
}

module.exports = {
  loadReminderConfig,
  reminderTemplateIds,
  subscribeActivityReminder,
};
