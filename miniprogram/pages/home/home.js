const api = require("../../utils/api");
const { toActivityView } = require("../../utils/format");
const { loadReminderConfig, subscribeActivityReminder } = require("../../utils/activity-reminder");
const share = require("../../utils/share");

Page({
  data: {
    loading: true,
    error: "",
    activities: [],
    notificationConfig: null
  },

  onLoad() {
    share.enableShareMenu();
    this.loadNotificationConfig();
    this.loadHome();
  },

  onPullDownRefresh() {
    this.loadHome().finally(() => wx.stopPullDownRefresh());
  },

  async loadHome() {
    this.setData({ loading: true, error: "" });
    try {
      const data = await api.get("/api/activities?view=upcoming&page=1&pageSize=3&sort=start-asc");
      this.setData({
        activities: (data.activities || []).map(toActivityView),
        loading: false
      });
    } catch (error) {
      this.setData({
        error: error.message || "活动读取失败",
        loading: false
      });
    }
  },

  async loadNotificationConfig() {
    try {
      const notificationConfig = await loadReminderConfig();
      this.setData({ notificationConfig });
    } catch {
      this.setData({ notificationConfig: null });
    }
  },

  goActivities() {
    wx.switchTab({ url: "/pages/activities/activities" });
  },

  goEditor() {
    wx.navigateTo({ url: "/pages/activity-editor/activity-editor" });
  },

  goMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },

  openActivityDetail(event) {
    const activity = event.detail?.activity || {};
    if (!activity.id) return;
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${encodeURIComponent(activity.id)}` });
  },

  async recordInterest(event) {
    const activity = event.detail?.activity || {};
    if (!activity.id) return;
    try {
      const data = await api.post(`/api/activities/${encodeURIComponent(activity.id)}/interests`, {});
      this.setData({
        activities: this.data.activities.map((item) => item.id === activity.id ? toActivityView({
          ...item,
          interestCount: data.interestCount,
          interestedByMe: true
        }) : item)
      });
      wx.showToast({ title: data.existing ? "已经点过啦" : "已记录感兴趣", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "暂时不能记录", icon: "none" });
    }
  },

  async subscribeReminder(event) {
    const activity = event.detail?.activity || {};
    if (!activity.id) return;
    if (!this.data.notificationConfig) await this.loadNotificationConfig();
    try {
      const data = await subscribeActivityReminder(activity.id, this.data.notificationConfig || {});
      const accepted = data.subscription && data.subscription.status === "accepted";
      wx.showToast({ title: accepted ? "已订阅提醒" : "暂未授权提醒", icon: "none" });
    } catch (error) {
      wx.showToast({ title: error.message || "订阅失败", icon: "none" });
    }
  },

  onShareAppMessage(event = {}) {
    return share.activityShareFromEvent(event) || share.defaultShare("/pages/home/home");
  },

  onShareTimeline() {
    return share.defaultTimeline();
  }
});
