const api = require("./api");

async function loadReminderConfig() {
  const data = await api.get("/api/miniprogram/config").catch(() => ({ notifications: null }));
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
