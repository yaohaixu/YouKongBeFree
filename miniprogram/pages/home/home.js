const api = require("../../utils/api");
const { toActivityView } = require("../../utils/format");
const share = require("../../utils/share");

Page({
  data: {
    loading: true,
    error: "",
    activities: []
  },

  onLoad() {
    share.enableShareMenu();
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

  goActivities() {
    wx.switchTab({ url: "/pages/activities/activities" });
  },

  goEditor() {
    wx.navigateTo({ url: "/pages/activity-editor/activity-editor" });
  },

  goMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },

  onShareAppMessage(event = {}) {
    return share.activityShareFromEvent(event) || share.defaultShare("/pages/home/home");
  },

  onShareTimeline() {
    return share.defaultTimeline();
  }
});
